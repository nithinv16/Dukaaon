-- Custom Access Token Hook for Firebase Authentication
-- This function resolves the "Custom OIDC provider 'firebase' not allowed" warning
-- by providing custom JWT claims for Firebase-authenticated users

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(
  event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_profile record;
  firebase_uid text;
BEGIN
  -- Extract the user ID from the event
  firebase_uid := event->>'user_id';
  
  -- Initialize claims with default values
  claims := jsonb_build_object(
    'iss', 'https://your-project.supabase.co/auth/v1',
    'aud', 'authenticated',
    'role', 'authenticated'
  );
  
  -- Try to find the user profile by Firebase ID
  SELECT * INTO user_profile
  FROM profiles
  WHERE fire_id = firebase_uid
  LIMIT 1;
  
  -- If profile found, add custom claims
  IF user_profile IS NOT NULL THEN
    claims := claims || jsonb_build_object(
      'user_id', user_profile.id,
      'firebase_uid', user_profile.fire_id,
      'phone_number', user_profile.phone_number,
      'role', COALESCE(user_profile.role, 'retailer'),
      'status', COALESCE(user_profile.status, 'active'),
      'business_details', user_profile.business_details,
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      ),
      'user_metadata', jsonb_build_object(
        'phone_number', user_profile.phone_number,
        'role', user_profile.role,
        'firebase_uid', user_profile.fire_id
      )
    );
  ELSE
    -- If no profile found, add minimal claims for Firebase user
    claims := claims || jsonb_build_object(
      'firebase_uid', firebase_uid,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      ),
      'user_metadata', jsonb_build_object(
        'firebase_uid', firebase_uid
      )
    );
  END IF;
  
  -- Return the event with custom claims
  RETURN jsonb_build_object(
    'claims', claims
  );
  
EXCEPTION WHEN OTHERS THEN
  -- In case of any error, return minimal safe claims
  RETURN jsonb_build_object(
    'claims', jsonb_build_object(
      'iss', 'https://your-project.supabase.co/auth/v1',
      'aud', 'authenticated',
      'role', 'authenticated',
      'firebase_uid', firebase_uid,
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      )
    )
  );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Add comment for documentation
COMMENT ON FUNCTION public.custom_access_token_hook IS 'Custom Access Token Hook for Firebase authentication. Resolves OIDC provider warnings by providing custom JWT claims for Firebase-authenticated users.';

-- Note: After creating this function, you need to configure it in Supabase Dashboard:
-- 1. Go to Authentication > Hooks in your Supabase Dashboard
-- 2. Create a new hook with:
--    - Hook Name: Firebase Custom Access Token
--    - Type: Custom Access Token
--    - Postgres Function: public.custom_access_token_hook
--    - Enabled: true

-- Alternative: You can also configure it via SQL:
-- INSERT INTO auth.hooks (hook_name, hook_type, postgres_function_name, enabled)
-- VALUES ('firebase_custom_access_token', 'custom_access_token', 'public.custom_access_token_hook', true);