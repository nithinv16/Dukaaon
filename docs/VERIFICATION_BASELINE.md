# Verification Baseline

Recorded by task 1 of `.kiro/specs/critical-security-and-error-fixes` (clause 2.22).

This file exists so later tasks can tell a regression from a pre-existing failure. Every number
below is a **starting point to burn down**, not a target to preserve. Nothing here was made green
with `// @ts-nocheck` or by skipping tests.

- Commit: see `git log -1` at the time of recording (branch state of task 1)
- Node 24.19.0, npm 11.17.0
- Expo 53.0.25, React Native 0.79.6, React 19.0.0, TypeScript 5.x (`devDependencies`)

## How to run the gate

```bash
npm ci --legacy-peer-deps    # see "Install notes" — plain `npm ci` fails on a peer conflict
npm run typecheck            # tsc --noEmit -p tsconfig.json
npm test                     # jest, non-watch
npm run test:watch           # the old watch behaviour, moved here
```

`lint` is deliberately not added yet — there is no ESLint config in the tree. It lands in task 27.

## Install notes

1. **`npm ci` did not work on the committed lockfile.** `package-lock.json` was missing four
   entries that `package.json` requires (`expo-application@6.1.5`, `expo-clipboard@7.1.5`,
   `expo-device@7.1.4`, and `ua-parser-js@0.7.41` beneath `expo-device`). The lock was refreshed
   with `npm install --legacy-peer-deps`; the resulting diff is exactly those four packages
   (+61 lines) and no version changes to anything already locked.
2. **`--legacy-peer-deps` is required.** `react-native-web@0.20.0` declares a
   `react-dom@^18 || ^19` peer, and `react-dom` is not a dependency of this project, so npm
   resolves `react-dom@19.2.8` and hits a `react@^19.2.8` peer conflict against the pinned
   `react@19.0.0`. Recorded as a known wart; not fixed here because pinning `react-dom` is a
   dependency-tree change outside this task's scope.
3. **`patch-package` runs but its only patch no longer applies.** `patches/expo-modules-autolinking+2.0.8.patch`
   was authored for version 2.0.8; the lockfile pins 2.1.14. `patch-package` reports
   `1 error(s)` and still **exits 0**, so `postinstall` succeeds and the Gradle autolinking fix is
   silently absent. This is pre-existing (the committed lock already pinned 2.1.14) and it is
   part of the clause 3.12 regression surface — the patch needs regenerating against 2.1.14 or
   deleting if the upstream fix landed. Not changed here.
4. npm 11 does not run install scripts for `@sentry/cli`, `fsevents`, `postinstall-postinstall`
   and `sharp` without `npm approve-scripts`. Neither the typecheck nor the test run needs them.

## `npm run typecheck` — baseline

**632 errors across 86 files. Exit code 1. Runs in ~5s.**

The original "`npx tsc --noEmit` hangs for ten minutes" symptom is gone and the design's root
cause is confirmed: with `node_modules` absent, `npx` fell through to the unrelated registry
package `tsc@2.0.4` and blocked on its `Ok to proceed? (y)` prompt. Scope was never the problem.

An interim `exclude` was added to `tsconfig.json` (`node_modules`, `supabase/functions`, `tests`,
`scripts`, `DukaaOnWebsite`, `Website`, `old-website-backup`, `src`, `screens`, `android`,
`patched-modules`, `polyfills`). `supabase/functions` is Deno with `jsr:`/URL imports `tsc`
cannot resolve. Note that `exclude` only filters the `include` globs — an excluded file still
gets checked if an included file imports it, which is why `screens/` and `src/` still appear below.

Narrowing `include` and removing `next-env.d.ts`, `.next/types/**/*.ts` and the `{"name": "next"}`
plugin is **deferred to task 16**, so this baseline still contains Next-related resolution errors.
That is expected.

By directory:

| Directory | Errors |
| --- | --- |
| `app/` | 243 |
| `services/` | 121 |
| `components/` | 84 |
| `middleware/` | 30 |
| repo root | 27 |
| `pages/` | 22 |
| `types/` | 19 |
| `utils/` | 18 |
| `config/` | 17 |
| `sms-hook/` | 12 |
| `screens/` | 12 |
| `navigator/` | 11 |
| `firebase/` | 9 |
| `hooks/` | 7 |
| `supfire/`, `store/`, `providers/`, `lib/` | 10 combined |

By error code (top): `TS2339` property-does-not-exist 190, `TS18046` value-is-`unknown` 63,
`TS2307` cannot-find-module 62, `TS2322` type-not-assignable 45, `TS7006` implicit-`any` param 32,
`TS2345` argument-not-assignable 29, `TS2304` cannot-find-name 28.

**56 of the 632 come from the dead Next.js layer** (`pages/`, `middleware/`, `config/security.ts`,
`next-env.d.ts`), including unresolved `next` (8), `next/server` (11), `zod` (4),
`rate-limiter-flexible` (2), `ioredis` (2), `jose` (1). Task 16 deletes that layer, so the count
should drop by roughly this much for free. This is also the exploratory confirmation task 15 is
looking for: the layer has never compiled.

Other notable unresolved modules, all pre-existing and outside this spec: `firebase-functions`,
`firebase-admin`, `formidable`, `recharts`, `newrelic`, `@mui/material`,
`isomorphic-dompurify`, `@analytics/google-analytics`, plus Deno URL imports reached through
`sms-hook/`.

## `npm test` — baseline

**50 suites: 42 pass, 8 fail. 630 tests: 625 pass, 5 fail. Exit code 1. Runs in ~35s.**

`test` is now `jest` (terminates) and the watch mode moved to `test:watch`.

