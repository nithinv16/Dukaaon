-- ============================================================================
-- Migration: Revoke unnecessary anon grants and tighten storage write policies
-- ============================================================================
--
-- Spec: .kiro/specs/critical-security-and-error-fixes (task 21.1)
-- Property 6: anon-only callers are denied profile mutation and storage writes;
--             authenticated users write only under their own folder.
--
-- Validates: Requirements 2.19
-- Preserves: Requirements 3.7 (signup/KYC), 3.8 (authenticated uploads)
--
-- LIVE STATE VERIFIED 2025-07-12:
--   - profiles table: No anon INSERT policy exists (only SELECT for anon).
--   - storage profiles bucket: WRITE policies admit anon via role list, but
--     anon has no auth.uid() so folder check makes it dead. We tighten anyway.
--   - storage company-assets: Already authenticated-only. Left alone.
--   - product-images, shop-images, id_verification: No policies exist live.
--     We do NOT create new policies for these buckets.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTIONS 1 & 2: Revoke anon EXECUTE from profile-mutating + product functions
-- ============================================================================
-- Uses dynamic SQL to handle functions with multiple overloads.
-- For each function name, finds ALL overloads in pg_proc and revokes from each
-- one individually using its full OID-based identity. Safe if function doesn't
-- exist (the loop simply has zero iterations).

DO $$
DECLARE
  func_names text[] := ARRAY[
    -- Profile-mutating functions (never called pre-auth)
    'create_profile_unified',
    'handle_firebase_auth',
    'link_firebase_to_profile',
    'link_firebase_user_by_phone',
    'create_user_with_profile',
    'fix_profile_creation',
    'create_profile_safely',
    'create_profile_with_existing_auth_id',
    'create_user_profile',
    'create_user_profile_direct',
    'create_profile_no_constraint',
    'create_retailer_profile',
    'create_seller_profile',
    'diagnose_profile_creation',
    'create_profile_if_not_exists',
    'update_profile_with_business_details',
    'update_retailer_profile_safely',
    'reset_business_details',
    'update_business_details_standard',
    'restore_business_details',
    'update_business_details_only',
    'get_business_detail',
    -- Read-only product helpers (app requires login before browsing)
    'get_products_optimized',
    'get_seller_products_optimized',
    'get_category_products_optimized'
  ];
  fname text;
  func_oid oid;
BEGIN
  FOREACH fname IN ARRAY func_names
  LOOP
    -- Find all overloads of this function in the public schema
    FOR func_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fname
    LOOP
      -- Revoke from each overload using its OID-based identity
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', func_oid::regprocedure);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 3: Tighten profiles bucket WRITE policies (INSERT, UPDATE, DELETE)
-- ============================================================================
-- Live state: These policies use TO public with a WITH CHECK that includes
--   auth.role() IN ('authenticated','anon','service_role')
-- Fix: Drop and recreate with TO authenticated, same folder check.
--
-- NOTE: We do NOT touch "Users can view profile images" (SELECT) — reads stay public.
-- NOTE: We do NOT touch any company-assets policies — already authenticated-only.
-- NOTE: We do NOT create policies for product-images, shop-images, id_verification.

-- profiles bucket: INSERT policy
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
CREATE POLICY "Users can upload profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    ((storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- profiles bucket: UPDATE policy
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
CREATE POLICY "Users can update profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    ((storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
)
WITH CHECK (
  bucket_id = 'profiles' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    ((storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- profiles bucket: DELETE policy
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;
CREATE POLICY "Users can delete profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    ((storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- ============================================================================
-- SECTION 4: READ policies are explicitly LEFT UNCHANGED
-- ============================================================================
-- "Users can view profile images" (profiles bucket, SELECT, TO public) — kept.
-- "Users can view company assets" (company-assets bucket, SELECT, TO public) — kept.

-- ============================================================================
-- SECTION 5: Revoke DML grants on user_profiles view for anon
-- ============================================================================
DO $$ BEGIN
  REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMIT;
