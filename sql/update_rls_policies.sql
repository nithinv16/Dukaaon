-- Update RLS policies for business_details JSON access

-- First, ensure Row Level Security is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing shop image policies if they exist
DROP POLICY IF EXISTS "Allow users to update shop images" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to access shop images" ON public.profiles;

-- Create policy to allow authenticated users to update their own shop image and business_details
CREATE POLICY "Allow users to update shop images and business_details"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  -- Allow access if authenticated via Supabase Auth
  (auth.uid() = id) OR
  -- Allow access if authenticated via Firebase (fire_id matches)
  (fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text)
)
WITH CHECK (
  -- Allow access if authenticated via Supabase Auth
  (auth.uid() = id) OR
  -- Allow access if authenticated via Firebase (fire_id matches)
  (fire_id = (current_setting('request.jwt.claims', true)::json->>'firebase_uid')::text)
);

-- Create function to extract business_details properties directly via SQL
CREATE OR REPLACE FUNCTION get_business_detail(
  profile_id UUID,
  property TEXT
) RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
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

-- Create a sample query to test business_details extraction
-- Example: SELECT get_business_detail('your-profile-id', 'shopName');

-- Create a view to easily access profile business details
CREATE OR REPLACE VIEW profile_business_details AS
SELECT 
  p.id,
  p.fire_id,
  p.phone_number,
  p.role,
  p.status,
  p.business_details->>'shopName' as shop_name,
  p.business_details->>'ownerName' as owner_name,
  p.business_details->>'address' as address,
  p.business_details->>'pincode' as pincode,
  p.business_details->>'gstNumber' as gst_number,
  p.business_details->>'imageUrl' as shop_image_url,
  p.created_at,
  p.updated_at
FROM 
  profiles p;

-- Grant access to this view
GRANT SELECT ON profile_business_details TO authenticated;
GRANT SELECT ON profile_business_details TO anon;
GRANT SELECT ON profile_business_details TO service_role; 