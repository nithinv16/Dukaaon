/**
 * Bug-condition exploration test — unnecessary anon privilege is exercisable.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 19)
 * Property 6: Bug Condition — Unnecessary anon privilege is exercisable
 *
 * **Validates: Requirements 1.19, 2.19**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED DATABASE. Each failure is a
 * counterexample proving that an anon-key-only caller can invoke profile-mutating
 * functions or write to storage buckets that should be restricted to authenticated
 * users. Do not weaken an assertion to make it green — it turns green after
 * task 21's revoke migration is applied.
 *
 * ---------------------------------------------------------------------------
 * Approach: Model-based assertions on SQL scripts
 * ---------------------------------------------------------------------------
 *
 * Since we cannot connect to the live database from a Jest test, this suite
 * performs model-based assertions: it reads the SQL scripts that define grants
 * and policies, and asserts that the GRANT/POLICY definitions do NOT admit `anon`
 * for profile-mutating functions and storage write operations.
 *
 * On the UNFIXED code, these assertions FAIL because:
 * - Profile-mutating functions have `GRANT EXECUTE ... TO anon` statements
 * - Storage write policies use `auth.role() IN ('authenticated','anon','service_role')`
 *
 * After task 21 applies the revoke migration, these assertions will PASS because:
 * - The grants are revoked
 * - Storage write policies are restricted to `auth.role() = 'authenticated'`
 *
 * ---------------------------------------------------------------------------
 * Scoped PBT approach
 * ---------------------------------------------------------------------------
 *
 * Bug condition from isBugCondition_C3:
 *   kind == 'db_grant' AND grantedTo(anon) AND NOT requiredByPreAuthFlow
 *   OR kind == 'storage_policy' AND admitsRole('anon') [on write operations]
 *
 * The domain is the set of SQL files containing GRANTs and POLICYs. Since this
 * is a finite, enumerable set, we use exhaustive checks rather than random
 * generation.
 */

import * as fs from 'fs';
import * as path from 'path';

const SQL_DIR = path.resolve(__dirname, '../../sql');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

/**
 * Helper: read a SQL file and return its content
 */
function readSqlFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Helper: check if a SQL file grants EXECUTE to anon for a given function
 */
function fileGrantsAnonExecute(content: string, functionName: string): boolean {
  // Match patterns like:
  //   GRANT EXECUTE ON FUNCTION public.<name> TO anon
  //   GRANT EXECUTE ON FUNCTION <name> TO authenticated, anon
  //   GRANT EXECUTE ON FUNCTION public.<name>(args) TO anon
  const patterns = [
    new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+(public\\.)?${functionName}\\b[^;]*\\bTO\\b[^;]*\\banon\\b`, 'i'),
  ];
  return patterns.some(p => p.test(content));
}

/**
 * Helper: check if a storage policy admits anon role for write operations
 */
function policyAdmitsAnonForWrites(content: string, policyName: string): boolean {
  // Look for the policy definition and check if it contains anon in the role check
  // The pattern is: auth.role() IN ('authenticated', 'anon', 'service_role')
  // within a INSERT/UPDATE/DELETE policy
  const policyRegex = new RegExp(
    `CREATE\\s+POLICY\\s+"${policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^;]*?FOR\\s+(INSERT|UPDATE|DELETE)[^;]*?auth\\.role\\(\\)\\s+IN\\s*\\([^)]*'anon'[^)]*\\)`,
    'is'
  );
  return policyRegex.test(content);
}

