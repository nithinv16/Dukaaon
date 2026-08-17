// Pure helpers for the Expo Updates v1 protocol.
//
// Deliberately free of any AWS import so this can be unit tested outside Lambda.
// The protocol details here (SFV parsing, content negotiation, multipart byte
// layout) are the parts most likely to be subtly wrong, and the parts where being
// wrong produces a confusing client-side failure rather than a clear server error.
//
// Spec: https://docs.expo.dev/technical-specs/expo-updates-1/

/** The only algorithm expo-updates supports for code signing. */
export const SIGNING_ALGORITHM = 'rsa-v1_5-sha256';

/**
 * Parse an Expo SFV dictionary, the format of the expo-expect-signature header.
 * Example: `sig, keyid="root", alg="rsa-v1_5-sha256"`
 *
 * A bare key with no `=` is boolean true per the SFV spec, which is why
 * `sig` alone is a valid way for a client to request a signature.
 *
 * https://docs.expo.dev/technical-specs/expo-sfv-0/
 */
export function parseSfvDictionary(value) {
  const result = {};
  if (!value) return result;

  for (const rawEntry of String(value).split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const eq = entry.indexOf('=');
    if (eq === -1) {
      result[entry] = true;
      continue;
    }

    const key = entry.slice(0, eq).trim();
    let val = entry.slice(eq + 1).trim();
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }

  return result;
}

export function serializeSfvDictionary(dict) {
  return Object.entries(dict)
    .map(([k, v]) => (v === true ? k : `${k}="${v}"`))
    .join(', ');
}

/**
 * Decide the response content type by proactive negotiation (RFC 7231 §3.4.1).
 *
 * Returns 'multipart' | 'expo-json' | 'json' | null. null maps to HTTP 406.
 *
 * `needsMultipart` is set when the response carries a directive, which the
 * single-part JSON forms cannot express at all.
 */
export function negotiateContentType(acceptHeader, needsMultipart) {
  const accept = (acceptHeader || '').toLowerCase();

  if (needsMultipart) {
    return accept.includes('multipart/mixed') ? 'multipart' : null;
  }

  // Clients are required to send accept, but treating a missing or wildcard header
  // as JSON keeps manual probing with curl usable.
  if (!accept || accept.includes('*/*')) return 'json';

  if (accept.includes('application/expo+json')) return 'expo-json';
  if (accept.includes('application/json')) return 'json';
  if (accept.includes('multipart/mixed')) return 'multipart';

  return null;
}

/**
 * Response headers required on every protocol response.
 *
 * The empty filter dictionaries are meaningful, not placeholders: the client
 * stores whatever it last received, so sending empty values explicitly clears any
 * stale filters a previous response may have set.
 */
export function commonHeaders() {
  return {
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
    'expo-manifest-filters': '',
    'expo-server-defined-headers': '',
    // Must stay short. A cached manifest means clients keep being told about an
    // update that is no longer current.
    'cache-control': 'private, max-age=0',
  };
}

/**
 * Assemble a multipart/mixed body (RFC 2046 §5.1).
 *
 * Written by hand rather than with a library because part headers are
 * protocol-specific (a content-disposition name, plus an optional per-part
 * expo-signature) and the byte layout must be exact for the client to verify a
 * signature over a part body.
 */
export function buildMultipartBody(parts, boundary) {
  const chunks = [];

  for (const part of parts) {
    chunks.push(`--${boundary}\r\n`);
    chunks.push(`content-disposition: form-data; name="${part.name}"\r\n`);
    chunks.push(`content-type: ${part.contentType}\r\n`);
    if (part.signature) {
      chunks.push(`expo-signature: ${part.signature}\r\n`);
    }
    chunks.push('\r\n');
    chunks.push(part.body);
    chunks.push('\r\n');
  }

  chunks.push(`--${boundary}--\r\n`);
  return chunks.join('');
}

/**
 * Validate the request headers that select an update.
 *
 * Returns `{ ok: true, platform, runtimeVersion }` or
 * `{ ok: false, status, message }`.
 *
 * Status codes follow the spec: 406 for a protocol version we cannot serve, 400
 * for a platform or runtime version we cannot interpret.
 */
export function validateRequest(headers) {
  const protocolVersion = headers['expo-protocol-version'];
  const platform = headers['expo-platform'];
  const runtimeVersion = headers['expo-runtime-version'];

  if (protocolVersion !== undefined && protocolVersion !== '1') {
    return {
      ok: false,
      status: 406,
      message: `Unsupported expo-protocol-version: ${protocolVersion}`,
    };
  }

  if (platform !== 'ios' && platform !== 'android') {
    return {
      ok: false,
      status: 400,
      message: 'expo-platform header must be "ios" or "android".',
    };
  }

  if (!runtimeVersion) {
    return {
      ok: false,
      status: 400,
      message: 'expo-runtime-version header is required.',
    };
  }

  // This value is interpolated into an S3 key, so anything that could escape the
  // intended prefix has to be rejected rather than sanitised.
  //
  // The character class alone is not sufficient: '.' has to be allowed for
  // version-style values like "1.0.0", which also makes ".." spell a parent
  // directory. S3 treats keys as opaque strings so it would not resolve the
  // traversal, but intermediate proxies may normalise paths, so reject it outright
  // rather than relying on that.
  if (!/^[A-Za-z0-9._-]+$/.test(runtimeVersion) || runtimeVersion.includes('..')) {
    return {
      ok: false,
      status: 400,
      message: 'expo-runtime-version contains unsupported characters.',
    };
  }

  return { ok: true, platform, runtimeVersion };
}

/** Lowercase all header names so downstream lookups are case-insensitive. */
export function normalizeHeaders(rawHeaders) {
  const headers = {};
  for (const [key, value] of Object.entries(rawHeaders ?? {})) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}
