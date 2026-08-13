# Verification Gate Baseline

Recorded as part of clause 2.22. All four non-watch verification commands terminate on their own with a verdict. The errors below are pre-existing and unrelated to the security fixes; the intent is to burn them down incrementally.

## Commands and Results (as of this baseline)

| Command | Exit Code | Result |
|---------|-----------|--------|
| `npm test` | 1 | 57 suites (9 failed, 48 passed), 753 tests (8 failed, 10 skipped, 735 passed) |
| `npm run typecheck` | 1 | 525 TypeScript errors |
| `npm run lint` | 1 | 842 problems (76 errors, 766 warnings) |
| `npm run test:watch` | N/A | Watch mode (intentionally non-terminating, not part of gate) |

## Typecheck Errors (525)

Pre-existing errors dominated by:
- Missing type exports / incorrect imports across services and components
- Implicit `any` types from untyped dependencies
- Module resolution failures for some service files
- `@sentry/react-native` API changes (Severity export removed)
- Type mismatches in AI, payment, and order service layers

These are NOT masked with `// @ts-nocheck`. The `tsconfig.json` scope is narrowed to app code only (`supabase/functions` excluded as Deno, `tests/` excluded to keep the gate fast).

## Lint Errors (842 problems: 76 errors, 766 warnings)

Most frequent categories:
- `@typescript-eslint/no-unused-vars` — unused variables/imports
- `@typescript-eslint/array-type` — style preference (Array<T> vs T[])
- `import/no-unresolved` — some module paths not resolvable by eslint
- `import/export` — duplicate exports in type declaration files
- `react/display-name` — anonymous component definitions
- `react-hooks/exhaustive-deps` — missing hook dependencies

79 warnings are auto-fixable with `--fix`.

## Test Failures (9 suites, 8 tests)

Failing suites are pre-existing and relate to:
- Missing module mocks (`services/supabase/client`)
- Speech SDK import issues in test environment
- Empty test files (`tests/integration/test.tsx`)
- Module resolution for services moved/renamed

## Burn-down Intent

These baselines should be reduced over time. No new code should introduce additional errors. The gate's purpose is to terminate with a verdict so regressions are detectable, not to be green today.
