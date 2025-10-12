-- This script fixes issues with the RLS policies and nearby query functions

-- First, create or update an RLS policy for seller_details that allows public access
-- since the data shown to users should be accessible to everyone
ALTER TABLE seller_details ENABLE ROW LEVEL SECURITY;

-- Check if a policy exists and drop it if necessary
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'seller_details' AND policyname = 'seller_details_public_access'
    ) THEN
        DROP POLICY IF EXISTS seller_details_public_access ON seller_details;
    END IF;
END $$;

-- Create a new policy that allows anyone to read seller_details
CREATE POLICY seller_details_public_access ON seller_details
    FOR SELECT
    USING (TRUE);

-- Update the nearby wholesalers function to handle both status and is_active fields
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
      sd.id,
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
      AND (
        (sd.status = 'active' OR sd.status IS NULL)
        OR
        (sd.is_active = true)
      )
  )
  SELECT 
    jsonb_build_object(
      'id', s.id,
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

-- Update the nearby manufacturers function to handle both status and is_active fields
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
      sd.id,
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
      AND (
        (sd.status = 'active' OR sd.status IS NULL)
        OR
        (sd.is_active = true)
      )
  )
  SELECT 
    jsonb_build_object(
      'id', m.id,
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

-- Add a function to insert test data if none exists
CREATE OR REPLACE FUNCTION public.ensure_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wholesaler_count INTEGER;
  manufacturer_count INTEGER;
BEGIN
  -- Check if we already have data
  SELECT COUNT(*) INTO wholesaler_count FROM seller_details WHERE seller_type = 'wholesaler';
  SELECT COUNT(*) INTO manufacturer_count FROM seller_details WHERE seller_type = 'manufacturer';
  
  -- Only insert test data if we have no data
  IF wholesaler_count = 0 OR manufacturer_count = 0 THEN
    -- Insert some test data with random but valid coordinates
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
      is_active,
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
        true,
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
        true,
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
        true,
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
        true,
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
        true,
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
        true,
        'seller-images/factory3.jpg'
      );
  END IF;
END;
$$;

-- Run the function to ensure we have test data
SELECT public.ensure_test_data(); 