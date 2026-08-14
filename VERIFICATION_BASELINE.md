# Verification Gate Baseline

The repository carries a pre-existing error backlog that predates the security
work. The point of these baselines is not to be green today — it is to make
regressions *detectable*, so new code has to be clean while the backlog is burned
down incrementally.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | Raw `tsc --noEmit`. Reports the full backlog. |
| `npm run typecheck:gate` | **The gate.** Fails only if the error count increases. |
| `npm run typecheck:baseline` | Ratchets the baseline down after fixes land. |
| `npm test` | Jest, single run. |
| `npm run verify` | `typecheck:gate && test`. |
| `npm run lint` | ESLint. |

## Current state

| Metric | At Phase 1 start | Now | Delta |
|--------|------------------|-----|-------|
| Typecheck errors | 525 | **288** | −237 (−45%) |
| Jest suites | 9 failed / 48 passed (57) | 9 failed / 50 passed (59) | +2 suites passing |
| Jest tests | 8 failed / 735 passed (753) | 31 failed / 767 passed (808) | +32 passing, +55 total |
| Repo size (excl. node_modules/.git) | 63 MB | 38 MB | −25 MB |

The typecheck count is enforced by `scripts/check-typecheck-baseline.js` against
`scripts/typecheck-baseline.json` (288). The gate fails on any increase and prints the
ratchet command on any decrease, so the number cannot silently drift back up.

### On the rise in failing tests (8 → 31)

This is not a regression in application code. The security work *added* test
suites — the bug-condition suites under `tests/security/` and `tests/payments/`
are written to fail against unfixed code, by design, and they are the
specification for work that is still open:

- `anonPrivilege.bugCondition.test.ts` asserts that the legacy files under `sql/`
  no longer contain `GRANT EXECUTE ... TO anon` for profile-mutating functions.
  The applied migration `20250712000002_revoke_unnecessary_anon_grants.sql`
  revokes those grants in the database, but the loose `sql/` scratch files still
  carry them. That is Phase 3 cleanup.
- `razorpaySecretInBuildArtifacts.bugCondition.test.ts` greps a built bundle. The
  `.probe-export*` directories it inspects were deleted (they contained the
  leaked secret in plaintext); the test documents the `npx expo export` commands
  that regenerate them.

Verified when Phase 1 landed: 30 failed / 67 passed → 28 failed / 69 passed
across `tests/config` + `tests/security`, with zero new failures.

## Typecheck backlog (288)

Concentrated in a few files, and dominated by two structural causes rather than
many independent mistakes:

| File | Errors | Cause |
|------|--------|-------|
| `services/aiAgent/bedrockAIService.ts` | 60 | Supabase join results typed as arrays where the code reads a single row; plus `catch (error)` being `unknown` under `strict`. |
| `app/(main)/stock/index.tsx` | 23 | Nullable `user` reads, dynamic string indexing of a translation map. |
| `app/(main)/wholesaler/customers/analytics.tsx` | 23 | Same Supabase join-shape issue, plus implicit-`any` accumulators. |
| `components/common/OCRScanner.tsx` | 13 | Reads `currentLanguage` off a union-typed language context that does not declare it. |

These need per-case judgment in live features (AI ordering, stock sharing,
customer analytics, OCR), so they are deliberately left for a focused pass rather
than bulk-edited. None are masked with `// @ts-nocheck`.

### Already fixed in this pass

- `app/(main)/settings/index.tsx` — 61 errors from a single `useState({})` whose
  inferred type was `{}`. One annotation (`Record<string, string>`) cleared all 61.
- `types/ai.ts` — 19 errors from `export default { ChatMessage, ... }` listing
  interfaces as runtime values. Interfaces do not exist at runtime, so the object
  was meaningless as well as invalid; removed.
- `utils/sentry.ts` — 16 errors. Called `Sentry.*` 11 times without importing it
  and imported `Severity`, which `@sentry/react-native` v6 does not export. Zero
  importers; deleted. Real Sentry usage is direct, in `app/_layout.tsx`,
  `components/ErrorBoundary.tsx`, `services/errors/ServiceError.ts` and
  `services/logging/LoggingService.ts`.
- `config/monitoring.ts` — 5 errors. Imported `newrelic` and
  `@analytics/google-analytics`, neither React Native compatible. Zero importers;
  deleted.
- `components/ai/index.tsx` — 4 errors. Wrong relative path to `types/ai`, and a
  default export using shorthand for names introduced by `export { default as X }`,
  which does not create a local binding.
- 13 `TS1117` duplicate-key errors across `stock/`, `phone-order/` and `loans/`.
  All were silently shadowed: in an object literal the later property wins. Fixed
  without changing what renders — see the commit for which side was kept and why.

## Lint (842 problems: 76 errors, 766 warnings)

Not yet gated. Dominant categories: `no-unused-vars`, `array-type` style,
`import/no-unresolved`, `react-hooks/exhaustive-deps`. 79 warnings are
`--fix`-able. Worth gating the same way once the count is reduced.

## Not verified in this environment

Neither the Deno nor the Supabase CLI is available here, so the edge functions
under `supabase/functions/` have been syntax-checked with the TypeScript compiler
API but **not** Deno-typechecked, served, or exercised against real AWS, AuthKey
or Razorpay endpoints. `tsconfig.json` excludes that directory because it is Deno
code using `jsr:` and `npm:` specifiers that `tsc` cannot resolve.
