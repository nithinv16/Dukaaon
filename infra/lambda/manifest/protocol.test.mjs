// Tests for the Expo Updates v1 protocol helpers.
//
// Run with:  node --test infra/lambda/manifest/
//
// Uses node:test so this needs no dependencies and can run in CodeBuild before
// deploying the Lambda. These assertions encode the parts of the spec that are
// easy to get subtly wrong and that fail confusingly on the client when wrong.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';

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

test('parseSfvDictionary treats a bare key as boolean true', () => {
  // This is how a client asks for a signature: `sig` with no value.
  const parsed = parseSfvDictionary('sig, keyid="root", alg="rsa-v1_5-sha256"');
  assert.equal(parsed.sig, true);
  assert.equal(parsed.keyid, 'root');
  assert.equal(parsed.alg, 'rsa-v1_5-sha256');
});

test('parseSfvDictionary strips surrounding quotes but not inner ones', () => {
  assert.equal(parseSfvDictionary('k="a"').k, 'a');
  assert.equal(parseSfvDictionary('k="a\\"b"').k, 'a\\"b');
});

test('parseSfvDictionary handles empty and absent input', () => {
  assert.deepEqual(parseSfvDictionary(''), {});
  assert.deepEqual(parseSfvDictionary(undefined), {});
  assert.deepEqual(parseSfvDictionary(null), {});
});

test('parseSfvDictionary tolerates a base64 signature containing "="', () => {
  // Base64 padding contains '=', which must not be mistaken for a separator.
  const sig = 'YWJjZGVm==';
  const parsed = parseSfvDictionary(`sig="${sig}", keyid="main"`);
  assert.equal(parsed.sig, sig);
  assert.equal(parsed.keyid, 'main');
});

test('serializeSfvDictionary round-trips through parseSfvDictionary', () => {
  const original = { sig: 'abc+/=', keyid: 'main', alg: SIGNING_ALGORITHM };
  assert.deepEqual(parseSfvDictionary(serializeSfvDictionary(original)), original);
});

test('negotiateContentType prefers expo+json over json', () => {
  const accept = 'application/expo+json;q=0.9, application/json;q=0.8, multipart/mixed';
  assert.equal(negotiateContentType(accept, false), 'expo-json');
});

test('negotiateContentType falls back to json for wildcard or missing accept', () => {
  assert.equal(negotiateContentType('*/*', false), 'json');
  assert.equal(negotiateContentType('', false), 'json');
  assert.equal(negotiateContentType(undefined, false), 'json');
});

test('negotiateContentType returns null when nothing is acceptable', () => {
  // Maps to HTTP 406 per the spec.
  assert.equal(negotiateContentType('text/html', false), null);
});

test('negotiateContentType requires multipart when a directive must be sent', () => {
  // A directive cannot be expressed in a single-part JSON response.
  assert.equal(negotiateContentType('application/json', true), null);
  assert.equal(negotiateContentType('multipart/mixed', true), 'multipart');
});

test('commonHeaders declares protocol 1, sfv 0 and a non-caching policy', () => {
  const headers = commonHeaders();
  assert.equal(headers['expo-protocol-version'], '1');
  assert.equal(headers['expo-sfv-version'], '0');
  // A cached manifest would keep clients pinned to a stale update.
  assert.match(headers['cache-control'], /max-age=0/);
  // Present-but-empty matters: it clears filters set by an earlier response.
  assert.equal(headers['expo-manifest-filters'], '');
  assert.equal(headers['expo-server-defined-headers'], '');
});

