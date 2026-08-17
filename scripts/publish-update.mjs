#!/usr/bin/env node
/**
 * Publish an over-the-air update to the self-hosted update server.
 *
 * Usage:
 *   node scripts/publish-update.mjs --platform android --message "fix cart rounding"
 *   node scripts/publish-update.mjs --dry-run
 *   node scripts/publish-update.mjs --rollback        # roll clients back to embedded
 *   node scripts/publish-update.mjs --clear-rollback
 *
 * Required environment:
 *   EXPO_UPDATE_URL        must match the URL compiled into the installed binaries
 *   OTA_BUCKET             S3 bucket (terraform output updates_bucket)
 *   OTA_BASE_URL           https://updates.dukaaon.in (terraform output updates_hostname)
 *   OTA_DISTRIBUTION_ID    CloudFront id (terraform output cloudfront_distribution_id)
 *
 * Why the AWS CLI rather than the AWS SDK: adding @aws-sdk/* to this project's
 * devDependencies would alter package metadata that @expo/fingerprint hashes, and
 * the fingerprint IS the runtime version. Publishing tooling must never be able to
 * change which binaries an update is compatible with. The CLI is also preinstalled
 * in CodeBuild images.
 *
 * What this script deliberately does NOT do: sign anything. Signing happens in the
 * manifest Lambda at request time, so the private key never leaves Secrets Manager
 * and never touches a developer machine or CI worker.
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Manifest construction lives in a separate module so it can be tested against a
// real export without uploading anything. See scripts/lib/ota-manifest.test.mjs.
import {
  buildManifest as buildManifestObject,
  validateManifest,
} from './lib/ota-manifest.mjs';

const PROJECT_ROOT = process.cwd();
const EXPORT_DIR = '.ota-export';

function parseArgs(argv) {
  const args = {
    platform: 'android',
    message: '',
    dryRun: false,
    allowDirty: false,
    rollback: false,
    clearRollback: false,
    skipInvalidation: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--platform') args.platform = argv[++i];
    else if (arg === '--message' || arg === '-m') args.message = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--allow-dirty') args.allowDirty = true;
    else if (arg === '--rollback') args.rollback = true;
    else if (arg === '--clear-rollback') args.clearRollback = true;
    else if (arg === '--skip-invalidation') args.skipInvalidation = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (!['android', 'ios'].includes(args.platform)) {
    fail(`--platform must be android or ios, got: ${args.platform}`);
  }

  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(
      `${name} is not set.\n\n  Get these from Terraform:\n` +
        '    cd infra/terraform && terraform output\n\n' +
        '  Then export:\n' +
        '    export OTA_BUCKET=$(terraform output -raw updates_bucket)\n' +
        '    export OTA_BASE_URL="https://$(terraform output -raw updates_hostname)"\n' +
        '    export OTA_DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)\n' +
        '    export EXPO_UPDATE_URL=$(terraform output -raw expo_update_url)'
    );
  }
  return value;
}

function aws(args, { dryRun = false, capture = true } = {}) {
  if (dryRun) {
    console.log(`   [dry-run] aws ${args.join(' ')}`);
    return '';
  }
  return execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function preflight(args) {
  step('Preflight');

  // The AWS CLI must exist before anything else, otherwise we do an expensive
  // export and then fail at the upload.
  try {
    execFileSync('aws', ['--version'], { stdio: 'ignore' });
  } catch {
    fail(
      'The AWS CLI is not installed or not on PATH.\n' +
        '  macOS: brew install awscli   (or see https://docs.aws.amazon.com/cli/)'
    );
  }

  // A dirty tree means the published bundle does not correspond to any commit, so
  // there is no way to work out later what is actually running on user devices.
  if (!args.allowDirty) {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status) {
      const count = status.split('\n').length;
      fail(
        `Working tree has ${count} uncommitted change(s).\n\n` +
          '  An OTA update ships whatever is on disk. Publishing from a dirty tree\n' +
          '  means you cannot later determine what code your users are running.\n\n' +
          '  Commit first, or pass --allow-dirty if you accept that.'
      );
    }
  }

  // Exporting without EXPO_UPDATE_URL produces a bundle built from a config where
  // updates are disabled, and it must match what shipped binaries were built with.
  const updateUrl = requireEnv('EXPO_UPDATE_URL');

  // Signing is not optional. See resolveCodeSigning in app.config.js.
  if (!existsSync(join(PROJECT_ROOT, 'certs/code-signing/certificate.pem'))) {
    fail(
      'Code signing certificate not found at certs/code-signing/certificate.pem.\n' +
        '  Updates must be signed. See infra/README.md.'
    );
  }

  console.log(`   aws cli          ok`);
  console.log(`   git tree         ${args.allowDirty ? 'dirty (allowed)' : 'clean'}`);
  console.log(`   EXPO_UPDATE_URL  ${updateUrl}`);

  return { updateUrl };
}

/**
 * Resolve the runtime version using expo-updates itself, rather than
 * reimplementing the fingerprint policy.
 *
 * This value decides which installed binaries the update is offered to. Computing
 * it any other way risks publishing to a runtime version that no binary reports,
 * producing an update that silently reaches nobody.
 */
