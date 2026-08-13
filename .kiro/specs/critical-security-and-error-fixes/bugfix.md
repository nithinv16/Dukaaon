# Bugfix Requirements Document

## Introduction

A diagnostic pass over the Dukaaon repo (Expo/React Native app + Supabase backend + an unused Next.js API layer) found 22 distinct defects across credential handling, payment integrity, API access control, cryptography, database grants and repo hygiene. Two of them are actively exploitable against live money: the live Razorpay key secret is compiled into the shipped mobile binary, and orders are marked `paid` by the client without authoritative server-side signature verification. The rest are broken or fake security controls that report success while doing nothing, which is worse than having no control at all because it creates false confidence.

Every clause below was verified against the current working tree at commit `aa550af`.

Clause groups map to delivery phases:

- Phase 1 (clauses `.1`–`.6`) — Razorpay credential leak and payment integrity. Ships first. Includes a mandatory human action outside the codebase: rotating the leaked Razorpay key in the Razorpay dashboard. The leaked secret also exists in git history (introduced in commit `441065b`), so rotation is the only real remediation; history scrubbing is an optional follow-up that does not substitute for rotation.
- Phase 2 (clauses `.7`–`.15`) — broken and non-functional API security controls in the Next.js layer. Gated on one decision recorded in clause 2.15: delete the dead Next.js layer, or install and pin its dependencies and make the controls real.
- Phase 3 (clauses `.16`–`.22`) — hardening and hygiene: encryption, unauthenticated AI endpoint, hardcoded third-party keys, over-permissive Supabase grants, committed debug artifacts, and the absent type-check/lint gate.

No code changes are made in this phase.

## Bug Analysis

### Current Behavior (Defect)

Phase 1 — credential leak and payment integrity

1.1 WHEN the app is built with any profile THEN the system embeds the live Razorpay key secret `<ROTATED_KEY_SECRET_REDACTED>` into the client bundle through the `extra.EXPO_PUBLIC_RAZORPAY_KEY_SECRET` fallback in `app.config.js` (line 282), the `keySecret` fallback in `config/razorpay.ts` (line 26), the `ENV_TEMPLATE` string in `config/razorpay.ts` (line 72), and the `razorpayConfig.keySecret` fallback in `config/secrets.ts` (line 50), so anyone who unzips the APK recovers a credential granting full Razorpay API access including fetching payments, creating orders and issuing refunds.

1.2 WHEN a reader opens the committed documentation THEN the system exposes the same live key secret and live `rzp_live_...` key id in plain text in `docs/RAZORPAY_FIX_CACHE.md` (line 65) and `docs/guides/RAZORPAY_INTEGRATION.md` (~line 185).

1.3 WHEN `EXPO_PUBLIC_RAZORPAY_KEY_SECRET` or `EXPO_PUBLIC_RAZORPAY_KEY_ID` is unset at build time THEN the system silently substitutes live production credentials instead of failing the build.

1.4 WHEN the Razorpay checkout callback fires in `app/(main)/checkout/index.tsx` `handlePaymentSuccess` THEN the client persists the paid state before any verification: the multi-seller branch sets `payment_status: 'paid'` in `ordersBySeller` (line 247) via `MasterOrderService.placeCompleteOrder`, and the single-seller branch inserts `orders` with `payment_status: 'paid'` (line 321) plus a `payment_transactions` row with `status: 'completed'`.

1.5 WHEN `verify-razorpay-payment` returns `verified: false` or errors THEN the system only logs `console.warn` (lines 290-291 and 370-371 of `app/(main)/checkout/index.tsx`), leaves the order marked paid, and shows the success modal to the buyer, so a forged or replayed payment callback yields a paid order.

1.6 WHEN `components/payment/PaymentProcessor.tsx` (line 103) verifies a payment THEN `razorpayService.verifyPayment()` (`services/payment/razorpayService.ts`, lines 439-480) returns true for any identifiers that merely begin with `pay_` and `order_`, performing no HMAC check, while the correct HMAC verification in `supabase/functions/verify-razorpay-payment/index.ts` (lines 90-110) is advisory only.

Phase 2 — broken and non-functional API security controls

