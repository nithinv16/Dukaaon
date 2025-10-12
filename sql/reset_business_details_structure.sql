-- Reset business_details to have the correct structure
-- {"address": "", "pincode": "", "shopName": "", "gstNumber": null, "ownerName": "", "created_at": "2025-04-21T09:02:26.675617+00:00"}

-- Create a function to initialize or reset business_details to the standard format
CREATE OR REPLACE FUNCTION reset_business_details(
  p_user_id UUID,
  p_preserve_existing BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
  current_details JSONB;
  standard_details JSONB;
  final_details JSONB;
  created_at TEXT;
BEGIN
  -- Get current timestamp or use the provided one
  created_at := '2025-04-21T09:02:26.675617+00:00';
  
  -- Get current business_details if they exist
  SELECT business_details INTO current_details
  FROM profiles
  WHERE id = p_user_id;
  
  -- Create the standard structure
  standard_details := jsonb_build_object(
    'address', '',
    'pincode', '',
    'shopName', '',
    'gstNumber', null,
    'ownerName', '',
    'created_at', created_at
  );
  
  -- If preserving existing data and we have current details
  IF p_preserve_existing AND current_details IS NOT NULL THEN
    -- First apply the standard template to ensure all fields exist
    final_details := standard_details;
    
    -- Then overlay any existing values (keeping nulls where appropriate)
    IF current_details ? 'address' AND current_details->>'address' IS NOT NULL THEN
      final_details := final_details || jsonb_build_object('address', current_details->>'address');
    END IF;
    
    IF current_details ? 'pincode' AND current_details->>'pincode' IS NOT NULL THEN
      final_details := final_details || jsonb_build_object('pincode', current_details->>'pincode');
    END IF;
    
    IF current_details ? 'shopName' AND current_details->>'shopName' IS NOT NULL THEN
      final_details := final_details || jsonb_build_object('shopName', current_details->>'shopName');
    END IF;
    
    -- Handle gstNumber specifically since it can be null
    IF current_details ? 'gstNumber' THEN
      final_details := final_details || jsonb_build_object('gstNumber', current_details->'gstNumber');
    END IF;
    
    IF current_details ? 'ownerName' AND current_details->>'ownerName' IS NOT NULL THEN
      final_details := final_details || jsonb_build_object('ownerName', current_details->>'ownerName');
    END IF;
    
    -- Always use the standard created_at if not preserving exact date
    final_details := final_details || jsonb_build_object('created_at', created_at);
  ELSE
    -- Use standard template without preserving data
    final_details := standard_details;
  END IF;
  
  -- Update the profile
  UPDATE profiles
  SET business_details = final_details
  WHERE id = p_user_id
  RETURNING business_details INTO final_details;
  
  RETURN jsonb_build_object(
    'success', final_details IS NOT NULL,
    'business_details', final_details
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION reset_business_details TO authenticated;
GRANT EXECUTE ON FUNCTION reset_business_details TO anon;
GRANT EXECUTE ON FUNCTION reset_business_details TO service_role;

-- Create a template function that returns the standard business_details structure
CREATE OR REPLACE FUNCTION get_standard_business_details() 
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'address', '',
    'pincode', '',
    'shopName', '',
    'gstNumber', null,
    'ownerName', '',
    'created_at', '2025-04-21T09:02:26.675617+00:00'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update business_details with the standard structure
CREATE OR REPLACE FUNCTION update_business_details_standard(
  p_user_id UUID,
  p_address TEXT DEFAULT '',
  p_pincode TEXT DEFAULT '',
  p_shop_name TEXT DEFAULT '',
  p_gst_number JSONB DEFAULT NULL,
  p_owner_name TEXT DEFAULT '',
  p_image_url TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  updated_details JSONB;
  final_details JSONB;
BEGIN
  -- Build object with exact structure
  updated_details := jsonb_build_object(
    'address', p_address,
    'pincode', p_pincode,
    'shopName', p_shop_name,
    'gstNumber', p_gst_number,
    'ownerName', p_owner_name,
    'created_at', '2025-04-21T09:02:26.675617+00:00'
  );
  
  -- Add image URL if provided
  IF p_image_url IS NOT NULL THEN
    updated_details := updated_details || jsonb_build_object('imageUrl', p_image_url);
  END IF;
  
  -- Update the profile
  UPDATE profiles
  SET business_details = updated_details
  WHERE id = p_user_id
  RETURNING business_details INTO final_details;
  
  RETURN jsonb_build_object(
    'success', final_details IS NOT NULL,
    'business_details', final_details
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_business_details_standard TO authenticated;
GRANT EXECUTE ON FUNCTION update_business_details_standard TO anon;
GRANT EXECUTE ON FUNCTION update_business_details_standard TO service_role; 