One fix was needed to get a meaningful verdict at all: `jest-expo` was pinned at `~52.0.6`
against Expo SDK 53.0.25, and the version-52 preset setup crashed on
`Object.defineProperty called on non-object` at `jest-expo/src/preset/setup.js:122` for **every
one of the 50 suites** — 0 tests ran. `jest-expo` is now `53.0.14` and `react-test-renderer` is
`19.0.0` to match `react@19.0.0`, both pinned exact. Without this, none of the property-based
tests the later tasks depend on could run.

The 8 remaining failures, none of them related to this spec's fixes:

| Suite | Cause |
| --- | --- |
| `src/test/middleware/auth.test.ts` | `Cannot find module 'next/server'` — the dead layer. Goes away with task 16. |
| `tests/enhanced-ai-ordering.test.ts` | `Cannot find module '../services/supabase/client'` — wrong path in the test. |
| `tests/speechServices.test.ts` | Babel/Jest parse error on an untransformed dependency. |
| `tests/categories/CategoryNavigation.integration.test.ts` | `TurboModuleRegistry.getEnforcing('DevMenu')` invariant from a partial `react-native` mock. |
| `tests/integration/test.tsx` | "Your test suite must contain at least one test." |
| `tests/data/DataFetchCoordinator.unit.test.ts` | 1 assertion failure: parallel fetch of all data types. |
| `services/googleCloud/visionOCRService.test.ts` | 2 assertion failures in `getCurrentAppLanguage` (AsyncStorage undefined in the mock). |
| `tests/products/VirtualizedProductList.unit.test.ts` | 1 assertion failure: virtualization config export. |

## Deliberate additions after this baseline

- **Task 2** added `tests/payments/paymentIntegrity.bugCondition.property.test.tsx`, a
  bug-condition exploration suite that is **expected to fail** until Phase 1 lands
  (7 tests, 7 failures). It also added a test-only Babel plugin under `env.test` in
  `babel.config.js` so Jest can execute `await import(...)`. After it: 51 suites,
  637 tests, **625 still passing**, typecheck **still 632**. See
  `docs/PHASE1_BUG_CONDITION_COUNTEREXAMPLES.md`.
- **Task 3** added `tests/payments/paymentStatusAuthority.dbProbe.test.ts`, the
  database-level half of the same bug condition. 11 tests: **3 deliberate failures**
  (expected until task 11.1 lands the `payment_status` trigger), 4 passes (evidence
  and analyser sanity checks), and **4 skipped** — the empirical half, which needs a
  local or branch database and skips with a printed reason when none is configured.
  After it: 52 suites, 648 tests, **629 passing**, 15 failing, 4 skipped, typecheck
  **still 632** (`tests/**` is out of scope). See
  `docs/PHASE1_PAYMENT_STATUS_DB_PROBE.md`.
- **Task 4** added `tests/security/razorpaySecretInBuildArtifacts.bugCondition.test.ts`,
  the Property 3 exploration suite. 20 tests: **14 deliberate failures** (expected
  until task 9.1 strips the credential fallbacks) and 6 passes (harness evidence and
  sanity probes). After it: 53 suites, 668 tests, **635 passing**, 29 failing,
  4 skipped, typecheck **still 632**. See
  `docs/PHASE1_RAZORPAY_SECRET_IN_ARTIFACTS.md`.

  This suite greps an exported bundle when one is present and skips that single
  assertion loudly when it is not, so it needs no setup to run — but the bundle half
  only means something after an export. `.gitignore` now covers `.probe-export/`,
  `.probe-export-js/` and `.probe-export-fixed/`, the directories used for that.
  Always export with both Razorpay variables cleared, or the bundle reflects your
  shell rather than the fallbacks:

  ```bash
  env -u EXPO_PUBLIC_RAZORPAY_KEY_ID -u EXPO_PUBLIC_RAZORPAY_KEY_SECRET \
    npx expo export --platform android --output-dir .probe-export
  ```

- **Task 5** added `tests/payments/cleanupPendingOrders.bugCondition.property.test.ts`,
  the Property 4 exploration suite. 18 tests: **5 deliberate failures** (expected
  until task 12.1 replaces the cleanup predicate), 7 passes (the preserved
  baseline — paid and COD orders are already safe — plus the extraction evidence
  and the skip record), and **6 skipped** — the empirical half, which seeds rows
  and calls the real `cleanup_pending_orders()`, so it needs a local or branch
  database and skips with a printed reason when none is configured. After it:
  54 suites, 686 tests, **642 passing**, 34 failing, 10 skipped, typecheck
  **still 632**. See `docs/PHASE1_CLEANUP_JOB_SAFETY.md`.

  This suite needs no setup to run. It **extracts** the predicate from the latest
  migration defining `cleanup_pending_orders` and evaluates it as a property test,
  so it measures whatever is committed rather than a transcription — which is also
  why task 12.2 re-runs it with no edit. It reuses the same `PROBE_SUPABASE_*`
  contract and production-project-ref hard block as task 3, plus a psql mirror at
  `supabase/probes/cleanup_pending_orders_probe.sql`. Prefer the psql script when
  you have direct database access: it wraps both cleanup runs in a transaction that
  ends in `ROLLBACK`, so it also undoes any non-probe row the function deleted.

## What counts as a regression after this point

- `npm run typecheck` reporting **more than 632** errors, or errors in a file this spec touched.
- `npm test` reporting **fewer than 642** passing tests (625 at the original baseline,
  plus the 4 task 3 evidence probes, the 6 task 4 evidence probes and the 7 task 5
  baseline/evidence probes), or a new failing suite outside the eight above and the
  four deliberate exploration suites.
- Either command failing to terminate.
