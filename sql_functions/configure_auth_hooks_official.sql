-- Official Supabase Auth Hooks Configuration
-- This script follows the official documentation approach for Custom Access Token Hook
-- Resolves "Custom OIDC provider 'firebase' not allowed" warning

-- IMPORTANT: Ensure the custom_access_token_hook function exists before running this script
-- (Run custom_access_token_hook.sql first if not already done)

-- Grant required permissions as per official documentation
-- The supabase_auth_admin role needs execute permission on the hook function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Grant usage on the public schema to supabase_auth_admin
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Revoke permissions from other roles for security
-- This ensures the function is not accessible by Supabase Data APIs
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Verification query to check if the function exists and has correct permissions
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.proacl as permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'custom_access_token_hook'
AND n.nspname = 'public';

-- Check if supabase_auth_admin role has execute permission
SELECT 
    r.rolname,
    p.proname,
    has_function_privilege(r.rolname, p.oid, 'EXECUTE') as has_execute_permission
FROM pg_roles r, pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE r.rolname = 'supabase_auth_admin'
AND p.proname = 'custom_access_token_hook'
AND n.nspname = 'public';

-- Instructions:
/*
OFFICIAL APPROACH IMPLEMENTATION:

1. ✅ config.toml Configuration:
   The hook is now configured in supabase/config.toml with:
   [auth.hook.custom_access_token]
   enabled = true
   uri = "pg-functions://postgres/public/custom_access_token_hook"

2. ✅ Permissions Setup:
   This script grants the minimal required permissions as specified in the official docs.

3. 🔄 Deployment:
   - Run: npx supabase db push
   - This will apply the config.toml changes and register the hook automatically
   - Supabase will handle the auth.hooks table registration

4. ✅ Security:
   - No SECURITY DEFINER functions (as recommended against in docs)
   - No manual auth.hooks table manipulation
   - Minimal permission grants only

BENEFITS OF THIS APPROACH:
- Follows official Supabase documentation exactly
- Better compatibility with Supabase updates
- Proper integration with the auth system
- Reduced maintenance overhead
- Official support coverage
- Automatic hook registration via config.toml

This resolves the "Custom OIDC provider 'firebase' not allowed" warning
by providing proper JWT claims for Firebase-authenticated users through
the official Supabase Auth Hooks mechanism.
*/

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Custom Access Token Hook permissions configured successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Ensure custom_access_token_hook function exists';
    RAISE NOTICE '2. Run: npx supabase db push';
    RAISE NOTICE '3. Test Firebase authentication';
END $$;