-- Configuration script to enable Custom Access Token Hook for Firebase Authentication
-- This script configures the auth hook to resolve Firebase OIDC provider warnings

-- First, ensure the custom_access_token_hook function exists
-- (Run custom_access_token_hook.sql first if not already done)

-- Configure the Custom Access Token Hook
INSERT INTO auth.hooks (
  id,
  hook_name,
  hook_type,
  postgres_function_name,
  enabled,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'firebase_custom_access_token',
  'custom_access_token',
  'public.custom_access_token_hook',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (hook_name) DO UPDATE SET
  postgres_function_name = EXCLUDED.postgres_function_name,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- Verify the hook was created successfully
SELECT 
  id,
  hook_name,
  hook_type,
  postgres_function_name,
  enabled,
  created_at
FROM auth.hooks 
WHERE hook_name = 'firebase_custom_access_token';

-- Grant necessary permissions to the auth admin role
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON auth.hooks TO supabase_auth_admin;

-- Additional security: Ensure only auth admin can execute the hook function
REVOKE ALL ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Create a helper function to check hook status
CREATE OR REPLACE FUNCTION public.check_auth_hooks_status()
RETURNS TABLE (
  hook_name text,
  hook_type text,
  function_name text,
  is_enabled boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    h.hook_name::text,
    h.hook_type::text,
    h.postgres_function_name::text,
    h.enabled,
    h.created_at
  FROM auth.hooks h
  ORDER BY h.created_at DESC;
$$;

-- Grant execute permission for the status check function
GRANT EXECUTE ON FUNCTION public.check_auth_hooks_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_hooks_status TO service_role;

COMMENT ON FUNCTION public.check_auth_hooks_status IS 'Helper function to check the status of configured auth hooks';

-- Instructions for manual configuration (if needed):
/*
If you prefer to configure via Supabase Dashboard:

1. Go to your Supabase Dashboard
2. Navigate to Authentication > Hooks
3. Click "Create a new hook"
4. Fill in the details:
   - Hook Name: firebase_custom_access_token
   - Type: Custom Access Token
   - Postgres Function: public.custom_access_token_hook
   - Enabled: ✓ (checked)
5. Click "Create Hook"

This will resolve the "Custom OIDC provider 'firebase' not allowed" warning
by providing proper JWT claims for Firebase-authenticated users.
*/