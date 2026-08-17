// Manifest endpoint for the Expo Updates v1 protocol.
//
// Spec: https://docs.expo.dev/technical-specs/expo-updates-1/
//
// Responsibilities, deliberately narrow:
//   1. Validate the protocol version and platform from request headers.
//   2. Look up the current update for (platform, runtimeVersion) in S3.
//   3. Return the manifest, signed if the client asked for a signature.
//   4. Return a rollBackToEmbedded directive when a rollback marker is present.
//
// Everything expensive — bundling, hashing, uploading — happens in
// scripts/publish-update.mjs. This function only reads one small JSON object and
// signs it, which is why it is fast enough to sit in the app launch path.
//
// Protocol mechanics live in ./protocol.mjs, which has no AWS imports so it can be
// unit tested outside Lambda. See protocol.test.mjs.
//
// S3 layout it reads:
//   runtime/<platform>/<runtimeVersion>/latest.json     complete manifest, served as-is
//   runtime/<platform>/<runtimeVersion>/rollback.json   presence triggers a rollback directive
//
// Rollback is a copy, not a rebuild: overwrite latest.json with an older
// <updateId>/manifest.json and the next check serves the older update.

import { createSign, randomUUID } from 'node:crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import {
  SIGNING_ALGORITHM,
  parseSfvDictionary,
  serializeSfvDictionary,
  negotiateContentType,
  commonHeaders,
  buildMultipartBody,
  validateRequest,
  normalizeHeaders,
} from './protocol.mjs';

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.UPDATES_BUCKET;
const CODE_SIGNING_ENABLED = process.env.CODE_SIGNING_ENABLED === 'true';
const CODE_SIGNING_SECRET = process.env.CODE_SIGNING_SECRET;
const CODE_SIGNING_KEY_ID = process.env.CODE_SIGNING_KEY_ID || 'main';

const s3 = new S3Client({ region: REGION });
const secrets = new SecretsManagerClient({ region: REGION });

// Cached across invocations, so a warm container costs zero Secrets Manager calls.
// This endpoint is hit on every app launch, so a per-request secret fetch would be
// both slow and needlessly expensive.
let cachedPrivateKey = null;

async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;

  const result = await secrets.send(
    new GetSecretValueCommand({ SecretId: CODE_SIGNING_SECRET })
  );

  const pem = result.SecretString;
  if (!pem || !pem.includes('PRIVATE KEY')) {
    throw new Error(
      `Secret ${CODE_SIGNING_SECRET} does not contain a PEM private key. ` +
        'Generate one with `npx expo-updates codesigning:generate` and store the ' +
        'private key in this secret.'
    );
  }

  cachedPrivateKey = pem;
  return cachedPrivateKey;
}

/**
 * Sign a body with RSA PKCS#1 v1.5 over SHA-256.
 *
 * The signature covers the exact bytes transmitted, so callers must sign the same
 * serialized string they send. Re-serializing could reorder keys or change
 * whitespace and would fail verification on the client.
 */
