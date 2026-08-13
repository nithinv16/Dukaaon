# Critical Security and Error Fixes — Bugfix Design

## Overview

Three clusters of defects, three root causes, three independently shippable phases.

**Phase 1 — the client is trusted for both credentials and payment state.** The live Razorpay key secret is compiled into the shipped binary because every config layer (`app.config.js`, `config/razorpay.ts`, `config/secrets.ts`) carries it as a hardcoded fallback, and the checkout callback writes `payment_status: 'paid'` from the device before any signature check runs. The verification edge function exists and computes the HMAC correctly, but it is invoked *after* the paid write and its verdict is only `console.warn`'d. The fix inverts the sequence: the client creates a pending order, invokes verification, and reads back the state the server decided. The edge function becomes the only writer of paid status, enforced at the database level so the change cannot be undone by a future client.

**Phase 2 — Express middleware wrapped in Next.js edge handlers, in a layer whose dependencies were never installed.** `middleware/security.ts` calls Express-style `(req, res, next)` handlers from `config/security.ts` with a fake `res` whose `status().json()` returns an object instead of throwing, so the `catch` block never runs and every request returns `NextResponse.next()`. Separately `next`, `jose`, `zod`, `ioredis` and `rate-limiter-flexible` are absent from `package.json`, so nothing in `pages/api/**` or `middleware/**` can compile, let alone execute. Investigation (below) found no deployment target and no live consumer. The recommendation is deletion, and Phase 2 is designed as removal.

**Phase 3 — hardening and hygiene.** Broken AES-GCM helpers, an unauthenticated AI endpoint, hardcoded third-party keys, `anon` grants inherited from a signup flow the app no longer uses, committed service-role JWTs and build logs, and no type-check or lint gate. Several of these are satisfied by the Phase 2 deletion; the rest are small, independent edits.

