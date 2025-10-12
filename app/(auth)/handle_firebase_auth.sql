-- Function to properly handle Firebase authentication and user profile creation
-- Creates users in auth.users first, then creates matching profile with the same ID
-- Properly handles foreign key constraints between auth.users and profiles

CREATE OR REPLACE FUNCTION public.handle_firebase_auth(
  firebase_id TEXT,
  user_phone TEXT,
  user_role TEXT DEFAULT 'retailer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record JSONB;
  existing_id UUID;
  user_id UUID;
  normalized_phone TEXT;
BEGIN
  -- Validate inputs
  IF firebase_id IS NULL OR firebase_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Firebase ID is required',
      'message', 'Missing Firebase authentication ID'
    );
  END IF;
  
  -- Normalize phone number
  IF user_phone LIKE '+91%' THEN
    normalized_phone := substring(user_phone from 4);
  ELSE
    normalized_phone := user_phone;
  END IF;
  
  -- First check if a profile already exists with this Firebase ID
  SELECT id INTO existing_id
  FROM profiles
  WHERE fire_id = firebase_id
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Profile already exists, return it
    SELECT to_jsonb(profiles.*) INTO profile_record
    FROM profiles
    WHERE id = existing_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Found existing profile'
    );
  END IF;
  
  -- Check if a profile exists with this phone number
  SELECT id INTO existing_id
  FROM profiles
  WHERE phone_number = normalized_phone
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing profile with the Firebase ID
    UPDATE profiles
    SET 
      fire_id = firebase_id,
      updated_at = NOW()
    WHERE id = existing_id
    RETURNING to_jsonb(profiles.*) INTO profile_record;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Updated existing profile with Firebase ID'
    );
  END IF;
  
  -- No existing profile, create a new one
  -- First create a new auth.users record
  user_id := gen_random_uuid();
  
  -- Insert into auth.users
  BEGIN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      phone
    )
    VALUES (
      user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      user_id || '@temp.dukaaon.com',
      -- Use a secure password hash
      '$2a$10$pHfwuT8VXgBgPl2.yqmrk.KJWvs87iUQQREUGQxBn7IAU3Cc/0reS', 
      NOW(),
      NOW(),
      NOW(),
      normalized_phone
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create user in auth.users'
    );
  END;
  
  -- Now create the profile with the same ID
  BEGIN
    -- Determine status based on role
    DECLARE
      status_value TEXT := CASE WHEN user_role = 'seller' THEN 'pending' ELSE 'active' END;
      business_details_json JSONB := jsonb_build_object(
        'shopName', 'My Shop',
        'createdAt', NOW()
      );
    BEGIN
      INSERT INTO profiles (
        id,
        fire_id,
        phone_number,
        role,
        status,
        created_at,
        updated_at,
        business_details
      )
      VALUES (
        user_id,
        firebase_id,
        normalized_phone,
        user_role,
        status_value,
        NOW(),
        NOW(),
        business_details_json
      )
      RETURNING to_jsonb(profiles.*) INTO profile_record;
      
      RETURN jsonb_build_object(
        'success', true,
        'profile', profile_record,
        'message', 'Created new user and profile'
      );
    END;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create profile'
    );
  END;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.handle_firebase_auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_firebase_auth TO anon;
GRANT EXECUTE ON FUNCTION public.handle_firebase_auth TO service_role;

COMMENT ON FUNCTION public.handle_firebase_auth IS 'Handles Firebase authentication by creating or linking user profiles with proper auth.users entries.'; 