async function signBody(body) {
  const privateKey = await getPrivateKey();
  const signer = createSign('RSA-SHA256');
  signer.update(body, 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

async function signatureHeaderFor(body) {
  return serializeSfvDictionary({
    sig: await signBody(body),
    keyid: CODE_SIGNING_KEY_ID,
    alg: SIGNING_ALGORITHM,
  });
}

async function getJsonObject(key) {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const text = await result.Body.transformToString('utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

function response(statusCode, headers, body) {
  return {
    statusCode,
    headers,
    // Base64 throughout, so the bytes the client receives are exactly the bytes we
    // signed. Returning a plain string risks re-encoding of non-ASCII content in
    // the manifest, which would invalidate the signature.
    body: body === undefined ? '' : Buffer.from(body, 'utf8').toString('base64'),
    isBase64Encoded: true,
  };
}

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, max-age=0',
      'expo-protocol-version': '1',
      'expo-sfv-version': '0',
    },
    body: JSON.stringify({ error: message }),
    isBase64Encoded: false,
  };
}

export async function handler(event) {
  const method = event?.requestContext?.http?.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return errorResponse(405, 'Only GET is supported.');
  }

  const headers = normalizeHeaders(event?.headers);

  const validation = validateRequest(headers);
  if (!validation.ok) {
    return errorResponse(validation.status, validation.message);
  }

  const { platform, runtimeVersion } = validation;
  const prefix = `runtime/${platform}/${runtimeVersion}`;

  const expectSignature = parseSfvDictionary(headers['expo-expect-signature']);
  const clientWantsSignature = expectSignature.sig !== undefined;

  if (clientWantsSignature && !CODE_SIGNING_ENABLED) {
    // Failing loudly beats returning an unsigned manifest, which the client would
    // reject with a far less obvious error.
    return errorResponse(
      500,
      'Client requested a signed manifest but code signing is not configured on the server.'
    );
  }

  try {
    const rollback = await getJsonObject(`${prefix}/rollback.json`);

    if (rollback) {
      // Emergency lever: discard downloaded updates and run the bundle embedded in
      // the installed binary. Only expressible as a directive, so multipart only.
      const format = negotiateContentType(headers['accept'], true);
      if (!format) {
        return errorResponse(
          406,
          'A rollback directive is active but the client does not accept multipart/mixed.'
        );
      }

      const directiveBody = JSON.stringify({
        type: 'rollBackToEmbedded',
        parameters: {
          commitTime: rollback.commitTime ?? new Date().toISOString(),
        },
      });

      const boundary = `expo-${randomUUID()}`;
      return response(
        200,
        {
          ...commonHeaders(),
          'content-type': `multipart/mixed; boundary=${boundary}`,
        },
        buildMultipartBody(
          [
            {
              name: 'directive',
              contentType: 'application/json',
              body: directiveBody,
              signature: clientWantsSignature
                ? await signatureHeaderFor(directiveBody)
                : undefined,
            },
          ],
          boundary
        )
      );
    }

    const manifest = await getJsonObject(`${prefix}/latest.json`);

    if (!manifest) {
      // No update published for this runtime version. 204 with no body is the
      // spec's no-op response, and is the normal state for a freshly released
      // binary that has not been patched yet. Not an error.
      return {
        statusCode: 204,
        headers: commonHeaders(),
        body: '',
        isBase64Encoded: false,
      };
    }

    const format = negotiateContentType(headers['accept'], false);
    if (!format) {
      return errorResponse(406, 'No acceptable response format for this request.');
    }

    // Serialize exactly once. Both the signature and the transmitted body use this
    // string; regenerating either risks a byte-level mismatch.
    const manifestBody = JSON.stringify(manifest);
    const signature = clientWantsSignature ? await signatureHeaderFor(manifestBody) : undefined;

    if (format === 'multipart') {
      const boundary = `expo-${randomUUID()}`;
      return response(
        200,
        {
          ...commonHeaders(),
          'content-type': `multipart/mixed; boundary=${boundary}`,
        },
        buildMultipartBody(
          [
            {
              name: 'manifest',
              contentType: 'application/json',
              body: manifestBody,
              signature,
            },
          ],
          boundary
        )
      );
    }

    return response(
      200,
      {
        ...commonHeaders(),
        'content-type': format === 'expo-json' ? 'application/expo+json' : 'application/json',
        ...(signature ? { 'expo-signature': signature } : {}),
      },
      manifestBody
    );
  } catch (error) {
    // Log detail, return a generic message. A failed update check must never brick
    // the app: expo-updates treats it as "keep running what you have", so this
    // degrades to the previously working bundle.
    console.error('[manifest] failed to serve update', {
      platform,
      runtimeVersion,
      error: error?.message,
      stack: error?.stack,
    });
    return errorResponse(500, 'Failed to resolve update.');
  }
}
