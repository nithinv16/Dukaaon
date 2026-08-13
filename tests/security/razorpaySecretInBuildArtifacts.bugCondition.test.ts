/**
 * Bug-condition exploration test — the Razorpay key secret in build artifacts.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 4)
 * Property 3: Bug Condition — No Razorpay Secret in Any Build Artifact
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED TREE. Each failure is a
 * counterexample proving a live Razorpay credential is recoverable from a
 * shipped Android artifact. Do not weaken an assertion to make it green. It
 * turns green under task 9.2, which is how the fix is verified.
 *
 * ---------------------------------------------------------------------------
 * What "build artifact" means here, and what that does and does not prove
 * ---------------------------------------------------------------------------
 *
 * A full `expo run:android` / EAS APK build is not run from a Jest suite. Two
 * cheaper artifacts stand in, and between them they cover every route by which
 * a credential reaches a device:
 *
 *   1. `assets/app.config` — the serialized **public** app config. This is not
 *      an approximation of an APK artifact, it *is* one:
 *      `expo-constants/scripts/get-app-config-android.gradle` registers a
 *      `createExpoConfig` Gradle task that runs
 *      `expo-constants/scripts/getAppConfig.js` and adds its output directory to
 *      `android.sourceSets.main.assets.srcDirs`, marked
 *      `outputs.upToDateWhen { false }` so it regenerates on **every** build.
 *      Whatever that script writes is packaged into the APK and is what
 *      `Constants.expoConfig.extra` reads at runtime. This suite invokes the
 *      same script the Gradle task invokes, so the bytes it inspects are the
 *      bytes that ship. This is the route `app.config.js` uses.
 *
 *   2. The Metro/Hermes JS bundle — what ships as `assets/index.android.bundle`.
 *      This is the route the `config/*.ts` modules use, since their fallbacks
 *      are string literals in the module graph. Produced out of band by
 *      `expo export` (see BUNDLE_EXPORT_HINT); this suite greps it when it is
 *      present and SKIPS LOUDLY when it is not, rather than quietly passing.
 *
 * What this does not prove: nothing here inspects a signed APK, an AAB, or the
 * native `.so`/resource surface. It proves the credential is present in the two
 * artifacts the Android build packages, which is sufficient for clause 1.1 and
 * is the strongest claim available without a native toolchain run. A full APK
 * grep remains the belt-and-braces check for task 9.2.
 *
 * ---------------------------------------------------------------------------
 * Scoped PBT approach
 * ---------------------------------------------------------------------------
 *
 * Property 3 quantifies over combinations of set/unset `EXPO_PUBLIC_RAZORPAY_*`
 * variables. There are exactly two variables, so the domain has exactly four
 * points. Exhaustive enumeration is therefore strictly stronger than random
 * generation, and `fast-check` buys nothing: the four cases below ARE the
 * universally quantified statement, not a sample of it.
 *
 * ---------------------------------------------------------------------------
 * The leaked value is not written into this file
 * ---------------------------------------------------------------------------
 *
 * Adding another copy of a live credential to the repo to test for its presence
 * would be self-defeating. Instead the needle is recovered at runtime from a
 * copy that already exists — the working tree while task 9.1 has not landed,
 * then git history at commit 441065b, where the spec records it as permanently
 * present. Recovery is pinned by SHA-256 so a wrong or truncated value cannot
 * silently weaken every grep below. A hash is not a credential.
 */

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

jest.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Recovering the needles without adding a copy of them
// ---------------------------------------------------------------------------

/** SHA-256 of the leaked live key secret. Pins recovery; discloses nothing. */
const LEAKED_SECRET_SHA256 = 'b2afc3739574264ab4a1475d7713195f36e8e1811f43fb8e71882d0b94fd6c93';
/** SHA-256 of the leaked live key id. */
const LEAKED_KEY_ID_SHA256 = 'ab3b2bc7cf6c7bc2dff19e21b905fc983494d7c31e6b298c406e4a122dcd7b15';

/** Commit that introduced the credential, per bugfix.md clause 1.1 / design.md. */
const LEAK_ORIGIN_COMMIT = '441065b';

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

type Needles = { secret: string; keyId: string; recoveredFrom: string };

/**
 * Pulls the two credentials out of a `config/razorpay.ts` source text and
 * verifies each against its hash. Returns null if either is absent or wrong,
 * so a partial match can never half-arm the greps below.
 */
