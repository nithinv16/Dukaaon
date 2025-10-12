-- Function to find nearby wholesalers based on user location using seller_details table
CREATE OR REPLACE FUNCTION public.find_nearby_wholesalers(
  radius_km FLOAT,
  user_lat FLOAT,
  user_lng FLOAT
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  earth_radius FLOAT := 6371; -- in kilometers
BEGIN
  -- Verify parameters
  IF user_lat IS NULL OR user_lng IS NULL THEN
    RAISE EXCEPTION 'User location coordinates cannot be null';
  END IF;
  
  IF radius_km IS NULL OR radius_km <= 0 THEN
    RAISE EXCEPTION 'Radius must be greater than 0';
  END IF;

  -- Return wholesalers within the specified radius
  RETURN QUERY
  WITH sellers AS (
    SELECT 
      sd.user_id,
      sd.business_name,
      sd.address,
      sd.latitude,
      sd.longitude,
      sd.image_url,
      -- Calculate distance using Haversine formula
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) AS distance
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'wholesaler'
      AND sd.latitude IS NOT NULL
      AND sd.longitude IS NOT NULL
      AND sd.is_active = true
  )
  SELECT 
    jsonb_build_object(
      'user_id', s.user_id,
      'business_name', s.business_name,
      'address', s.address,
      'image_url', s.image_url,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'distance', s.distance
    )
  FROM 
    sellers s
  WHERE 
    s.distance <= radius_km
  ORDER BY 
    s.distance ASC;
END;
$$;

-- Function to find nearby manufacturers based on user location using seller_details table
CREATE OR REPLACE FUNCTION public.find_nearby_manufacturers(
  radius_km FLOAT,
  user_lat FLOAT,
  user_lng FLOAT
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  earth_radius FLOAT := 6371; -- in kilometers
BEGIN
  -- Verify parameters
  IF user_lat IS NULL OR user_lng IS NULL THEN
    RAISE EXCEPTION 'User location coordinates cannot be null';
  END IF;
  
  IF radius_km IS NULL OR radius_km <= 0 THEN
    RAISE EXCEPTION 'Radius must be greater than 0';
  END IF;

  -- Return manufacturers within the specified radius
  RETURN QUERY
  WITH manufacturers AS (
    SELECT 
      sd.user_id,
      sd.business_name,
      sd.address,
      sd.latitude,
      sd.longitude,
      sd.image_url,
      -- Calculate distance using Haversine formula
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) AS distance
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'manufacturer'
      AND sd.latitude IS NOT NULL
      AND sd.longitude IS NOT NULL
      AND sd.is_active = true
  )
  SELECT 
    jsonb_build_object(
      'user_id', m.user_id,
      'business_name', m.business_name,
      'address', m.address,
      'image_url', m.image_url,
      'latitude', m.latitude,
      'longitude', m.longitude,
      'distance', m.distance
    )
  FROM 
    manufacturers m
  WHERE 
    m.distance <= radius_km
  ORDER BY 
    m.distance ASC;
END;
$$;

-- Test data for seller_details table
INSERT INTO seller_details (
  id,
  user_id,
  business_name,
  address,
  latitude,
  longitude,
  seller_type,
  is_active,
  image_url
)
VALUES 
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Prime Wholesalers',
    '{"street": "123 Main St", "city": "New Delhi", "state": "Delhi", "pincode": "110001"}',
    28.6139, 
    77.2090,
    'wholesaler',
    true,
    'seller-images/shop1.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Super Grocery Suppliers',
    '{"street": "456 Market Ave", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}',
    19.0760, 
    72.8777,
    'wholesaler',
    true,
    'seller-images/shop2.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Mega Products Manufacturing',
    '{"street": "789 Factory Lane", "city": "Bangalore", "state": "Karnataka", "pincode": "560001"}',
    12.9716, 
    77.5946,
    'manufacturer',
    true,
    'seller-images/factory1.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Quality Manufacturing Co.',
    '{"street": "101 Production Road", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"}',
    13.0827, 
    80.2707,
    'manufacturer',
    true,
    'seller-images/factory2.jpg'
  );

-- Create function to examine the structure of seller_details table
CREATE OR REPLACE FUNCTION public.check_seller_details_structure()
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text
)
LANGUAGE sql
AS $$
  SELECT 
    column_name::text,
    data_type::text,
    is_nullable::text
  FROM 
    information_schema.columns
  WHERE 
    table_name = 'seller_details'
  ORDER BY 
    ordinal_position;
$$;

-- Query to test the structure of seller_details table
SELECT * FROM check_seller_details_structure();

-- Query to count wholesalers and manufacturers
SELECT 
  seller_type, 
  COUNT(*) AS count 
FROM 
  seller_details 
WHERE 
  is_active = true
GROUP BY 
  seller_type; 