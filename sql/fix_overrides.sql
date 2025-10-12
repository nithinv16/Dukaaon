-- Remove the profile_business_details view
DROP VIEW IF EXISTS profile_business_details;

-- Remove the test update that would have set shopName to 'Test Shop'
-- Note: This is just a cleanup, as the actual test update in check_profiles_table.sql 
-- was never executed because it required a profile ID to be filled in

-- Just for safety, let's clean up any profiles that might have been set to 'Test Shop'
UPDATE profiles
SET business_details = business_details - 'shopName' || jsonb_build_object('shopName', business_details->>'original_shopName')
WHERE business_details->>'shopName' = 'Test Shop' AND business_details ? 'original_shopName';

-- Let's also make sure our test function is accurate and won't modify data unexpectedly
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

-- Let's create a function to restore business_details if needed
CREATE OR REPLACE FUNCTION restore_business_details(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  current_details JSONB;
BEGIN
  -- Get current business_details
  SELECT business_details INTO current_details
  FROM profiles
  WHERE id = p_user_id;
  
  -- Return current details
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Current business details retrieved',
    'business_details', current_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to the function
GRANT EXECUTE ON FUNCTION restore_business_details TO authenticated;
GRANT EXECUTE ON FUNCTION restore_business_details TO anon;
GRANT EXECUTE ON FUNCTION restore_business_details TO service_role; 