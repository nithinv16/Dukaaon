-- Enable Custom Access Token Hook for Firebase Authentication
-- This script ensures the custom hook is properly configured and enabled

-- Step 1: Check if the custom access token hook function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'custom_access_token_hook'
    ) THEN
        RAISE NOTICE 'Custom access token hook function not found. Please run custom_access_token_hook.sql first.';
    ELSE
        RAISE NOTICE 'Custom access token hook function exists.';
    END IF;
END $$;

-- Step 2: Remove any existing hook with the same name
DELETE FROM auth.hooks WHERE hook_name = 'firebase_custom_access_token';

-- Step 3: Insert the custom access token hook
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
);

-- Step 4: Verify the hook was created successfully
SELECT 
    id,
    hook_name,
    hook_type,
    postgres_function_name,
    enabled,
    created_at
FROM auth.hooks 
WHERE hook_name = 'firebase_custom_access_token';

-- Step 5: Check function permissions
SELECT 
    has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook', 'execute') as has_execute_permission;

-- Step 6: Grant necessary permissions if needed
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Step 7: Display final status
RAISE NOTICE 'Custom access token hook configuration completed.';
RAISE NOTICE 'Hook Name: firebase_custom_access_token';
RAISE NOTICE 'Hook Type: custom_access_token';
RAISE NOTICE 'Function: public.custom_access_token_hook';
RAISE NOTICE 'Status: Enabled';

-- Step 8: Test the hook function (optional)
-- Uncomment the following lines to test the hook
/*
SELECT public.custom_access_token_hook(
    jsonb_build_object('user_id', 'test-firebase-uid-123')
) as test_result;
*/