describe('Bug Condition: Unnecessary anon privilege (Property 6)', () => {

  describe('Profile-mutating functions should deny anon execution', () => {
    /**
     * These are functions that mutate user profiles. The design confirmed:
     * - Signup uses signInWithOtp (GoTrue, no Postgres grant needed)
     * - Profile creation happens post-auth (after verifyOtp)
     * - KYC screens run post-session
     *
     * Therefore, none of these functions need an `anon` grant.
     * On the unfixed code, they all HAVE an anon grant — so these assertions FAIL.
     */

    const profileMutatingFunctions: Array<{ name: string; sourceFile: string }> = [
      { name: 'create_profile_unified', sourceFile: 'direct_fix.sql' },
      { name: 'create_profile_unified', sourceFile: 'fix_create_profile_unified_return.sql' },
      { name: 'handle_firebase_auth', sourceFile: 'handle_firebase_auth.sql' },
      { name: 'link_firebase_to_profile', sourceFile: 'link_firebase_to_profile.sql' },
      { name: 'link_firebase_user_by_phone', sourceFile: 'link_firebase_user_by_phone.sql' },
      { name: 'create_user_with_profile', sourceFile: 'create_user_with_profile.sql' },
      { name: 'fix_profile_creation', sourceFile: 'fix_profile_creation.sql' },
      { name: 'create_profile_safely', sourceFile: 'create_profile_safely.sql' },
      { name: 'create_profile_with_existing_auth_id', sourceFile: 'create_profile_with_existing_auth_id.sql' },
      { name: 'create_user_profile', sourceFile: 'create_user_profile.sql' },
      { name: 'update_profile_with_business_details', sourceFile: 'check_and_fix_status.sql' },
      { name: 'update_retailer_profile_safely', sourceFile: 'fixed_update_retailer_profile.sql' },
      { name: 'reset_business_details', sourceFile: 'reset_business_details_structure.sql' },
      { name: 'update_business_details_standard', sourceFile: 'reset_business_details_structure.sql' },
      { name: 'restore_business_details', sourceFile: 'fix_overrides.sql' },
      { name: 'update_business_details_only', sourceFile: 'clean_up_rls_policies.sql' },
      { name: 'create_profile_if_not_exists', sourceFile: 'simple_profile_policies.sql' },
    ];

    test.each(profileMutatingFunctions)(
      'anon should NOT have EXECUTE on $name (source: $sourceFile)',
      ({ name, sourceFile }) => {
        const filePath = path.join(SQL_DIR, sourceFile);
        expect(fs.existsSync(filePath)).toBe(true);

        const content = readSqlFile(filePath);

        // ASSERTION: the file should NOT grant EXECUTE to anon for this function.
        // On unfixed code, this FAILS because the grants exist.
        expect(fileGrantsAnonExecute(content, name)).toBe(false);
      }
    );

    test('fix-database-schema.sql should NOT grant anon EXECUTE on profile functions', () => {
      const filePath = path.join(SQL_DIR, 'fix-database-schema.sql');
      const content = readSqlFile(filePath);

      // This file grants anon EXECUTE on 8+ profile functions in one block
      const profileFunctions = [
        'create_user_profile',
        'fix_profile_creation',
        'create_user_profile_direct',
        'create_profile_no_constraint',
        'create_retailer_profile',
        'create_seller_profile',
        'create_profile_unified',
        'diagnose_profile_creation',
      ];

      for (const fn of profileFunctions) {
        // Each of these should NOT be granted to anon
        expect(fileGrantsAnonExecute(content, fn)).toBe(false);
      }
    });
  });

  describe('Storage write policies should deny anon uploads', () => {
    /**
     * Storage write policies (INSERT, UPDATE, DELETE) currently use:
     *   auth.role() IN ('authenticated', 'anon', 'service_role')
     *
     * After the fix, they should use:
     *   auth.role() = 'authenticated'
     *
     * with an owner-prefix check for writes.
     */

    const storagePolicies: Array<{
      policyName: string;
      bucket: string;
      sourceFile: string;
      operation: string;
    }> = [
      {
        policyName: 'Users can upload product images',
        bucket: 'product-images',
        sourceFile: 'create_product_images_bucket.sql',
        operation: 'INSERT',
      },
      {
        policyName: 'Users can upload shop images',
        bucket: 'shop-images',
        sourceFile: 'create_shop_images_bucket.sql',
        operation: 'INSERT',
      },
      {
        policyName: 'Users can upload profile images',
        bucket: 'profiles',
        sourceFile: 'create_profiles_bucket.sql',
        operation: 'INSERT',
      },
      {
        policyName: 'Users can update their profile images',
        bucket: 'profiles',
        sourceFile: 'create_profiles_bucket.sql',
        operation: 'UPDATE',
      },
      {
        policyName: 'Users can delete their profile images',
        bucket: 'profiles',
        sourceFile: 'create_profiles_bucket.sql',
        operation: 'DELETE',
      },
      {
        policyName: 'Users can upload ID verification images',
        bucket: 'id_verification',
        sourceFile: 'create_id_verification_bucket.sql',
        operation: 'INSERT',
      },
    ];

    test.each(storagePolicies)(
      '$operation policy "$policyName" on $bucket should NOT admit anon',
      ({ policyName, sourceFile }) => {
        const filePath = path.join(SQL_DIR, sourceFile);
        expect(fs.existsSync(filePath)).toBe(true);

        const content = readSqlFile(filePath);

        // ASSERTION: the write policy should NOT include 'anon' in its role check.
        // On unfixed code, this FAILS because the policies use
        // auth.role() IN ('authenticated', 'anon', 'service_role')
        expect(policyAdmitsAnonForWrites(content, policyName)).toBe(false);
      }
    );
  });

  describe('Profiles table anon INSERT policy should not exist', () => {
    /**
     * simple_profile_policies.sql creates an "Allow public insert of profiles"
     * policy with `TO anon` and `WITH CHECK (true)` — meaning any anon caller
     * can insert any profile row.
     *
     * The pre-auth flow (signInWithOtp → verifyOtp) creates the session first,
     * so profile INSERT happens as `authenticated`. This blanket anon INSERT
     * is unnecessary and dangerous.
     */

    test('simple_profile_policies.sql should NOT have a blanket anon INSERT policy', () => {
      const filePath = path.join(SQL_DIR, 'simple_profile_policies.sql');
      const content = readSqlFile(filePath);

      // Check for the pattern: CREATE POLICY ... FOR INSERT TO anon WITH CHECK (true)
      const blanketAnonInsert = /CREATE\s+POLICY\s+"Allow public insert of profiles"[^;]*FOR\s+INSERT\s+TO\s+anon\s+WITH\s+CHECK\s*\(\s*true\s*\)/is;

      // ASSERTION: this policy should NOT exist.
      // On unfixed code, this FAILS because the policy is present.
      expect(blanketAnonInsert.test(content)).toBe(false);
    });
  });

  describe('Redundant service_role blanket policy should not exist', () => {
    /**
     * simple_profile_policies.sql creates:
     *   CREATE POLICY "Allow service role to manage profiles"
     *   ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true)
     *
     * service_role bypasses RLS anyway, so this policy grants nothing and only
     * obscures the real ones. It should be dropped.
     */

    test('simple_profile_policies.sql should NOT have a blanket service_role FOR ALL policy', () => {
      const filePath = path.join(SQL_DIR, 'simple_profile_policies.sql');
      const content = readSqlFile(filePath);

      const blanketServiceRole = /CREATE\s+POLICY\s+"Allow service role to manage profiles"[^;]*FOR\s+ALL\s+TO\s+service_role\s+USING\s*\(\s*true\s*\)/is;

      // ASSERTION: this policy should NOT exist in the source.
      // On unfixed code, this FAILS because the policy is present.
      expect(blanketServiceRole.test(content)).toBe(false);
    });
  });
});
