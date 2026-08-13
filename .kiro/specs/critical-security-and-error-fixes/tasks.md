# Implementation Plan

## Overview

Ordering contract for this plan:

- **Task 1** establishes the verification toolchain first, because the design confirmed `npx tsc --noEmit` hangs solely because `node_modules` is absent (`npx` falls through to the unrelated registry package `tsc@2.0.4` and blocks on its install prompt). Every later task depends on being able to run a terminating typecheck and test command.
- **Tasks 2-13** are Phase 1 (Razorpay secret removal + payment integrity). Phase 1 is fully shippable at task 13 before Phase 2 starts.
- **Tasks 14-17** are Phase 2 (deleting the dead Next.js layer). Gated on Phase 1 being shipped.
- **Tasks 18-27** are Phase 3 (grants, third-party config, hygiene, verification gate).
- Exploratory bug-condition tests always run against the **unfixed** code and are expected to FAIL. Preservation tests always run against the **unfixed** code and are expected to PASS. Both come before the corresponding fix.
- Property numbering follows the six Correctness Properties in `design.md`, not a per-task counter.

## Tasks

- [x] 1. Install dependencies and make verification commands terminate
  - **BLOCKING PREREQUISITE**: no later task can verify its own work until this one is done
  - Run `npm ci` in a clean checkout — `node_modules` is absent from the working tree, which is the confirmed root cause of the `npx tsc --noEmit` hang (`npx` resolves the unrelated registry package `tsc@2.0.4` and blocks on `Ok to proceed? (y)`)
  - Confirm the `patch-package` postinstall step runs successfully (clause 3.12 regression surface)
  - Edit `package.json` scripts: change `"test": "jest --watchAll"` to `"test": "jest"`, add `"test:watch": "jest --watchAll"`, add `"typecheck": "tsc --noEmit -p tsconfig.json"`
  - Add an interim `exclude` to `tsconfig.json` covering `node_modules`, `supabase/functions`, `tests`, `scripts`, `DukaaOnWebsite`, `Website`, `old-website-backup`, `src`, `screens`, `android`, `patched-modules`, `polyfills` — `supabase/functions` is Deno with `jsr:`/URL imports `tsc` cannot resolve
  - **DEFERRED to task 16**: removing `next-env.d.ts`, `.next/types/**/*.ts` and the `{"name": "next"}` plugin from `tsconfig.json`, and narrowing `include`. Those entries only become removable once the Next.js layer is deleted, so the typecheck baseline recorded here will still contain Next-related resolution errors. That is expected.
  - Run `npm run typecheck` and `npm test` and confirm both **terminate with a verdict** (pass or fail — a verdict is the goal here, not a green result)
  - Record the current error count as a written baseline in the repo. Do NOT add `// @ts-nocheck` to make it green.
  - Confirm `fast-check` (already in `devDependencies`) and the `jest-expo` preset resolve, since every property test below uses them
  - _Requirements: 2.22_

---

### Phase 1 — Razorpay credential leak and payment integrity (clauses 2.1-2.6, 2.20, 3.1-3.6, 3.13)

- [x] 2. Write bug condition exploration test for client-authored payment state
  - **Property 1: Bug Condition** - Paid State Requires Server-Verified Signature
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples proving paid state is reachable without a server-verified HMAC
  - **Scoped PBT Approach**: the bug is deterministic, so scope the generator to the concrete failing shapes — single-seller and multi-seller carts crossed with `{payment_id, order_id, signature}` triples that are arbitrary (invalid HMAC). Keep the generator shape from Property 1 in the design (1-5 sellers, 1-20 items) so the same test broadens after the fix.
  - Bug condition under test, from `isBugCondition_C1` in the design: `paymentMethod != 'cod'` AND a Razorpay callback exists AND paid state is written by the client AND (the HMAC is invalid OR the verification verdict is ignored)
  - Assertion, from Property 1: for all such inputs, `payment_status == 'paid'` **if and only if** `verify-razorpay-payment` recomputed a matching HMAC and performed the transition itself; the client never writes paid state; the success modal appears if and only if the order is paid
  - Cover the four exploratory cases from the design's testing strategy:
    - Forged callback yields a paid order — call `handlePaymentSuccess` with an arbitrary signature, assert the order does not end `'paid'`. Expected failure: the single-seller insert at `app/(main)/checkout/index.tsx:321` hardcodes `payment_status: 'paid'`
    - `razorpayService.verifyPayment('pay_x', 'order_y', 'z')` returns `false`. Expected failure: returns `true` on prefix match alone (`services/payment/razorpayService.ts:439-480`)
    - Stub `functions.invoke` to resolve `{data: {verified: false}}`, assert no success modal and order not paid. Expected failure: handled only by `console.warn` at lines 290-291 and 370-371
    - Multi-seller verification — invoke with `order_id = <master_orders.id>`, assert `verified: true`. Expected failure: the edge function queries `orders`, does not find a master-order id, returns 404. **This prediction is worth checking early: if it holds, the multi-seller path has never verified anything.**
  - Run on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document each counterexample found, naming which of the three sources produced it (client hardcoding `'paid'`, prefix-only `verifyPayment`, ignored `verified: false`)
  - **RE-HYPOTHESIZE if a counterexample does not appear where predicted** — per the design's validation approach, do not proceed to the fix on a refuted root cause
  - Mark complete when the test is written, run, and the failure is documented
  - _Requirements: 1.4, 1.5, 1.6, 1.20, 2.4, 2.5, 2.6, 2.20_

- [x] 3. Write bug condition exploration probe for direct client writes to payment_status
  - **Property 1: Bug Condition** - Paid State Requires Server-Verified Signature (database-level half)
  - **CRITICAL**: This probe MUST FAIL on the unfixed database
  - **GOAL**: confirm no database-level authority exists over `payment_status`, independent of the client code
  - This is the manual DB probe from the design's exploratory test plan, run on a **branch database**, not production
  - With a normal user JWT: `UPDATE orders SET payment_status = 'paid' WHERE user_id = <self>`. Assert rejection.
  - Repeat for `master_orders`
  - Also attempt an `INSERT` into `orders` with `payment_status: 'paid'` under a user JWT. Assert rejection.
  - Run on UNFIXED schema
  - **EXPECTED OUTCOME**: writes SUCCEED, i.e. the assertions FAIL — the only existing control is a `CHECK` constraint on allowed *values*, with no RLS policy, trigger or security-definer RPC restricting *who* may write which value
  - Document the result; this is the justification for the trigger in task 8
  - _Requirements: 1.20, 2.20_

