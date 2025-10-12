-- Test queries for troubleshooting the business_details 

-- Check if the shop-images bucket exists
SELECT * FROM storage.buckets WHERE id = 'shop-images';

-- List all policies for storage.objects
SELECT * FROM pg_policies WHERE tablename = 'objects';

-- List all policies for profiles table
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Check the structure of a sample profile with its business_details
SELECT 
  id, 
  fire_id, 
  role, 
  status,
  shop_name,
  owner_name,
  address,
  pincode,
  gst_number,
  shop_image,
  created_at,
  updated_at,
  business_details
FROM profiles
LIMIT 5;

-- Query to check a specific profile by ID (replace UUID with actual ID)
-- SELECT * FROM profiles WHERE id = 'your-profile-id';

-- Test the get_business_detail function
-- SELECT get_business_detail('your-profile-id', 'shopName');

-- View profile business details using the new view
SELECT * FROM profile_business_details LIMIT 5;

-- Test query to compare regular columns with business_details
SELECT 
  id,
  shop_name, 
  business_details->>'shopName' as bd_shop_name,
  owner_name,
  business_details->>'ownerName' as bd_owner_name,
  address,
  business_details->>'address' as bd_address,
  pincode,
  business_details->>'pincode' as bd_pincode,
  shop_image,
  business_details->>'imageUrl' as bd_image_url
FROM profiles
LIMIT 5;

-- Count profiles with missing or empty business_details
SELECT COUNT(*) 
FROM profiles 
WHERE business_details IS NULL OR business_details = '{}'::jsonb;

-- List profiles with their storage image URLs
SELECT id, fire_id, shop_name, shop_image 
FROM profiles 
WHERE shop_image IS NOT NULL; 