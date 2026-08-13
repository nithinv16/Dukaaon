# Grant Audit Findings — `anon` Role Privileges

**Audit date**: 2025-07-12
**Source**: static analysis of `sql/` directory scripts
**Scope**: all `GRANT ... TO anon` and storage policies admitting `anon`

## Methodology

Since we cannot run live database queries from this environment, the audit is a static
analysis of the committed SQL scripts. The design (task 18) notes these are loose scripts,
not migrations, so which grants are _actually_ present in the running database may differ.
The revoke migration (task 21.1) is written defensively with `IF EXISTS` to handle both
cases.

The classification criterion from the design: **keep an `anon` grant only if some code path
invokes the object before a Supabase session exists** (i.e., before the user authenticates).

### Pre-auth flow trace (confirmed)

1. `app/(auth)/login.tsx:180` calls `supabase.auth.signInWithOtp` — this is a GoTrue HTTP
   call, not a Postgres RPC. No anon grant needed.
2. `app/(auth)/otp.tsx:186` calls `supabase.auth.verifyOtp` — GoTrue again.
3. Profile creation at `otp.tsx:220-250` is a direct `INSERT` into `profiles` by the
   now-authenticated user. The functions `createProfileSafely` and `isNewPhoneNumber` are
   defined in that file but **never called**.
4. All KYC screens run post-session (authenticated).
5. Product browsing is behind the auth gate — `app/_layout.tsx` renders `(main)` only when
   `session` exists. `ProductCacheService.ts` calls the optimized RPCs only from main
   screens.
6. Pre-login screens are only: language selection, login (phone input), OTP verification.
   None call any Postgres RPC.

**Conclusion**: No code path invokes any user-defined Postgres function or writes to storage
before authentication. All `anon` grants on profile-mutating functions are unnecessary. The
product-read helpers (`get_products_optimized`, etc.) are also unnecessary for `anon` since
the app requires login before browsing, but they are read-only and low-risk.

---

## Classified Grants

### NOT-NEEDED: Profile-Mutating Functions (REVOKE recommended)

| Function | Source File | Rationale |
|----------|-------------|-----------|
| `create_profile_unified(text, text, text)` | `sql/direct_fix.sql:170` | Profile mutation; never called pre-auth |
| `create_profile_unified(text, text)` | `sql/fix_create_profile_unified_return.sql:194` | Profile mutation; never called pre-auth |
| `create_profile_unified` (no args) | `sql/fix-database-schema.sql:663` | Profile mutation; never called pre-auth |
| `handle_firebase_auth` | `sql/handle_firebase_auth.sql:167` | Firebase linkage; runs post-auth only |
| `link_firebase_to_profile` | `sql/link_firebase_to_profile.sql:153` | Firebase linkage; runs post-auth only |
| `link_firebase_user_by_phone` | `sql/link_firebase_user_by_phone.sql:154` | Firebase linkage; runs post-auth only |
| `create_user_with_profile` | `sql/create_user_with_profile.sql:128` | Profile creation; signInWithOtp is GoTrue |
| `fix_profile_creation` | `sql/fix_profile_creation.sql:199` | Profile repair; runs post-auth |
| `fix_profile_creation` | `sql/fix-database-schema.sql:658` | Duplicate grant, same function |
| `create_profile_safely` | `sql/create_profile_safely.sql:218` | Profile creation; never called pre-auth |
| `create_profile_with_existing_auth_id` | `sql/create_profile_with_existing_auth_id.sql:135` | Profile creation; runs post-auth |
| `create_user_profile` | `sql/create_user_profile.sql:100` | Profile creation; never called pre-auth |
| `create_user_profile` | `sql/fix-database-schema.sql:657` | Duplicate grant, same function |
| `create_user_profile_direct` | `sql/fix-database-schema.sql:659` | Profile creation; never called pre-auth |
| `create_profile_no_constraint` | `sql/fix-database-schema.sql:660` | Profile creation; never called pre-auth |
| `create_retailer_profile` | `sql/fix-database-schema.sql:661` | Profile creation; runs post-auth |
| `create_seller_profile` | `sql/fix-database-schema.sql:662` | Profile creation; runs post-auth |
| `diagnose_profile_creation` | `sql/fix-database-schema.sql:664` | Diagnostic; not part of any user flow |
| `create_profile_if_not_exists` | `sql/simple_profile_policies.sql:119` | Profile creation; runs post-auth |
| `update_profile_with_business_details` | `sql/check_and_fix_status.sql:125` | Profile mutation; runs post-auth (KYC) |
| `update_retailer_profile_safely` | `sql/fixed_update_retailer_profile.sql:58` | Profile mutation; runs post-auth |
| `reset_business_details` | `sql/reset_business_details_structure.sql:87` | Profile mutation; runs post-auth |
| `update_business_details_standard` | `sql/reset_business_details_structure.sql:154` | Profile mutation; runs post-auth |
| `restore_business_details` | `sql/fix_overrides.sql:52` | Profile read (returns JSONB); low-risk but unnecessary |
| `update_business_details_only` | `sql/clean_up_rls_policies.sql:80` | Profile mutation; runs post-auth |