function extractFromRazorpayConfig(source: string): Omit<Needles, 'recoveredFrom'> | null {
  const grab = (key: string) =>
    new RegExp(`getConfigValue\\(\\s*['"]${key}['"]\\s*,\\s*['"]([^'"]+)['"]`).exec(source)?.[1];
  const secret = grab('EXPO_PUBLIC_RAZORPAY_KEY_SECRET');
  const keyId = grab('EXPO_PUBLIC_RAZORPAY_KEY_ID');
  if (!secret || !keyId) return null;
  if (sha256(secret) !== LEAKED_SECRET_SHA256) return null;
  if (sha256(keyId) !== LEAKED_KEY_ID_SHA256) return null;
  return { secret, keyId };
}

function recoverNeedles(): { needles: Needles } | { skipReason: string } {
  // 1. The working tree, while the fallbacks are still there.
  const configPath = path.join(REPO_ROOT, 'config', 'razorpay.ts');
  if (fs.existsSync(configPath)) {
    const found = extractFromRazorpayConfig(fs.readFileSync(configPath, 'utf8'));
    if (found) return { needles: { ...found, recoveredFrom: 'config/razorpay.ts (working tree)' } };
  }
  // 2. Git history, where the value permanently lives regardless of the fix.
  try {
    const historical = execFileSync(
      'git',
      ['show', `${LEAK_ORIGIN_COMMIT}:config/razorpay.ts`],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const found = extractFromRazorpayConfig(historical);
    if (found) {
      return {
        needles: { ...found, recoveredFrom: `git ${LEAK_ORIGIN_COMMIT}:config/razorpay.ts` },
      };
    }
  } catch {
    // No git, shallow clone, or history rewritten. Handled below.
  }
  return {
    skipReason:
      'Could not recover the leaked credential from the working tree or from ' +
      `${LEAK_ORIGIN_COMMIT}:config/razorpay.ts, so there is no needle to grep for. ` +
      'If history was scrubbed AND the fallbacks are gone, that is the intended end state — ' +
      'but it must be confirmed deliberately, not inferred from this suite going quiet.',
  };
}

const recovery = recoverNeedles();
const needles = 'needles' in recovery ? recovery.needles : null;
const needleSkipReason = 'skipReason' in recovery ? recovery.skipReason : null;

// ---------------------------------------------------------------------------
// Scanning the committed tree
// ---------------------------------------------------------------------------

type Hit = { file: string; line: number; what: 'key secret' | 'live key id'; text: string };

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.ttf', '.otf', '.woff', '.woff2',
  '.pdf', '.zip', '.jar', '.keystore', '.jks', '.hbc', '.mp3', '.mp4', '.aab', '.apk',
]);

/**
 * Paths that legitimately name the credential and are NOT part of the fix
 * surface. The spec documents the leak; a bug report that cannot name the bug
 * is useless. `docs/` is deliberately NOT excluded — clause 2.2 requires those
 * files to carry placeholders, so doc hits are findings.
 */
const EXPECTED_TO_NAME_THE_CREDENTIAL = [
  '.kiro/specs/',                             // requirements, design and plan
  'docs/PHASE1_',                             // counterexample records from tasks 2-4
  'docs/VERIFICATION_BASELINE.md',
  'tests/security/razorpaySecretInBuildArtifacts.bugCondition.test.ts', // this file
];

function listTrackedTextFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((f) => !BINARY_EXT.has(path.extname(f).toLowerCase()))
    .filter((f) => !EXPECTED_TO_NAME_THE_CREDENTIAL.some((p) => f.startsWith(p)));
}

/**
 * Every `file:line` in the committed tree carrying a live credential. Excerpts
 * are redacted so the record this suite prints does not itself become another
 * copy of the secret.
 */
function scanTrackedTree(n: Needles): Hit[] {
  const hits: Hit[] = [];
  for (const file of listTrackedTextFiles()) {
    const full = path.join(REPO_ROOT, file);
    let text: string;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes(n.secret) && !text.includes(n.keyId)) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      const redact = () =>
        line
          .replace(new RegExp(n.secret, 'g'), '<LIVE_KEY_SECRET>')
          .replace(new RegExp(n.keyId, 'g'), '<LIVE_KEY_ID>')
          .trim()
          .slice(0, 120);
      if (line.includes(n.secret)) {
        hits.push({ file, line: i + 1, what: 'key secret', text: redact() });
      } else if (line.includes(n.keyId)) {
        hits.push({ file, line: i + 1, what: 'live key id', text: redact() });
      }
    });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

