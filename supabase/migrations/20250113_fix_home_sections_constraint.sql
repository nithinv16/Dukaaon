-- =====================================================
-- FIX: Update home_sections check constraint
-- Issue: Original constraint doesn't include new section types
-- Solution: Update constraint to include all our section types
-- =====================================================

-- Drop the old check constraint
ALTER TABLE home_sections 
DROP CONSTRAINT IF EXISTS home_sections_section_type_check;

-- Add new check constraint with all section types
ALTER TABLE home_sections 
ADD CONSTRAINT home_sections_section_type_check 
CHECK (section_type IN (
  'banner',              -- Dynamic promotional banners
  'categories',          -- Category carousel (our new name)
  'category_grid',       -- Category grid (original name)
  'products',            -- Product carousel (our new name)
  'product_carousel',    -- Product carousel (original name)
  'personalized',        -- Personalized recommendations
  'sellers',             -- Nearby wholesalers/sellers
  'manufacturers',       -- Nearby manufacturers
  'offer_banner',        -- Special offer banners
  'quick_links',         -- Quick action links
  'brand_carousel',      -- Brand showcase
  'video_banner'         -- Video content
));

-- Verification
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'HOME SECTIONS CONSTRAINT UPDATED';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Allowed section types:';
  RAISE NOTICE '  ✓ banner';
  RAISE NOTICE '  ✓ categories (NEW)';
  RAISE NOTICE '  ✓ category_grid';
  RAISE NOTICE '  ✓ products (NEW)';
  RAISE NOTICE '  ✓ product_carousel';
  RAISE NOTICE '  ✓ personalized (NEW)';
  RAISE NOTICE '  ✓ sellers (NEW)';
  RAISE NOTICE '  ✓ manufacturers (NEW)';
  RAISE NOTICE '  ✓ offer_banner';
  RAISE NOTICE '  ✓ quick_links';
  RAISE NOTICE '  ✓ brand_carousel';
  RAISE NOTICE '  ✓ video_banner';
  RAISE NOTICE '===========================================';
END $$;

