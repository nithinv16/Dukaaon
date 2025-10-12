-- Function to create a profile using an existing auth.users ID
-- This has a very high chance of success as it doesn't try to create new auth.users entries

CREATE OR REPLACE FUNCTION public.create_profile_with_existing_auth_id(
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
  auth_id UUID;
  normalized_phone TEXT;
BEGIN
  -- Log function call
  RAISE NOTICE 'create_profile_with_existing_auth_id called with firebase_id: %, phone: %', 
               firebase_id, phone_number;
  
  -- Normalize phone number
  IF phone_number LIKE '+91%' THEN
    normalized_phone := substring(phone_number from 4);
  ELSE
    normalized_phone := phone_number;
  END IF;
  
  -- First check if profile already exists with this Firebase ID or phone number
  SELECT id INTO existing_id
  FROM profiles
  WHERE fire_id = firebase_id OR phone_number = normalized_phone
  LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update the existing profile
    UPDATE profiles
    SET 
      fire_id = firebase_id,
      phone_number = normalized_phone,
      updated_at = NOW()
    WHERE id = existing_id
    RETURNING to_jsonb(profiles.*) INTO profile_record;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Updated existing profile'
    );
  END IF;
  
  -- Find an existing auth.users ID that doesn't have a profile yet
  SELECT u.id INTO auth_id
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  WHERE p.id IS NULL
  LIMIT 1;
  
  IF auth_id IS NULL THEN
    -- No available auth.users ID found
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No available auth.users ID found',
      'message', 'Please create at least one auth.users entry or use another function'
    );
  END IF;
  
  -- Create new profile with the existing auth.users ID
  BEGIN
    -- Create business details based on role
    DECLARE
      business_details_json JSONB;
      status_value TEXT;
    BEGIN
      -- For seller roles, keep business_details minimal since details go in seller_details table
      IF user_role = 'seller' THEN
        business_details_json := jsonb_build_object('createdAt', NOW());
        status_value := 'pending'; -- Sellers need KYC
      ELSE
        business_details_json := jsonb_build_object('shopName', 'My Shop', 'createdAt', NOW());
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
        auth_id,
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
    
    -- Update the auth.users record with matching phone if possible
    BEGIN
      UPDATE auth.users
      SET phone = normalized_phone
      WHERE id = auth_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not update auth.users phone, continuing anyway';
    END;
    
    RETURN jsonb_build_object(
      'success', true,
      'profile', profile_record,
      'message', 'Created new profile using existing auth.users ID'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error creating profile: ' || SQLERRM
    );
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_profile_with_existing_auth_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_with_existing_auth_id TO anon;
GRANT EXECUTE ON FUNCTION public.create_profile_with_existing_auth_id TO service_role; 