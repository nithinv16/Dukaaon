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
      AND (sd.status = 'active' OR sd.status IS NULL)
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
      AND (sd.status = 'active' OR sd.status IS NULL)
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

-- Modified test data for seller_details table
INSERT INTO seller_details (
  id,
  user_id,
  business_name,
  owner_name,
  address,
  latitude,
  longitude,
  seller_type,
  status,
  image_url
)
VALUES 
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Prime Wholesalers',
    'John Doe',
    '{"street": "123 Main St", "city": "New Delhi", "state": "Delhi", "pincode": "110001"}',
    28.6139, 
    77.2090,
    'wholesaler',
    'active',
    'seller-images/shop1.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Super Grocery Suppliers',
    'Jane Smith',
    '{"street": "456 Market Ave", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}',
    19.0760, 
    72.8777,
    'wholesaler',
    'active',
    'seller-images/shop2.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Mega Products Manufacturing',
    'Rajesh Kumar',
    '{"street": "789 Factory Lane", "city": "Bangalore", "state": "Karnataka", "pincode": "560001"}',
    12.9716, 
    77.5946,
    'manufacturer',
    'active',
    'seller-images/factory1.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Quality Manufacturing Co.',
    'Priya Sharma',
    '{"street": "101 Production Road", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"}',
    13.0827, 
    80.2707,
    'manufacturer',
    'active',
    'seller-images/factory2.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Local Wholesaler',
    'Local Owner',
    '{"street": "Local Street", "city": "Pathanamthitta", "state": "Kerala", "pincode": "689645"}',
    9.3954, 
    76.8398,
    'wholesaler',
    'active',
    'seller-images/shop3.jpg'
  ),
  (
    gen_random_uuid(),
    gen_random_uuid(),
    'Kerala Manufacturer',
    'Kerala Owner',
    '{"street": "Factory Road", "city": "Kottayam", "state": "Kerala", "pincode": "686001"}',
    9.5916, 
    76.5222,
    'manufacturer',
    'active',
    'seller-images/factory3.jpg'
  );

-- Function to get total count of wholesalers
CREATE OR REPLACE FUNCTION public.count_wholesalers()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COUNT(*) 
  FROM seller_details 
  WHERE seller_type = 'wholesaler' 
  AND (status = 'active' OR status IS NULL);
$$;

-- Function to get total count of manufacturers
CREATE OR REPLACE FUNCTION public.count_manufacturers()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COUNT(*) 
  FROM seller_details 
  WHERE seller_type = 'manufacturer' 
  AND (status = 'active' OR status IS NULL);
$$;

-- Simpler query to check seller data directly
CREATE OR REPLACE FUNCTION public.direct_nearby_wholesalers(
  radius_km FLOAT,
  user_lat FLOAT,
  user_lng FLOAT
)
RETURNS TABLE (
  user_id UUID,
  business_name TEXT,
  distance FLOAT
)
LANGUAGE sql
AS $$
  SELECT 
    sd.user_id,
    sd.business_name,
    (2 * 6371 * asin(
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
    AND (
      (2 * 6371 * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) <= radius_km
    )
  ORDER BY 
    distance ASC;
$$; 