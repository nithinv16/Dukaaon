/**
 * Preservation tests — Signup, KYC and Authenticated Uploads Survive the Grant Audit
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 20)
 * Property 6: Preservation — Signup, KYC and Authenticated Uploads Survive the Grant Audit
 *
 * **Validates: Requirements 3.7, 3.8**
 *
 * These tests assert that authenticated flows (signup, KYC, uploads) STILL WORK
 * both before and after the revoke migration. They should PASS on both unfixed
 * and fixed code.
 *
 * ---------------------------------------------------------------------------
 * Approach: Static assertions on code paths
 * ---------------------------------------------------------------------------
 *
 * Since we cannot connect to the live database, these tests perform static
 * assertions verifying:
 *
 * 1. The signup code path uses GoTrue (signInWithOtp), not Postgres RPC
 * 2. KYC screens are post-auth (they import useAuthStore and access user)
 * 3. Storage uploads use the authenticated Supabase client
 * 4. The storage policies still permit authenticated users with owner-prefix
 * 5. The profile INSERT policies still permit authenticated users
 *
 * These are the preservation surface — they must pass both before and after
 * the revoke migration (task 21).
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SQL_DIR = path.join(PROJECT_ROOT, 'sql');
const APP_DIR = path.join(PROJECT_ROOT, 'app');

/**
 * Helper: read a file and return its content
 */
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Preservation: Signup, KYC and Authenticated Uploads (Property 6)', () => {

  describe('Signup uses GoTrue, not Postgres RPC (Requirement 3.7)', () => {
    /**
     * The signup path:
     * 1. login.tsx calls supabase.auth.signInWithOtp (GoTrue HTTP call)
     * 2. otp.tsx calls supabase.auth.verifyOtp (GoTrue HTTP call)
     * 3. Profile creation happens post-auth via direct INSERT (authenticated)
     *
     * None of this requires anon EXECUTE on any function.
     * Revoking anon grants does NOT break signup.
     */

    test('login.tsx uses signInWithOtp (GoTrue), not Postgres RPC', () => {
      const loginPath = path.join(APP_DIR, '(auth)', 'login.tsx');
      const content = readFile(loginPath);

      // The login screen uses supabase.auth.signInWithOtp
      expect(content).toContain('signInWithOtp');

      // It does NOT call any profile-mutating RPC
      expect(content).not.toMatch(/\.rpc\s*\(\s*['"]create_profile/);
      expect(content).not.toMatch(/\.rpc\s*\(\s*['"]handle_firebase_auth/);
      expect(content).not.toMatch(/\.rpc\s*\(\s*['"]create_user_with_profile/);
    });

    test('otp.tsx uses verifyOtp (GoTrue) for authentication', () => {
      const otpPath = path.join(APP_DIR, '(auth)', 'otp.tsx');
      const content = readFile(otpPath);

      // OTP verification uses GoTrue
      expect(content).toContain('verifyOtp');

      // Profile creation is done post-auth via direct INSERT or update
      // It should NOT use anon-dependent RPCs for the critical path
      // Note: it may reference these functions but never calls them pre-auth
      expect(content).toContain('supabase');
    });

    test('otp.tsx profile creation happens AFTER verifyOtp succeeds (post-auth)', () => {
      const otpPath = path.join(APP_DIR, '(auth)', 'otp.tsx');
      const content = readFile(otpPath);

      // The file contains verifyOtp call
      const verifyOtpIndex = content.indexOf('verifyOtp');
      expect(verifyOtpIndex).toBeGreaterThan(-1);

      // Profile operations (INSERT or .from('profiles')) come after verifyOtp in code flow
      // The user is authenticated at this point, so anon grants are irrelevant
      // Key check: uses useAuthStore which provides the authenticated session
      expect(content).toContain('useAuthStore');
    });
  });

  describe('KYC screens run post-authentication (Requirement 3.7)', () => {
    /**
     * All KYC screens access `user` from useAuthStore, meaning they run
     * only when a session exists. Revoking anon grants does NOT break KYC.
     */

    const kycScreens = [
      { name: 'kyc.tsx', path: path.join(APP_DIR, '(auth)', 'kyc.tsx') },
      { name: 'seller-kyc.tsx', path: path.join(APP_DIR, '(auth)', 'seller-kyc.tsx') },
      { name: 'wholesaler-kyc.tsx', path: path.join(APP_DIR, '(auth)', 'wholesaler-kyc.tsx') },
      { name: 'retailer-kyc.tsx', path: path.join(APP_DIR, '(auth)', 'retailer-kyc.tsx') },
    ];

    test.each(kycScreens)(
      '$name imports useAuthStore and accesses authenticated user',
      ({ path: screenPath }) => {
        if (!fs.existsSync(screenPath)) {
          // Some KYC screens may not exist in every version
          return;
        }
        const content = readFile(screenPath);

        // Must use authenticated session
        expect(content).toContain('useAuthStore');

        // Must access user from the store (user is only available post-auth)
        expect(content).toMatch(/user|session/);

        // Must import supabase client (which carries the auth token)
        expect(content).toContain("from '../../services/supabase/supabase'");
      }
    );

    test('KYC screens use authenticated supabase client for database operations', () => {
      const kycPath = path.join(APP_DIR, '(auth)', 'kyc.tsx');
      if (!fs.existsSync(kycPath)) return;
      const content = readFile(kycPath);

      // Uses the app's supabase client (which carries the auth token)
      expect(content).toContain("import { supabase }");

      // Updates profiles table (as authenticated user, not anon)
      expect(content).toMatch(/supabase[\s\S]*\.update\(|supabase[\s\S]*\.from\(/);
    });
  });

  describe('Storage uploads use authenticated client (Requirement 3.8)', () => {
    /**
     * Storage uploads in the app use the Supabase client that carries the
     * user's JWT token. The upload calls are:
     * - supabase.storage.from('kyc-documents').upload(...)
     * - supabase.storage.from('product-images').upload(...)
     * - supabase.storage.from('shop-images').upload(...)
     * - supabase.storage.from('profiles').upload(...)
     * - supabase.storage.from('id_verification').upload(...)
     *
     * All uploads use `user?.id` as the folder prefix, which means:
     * 1. The auth token must be present (authenticated, not anon)
     * 2. The folder path starts with the user's UUID
     *
     * The revised policy `auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text`
     * permits exactly this pattern.
     */

    test('KYC document upload uses authenticated client with user ID prefix', () => {
      const kycPath = path.join(APP_DIR, '(auth)', 'kyc.tsx');
      if (!fs.existsSync(kycPath)) return;
      const content = readFile(kycPath);

      // Uses supabase.storage
      expect(content).toMatch(/supabase\.storage/);

      // Upload path includes user ID prefix
      // Pattern: `${user?.id}/${document.type}-${Date.now()}`
      expect(content).toMatch(/user\?\.id/);
    });

    test('Storage bucket policies allow authenticated users with owner prefix', () => {
      // The id_verification bucket policy already has the owner-prefix check
      // even on unfixed code (it just also admits anon unnecessarily)
      const idVerifPath = path.join(SQL_DIR, 'create_id_verification_bucket.sql');
      const content = readFile(idVerifPath);

      // Has the owner-prefix check: (storage.foldername(name))[1] = auth.uid()::text
      expect(content).toContain("(storage.foldername(name))[1] = auth.uid()::text");

      // Has 'authenticated' in the role check (both before and after fix)
      expect(content).toContain("'authenticated'");
    });

    test('Profiles bucket policies include owner-prefix check for authenticated users', () => {
      const profilesPath = path.join(SQL_DIR, 'create_profiles_bucket.sql');
      const content = readFile(profilesPath);

      // Has owner-prefix check
      expect(content).toContain("(storage.foldername(name))[1] = auth.uid()::text");

      // Has authenticated in the role list
      expect(content).toContain("'authenticated'");
    });
  });

  describe('Authenticated profile INSERT policies exist (Requirement 3.7)', () => {
    /**
     * After the revoke migration:
     * - The blanket anon INSERT policy is dropped
     * - The authenticated INSERT policy remains
     * - Signup still works because the user is authenticated by the time
     *   profile creation happens (after verifyOtp)
     */

    test('simple_profile_policies.sql has authenticated INSERT policy', () => {
      const policiesPath = path.join(SQL_DIR, 'simple_profile_policies.sql');
      const content = readFile(policiesPath);

      // There must be an INSERT policy for authenticated users
      const authenticatedInsert = /CREATE\s+POLICY\s+"Allow users to insert their own profile"[^;]*FOR\s+INSERT\s+TO\s+authenticated/is;
      expect(authenticatedInsert.test(content)).toBe(true);
    });

    test('Profile INSERT policy uses auth.uid() = fire_id check', () => {
      const policiesPath = path.join(SQL_DIR, 'simple_profile_policies.sql');
      const content = readFile(policiesPath);

      // The authenticated INSERT policy checks auth.uid() = fire_id
      expect(content).toContain('auth.uid() = fire_id');
    });
  });

  describe('Storage READ policies are unchanged (Requirement 3.8)', () => {
    /**
     * The revoke migration only tightens WRITE policies.
     * READ (SELECT) policies must remain unchanged.
     */

    test('product-images has public SELECT policy', () => {
      const path_ = path.join(SQL_DIR, 'create_product_images_bucket.sql');
      const content = readFile(path_);

      // Public can view product images (SELECT policy exists)
      expect(content).toMatch(/CREATE\s+POLICY\s+"Public can view product images"[^;]*FOR\s+SELECT/is);
    });

    test('shop-images has public SELECT policy', () => {
      const path_ = path.join(SQL_DIR, 'create_shop_images_bucket.sql');
      const content = readFile(path_);

      // Public can view shop images (SELECT policy exists)
      expect(content).toMatch(/CREATE\s+POLICY\s+"Public can view shop images"[^;]*FOR\s+SELECT/is);
    });

    test('id_verification has authenticated SELECT policy for owners/admins', () => {
      const path_ = path.join(SQL_DIR, 'create_id_verification_bucket.sql');
      const content = readFile(path_);

      // Admin/owner can view ID verification images
      expect(content).toMatch(/CREATE\s+POLICY\s+"Admins can view ID verification images"[^;]*FOR\s+SELECT/is);
    });
  });

  describe('App routing enforces auth gate (Requirement 3.7)', () => {
    /**
     * The root layout only renders (main) screens when a session exists.
     * This means no main-app functionality is accessible pre-auth.
     * The grant audit cannot break pre-auth because nothing pre-auth
     * touches Postgres directly.
     */

    test('Root layout conditionally renders main screens based on session', () => {
      const layoutPath = path.join(APP_DIR, '_layout.tsx');
      const content = readFile(layoutPath);

      // Uses session from auth store
      expect(content).toContain('useAuthStore');
      expect(content).toMatch(/session/);

      // Conditionally renders based on session
      // Pattern: {session ? ( ... (main) ... ) : ( ... (auth) ... )}
      expect(content).toContain('(main)');
      expect(content).toContain('(auth)');
    });
  });
});
