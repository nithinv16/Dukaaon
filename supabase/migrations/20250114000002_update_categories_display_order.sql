-- Update all home sections to match the new desired order:
-- 1. Dynamic Banners (order 1)
-- 2. Nearby Wholesalers (order 2)
-- 3. Nearby Manufacturers (order 3)
-- 4. Recommended for You (order 4)
-- 5. Trending Products (order 5)
-- 6. New Arrivals (order 6)
-- 7. Shop by Category (order 7)

-- Update Dynamic Banners to order 1
UPDATE home_sections 
SET display_order = 1
WHERE section_type = 'banner';

-- Update Nearby Wholesalers to order 2
UPDATE home_sections 
SET display_order = 2
WHERE section_type = 'sellers' 
  AND title = 'Nearby Wholesalers';

-- Update Nearby Manufacturers to order 3
UPDATE home_sections 
SET display_order = 3
WHERE section_type = 'manufacturers' 
  AND title = 'Nearby Manufacturers';

-- Update Recommended for You to order 4
UPDATE home_sections 
SET display_order = 4
WHERE section_type = 'personalized' 
  AND title = 'Recommended for You';

-- Update Trending Products to order 5
UPDATE home_sections 
SET display_order = 5
WHERE section_type = 'products' 
  AND title = 'Trending Products';

-- Update New Arrivals to order 6
UPDATE home_sections 
SET display_order = 6
WHERE section_type = 'products' 
  AND title = 'New Arrivals';

-- Update Shop by Category to order 7
UPDATE home_sections 
SET display_order = 7
WHERE section_type = 'categories' 
  AND title = 'Shop by Category';

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % home section(s) to new display order', updated_count;
  RAISE NOTICE 'New order: 1=Banners, 2=Wholesalers, 3=Manufacturers, 4=Recommended, 5=Trending, 6=New Arrivals, 7=Categories';
END $$;

