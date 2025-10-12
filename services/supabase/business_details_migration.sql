-- SQL script to add the business_details JSONB column to the profiles table
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS business_details JSONB DEFAULT jsonb_build_object(
  'shopName', '',
  'ownerName', '',
  'address', '',
  'pincode', '',
  'gstNumber', NULL,
  'created_at', CURRENT_TIMESTAMP
);

-- Add index for faster queries on business_details
CREATE INDEX IF NOT EXISTS idx_profiles_business_details
ON public.profiles USING gin (business_details);

-- Update RLS policies to use business_details
CREATE OR REPLACE FUNCTION public.shop_info_matches(search_term text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    business_details->>'shopName' ILIKE '%' || search_term || '%' OR
    business_details->>'ownerName' ILIKE '%' || search_term || '%' OR
    business_details->>'address' ILIKE '%' || search_term || '%' OR
    business_details->>'pincode' ILIKE '%' || search_term || '%'
  );
END;
$$ LANGUAGE plpgsql; 