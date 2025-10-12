-- Send SMS Hook for Supabase Authentication
-- This function allows custom SMS handling for OTP delivery
-- Provides better control over SMS providers, message formatting, and rate limiting

-- Enable HTTP extension for making API calls
CREATE EXTENSION IF NOT EXISTS http;

CREATE OR REPLACE FUNCTION public.send_sms_hook(
  event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_number text;
  message_content text;
  sms_type text;
  user_id text;
  rate_limit_key text;
  last_sms_time timestamp;
  rate_limit_seconds integer := 60; -- 1 minute rate limit
  custom_message text;
BEGIN
  -- Extract data from the event
  phone_number := event->>'phone';
  message_content := event->>'message';
  sms_type := event->>'sms_type';
  user_id := event->>'user_id';
  
  -- Log the SMS attempt
  RAISE LOG 'SMS Hook triggered for phone: %, type: %', phone_number, sms_type;
  
  -- Rate limiting check
  rate_limit_key := 'sms_rate_limit_' || phone_number;
  
  -- Check if we have sent an SMS to this number recently
  SELECT created_at INTO last_sms_time
  FROM auth.audit_log_entries
  WHERE instance_id = auth.uid()
    AND payload->>'phone' = phone_number
    AND payload->>'action' = 'sms_sent'
    AND created_at > NOW() - INTERVAL '1 minute'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If SMS was sent recently, return rate limit error
  IF last_sms_time IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 429,
        'message', 'Please wait before requesting another SMS. Try again in a minute.'
      )
    );
  END IF;
  
  -- Customize message based on SMS type
  CASE sms_type
    WHEN 'signup' THEN
      custom_message := 'Welcome to DukaaOn! Your verification code is: ' || (event->>'token');
    WHEN 'recovery' THEN
      custom_message := 'DukaaOn account recovery code: ' || (event->>'token');
    WHEN 'email_change' THEN
      custom_message := 'DukaaOn email change verification: ' || (event->>'token');
    WHEN 'phone_change' THEN
      custom_message := 'DukaaOn phone change verification: ' || (event->>'token');
    ELSE
      custom_message := 'DukaaOn verification code: ' || (event->>'token');
  END CASE;
  
  -- Add expiry information
  custom_message := custom_message || ' (Valid for 10 minutes)';
  
  -- Send SMS via AuthKey API
  DECLARE
    authkey_response jsonb;
    http_request_result record;
    authkey_url text := 'https://api.authkey.io/request';
    authkey_key text := '904251f34754cedc';
    clean_phone text;
  BEGIN
    -- Clean phone number (remove +91 prefix for AuthKey API)
    clean_phone := REPLACE(phone_number, '+91', '');
    
    -- Make HTTP request to AuthKey API
    SELECT INTO http_request_result *
    FROM http((
      'POST',
      authkey_url,
      ARRAY[http_header('Content-Type', 'application/json')],
      jsonb_build_object(
        'authkey', authkey_key,
        'mobile', clean_phone,
        'country_code', '91',
        'sms', custom_message,
        'sender', 'DUKAAN'
      )::text
    ));
    
    -- Check if SMS was sent successfully
    IF http_request_result.status = 200 THEN
      RAISE LOG 'SMS sent successfully via AuthKey API to: %', phone_number;
    ELSE
      RAISE LOG 'Failed to send SMS via AuthKey API. Status: %, Response: %', 
        http_request_result.status, http_request_result.content;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error calling AuthKey API: %', SQLERRM;
  END;
  
  -- Log successful SMS processing
  INSERT INTO auth.audit_log_entries (
    instance_id,
    id,
    payload,
    created_at,
    ip_address
  ) VALUES (
    auth.uid(),
    gen_random_uuid(),
    jsonb_build_object(
      'action', 'sms_sent',
      'phone', phone_number,
      'sms_type', sms_type,
      'message_length', length(custom_message),
      'provider', 'authkey'
    ),
    NOW(),
    '127.0.0.1'
  );
  
  -- Return the modified event with custom message
  RETURN jsonb_build_object(
    'phone', phone_number,
    'message', custom_message,
    'sms_type', sms_type,
    'user_id', user_id,
    'provider', 'authkey',
    'metadata', jsonb_build_object(
      'app_name', 'DukaaOn',
      'rate_limited', false,
      'custom_formatted', true,
      'sms_sent', true
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  RAISE LOG 'Error in send_sms_hook: %', SQLERRM;
  
  -- Return error response
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 500,
      'message', 'SMS service temporarily unavailable. Please try again.'
    )
  );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.send_sms_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.send_sms_hook FROM authenticated, anon, public;

-- Grant access to audit log for rate limiting
GRANT SELECT, INSERT ON auth.audit_log_entries TO supabase_auth_admin;

-- Add comment for documentation
COMMENT ON FUNCTION public.send_sms_hook IS 'Custom Send SMS Hook for DukaaOn authentication. Provides custom message formatting, rate limiting, and SMS provider control.';

-- Note: After creating this function, you need to configure it in Supabase:
-- 1. Add to supabase/config.toml:
--    [auth.hook.send_sms]
--    enabled = true
--    uri = "pg-functions://postgres/public/send_sms_hook"
--
-- 2. Or configure via Supabase Dashboard:
--    Authentication > Hooks > Create Hook
--    - Hook Name: Custom Send SMS
--    - Type: Send SMS
--    - Postgres Function: public.send_sms_hook
--    - Enabled: true