function resolveRuntimeVersion(platform) {
  step('Resolving runtime version');

  const output = execFileSync(
    process.execPath,
    ['node_modules/expo-updates/bin/cli.js', 'runtimeversion:resolve', '--platform', platform, '--workflow', 'generic'],
    { encoding: 'utf8', cwd: PROJECT_ROOT, maxBuffer: 32 * 1024 * 1024 }
  );

  // The CLI prints JSON. Take the last JSON object on stdout so any preamble
  // (dotenv banners, warnings) is ignored.
  const match = output.trim().match(/\{[\s\S]*\}$/);
  if (!match) {
    fail(`Could not parse runtime version from expo-updates output:\n${output}`);
  }

  const parsed = JSON.parse(match[0]);
  const runtimeVersion = parsed.runtimeVersion ?? parsed.fingerprintHash ?? parsed.hash;

  if (!runtimeVersion) {
    fail(`No runtimeVersion in expo-updates output: ${match[0]}`);
  }

  console.log(`   runtimeVersion   ${runtimeVersion}`);
  return runtimeVersion;
}

function runExport(platform) {
  step(`Exporting bundle (platform: ${platform})`);

  rmSync(join(PROJECT_ROOT, EXPORT_DIR), { recursive: true, force: true });

  execFileSync(
    'npx',
    ['expo', 'export', '--platform', platform, '--output-dir', EXPORT_DIR],
    { stdio: 'inherit', cwd: PROJECT_ROOT }
  );

  const metadataPath = join(PROJECT_ROOT, EXPORT_DIR, 'metadata.json');
  if (!existsSync(metadataPath)) {
    fail(`Export did not produce ${metadataPath}`);
  }

  return metadataPath;
}

function buildManifest({ platform, runtimeVersion, message }) {
  step('Building manifest');

  // `extra.expoConfig` must be present. config/secrets.ts reads
  // Constants.expoConfig?.extra, so omitting it would give an OTA-launched bundle a
  // different view of configuration than an embedded launch — the kind of
  // difference that only shows up in production, after an update has gone out.
  const publicConfig = JSON.parse(
    execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
      encoding: 'utf8',
      cwd: PROJECT_ROOT,
      maxBuffer: 32 * 1024 * 1024,
    })
  );

  const result = buildManifestObject({
    exportRoot: join(PROJECT_ROOT, EXPORT_DIR),
    platform,
    runtimeVersion,
    baseUrl: process.env.OTA_BASE_URL,
    publicConfig,
    message,
  });

  // Structural check before anything is uploaded. A malformed manifest fails on the
  // device, where diagnosing it is far more expensive than failing here.
  const problems = validateManifest(result.manifest);
  if (problems.length > 0) {
    fail(
      'Generated manifest does not satisfy the Expo Updates v1 spec:\n' +
        problems.map((p) => `  - ${p}`).join('\n')
    );
  }

  console.log(`   updateId         ${result.updateId}`);
  console.log(
    `   launch asset     ${result.launch.storageKey.slice(0, 12)}… (${result.launch.byteLength} bytes)`
  );
  console.log(`   assets           ${result.assets.length} unique`);
  console.log(`   manifest         spec-valid`);

  return result;
}

