-- Deploy Send SMS Hook for DukaaOn
-- This script sets up the Send SMS hook with proper permissions and configuration

-- First, ensure the send_sms_hook function exists
-- (Run send_sms_hook.sql first if not already done)

-- Check if function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'send_sms_hook'
  ) THEN
    RAISE EXCEPTION 'Send SMS hook function not found. Please run send_sms_hook.sql first.';
  END IF;
END
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_sms_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Revoke permissions from other roles for security
REVOKE EXECUTE ON FUNCTION public.send_sms_hook FROM authenticated, anon, public;

-- Grant access to audit log for rate limiting functionality
GRANT SELECT, INSERT ON auth.audit_log_entries TO supabase_auth_admin;

-- Verify permissions
SELECT 
  has_function_privilege('supabase_auth_admin', 'public.send_sms_hook', 'execute') as has_execute_permission,
  has_table_privilege('supabase_auth_admin', 'auth.audit_log_entries', 'select') as has_audit_select,
  has_table_privilege('supabase_auth_admin', 'auth.audit_log_entries', 'insert') as has_audit_insert;

-- Display configuration instructions
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Send SMS Hook Deployment Complete ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Configuration added to supabase/config.toml:';
  RAISE NOTICE '[auth.hook.send_sms]';
  RAISE NOTICE 'enabled = true';
  RAISE NOTICE 'uri = "pg-functions://postgres/public/send_sms_hook"';
  RAISE NOTICE '';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '- Custom SMS message formatting';
  RAISE NOTICE '- Rate limiting (1 minute between SMS)';
  RAISE NOTICE '- SMS type-based message customization';
  RAISE NOTICE '- Audit logging for SMS attempts';
  RAISE NOTICE '- Error handling and fallback';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Deploy to Supabase using: supabase db push';
  RAISE NOTICE '2. Verify hook is active in Supabase Dashboard';
  RAISE NOTICE '3. Test OTP flow with new SMS handling';
  RAISE NOTICE '';
END
$$;

-- Test the function with sample data
SELECT public.send_sms_hook(
  jsonb_build_object(
    'phone', '+1234567890',
    'message', 'Your verification code is 123456',
    'sms_type', 'signup',
    'token', '123456',
    'user_id', 'test-user-id'
  )
) as test_result;

-- Display hook status
SELECT 
  'send_sms_hook' as hook_function,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'send_sms_hook'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status,
  has_function_privilege('supabase_auth_admin', 'public.send_sms_hook', 'execute') as auth_admin_access;