test('validateRequest rejects an unknown protocol version with 406', () => {
  const result = validateRequest({
    'expo-protocol-version': '2',
    'expo-platform': 'android',
    'expo-runtime-version': 'abc',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 406);
});

test('validateRequest accepts a missing protocol version', () => {
  // The header is required of clients, but absence is not a version conflict.
  const result = validateRequest({
    'expo-platform': 'android',
    'expo-runtime-version': 'abc123',
  });
  assert.equal(result.ok, true);
});

test('validateRequest rejects an unsupported platform with 400', () => {
  for (const platform of ['web', '', undefined, 'ANDROID']) {
    const result = validateRequest({
      'expo-platform': platform,
      'expo-runtime-version': 'abc',
    });
    assert.equal(result.ok, false, `expected rejection for platform=${platform}`);
    assert.equal(result.status, 400);
  }
});

test('validateRequest rejects path traversal in the runtime version', () => {
  // runtimeVersion is interpolated into an S3 key, so this is a real escape risk.
  for (const runtimeVersion of ['../../secrets', 'a/b', 'a b', 'a$b', '..']) {
    const result = validateRequest({
      'expo-platform': 'android',
      'expo-runtime-version': runtimeVersion,
    });
    assert.equal(result.ok, false, `expected rejection for ${runtimeVersion}`);
    assert.equal(result.status, 400);
  }
});

test('validateRequest accepts a fingerprint-style runtime version', () => {
  const result = validateRequest({
    'expo-protocol-version': '1',
    'expo-platform': 'android',
    'expo-runtime-version': 'ce4bb586e421844a2f4e48b5536fff5cd66a6c7e',
  });
  assert.equal(result.ok, true);
  assert.equal(result.platform, 'android');
  assert.equal(result.runtimeVersion, 'ce4bb586e421844a2f4e48b5536fff5cd66a6c7e');
});

test('normalizeHeaders lowercases header names', () => {
  const headers = normalizeHeaders({ 'Expo-Platform': 'android', ACCEPT: 'application/json' });
  assert.equal(headers['expo-platform'], 'android');
  assert.equal(headers['accept'], 'application/json');
});

test('buildMultipartBody uses CRLF and closes the boundary', () => {
  const body = buildMultipartBody(
    [{ name: 'manifest', contentType: 'application/json', body: '{"id":"x"}' }],
    'bnd'
  );

  assert.ok(body.startsWith('--bnd\r\n'), 'must open with the boundary');
  assert.ok(body.endsWith('--bnd--\r\n'), 'must close with the terminating boundary');
  assert.ok(body.includes('content-disposition: form-data; name="manifest"\r\n'));
  assert.ok(body.includes('content-type: application/json\r\n'));
  // Blank line separating part headers from the part body.
  assert.ok(body.includes('\r\n\r\n{"id":"x"}\r\n'));
});

test('buildMultipartBody omits expo-signature when unsigned', () => {
  const body = buildMultipartBody(
    [{ name: 'manifest', contentType: 'application/json', body: '{}' }],
    'bnd'
  );
  assert.ok(!body.includes('expo-signature'));
});

test('buildMultipartBody includes expo-signature when signed', () => {
  const body = buildMultipartBody(
    [
      {
        name: 'manifest',
        contentType: 'application/json',
        body: '{}',
        signature: 'sig="abc", keyid="main"',
      },
    ],
    'bnd'
  );
  assert.ok(body.includes('expo-signature: sig="abc", keyid="main"\r\n'));
});

test('a signature over the serialized manifest verifies with the public key', () => {
  // Guards the property that actually matters for code signing: the bytes signed
  // are the bytes sent. Mirrors what the Lambda does and what the client checks.
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  const manifest = {
    id: '0000018f-0000-4000-8000-000000000000',
    createdAt: '2026-08-15T00:00:00.000Z',
    runtimeVersion: 'ce4bb586e421844a2f4e48b5536fff5cd66a6c7e',
    launchAsset: { key: 'bundle', contentType: 'application/javascript', url: 'https://x/y' },
    assets: [],
    metadata: {},
    extra: {},
  };

  const manifestBody = JSON.stringify(manifest);

  const signer = createSign('RSA-SHA256');
  signer.update(manifestBody, 'utf8');
  signer.end();
  const signature = signer.sign(privateKey, 'base64');

  const header = serializeSfvDictionary({
    sig: signature,
    keyid: 'main',
    alg: SIGNING_ALGORITHM,
  });

  // Round-trip through the header format, as a client would.
  const parsed = parseSfvDictionary(header);
  assert.equal(parsed.alg, SIGNING_ALGORITHM);

  const verifier = createVerify('RSA-SHA256');
  verifier.update(manifestBody, 'utf8');
  verifier.end();
  assert.equal(verifier.verify(publicKey, parsed.sig, 'base64'), true);

  // And a tampered body must fail, which is the whole point.
  const tampered = createVerify('RSA-SHA256');
  tampered.update(manifestBody.replace('"assets":[]', '"assets":[1]'), 'utf8');
  tampered.end();
  assert.equal(tampered.verify(publicKey, parsed.sig, 'base64'), false);
});