function uploadAssets({ launch, assets, bucket, dryRun }) {
  step('Uploading assets');

  const all = [launch, ...assets];
  let uploaded = 0;
  let skipped = 0;

  for (const asset of all) {
    const key = `assets/${asset.storageKey}`;

    // Content-addressed, so an object that already exists is byte-identical by
    // construction. Skipping is safe and makes republishing cheap — only genuinely
    // changed assets are re-uploaded.
    let exists = false;
    if (!dryRun) {
      try {
        aws(['s3api', 'head-object', '--bucket', bucket, '--key', key]);
        exists = true;
      } catch {
        exists = false;
      }
    }

    if (exists) {
      skipped++;
      continue;
    }

    aws(
      [
        's3api',
        'put-object',
        '--bucket',
        bucket,
        '--key',
        key,
        // Streamed straight from the export directory. No temp copy, which matters
        // for the ~9 MB Hermes bundle.
        '--body',
        asset.sourcePath,
        '--content-type',
        asset.manifestEntry.contentType,
        // Immutable: the protocol requires that an asset URL never change contents,
        // and content addressing guarantees that, so cache as hard as possible.
        '--cache-control',
        'public, max-age=31536000, immutable',
      ],
      { dryRun }
    );

    uploaded++;
  }

  console.log(`   uploaded         ${uploaded}`);
  console.log(`   already present  ${skipped}`);
}

