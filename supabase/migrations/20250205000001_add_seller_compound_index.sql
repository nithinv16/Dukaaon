-- Add compound index to improve performance of nearby sellers queries
-- This index covers the combination of seller_type, latitude, and longitude
-- which is exactly what the find_nearby_wholesalers and find_nearby_manufacturers functions use

-- Create a compound index for seller_type + location
CREATE INDEX IF NOT EXISTS idx_seller_details_type_location 
ON public.seller_details(seller_type, latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create an index for active status combined with seller type
CREATE INDEX IF NOT EXISTS idx_seller_details_active_type 
ON public.seller_details(is_active, seller_type)
WHERE is_active = true OR is_active IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Added compound indexes for improved nearby sellers query performance';
END $$;
