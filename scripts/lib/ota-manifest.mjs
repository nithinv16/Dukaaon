// Pure manifest construction for the Expo Updates v1 protocol.
//
// Separated from scripts/publish-update.mjs so it can be tested against a real
// `expo export` output without uploading anything. The hash derivations here are
// the easiest part of the whole system to get quietly wrong: a bad `hash` makes
// clients reject the download, and a bad `key` makes the bundle fail to resolve
// assets at runtime — both only visible after publishing.
//
// Derivations follow Expo's reference server (expo/custom-expo-updates-server,
// common/helpers.ts getAssetMetadataAsync).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Only the types this project ships. Unknown extensions fall back to
// application/octet-stream rather than guessing, since a wrong content-type can
// make a client reject an asset.
export const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/** base64 -> base64url, per RFC 4648 §5, which is what the spec requires for `hash`. */
export function base64UrlFromBase64(value) {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Format a hex SHA-256 as a UUID.
 *
 * The spec requires the manifest `id` to be a UUID. This slices the content hash
 * rather than generating a random v4, mirroring `convertSHA256HashToUUID` in
 * Expo's reference server. The consequence is deliberate: the update id becomes a
 * pure function of the bundle, so republishing identical output is idempotent
 * instead of creating a new update every run.
 */
export function sha256HexToUuid(hex) {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Describe one asset for the manifest.
 *
 * Three different digests of the same bytes, all required, none interchangeable:
 *   storageKey  hex sha256  our S3 object key. Content-addressed, which is what
 *                           makes the protocol's "an asset URL must never change
 *                           contents" requirement structurally true.
 *   hash        base64url   what the client verifies the downloaded bytes against.
 *   key         hex md5     how the JS bundle refers to the asset at runtime.
 */
export function describeAsset({ bytes, ext, isLaunchAsset, baseUrl, sourcePath = null }) {
  const sha256Base64 = createHash('sha256').update(bytes).digest('base64');
  const storageKey = createHash('sha256').update(bytes).digest('hex');
  const md5Key = createHash('md5').update(bytes).digest('hex');

  return {
    byteLength: bytes.length,
    // Kept so the uploader can stream the file straight from the export directory
    // rather than holding every asset (including a ~9 MB bundle) in memory.
    sourcePath,
    storageKey,
    manifestEntry: {
      hash: base64UrlFromBase64(sha256Base64),
      key: md5Key,
      // The launch asset is always JavaScript, and the client ignores its
      // fileExtension in favour of a platform-determined one.
      contentType: isLaunchAsset
        ? 'application/javascript'
        : (MIME_TYPES[ext] ?? 'application/octet-stream'),
      fileExtension: isLaunchAsset ? '.bundle' : `.${ext}`,
      url: `${baseUrl}/assets/${storageKey}`,
    },
  };
}

/**
 * Build the manifest from an `expo export` output directory.
 *
 * @param exportRoot   directory produced by `expo export --output-dir`
 * @param platform     'android' | 'ios'
 * @param runtimeVersion  resolved runtime version (decides which binaries get this)
 * @param baseUrl      e.g. https://updates.dukaaon.in
 * @param publicConfig result of `expo config --json --type public`
 * @param message      optional human-readable note
 * @param readFile     injectable reader, for tests
 * @param now          injectable clock, for tests
 */
export function buildManifest({
  exportRoot,
  platform,
  runtimeVersion,
  baseUrl,
  publicConfig,
  message = '',
  readFile = readFileSync,
  now = () => new Date(),
}) {
  const metadataBuffer = readFile(join(exportRoot, 'metadata.json'));
  const metadata = JSON.parse(metadataBuffer.toString('utf8'));

  const platformMetadata = metadata.fileMetadata?.[platform];
  if (!platformMetadata) {
    throw new Error(
      `metadata.json has no fileMetadata for platform "${platform}". ` +
        `Available: ${Object.keys(metadata.fileMetadata ?? {}).join(', ') || 'none'}`
    );
  }

  const updateId = sha256HexToUuid(createHash('sha256').update(metadataBuffer).digest('hex'));

  const bundlePath = join(exportRoot, platformMetadata.bundle);
  const launch = describeAsset({
    bytes: readFile(bundlePath),
    ext: null,
    isLaunchAsset: true,
    baseUrl,
    sourcePath: bundlePath,
  });

  // `expo export` can list the same asset path more than once. Observed on this
  // project: 60 entries for 57 unique files. Duplicates would produce duplicate
  // manifest entries and redundant uploads.
  const seen = new Set();
  const assets = [];

  for (const asset of platformMetadata.assets ?? []) {
    if (seen.has(asset.path)) continue;
    seen.add(asset.path);

    const assetPath = join(exportRoot, asset.path);
    assets.push(
      describeAsset({
        bytes: readFile(assetPath),
        ext: asset.ext,
        isLaunchAsset: false,
        baseUrl,
        sourcePath: assetPath,
      })
    );
  }

  const manifest = {
    id: updateId,
    createdAt: now().toISOString(),
    runtimeVersion,
    launchAsset: launch.manifestEntry,
    assets: assets.map((a) => a.manifestEntry),
    metadata: {},
    extra: {
      // Must be present. config/secrets.ts reads Constants.expoConfig?.extra, so
      // omitting this would give an OTA-launched bundle a different view of
      // configuration than an embedded launch — a difference that would only show
      // up in production, after an update had already gone out.
      expoConfig: publicConfig,
      ...(message ? { publishMessage: message } : {}),
    },
  };

  return { manifest, updateId, launch, assets };
}

/**
 * Assert a manifest satisfies the structural requirements of the spec.
 *
 * Cheap to run and worth running before publishing: a malformed manifest fails on
 * the device, where the error is far more expensive to diagnose.
 */
export function validateManifest(manifest) {
  const problems = [];

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(manifest.id ?? '')) {
    problems.push(`id must be UUID-shaped, got: ${manifest.id}`);
  }

  if (Number.isNaN(Date.parse(manifest.createdAt ?? ''))) {
    problems.push(`createdAt must be an ISO 8601 datetime, got: ${manifest.createdAt}`);
  }

  if (!manifest.runtimeVersion || typeof manifest.runtimeVersion !== 'string') {
    problems.push('runtimeVersion must be a non-empty string');
  }

  const checkAsset = (asset, label) => {
    if (!asset) {
      problems.push(`${label} is missing`);
      return;
    }
    for (const field of ['key', 'contentType', 'url']) {
      if (!asset[field]) problems.push(`${label}.${field} is required`);
    }
    // base64url: no +, no /, no = padding.
    if (asset.hash && /[+/=]/.test(asset.hash)) {
      problems.push(`${label}.hash must be base64url encoded, got: ${asset.hash}`);
    }
    if (asset.fileExtension && !asset.fileExtension.startsWith('.')) {
      problems.push(`${label}.fileExtension must start with a dot, got: ${asset.fileExtension}`);
    }
  };

  checkAsset(manifest.launchAsset, 'launchAsset');

  if (!Array.isArray(manifest.assets)) {
    problems.push('assets must be an array');
  } else {
    manifest.assets.forEach((asset, i) => checkAsset(asset, `assets[${i}]`));

    const urls = manifest.assets.map((a) => a.url);
    if (new Set(urls).size !== urls.length) {
      problems.push('assets contains duplicate urls');
    }
  }

  if (typeof manifest.metadata !== 'object' || manifest.metadata === null) {
    problems.push('metadata must be an object');
  }

  if (typeof manifest.extra !== 'object' || manifest.extra === null) {
    problems.push('extra must be an object');
  }

  return problems;
}