function uploadManifest({ manifest, updateId, platform, runtimeVersion, bucket, dryRun }) {
  step('Publishing manifest');

  const prefix = `runtime/${platform}/${runtimeVersion}`;
  const body = JSON.stringify(manifest);

  const tmp = mkdtempSync(join(tmpdir(), 'ota-manifest-'));

  try {
    const localPath = join(tmp, 'manifest.json');
    writeFileSync(localPath, body);

    // Archive copy first, so a rollback target exists before latest.json moves.
    for (const key of [`${prefix}/${updateId}/manifest.json`, `${prefix}/latest.json`]) {
      aws(
        [
          's3api',
          'put-object',
          '--bucket',
          bucket,
          '--key',
          key,
          '--body',
          localPath,
          '--content-type',
          'application/json',
          '--cache-control',
          'no-cache',
        ],
        { dryRun }
      );
      console.log(`   wrote            s3://${bucket}/${key}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return prefix;
}

function setRollback({ platform, runtimeVersion, bucket, dryRun, clear }) {
  const prefix = `runtime/${platform}/${runtimeVersion}`;
  const key = `${prefix}/rollback.json`;

  if (clear) {
    step('Clearing rollback');
    aws(['s3api', 'delete-object', '--bucket', bucket, '--key', key], { dryRun });
    console.log(`   deleted          s3://${bucket}/${key}`);
    return;
  }

  step('Setting rollback to embedded');
  const tmp = mkdtempSync(join(tmpdir(), 'ota-rollback-'));
  try {
    const localPath = join(tmp, 'rollback.json');
    writeFileSync(localPath, JSON.stringify({ commitTime: new Date().toISOString() }));
    aws(
      [
        's3api',
        'put-object',
        '--bucket',
        bucket,
        '--key',
        key,
        '--body',
        localPath,
        '--content-type',
        'application/json',
        '--cache-control',
        'no-cache',
      ],
      { dryRun }
    );
    console.log(`   wrote            s3://${bucket}/${key}`);
    console.log('   Clients will discard downloaded updates and run the embedded bundle.');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Announce the update on a Supabase Realtime channel.
 *
 * This is what makes a publish feel live rather than eventual. Foreground clients
 * already hold an open websocket, so they begin downloading within about a second
 * instead of waiting for their next foreground poll.
 *
 * Uses the anon key over the public REST broadcast endpoint — the same credential
 * the app ships with, so nothing new is exposed. The message carries no instruction,
 * only a nudge to go and check: a client that trusts a broadcast to tell it *what*
 * to run would be trusting an unsigned channel, whereas checking means it still goes
 * through the signed manifest path.
 *
 * Failure here is deliberately non-fatal. The update is already published and
 * correct; losing the announcement only means clients discover it on their next
 * check rather than immediately.
 */
async function announce({ runtimeVersion, updateId, dryRun }) {
  step('Announcing over Supabase Realtime');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.log('   skipped (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY not set)');
    return;
  }

  if (dryRun) {
    console.log('   [dry-run] would broadcast "published" on channel ota-updates');
    return;
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/realtime/v1/api/broadcast`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: 'ota-updates',
            event: 'published',
            payload: { runtimeVersion, updateId, at: new Date().toISOString() },
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      console.log(`   announcement failed (${response.status}): ${detail}`);
      console.log('   Not fatal — clients will pick this up on their next check.');
      return;
    }

    console.log('   broadcast sent on channel ota-updates');
  } catch (error) {
    console.log(`   announcement failed: ${error?.message}`);
    console.log('   Not fatal — clients will pick this up on their next check.');
  }
}

function invalidate({ distributionId, dryRun }) {
  step('Invalidating CloudFront');

  // Only the manifest path. Assets are content-addressed and cached immutably, so
  // invalidating them would be pointless and would burn free invalidation quota.
  aws(
    [
      'cloudfront',
      'create-invalidation',
      '--distribution-id',
      distributionId,
      '--paths',
      '/api/manifest*',
    ],
    { dryRun }
  );

  console.log('   invalidated      /api/manifest*');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  preflight(args);

  const bucket = requireEnv('OTA_BUCKET');
  requireEnv('OTA_BASE_URL');
  const distributionId = args.skipInvalidation ? null : requireEnv('OTA_DISTRIBUTION_ID');

  const runtimeVersion = resolveRuntimeVersion(args.platform);

  if (args.rollback || args.clearRollback) {
    setRollback({
      platform: args.platform,
      runtimeVersion,
      bucket,
      dryRun: args.dryRun,
      clear: args.clearRollback,
    });
    if (distributionId) invalidate({ distributionId, dryRun: args.dryRun });
    console.log('\n✔ Done\n');
    return;
  }

  runExport(args.platform);

  const { manifest, launch, assets, updateId } = buildManifest({
    platform: args.platform,
    runtimeVersion,
    message: args.message,
  });

  uploadAssets({ launch, assets, bucket, dryRun: args.dryRun });
  uploadManifest({
    manifest,
    updateId,
    platform: args.platform,
    runtimeVersion,
    bucket,
    dryRun: args.dryRun,
  });

  // Invalidate before announcing. Announcing first would tell clients to check a
  // manifest that CloudFront might still be serving from cache, so the first wave of
  // checks would see the previous update and then wait for their next poll.
  if (distributionId) invalidate({ distributionId, dryRun: args.dryRun });

  await announce({ runtimeVersion, updateId, dryRun: args.dryRun });

  console.log(
    `\n✔ Published ${updateId}\n` +
      `  platform        ${args.platform}\n` +
      `  runtimeVersion  ${runtimeVersion}\n` +
      (args.message ? `  message         ${args.message}\n` : '') +
      (args.dryRun ? '\n  (dry run — nothing was actually uploaded)\n' : '') +
      '\n  Only binaries reporting this runtime version will receive it. If that is\n' +
      '  not what you expected, the native layer changed and a store release is\n' +
      '  required instead.\n'
  );
}

// Surface an unhandled rejection as a non-zero exit rather than a silent success —
// a publish that half-completed must not look like it worked.
main().catch((error) => {
  console.error(`\n✖ ${error?.message ?? error}\n`);
  process.exit(1);
});