1.7 WHEN `securityMiddleware()` in `middleware/security.ts` evaluates an API key THEN `apiKeyValidation()` (line 44) invokes the Express-style `validateApiKey` from `config/security.ts` with a fake response object whose `status().json()` path does not throw, so the catch block never runs, `NextResponse.next()` is always returned, and the `apiKeyResponse.status !== 200` check at line 88 can never be true.

1.8 WHEN `securityMiddleware()` applies rate limiting THEN `rateLimit()` (line 28) has the same defect and always returns status 200 at line 81, so the middleware is a no-op that reports success for every request.

1.9 WHEN any request carries `Authorization: Bearer anything` THEN `pages/api/admin/monitoring/security.ts`, `errors.ts`, `performance.ts` and `status.ts` gate only on `if (!req.headers.authorization)` (line 10, line 11 for `status.ts`) with no token verification, signature check or admin role check, and return security events, error logs and performance data to the caller.

1.10 WHEN `JWT_SECRET` is unset THEN `middleware/auth.ts` line 9 falls back to the literal `'your-secret-key'`, allowing anyone to mint valid tokens with arbitrary roles including admin.

1.11 WHEN `middleware/auth.ts` is compiled THEN it fails, because `NextRequest` is imported twice (a value import on line 1 and a type import on line 2).

1.12 WHEN `middleware/auth.ts` is loaded THEN `new RateLimiter({ storeClient: redis, ... })` (lines 5 and 48) fails, because `rate-limiter-flexible` exports no `RateLimiter`; the Redis-backed class is `RateLimiterRedis`.

1.13 WHEN `hasAccess()` receives a role absent from the `protectedRoutes` map THEN `protectedRoutes[userRole].some(...)` throws, and because the ADMIN route list omits `/api/orders`, `/api/products` and other entries present for customers and sellers, admins are denied routes that lower-privilege roles can reach.

1.14 WHEN `middleware/auth.ts` rate-limits a request THEN the key is derived from `request.ip` alone, which current Next.js versions do not populate and which is spoofable through proxy headers, so the limiter is ineffective.

1.15 WHEN the Next.js layer is imported or built THEN it cannot run, because `next`, `jose`, `zod`, `ioredis` and `rate-limiter-flexible` are all absent from `package.json` (verified programmatically) while `pages/api/**`, `middleware/**`, `config/security.ts`, `next.config.js` and `webpack.config.js` import them, and no decision is recorded anywhere about whether this layer is deployed, so the repo reads as if security controls exist when none execute.

Phase 3 — hardening and hygiene

1.16 WHEN `config/security.ts` encrypts or decrypts data THEN it fails or produces unrecoverable output: `ENCRYPTION_KEY` (line 26) falls back to `crypto.randomBytes(32).toString('hex')`, generating a fresh key per process so ciphertext is undecryptable after restart or on another instance; `Buffer.from(ENCRYPTION_KEY)` (lines 109 and 121) reads the 64-character hex string as utf8 and yields a 64-byte key, which `aes-256-gcm` rejects, so `createCipheriv` throws; and `encrypt()` never returns the GCM auth tag while `decrypt()` never calls `setAuthTag()`, leaving integrity unverified.

1.17 WHEN any caller posts to `pages/api/ai/chat.ts` THEN the endpoint performs no authentication, trusts `userId` from the request body (lines 48-75), and applies no rate limiting, permitting impersonation, writes into another user's conversation history and unbounded Bedrock/LLM spend; it also references `error.message` on a caught `unknown` (line 139), which is a TypeScript type error.

1.18 WHEN `constants/config.ts` is read THEN it exposes hardcoded third-party credentials: the Supabase URL and anon key, the full Firebase web config including `apiKey` (line 11), and `GOOGLE_MAPS_API_KEY` (line 20); `config/secrets.ts` hardcodes the same Supabase anon key as a fallback. The Supabase anon key and Firebase web config are designed to be public, but the committed Google Maps key is a billing-abuse risk if unrestricted, and hardcoding blocks rotation.

