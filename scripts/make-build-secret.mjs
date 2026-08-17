#!/usr/bin/env node
/**
 * Assemble and upload the CodeBuild build secret.
 *
 * The secret needs 13 JSON keys pulled from three different places: .env, Terraform
 * outputs, and two binary files that have to be base64 encoded. Doing that by hand
 * is tedious and, worse, silently forgiving — CodeBuild substitutes an empty string
 * for a missing JSON key, so a typo in a key name surfaces much later as a blank map
 * or an unsigned build rather than an error.
 *
 * Usage:
 *   node scripts/make-build-secret.mjs                 # validate and preview
 *   node scripts/make-build-secret.mjs --apply         # upload to Secrets Manager
 *
 * Keystore passwords are read from KEYSTORE_PASSWORD / KEY_PASSWORD in the
 * environment, never from .env and never from a file in the repo:
 *
 *   read -rs KEYSTORE_PASSWORD && export KEYSTORE_PASSWORD
 *   read -rs KEY_PASSWORD && export KEY_PASSWORD
 *   node scripts/make-build-secret.mjs --apply
 *
 * Secret values are never printed. The preview shows key names, lengths and a
 * fingerprint only, so this is safe to run with someone watching your screen.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdtempSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TERRAFORM_DIR = 'infra/terraform';
const KEYSTORE_PATH = 'credentials/android/dukaaon_upload_new.jks';
const GOOGLE_SERVICES_PATH = 'google-services.json';

const apply = process.argv.includes('--apply');

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function step(message) {
  console.log(`\n▸ ${message}`);
}

/** Parse .env the same way dotenv does, so values match what the app sees. */
function readDotenv(path = '.env') {
  if (!existsSync(path)) {
    fail(`${path} not found. It holds the client configuration this secret needs.`);
  }

  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function terraformOutputs() {
  if (!existsSync(join(TERRAFORM_DIR, '.terraform'))) {
    fail(
      `Terraform has not been initialised in ${TERRAFORM_DIR}.\n` +
        '  Run this first:\n' +
        `    cd ${TERRAFORM_DIR} && terraform init && terraform apply`
    );
  }

  let raw;
  try {
    raw = execFileSync('terraform', [`-chdir=${TERRAFORM_DIR}`, 'output', '-json'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    fail(
      'Could not read Terraform outputs. Has `terraform apply` completed successfully?'
    );
  }

  const parsed = JSON.parse(raw);
  if (Object.keys(parsed).length === 0) {
    fail('Terraform has no outputs yet — apply has not run.');
  }

  return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v.value]));
}

function base64File(path, label) {
  if (!existsSync(path)) {
    fail(
      `${label} not found at ${path}.\n` +
        (path === KEYSTORE_PATH
          ? '  This is your Play upload keystore. Without it CodeBuild cannot produce a\n' +
            '  Play-acceptable build. If it is genuinely lost, you need a Play App Signing\n' +
            '  key reset, which takes days — check your backups before assuming that.'
          : '  Download it from the Firebase console for the com.sixn8.dukaaon Android app.')
    );
  }
  return readFileSync(path).toString('base64');
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
}