- [x] 4. Write bug condition exploration test for the Razorpay secret in build artifacts
  - **Property 3: Bug Condition** - No Razorpay Secret in Any Build Artifact
  - **CRITICAL**: This test MUST FAIL on unfixed code
  - **Scoped PBT Approach**: enumerate all 4 combinations of set/unset `EXPO_PUBLIC_RAZORPAY_KEY_ID` and `EXPO_PUBLIC_RAZORPAY_KEY_SECRET` (Property 3 in the design) — a complete small domain, so exhaustive enumeration replaces random generation
  - Grep the built bundle for the leaked secret value and for `rzp_live_`. Assert zero matches for the secret. Expected failure: four sources compile it in — `app.config.js:282`, `config/razorpay.ts:26`, `config/razorpay.ts:72` (`ENV_TEMPLATE`), `config/secrets.ts:50`
  - Grep the committed docs for the same values. Expected failure: `docs/RAZORPAY_FIX_CACHE.md:65` and `docs/guides/RAZORPAY_INTEGRATION.md:~185`
  - Build with both variables unset. Assert the build FAILS loudly. Expected failure: `app.config.js:281-282` silently substitutes live production credentials
  - Assert no source module exports a Razorpay key secret at all
  - Run on UNFIXED code
  - **EXPECTED OUTCOME**: all assertions FAIL, confirming a live credential is recoverable from any shipped APK
  - Document the counterexamples, including the exact file:line of each of the four fallbacks
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 5. Write bug condition exploration test for cleanup job safety
  - **Property 4: Bug Condition** - Cleanup Never Deletes an In-Flight or Paid Order
  - **CRITICAL**: This test MUST FAIL (or reveal the second failure mode below) on the unfixed code
  - **Scoped PBT Approach**: generate order rows across a range of `payment_initiated_at` / `created_at` offsets crossed with payment methods (`razorpay`, `cod`, `cash`) and payment statuses (`pending`, `paid`), per Property 4 in the design
  - **Check both directions, because the current predicate is wrong both ways:**
    - Insert an online order `payment_status: 'pending'`, `status: 'pending'`, `created_at` 6 minutes ago, then run `cleanup_pending_orders()`. Assert it survives. Expected failure: deleted — the old 5-minute window against a job running every 5 minutes can delete a legitimate slow payment between callback and verification, which is exactly what clause 3.6 forbids
    - Insert the same order with `status: 'placed'` (the value `checkout/index.tsx` actually writes). Expected finding: it survives cleanup but is **never** cleaned up either, so abandoned orders accumulate
  - Assert a `paid` order and a COD order are never deleted (these should already hold — record them as the preserved baseline)
  - Interleave a `mark_order_paid`-equivalent update with a cleanup run and assert no ordering deletes a paid order
  - Run on UNFIXED schema against a branch database
  - **EXPECTED OUTCOME**: the in-flight case FAILS and the `status: 'placed'` case reveals the never-cleaned mode
  - Document both counterexamples
  - _Requirements: 1.20, 2.5, 3.6_

- [x] 6. Write preservation property tests for Phase 1 (BEFORE implementing the fix)
  - **Property 2: Preservation** - Non-Payment Inputs and Existing Reads Unchanged
  - **IMPORTANT**: Follow observation-first methodology — capture what the UNFIXED code actually does, not what it is assumed to do
  - Bug condition is FALSE for every input here (`isBugCondition_C1` returns false): COD checkouts, cart and product operations, seller status transitions, and all reads by every role
  - Observe on UNFIXED code, then encode each observation as a property-based test over the input domain:
    - COD checkout creates the order at `payment_status: 'pending'`, never touches Razorpay, and completes (`checkout/index.tsx:136`). Covers 3.1
    - Verified-payment happy path ends `paid`, records a `payment_transactions` row, shows the success confirmation. Capture the **end state**, since the route to it changes. Covers 3.2, 3.5
    - Multi-seller cart splits per seller under a master order via `MasterOrderService.placeCompleteOrder` — capture master-order shape, per-seller row count, delivery-fee assignment to the first seller, and the delivery batch. Covers 3.3
    - Razorpay sheet initializes from `keyId` alone (`validateRazorpayConfig()` already requires only `keyId`). Covers 3.4
    - The HMAC computation over `razorpay_order_id|razorpay_payment_id` in `supabase/functions/verify-razorpay-payment/index.ts:90-110` produces identical output — snapshot it. Covers 3.5
    - Every existing buyer and seller `SELECT` on `orders`, `master_orders` and `payment_transactions` — capture results for byte-identical comparison after the trigger lands. Covers 3.13
    - Seller-side `status` updates (`accepted`, `out_for_delivery`, `delivered`) succeed. The trigger fires only on a `payment_status` change, so these must be unaffected; **this test is what proves it**
  - **Why property-based here**: the preservation surface is wide (arbitrary carts × arbitrary seller counts × both payment methods × every reading role) and the risk is a case nobody enumerated. `fast-check` is already in `devDependencies`; generated inputs shrink to a minimal counterexample.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.13_

- [x] 7. HUMAN CHECKPOINT — Rotate the leaked Razorpay key
  - **REQUIRES A HUMAN OPERATOR. This is not a code task and cannot be completed by editing files.**
  - **BLOCKING**: clause 2.3 is unmet — and Phase 1 is not closable — until rotation is confirmed
  - In the Razorpay dashboard: generate a new key pair, then **disable** `rzp_live_<ROTATED_KEY_ID_REDACTED>` / `<ROTATED_KEY_SECRET_REDACTED>`
  - Rationale: the secret is in git history from commit `441065b` and in every build produced since. Removing it from the working tree is necessary and insufficient. Rotation is the only real remediation.
  - History scrubbing is optional follow-up and **does not substitute** for rotation
  - Record confirmation (who rotated, when, old key disabled) before marking this complete
  - _Requirements: 2.3_

- [x] 8. HUMAN CHECKPOINT — Configure Supabase Edge Function secrets
  - **REQUIRES A HUMAN OPERATOR. This is not a code task.**
  - **BLOCKING**: Phase 1 cannot function without this — the client no longer carries the secret, so the server must
  - Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (the **new** pair from task 7) as Supabase Edge Function secrets
  - Confirm `SUPABASE_SERVICE_ROLE_KEY` is available to `verify-razorpay-payment`, since it needs it for the `mark_order_paid` call added in task 11
  - Both `razorpay-function` and `verify-razorpay-payment` read from Deno env — verify each resolves its secrets after the change
  - _Requirements: 2.1, 2.3, 2.20_

