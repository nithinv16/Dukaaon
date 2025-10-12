-- Function to update business_details JSON field in profiles table
CREATE OR REPLACE FUNCTION public.update_profile_business_details(
  p_user_id UUID,
  p_shop_name TEXT,
  p_owner_name TEXT,
  p_address TEXT,
  p_pincode TEXT,
  p_gst_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  updated_user_id UUID;
  current_details JSONB;
  updated_details JSONB;
  result JSONB;
BEGIN
  -- First, get current business_details if available
  SELECT id, business_details INTO updated_user_id, current_details
  FROM profiles
  WHERE id = p_user_id;
  
  IF updated_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Handle null business_details by creating an empty object
  IF current_details IS NULL THEN
    current_details := '{}'::jsonb;
  END IF;
  
  -- Create updated business_details JSON
  updated_details := jsonb_build_object(
    'shopName', p_shop_name,
    'ownerName', p_owner_name,
    'address', p_address,
    'pincode', p_pincode,
    'created_at', CURRENT_TIMESTAMP
  );
  
  -- Add GST number if provided
  IF p_gst_number IS NOT NULL THEN
    updated_details := updated_details || jsonb_build_object('gstNumber', p_gst_number);
  ELSE
    updated_details := updated_details || jsonb_build_object('gstNumber', null);
  END IF;
  
  -- Update the user profile
  UPDATE profiles
  SET 
    business_details = updated_details,
    status = 'active',
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id
  RETURNING business_details INTO result;
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'business_details', result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'details', 'SQL error occurred while updating business_details'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 