-- Update nearby wholesalers and manufacturers RPC functions to include description field

-- Update find_nearby_wholesalers function to include description
-- Note: Parameter order matches the component call: user_lat, user_lng, radius_km
CREATE OR REPLACE FUNCTION public.find_nearby_wholesalers(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT
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
      sd.description,
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
      AND (sd.is_active = true OR sd.is_active IS NULL)
  )
  SELECT 
    jsonb_build_object(
      'user_id', s.user_id,
      'business_name', s.business_name,
      'address', s.address,
      'image_url', s.image_url,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'distance', s.distance,
      'description', s.description
    )
  FROM 
    sellers s
  WHERE 
    s.distance <= radius_km
  ORDER BY 
    s.distance ASC;
END;
$$;

-- Update find_nearby_manufacturers function to include description
-- Note: Parameter order matches the component call: user_lat, user_lng, radius_km
CREATE OR REPLACE FUNCTION public.find_nearby_manufacturers(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT
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
  WITH sellers AS (
    SELECT 
      sd.user_id,
      sd.business_name,
      sd.address,
      sd.latitude,
      sd.longitude,
      sd.image_url,
      sd.description,
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
      AND (sd.is_active = true OR sd.is_active IS NULL)
  )
  SELECT 
    jsonb_build_object(
      'user_id', s.user_id,
      'business_name', s.business_name,
      'address', s.address,
      'image_url', s.image_url,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'distance', s.distance,
      'description', s.description
    )
  FROM 
    sellers s
  WHERE 
    s.distance <= radius_km
  ORDER BY 
    s.distance ASC;
END;
$$;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Updated nearby wholesalers and manufacturers functions to include description field';
END $$;

