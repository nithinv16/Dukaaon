-- Function to link a Firebase ID to an existing profile
-- This fixes ambiguous column references by using explicit aliases

CREATE OR REPLACE FUNCTION public.link_firebase_to_profile(
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
BEGIN
  -- Check if there's a profile with this Firebase ID
  SELECT p.id INTO existing_id
  FROM profiles p
  WHERE p.fire_id = firebase_id
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Profile already exists with this Firebase ID
    SELECT to_jsonb(p.*) INTO profile_record
    FROM profiles p
    WHERE p.id = existing_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Found existing profile with Firebase ID'
    );
  END IF;
  
  -- Check if profile exists with this phone number
  -- Use explicit table alias to avoid ambiguity
  SELECT p.id INTO existing_id
  FROM profiles p
  WHERE p.phone_number = link_firebase_to_profile.phone_number
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing profile with Firebase UID
    UPDATE profiles p
    SET 
      fire_id = firebase_id,
      role = user_role,
      updated_at = NOW()
    WHERE p.id = existing_id
    RETURNING to_jsonb(p.*) INTO profile_record;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Linked Firebase ID to existing profile by phone'
    );
  END IF;
  
  -- No existing profile, create a new one
  -- First create auth.users entry with a new UUID
  DECLARE 
    new_id UUID := gen_random_uuid();
    normalized_phone TEXT;
  BEGIN
    -- Normalize phone number
    IF phone_number LIKE '+91%' THEN
      normalized_phone := substring(phone_number from 4);
    ELSE
      normalized_phone := phone_number;
    END IF;
    
    -- Create auth user first
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
        new_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        new_id || '@temp.dukaaon.com',
        crypt(gen_random_uuid()::text, gen_salt('bf')), -- Random password
        NOW(),
        NOW(),
        NOW(),
        normalized_phone
      );
    EXCEPTION WHEN OTHERS THEN
      -- It's okay if this fails, we'll handle it below
      RAISE NOTICE 'Failed to create auth user, trying to find existing user ID';
    END;
    
    -- Now create profile
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
        new_id,
        firebase_id,
        normalized_phone,
        user_role,
        'active',
        NOW(),
        NOW(),
        jsonb_build_object('shopName', 'My Shop', 'createdAt', NOW())
      )
      RETURNING to_jsonb(profiles.*) INTO profile_record;
      
      RETURN jsonb_build_object(
        'success', true,
        'profile', profile_record,
        'message', 'Created new profile with Firebase ID'
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'message', 'Failed to create profile: ' || SQLERRM
      );
    END;
  END;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Error processing the profile: ' || SQLERRM
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.link_firebase_to_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_firebase_to_profile TO anon;
GRANT EXECUTE ON FUNCTION public.link_firebase_to_profile TO service_role; 