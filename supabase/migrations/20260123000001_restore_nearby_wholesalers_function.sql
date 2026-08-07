-- Restore the find_nearby_wholesalers function that was accidentally dropped
-- This fixes the PGRST202 error: "Could not find the function public.find_nearby_wholesalers"

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
      p.id AS user_id,
      p.business_details->>'shopName' AS business_name,
      p.business_details->>'ownerName' AS owner_name,
      p.business_details->>'address' AS address,
      p.latitude,
      p.longitude,
      p.image_url,
      -- Calculate distance using Haversine formula
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(p.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(p.latitude)) *
          pow(sin(radians(p.longitude - user_lng) / 2), 2)
        )
      )) AS distance
    FROM 
      profiles p
    WHERE 
      p.role = 'wholesaler'
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND p.is_active = true
  )
  SELECT 
    jsonb_build_object(
      'user_id', s.user_id,
      'business_name', s.business_name,
      'owner_name', s.owner_name,
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

-- Restore the find_nearby_manufacturers function as well
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
      p.id AS user_id,
      p.business_details->>'shopName' AS business_name,
      p.business_details->>'ownerName' AS owner_name,
      p.business_details->>'address' AS address,
      p.latitude,
      p.longitude,
      p.image_url,
      -- Calculate distance using Haversine formula
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(p.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(p.latitude)) *
          pow(sin(radians(p.longitude - user_lng) / 2), 2)
        )
      )) AS distance
    FROM 
      profiles p
    WHERE 
      p.role = 'manufacturer'
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND p.is_active = true
  )
  SELECT 
    jsonb_build_object(
      'user_id', m.user_id,
      'business_name', m.business_name,
      'owner_name', m.owner_name,
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