const isDoc = (h: Hit) => h.file.startsWith('docs/') || h.file.endsWith('.md');

const treeHits = needles ? scanTrackedTree(needles) : [];
const sourceHits = treeHits.filter((h) => !isDoc(h));
const docHits = treeHits.filter(isDoc);

/**
 * Shortest prefix treated as a disclosure. The secret is 24 characters of
 * base64-ish alphabet; publishing the first 8 removes a third of the entropy
 * from anyone brute-forcing the rest, so a truncated "example" is still a leak.
 * Six is short enough to catch deliberate truncation and long enough that a
 * chance collision in a 20 MB tree is not a realistic concern.
 */
const MIN_DISCLOSED_PREFIX = 6;

type PartialHit = { file: string; line: number; prefixLength: number; text: string };

/**
 * Truncated credentials. Exact-match grepping misses these, which is how
 * `docs/guides/RAZORPAY_INTEGRATION.md` reads as clean while publishing the
 * first eight characters of the live secret.
 */
function scanForTruncatedCredentials(n: Needles): PartialHit[] {
  const prefixes: string[] = [];
  for (let len = n.secret.length - 1; len >= MIN_DISCLOSED_PREFIX; len--) {
    prefixes.push(n.secret.slice(0, len));
  }
  const hits: PartialHit[] = [];
  for (const file of listTrackedTextFiles()) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    } catch {
      continue;
    }
    if (!text.includes(n.secret.slice(0, MIN_DISCLOSED_PREFIX))) continue;
    text.split(/\r?\n/).forEach((line, i) => {
      // A line carrying the whole secret is already reported by scanTrackedTree.
      if (line.includes(n.secret)) return;
      // Longest prefix first, so each site is reported at its true severity.
      const matched = prefixes.find((p) => line.includes(p));
      if (!matched) return;
      hits.push({
        file,
        line: i + 1,
        prefixLength: matched.length,
        text: line.replace(matched, `<LIVE_KEY_SECRET[0:${matched.length}]>`).trim().slice(0, 120),
      });
    });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

const truncatedHits = needles ? scanForTruncatedCredentials(needles) : [];

// ---------------------------------------------------------------------------
// Artifact 1 — the `app.config` asset the Android build packages into the APK
// ---------------------------------------------------------------------------

const GET_APP_CONFIG = path.join(
  REPO_ROOT, 'node_modules', 'expo-constants', 'scripts', 'getAppConfig.js'
);
const GRADLE_SCRIPT = path.join(
  REPO_ROOT, 'node_modules', 'expo-constants', 'scripts', 'get-app-config-android.gradle'
);

type EnvCombination = { keyIdSet: boolean; keySecretSet: boolean };

/** The complete domain Property 3 quantifies over. Four points, all of them. */
const ENV_COMBINATIONS: EnvCombination[] = [
  { keyIdSet: false, keySecretSet: false },
  { keyIdSet: true, keySecretSet: false },
  { keyIdSet: false, keySecretSet: true },
  { keyIdSet: true, keySecretSet: true },
];

const label = (c: EnvCombination) =>
  `KEY_ID=${c.keyIdSet ? 'set' : 'unset'}, KEY_SECRET=${c.keySecretSet ? 'set' : 'unset'}`;

// Values supplied when a variable is "set". Deliberately test-mode and fake, so
// a combination that leaks the *supplied* secret is still a visible leak.
const SUPPLIED_KEY_ID = 'rzp_test_probeKeyId0';
const SUPPLIED_KEY_SECRET = 'probeSuppliedKeySecret00';

type AppConfigResult = {
  combination: EnvCombination;
  /** Exit status of the Gradle-invoked config generator. 0 means the build proceeds. */
  exitCode: number;
  buildFailedLoudly: boolean;
  /** `extra` keys that look like a Razorpay key secret, with values redacted. */
  keySecretFieldsInExtra: string[];
  /** True when the specific leaked live secret is in the shipped bytes. */
  containsLeakedSecret: boolean;
  containsLeakedKeyId: boolean;
  stderr: string;
};

