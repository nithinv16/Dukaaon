-- This script updates the nearby functions to remove status and is_active checks

-- Update the nearby wholesalers function to remove status checks
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

-- Update the nearby manufacturers function to remove status checks
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

-- Make sure we have a public RLS policy for seller_details
ALTER TABLE seller_details ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY seller_details_public_access ON seller_details
    FOR SELECT
    USING (TRUE); 