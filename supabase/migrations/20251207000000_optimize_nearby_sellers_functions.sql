-- Functions to fetch wholesalers and manufacturers with location-based filtering
-- Uses bounding box pre-filtering for performance

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.find_nearby_wholesalers(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.find_nearby_manufacturers(double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.find_nearby_wholesalers(real, real, real);
DROP FUNCTION IF EXISTS public.find_nearby_manufacturers(real, real, real);
DROP FUNCTION IF EXISTS public.find_nearby_wholesalers(float, float, float);
DROP FUNCTION IF EXISTS public.find_nearby_manufacturers(float, float, float);
DROP FUNCTION IF EXISTS public.get_wholesalers();
DROP FUNCTION IF EXISTS public.get_manufacturers();

-- Function to get wholesalers with optional location filtering
CREATE OR REPLACE FUNCTION public.get_wholesalers(
  user_lat FLOAT DEFAULT NULL,
  user_lng FLOAT DEFAULT NULL,
  radius_km FLOAT DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  earth_radius FLOAT := 6371;
  lat_delta FLOAT;
  lng_delta FLOAT;
  min_lat FLOAT;
  max_lat FLOAT;
  min_lng FLOAT;
  max_lng FLOAT;
BEGIN
  -- If location parameters provided, filter by distance
  IF user_lat IS NOT NULL AND user_lng IS NOT NULL AND radius_km IS NOT NULL AND radius_km > 0 THEN
    -- Calculate bounding box for pre-filtering
    lat_delta := radius_km / 111.0;
    lng_delta := radius_km / (111.0 * cos(radians(user_lat)));
    
    min_lat := user_lat - lat_delta;
    max_lat := user_lat + lat_delta;
    min_lng := user_lng - lng_delta;
    max_lng := user_lng + lng_delta;

    RETURN QUERY
    SELECT 
      jsonb_build_object(
        'user_id', sd.user_id,
        'business_name', sd.business_name,
        'address', sd.address,
        'image_url', sd.image_url,
        'latitude', sd.latitude,
        'longitude', sd.longitude,
        'distance', (2 * earth_radius * asin(
          sqrt(
            pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
            cos(radians(user_lat)) * cos(radians(sd.latitude)) *
            pow(sin(radians(sd.longitude - user_lng) / 2), 2)
          )
        )),
        'description', sd.description
      )
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'wholesaler'
      AND sd.business_name IS NOT NULL
      AND sd.business_name != ''
      AND sd.latitude IS NOT NULL
      AND sd.longitude IS NOT NULL
      -- Bounding box filter (uses index!)
      AND sd.latitude BETWEEN min_lat AND max_lat
      AND sd.longitude BETWEEN min_lng AND max_lng
      -- Exact distance filter
      AND (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) <= radius_km
    ORDER BY 
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) ASC
    LIMIT 50;
  ELSE
    -- No location filtering, return all wholesalers
    RETURN QUERY
    SELECT 
      jsonb_build_object(
        'user_id', sd.user_id,
        'business_name', sd.business_name,
        'address', sd.address,
        'image_url', sd.image_url,
        'latitude', sd.latitude,
        'longitude', sd.longitude,
        'description', sd.description
      )
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'wholesaler'
      AND sd.business_name IS NOT NULL
      AND sd.business_name != ''
    ORDER BY 
      sd.business_name ASC;
  END IF;
END;
$$;

-- Function to get manufacturers with optional location filtering
CREATE OR REPLACE FUNCTION public.get_manufacturers(
  user_lat FLOAT DEFAULT NULL,
  user_lng FLOAT DEFAULT NULL,
  radius_km FLOAT DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  earth_radius FLOAT := 6371;
  lat_delta FLOAT;
  lng_delta FLOAT;
  min_lat FLOAT;
  max_lat FLOAT;
  min_lng FLOAT;
  max_lng FLOAT;
BEGIN
  -- If location parameters provided, filter by distance
  IF user_lat IS NOT NULL AND user_lng IS NOT NULL AND radius_km IS NOT NULL AND radius_km > 0 THEN
    -- Calculate bounding box for pre-filtering
    lat_delta := radius_km / 111.0;
    lng_delta := radius_km / (111.0 * cos(radians(user_lat)));
    
    min_lat := user_lat - lat_delta;
    max_lat := user_lat + lat_delta;
    min_lng := user_lng - lng_delta;
    max_lng := user_lng + lng_delta;

    RETURN QUERY
    SELECT 
      jsonb_build_object(
        'user_id', sd.user_id,
        'business_name', sd.business_name,
        'address', sd.address,
        'image_url', sd.image_url,
        'latitude', sd.latitude,
        'longitude', sd.longitude,
        'distance', (2 * earth_radius * asin(
          sqrt(
            pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
            cos(radians(user_lat)) * cos(radians(sd.latitude)) *
            pow(sin(radians(sd.longitude - user_lng) / 2), 2)
          )
        )),
        'description', sd.description
      )
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'manufacturer'
      AND sd.business_name IS NOT NULL
      AND sd.business_name != ''
      AND sd.latitude IS NOT NULL
      AND sd.longitude IS NOT NULL
      -- Bounding box filter (uses index!)
      AND sd.latitude BETWEEN min_lat AND max_lat
      AND sd.longitude BETWEEN min_lng AND max_lng
      -- Exact distance filter
      AND (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) <= radius_km
    ORDER BY 
      (2 * earth_radius * asin(
        sqrt(
          pow(sin(radians(sd.latitude - user_lat) / 2), 2) +
          cos(radians(user_lat)) * cos(radians(sd.latitude)) *
          pow(sin(radians(sd.longitude - user_lng) / 2), 2)
        )
      )) ASC
    LIMIT 50;
  ELSE
    -- No location filtering, return all manufacturers
    RETURN QUERY
    SELECT 
      jsonb_build_object(
        'user_id', sd.user_id,
        'business_name', sd.business_name,
        'address', sd.address,
        'image_url', sd.image_url,
        'latitude', sd.latitude,
        'longitude', sd.longitude,
        'description', sd.description
      )
    FROM 
      seller_details sd
    WHERE 
      sd.seller_type = 'manufacturer'
      AND sd.business_name IS NOT NULL
      AND sd.business_name != ''
    ORDER BY 
      sd.business_name ASC;
  END IF;
END;
$$;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Created functions with location filtering: get_wholesalers() and get_manufacturers()';
END $$;