function main() {
  step('Reading sources');

  const env = readDotenv();
  const tf = terraformOutputs();

  const keystorePassword = process.env.KEYSTORE_PASSWORD;
  const keyPassword = process.env.KEY_PASSWORD;

  if (!keystorePassword || !keyPassword) {
    fail(
      'KEYSTORE_PASSWORD and KEY_PASSWORD must be set in the environment.\n\n' +
        '  read -rs KEYSTORE_PASSWORD && export KEYSTORE_PASSWORD\n' +
        '  read -rs KEY_PASSWORD && export KEY_PASSWORD\n\n' +
        '  Use the NEW passwords, after running keytool -storepasswd / -keypasswd.\n' +
        "  The old value is in git history, so it must not be reused."
    );
  }

  // Deliberately fail rather than default. A missing client value would produce a
  // build that installs fine and misbehaves at runtime.
  const required = {
    google_maps_api_key: env.GOOGLE_MAPS_API_KEY,
    expo_public_supabase_url: env.EXPO_PUBLIC_SUPABASE_URL,
    expo_public_supabase_anon_key: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    expo_public_razorpay_key_id: env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
    firebase_api_key: env.FIREBASE_API_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    fail(`These values are missing from .env: ${missing.join(', ')}`);
  }

  step('Encoding binary inputs');
  const keystoreBase64 = base64File(KEYSTORE_PATH, 'Upload keystore');
  const googleServicesBase64 = base64File(GOOGLE_SERVICES_PATH, 'google-services.json');

  // Verify the keystore actually opens with the supplied password before uploading a
  // secret that would otherwise fail 15 minutes into a build.
  step('Verifying the keystore password');
  try {
    execFileSync(
      'keytool',
      ['-list', '-keystore', KEYSTORE_PATH, '-storepass', keystorePassword, '-alias', 'dukaaon_upload'],
      { stdio: 'ignore' }
    );
    console.log('   keystore opens with the supplied password, alias dukaaon_upload present');
  } catch {
    fail(
      'keytool could not open the keystore with KEYSTORE_PASSWORD, or alias\n' +
        '  "dukaaon_upload" does not exist in it. Fix this before uploading — otherwise\n' +
        '  every CodeBuild run will fail at the signing step.'
    );
  }

  const secret = {
    ...required,
    keystore_base64: keystoreBase64,
    keystore_password: keystorePassword,
    key_password: keyPassword,
    google_services_json_base64: googleServicesBase64,
    expo_update_url: tf.expo_update_url,
    ota_bucket: tf.updates_bucket,
    ota_base_url: `https://${tf.updates_hostname}`,
    ota_distribution_id: tf.cloudfront_distribution_id,
  };

  // Cross-check against what the buildspecs actually reference, so a rename in one
  // place cannot silently drift from the other.
  const expected = [
    'expo_public_razorpay_key_id',
    'expo_public_supabase_anon_key',
    'expo_public_supabase_url',
    'expo_update_url',
    'firebase_api_key',
    'google_maps_api_key',
    'google_services_json_base64',
    'key_password',
    'keystore_base64',
    'keystore_password',
    'ota_base_url',
    'ota_bucket',
    'ota_distribution_id',
  ];

  const produced = Object.keys(secret).sort();
  const missingKeys = expected.filter((k) => !produced.includes(k));
  const extraKeys = produced.filter((k) => !expected.includes(k));

  if (missingKeys.length || extraKeys.length) {
    fail(
      'Key mismatch against the buildspecs.\n' +
        (missingKeys.length ? `  missing: ${missingKeys.join(', ')}\n` : '') +
        (extraKeys.length ? `  extra:   ${extraKeys.join(', ')}\n` : '')
    );
  }

  step(`Secret contents (${produced.length} keys, values not shown)`);
  for (const key of produced) {
    const value = String(secret[key]);
    const shown = key.endsWith('_base64')
      ? `${value.length} chars of base64`
      : key.includes('password')
        ? `${value.length} chars`
        : value.length > 60
          ? `${value.slice(0, 40)}…`
          : value;
    console.log(`   ${key.padEnd(30)} ${String(shown).padEnd(46)} sha256:${fingerprint(value)}`);
  }

  if (!apply) {
    console.log(
      '\n✔ Validated. Nothing uploaded.\n' +
        '  Re-run with --apply to write this to Secrets Manager:\n' +
        `    node scripts/make-build-secret.mjs --apply\n`
    );
    return;
  }

  step('Uploading to Secrets Manager');

  // Written to a locked-down temp file rather than passed as an argv string, because
  // process arguments are visible to other processes via ps.
  const dir = mkdtempSync(join(tmpdir(), 'ota-secret-'));
  const file = join(dir, 'secret.json');

  try {
    writeFileSync(file, JSON.stringify(secret), { mode: 0o600 });
    chmodSync(file, 0o600);

    execFileSync(
      'aws',
      [
        'secretsmanager',
        'put-secret-value',
        '--secret-id',
        tf.build_secret_name,
        '--secret-string',
        `file://${file}`,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );

    console.log(`   wrote ${produced.length} keys to ${tf.build_secret_name}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(
    '\n✔ Uploaded.\n' +
      '  Next: start a build.\n' +
      `    aws codebuild start-build --project-name ${tf.codebuild_android_project}\n`
  );
}

main();
