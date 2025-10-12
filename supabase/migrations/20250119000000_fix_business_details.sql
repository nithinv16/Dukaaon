-- Fix business details default values issue
-- This migration ensures proper handling of business_name and owner_name

-- 1. Remove default values from seller_details table
ALTER TABLE seller_details 
ALTER COLUMN business_name DROP DEFAULT,
ALTER COLUMN owner_name DROP DEFAULT;

-- 2. Update existing records with default values to NULL
UPDATE seller_details 
SET business_name = NULL 
WHERE business_name = 'My Business';

UPDATE seller_details 
SET owner_name = NULL 
WHERE owner_name = 'Owner Name';

-- 3. Create or replace the update_profile_business_details function
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
  
  -- Also update seller_details table if it exists
  UPDATE seller_details
  SET 
    business_name = p_shop_name,
    owner_name = p_owner_name,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;
  
  -- If no seller_details record exists, create one
  INSERT INTO seller_details (user_id, business_name, owner_name, created_at, updated_at)
  SELECT p_user_id, p_shop_name, p_owner_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  WHERE NOT EXISTS (SELECT 1 FROM seller_details WHERE user_id = p_user_id);
  
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

-- 4. Create or replace functions that were using COALESCE with defaults
CREATE OR REPLACE FUNCTION create_seller_profile(
    p_user_id UUID,
    p_business_name TEXT,
    p_owner_name TEXT,
    p_business_type TEXT DEFAULT 'retailer'
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Insert into seller_details without default values
    INSERT INTO seller_details (
        user_id,
        business_name,
        owner_name,
        business_type,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_business_name,  -- Use actual parameter, not COALESCE with default
        p_owner_name,     -- Use actual parameter, not COALESCE with default
        p_business_type,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        owner_name = EXCLUDED.owner_name,
        business_type = EXCLUDED.business_type,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Seller profile created/updated successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    RAISE NOTICE 'Business details fix migration completed successfully!';
    RAISE NOTICE 'Default values removed and functions updated to use actual form data.';
END $$;