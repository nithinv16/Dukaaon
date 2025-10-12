-- Check if status column exists and add it if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'status'
  ) THEN
    -- Add status column
    ALTER TABLE profiles ADD COLUMN status text DEFAULT 'active';
    RAISE NOTICE 'Added status column to profiles table';
  ELSE
    RAISE NOTICE 'Status column already exists in profiles table';
  END IF;
  
  -- Check if role column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
  ) THEN
    -- Add role column
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'retailer';
    RAISE NOTICE 'Added role column to profiles table';
  ELSE
    RAISE NOTICE 'Role column already exists in profiles table';
  END IF;
END;
$$;

-- Update profile with business_details and status
CREATE OR REPLACE FUNCTION update_profile_with_business_details(
  p_user_id UUID,
  p_business_details JSONB,
  p_role TEXT DEFAULT 'retailer',
  p_status TEXT DEFAULT 'active'
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
  current_details JSONB;
  merged_details JSONB;
  has_status BOOLEAN;
  has_role BOOLEAN;
BEGIN
  -- Check if columns exist
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'status'
  ) INTO has_status;
  
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
  ) INTO has_role;
  
  -- Get current business_details
  SELECT business_details INTO current_details
  FROM profiles
  WHERE id = p_user_id;
  
  IF current_details IS NULL THEN
    current_details = '{}'::JSONB;
  END IF;
  
  merged_details = current_details || p_business_details;
  
  -- Update the table with a dynamic SQL approach to handle potential missing columns
  IF has_status AND has_role THEN
    EXECUTE 'UPDATE profiles SET business_details = $1, status = $2, role = $3 WHERE id = $4 RETURNING id'
    INTO updated_profile_id
    USING merged_details, p_status, p_role, p_user_id;
  ELSIF has_status THEN
    EXECUTE 'UPDATE profiles SET business_details = $1, status = $2 WHERE id = $3 RETURNING id'
    INTO updated_profile_id
    USING merged_details, p_status, p_user_id;
  ELSIF has_role THEN
    EXECUTE 'UPDATE profiles SET business_details = $1, role = $2 WHERE id = $3 RETURNING id'
    INTO updated_profile_id
    USING merged_details, p_role, p_user_id;
  ELSE
    EXECUTE 'UPDATE profiles SET business_details = $1 WHERE id = $2 RETURNING id'
    INTO updated_profile_id
    USING merged_details, p_user_id;
  END IF;
  
  -- Return result
  IF updated_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found or update failed'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'id', updated_profile_id,
      'message', 'Profile updated successfully',
      'columns_updated', jsonb_build_object(
        'business_details', true,
        'status', has_status,
        'role', has_role
      )
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'code', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_profile_with_business_details TO authenticated;
GRANT EXECUTE ON FUNCTION update_profile_with_business_details TO anon;
GRANT EXECUTE ON FUNCTION update_profile_with_business_details TO service_role; 