-- Drop the undesired view and keep only the essential policies

-- First, ensure Row Level Security is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop the view we previously created
DROP VIEW IF EXISTS profile_business_details;

-- Make sure we keep the function for getting business details
DROP FUNCTION IF EXISTS update_profile_with_business_details CASCADE;

-- Create a clean version of get_business_detail without creating a view
CREATE OR REPLACE FUNCTION get_business_detail(
  profile_id UUID,
  property TEXT
) RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- This function is read-only, it will not modify data
  SELECT business_details->>property INTO result
  FROM profiles
  WHERE id = profile_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_business_detail TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_detail TO anon;
GRANT EXECUTE ON FUNCTION get_business_detail TO service_role;

-- Create a cleaner update function without the view dependency
CREATE OR REPLACE FUNCTION update_business_details_only(
  p_user_id UUID,
  p_business_details JSONB
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
  current_details JSONB;
  merged_details JSONB;
BEGIN
  -- Get current business_details
  SELECT business_details INTO current_details
  FROM profiles
  WHERE id = p_user_id;
  
  IF current_details IS NULL THEN
    current_details = '{}'::JSONB;
  END IF;
  
  -- Merge with new details, preserving existing values that aren't being updated
  merged_details = current_details || p_business_details;
  
  -- Update only the business_details column
  UPDATE profiles
  SET business_details = merged_details
  WHERE id = p_user_id
  RETURNING id INTO updated_profile_id;
  
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
      'message', 'Profile business details updated successfully'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_business_details_only TO authenticated;
GRANT EXECUTE ON FUNCTION update_business_details_only TO anon;
GRANT EXECUTE ON FUNCTION update_business_details_only TO service_role; 