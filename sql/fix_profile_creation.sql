-- Function to properly create a user profile with auth.users entry
-- This handles the foreign key constraint properly

-- Drop any existing function with this name to avoid conflicts
DROP FUNCTION IF EXISTS public.fix_profile_creation(TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.fix_profile_creation(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.fix_profile_creation() CASCADE;
DROP FUNCTION IF EXISTS public.fix_profile_creation CASCADE;

CREATE OR REPLACE FUNCTION public.fix_profile_creation(
  firebase_id TEXT,
  phone_number TEXT,
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
  -- Log function call for debugging
  RAISE NOTICE 'fix_profile_creation called with firebase_id: %, phone: %, role: %', 
               firebase_id, phone_number, user_role;
               
  -- Normalize phone number
  IF phone_number LIKE '+91%' THEN
    normalized_phone := substring(phone_number from 4);
  ELSE
    normalized_phone := phone_number;
  END IF;
  
  -- First check if a profile already exists with this Firebase ID or phone
  SELECT p.id INTO existing_id
  FROM profiles p
  WHERE p.fire_id = firebase_id OR p.phone_number = normalized_phone
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing profile with Firebase ID and role
    UPDATE profiles
    SET fire_id = firebase_id,
        role = user_role,
        updated_at = NOW()
    WHERE id = existing_id
    RETURNING to_jsonb(profiles.*) INTO profile_record;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Updated existing profile'
    );
  END IF;

  -- No existing profile, we need to create auth.users entry first
  -- Try to find an existing auth.users record without a profile
  SELECT au.id INTO user_id
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.id
  WHERE p.id IS NULL
  LIMIT 1;
  
  -- If no existing auth.users record, create a new one
  IF user_id IS NULL THEN
    -- Generate a new UUID
    user_id := gen_random_uuid();
    
    -- Create auth.users entry
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
        phone,
        raw_app_meta_data,
        raw_user_meta_data
      )
      VALUES (
        user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        user_id || '@temp.dukaaon.com',
        -- Use a fixed encrypted password string for simplicity
        '$2a$10$pHfwuT8VXgBgPl2.yqmrk.KJWvs87iUQQREUGQxBn7IAU3Cc/0reS',
        NOW(),
        NOW(),
        NOW(),
        normalized_phone,
        '{"provider": "firebase"}',
        jsonb_build_object('phone', normalized_phone)
      );
      
      RAISE NOTICE 'Created new auth.users record with ID: %', user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating auth.users record: %', SQLERRM;
      
      -- Try one more approach - get any existing ID from auth.users
      SELECT id INTO user_id FROM auth.users LIMIT 1;
      
      IF user_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Cannot create auth.users record: ' || SQLERRM,
          'message', 'Database error - cannot create user record'
        );
      ELSE
        RAISE NOTICE 'Using existing auth.users ID as fallback: %', user_id;
      END IF;
    END;
  ELSE
    RAISE NOTICE 'Found existing auth.users record to use: %', user_id;
  END IF;
  
  -- Now create profile with the auth.users ID
  BEGIN
    -- Create business details based on role
    DECLARE
      business_details_json JSONB;
    BEGIN
      -- For seller roles, keep business_details minimal since details go in seller_details table
      IF user_role = 'seller' THEN
        business_details_json := jsonb_build_object('createdAt', NOW());
      ELSE
        business_details_json := jsonb_build_object(
          'shopName', 'My Shop', 
          'createdAt', NOW()
        );
      END IF;
      
      -- Set status based on role
      DECLARE
        status_value TEXT;
      BEGIN
        -- For sellers, set status to pending since they need KYC
        IF user_role = 'seller' THEN
          status_value := 'pending';
        ELSE
          status_value := 'active';
        END IF;
        
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
      END;
    END;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Created new profile successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error creating profile: ' || SQLERRM
    );
  END;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Unexpected error: ' || SQLERRM
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.fix_profile_creation TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_profile_creation TO anon;
GRANT EXECUTE ON FUNCTION public.fix_profile_creation TO service_role;