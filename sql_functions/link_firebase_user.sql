-- Function to link a Firebase UID to an existing profile
-- This bypasses RLS and can be used to link profiles that already exist in the database
-- Run this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.link_firebase_user(
  profile_id uuid,
  firebase_id text
) RETURNS json
SECURITY DEFINER -- This runs with the privileges of the function creator (bypassing RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _profile_record record;
  _updated_profile record;
BEGIN
  -- Find the profile
  SELECT * FROM profiles WHERE id = profile_id INTO _profile_record;
  
  IF _profile_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;
  
  -- Check if this profile is already linked to another Firebase ID
  IF _profile_record.fire_id IS NOT NULL AND _profile_record.fire_id != firebase_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already linked to different Firebase ID',
      'current_fire_id', _profile_record.fire_id
    );
  END IF;
  
  -- Link the Firebase ID to the profile
  UPDATE profiles
  SET fire_id = firebase_id,
      updated_at = now()
  WHERE id = profile_id
  RETURNING * INTO _updated_profile;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
END;
$$;

-- Comment for the function
COMMENT ON FUNCTION public.link_firebase_user IS 'Links a Firebase UID to an existing profile. This bypasses RLS policies and can be used to manually connect profiles that already exist in the database to Firebase users.';

-- Additional function that handles linking by phone number
CREATE OR REPLACE FUNCTION public.link_firebase_user_by_phone(
  phone_number text,
  firebase_id text
) RETURNS json
SECURITY DEFINER -- This runs with the privileges of the function creator (bypassing RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _profile_record record;
  _updated_profile record;
BEGIN
  -- Find the profile by phone number
  SELECT * FROM profiles WHERE phone_number = link_firebase_user_by_phone.phone_number INTO _profile_record;
  
  IF _profile_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found with that phone number'
    );
  END IF;
  
  -- Check if this profile is already linked to another Firebase ID
  IF _profile_record.fire_id IS NOT NULL AND _profile_record.fire_id != firebase_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already linked to different Firebase ID',
      'current_fire_id', _profile_record.fire_id
    );
  END IF;
  
  -- Link the Firebase ID to the profile
  UPDATE profiles
  SET fire_id = firebase_id,
      updated_at = now()
  WHERE id = _profile_record.id
  RETURNING * INTO _updated_profile;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
END;
$$;

-- Comment for the second function
COMMENT ON FUNCTION public.link_firebase_user_by_phone IS 'Finds a profile by phone number and links it to a Firebase UID. This bypasses RLS policies and is useful for connecting existing profiles to Firebase users.'; 
 
-- This bypasses RLS and can be used to link profiles that already exist in the database
-- Run this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.link_firebase_user(
  profile_id uuid,
  firebase_id text
) RETURNS json
SECURITY DEFINER -- This runs with the privileges of the function creator (bypassing RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _profile_record record;
  _updated_profile record;
BEGIN
  -- Find the profile
  SELECT * FROM profiles WHERE id = profile_id INTO _profile_record;
  
  IF _profile_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;
  
  -- Check if this profile is already linked to another Firebase ID
  IF _profile_record.fire_id IS NOT NULL AND _profile_record.fire_id != firebase_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already linked to different Firebase ID',
      'current_fire_id', _profile_record.fire_id
    );
  END IF;
  
  -- Link the Firebase ID to the profile
  UPDATE profiles
  SET fire_id = firebase_id,
      updated_at = now()
  WHERE id = profile_id
  RETURNING * INTO _updated_profile;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
END;
$$;

-- Comment for the function
COMMENT ON FUNCTION public.link_firebase_user IS 'Links a Firebase UID to an existing profile. This bypasses RLS policies and can be used to manually connect profiles that already exist in the database to Firebase users.';

-- Additional function that handles linking by phone number
CREATE OR REPLACE FUNCTION public.link_firebase_user_by_phone(
  phone_number text,
  firebase_id text
) RETURNS json
SECURITY DEFINER -- This runs with the privileges of the function creator (bypassing RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _profile_record record;
  _updated_profile record;
BEGIN
  -- Find the profile by phone number
  SELECT * FROM profiles WHERE phone_number = link_firebase_user_by_phone.phone_number INTO _profile_record;
  
  IF _profile_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found with that phone number'
    );
  END IF;
  
  -- Check if this profile is already linked to another Firebase ID
  IF _profile_record.fire_id IS NOT NULL AND _profile_record.fire_id != firebase_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile already linked to different Firebase ID',
      'current_fire_id', _profile_record.fire_id
    );
  END IF;
  
  -- Link the Firebase ID to the profile
  UPDATE profiles
  SET fire_id = firebase_id,
      updated_at = now()
  WHERE id = _profile_record.id
  RETURNING * INTO _updated_profile;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
END;
$$;

-- Comment for the second function
COMMENT ON FUNCTION public.link_firebase_user_by_phone IS 'Finds a profile by phone number and links it to a Firebase UID. This bypasses RLS policies and is useful for connecting existing profiles to Firebase users.'; 
 