1.19 WHEN the SQL in `sql/` is applied THEN the `anon` role receives more privilege than the signup flow needs: profile-mutating functions are granted to `anon` across 27 files including `sql/create_profile_unified*.sql`, `sql/handle_firebase_auth.sql`, `sql/link_firebase_to_profile.sql`, `sql/create_user_with_profile.sql`, `sql/fix_profile_creation.sql`, `sql/create_profile_safely.sql`, `sql/create_profile_with_existing_auth_id.sql`, `sql/check_and_fix_status.sql`, `sql/fixed_update_retailer_profile.sql`, `sql/reset_business_details_structure.sql` and `sql/fix_overrides.sql`; storage policies permit uploads when `auth.role() IN ('authenticated', 'anon', 'service_role')` in `sql/create_product_images_bucket.sql`, `sql/create_shop_images_bucket.sql`, `sql/create_profiles_bucket.sql` and `sql/create_id_verification_bucket.sql`, allowing unauthenticated writes to buckets; and `sql/simple_profile_policies.sql` defines a `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy on `profiles`.

1.20 WHEN a client writes to `orders` or `master_orders` THEN nothing prevents it from setting `payment_status = 'paid'` directly: the only database-level control is a `CHECK` constraint on allowed values (`supabase/migrations/20250105000000_create_orders.sql` line 26 and `supabase/migrations/20250126000004_create_master_orders_system.sql` line 22), with no RLS policy, trigger or security-definer RPC restricting who may set the paid state.

1.21 WHEN the repo is cloned THEN it carries leak risk and noise: `debug_customers.js` and `debug_master_products.js` embed a stale Supabase project URL and key, `test_profile_creation_fix.js` and `update_database_function.js` embed a `service_role` JWT, and roughly twenty build/gradle log files plus multiple `.txt` dumps sit at the repo root. Separately, `components/admin/WhatsAppDashboard.tsx` line 20 reads `process.env.REACT_NATIVE_SUPABASE_ANON_KEY`, which is undefined nowhere in `.env.example` and uses a prefix Expo does not inline, so the component constructs a Supabase client with an empty key and fails at runtime.

1.22 WHEN a contributor or CI tries to catch type and lint regressions THEN there is no gate: `package.json` has no `typecheck` or `lint` script, `test` is `jest --watchAll` which cannot terminate in CI, and `npx tsc --noEmit` did not complete within a ten-minute timeout, so errors such as the one in clause 1.17 go unnoticed.

### Expected Behavior (Correct)

Phase 1 — credential leak and payment integrity

2.1 WHEN the app is built with any profile THEN the system SHALL contain no Razorpay key secret in the bundle: `app.config.js`, `config/razorpay.ts` and `config/secrets.ts` SHALL expose only `keyId` to the client, the key secret SHALL exist solely as a Supabase Edge Function secret, and a grep of the built bundle for the leaked value SHALL return no matches.

2.2 WHEN documentation references Razorpay configuration THEN the system SHALL show placeholder values only, and `docs/RAZORPAY_FIX_CACHE.md` and `docs/guides/RAZORPAY_INTEGRATION.md` SHALL contain no live key id or key secret.

2.3 WHEN `EXPO_PUBLIC_RAZORPAY_KEY_ID` is unset at build time THEN the system SHALL fail loudly rather than substitute a fallback credential, and no source file SHALL contain a hardcoded Razorpay credential fallback. Additionally the leaked key SHALL be rotated in the Razorpay dashboard by a human operator before this phase is considered closed; the old key SHALL be disabled, and the requirement SHALL be treated as unmet until rotation is confirmed, because the leaked value persists in git history from commit `441065b`.

2.4 WHEN the Razorpay checkout callback fires THEN the system SHALL create the order in an unpaid state (`payment_status: 'pending'`, transaction `status` not `completed`) and SHALL NOT write any paid state from the client.

2.5 WHEN `verify-razorpay-payment` returns `verified: false` or errors THEN the system SHALL fail the checkout, SHALL leave the order unpaid, and SHALL surface a failure state to the buyer instead of the success modal; only the verified server-side path SHALL transition an order to paid, making the edge function the single source of truth for payment status.

2.6 WHEN payment verification is requested from the client THEN the system SHALL NOT rely on a client-side check: `razorpayService.verifyPayment()` SHALL be removed or SHALL hard-fail with an error directing callers to the edge function, and `components/payment/PaymentProcessor.tsx` SHALL obtain its verdict from `supabase/functions/verify-razorpay-payment` whose existing HMAC comparison SHALL remain the authoritative check.

Phase 2 — API security controls

2.7 WHEN `securityMiddleware()` evaluates a request with a missing or invalid API key THEN the system SHALL reject the request with a 401 response, and the failure SHALL be observable in the returned `NextResponse` status rather than swallowed.

2.8 WHEN a client exceeds the configured request budget THEN the system SHALL return 429, and `rateLimit()` SHALL propagate limiter failures instead of unconditionally returning `NextResponse.next()`.

2.9 WHEN a request reaches any endpoint under `pages/api/admin/monitoring/` THEN the system SHALL verify the bearer token's signature and SHALL require an admin role claim, SHALL return 401 for missing or invalid tokens and 403 for authenticated non-admins, and SHALL NOT return security, error or performance data to unverified callers.

2.10 WHEN `JWT_SECRET` is unset THEN the system SHALL refuse to start or SHALL reject all token verification, and no hardcoded secret fallback SHALL exist in `middleware/auth.ts`.

2.11 WHEN `middleware/auth.ts` is compiled THEN the system SHALL build without error, with `NextRequest` imported exactly once.

2.12 WHEN `middleware/auth.ts` constructs its rate limiter THEN the system SHALL use the class the library actually exports for a Redis store (`RateLimiterRedis`) and SHALL initialize without throwing.

2.13 WHEN `hasAccess()` receives any role, including one absent from `protectedRoutes` THEN the system SHALL return a boolean decision without throwing and SHALL deny by default, and the admin role SHALL be permitted every route reachable by customers and sellers, so no admin is denied a route a lower-privilege role can reach.

2.14 WHEN a request is rate-limited THEN the system SHALL key the limiter on a trustworthy client identifier (authenticated subject, or a proxy-header chain validated against known infrastructure) rather than `request.ip` alone, so the key is populated and not trivially spoofable.

2.15 WHEN the Next.js layer's status is examined THEN a decision SHALL be recorded and executed: either the layer (`pages/api/**`, `middleware/**`, `config/security.ts`, `next.config.js`, and the Next-specific parts of `webpack.config.js`) SHALL be deleted, or `next`, `jose`, `zod`, `ioredis` and `rate-limiter-flexible` SHALL be added to `package.json` at pinned exact versions with the controls in clauses 2.7-2.14 made real and verified. Deletion is the recommended default unless the web API is actually deployed, because dead security code creates false confidence. If deletion is chosen, clauses 2.7-2.14, 2.16 and 2.17 SHALL be satisfied by removal, and that SHALL be stated explicitly rather than left implicit.

Phase 3 — hardening and hygiene

2.16 WHEN encryption is performed by retained code THEN the system SHALL derive a 32-byte key from a required, externally supplied `ENCRYPTION_KEY` (decoded as hex, not utf8), SHALL fail at startup if it is absent rather than generating an ephemeral key, and SHALL return the GCM auth tag from `encrypt()` and apply it via `setAuthTag()` in `decrypt()` so a round-trip succeeds and tampered ciphertext is rejected.

2.17 WHEN a request reaches the AI chat endpoint THEN the system SHALL authenticate the caller, SHALL derive `userId` from the verified token rather than the request body, SHALL apply rate limiting per user, and SHALL narrow the caught `unknown` error before reading `message` so the file type-checks.

2.18 WHEN third-party configuration is read THEN the system SHALL source values from environment variables via `app.config.js` `extra` with no secret fallbacks, and the Google Maps key SHALL be restricted in Google Cloud by Android package name and SHA-1 plus an API allowlist so a copied key cannot be used elsewhere. Publishable values (Supabase anon key, Firebase web config) MAY remain client-visible but SHALL be sourced from configuration so they can be rotated.

2.19 WHEN Supabase grants are audited THEN the system SHALL retain `anon` privileges only where the pre-authentication signup flow demonstrably requires them, SHALL revoke `anon` from every other profile-mutating function listed in clause 1.19, SHALL scope storage write policies to `authenticated` users writing within their own folder path, and SHALL remove the blanket `FOR ALL TO service_role USING (true) WITH CHECK (true)` policy on `profiles`. The audit result SHALL be recorded per file so a reviewer can see which grants were kept and why.

2.20 WHEN a client attempts to write `payment_status = 'paid'` directly to `orders` or `master_orders` THEN the database SHALL reject it, through RLS, a trigger, or a security-definer RPC callable only by the verification edge function, so paid state cannot originate from client credentials.

2.21 WHEN the repo is cloned THEN it SHALL contain no embedded Supabase service-role JWT or project credential in root-level debug and test scripts, those scripts SHALL read configuration from the environment or SHALL be deleted, and committed build/gradle logs and `.txt` dumps SHALL be removed and covered by `.gitignore`. `components/admin/WhatsAppDashboard.tsx` SHALL read an `EXPO_PUBLIC_`-prefixed variable that is documented in `.env.example`, and SHALL fail with a clear error rather than constructing a client with an empty key.

2.22 WHEN a contributor or CI runs verification THEN `package.json` SHALL provide a non-watch `test` script, a `typecheck` script, and a `lint` script, each terminating on its own; and if `tsc --noEmit` cannot complete in reasonable time, the type-check scope SHALL be narrowed or `tsconfig.json` adjusted so the gate is usable, with existing errors either fixed or explicitly baselined.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a buyer places a cash-on-delivery order THEN the system SHALL CONTINUE TO create the order with `payment_status: 'pending'` and complete checkout without invoking Razorpay.

3.2 WHEN a Razorpay payment succeeds and the edge function verifies the signature THEN the system SHALL CONTINUE TO mark the order paid, record the payment transaction, and show the buyer the success confirmation.

3.3 WHEN a cart contains items from multiple sellers THEN the system SHALL CONTINUE TO split into per-seller orders under a master order via `MasterOrderService.placeCompleteOrder` and SHALL CONTINUE TO track payment at the master-order level.

3.4 WHEN the Razorpay checkout sheet opens in the mobile app THEN the system SHALL CONTINUE TO initialize successfully using `keyId` alone, since the RN SDK does not require the key secret.

3.5 WHEN `supabase/functions/verify-razorpay-payment` computes its HMAC comparison THEN the system SHALL CONTINUE TO use the existing correct logic; only its authority in the flow changes.

3.6 WHEN the pending-order cleanup job runs THEN the system SHALL CONTINUE TO remove stale unpaid orders per `supabase/migrations/20250128000000_cleanup_pending_orders.sql`, and the new pending-then-verify flow SHALL NOT cause legitimate in-flight payments to be deleted mid-verification.

3.7 WHEN a new retailer or seller signs up THEN the system SHALL CONTINUE TO create the profile successfully, including any Firebase-auth linkage path, after the `anon` grant audit.

3.8 WHEN an authenticated user uploads a product image, shop image, profile photo or ID verification document THEN the system SHALL CONTINUE TO succeed for their own files under the tightened storage policies.

3.9 WHEN an authenticated admin calls a monitoring endpoint with a valid admin token THEN the system SHALL CONTINUE TO return security events, error logs, performance data and status, provided the Next.js layer is retained.

3.10 WHEN an authenticated user sends a message to the AI chat endpoint THEN the system SHALL CONTINUE TO return a response and persist conversation history for that user, provided the endpoint is retained.

3.11 WHEN the app renders maps, geocoding or place lookups THEN the system SHALL CONTINUE TO work after the Google Maps key is moved to configuration and restricted, using the app's own package name and signing certificate.

3.12 WHEN the Expo app builds and starts through `expo start`, `expo run:android` and the existing EAS profiles THEN the system SHALL CONTINUE TO build and run, including the `patch-package` postinstall step, and any Next.js layer removal SHALL NOT break the Metro or EAS build.

3.13 WHEN existing Supabase queries run against `orders`, `master_orders` and `payment_transactions` for sellers and buyers THEN the system SHALL CONTINUE TO return their own records under the new payment-status write restrictions, with reads unaffected.
