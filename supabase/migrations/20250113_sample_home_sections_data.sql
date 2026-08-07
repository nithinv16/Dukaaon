-- =====================================================
-- SAMPLE DATA: Home Sections Configuration
-- Created: January 13, 2025
-- Purpose: Configure default home page layout for testing
-- =====================================================

-- Clear existing home sections (optional - remove if you want to keep existing data)
-- DELETE FROM home_sections;

-- =====================================================
-- INSERT HOME SECTIONS
-- =====================================================

-- 1. Dynamic Banners Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'banner',
  'Promotions',
  1,
  true,
  '{
    "auto_scroll": true,
    "interval": 3000,
    "show_indicators": true
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 2. Nearby Wholesalers Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'sellers',
  'Nearby Wholesalers',
  2,
  true,
  '{
    "show_title": true,
    "show_distance": true,
    "seller_type": "wholesaler"
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 3. Nearby Manufacturers Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'manufacturers',
  'Nearby Manufacturers',
  3,
  true,
  '{
    "show_title": true,
    "show_distance": true
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 4. Personalized Recommendations Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'personalized',
  'Recommended for You',
  4,
  true,
  '{
    "filter": "personalized",
    "limit": 10,
    "require_login": true
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 5. Trending Products Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'products',
  'Trending Products',
  5,
  true,
  '{
    "filter": "trending",
    "limit": 10,
    "show_price": true
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 6. New Products Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'products',
  'New Arrivals',
  6,
  true,
  '{
    "filter": "new",
    "limit": 10
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- 7. Categories Section
INSERT INTO home_sections (section_type, title, display_order, is_active, config) 
VALUES (
  'categories',
  'Shop by Category',
  7,
  true,
  '{
    "limit": 8,
    "show_product_count": true,
    "layout": "circular"
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE CATEGORIES (if not already present)
-- =====================================================

-- Only insert if categories table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories LIMIT 1) THEN
    -- Insert sample categories
    INSERT INTO categories (name, slug, display_order, is_active, icon) VALUES
      ('Groceries', 'groceries', 1, true, '🛒'),
      ('Snacks & Beverages', 'snacks-beverages', 2, true, '🍿'),
      ('Dairy Products', 'dairy', 3, true, '🥛'),
      ('Personal Care', 'personal-care', 4, true, '🧴'),
      ('Home Care', 'home-care', 5, true, '🧹'),
      ('Packaged Foods', 'packaged-foods', 6, true, '🍱'),
      ('Stationery', 'stationery', 7, true, '✏️'),
      ('Electronics', 'electronics', 8, true, '📱')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Sample categories inserted';
  ELSE
    RAISE NOTICE 'Categories already exist, skipping sample data';
  END IF;
END $$;

-- =====================================================
-- SAMPLE BANNERS (optional)
-- =====================================================

-- Insert sample banners for testing
INSERT INTO banners (title, subtitle, image_url, action_type, action_value, display_order, is_active, start_date, end_date) 
VALUES
  (
    'Welcome to Dukaaon!',
    'Your one-stop B2B marketplace',
    'https://via.placeholder.com/800x300/FF7D00/FFFFFF?text=Welcome+to+Dukaaon',
    'none',
    '',
    1,
    true,
    NOW(),
    NOW() + INTERVAL '30 days'
  ),
  (
    'Special Offer: 20% Off',
    'On all groceries this week',
    'https://via.placeholder.com/800x300/4CAF50/FFFFFF?text=20%+OFF',
    'category',
    'groceries',
    2,
    true,
    NOW(),
    NOW() + INTERVAL '7 days'
  ),
  (
    'New Arrivals',
    'Check out our latest products',
    'https://via.placeholder.com/800x300/2196F3/FFFFFF?text=New+Arrivals',
    'screen',
    '/(main)/screens/categories',
    3,
    true,
    NOW(),
    NOW() + INTERVAL '14 days'
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  section_count INTEGER;
  category_count INTEGER;
  banner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO section_count FROM home_sections WHERE is_active = true;
  SELECT COUNT(*) INTO category_count FROM categories WHERE is_active = true;
  SELECT COUNT(*) INTO banner_count FROM banners WHERE is_active = true;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'SAMPLE DATA INSERTED SUCCESSFULLY';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Home Sections: % active', section_count;
  RAISE NOTICE 'Categories: % active', category_count;
  RAISE NOTICE 'Banners: % active', banner_count;
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Your home page will now show:';
  RAISE NOTICE '  1. Dynamic promotional banners';
  RAISE NOTICE '  2. Nearby wholesalers';
  RAISE NOTICE '  3. Nearby manufacturers';
  RAISE NOTICE '  4. Recommended for You';
  RAISE NOTICE '  5. Trending products (10 items)';
  RAISE NOTICE '  6. New arrivals';
  RAISE NOTICE '  7. Shop by Category (8 categories)';
  RAISE NOTICE '===========================================';
END $$;