Three items cannot be fixed by code and are called out explicitly in [Human Actions](#human-actions-outside-the-codebase): Razorpay key rotation, Google Cloud API key restriction, and Supabase secret configuration.

## Glossary

- **Bug_Condition (C)** — the set of inputs that trigger a defect. For Phase 1 the dominant condition is "an online payment callback reaches the client", because on every such input the client writes authoritative payment state it has no authority to write. For Phase 2 it is "any request reaches a security control in the Next.js layer", because every such input is reported as allowed regardless of its contents.
- **Property (P)** — the behavior the fixed system must exhibit for inputs satisfying C. Phase 1: paid state exists only where a server-verified HMAC exists. Phase 2: a control that cannot execute does not exist in the tree claiming to protect anything.
- **Preservation** — behavior that must be byte-for-byte unchanged for inputs *outside* C: cash-on-delivery checkout, the multi-seller master-order split, the RN Razorpay sheet initialization (which needs `keyId` only), seller and buyer reads on `orders` / `master_orders` / `payment_transactions`, signup and KYC profile creation, authenticated storage uploads, and the Expo/EAS build.
- **Paid transition** — the single write that moves an order from `payment_status = 'pending'` to `'paid'`. After this change it originates in exactly one place: `mark_order_paid()`, called by `verify-razorpay-payment`.
- **`verify-razorpay-payment`** — the Deno edge function at `supabase/functions/verify-razorpay-payment/index.ts`. Today it verifies the HMAC and returns a verdict but writes nothing. It becomes the authoritative writer.
- **`razorpay-function`** — the edge function at `supabase/functions/razorpay-function/index.ts` that already creates Razorpay orders server-side using `RAZORPAY_KEY_SECRET` from Deno env. It is the existence proof that the client never needs the secret.
- **Dead Next.js layer** — `pages/api/**`, `middleware/**`, `config/security.ts`, `next.config.js`, `next-env.d.ts`, and the Next-specific portions of `webpack.config.js` and `tsconfig.json`.
- **`anon` / `authenticated` / `service_role`** — Supabase Postgres roles. `anon` is the role a request assumes when it carries only the publishable anon key and no user session.

## Bug Details

### Bug Condition

Three conditions, one per phase. Each is stated so a test can decide membership without reading the fix.

**C1 — client-authored payment state (Phase 1).** Holds when an online (non-COD) checkout produces a Razorpay callback. On every such input the client writes `payment_status: 'paid'` (`app/(main)/checkout/index.tsx` line 247 for multi-seller, line 321 for single-seller) and a `payment_transactions` row with `status: 'completed'`, then invokes verification and discards the result. It also holds for the degenerate case where no callback is genuine: a forged or replayed `{payment_id, order_id, signature}` triple yields a paid order, because `razorpayService.verifyPayment()` (`services/payment/razorpayService.ts` lines 439-480) returns `true` for any strings beginning `pay_` and `order_`.

```
FUNCTION isBugCondition_C1(input)
  INPUT:  input of type CheckoutAttempt
          { paymentMethod, razorpayCallback, signatureValidHmac }
  OUTPUT: boolean

  IF input.paymentMethod == 'cod' THEN RETURN false END IF
  IF input.razorpayCallback == NULL THEN RETURN false END IF

  // The bug: paid state is reachable without a server-verified signature,
  // and is written before verification is even attempted.
  RETURN paidStateWrittenByClient(input)
         AND (input.signatureValidHmac == false
              OR verificationVerdictIgnored(input))
END FUNCTION
```

**C2 — non-functional API control (Phase 2).** Holds for every request that reaches `securityMiddleware()`, and for every request to `pages/api/admin/monitoring/*` or `pages/api/ai/chat.ts`. The wrapper defect makes rejection unreachable; the missing dependencies make execution impossible.

```
FUNCTION isBugCondition_C2(input)
  INPUT:  input of type ApiRequest
  OUTPUT: boolean

  // (a) the wrapper cannot express failure
  wrapperAlwaysAllows :=
      controlInvokedWithFakeResponse(input)          // status().json() returns, never throws
      AND catchBlockUnreachable(input)               // so NextResponse.next() is always returned

  // (b) the module cannot load at all
  layerCannotExecute :=
      importsMissingDependency(input.module,
        ['next', 'jose', 'zod', 'ioredis', 'rate-limiter-flexible'])

  // (c) the auth gate checks presence, not validity
  gateIsPresenceOnly :=
      requiresHeader(input, 'authorization') AND NOT verifiesSignature(input)

  RETURN wrapperAlwaysAllows OR layerCannotExecute OR gateIsPresenceOnly
END FUNCTION
```

**C3 — privilege and hygiene defects (Phase 3).** Holds when a control is present but ineffective: an `anon` grant on a profile-mutating function that no pre-auth caller uses, a storage policy admitting `auth.role() = 'anon'`, an encryption helper that throws on first use, a committed service-role JWT, or a verification command that cannot terminate.

```
FUNCTION isBugCondition_C3(input)
  INPUT:  input of type RepoArtifact
  OUTPUT: boolean

  RETURN (input.kind == 'db_grant'      AND grantedTo(input, 'anon')
                                        AND NOT requiredByPreAuthFlow(input))
      OR (input.kind == 'storage_policy' AND admitsRole(input, 'anon'))
      OR (input.kind == 'crypto_helper'  AND roundTripFails(input))
      OR (input.kind == 'committed_file' AND containsCredential(input))
      OR (input.kind == 'verify_script'  AND NOT terminates(input))
END FUNCTION
```

### Examples

Phase 1:

- A buyer completes a genuine UPI payment. Order is written `paid` at `checkout/index.tsx:321` *before* `supabase.functions.invoke('verify-razorpay-payment')` is called. **Expected:** order created `pending`, verification runs, server flips it to `paid`, client reads `paid`. **Actual:** order is already `paid`; verification is decoration.
- An attacker with the leaked secret POSTs a self-signed callback, or replays a captured one. **Expected:** order stays `pending`, buyer sees a failure state. **Actual:** `razorpayService.verifyPayment()` accepts the prefixes, order is written `paid`, success modal shows.
- A multi-seller cart. `MasterOrderService.placeCompleteOrder` is called with `payment_status: 'paid'` in every per-seller order, then verification is invoked with `order_id: result.masterOrderId`. The edge function looks that id up in `orders` (line ~110), does not find it, and returns HTTP 404 — so **the multi-seller path's verification never succeeds even for genuine payments**, and the `console.warn` hides it.
- Someone unzips the APK and greps for `<ROTATED_KEY_SECRET_REDACTED>`. **Expected:** no match. **Actual:** four matches' worth of sources compiled in — `app.config.js:282`, `config/razorpay.ts:26`, `config/razorpay.ts:72` (`ENV_TEMPLATE`), `config/secrets.ts:50`.
- Edge case, must keep working: a COD order. No Razorpay call, `payment_status: 'pending'`, checkout completes (`checkout/index.tsx:136`).

Phase 2:

- `curl -H 'Authorization: Bearer anything' .../api/admin/monitoring/security` — **expected** 401, **actual** the handler's only gate is `if (!req.headers.authorization)`, so it would return security events. (Moot today: the module cannot load.)
- `securityMiddleware()` with no `X-API-Key` at all — **expected** 401, **actual** `validateApiKey` calls `res.status(401).json(...)`, the fake `res` returns `{status: 401, data: ...}` as a value, no throw, `catch` skipped, `NextResponse.next()` returned. `apiKeyResponse.status !== 200` at line 88 is therefore unreachable.
- `import './middleware/auth'` — **expected** compile, **actual** two failures before any logic: `NextRequest` imported twice (value import line 1, type import line 2), and `rate-limiter-flexible` exports no `RateLimiter` (the Redis class is `RateLimiterRedis`).
- `hasAccess('/api/orders', 'delivery_partner')` — **expected** `false`, **actual** `protectedRoutes['delivery_partner']` is `undefined` and `.some()` throws. And `hasAccess('/api/orders', ADMIN)` returns `false` because the ADMIN list omits `/api/orders` and `/api/products`.

Phase 3:

- `encrypt('x')` — **expected** ciphertext plus auth tag, **actual** `Buffer.from(ENCRYPTION_KEY)` reads the 64-char hex string as utf8 → 64 bytes → `aes-256-gcm` rejects it → `createCipheriv` throws. Even if it did not, `encrypt()` returns no auth tag and `decrypt()` never calls `setAuthTag()`.
- A pre-auth caller invokes `create_profile_unified` with only the anon key. **Expected:** denied. **Actual:** granted in `sql/fix-database-schema.sql`, `sql/direct_fix.sql`, `sql/fix_create_profile_unified_return.sql`.
- `npx tsc --noEmit` — **expected** a pass/fail verdict, **actual** hangs. Root cause found; see clause 2.22 below.
- Edge case, must keep working: an authenticated retailer uploads an ID document to `id-verification` under their own folder. Must still succeed after the `anon` clause is dropped from the policy.

## Expected Behavior

### Preservation Requirements

**Unchanged behaviors** (these are the regression surface, mapped to clauses 3.1-3.13):

- COD checkout creates the order `payment_status: 'pending'` and completes without touching Razorpay (3.1).
- A genuine verified payment still ends `paid`, still records a `payment_transactions` row, still shows the success confirmation — only the ordering and the writer change (3.2, 3.5).
- Multi-seller carts still split per seller under a master order via `MasterOrderService.placeCompleteOrder`, still tracked at master-order level (3.3).
- The RN Razorpay sheet still initializes from `keyId` alone (3.4). This is already true; `validateRazorpayConfig()` in `config/razorpay.ts` only requires `keyId`.
- The pending-order cleanup job still removes abandoned unpaid orders, and never touches an in-flight one (3.6).
- Signup and KYC still create profiles, including the Firebase-linkage path, after the grant audit (3.7).
- Authenticated users still upload their own product images, shop images, profile photos and ID documents (3.8).
- Google Maps, geocoding and place lookups still work after the key moves to config and is restricted (3.11).
- `expo start`, `expo run:android` and the existing EAS profiles still build, including `patch-package` postinstall (3.12).
- Seller and buyer **reads** on `orders`, `master_orders` and `payment_transactions` are entirely unaffected by the write restriction (3.13).

**Scope.** Everything outside C1/C2/C3 is untouched. Concretely: no change to product, cart, wishlist, delivery, credit, referral, or WhatsApp code paths; no change to any RLS `SELECT` policy; no change to the HMAC computation itself; no change to Metro, Babel or Gradle configuration beyond deleting files nothing references.

Clauses 3.9 and 3.10 are conditional in the requirements ("provided the Next.js layer is retained"). Under the recommended deletion they become vacuous, and that is stated explicitly rather than silently dropped.

## Hypothesized Root Cause

### Phase 1 — the client is treated as trusted

1. **Secret handling built for a server that does not exist on the device.** `config/razorpay.ts` and `config/secrets.ts` both expose `keySecret` alongside `keyId` with a comment saying it "should be kept secure and only used on the backend". The backend already exists as `razorpay-function`, which reads the secret from Deno env. The client field is vestigial — nothing in the app reads `razorpayConfig.keySecret`. Root cause: config was written before the edge functions, and never pruned.
2. **Fallbacks used as a build-convenience mechanism.** The `|| "rzp_live_..."` pattern in `app.config.js:281-282` makes a build succeed with no `.env`. It also guarantees the credential is in every artifact. Root cause: silent defaults chosen over loud failure.
3. **Verification bolted on after the write path was already shipped.** Both branches of `handlePaymentSuccess` write the order first, then `invoke('verify-razorpay-payment')` inside a `try` whose only failure handling is `console.warn`. The function returns HTTP 200 with `{verified: false}` for a bad signature, so even the HTTP status carries no signal to a careless caller. Root cause: verification treated as telemetry rather than as a gate.
4. **No database-level authority.** `orders.payment_status` and `master_orders.payment_status` have only `CHECK` constraints on the allowed *values*. Nothing constrains *who* may write which value. So even a correct client is one refactor away from regressing. Root cause: integrity expressed in application code, not in the schema.
5. **Aggravating factor — the multi-seller verification call is structurally broken.** It passes a `master_orders.id` to a function that queries `orders`. This has been silently 404ing.

### Phase 2 — Express middleware in edge handlers, in an uninstalled layer

1. **Two middleware idioms conflated.** `config/security.ts` exports Express handlers, `(req, res, next)`. Next.js edge middleware returns a `NextResponse`. `middleware/security.ts` bridges them by passing a hand-rolled `res` stub. The stub's `status(code).json(data)` *returns* `{status, data}` — it does not throw and does not short-circuit. The bridge assumed the Express convention of "calling `res.status().json()` ends the request", which is only true because Express owns the socket. Here nothing owns anything, so control falls through to `NextResponse.next()`. Every downstream check on `.status !== 200` is dead code.
2. **The layer was never installed.** `next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible` are all absent from `package.json` (verified against the current file). Consequence: none of these defects has ever been observable at runtime, which is exactly why they accumulated. `middleware/auth.ts` has a duplicate import and a wrong class name — both would be caught by the first compile that ever ran.
3. **Access control written as a lookup table with no default.** `protectedRoutes[userRole]` indexes an object keyed by three enum members. Any other role yields `undefined` and throws. The table also isn't a hierarchy, so ADMIN is not a superset of CUSTOMER and SELLER.
4. **Rate-limit key taken from a field Next.js stopped populating.** `request.ip` is used in both `middleware/security.ts:30` and `middleware/auth.ts:78`. Even where populated it reflects proxy-supplied headers.
5. **The real root cause of the cluster: an abandoned layer left in the tree.** See the investigation below.

### Phase 3

1. **Ephemeral encryption key.** `process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')` — the fallback makes the module import successfully and the cryptography useless. Same "silent default" pattern as Phase 1.
2. **Hex string treated as bytes.** `Buffer.from(hexString)` without `'hex'`. Classic encoding slip; the 64-byte result is rejected by `aes-256-gcm`.
3. **Grants accreted from abandoned signup implementations.** The `sql/` directory holds ~27 files granting profile-mutating functions to `anon`, each a successive attempt at profile creation. Tracing the live signup path (below) shows none of them is on it.
4. **`REACT_NATIVE_` prefix is not an Expo inlining prefix.** `components/admin/WhatsAppDashboard.tsx:19-21` reads `process.env.REACT_NATIVE_SUPABASE_URL` and `REACT_NATIVE_SUPABASE_ANON_KEY`; Expo inlines `EXPO_PUBLIC_*` only, so both are `undefined`, `|| ''` swallows it, and `createClient('', '')` is constructed at module scope.
5. **`npx tsc --noEmit` root cause — confirmed, and it is not the tsconfig scope.** `node_modules` is absent from the working tree, so `npx tsc` cannot resolve a local binary. It falls through to the npm registry, where the bare name `tsc` is an unrelated abandoned package, and blocks on an interactive prompt:

   ```
   Need to install the following packages:
   tsc@2.0.4
   Ok to proceed? (y)
   ```

   That prompt never receives input, which is the ten-minute "timeout". The tsconfig scope is a *separate, real* problem that would surface once deps are installed: `include` is `["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"]` with **no `exclude`**, so the program pulls in `next-env.d.ts` (references types from an uninstalled `next`), a `.next/types` glob that does not exist, the Deno edge functions under `supabase/functions/**` (URL and `jsr:` imports tsc cannot resolve), `tests/**`, and the two stray files under `DukaaOnWebsite/`. It also declares `"plugins": [{"name": "next"}]`. File count is not the issue — 423 `.ts`/`.tsx` files on disk, no nested `node_modules`.

### Investigation: is the Next.js layer consumed by anything? (clause 2.15)

Checked, in order:

| Question | Finding |
| --- | --- |
| Deploy config for a web target? | No `vercel.json`, no `.vercel/`, no `netlify.toml`, no Dockerfile, no `.github/workflows`. Nothing in `git ls-files` matches those names. |
| Is `next.config.js` or `webpack.config.js` referenced by any script or config? | No. A repo-wide search for `next.config`, `webpack.config`, `next build`, `next dev`, `next start` (all `.json`/`.js`/`.ts`/`.yml`/`.md`, excluding `node_modules` and the website directories) returns only the bugfix requirements document. `package.json` has no `build`, `dev`, `typecheck` or `lint` script at all — `start`/`android`/`ios`/`web` are all Expo. |
| Can it run? | No. `next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible` are all absent from `package.json`. |
| Does the mobile app call these routes? | No. `EXPO_PUBLIC_API_BASE_URL` appears exactly once in the repo — as a `http://localhost:3000` line in `.env.example`. No source file reads it. |
| Any consumer of `/api/admin/monitoring/*`? | `components/admin/MonitoringDashboard.tsx` fetches all four with **relative** URLs, which cannot resolve under React Native. And the component is never imported: nothing references `MonitoringDashboard` or `components/admin` outside its own file. |
| Any consumer of `/api/ai/chat`? | Only as a string in `AI_CONSTANTS.ENDPOINTS.CHAT` (`components/ai/index.tsx:226`), which no code reads. The app's AI paths call `services/azureAI/*` and `services/aiAgent/bedrockAIService` directly. |
| Does anything else import `config/security.ts`? | One importer: `middleware/security.ts`. Its `encrypt`/`decrypt` exports have **zero** callers anywhere. |

**Recommendation: delete.** The layer has no deployment target, no build command, no installed dependencies, and no reachable caller. Both apparent consumers are themselves dead code. Retaining it would mean adding five dependencies and writing real auth, rate limiting and RBAC for endpoints nobody calls — cost with no delivered function, and it would keep the false-confidence problem alive in the meantime. Phase 2 is therefore designed as removal.

**If the web API is revived later, this is what would need rebuilding** (recorded so the deletion is not lossy):

- Four monitoring read endpoints (`security`, `errors`, `performance`, `status`) with real bearer verification and an admin-role claim check.
- An AI chat endpoint deriving `userId` from a verified token, with per-user rate limiting.
- Auth middleware: JWT verification against a required secret, a deny-by-default route/role table where admin is a superset, and a rate limiter keyed on the authenticated subject with a validated proxy-header fallback.
- Security headers and CORS. These are the only parts of `config/security.ts` worth keeping verbatim — the `securityHeaders` and `corsOptions` objects are correct and dependency-free. Copy them into the design record before deleting, or reintroduce them from scratch.
- Note for whoever rebuilds: write Next middleware as `(request) => NextResponse`, not as an Express handler behind a stub. That single decision is the Phase 2 root cause.

## Correctness Properties

Property 1: Bug Condition - Paid State Requires Server-Verified Signature

_For any_ checkout input where the bug condition holds (`isBugCondition_C1` returns true) — that is, any online payment attempt, genuine, forged or replayed — the fixed system SHALL create the order with `payment_status = 'pending'`, SHALL NOT write `'paid'` from the client, and SHALL end with `payment_status = 'paid'` if and only if `verify-razorpay-payment` recomputed a matching HMAC over `razorpay_order_id|razorpay_payment_id` and performed the transition itself. When verification fails or errors, the order SHALL remain `pending` and the buyer SHALL see a failure state, not the success modal.

**Validates: Requirements 2.4, 2.5, 2.6, 2.20**

Property 2: Preservation - Non-Payment Inputs and Existing Reads Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition_C1` returns false) — COD checkouts, cart and product operations, seller order-status updates, and all reads by buyers and sellers — the fixed system SHALL produce the same result as the original, preserving COD pending-order creation, the multi-seller master-order split, `payment_transactions` recording for verified payments, Razorpay sheet initialization from `keyId` alone, and every existing `SELECT` on `orders`, `master_orders` and `payment_transactions`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.13**

Property 3: Bug Condition - No Razorpay Secret in Any Build Artifact

_For any_ build profile, and _for any_ combination of set and unset `EXPO_PUBLIC_RAZORPAY_*` environment variables, the fixed system SHALL contain no Razorpay key secret in the bundle, and SHALL fail the build loudly when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is absent rather than substituting a credential.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 4: Bug Condition - Cleanup Never Deletes an In-Flight or Paid Order

_For any_ order row, the cleanup job SHALL delete it only if it is an online-payment order still `pending` whose payment was initiated more than the grace window ago; _for any_ order that is `paid`, COD, or within the grace window, the job SHALL leave it untouched. The paid transition and the clearing of the in-flight marker SHALL occur in one statement, so no interleaving of cleanup and verification can delete a paid order.

**Validates: Requirements 2.5, 3.6**

Property 5: Bug Condition - Removal Satisfies the Next.js Control Clauses

_For any_ path under `pages/api/**` or `middleware/**`, the fixed repo SHALL contain no file, so there is no control that can report success while doing nothing, and no unreachable rejection branch. The Expo and EAS builds SHALL continue to succeed after removal.

**Validates: Requirements 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 3.12**

Property 6: Preservation - Signup, KYC and Authenticated Uploads Survive the Grant Audit

_For any_ authenticated user, profile creation during signup and KYC, and storage uploads to their own folder in `product-images`, `shop-images`, `profiles` and `id-verification`, SHALL continue to succeed after every unnecessary `anon` grant is revoked and storage write policies are scoped to `authenticated` within an owner-prefixed path. _For any_ caller holding only the anon key, profile-mutating functions and storage writes SHALL be denied.

**Validates: Requirements 2.19, 3.7, 3.8**

## Fix Implementation

### Phase 1 — credential leak and payment integrity

#### 1a. Remove the secret from the client (clauses 2.1, 2.2, 2.3)

**File: `app.config.js`** — delete the `EXPO_PUBLIC_RAZORPAY_KEY_SECRET` entry at line 282. Change line 281 to `process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID` with no `||` fallback. Add a guard at the top of the config export that throws when it is missing, so the failure is a build failure and not a runtime surprise.

**File: `config/razorpay.ts`** — remove the `keySecret` constant (line 26) and the `keySecret` field from the exported `razorpayConfig`. Remove the hardcoded `keyId` fallback (line 26). Replace the two live values inside `ENV_TEMPLATE` (line 72) with `rzp_test_xxxxxxxxxxxx` and a `# set in Supabase secrets, never here` comment for the secret. Keep `validateRazorpayConfig()` as-is; it already requires only `keyId`.

**File: `config/secrets.ts`** — remove the `keySecret` field and the `keyId` fallback from `razorpayConfig` (lines 49-51). While in this file, drop the hardcoded Supabase URL and anon key fallbacks (lines 28-29) per clause 2.18; sourcing them from `extra` keeps them rotatable even though they are publishable.

**Files: `docs/RAZORPAY_FIX_CACHE.md` (line ~65), `docs/guides/RAZORPAY_INTEGRATION.md` (line ~185)** — replace both live values with placeholders.

Verification: grep the built bundle for `<ROTATED_KEY_SECRET_REDACTED>` and for `rzp_live_` and expect zero matches for the secret.

#### 1b. The new checkout sequence (clauses 2.4, 2.5)

Both branches of `handlePaymentSuccess` in `app/(main)/checkout/index.tsx` collapse to the same five steps. The client never writes `paid` and never decides anything.

```
1. CREATE PENDING ORDER
   single-seller:  INSERT orders { payment_status: 'pending',
                                   payment_initiated_at: now() }
   multi-seller:   MasterOrderService.placeCompleteOrder(...) with every
                   per-seller order at payment_status 'pending' and the
                   master order at 'pending'; set payment_initiated_at on
                   both master and child rows.
   No payment_transactions row is written here.

2. OPEN THE RAZORPAY SHEET (unchanged; keyId only)
   On callback, do not persist anything.

3. INVOKE VERIFICATION — the only authority
   supabase.functions.invoke('verify-razorpay-payment', { body: {
       razorpay_payment_id, razorpay_order_id, razorpay_signature,
       order_id:        <orders.id>       or NULL,
       master_order_id: <master_orders.id> or NULL
   }})

4. SERVER-SIDE TRANSITION (inside the edge function)
   recompute HMAC; if mismatch -> respond 400 {verified:false}, write nothing
   if match -> call mark_order_paid(...) as service_role, which in ONE
               statement sets payment_status='paid', clears
               payment_initiated_at, and inserts the payment_transactions
               row with status 'completed'

5. CLIENT READS BACK THE VERIFIED STATE
   if response.verified !== true  -> setError(...), no success modal,
                                     do not clear cart, offer retry
   else                           -> re-SELECT the order, assert
                                     payment_status === 'paid',
                                     then clearCart() + success modal
```

Two things change in the client beyond the ordering. `payment_status: 'paid'` is deleted from both the `ordersBySeller` construction (line 247) and the single-seller `INSERT` (line 321). The `console.warn`-only handling at lines 290-291 and 370-371 becomes the failure branch: `setError`, `setShowPaymentProcessor(false)`, no `clearCart()`, no `setSuccessModalVisible(true)`. The cart is deliberately preserved on verification failure so the buyer can retry without rebuilding it.

**Failure and rollback paths.** The order already exists when verification runs, so every failure mode has to be answered:

| Failure | Behavior | Why not delete the order |
| --- | --- | --- |
| HMAC mismatch (forged or replayed) | Order stays `pending`, `payment_initiated_at` set. Buyer sees "payment could not be verified". | The row is evidence. Cleanup reclaims it after the grace window. |
| Edge function returns 5xx, or the invoke throws, or the device loses connectivity after the callback | Order stays `pending`. Buyer sees "verification pending — do not pay again", with a retry that re-invokes verification using the same triple. | Deleting risks discarding a genuinely captured payment. Verification is idempotent, so retry is safe. |
| App killed between callback and verification | Order stays `pending` and is cleaned up after the grace window. A genuine capture is then a Razorpay-side reconciliation, surfaced by the webhook follow-up noted below. | Same. |
| `mark_order_paid` itself fails | Function responds `verified: false` with a distinct code; order stays `pending`; retry is safe. | Same. |

Deliberately **not** in scope: a Razorpay webhook consumer for the "payment captured but app never verified" case. It is the correct long-term reconciliation path, but it is new function rather than a fix, and the requirements do not ask for it. Recorded here as a known residual gap.

**Idempotency.** `mark_order_paid` is written so a second call with the same `razorpay_payment_id` on an already-`paid` order is a no-op returning success. This makes retry safe and makes a replayed genuine callback harmless.

#### 1c. The edge function becomes the only writer (clauses 2.5, 2.20)

**File: `supabase/functions/verify-razorpay-payment/index.ts`**

1. Keep the existing HMAC block (lines 90-110) exactly as it is — clause 3.5 requires it unchanged.
2. Keep the anon-key client built from the caller's `Authorization` header, and keep using it for the *ownership* check. This is what makes "the order belongs to this user" enforceable under RLS.
3. Fix the ownership check to handle both shapes. Accept `order_id` **or** `master_order_id` and look the value up in the matching table. This closes the multi-seller 404 described in the examples above.
4. Add a **second** client built from `SUPABASE_SERVICE_ROLE_KEY` (from Deno env), used for exactly one call: `rpc('mark_order_paid', {...})`. Nothing else in the function uses it.
5. On signature mismatch, return HTTP **400** rather than the current 200 with `{verified: false}`, so a careless caller cannot mistake it for success. Keep `verified: false` in the body for callers that read it.
6. Register the function in `supabase/config.toml` with `verify_jwt = true`. It is currently absent from that file and relies on the platform default; making it explicit prevents an accidental flip to public.

The RPC, not the function, is the enforcement point — an attacker who somehow reaches the DB with user credentials still cannot write `paid`.

```sql
-- supabase/migrations/<ts>_enforce_payment_status_authority.sql

-- 1. In-flight marker. Nullable, so existing rows are unaffected.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ;
ALTER TABLE public.master_orders
  ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ;

-- 2. The only writer of paid status.
CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id           UUID,
  p_master_order_id    UUID,
  p_razorpay_payment_id TEXT,
  p_amount             NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_already BOOLEAN;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT payment_status = 'paid' INTO v_already FROM orders WHERE id = p_order_id;
    IF v_already THEN RETURN jsonb_build_object('ok', true, 'idempotent', true); END IF;

    UPDATE orders
       SET payment_status = 'paid',
           payment_initiated_at = NULL,   -- same statement: leaves cleanup scope atomically
           updated_at = NOW()
     WHERE id = p_order_id;

    INSERT INTO payment_transactions (order_id, amount, status, transaction_id, payment_method)
    VALUES (p_order_id, p_amount, 'completed', p_razorpay_payment_id, 'razorpay')
    ON CONFLICT (transaction_id) DO NOTHING;   -- add the unique index if absent
  END IF;

  IF p_master_order_id IS NOT NULL THEN
    UPDATE master_orders
       SET payment_status = 'paid', payment_initiated_at = NULL, updated_at = NOW()
     WHERE id = p_master_order_id;
    UPDATE orders
       SET payment_status = 'paid', payment_initiated_at = NULL, updated_at = NOW()
     WHERE master_order_id = p_master_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', false);
END $$;

REVOKE ALL   ON FUNCTION public.mark_order_paid(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(UUID, UUID, TEXT, NUMERIC) TO service_role;

-- 3. The gate. Trigger, not RLS, not column grants — see rationale below.
CREATE OR REPLACE FUNCTION public.enforce_payment_status_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_privileged BOOLEAN := current_user IN ('postgres', 'supabase_admin', 'service_role');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IS DISTINCT FROM 'pending' AND NOT v_privileged THEN
      RAISE EXCEPTION 'payment_status must be created as pending (got %)', NEW.payment_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NOT v_privileged THEN
    RAISE EXCEPTION 'payment_status may only be changed by verified server-side payment processing'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_payment_status_authority
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_status_authority();

CREATE TRIGGER trg_master_orders_payment_status_authority
  BEFORE INSERT OR UPDATE ON public.master_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_status_authority();
```

**Why a trigger and not RLS or column grants** (clause 2.20 asks for the concrete mechanism, clause 3.13 constrains it):

- **RLS `WITH CHECK`** cannot express "you may update every column except this one". A policy tight enough to block the paid transition would have to restate the whole allowed-update surface, and it would have to be duplicated across the several existing `UPDATE` policies on `orders`. High regression risk on seller flows.
- **Column-level privileges** (`REVOKE UPDATE (payment_status) ... FROM authenticated`) handle `UPDATE` correctly but break `INSERT`: revoking `INSERT (payment_status)` fails *any* insert naming the column, including the COD path that legitimately sets `'pending'` at `checkout/index.tsx:136`. That violates clause 3.1.
- **A trigger** discriminates on both operation and value, which is exactly the required predicate: clients may create `pending`, only privileged callers may write anything else. `SECURITY DEFINER` on `mark_order_paid` makes `current_user` the function owner inside the trigger, so the authorized path passes without a session variable or magic flag.

**Confirmed not to break existing reads or seller writes (clause 3.13).** The trigger fires on `INSERT`/`UPDATE` only; no `SELECT` policy is added, altered or dropped, so buyer and seller reads are bit-identical. A repo-wide search for app-side `payment_status` writes finds only: the COD insert (`'pending'`, allowed), the two online inserts being changed to `'pending'` (allowed), an `orders/index.tsx` insert at `'pending'` (allowed), and `services/aiOrderPlacement.ts` — see the migration-drift note below. **No app code performs an `UPDATE` on `payment_status`**, so no seller status-transition flow is affected. The wholesaler order screens only read the column.

**Migration-drift risk to check against the live schema before applying.** The committed migrations and the running database appear to have diverged, and two facts should be confirmed against production first: `checkout/index.tsx` inserts `status: 'placed'`, which is not in the `orders_status_check` list from `20251003112500`; and `services/aiOrderPlacement.ts:65` writes `payment_status: 'not_paid'`, which is not in the `payment_status` `CHECK` list from `20250105000000`. Both would already be failing if the live constraints matched the migrations. This is pre-existing and out of scope, but the new trigger must be tested against the *live* schema, not the reconstructed one, and `'not_paid'` needs a decision (normalize to `'pending'`, or add it to the privileged-value set) before the trigger goes in.

#### 1d. Remove the fake client-side verification (clause 2.6)

**File: `services/payment/razorpayService.ts`** — delete `verifyPayment()` (lines 439-480) outright. A method that must never be trusted is better absent than present-and-throwing.

**File: `components/payment/PaymentProcessor.tsx`** — remove the `verifyPayment` call and the `if (isVerified)` gate at lines ~100-118. `PaymentProcessor` reverts to what it actually is: a UI wrapper that opens the sheet and hands the callback triple to `onSuccess`. The verdict now comes from step 3 of the sequence above, in the checkout screen. Success UI moves behind the verified read.

#### 1e. Cleanup job safety (clause 3.6)

**File: new migration `<ts>_cleanup_pending_orders_grace.sql`**, replacing `cleanup_pending_orders()`.

The current predicate is `payment_status = 'pending' AND status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes' AND payment_method NOT IN ('cod','cash')`. Under the new flow it is wrong in both directions: the new pending orders carry `status = 'placed'`, so they would never be cleaned; and relying on `status` at all couples cleanup to an unrelated lifecycle field.

Rewrite it to key on the in-flight marker, which is the field the verification RPC clears:

```sql
DELETE FROM orders
 WHERE payment_status = 'pending'
   AND payment_method NOT IN ('cod', 'cash')
   AND payment_initiated_at IS NOT NULL
   AND payment_initiated_at < NOW() - INTERVAL '15 minutes';
```

Three properties fall out of this shape:

- **A paid order can never be deleted.** `mark_order_paid` sets `payment_status = 'paid'` and `payment_initiated_at = NULL` in the *same* `UPDATE`. There is no window in which a row is paid but still matches.
- **An in-flight order can never be deleted.** The 15-minute grace window comfortably exceeds the Razorpay sheet lifetime plus verification, where the old window was 5 minutes against a job running every 5 — meaning a legitimate slow payment could be deleted between callback and verification. That race is exactly what clause 3.6 forbids, and widening the window plus keying on `payment_initiated_at` removes it.
- **COD is untouched**, preserved from the current predicate.

Keep the `pg_cron` schedule and the `service_role`-only `GRANT`. Replace the partial index with one matching the new predicate. Delete the now-false header comment claiming orders are only created after payment succeeds.

### Phase 2 — delete the dead Next.js layer (clauses 2.7-2.17)

Per the investigation above. Removal, not repair.

**Delete:** `pages/` (the whole tree: `api/admin/monitoring/{security,errors,performance,status}.ts`, `api/ai/chat.ts`), `middleware/` (`security.ts`, `auth.ts`, and the rest of the directory), `config/security.ts`, `next.config.js`, `next-env.d.ts`.

**Delete, since their only consumers are going away and neither is reachable:** `components/admin/MonitoringDashboard.tsx` (never imported; relative `fetch` cannot resolve in RN) and the `ENDPOINTS` block in `components/ai/index.tsx` that points at the removed routes.

**Edit `webpack.config.js`** — remove only the Next-specific portions; leave anything the Expo web target uses. If nothing in it is Expo-related, delete the file, but confirm `expo start --web` still works either way.

**Edit `tsconfig.json`** — drop `next-env.d.ts` and `.next/types/**/*.ts` from `include`, and drop the `{"name": "next"}` plugin. Also see clause 2.22 below; both edits land in the same file.

**Before deleting, preserve one thing:** copy the `securityHeaders` and `corsOptions` objects out of `config/security.ts` into the design record above. They are correct, dependency-free, and the only part of the layer worth keeping.

**No `package.json` change is needed.** The five missing dependencies stay missing, which is the point.

**Clauses satisfied by removal, stated explicitly** as clause 2.15 requires: 2.7 and 2.8 (no middleware to no-op), 2.9 (no monitoring endpoints), 2.10 through 2.14 (no `middleware/auth.ts`), 2.16 (`config/security.ts` deleted; its `encrypt`/`decrypt` had zero callers, so no retained code performs encryption), 2.17 (no AI chat endpoint — the app already calls its AI services directly). Clauses 3.9 and 3.10, both conditioned on retention, are vacuous.

**Verification for clause 3.12:** after deletion, `expo start`, `expo run:android` and an EAS build for each existing profile must all succeed, with `patch-package` postinstall intact.

### Phase 3 — hardening and hygiene

#### 2.18 — third-party configuration

**File: `constants/config.ts`** — replace the hardcoded `SUPABASE_CONFIG`, `FIREBASE_CONFIG` and `GOOGLE_MAPS_API_KEY` literals with reads from `Constants.expoConfig.extra`, wired through `app.config.js`. The Supabase anon key and Firebase web config stay client-visible — they are designed to be — but sourcing them from config makes them rotatable, which is what the clause asks for. `app.config.js:258` also needs its `"AIzaSyA"` stub `firebaseApiKey` fallback removed.

`GOOGLE_MAPS_API_KEY` is the one that matters: an unrestricted Maps key is a billing liability. Restricting it is a Google Cloud console action — see [Human Actions](#human-actions-outside-the-codebase).

#### 2.19 — the `anon` grant audit

The clause asks for a method and decision criteria, not a pre-decided list of 27 files. Here they are.

**Decision criterion.** Keep an `anon` grant only if some code path invokes the object *before* a Supabase session exists. Everything else loses it.

**Applying the criterion to the live signup path.** Traced end to end: `app/(auth)/login.tsx:180` calls `supabase.auth.signInWithOtp` — a GoTrue call, no Postgres grant involved, and the screen performs no table read. `app/(auth)/otp.tsx:186` calls `supabase.auth.verifyOtp`. Everything after that line runs with a session. Profile creation happens at `otp.tsx:220-250` as a **direct `INSERT` into `profiles`** by the authenticated user — no RPC. The RPC helpers in the same file, `createProfileSafely` (`create_profile_unified`) and `isNewPhoneNumber`, are **defined but never called**. All KYC screens (`retailer-kyc.tsx`, `seller-kyc.tsx`, `wholesaler-kyc.tsx`, `kyc.tsx`) run post-session.

**Conclusion: the signup flow needs no `anon` grant at all.** Every grant in the clause-1.19 list fails the criterion. The ~27 `sql/` files are strata of abandoned profile-creation attempts.

**Method, in order:**

1. **Audit the live database, not the files.** The `sql/` directory is loose scripts, not migrations, so which grants are actually present is unknown from the tree. Snapshot reality first:
   ```sql
   SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE');

   SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
          pg_get_expr(polwithcheck, polrelid) AS check_expr
     FROM pg_policy WHERE polrelid IN ('storage.objects'::regclass, 'public.profiles'::regclass);
   ```
2. **Classify each row** as needed-pre-auth / not-needed / function-does-not-exist. Read-only helpers such as `get_products_optimized` in `sql/optimize_product_queries.sql` are a separate question: if the app browses the catalogue before login, their `anon` grant is legitimate and stays. Verify that against the app's pre-login screens rather than assuming.
3. **Write one revoke migration** grouped by classification, with a comment per line recording which criterion it failed. This is the per-file record clause 2.19 asks for.
4. **Scope the storage policies.** In `sql/create_product_images_bucket.sql:23`, `sql/create_shop_images_bucket.sql:21`, `sql/create_profiles_bucket.sql` (eight occurrences) and `sql/create_id_verification_bucket.sql:23`, replace `auth.role() IN ('authenticated','anon','service_role')` on write operations with `auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text`. Keep the existing read policies as they are.
5. **Drop the blanket profiles policy** from `sql/simple_profile_policies.sql:54-58` (`FOR ALL TO service_role USING (true) WITH CHECK (true)`). `service_role` bypasses RLS anyway, so the policy grants nothing and only obscures the real ones. While there, review the `"Allow public insert of profiles"` policy at line 47 against the same criterion.
6. **Regression-test 3.7 and 3.8 on a branch database** before touching production: full signup for retailer and seller, each KYC path, and one upload per bucket.

#### 2.21 — repo hygiene

- **`debug_customers.js`, `debug_master_products.js`** — stale project URL and key. Delete; they are one-off diagnostics.
- **`test_profile_creation_fix.js`, `update_database_function.js`** — embedded `service_role` JWT. Delete. If either is still wanted, rewrite to read `SUPABASE_SERVICE_ROLE_KEY` from the environment and exit non-zero when absent. **The embedded service-role key must be rotated in the Supabase dashboard regardless** — deleting the file does not remove it from git history, exactly as with the Razorpay secret.
- **Build artifacts** — `git rm --cached` the ~30 tracked `.txt` dumps and logs (`build_log*.txt`, `gradle_build_log*.txt`, `build-error*.txt`, `autolinking*.txt`, `*_manifest.txt`, `eas-build-report.txt`, `exclusion-test-report.txt`, `expo-doctor-output.txt`, `settings-*.txt`, `rn-config.txt`, `android/build_*.txt`). `.gitignore` already has `*.log` but nothing covering these; add patterns for `build_log*.txt`, `gradle_build_log*.txt`, `build-error*.txt`, `*_manifest.txt`.
- **`components/admin/WhatsAppDashboard.tsx`** — the component is never imported anywhere. Simplest correct fix is to delete it alongside `MonitoringDashboard`. If it is being kept for future use, change lines 19-21 to `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, document both in `.env.example`, drop the `|| ''`, and throw on absence rather than constructing `createClient('', '')` at module scope. Better still, import the app's existing `services/supabase/supabase` client instead of making a second one.

#### 2.22 — a usable verification gate

**Order matters.** Install dependencies first — the current "tsc hangs" symptom is entirely `npx` resolving the wrong package because `node_modules` is absent. Run `npm ci`, then use the local binary.

**File: `package.json`** — add scripts, and fix `test`:

```json
"test": "jest",
"test:watch": "jest --watchAll",
"typecheck": "tsc --noEmit -p tsconfig.json",
"lint": "eslint . --ext .ts,.tsx,.js,.jsx --max-warnings=0"
```

`jest` without `--watchAll` terminates on its own; the watch mode moves to `test:watch` so nobody loses it. `eslint` and `eslint-config-expo` need adding to `devDependencies` at pinned exact versions — there is no ESLint config in the tree today.

**File: `tsconfig.json`** — the current `include` is `["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"]` with no `exclude`. Narrow it to what the app actually ships and add an `exclude`:

```json
"include": ["app/**/*", "components/**/*", "services/**/*", "hooks/**/*",
            "store/**/*", "contexts/**/*", "providers/**/*", "utils/**/*",
            "lib/**/*", "config/**/*", "constants/**/*", "types/**/*",
            "theme/**/*", "navigator/**/*"],
"exclude": ["node_modules", "supabase/functions", "tests", "scripts",
            "DukaaOnWebsite", "Website", "old-website-backup", "src",
            "screens", "android", "patched-modules", "polyfills"]
```

`supabase/functions/**` is excluded because it is Deno with `jsr:`/URL imports that `tsc` cannot resolve; it should be checked with `deno check` if at all. `tests/**` is excluded from the app type-check to keep the gate fast and focused — add a second `tsconfig.test.json` extending this one if test type-checking is wanted later. The `next-env.d.ts` and `.next/types` entries and the `{"name": "next"}` plugin all go with the Phase 2 deletion.

**Then run `npm run typecheck` and see what it says.** Existing errors get either fixed or, where they are pre-existing and unrelated, recorded in a short baseline note in the repo with the intention of burning it down. Do not add `// @ts-nocheck` to make the gate green.

**File: `.env.example`** — reconcile with the fixes: remove `EXPO_PUBLIC_RAZORPAY_KEY_SECRET`, remove the now-unused `EXPO_PUBLIC_API_BASE_URL`, add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

### Human actions outside the codebase

These cannot be completed by editing files. Phase 1 is not closable without the first one.

1. **Rotate the Razorpay key — required, blocking clause 2.3.** Generate a new key pair in the Razorpay dashboard and disable `rzp_live_<ROTATED_KEY_ID_REDACTED>` / `<ROTATED_KEY_SECRET_REDACTED>`. The secret is in git history from commit `441065b` and in every build produced since, so rotation is the only real remediation. Removing it from the working tree is necessary and insufficient. History scrubbing is optional follow-up and does not substitute.
2. **Rotate the Supabase service-role key — same reasoning, clause 2.21.** It is committed in `test_profile_creation_fix.js` and `update_database_function.js` and therefore in history.
3. **Configure Supabase Function secrets — required for Phase 1 to function.** Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (the *new* pair) as Edge Function secrets, and confirm `SUPABASE_SERVICE_ROLE_KEY` is available to `verify-razorpay-payment` for the `mark_order_paid` call. Both `razorpay-function` and `verify-razorpay-payment` read from Deno env.
4. **Restrict the Google Maps API key in Google Cloud — clause 2.18.** Application restriction: Android apps, package `com.sixn8.dukaaon`, plus the release signing SHA-1. API restriction: allowlist only the Maps/Geocoding/Places APIs actually used. A copied key must be useless elsewhere.
5. **Confirm `pg_cron` is enabled** in Supabase (Database → Extensions) so the revised cleanup job actually runs. The existing migration warns and continues if it is absent, so a silently unscheduled job is possible today.
6. **Snapshot live database grants** before writing the revoke migration (clause 2.19, step 1) — the `sql/` directory is not authoritative about what is deployed.

## Testing Strategy

### Validation Approach

Two phases. First surface counterexamples on the **unfixed** code to confirm or refute the root-cause analysis. If a counterexample does not appear where predicted, re-hypothesize before writing the fix. Then verify the fix holds for all bug-condition inputs and that non-bug behavior is unchanged.

`fast-check` is already in `devDependencies`, so property-based tests need no new dependency. `jest-expo` is the configured preset.

### Exploratory Bug Condition Checking

**Goal:** demonstrate the bugs before fixing them, and confirm the specific mechanisms hypothesized above.

**Test plan:** unit-level tests against the current code plus two greps and one manual DB probe. Run on the unfixed tree, expect the listed failures.

**Test cases:**

1. **Forged callback yields a paid order** — call `handlePaymentSuccess` with a triple whose signature is arbitrary. Assert the order ends `payment_status !== 'paid'`. *Will fail on unfixed code:* the insert at line 321 hardcodes `'paid'`.
2. **`verifyPayment` accepts garbage** — `razorpayService.verifyPayment('pay_x', 'order_y', 'z')`. Assert `false`. *Will fail:* returns `true` on prefix match alone.
3. **`verified: false` still shows success** — stub `functions.invoke` to resolve `{data: {verified: false}}`. Assert no success modal and order not paid. *Will fail:* only `console.warn`.
4. **Multi-seller verification 404s** — invoke with `order_id = <master_orders.id>`. Assert `verified: true`. *Will fail:* the function queries `orders`, does not find the id, returns 404. This one is a prediction worth checking early, because it means the multi-seller path has never verified anything.
5. **Client can write `paid` directly** — with a normal user JWT, `UPDATE orders SET payment_status = 'paid' WHERE user_id = <self>`. Assert rejection. *Will fail:* no policy or trigger forbids it.
6. **Secret is in the artifact** — grep the built bundle for the leaked value. *Will fail:* four sources compile it in.
7. **Build with no Razorpay env** — unset both variables and build. Assert failure. *Will fail:* falls back to live credentials.
8. **Cleanup deletes an in-flight order** — insert an online order `pending` with `created_at` 6 minutes ago and `status = 'pending'`, run `cleanup_pending_orders()`. Assert survival. *Will fail on the old flow's shape:* deleted. Under the current shape (`status = 'placed'`) it survives but is never cleaned up either — check both.
9. **Middleware never rejects** — call `securityMiddleware` with no `X-API-Key`. Assert non-200. *Will fail:* always `NextResponse.next()`. (Requires stubbing `next/server`, since the dependency is absent — which is itself the finding.)
10. **`hasAccess` throws on unknown role** — `hasAccess('/api/orders', 'delivery_partner')`. Assert a boolean. *Will fail:* `TypeError` on `undefined.some`.
11. **Layer cannot compile** — `tsc --noEmit` over `pages/` and `middleware/`. *Will fail:* unresolved `next`, `jose`, `zod`, `ioredis`, `rate-limiter-flexible`, plus the duplicate `NextRequest` import.
12. **Encryption round-trip** — `decrypt(...encrypt('secret'))`. Assert equality. *Will fail:* `createCipheriv` throws on the 64-byte key.
13. **`anon` can call profile mutators** — with the anon key only, `rpc('create_profile_unified', ...)`. Assert denial. *May fail* depending on which `sql/` scripts were actually applied — this is precisely why step 1 of the grant audit queries the live database.

**Expected counterexamples:**

- Paid orders with no verified signature, from three distinct sources: the client hardcoding `'paid'`, the prefix-only `verifyPayment`, and the ignored `verified: false`.
- A leaked live credential recoverable from any shipped APK.
- Every Next.js-layer test failing at import time rather than at assertion time, confirming the layer has never executed. If any of these tests *passes*, the deletion recommendation must be revisited.
- Possible causes, all confirmed above: client trusted as the writer of payment state; no DB-level authority over `payment_status`; Express handlers behind a non-throwing `res` stub; five uninstalled dependencies.

### Fix Checking

**Goal:** for all inputs satisfying the bug condition, the fixed system exhibits the property.

```
FOR ALL input WHERE isBugCondition_C1(input) DO
  result := checkout_fixed(input)
  ASSERT result.order.payment_status == 'paid'
         IFF serverVerifiedHmac(input.razorpayCallback)
  ASSERT NOT clientWrotePaidState(result)
  ASSERT result.successModalShown IFF result.order.payment_status == 'paid'
END FOR

FOR ALL input WHERE isBugCondition_C2(input) DO
  ASSERT NOT fileExists(input.module)          // Phase 2 = removal
END FOR

FOR ALL artifact WHERE isBugCondition_C3(artifact) DO
  ASSERT NOT grantedTo(artifact, 'anon') OR requiredByPreAuthFlow(artifact)
  ASSERT NOT containsCredential(artifact)
  ASSERT terminates(artifact) WHEN artifact.kind == 'verify_script'
END FOR
```

### Preservation Checking

**Goal:** for all inputs where the bug condition does not hold, the fixed system produces the same result as the original.

```
FOR ALL input WHERE NOT isBugCondition_C1(input) DO
  ASSERT checkout_original(input) == checkout_fixed(input)
END FOR
```

**Why property-based testing here.** The preservation surface is wide — arbitrary carts across arbitrary seller counts, both payment methods, and every role reading orders — and the risk is a case nobody enumerated. Generated inputs cover the domain and shrink to a minimal counterexample when they find one, which manual cases will not. `fast-check` is already available.

**Test plan:** capture behavior on the **unfixed** code first for the non-bug inputs below, then assert the fixed code matches those captures.

**Test cases:**

1. **COD preservation** — observe COD checkout on unfixed code (order `pending`, no Razorpay, checkout completes), then assert identical after the fix. Covers 3.1.
2. **Multi-seller split preservation** — observe the master-order shape, per-seller row count, delivery-fee assignment to the first seller, and the delivery batch, then assert unchanged. Only `payment_status` differs, and only until verification. Covers 3.3.
3. **Verified-payment happy path** — observe that a genuine payment ends `paid` with a `payment_transactions` row and a success modal, and assert the same end state after the fix despite the different route to it. Covers 3.2.
4. **Read preservation under the trigger** — observe every existing buyer and seller `SELECT` on `orders`, `master_orders` and `payment_transactions`, then assert byte-identical results after the trigger is added. Covers 3.13.
5. **Seller status transitions** — observe seller-side `status` updates (`accepted`, `out_for_delivery`, `delivered`) and assert they still succeed with the trigger in place. The trigger only fires on a `payment_status` change, so these must be unaffected; this test is what proves it.
6. **Sheet initialization from `keyId` alone** — observe Razorpay initialization after `keySecret` is removed from config. Covers 3.4.
7. **HMAC logic untouched** — assert the existing computation over `razorpay_order_id|razorpay_payment_id` produces identical output before and after. Covers 3.5.
8. **Signup and KYC after revokes** — observe retailer and seller signup plus each KYC path, then assert unchanged after the grant migration. Covers 3.7.
9. **Authenticated uploads after policy tightening** — one upload per bucket, own folder, before and after. Covers 3.8.
10. **Expo/EAS build after deletion** — `expo start`, `expo run:android`, and each EAS profile, before and after removing the Next.js layer. Covers 3.12.
11. **Maps after key relocation** — map render, geocoding, place lookup, before and after. Covers 3.11.

### Unit Tests

- `handlePaymentSuccess`: pending-order creation, verification invocation, verified read-back, and each failure branch (mismatch, 5xx, network loss, RPC failure).
- `mark_order_paid`: authorized call succeeds; `anon` and `authenticated` calls are denied; a repeat call on an already-paid order is a no-op returning success.
- `enforce_payment_status_authority`: client `INSERT` at `'pending'` allowed; client `INSERT` at `'paid'` rejected; client `UPDATE` of `payment_status` rejected; non-`payment_status` `UPDATE` allowed; privileged transition allowed.
- `cleanup_pending_orders`: deletes an abandoned online order past the grace window; spares one inside it; spares a paid order; spares COD.
- Edge function: signature mismatch returns 400 and writes nothing; both `order_id` and `master_order_id` shapes resolve; a cross-user `order_id` is rejected by the ownership check.
- Config: build fails when `EXPO_PUBLIC_RAZORPAY_KEY_ID` is absent; no source module exports a Razorpay secret.

### Property-Based Tests

- **Property 1** — generate arbitrary carts (1-5 sellers, 1-20 items, both payment methods) crossed with arbitrary callback triples of which a known subset has valid HMACs. Assert `payment_status == 'paid'` if and only if the triple was valid and verification ran server-side. This is the single most valuable test in the suite: it covers forged, replayed and genuine callbacks in one generator.
- **Property 2** — generate arbitrary non-bug inputs (COD checkouts, cart and product operations, seller status transitions, reads by each role) and assert the fixed system's output equals the captured original.
- **Property 3** — generate all 4 combinations of set/unset `EXPO_PUBLIC_RAZORPAY_*` variables and assert either a successful build with no secret in the bundle, or a loud failure.
- **Property 4** — generate order rows over a range of `payment_initiated_at` offsets, payment methods and payment statuses, and assert the cleanup predicate deletes exactly the abandoned online-pending set. Interleave a `mark_order_paid` call with a cleanup run to assert no ordering deletes a paid order.
- **Property 6** — generate storage paths, varying the owner prefix, and assert an authenticated user writes only under their own `auth.uid()` folder and an anon caller writes nothing.

### Integration Tests

- Full online checkout on a branch database, single-seller and multi-seller: pending order → sheet → verification → server transition → verified read-back → success UI. Assert no intermediate state in which the client wrote `paid`.
- Full failure flow: forged signature. Order stays `pending`, buyer sees failure, cart is preserved, retry re-invokes verification against the same order.
- Interrupted flow: kill the app between callback and verification. Order stays `pending`, is cleaned up after the grace window, and no paid order is ever produced.
- Full COD checkout, unchanged end to end.
- Signup → KYC → first order, run after the grant revokes, for both retailer and seller.
- Post-deletion build: `expo start`, `expo run:android`, EAS per profile.
- `npm ci && npm run typecheck && npm run lint && npm test` — all four terminate with a verdict. This is the clause 2.22 acceptance test, and it must be run in a clean checkout, because the absent `node_modules` is what produced the original hang.

---

## Appendix: Preserved Objects from `config/security.ts` (deleted in Phase 2, task 16.1)

These are the only dependency-free, correct portions of the dead Next.js layer. Recorded here so the deletion is not lossy — if a web API is rebuilt in the future, these can be reintroduced directly.

### `securityHeaders`

```typescript
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};
```

### `corsOptions`

```typescript
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
```

**Note for rebuilders**: write Next.js middleware as `(request) => NextResponse`, not as an Express handler behind a stub. That single decision is the Phase 2 root cause. See the "Investigation" section above for full context.