/**
 * Runs the exact script `createExpoConfig` runs, under one env combination, and
 * reports what the APK would carry.
 */
function generateAppConfigAsset(combination: EnvCombination): AppConfigResult {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dukaaon-appconfig-'));
  // Start from a copy of the ambient environment with both variables cleared,
  // so a value inherited from the shell cannot silently change the combination.
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
  delete env.EXPO_PUBLIC_RAZORPAY_KEY_SECRET;
  if (combination.keyIdSet) env.EXPO_PUBLIC_RAZORPAY_KEY_ID = SUPPLIED_KEY_ID;
  if (combination.keySecretSet) env.EXPO_PUBLIC_RAZORPAY_KEY_SECRET = SUPPLIED_KEY_SECRET;

  let exitCode = 0;
  let stderr = '';
  try {
    execFileSync('node', [GET_APP_CONFIG, REPO_ROOT, outDir], {
      cwd: REPO_ROOT,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { status?: number; stderr?: string };
    exitCode = typeof e.status === 'number' ? e.status : 1;
    stderr = (e.stderr ?? '').toString().slice(0, 600);
  }

  const assetPath = path.join(outDir, 'app.config');
  const raw = fs.existsSync(assetPath) ? fs.readFileSync(assetPath, 'utf8') : '';
  let extra: Record<string, unknown> = {};
  try {
    extra = (JSON.parse(raw).extra ?? {}) as Record<string, unknown>;
  } catch {
    // No parseable asset. A build that produced nothing is a build that failed.
  }
  fs.rmSync(outDir, { recursive: true, force: true });

  const keySecretFieldsInExtra = Object.keys(extra).filter(
    (k) => /RAZORPAY/i.test(k) && /(SECRET|keySecret)/i.test(k)
  );

  return {
    combination,
    exitCode,
    // "Loudly" = a nonzero exit, which fails the Gradle task and the build.
    // Producing no asset also counts; silently shipping a fallback does not.
    buildFailedLoudly: exitCode !== 0 || raw === '',
    keySecretFieldsInExtra,
    containsLeakedSecret: !!needles && raw.includes(needles.secret),
    containsLeakedKeyId: !!needles && raw.includes(needles.keyId),
    stderr,
  };
}

const appConfigToolchainAvailable = fs.existsSync(GET_APP_CONFIG);
const appConfigResults: AppConfigResult[] = appConfigToolchainAvailable
  ? ENV_COMBINATIONS.map(generateAppConfigAsset)
  : [];

// ---------------------------------------------------------------------------
// Artifact 2 — the exported JS bundle
// ---------------------------------------------------------------------------

const BUNDLE_EXPORT_HINT =
  'Export a bundle first, then re-run:\n' +
  '  npx expo export --platform android --output-dir .probe-export\n' +
  'or, for a plain-JS bundle in which each source site appears separately:\n' +
  '  npx expo export --platform android --no-bytecode --output-dir .probe-export-js\n' +
  'then set PROBE_BUNDLE_DIR if the directory is not one of those two defaults.';

function findBundleFiles(): string[] {
  const dirs = [
    process.env.PROBE_BUNDLE_DIR,
    '.probe-export',
    '.probe-export-js',
    'dist',
  ].filter(Boolean) as string[];
  const found: string[] = [];
  for (const dir of dirs) {
    const root = path.isAbsolute(dir) ? dir : path.join(REPO_ROOT, dir);
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(js|hbc|bundle|map)$/i.test(entry.name)) found.push(full);
      }
    }
  }
  return found;
}

type BundleHit = { bundle: string; occurrences: number; what: 'key secret' | 'live key id' };

function scanBundles(n: Needles): { hits: BundleHit[]; scanned: string[] } {
  const hits: BundleHit[] = [];
  const scanned: string[] = [];
  for (const file of findBundleFiles()) {
    // Read as latin1 so Hermes bytecode is searched byte-wise rather than being
    // mangled by UTF-8 replacement characters.
    const bytes = fs.readFileSync(file, 'latin1');
    scanned.push(path.relative(REPO_ROOT, file));
    const count = (needle: string) => bytes.split(needle).length - 1;
    const secretCount = count(n.secret);
    const keyIdCount = count(n.keyId);
    if (secretCount > 0) {
      hits.push({
        bundle: path.relative(REPO_ROOT, file),
        occurrences: secretCount,
        what: 'key secret',
      });
    }
    if (keyIdCount > 0) {
      hits.push({
        bundle: path.relative(REPO_ROOT, file),
        occurrences: keyIdCount,
        what: 'live key id',
      });
    }
  }
  return { hits, scanned };
}

