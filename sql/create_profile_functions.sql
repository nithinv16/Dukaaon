-- Create SQL functions to handle profile creation with auth.users constraint

-- Function to create a user in auth.users and profile in one transaction
CREATE OR REPLACE FUNCTION public.create_user_with_profile(
  p_email TEXT,
  p_phone TEXT,
  p_firebase_id TEXT,
  p_role TEXT DEFAULT 'retailer'
) RETURNS JSONB AS $$
DECLARE
  new_user_id UUID;
  profile_id UUID;
BEGIN
  -- Create auth user with random password
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id
    gen_random_uuid(),                       -- id (generate a UUID)
    'authenticated',                         -- aud
    'authenticated',                         -- role
    p_email,                                 -- email
    '$2a$10$RUZ1SpjK2cCDc/JHIx5rz.UMRR3gPIb4q7QPYjMGmjMXW3RtPtXfK', -- hashed password (dummy)
    now(),                                   -- email_confirmed_at
    null,                                    -- recovery_sent_at
    now(),                                   -- last_sign_in_at
    jsonb_build_object('provider', 'firebase', 'providers', jsonb_build_array('firebase')), -- raw_app_meta_data
    jsonb_build_object('firebase_uid', p_firebase_id), -- raw_user_meta_data
    now(),                                   -- created_at
    now(),                                   -- updated_at
    p_phone,                                 -- phone
    now()                                    -- phone_confirmed_at
  )
  RETURNING id INTO new_user_id;

  -- Create profile record using the same UUID
  INSERT INTO public.profiles (
    id,
    fire_id,
    phone_number,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    new_user_id,                             -- id (same as auth.users.id)
    p_firebase_id,                           -- fire_id (Firebase UID)
    p_phone,                                 -- phone_number
    p_role,                                  -- role
    'pending',                               -- status
    now(),                                   -- created_at
    now()                                    -- updated_at
  )
  RETURNING id INTO profile_id;

  -- Return the result
  RETURN jsonb_build_object(
    'id', profile_id,
    'auth_id', new_user_id,
    'fire_id', p_firebase_id,
    'phone', p_phone,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function that creates a profile using Firebase ID
CREATE OR REPLACE FUNCTION public.create_profile_direct(
  phone_number TEXT,
  firebase_uid TEXT,
  user_role TEXT DEFAULT 'retailer'
) RETURNS JSONB AS $$
DECLARE
  new_user_id UUID;
  profile_id UUID;
  email_value TEXT;
BEGIN
  -- Generate an email based on Firebase UID to prevent conflicts
  email_value := firebase_uid || '@firebase-auth.dukaaon.com';

  -- First check if user already exists with this Firebase UID
  SELECT p.id INTO profile_id
  FROM profiles p
  WHERE p.fire_id = firebase_uid;

  -- If profile already exists, return it
  IF profile_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', profile_id,
      'message', 'Profile already exists',
      'fire_id', firebase_uid
    );
  END IF;

  -- Create auth user with firebase info
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id
    gen_random_uuid(),                       -- id (generate a UUID)
    'authenticated',                         -- aud
    'authenticated',                         -- role
    email_value,                             -- email
    '$2a$10$RUZ1SpjK2cCDc/JHIx5rz.UMRR3gPIb4q7QPYjMGmjMXW3RtPtXfK', -- hashed password (dummy)
    now(),                                   -- email_confirmed_at
    null,                                    -- recovery_sent_at
    now(),                                   -- last_sign_in_at
    jsonb_build_object('provider', 'firebase', 'providers', jsonb_build_array('firebase')), -- raw_app_meta_data
    jsonb_build_object('firebase_uid', firebase_uid), -- raw_user_meta_data
    now(),                                   -- created_at
    now(),                                   -- updated_at
    phone_number,                            -- phone
    now()                                    -- phone_confirmed_at
  )
  RETURNING id INTO new_user_id;

  -- Create profile record using the same UUID
  INSERT INTO public.profiles (
    id,
    fire_id,
    phone_number,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    new_user_id,                             -- id (same as auth.users.id)
    firebase_uid,                            -- fire_id (Firebase UID)
    phone_number,                            -- phone_number
    user_role,                               -- role
    'pending',                               -- status
    now(),                                   -- created_at
    now()                                    -- updated_at
  )
  RETURNING id INTO profile_id;

  -- Return the result
  RETURN jsonb_build_object(
    'id', profile_id,
    'auth_id', new_user_id,
    'fire_id', firebase_uid,
    'phone', phone_number,
    'role', user_role
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'code', SQLSTATE,
      'fire_id', firebase_uid,
      'phone', phone_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 