- [x] 9. Remove the Razorpay secret from the client and the docs

  - [x] 9.1 Strip credential fallbacks from the config layers
    - `app.config.js` — delete the `extra.EXPO_PUBLIC_RAZORPAY_KEY_SECRET` entry (line 282). Change line 281 to `process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID` with **no** `||` fallback. Add a guard at the top of the config export that throws when it is missing, so absence is a build failure rather than a runtime surprise.
    - `config/razorpay.ts` — remove the `keySecret` constant (line 26) and the `keySecret` field from the exported `razorpayConfig`. Remove the hardcoded `keyId` fallback. Replace the two live values inside `ENV_TEMPLATE` (line 72) with `rzp_test_xxxxxxxxxxxx` and a `# set in Supabase secrets, never here` comment. Leave `validateRazorpayConfig()` as-is — it already requires only `keyId`, which is what preserves clause 3.4.
    - `config/secrets.ts` — remove the `keySecret` field and the `keyId` fallback from `razorpayConfig` (lines 49-51). Also drop the hardcoded Supabase URL and anon key fallbacks (lines 28-29) per clause 2.18; sourcing them from `extra` keeps publishable values rotatable.
    - `docs/RAZORPAY_FIX_CACHE.md` (line ~65) and `docs/guides/RAZORPAY_INTEGRATION.md` (~line 185) — replace both live values with placeholders
    - `.env.example` — remove `EXPO_PUBLIC_RAZORPAY_KEY_SECRET`
    - _Bug_Condition: isBugCondition_C3(artifact) where artifact.kind == 'committed_file' AND containsCredential(artifact); plus the four build-time fallbacks from clause 1.1_
    - _Expected_Behavior: Property 3 — no Razorpay key secret in any bundle for any build profile, and a loud failure when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is absent_
    - _Preservation: Preservation Requirements 3.4 (RN sheet initializes from `keyId` alone) and 3.12 (Expo/EAS build unaffected)_
    - _Requirements: 2.1, 2.2, 2.3, 2.18_

  - [x] 9.2 Verify the secret-in-artifact exploration test now passes
    - **Property 3: Expected Behavior** - No Razorpay Secret in Any Build Artifact
    - **IMPORTANT**: Re-run the SAME test from task 4 - do NOT write a new test
    - Confirm zero bundle matches for the leaked secret, zero doc matches, and a loud build failure when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is unset
    - **EXPECTED OUTCOME**: Test PASSES (confirms the leak is closed in the tree; note that task 7 is what closes it in reality)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 9.3 Verify the Razorpay sheet still initializes
    - **Property 2: Preservation** - Non-Payment Inputs and Existing Reads Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Specifically the sheet-initialization observation: opening the Razorpay sheet must still succeed with `keyId` only
    - **EXPECTED OUTCOME**: Tests PASS (no regression)
    - _Requirements: 3.4, 3.12_

- [x] 10. Confirm the live schema before writing the payment_status trigger migration
  - **PREREQUISITE for task 11. Do not write the trigger migration before this is done.**
  - The design flagged migration drift: the committed migrations and the running database appear to have diverged, so the trigger must be designed and tested against the **live** schema, not the reconstructed one
  - Query the live database for the actual `CHECK` constraint definitions on `orders.status`, `orders.payment_status` and `master_orders.payment_status`
  - Confirm or refute both drift facts:
    - `checkout/index.tsx` inserts `status: 'placed'`, which is **not** in the `orders_status_check` list from migration `20251003112500`
    - `services/aiOrderPlacement.ts:65` writes `payment_status: 'not_paid'`, which is **not** in the `payment_status` `CHECK` list from `20250105000000`
    - Both writes would already be failing if the live constraints matched the committed migrations — so either the constraints differ live, or these paths are broken today. Determine which.
  - **Decide and record the handling for `'not_paid'`** before the trigger goes in: normalize it to `'pending'`, or add it to the privileged-value set. The trigger's predicate depends on this answer.
  - Confirm whether `payment_transactions.transaction_id` already carries a unique index — the `ON CONFLICT (transaction_id) DO NOTHING` clause in `mark_order_paid` requires one, and the migration must add it if absent
  - Confirm `orders` and `master_orders` do not already have a `payment_initiated_at` column
  - Record the findings in the spec or a migration comment so the next reader knows what the live schema actually is
  - This drift is pre-existing and out of scope to fix; the point is that the trigger must not be built on a false model of the schema
  - _Requirements: 2.20, 3.13_