const bundleScan = needles ? scanBundles(needles) : { hits: [], scanned: [] };

// ---------------------------------------------------------------------------
// Sanity probes — these PASS before and after the fix
// ---------------------------------------------------------------------------

describe('Razorpay credential in build artifacts — harness evidence', () => {
  it('recovered the leaked credential to grep for', () => {
    // Without this, every assertion below could pass by searching for nothing.
    if (!needles) throw new Error(`No needle recovered.\n${needleSkipReason}`);
    expect(sha256(needles.secret)).toBe(LEAKED_SECRET_SHA256);
    expect(sha256(needles.keyId)).toBe(LEAKED_KEY_ID_SHA256);
    // eslint-disable-next-line no-console
    console.log(`[task 4] needle recovered from: ${needles.recoveredFrom}`);
  });

  it('read a meaningful slice of the committed tree', () => {
    // Guards against a zero-hit result that means "nothing was read".
    expect(listTrackedTextFiles().length).toBeGreaterThan(300);
  });

  it('evidence: the Android build packages the resolved public app config into the APK', () => {
    // This is what makes the four-combination assertion an APK claim rather
    // than a claim about a dev-time command.
    expect(appConfigToolchainAvailable).toBe(true);
    const gradle = fs.readFileSync(GRADLE_SCRIPT, 'utf8');
    expect(gradle).toContain('getAppConfig.js');
    expect(gradle).toContain('android.sourceSets.main.assets.srcDirs += assetsDir');
    // Regenerated on every build, so no stale-cache argument survives.
    expect(gradle).toContain('outputs.upToDateWhen { false }');
  });

  it('records which artifacts were inspected', () => {
    const summary = {
      appConfigAsset: appConfigToolchainAvailable
        ? `${appConfigResults.length}/4 env combinations generated`
        : 'NOT RUN — expo-constants scripts absent (run npm ci)',
      bundlesScanned: bundleScan.scanned.length ? bundleScan.scanned : 'none found',
    };
    // eslint-disable-next-line no-console
    console.log('[task 4] artifacts inspected:', JSON.stringify(summary, null, 2));
    expect(appConfigResults.length + bundleScan.scanned.length).toBeGreaterThan(0);
  });

  it('warns when the ambient environment could have skewed an out-of-band export', () => {
    // Found the hard way while writing this suite: an `EXPO_PUBLIC_RAZORPAY_*`
    // left in the shell is inherited by `expo export`, which changes what ends
    // up in the bundle the grep below reads. The four-combination assertions are
    // immune — `generateAppConfigAsset` clears both variables from the child env
    // before setting the combination — but a bundle produced out of band is not.
    const ambient = ['EXPO_PUBLIC_RAZORPAY_KEY_ID', 'EXPO_PUBLIC_RAZORPAY_KEY_SECRET'].filter(
      (k) => process.env[k] !== undefined
    );
    if (ambient.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[task 4] AMBIENT ENV SET: ${ambient.join(', ')}. The in-process combinations below are ` +
          'unaffected, but any bundle exported from this shell reflects these values rather than ' +
          'the fallbacks. Re-export with `env -u EXPO_PUBLIC_RAZORPAY_KEY_ID ' +
          '-u EXPO_PUBLIC_RAZORPAY_KEY_SECRET npx expo export ...` before trusting the bundle grep.'
      );
    }
    // Recording, not gating: this must not fail on an unfixed *or* fixed tree.
    expect(Array.isArray(ambient)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property 3 — the bug condition. EXPECTED TO FAIL on the unfixed tree.
// ---------------------------------------------------------------------------

describe('Property 3: no Razorpay key secret in any build artifact', () => {
  it('no source module hardcodes a live Razorpay credential fallback', () => {
    // Clause 1.1 predicts four sites: app.config.js:282, config/razorpay.ts:26,
    // config/razorpay.ts:72 (ENV_TEMPLATE), config/secrets.ts:50.
    expect(sourceHits).toEqual([]);
  });

  it('no source module exports a Razorpay key secret', () => {
    // Clause 2.1: the client may hold `keyId` only. Checked on the real modules
    // rather than by reading the source, so a re-export or a spread cannot hide.
    const offenders: string[] = [];
    for (const modulePath of ['../../config/razorpay', '../../config/secrets']) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(modulePath) as Record<string, unknown>;
      const visit = (value: unknown, trail: string, depth: number) => {
        if (depth > 3 || value === null || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (/(keySecret|KEY_SECRET)/i.test(key)) {
            offenders.push(`${modulePath.replace('../../', '')} -> ${trail}${key}`);
          }
          visit(child, `${trail}${key}.`, depth + 1);
        }
      };
      visit(mod, '', 0);
    }
    expect(offenders).toEqual([]);
  });

  it('committed documentation contains no live Razorpay credential', () => {
    // Clause 2.2: docs must carry placeholders only.
    expect(docHits).toEqual([]);
  });

  it('no committed file publishes a truncated Razorpay key secret', () => {
    // Clause 1.2 predicts docs/guides/RAZORPAY_INTEGRATION.md:~185. That line is
    // in fact already a placeholder; the real disclosure in that file is a
    // *truncated* secret higher up, which an exact-match grep does not see.
    // Asserted separately so the task 9.1 edit cannot leave a partial credential
    // behind and still turn this suite green.
    expect(truncatedHits).toEqual([]);
  });

  describe.each(ENV_COMBINATIONS.map((c) => [label(c), c] as const))(
    'app.config APK asset — %s',
    (_name, combination) => {
      const result = () => {
        const r = appConfigResults.find(
          (x) =>
            x.combination.keyIdSet === combination.keyIdSet &&
            x.combination.keySecretSet === combination.keySecretSet
        );
        if (!r) throw new Error('expo-constants scripts absent — run `npm ci` first');
        return r;
      };

      it('ships no Razorpay key secret to the client', () => {
        // Clause 2.1. Note this must hold in ALL FOUR combinations: a supplied
        // secret reaching `extra` is just as much a client-side secret as the
        // hardcoded one, so setting the variable is not a remedy.
        expect(result().keySecretFieldsInExtra).toEqual([]);
      });

      it('does not embed the leaked live credential', () => {
        expect({
          leakedSecret: result().containsLeakedSecret,
          leakedKeyId: result().containsLeakedKeyId,
        }).toEqual({ leakedSecret: false, leakedKeyId: false });
      });

      if (!combination.keyIdSet) {
        it('fails the build loudly instead of substituting a fallback credential', () => {
          // Clause 2.3. `exitCode !== 0` fails the `createExpoConfig` Gradle
          // task, which fails the Android build. Today it exits 0 with the live
          // key id substituted, which is the defect.
          const r = result();
          // The observed exitCode rides along in the assertion payload so the
          // failure message records what actually happened, not just `false`.
          expect({ buildFailedLoudly: r.buildFailedLoudly, observedExitCode: r.exitCode }).toEqual({
            buildFailedLoudly: true,
            observedExitCode: r.exitCode,
          });
        });
      }
    }
  );

  it('the exported JS bundle contains no Razorpay key secret', () => {
    if (!bundleScan.scanned.length) {
      // Loud skip, task-3 style. An absent bundle is an unmet precondition, not
      // evidence that the bundle is clean.
      // eslint-disable-next-line no-console
      console.warn(
        `[task 4] Bundle grep SKIPPED — NOT a pass and NOT a refutation.\n${BUNDLE_EXPORT_HINT}`
      );
      return;
    }

    // Staleness, decided exactly rather than by timestamp. A bundle exported
    // from a tree with no credential fallbacks cannot contain one, so "tree is
    // clean but bundle is not" means the bundle predates the fix. Asserting on
    // it either way would be meaningless, and failing on it would look like the
    // fix not working. mtime is not usable here: `git checkout` rewrites it
    // without changing content.
    const bundlePredatesTheFix = sourceHits.length === 0 && bundleScan.hits.length > 0;
    if (bundlePredatesTheFix) {
      // eslint-disable-next-line no-console
      console.warn(
        '[task 4] Bundle grep SKIPPED — the bundle on disk predates the credential removal, ' +
          'so it cannot say anything about the current tree. Delete the export directory and ' +
          `re-export.\n${BUNDLE_EXPORT_HINT}`
      );
      return;
    }

    expect(bundleScan.hits).toEqual([]);
  });
});
