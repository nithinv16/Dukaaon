-- Function to update business_details in a profile 
-- This bypasses RLS and can be used to update profile info
CREATE OR REPLACE FUNCTION public.update_profile_business_details(
  profile_id uuid,
  business_details jsonb,
  firebase_id text DEFAULT NULL
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
  
  -- If firebase_id is provided, update that too
  IF firebase_id IS NOT NULL THEN
    UPDATE profiles
    SET 
      business_details = business_details,
      fire_id = firebase_id,
      updated_at = now()
    WHERE id = profile_id
    RETURNING * INTO _updated_profile;
  ELSE
    -- Otherwise just update the business_details
    UPDATE profiles
    SET 
      business_details = business_details,
      updated_at = now()
    WHERE id = profile_id
    RETURNING * INTO _updated_profile;
  END IF;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
END;
$$;

-- Comment for the function
COMMENT ON FUNCTION public.update_profile_business_details IS 'Updates business_details in a profile, bypassing RLS policies. Optionally links Firebase ID at the same time.';

-- Function to perform a complete profile update
-- This bypasses RLS and can update multiple fields at once
CREATE OR REPLACE FUNCTION public.update_profile_complete(
  profile_id uuid,
  updates jsonb
) RETURNS json
SECURITY DEFINER -- This runs with the privileges of the function creator (bypassing RLS)
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _profile_record record;
  _updated_profile record;
  _update_cols text[];
  _update_vals text[];
  _update_sql text;
  _key text;
  _value jsonb;
  _i integer;
BEGIN
  -- Find the profile
  SELECT * FROM profiles WHERE id = profile_id INTO _profile_record;
  
  IF _profile_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;
  
  -- Build dynamic SQL for the update
  -- This is more flexible than hardcoding columns
  _update_cols := ARRAY[]::text[];
  _update_vals := ARRAY[]::text[];
  _i := 0;
  
  FOR _key, _value IN SELECT * FROM jsonb_each(updates) LOOP
    _i := _i + 1;
    _update_cols := _update_cols || _key;
    _update_vals := _update_vals || format('$%s', _i);
  END LOOP;
  
  -- Always add updated_at
  _update_cols := _update_cols || 'updated_at';
  _update_vals := _update_vals || 'now()';
  
  -- Construct the SQL UPDATE statement
  _update_sql := format(
    'UPDATE profiles SET (%s) = ROW(%s) WHERE id = $%s RETURNING *',
    array_to_string(_update_cols, ', '),
    array_to_string(_update_vals, ', '),
    _i + 1
  );
  
  -- Execute the dynamic SQL
  EXECUTE _update_sql USING (SELECT * FROM jsonb_each_text(updates)), profile_id INTO _updated_profile;
  
  -- Return success and the updated profile
  RETURN json_build_object(
    'success', true,
    'profile', _updated_profile
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Comment for the function
COMMENT ON FUNCTION public.update_profile_complete IS 'Updates multiple fields in a profile at once, bypassing RLS policies. Pass any valid columns as a JSON object.'; 