- [ ] 11. Make the database and the edge function the only authority over paid state

  - [x] 11.1 Add the payment_status authority migration
    - New migration `supabase/migrations/<ts>_enforce_payment_status_authority.sql`, written against the schema confirmed in task 10
    - Add nullable `payment_initiated_at TIMESTAMPTZ` to `orders` and `master_orders` (nullable so existing rows are unaffected)
    - Create `mark_order_paid(p_order_id, p_master_order_id, p_razorpay_payment_id, p_amount)` as `SECURITY DEFINER` with `SET search_path = public`. In **one** `UPDATE` it sets `payment_status = 'paid'`, clears `payment_initiated_at`, and bumps `updated_at`; it then inserts the `payment_transactions` row with `status: 'completed'` using `ON CONFLICT (transaction_id) DO NOTHING`. Handle the master-order shape by updating the master row and all child `orders` rows.
    - **Idempotency**: a second call with the same `razorpay_payment_id` on an already-`paid` order returns success as a no-op. This is what makes client retry safe and a replayed genuine callback harmless.
    - `REVOKE ALL ON FUNCTION public.mark_order_paid(...) FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE ... TO service_role`
    - Create `enforce_payment_status_authority()` and attach it as a `BEFORE INSERT OR UPDATE ... FOR EACH ROW` trigger on both `orders` and `master_orders`: on `INSERT`, reject any `payment_status` other than `'pending'` from a non-privileged caller; on `UPDATE`, reject any change to `payment_status` from a non-privileged caller. Privileged means `current_user IN ('postgres', 'supabase_admin', 'service_role')`. Raise with `ERRCODE = 'insufficient_privilege'`.
    - **Mechanism rationale (do not substitute RLS or column grants)**: RLS `WITH CHECK` cannot express "every column except this one" and would have to be duplicated across the existing `UPDATE` policies on `orders`, which is high regression risk on seller flows. Column-level `REVOKE INSERT (payment_status)` fails *any* insert naming the column, including the COD path that legitimately writes `'pending'` at `checkout/index.tsx:136`, violating clause 3.1. Only a trigger discriminates on both operation and value.
    - `SECURITY DEFINER` on `mark_order_paid` makes `current_user` the function owner inside the trigger, so the authorized path passes with no session variable or magic flag
    - No `SELECT` policy is added, altered or dropped
    - _Bug_Condition: isBugCondition_C1(input) — paid state reachable without a server-verified signature, with no database-level control over who writes it_
    - _Expected_Behavior: Property 1 — `payment_status == 'paid'` if and only if `verify-razorpay-payment` recomputed a matching HMAC and performed the transition itself_
    - _Preservation: Preservation Requirements 3.1 (COD insert at `'pending'` still allowed), 3.13 (reads bit-identical, seller `status` transitions unaffected — no app code performs an `UPDATE` on `payment_status`)_
    - _Requirements: 2.20, 3.1, 3.13_

  - [x] 11.2 Make verify-razorpay-payment the only writer
    - `supabase/functions/verify-razorpay-payment/index.ts`
    - Keep the existing HMAC block (lines 90-110) **exactly as it is** — clause 3.5 requires it unchanged
    - Keep the anon-key client built from the caller's `Authorization` header and keep using it for the **ownership** check, so "this order belongs to this user" stays enforceable under RLS
    - Fix the ownership check to accept `order_id` **or** `master_order_id` and look the value up in the matching table. This closes the multi-seller 404 found in task 2.
    - Add a **second** client from `SUPABASE_SERVICE_ROLE_KEY` (Deno env) used for exactly one call: `rpc('mark_order_paid', {...})`. Nothing else in the function uses it.
    - On signature mismatch, return HTTP **400** instead of the current 200 with `{verified: false}`, so a careless caller cannot mistake it for success. Keep `verified: false` in the body.
    - If `mark_order_paid` itself fails, respond `verified: false` with a distinct code and leave the order `pending`
    - Register the function in `supabase/config.toml` with `verify_jwt = true` — it is currently absent from that file and relies on the platform default
    - _Bug_Condition: isBugCondition_C1(input) — verification runs after the paid write and its verdict is discarded_
    - _Expected_Behavior: Property 1 — the edge function is the single source of truth for payment status_
    - _Preservation: Preservation Requirement 3.5 (HMAC computation byte-identical), 3.2 (a genuine payment still ends `paid` with a transaction row)_
    - _Requirements: 2.5, 2.20, 3.2, 3.5_

  - [-] 11.3 Rewrite the checkout sequence to pending-then-verify
    - `app/(main)/checkout/index.tsx` — both branches of `handlePaymentSuccess` collapse to the same five steps. The client never writes paid state and never decides anything.
    - Step 1, create a **pending** order: single-seller `INSERT orders { payment_status: 'pending', payment_initiated_at: now() }`; multi-seller `MasterOrderService.placeCompleteOrder(...)` with every per-seller order and the master order at `'pending'` and `payment_initiated_at` set on both. **No `payment_transactions` row is written here.**
    - Step 2, open the Razorpay sheet (unchanged, `keyId` only). On callback, persist nothing.
    - Step 3, invoke `verify-razorpay-payment` with the triple plus `order_id` **or** `master_order_id`
    - Step 4 happens server-side (task 11.2 / 11.1)
    - Step 5, read back the verified state: if `response.verified !== true` then `setError(...)`, `setShowPaymentProcessor(false)`, **no** `clearCart()`, **no** success modal, offer retry; otherwise re-`SELECT` the order, assert `payment_status === 'paid'`, then `clearCart()` and show the success modal
    - Delete `payment_status: 'paid'` from the `ordersBySeller` construction (line 247) and from the single-seller `INSERT` (line 321)
    - Replace the `console.warn`-only handling at lines 290-291 and 370-371 with the real failure branch
    - **Cart is deliberately preserved on verification failure** so the buyer can retry without rebuilding it
    - Implement every failure path from the design's table: HMAC mismatch → order stays `pending` (the row is evidence; cleanup reclaims it), 5xx / invoke throw / connectivity loss after callback → order stays `pending` with a retry that re-invokes verification on the same triple and a "verification pending — do not pay again" message, app killed mid-flow → order stays `pending` and is cleaned up after the grace window, `mark_order_paid` failure → distinct code, order stays `pending`, retry safe. **Never delete the order on failure** — deleting risks discarding a genuinely captured payment, and verification is idempotent so retry is safe.
    - **Known residual gap, deliberately out of scope**: no Razorpay webhook consumer for "payment captured but app never verified". It is the correct long-term reconciliation path but is new function, not a fix, and the requirements do not ask for it.
    - _Bug_Condition: isBugCondition_C1(input) — client writes `payment_status: 'paid'` at lines 247 and 321 before verification is attempted_
    - _Expected_Behavior: Property 1 — order created `pending`, no client paid write, success modal shown if and only if the order is paid_
    - _Preservation: Preservation Requirements 3.1, 3.2, 3.3 (COD path, verified happy path end state, multi-seller split all unchanged)_
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 3.3_

  - [ ] 11.4 Remove the fake client-side verification
    - `services/payment/razorpayService.ts` — delete `verifyPayment()` (lines 439-480) outright. A method that must never be trusted is better absent than present-and-throwing.
    - `components/payment/PaymentProcessor.tsx` — remove the `verifyPayment` call and the `if (isVerified)` gate (lines ~100-118). `PaymentProcessor` reverts to what it actually is: a UI wrapper that opens the sheet and hands the callback triple to `onSuccess`. Success UI moves behind the verified read in task 11.3.
    - _Bug_Condition: isBugCondition_C1(input) — `verifyPayment()` returns true for any strings beginning `pay_` and `order_`, performing no HMAC check_
    - _Expected_Behavior: Property 1 — no client-side verification path exists; the edge function's HMAC comparison is the authoritative check_
    - _Preservation: Preservation Requirement 3.5 (the edge function's HMAC logic is untouched; only its authority in the flow changes)_
    - _Requirements: 2.6, 3.5_

  - [ ] 11.5 Verify the payment-integrity exploration tests now pass
    - **Property 1: Expected Behavior** - Paid State Requires Server-Verified Signature
    - **IMPORTANT**: Re-run the SAME tests from tasks 2 and 3 - do NOT write new tests
    - The test from task 2 encodes the expected behavior; when it passes, the expected behavior is satisfied
    - Broaden the task 2 generator from the scoped failing cases to the full Property 1 domain (1-5 sellers, 1-20 items, both payment methods, crossed with callback triples of which a known subset has valid HMACs) and assert `paid` if and only if the triple was valid and verification ran server-side
    - Re-run the task 3 DB probe: a user-JWT `UPDATE`/`INSERT` of `payment_status = 'paid'` must now be rejected with `insufficient_privilege`
    - Add the unit coverage the design calls for: `mark_order_paid` authorized call succeeds, `anon` and `authenticated` calls denied, repeat call on an already-paid order is a no-op returning success; `enforce_payment_status_authority` allows client `INSERT` at `'pending'`, rejects client `INSERT` at `'paid'`, rejects client `UPDATE` of `payment_status`, allows non-`payment_status` `UPDATE`, allows the privileged transition; edge function returns 400 and writes nothing on mismatch, resolves both id shapes, rejects a cross-user `order_id`
    - **EXPECTED OUTCOME**: Tests PASS (confirms the bug is fixed)
    - _Requirements: 2.4, 2.5, 2.6, 2.20_

  - [ ] 11.6 Verify the Phase 1 preservation tests still pass
    - **Property 2: Preservation** - Non-Payment Inputs and Existing Reads Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Confirm byte-identical results for every captured buyer and seller `SELECT` on `orders`, `master_orders` and `payment_transactions`
    - Confirm seller `status` transitions (`accepted`, `out_for_delivery`, `delivered`) still succeed with the trigger in place
    - Confirm COD checkout, the multi-seller split shape, and the verified-payment end state all match the captures
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.13_

- [ ] 12. Make the cleanup job safe under the new pending-then-verify flow

  - [ ] 12.1 Replace cleanup_pending_orders with a grace-window predicate
    - New migration `supabase/migrations/<ts>_cleanup_pending_orders_grace.sql`, replacing `cleanup_pending_orders()`
    - The current predicate (`payment_status = 'pending' AND status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes' AND payment_method NOT IN ('cod','cash')`) is wrong in both directions under the new flow, as confirmed in task 5
    - New predicate keys on the in-flight marker the verification RPC clears: `payment_status = 'pending' AND payment_method NOT IN ('cod','cash') AND payment_initiated_at IS NOT NULL AND payment_initiated_at < NOW() - INTERVAL '15 minutes'`
    - Three properties fall out of this shape: a paid order can never be deleted (`mark_order_paid` sets `payment_status` and clears `payment_initiated_at` in the **same** `UPDATE`, so there is no window where a row is paid and still matches); an in-flight order can never be deleted (15 minutes comfortably exceeds sheet lifetime plus verification, where the old 5-minute window against a 5-minute job could delete a slow legitimate payment); COD is untouched
    - Stop keying on `status` at all — it coupled cleanup to an unrelated lifecycle field, which is why `status: 'placed'` orders were never cleaned
    - Keep the `pg_cron` schedule and the `service_role`-only `GRANT`. Replace the partial index with one matching the new predicate. Delete the now-false header comment claiming orders are only created after payment succeeds.
    - _Bug_Condition: isBugCondition_C1 aggravating case — cleanup could delete an order mid-verification, which clause 3.6 forbids_
    - _Expected_Behavior: Property 4 — delete only online-payment orders still `pending` past the grace window; leave paid, COD and in-flight orders untouched_
    - _Preservation: Preservation Requirement 3.6 (stale unpaid orders are still reclaimed)_
    - _Requirements: 2.5, 3.6_

  - [ ] 12.2 Verify the cleanup exploration test now passes
    - **Property 4: Expected Behavior** - Cleanup Never Deletes an In-Flight or Paid Order
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - Broaden the generator to the full Property 4 domain: order rows across `payment_initiated_at` offsets × payment methods × payment statuses, asserting the predicate deletes exactly the abandoned online-pending set
    - Interleave a `mark_order_paid` call with a cleanup run and assert no ordering deletes a paid order
    - Add the unit coverage: deletes an abandoned online order past the window, spares one inside it, spares a paid order, spares COD
    - **EXPECTED OUTCOME**: Tests PASS
    - _Requirements: 2.5, 3.6_

- [ ] 13. HUMAN CHECKPOINT + Phase 1 ship gate
  - [ ] 13.1 HUMAN CHECKPOINT — Confirm pg_cron is enabled in Supabase
    - **REQUIRES A HUMAN OPERATOR. This is not a code task.**
    - In the Supabase dashboard: Database → Extensions → confirm `pg_cron` is enabled, and confirm the revised cleanup job from task 12 is actually scheduled and running
    - The existing migration warns and continues if `pg_cron` is absent, so a silently unscheduled job is possible today. Verify the schedule exists rather than assuming the migration created it.
    - _Requirements: 3.6_

  - [ ] 13.2 Phase 1 checkpoint — confirm Phase 1 is shippable on its own
    - **Do not start Phase 2 until this passes.**
    - Confirm all of tasks 2-12 are complete and their tests are in the state the plan requires: Property 1, 3 and 4 tests PASS, Property 2 preservation tests PASS
    - Confirm the two blocking human actions are done and recorded: task 7 (Razorpay key rotated, old key disabled) and task 8 (Edge Function secrets set to the new pair, `SUPABASE_SERVICE_ROLE_KEY` reachable)
    - Run the integration tests the design specifies for Phase 1 on a branch database: full online checkout single-seller and multi-seller (pending → sheet → verification → server transition → verified read-back → success UI, asserting **no** intermediate state where the client wrote `paid`); forged-signature flow (order stays `pending`, buyer sees failure, cart preserved, retry re-invokes verification on the same order); interrupted flow (app killed between callback and verification — order stays `pending`, cleaned up after the grace window, no paid order ever produced); full COD checkout unchanged end to end
    - Run `npm run typecheck` and `npm test` and confirm no new errors against the task 1 baseline
    - Ensure all tests pass. Ask the user if questions arise.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.20, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.13_

---

### Phase 2 — delete the dead Next.js layer (clauses 2.7-2.17, 3.9, 3.10, 3.12)

**Gated on task 13.2.** Clause 2.15 requires a recorded decision; the design records it: **delete**. The investigation found no deployment target, no build command, no installed dependencies, and no reachable caller — both apparent consumers (`components/admin/MonitoringDashboard.tsx`, the `ENDPOINTS` block in `components/ai/index.tsx`) are themselves dead code.

- [ ] 14. Write bug condition exploration tests for the Next.js layer
  - **Property 5: Bug Condition** - Removal Satisfies the Next.js Control Clauses
  - **CRITICAL**: These tests MUST FAIL on unfixed code
  - **GOAL**: confirm the layer has never executed, which is the evidence base for deleting rather than repairing it
  - **Scoped PBT Approach**: the defects are deterministic and structural, so scope to the concrete cases below rather than generating inputs
  - Cases, from the design's exploratory test plan:
    - Call `securityMiddleware()` with no `X-API-Key`. Assert a non-200 result. Expected failure: `validateApiKey` calls `res.status(401).json(...)` on a fake `res` that **returns** `{status, data}` instead of throwing, so the `catch` never runs and `NextResponse.next()` is always returned — making the `apiKeyResponse.status !== 200` check at line 88 unreachable. Requires stubbing `next/server`, since the dependency is absent, **which is itself the finding.**
    - Same for the rate-limit path (`middleware/security.ts:28`), which always returns status 200 at line 81
    - `hasAccess('/api/orders', 'delivery_partner')`. Assert a boolean. Expected failure: `TypeError` on `undefined.some` because `protectedRoutes['delivery_partner']` is `undefined`. Also assert `hasAccess('/api/orders', ADMIN)` is `true`. Expected failure: the ADMIN list omits `/api/orders` and `/api/products`.
    - `tsc --noEmit` over `pages/` and `middleware/`. Expected failure: unresolved `next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible`, plus the duplicate `NextRequest` import (value import line 1, type import line 2) and `RateLimiter` which `rate-limiter-flexible` does not export.
    - `curl -H 'Authorization: Bearer anything'` against each `pages/api/admin/monitoring/*` route. Assert 401. Expected failure: the only gate is `if (!req.headers.authorization)` — moot today because the module cannot load, which is the point.
    - `decrypt(...encrypt('secret'))` from `config/security.ts`. Assert equality. Expected failure: `Buffer.from(ENCRYPTION_KEY)` reads the 64-char hex string as utf8 → 64 bytes → `aes-256-gcm` rejects it → `createCipheriv` throws. Even if it did not, `encrypt()` returns no GCM auth tag and `decrypt()` never calls `setAuthTag()`.
  - Run on UNFIXED code
  - **EXPECTED OUTCOME**: every test FAILS **at import time rather than at assertion time**, confirming the layer has never executed
  - **DECISION GATE**: if any of these tests *passes*, the layer is more alive than the investigation concluded and the deletion recommendation MUST be revisited with the user before task 16
  - Document the counterexamples
  - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 2.15_

- [ ] 15. Write preservation baseline for the Expo and EAS builds (BEFORE deleting anything)
  - **Property 2: Preservation** - Build and toolchain unchanged by removal
  - **IMPORTANT**: Follow observation-first methodology — capture the working build **before** deletion so a regression is attributable
  - Bug condition is FALSE here: the Expo app build is outside C2
  - Observe and record on the pre-deletion tree: `expo start` succeeds, `expo run:android` succeeds, an EAS build succeeds for **each** existing profile, and the `patch-package` postinstall step runs
  - Also record whether `expo start --web` works today and whether anything in `webpack.config.js` is Expo-related, since task 16 has to decide between editing and deleting that file
  - Record the `npm run typecheck` error set from task 1 as the comparison point
  - **EXPECTED OUTCOME**: Baselines captured and PASSING on the pre-deletion tree
  - _Requirements: 3.12_

- [ ] 16. Delete the dead Next.js layer

  - [ ] 16.1 Preserve the two things worth keeping, then delete
    - **Before deleting**: copy the `securityHeaders` and `corsOptions` objects out of `config/security.ts` into the design record. They are correct, dependency-free, and the only part of the layer worth keeping. The design already records what a future rebuild would need, including the note that Next middleware must be written as `(request) => NextResponse` rather than as an Express handler behind a stub — that single decision is the Phase 2 root cause.
    - Delete `pages/` entirely (`api/admin/monitoring/{security,errors,performance,status}.ts`, `api/ai/chat.ts`)
    - Delete `middleware/` entirely (`security.ts`, `auth.ts`, and the rest of the directory)
    - Delete `config/security.ts`, `next.config.js`, `next-env.d.ts`
    - Delete `components/admin/MonitoringDashboard.tsx` — never imported, and its relative `fetch` URLs cannot resolve under React Native
    - Delete the `ENDPOINTS` block in `components/ai/index.tsx:226` that points at the removed routes. The app's AI paths call `services/azureAI/*` and `services/aiAgent/bedrockAIService` directly.
    - Edit `webpack.config.js` — remove only the Next-specific portions, leaving anything the Expo web target uses. If nothing in it is Expo-related, delete the file. Either way, confirm `expo start --web` still behaves as captured in task 15.
    - Edit `tsconfig.json` — now complete what task 1 deferred: drop `next-env.d.ts` and `.next/types/**/*.ts` from `include`, drop the `{"name": "next"}` plugin, and narrow `include` to what the app actually ships (`app`, `components`, `services`, `hooks`, `store`, `contexts`, `providers`, `utils`, `lib`, `config`, `constants`, `types`, `theme`, `navigator`)
    - Remove the now-unused `EXPO_PUBLIC_API_BASE_URL` from `.env.example` — it appears exactly once in the repo and no source file reads it
    - **No `package.json` change**: the five missing dependencies (`next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible`) stay missing. That is the point.
    - _Bug_Condition: isBugCondition_C2(input) — wrapperAlwaysAllows OR layerCannotExecute OR gateIsPresenceOnly_
    - _Expected_Behavior: Property 5 — no file exists under `pages/**` or `middleware/**`, so there is no control that can report success while doing nothing and no unreachable rejection branch_
    - _Preservation: Preservation Requirement 3.12 (Metro, EAS and `patch-package` unaffected). Clauses 3.9 and 3.10 are conditioned on retention and become vacuous — stated explicitly, not silently dropped._
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 3.9, 3.10_

  - [ ] 16.2 Record which clauses are satisfied by removal
    - Clause 2.15 requires this to be stated explicitly rather than left implicit. Write it into the spec record:
    - 2.7 and 2.8 — no middleware remains to no-op
    - 2.9 — no monitoring endpoints remain
    - 2.10 through 2.14 — no `middleware/auth.ts` remains (hardcoded `'your-secret-key'` fallback, duplicate `NextRequest` import, non-existent `RateLimiter` class, throwing `hasAccess`, and `request.ip` keying all go with it)
    - 2.16 — `config/security.ts` deleted; its `encrypt`/`decrypt` exports had **zero** callers anywhere, so no retained code performs encryption
    - 2.17 — no AI chat endpoint remains; the app already calls its AI services directly
    - 3.9 and 3.10 — vacuous under removal
    - _Requirements: 2.15, 2.16, 2.17, 3.9, 3.10_

  - [ ] 16.3 Verify the Next.js exploration tests now pass
    - **Property 5: Expected Behavior** - Removal Satisfies the Next.js Control Clauses
    - **IMPORTANT**: Re-run the SAME tests from task 14 - do NOT write new tests. Each test inverts to an existence assertion.
    - Assert no file exists under `pages/**` or `middleware/**`, and that `config/security.ts`, `next.config.js`, `next-env.d.ts`, `components/admin/MonitoringDashboard.tsx` are gone
    - Assert no source file imports `next`, `jose`, `zod`, `ioredis` or `rate-limiter-flexible`
    - **EXPECTED OUTCOME**: Tests PASS
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17_

  - [ ] 16.4 Verify the build preservation baseline still passes
    - **Property 2: Preservation** - Build and toolchain unchanged by removal
    - **IMPORTANT**: Re-run the SAME checks from task 15 - do NOT write new ones
    - `expo start`, `expo run:android`, and an EAS build per existing profile must all still succeed, with `patch-package` postinstall intact
    - `npm run typecheck` must now be **cleaner** than the task 1 baseline, since the Next-related resolution errors are gone. Compare against that baseline explicitly.
    - **EXPECTED OUTCOME**: Tests PASS (no regressions)
    - _Requirements: 3.12_

- [ ] 17. Phase 2 checkpoint
  - Confirm tasks 14-16 complete, Property 5 tests passing, build baseline from task 15 re-verified
  - Confirm the `securityHeaders` / `corsOptions` preservation and the rebuild notes are recorded, so the deletion is not lossy
  - Run `npm run typecheck`, `npm run lint` (if task 26 has landed) and `npm test`
  - Ensure all tests pass. Ask the user if questions arise.
  - _Requirements: 2.15, 3.12_

---

### Phase 3 — hardening and hygiene (clauses 2.18, 2.19, 2.21, 2.22, 3.7, 3.8, 3.11)

- [ ] 18. Snapshot the live database grants and policies
  - **PREREQUISITE for tasks 20 and 21. Do not write the revoke migration before this is done.**
  - The `sql/` directory is loose scripts, not migrations, so which grants are actually present in the running database is **unknown from the tree**. Audit reality, not the files.
  - Run against the live database and save the output:
    - `SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');`
    - `SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr FROM pg_policy WHERE polrelid IN ('storage.objects'::regclass, 'public.profiles'::regclass);`
  - **Classify every row** as needed-pre-auth / not-needed / function-does-not-exist, applying the design's decision criterion: keep an `anon` grant only if some code path invokes the object **before** a Supabase session exists
  - The design already traced the live signup path and concluded it needs **no** `anon` grant: `login.tsx:180` calls `signInWithOtp` (GoTrue, no Postgres grant), `otp.tsx:186` calls `verifyOtp`, and profile creation at `otp.tsx:220-250` is a direct `INSERT` into `profiles` by the now-authenticated user. `createProfileSafely` (`create_profile_unified`) and `isNewPhoneNumber` are defined in that file but **never called**. All KYC screens run post-session. **Confirm this against the snapshot rather than assuming it.**
  - Read-only helpers such as `get_products_optimized` (`sql/optimize_product_queries.sql`) are a **separate question**: if the app browses the catalogue before login, their `anon` grant is legitimate and stays. Verify against the app's pre-login screens.
  - Save the classified snapshot in the repo — this is the per-file audit record clause 2.19 asks for
  - _Requirements: 2.19_

- [ ] 19. Write bug condition exploration test for anon privilege
  - **Property 6: Bug Condition** - Unnecessary anon privilege is exercisable
  - **CRITICAL**: This test is expected to FAIL on the unfixed database
  - **Scoped PBT Approach**: scope to the objects the task 18 snapshot actually showed as granted to `anon` — the design notes this test *may* pass or fail depending on which `sql/` scripts were really applied, which is exactly why the snapshot comes first
  - Bug condition under test, from `isBugCondition_C3`: `kind == 'db_grant' AND grantedTo(anon) AND NOT requiredByPreAuthFlow` OR `kind == 'storage_policy' AND admitsRole('anon')`
  - With the anon key only (no session), call `rpc('create_profile_unified', ...)` and each other profile-mutating function the snapshot flagged. Assert denial.
  - With the anon key only, attempt an upload to `product-images`, `shop-images`, `profiles` and `id-verification`. Assert denial. Expected failure: the write policies admit `auth.role() IN ('authenticated','anon','service_role')`.
  - Confirm the blanket `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy on `profiles` (`sql/simple_profile_policies.sql:54-58`) exists in the snapshot
  - Run on the UNFIXED database
  - **EXPECTED OUTCOME**: assertions FAIL for whatever subset is actually granted, confirming which grants are exercisable
  - Document the counterexamples, mapped to the snapshot rows
  - _Requirements: 1.19, 2.19_

- [ ] 20. Write preservation property tests for signup, KYC and uploads (BEFORE the revoke migration)
  - **Property 6: Preservation** - Signup, KYC and Authenticated Uploads Survive the Grant Audit
  - **IMPORTANT**: Follow observation-first methodology, and run this on a **branch database** before touching production
  - Bug condition is FALSE for every input here: these are authenticated flows
  - Observe on the UNFIXED database, then encode as property-based tests:
    - Full retailer signup and full seller signup complete and create a profile, including the Firebase-auth linkage path. Covers 3.7
    - Each KYC path succeeds: `retailer-kyc.tsx`, `seller-kyc.tsx`, `wholesaler-kyc.tsx`, `kyc.tsx`. Covers 3.7
    - One upload per bucket by an authenticated user into their **own** folder succeeds: `product-images`, `shop-images`, `profiles`, `id-verification`. Covers 3.8
    - **Property 6 generator**: generate storage paths varying the owner prefix, and assert an authenticated user writes only under their own `auth.uid()` folder while an anon caller writes nothing. Before the fix, capture what the current policies actually admit.
    - Existing **read** policies on the affected buckets are unchanged — capture them for comparison
  - Run tests on the UNFIXED database
  - **EXPECTED OUTCOME**: the authenticated-flow tests PASS (baseline to preserve); the owner-prefix restriction does not hold yet, which is the task 21 target
  - _Requirements: 3.7, 3.8_

- [ ] 21. Tighten Supabase grants and storage policies

  - [ ] 21.1 Write the revoke migration
    - **Depends on the task 18 snapshot.** Write one revoke migration grouped by the classification from that snapshot, **with a comment per line recording which criterion each grant failed**. That per-line record is what clause 2.19 asks for.
    - Revoke `anon` EXECUTE from every profile-mutating function that failed the pre-auth criterion, including those from clause 1.19: `create_profile_unified*`, `handle_firebase_auth`, `link_firebase_to_profile`, `create_user_with_profile`, `fix_profile_creation`, `create_profile_safely`, `create_profile_with_existing_auth_id`, `check_and_fix_status`, `fixed_update_retailer_profile`, `reset_business_details_structure`, `fix_overrides`
    - **Retain** `anon` only where the snapshot proved a pre-auth caller exists (e.g. catalogue-browsing read helpers, if the pre-login screens confirm it) — and record why each retained grant was kept
    - Scope the storage write policies: in `sql/create_product_images_bucket.sql:23`, `sql/create_shop_images_bucket.sql:21`, `sql/create_profiles_bucket.sql` (eight occurrences) and `sql/create_id_verification_bucket.sql:23`, replace `auth.role() IN ('authenticated','anon','service_role')` on **write** operations with `auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text`. **Leave the read policies as they are.**
    - Drop the blanket `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy on `profiles` (`sql/simple_profile_policies.sql:54-58`) — `service_role` bypasses RLS anyway, so the policy grants nothing and only obscures the real ones
    - Review the `"Allow public insert of profiles"` policy at `sql/simple_profile_policies.sql:47` against the same criterion and record the decision
    - _Bug_Condition: isBugCondition_C3(artifact) for `db_grant` and `storage_policy` kinds_
    - _Expected_Behavior: Property 6 — anon-only callers are denied profile mutation and storage writes; authenticated users write only under their own folder_
    - _Preservation: Preservation Requirements 3.7 (signup and KYC still create profiles, including the Firebase path) and 3.8 (authenticated own-folder uploads still succeed)_
    - _Requirements: 2.19_

  - [ ] 21.2 Verify the anon-privilege exploration test now passes
    - **Property 6: Expected Behavior** - Unnecessary anon privilege revoked
    - **IMPORTANT**: Re-run the SAME test from task 19 - do NOT write a new test
    - Anon-only calls to every revoked function must now be denied; anon-only uploads to all four buckets must be denied
    - Re-run the task 18 snapshot queries and diff against the original, confirming only the justified grants remain
    - **EXPECTED OUTCOME**: Tests PASS
    - _Requirements: 2.19_

  - [ ] 21.3 Verify the signup, KYC and upload preservation tests still pass
    - **Property 6: Preservation** - Signup, KYC and Authenticated Uploads Survive the Grant Audit
    - **IMPORTANT**: Re-run the SAME tests from task 20 - do NOT write new tests
    - **Run on the branch database before applying to production**, per the design's step 6: full signup for retailer and seller, each KYC path, and one upload per bucket
    - Run the design's integration test: signup → KYC → first order, for both retailer and seller, after the revokes
    - Confirm read policies on the affected buckets are unchanged
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.7, 3.8_

- [ ] 22. Move third-party configuration out of source

  - [ ] 22.1 Source third-party config from app.config.js extra
    - `constants/config.ts` — replace the hardcoded `SUPABASE_CONFIG`, `FIREBASE_CONFIG` (including `apiKey` at line 11) and `GOOGLE_MAPS_API_KEY` (line 20) literals with reads from `Constants.expoConfig.extra`, wired through `app.config.js`
    - `app.config.js:258` — remove the `"AIzaSyA"` stub `firebaseApiKey` fallback
    - The Supabase anon key and Firebase web config stay client-visible — they are designed to be — but sourcing them from config makes them rotatable, which is what the clause asks for
    - `.env.example` — add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
    - _Bug_Condition: isBugCondition_C3(artifact) where `kind == 'committed_file' AND containsCredential(artifact)` — the Google Maps key is the billing-abuse risk; hardcoding blocks rotation of all three_
    - _Expected_Behavior: values sourced from environment via `extra` with no secret fallbacks (clause 2.18)_
    - _Preservation: Preservation Requirement 3.11 (maps, geocoding and place lookups keep working)_
    - _Requirements: 2.18_

  - [ ] 22.2 Verify maps functionality is preserved
    - **Property 2: Preservation** - Maps after key relocation
    - Observe map render, geocoding and place lookup **before** the change, then assert identical behavior after
    - **EXPECTED OUTCOME**: Tests PASS
    - _Requirements: 3.11_

- [ ] 23. HUMAN CHECKPOINT — Restrict the Google Maps API key in Google Cloud
  - **REQUIRES A HUMAN OPERATOR. This is not a code task and cannot be completed by editing files.**
  - In the Google Cloud console, on the Maps key:
    - Application restriction: Android apps, package `com.sixn8.dukaaon`, plus the release signing SHA-1
    - API restriction: allowlist only the Maps / Geocoding / Places APIs actually used
  - Acceptance: a copied key must be useless elsewhere. Verify by attempting a call with the key from an unrestricted context and confirming rejection.
  - Task 22.1 moves the key to configuration; **only this task removes the billing liability**
  - Confirm the app's own maps, geocoding and place lookups still work after restriction (clause 3.11) using the app's real package name and signing certificate
  - _Requirements: 2.18, 3.11_

- [ ] 24. HUMAN CHECKPOINT — Rotate the Supabase service-role key
  - **REQUIRES A HUMAN OPERATOR. This is not a code task.**
  - The service-role JWT is committed in `test_profile_creation_fix.js` and `update_database_function.js`, and therefore exists in git history. Same reasoning as the Razorpay secret: deleting the files does not remove the key from history, so **rotation is the only real remediation.**
  - Rotate the service-role key in the Supabase dashboard
  - After rotation, re-confirm task 8: `verify-razorpay-payment` still has a working `SUPABASE_SERVICE_ROLE_KEY` for its `mark_order_paid` call, or Phase 1's paid transition breaks
  - Record confirmation before marking complete
  - _Requirements: 2.21_

- [ ] 25. Clean up committed credentials and build artifacts
  - Delete `debug_customers.js` and `debug_master_products.js` — one-off diagnostics carrying a stale project URL and key
  - Delete `test_profile_creation_fix.js` and `update_database_function.js` — embedded `service_role` JWT. If either is still wanted, rewrite it to read `SUPABASE_SERVICE_ROLE_KEY` from the environment and exit non-zero when absent. **Either way task 24 is still required.**
  - `git rm --cached` the ~30 tracked `.txt` dumps and logs: `build_log*.txt`, `gradle_build_log*.txt`, `build-error*.txt`, `autolinking*.txt`, `*_manifest.txt`, `eas-build-report.txt`, `exclusion-test-report.txt`, `expo-doctor-output.txt`, `settings-*.txt`, `rn-config.txt`, `android/build_*.txt`
  - Add `.gitignore` patterns for `build_log*.txt`, `gradle_build_log*.txt`, `build-error*.txt`, `*_manifest.txt` — `.gitignore` already covers `*.log` but nothing covering these
  - `components/admin/WhatsAppDashboard.tsx` — the component is never imported anywhere, so **delete it** alongside `MonitoringDashboard` (task 16.1). If it is being kept for future use instead: change lines 19-21 from `REACT_NATIVE_SUPABASE_URL` / `REACT_NATIVE_SUPABASE_ANON_KEY` to `EXPO_PUBLIC_`-prefixed names (Expo inlines `EXPO_PUBLIC_*` only, which is why both are currently `undefined`), document both in `.env.example`, drop the `|| ''`, and throw on absence rather than constructing `createClient('', '')` at module scope. Better still, import the app's existing `services/supabase/supabase` client rather than making a second one.
  - Verify no embedded Supabase service-role JWT or project credential remains in any root-level script
  - _Bug_Condition: isBugCondition_C3(artifact) where `kind == 'committed_file' AND containsCredential(artifact)`_
  - _Expected_Behavior: clause 2.21 — no embedded credentials in root scripts, logs and dumps removed and gitignored, `WhatsAppDashboard` either gone or reading a documented `EXPO_PUBLIC_` variable and failing loudly_
  - _Preservation: Preservation Requirement 3.12 (build unaffected by removing untracked-artifact noise)_
  - _Requirements: 2.21_

- [ ] 26. Complete the verification gate
  - Task 1 established `npm ci`, `test`, `test:watch` and `typecheck`. This task finishes clause 2.22.
  - Add `eslint` and `eslint-config-expo` to `devDependencies` at **pinned exact versions** — there is no ESLint config in the tree today, so this also means adding one
  - Add `"lint": "eslint . --ext .ts,.tsx,.js,.jsx --max-warnings=0"` to `package.json`
  - Confirm the `tsconfig.json` `include`/`exclude` from task 16.1 is final, with `supabase/functions` excluded (Deno, `jsr:`/URL imports `tsc` cannot resolve — check those with `deno check` if at all) and `tests/**` excluded to keep the gate fast. Note that a `tsconfig.test.json` extending it is the path if test type-checking is wanted later.
  - Run `npm run typecheck` and either **fix** the remaining errors or record the pre-existing, unrelated ones in a short baseline note with the intent to burn it down. **Do not add `// @ts-nocheck` to make the gate green.**
  - Run `npm run lint` and resolve or baseline the output the same way
  - Confirm all four commands terminate on their own with a verdict
  - _Bug_Condition: isBugCondition_C3(artifact) where `kind == 'verify_script' AND NOT terminates(artifact)`_
  - _Expected_Behavior: clause 2.22 — non-watch `test`, plus `typecheck` and `lint`, each terminating on its own_
  - _Requirements: 2.22_

- [ ] 27. Checkpoint - Ensure all tests pass
  - Run the clause 2.22 acceptance test **in a clean checkout**, because the absent `node_modules` is what produced the original hang: `npm ci && npm run typecheck && npm run lint && npm test` — all four must terminate with a verdict
  - Confirm every property is in its final state: Property 1 PASSES, Property 2 PASSES, Property 3 PASSES, Property 4 PASSES, Property 5 PASSES, Property 6 PASSES
  - Confirm every human checkpoint is done and recorded: task 7 (Razorpay key rotated), task 8 (Edge Function secrets), task 13.1 (`pg_cron` enabled and job scheduled), task 23 (Maps key restricted), task 24 (service-role key rotated)
  - Confirm the audit and snapshot records exist: task 10 (live schema and the `'not_paid'` decision), task 18 (classified grant snapshot), task 16.2 (clauses satisfied by removal), task 21.1 (per-line revoke justification)
  - Re-run the full Phase 1 and Phase 3 integration suites on a branch database, plus the post-deletion build set (`expo start`, `expo run:android`, EAS per profile)
  - Record the two known residual gaps so they are not mistaken for oversights: no Razorpay webhook reconciliation consumer, and the pre-existing `status: 'placed'` / `payment_status: 'not_paid'` migration drift (unless task 10 resolved it)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13_
---

## Notes

Known residual gaps, recorded here so they are not mistaken for oversights:

- No Razorpay webhook consumer for "payment captured but the app never verified". It is the correct long-term reconciliation path, but it is new function rather than a fix, and the requirements do not ask for it. Recorded against task 11.3.
- Pre-existing migration drift: `checkout/index.tsx` writes `status: 'placed'` and `services/aiOrderPlacement.ts` writes `payment_status: 'not_paid'`, neither of which appears in the committed `CHECK` constraint lists. Out of scope to fix; task 10 records what the live schema actually is and decides the `'not_paid'` handling.

Human actions in this plan. None of these can be completed by editing files, and each blocks the phase it sits in:

- Task 7 — rotate the leaked Razorpay key and disable the old pair. Clause 2.3 stays unmet until this is confirmed.
- Task 8 — set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as Supabase Edge Function secrets, and confirm `SUPABASE_SERVICE_ROLE_KEY` is reachable by `verify-razorpay-payment`.
- Task 13.1 — confirm `pg_cron` is enabled and the revised cleanup job is actually scheduled.
- Task 23 — restrict the Google Maps API key in Google Cloud by Android package, release signing SHA-1, and API allowlist.
- Task 24 — rotate the Supabase service-role key, then re-confirm task 8.
