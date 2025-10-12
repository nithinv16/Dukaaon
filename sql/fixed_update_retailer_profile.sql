-- Create a simpler function that only updates business_details
CREATE OR REPLACE FUNCTION update_retailer_profile_safely(
  p_user_id UUID,
  p_business_details JSONB
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
  current_details JSONB;
  merged_details JSONB;
BEGIN
  -- Get the current business_details
  SELECT business_details INTO current_details
  FROM profiles
  WHERE id = p_user_id;
  
  -- Default to empty JSONB if null
  IF current_details IS NULL THEN
    current_details = '{}'::JSONB;
  END IF;
  
  -- Merge current with new details
  merged_details = current_details || p_business_details;
  
  -- Add timestamp
  merged_details = merged_details || jsonb_build_object('updated_at', now());
  
  -- Do the update
  UPDATE profiles
  SET business_details = merged_details
  WHERE id = p_user_id
  RETURNING id INTO updated_profile_id;
  
  -- Return success/failure
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
      'business_details', merged_details
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_retailer_profile_safely TO authenticated;
GRANT EXECUTE ON FUNCTION update_retailer_profile_safely TO anon;
GRANT EXECUTE ON FUNCTION update_retailer_profile_safely TO service_role; 