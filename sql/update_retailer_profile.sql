-- Function to update retailer profile bypassing RLS
CREATE OR REPLACE FUNCTION public.update_retailer_profile(
  p_user_id UUID,
  p_shop_name TEXT,
  p_owner_name TEXT,
  p_address TEXT,
  p_pincode TEXT,
  p_gst_number TEXT DEFAULT NULL,
  p_shop_image TEXT DEFAULT NULL,
  p_business_details JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  updated_profile_id UUID;
  current_business_details JSONB;
  merged_business_details JSONB;
BEGIN
  -- First, get the current business_details
  SELECT business_details INTO current_business_details
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- If business_details doesn't exist yet, create a new one
  IF current_business_details IS NULL THEN
    current_business_details = '{}'::JSONB;
  END IF;
  
  -- If p_business_details is provided, merge it with current_business_details
  IF p_business_details IS NOT NULL THEN
    merged_business_details = current_business_details || p_business_details;
  ELSE
    -- Create a new business_details object with the updated fields
    merged_business_details = current_business_details || jsonb_build_object(
      'shopName', p_shop_name,
      'ownerName', p_owner_name,
      'address', p_address,
      'pincode', p_pincode,
      'gstNumber', p_gst_number,
      'imageUrl', p_shop_image,
      'updated_at', now()
    );
  END IF;

  -- Update the profile - ONLY update business_details, not columns that don't exist
  UPDATE public.profiles
  SET
    business_details = merged_business_details,
    status = 'active',
    updated_at = now()
  WHERE id = p_user_id
  RETURNING id INTO updated_profile_id;
  
  -- Return the result
  IF updated_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Profile not found or not updated'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'id', updated_profile_id,
      'message', 'Profile updated successfully'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 