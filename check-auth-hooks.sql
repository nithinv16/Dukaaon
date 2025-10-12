-- Check for active auth hooks that might be causing JWT claims issues
SELECT 
    hook_name,
    hook_type,
    postgres_function_name,
    enabled,
    created_at
FROM auth.hooks
ORDER BY created_at DESC;

-- Also check if the custom_access_token_hook function exists
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'custom_access_token_hook';

-- Check function permissions
SELECT 
    has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook', 'execute') as has_execute_permission;