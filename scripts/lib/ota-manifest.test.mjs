// Tests for OTA manifest construction.
//
// Run with:  node --test scripts/lib/ota-manifest.test.mjs
//
// Most assertions use a synthetic in-memory export so they run fast and need no
// build. The final test opts into the real `.ota-export-probe` directory when it is
// present, so the derivations get exercised against genuine `expo export` output
// rather than only against a fixture that could encode the same misunderstanding.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import {
  MIME_TYPES,
  base64UrlFromBase64,
  sha256HexToUuid,
  describeAsset,
  buildManifest,
  validateManifest,
} from './ota-manifest.mjs';

const BASE_URL = 'https://updates.dukaaon.in';

/** Build an in-memory export so tests do not need a real bundle. */
function fakeExport({ assets = [{ path: 'assets/a', ext: 'png', body: 'A' }], bundle = 'BUNDLE' } = {}) {
  const metadata = {
    version: 0,
    bundler: 'metro',
    fileMetadata: {
      android: {
        bundle: '_expo/static/js/android/entry-abc.hbc',
        assets: assets.map(({ path, ext }) => ({ path, ext })),
      },
    },
  };

  const files = {
    'metadata.json': Buffer.from(JSON.stringify(metadata)),
    '_expo/static/js/android/entry-abc.hbc': Buffer.from(bundle),
  };
  for (const a of assets) {
    files[a.path] = Buffer.from(a.body);
  }

  // buildManifest joins with the platform separator; normalise for lookup.
  const readFile = (p) => {
    const key = p.replace(/^.*?export\//, '').split('\\').join('/');
    const found = Object.entries(files).find(([name]) => key.endsWith(name));
    if (!found) throw new Error(`fake export has no file: ${p}`);
    return found[1];
  };

  return { readFile, metadata };
}

test('base64UrlFromBase64 removes +, / and padding', () => {
  assert.equal(base64UrlFromBase64('ab+c/d=='), 'ab-c_d');
  assert.equal(base64UrlFromBase64('plain'), 'plain');
});

test('sha256HexToUuid produces UUID shape from a hash', () => {
  const hex = createHash('sha256').update('x').digest('hex');
  const uuid = sha256HexToUuid(hex);
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('sha256HexToUuid is deterministic, which makes publishing idempotent', () => {
  const hex = createHash('sha256').update('same-content').digest('hex');
  assert.equal(sha256HexToUuid(hex), sha256HexToUuid(hex));
});

test('describeAsset derives three distinct digests of the same bytes', () => {
  const bytes = Buffer.from('hello');
  const asset = describeAsset({ bytes, ext: 'png', isLaunchAsset: false, baseUrl: BASE_URL });

  // storageKey = hex sha256, used as the S3 key
  assert.equal(asset.storageKey, createHash('sha256').update(bytes).digest('hex'));
  // hash = base64url sha256, verified by the client
  assert.equal(
    asset.manifestEntry.hash,
    base64UrlFromBase64(createHash('sha256').update(bytes).digest('base64'))
  );
  // key = hex md5, how the bundle references the asset
  assert.equal(asset.manifestEntry.key, createHash('md5').update(bytes).digest('hex'));

  // All three must actually differ, or one of them is wrong.
  assert.notEqual(asset.storageKey, asset.manifestEntry.hash);
  assert.notEqual(asset.storageKey, asset.manifestEntry.key);
});

test('describeAsset marks the launch asset as javascript with a .bundle extension', () => {
  const launch = describeAsset({
    bytes: Buffer.from('code'),
    ext: null,
    isLaunchAsset: true,
    baseUrl: BASE_URL,
  });
  assert.equal(launch.manifestEntry.contentType, 'application/javascript');
  assert.equal(launch.manifestEntry.fileExtension, '.bundle');
});

test('describeAsset maps known extensions and falls back safely', () => {
  const png = describeAsset({ bytes: Buffer.from('x'), ext: 'png', isLaunchAsset: false, baseUrl: BASE_URL });
  assert.equal(png.manifestEntry.contentType, MIME_TYPES.png);

  const weird = describeAsset({ bytes: Buffer.from('x'), ext: 'xyz', isLaunchAsset: false, baseUrl: BASE_URL });
  assert.equal(weird.manifestEntry.contentType, 'application/octet-stream');
});

test('describeAsset builds a content-addressed url', () => {
  const asset = describeAsset({ bytes: Buffer.from('x'), ext: 'png', isLaunchAsset: false, baseUrl: BASE_URL });
  assert.equal(asset.manifestEntry.url, `${BASE_URL}/assets/${asset.storageKey}`);
});

test('identical bytes produce an identical url, so republishing reuses the object', () => {
  const a = describeAsset({ bytes: Buffer.from('same'), ext: 'png', isLaunchAsset: false, baseUrl: BASE_URL });
  const b = describeAsset({ bytes: Buffer.from('same'), ext: 'png', isLaunchAsset: false, baseUrl: BASE_URL });
  assert.equal(a.manifestEntry.url, b.manifestEntry.url);
});

test('buildManifest dedupes repeated asset paths', () => {
  // Real exports do this: 60 entries for 57 files on this project.
  const { readFile } = fakeExport({
    assets: [
      { path: 'assets/a', ext: 'png', body: 'A' },
      { path: 'assets/a', ext: 'png', body: 'A' },
      { path: 'assets/b', ext: 'jpg', body: 'B' },
    ],
  });

  const { manifest } = buildManifest({
    exportRoot: 'export/',
    platform: 'android',
    runtimeVersion: 'rv1',
    baseUrl: BASE_URL,
    publicConfig: { extra: {} },
    readFile,
  });

  assert.equal(manifest.assets.length, 2);
  assert.deepEqual(validateManifest(manifest), []);
});

test('buildManifest throws a clear error for an absent platform', () => {
  const { readFile } = fakeExport();
  assert.throws(
    () =>
      buildManifest({
        exportRoot: 'export/',
        platform: 'ios',
        runtimeVersion: 'rv1',
        baseUrl: BASE_URL,
        publicConfig: {},
        readFile,
      }),
    /no fileMetadata for platform "ios"/
  );
});

test('buildManifest carries extra.expoConfig through', () => {
  // config/secrets.ts reads Constants.expoConfig?.extra at runtime, so losing this
  // would change app configuration after an OTA update.
  const { readFile } = fakeExport();
  const publicConfig = { extra: { supabaseUrl: 'https://x.supabase.co' } };

  const { manifest } = buildManifest({
    exportRoot: 'export/',
    platform: 'android',
    runtimeVersion: 'rv1',
    baseUrl: BASE_URL,
    publicConfig,
    readFile,
  });

  assert.equal(manifest.extra.expoConfig.extra.supabaseUrl, 'https://x.supabase.co');
});

test('buildManifest includes a publish message only when provided', () => {
  const { readFile } = fakeExport();
  const args = {
    exportRoot: 'export/',
    platform: 'android',
    runtimeVersion: 'rv1',
    baseUrl: BASE_URL,
    publicConfig: {},
    readFile,
  };

  assert.equal('publishMessage' in buildManifest(args).manifest.extra, false);
  assert.equal(buildManifest({ ...args, message: 'fix' }).manifest.extra.publishMessage, 'fix');
});

test('the same export yields the same update id', () => {
  const a = fakeExport();
  const b = fakeExport();

  const one = buildManifest({
    exportRoot: 'export/', platform: 'android', runtimeVersion: 'rv1',
    baseUrl: BASE_URL, publicConfig: {}, readFile: a.readFile,
  });
  const two = buildManifest({
    exportRoot: 'export/', platform: 'android', runtimeVersion: 'rv1',
    baseUrl: BASE_URL, publicConfig: {}, readFile: b.readFile,
  });

  assert.equal(one.updateId, two.updateId);
});

test('validateManifest rejects malformed manifests', () => {
  assert.ok(validateManifest({}).length > 0);

  // Non-base64url hash is the mistake to guard against: plain base64 contains
  // + / and = which the client will not accept.
  const withBadHash = {
    id: '00000000-0000-4000-8000-000000000000',
    createdAt: new Date().toISOString(),
    runtimeVersion: 'rv',
    launchAsset: { hash: 'ab+c/d==', key: 'k', contentType: 'application/javascript', url: 'u' },
    assets: [],
    metadata: {},
    extra: {},
  };
  assert.ok(validateManifest(withBadHash).some((p) => /base64url/.test(p)));

  // Missing dot prefix on fileExtension.
  const withBadExt = {
    ...withBadHash,
    launchAsset: { hash: 'abc', key: 'k', contentType: 'x', url: 'u', fileExtension: 'png' },
  };
  assert.ok(validateManifest(withBadExt).some((p) => /must start with a dot/.test(p)));
});

// Opt-in: only runs when a real export is present on disk.
test('real expo export produces a spec-valid manifest', (t) => {
  const exportRoot = '.ota-export-probe';
  if (!existsSync(`${exportRoot}/metadata.json`)) {
    t.skip('no .ota-export-probe present; run `npx expo export --output-dir .ota-export-probe`');
    return;
  }

  const { manifest, updateId, launch, assets } = buildManifest({
    exportRoot,
    platform: 'android',
    runtimeVersion: '9a434a659a14133c204ecdd9cf8a67d263a3520c',
    baseUrl: BASE_URL,
    publicConfig: { extra: { supabaseUrl: 'https://example.supabase.co' } },
    readFile: readFileSync,
  });

  assert.deepEqual(validateManifest(manifest), [], 'real manifest must be spec-valid');

  // The export listed 60 asset entries over 57 unique files.
  assert.equal(assets.length, 57, 'expected 57 unique assets after dedupe');
  assert.match(updateId, /^[0-9a-f]{8}-/);

  // Launch asset is the Hermes bytecode bundle and must still be declared as JS.
  assert.equal(manifest.launchAsset.contentType, 'application/javascript');
  assert.ok(launch.byteLength > 1_000_000, 'bundle should be substantial');

  // Every asset url must be unique and content-addressed.
  const urls = manifest.assets.map((a) => a.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const asset of manifest.assets) {
    assert.match(asset.url, /\/assets\/[0-9a-f]{64}$/);
  }
});