### NOT-NEEDED: Blanket Profile Policies (DROP or RESTRICT recommended)

| Policy | Source File | Issue |
|--------|-------------|-------|
| `"Allow public insert of profiles"` (anon, `WITH CHECK (true)`) | `sql/simple_profile_policies.sql:47-52` | Allows any anon caller to insert any profile row. Pre-auth flow does not need this — profile creation happens post-verifyOtp when the caller is `authenticated`. |
| `"Allow service role to manage profiles"` (service_role, `FOR ALL`) | `sql/simple_profile_policies.sql:54-58` | `service_role` bypasses RLS anyway; this policy grants nothing, only obscures the real policies. |

### NOT-NEEDED: Storage Write Policies Admitting `anon`

| Policy | Bucket | Source File | Issue |
|--------|--------|-------------|-------|
| `"Users can upload product images"` | `product-images` | `sql/create_product_images_bucket.sql:15-26` | `auth.role() IN ('authenticated','anon','service_role')` — anon should not upload product images |
| `"Users can upload shop images"` | `shop-images` | `sql/create_shop_images_bucket.sql:13-24` | Same pattern — anon should not upload shop images |
| `"Users can upload profile images"` | `profiles` | `sql/create_profiles_bucket.sql:14-29` | Same pattern — anon should not upload profile images. Already has owner-prefix check but admits anon. |
| `"Users can view profile images"` (SELECT) | `profiles` | `sql/create_profiles_bucket.sql:32-46` | READ policy — admits anon but is low-risk for reads. **Leave unchanged.** |
| `"Users can update their profile images"` | `profiles` | `sql/create_profiles_bucket.sql:49-72` | WRITE (UPDATE) — admits anon. Should be authenticated only. |
| `"Users can delete their profile images"` | `profiles` | `sql/create_profiles_bucket.sql:75-90` | WRITE (DELETE) — admits anon. Should be authenticated only. |
| `"Users can upload ID verification images"` | `id_verification` | `sql/create_id_verification_bucket.sql:15-26` | `auth.role() IN ('authenticated','anon','service_role')` — anon should not upload ID docs. Already has owner-prefix check but admits anon. |

### LEGITIMATE / LOW-RISK: Read-Only Helpers

| Function | Source File | Rationale |
|----------|-------------|-----------|
| `get_products_optimized` | `sql/optimize_product_queries.sql:118` | Read-only product query. App requires auth before browsing, so not strictly needed, but it's read-only and the revoke could break a future public catalogue. **REVOKE recommended** (app is auth-gated). |
| `get_seller_products_optimized` | `sql/optimize_product_queries.sql:174` | Same — read-only, auth-gated. **REVOKE recommended.** |
| `get_category_products_optimized` | `sql/optimize_product_queries.sql:238` | Same — read-only, auth-gated. **REVOKE recommended.** |
| `get_business_detail` | `sql/clean_up_rls_policies.sql:31`, `sql/update_rls_policies.sql:46` | Read-only profile helper. **REVOKE recommended** — no pre-auth consumer. |

### LEGITIMATE: Schema-Level Grants (Keep)

| Grant | Source File | Rationale |
|-------|-------------|-----------|
| `GRANT USAGE ON SCHEMA storage TO anon, authenticated` | Multiple bucket scripts | Required by Supabase infrastructure for storage to function. Keep. |
| `GRANT USAGE ON SCHEMA public TO anon, authenticated` | `sql/ai_agent_schema.sql:424` | Standard Supabase setup. Keep. |
| `GRANT SELECT ON profile_business_details TO anon` | `sql/update_rls_policies.sql:73` | Read-only view. Low-risk. Keep (or revoke if no pre-auth consumer needed). |
| `GRANT SELECT, INSERT, ... ON storage.objects TO anon` | Multiple bucket scripts | Table-level DML grants; RLS policies are the real gatekeepers. These are standard Supabase setup. Keep (policies are what we tighten). |
| `GRANT EXECUTE ON FUNCTION storage.filename/foldername TO anon` | Multiple bucket scripts | Infrastructure functions needed by Supabase storage SDK. Keep. |
| `user_profiles` view: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO anon` | `sql/fix-database-schema.sql:671` | Compatibility view for profiles. The underlying table has RLS. **REVOKE INSERT/UPDATE/DELETE for anon** — only SELECT is defensible. |

---

## Summary

- **24+ profile-mutating functions** granted to `anon` — all unnecessary
- **7 storage write policies** admit `anon` — all should be restricted to `authenticated`
- **1 blanket anon INSERT policy on profiles** — should be dropped (pre-auth path uses GoTrue, not direct INSERT)
- **1 redundant service_role policy** — should be dropped (service_role bypasses RLS)
- **Read-only product helpers** — low-risk but also unnecessary since app is auth-gated; revoke recommended

The revoke migration in task 21.1 addresses all items in the NOT-NEEDED categories.
