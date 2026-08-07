-- =====================================================
-- DYNAMIC CONTENT MANAGEMENT SYSTEM
-- Migration to enable dynamic content without app updates
-- =====================================================

-- 1. APP CONFIGURATION TABLE
-- Store all app-level configurations that can be changed remotely
CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_app_config_active ON app_config(is_active);

-- Insert default configurations
INSERT INTO app_config (key, value, description) VALUES
  ('min_order_amount', '{"amount": 200, "currency": "INR"}', 'Minimum order amount for checkout'),
  ('delivery_radius_km', '{"max": 50, "default": 10}', 'Maximum delivery distance in kilometers'),
  ('maintenance_mode', '{"enabled": false, "message": "We are currently under maintenance. Please try again later."}', 'App maintenance mode control'),
  ('featured_categories', '{"categories": ["groceries", "beverages", "snacks", "personal-care"]}', 'Categories featured on home screen'),
  ('payment_methods', '{"cod": true, "online": true, "wallet": false}', 'Available payment methods'),
  ('app_version', '{"min_version": "1.0.0", "recommended_version": "1.0.0", "force_update": false}', 'App version control'),
  ('delivery_charges', '{"free_above": 500, "base_charge": 50, "per_km": 10}', 'Delivery charge calculation'),
  ('customer_support', '{"phone": "+91-1234567890", "email": "support@dukaaon.com", "hours": "9 AM - 9 PM"}', 'Customer support details')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 2. BANNERS TABLE
-- Dynamic banners for home screen carousel
-- =====================================================
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('category', 'product', 'url', 'screen', 'none')),
  action_value TEXT,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
  target_user_types TEXT[], -- ['retailer', 'wholesaler', 'manufacturer', 'all']
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position);

-- =====================================================
-- 3. PROMOTIONS TABLE
-- Discount codes, offers, and promotions
-- =====================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'bogo', 'free_shipping')),
  discount_value NUMERIC,
  image_url TEXT,
  applicable_to TEXT CHECK (applicable_to IN ('all', 'category', 'product', 'user_segment', 'first_order')),
  applicable_ids TEXT[], -- category_ids, product_ids, or user segment identifiers
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
  usage_limit INTEGER, -- NULL means unlimited
  usage_per_user INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- Track promotion usage
CREATE TABLE IF NOT EXISTS promotion_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  order_id UUID,
  discount_applied NUMERIC,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_user ON promotion_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);

-- =====================================================
-- 4. FEATURE FLAGS TABLE
-- Control feature availability without app updates
-- =====================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  target_user_types TEXT[], -- ['retailer', 'wholesaler', 'manufacturer', 'all']
  config JSONB, -- Additional feature-specific configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled);

-- Insert default feature flags
INSERT INTO feature_flags (feature_key, is_enabled, description, config) VALUES
  ('voice_search', true, 'Enable voice search feature', '{"provider": "azure"}'),
  ('ai_assistant', true, 'Enable AI ordering assistant', '{"provider": "bedrock"}'),
  ('quick_reorder', true, 'Enable one-click reorder from order history', NULL),
  ('loyalty_program', false, 'Enable loyalty points system', '{"points_per_rupee": 1, "redemption_ratio": 100}'),
  ('live_chat', true, 'Enable live chat support', NULL),
  ('wishlist', true, 'Enable wishlist feature', NULL),
  ('product_reviews', false, 'Enable product reviews and ratings', NULL),
  ('ocr_invoice', true, 'Enable OCR-based invoice upload', NULL),
  ('phone_order', true, 'Enable phone-based ordering', NULL),
  ('delivery_tracking', true, 'Enable real-time delivery tracking', NULL),
  ('multi_language', true, 'Enable multi-language support', '{"languages": ["en", "hi", "te", "ta", "kn"]}')
ON CONFLICT (feature_key) DO NOTHING;

-- =====================================================
-- 5. CATEGORIES TABLE (Proper)
-- Replace hardcoded categories with database-driven ones
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT,
  icon_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Store colors, tags, icons, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- Insert default categories
INSERT INTO categories (name, slug, display_order, is_active, metadata) VALUES
  ('Groceries', 'groceries', 1, true, '{"color": "#4CAF50", "icon": "food"}'),
  ('Personal Care', 'personal-care', 2, true, '{"color": "#FF6B9D", "icon": "human"}'),
  ('Household', 'household', 3, true, '{"color": "#2196F3", "icon": "home"}'),
  ('Beverages', 'beverages', 4, true, '{"color": "#FF9800", "icon": "water"}'),
  ('Snacks', 'snacks', 5, true, '{"color": "#F44336", "icon": "food-variant"}'),
  ('Stationery', 'stationery', 6, true, '{"color": "#9C27B0", "icon": "pencil"}'),
  ('Electronics', 'electronics', 7, true, '{"color": "#607D8B", "icon": "devices"}'),
  ('Health & Wellness', 'health-wellness', 8, true, '{"color": "#00BCD4", "icon": "medical-bag"}')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 6. SUBCATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcategories_slug ON subcategories(slug);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_active ON subcategories(is_active);

-- =====================================================
-- 7. HOME SECTIONS TABLE
-- Control home screen layout dynamically
-- =====================================================
CREATE TABLE IF NOT EXISTS home_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_type TEXT CHECK (section_type IN ('banner', 'category_grid', 'product_carousel', 'offer_banner', 'quick_links', 'brand_carousel', 'video_banner')),
  title TEXT,
  subtitle TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  config JSONB NOT NULL, -- Section-specific configuration
  target_user_types TEXT[], -- Who can see this section
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_sections_order ON home_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_home_sections_active ON home_sections(is_active);

-- Insert default home sections
INSERT INTO home_sections (section_type, title, display_order, is_active, config) VALUES
  ('banner', NULL, 1, true, '{
    "auto_scroll": true,
    "interval": 3000,
    "height": 200,
    "show_indicators": true
  }'),
  ('category_grid', 'Shop by Category', 2, true, '{
    "columns": 4,
    "show_all_button": true,
    "style": "grid"
  }'),
  ('product_carousel', 'Trending Products', 3, true, '{
    "query_type": "trending",
    "limit": 20,
    "show_price": true,
    "show_cart_button": true
  }'),
  ('product_carousel', 'Best Sellers', 4, true, '{
    "query_type": "best_sellers",
    "limit": 20,
    "show_price": true,
    "show_cart_button": true
  }'),
  ('offer_banner', 'Special Offers', 5, true, '{
    "layout": "horizontal",
    "max_promotions": 3
  }')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. TRANSLATIONS TABLE
-- Manage translations dynamically
-- =====================================================
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  language TEXT NOT NULL,
  value TEXT NOT NULL,
  context TEXT, -- 'category', 'product', 'ui', 'error', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(key, language)
);

CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON translations(key, language);
CREATE INDEX IF NOT EXISTS idx_translations_context ON translations(context);

-- Insert some default translations
INSERT INTO translations (key, language, value, context) VALUES
  ('categories.groceries', 'hi', 'किराने का सामान', 'category'),
  ('categories.groceries', 'te', 'కిరాణా సామాను', 'category'),
  ('categories.groceries', 'ta', 'மளிகை', 'category'),
  ('categories.personal_care', 'hi', 'व्यक्तिगत देखभाल', 'category'),
  ('categories.personal_care', 'te', 'వ్యక్తిగత సంరక్షణ', 'category'),
  ('categories.household', 'hi', 'घरेलू', 'category'),
  ('categories.household', 'te', 'గృహ', 'category'),
  ('categories.beverages', 'hi', 'पेय पदार्थ', 'category'),
  ('categories.beverages', 'te', 'పానీయాలు', 'category'),
  ('categories.snacks', 'hi', 'नाश्ता', 'category'),
  ('categories.snacks', 'te', 'చిరుతిండి', 'category')
ON CONFLICT (key, language) DO NOTHING;

-- =====================================================
-- 9. UPDATE PRODUCTS TABLE
-- Add references to new category tables
-- =====================================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name='products' AND column_name='subcategory_id') THEN
    ALTER TABLE products ADD COLUMN subcategory_id UUID REFERENCES subcategories(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);

-- =====================================================
-- 10. NOTIFICATION TEMPLATES TABLE
-- Manage push notification templates
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional data for the notification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default notification templates
INSERT INTO notification_templates (template_key, title, body, data) VALUES
  ('order_confirmed', 'Order Confirmed! 🎉', 'Your order #{{order_id}} has been confirmed and will be delivered soon.', '{"action": "order_details"}'),
  ('order_shipped', 'Order Shipped 📦', 'Your order #{{order_id}} has been shipped and is on its way!', '{"action": "track_order"}'),
  ('order_delivered', 'Order Delivered ✅', 'Your order #{{order_id}} has been delivered. Enjoy your purchase!', '{"action": "order_details"}'),
  ('new_offer', 'Special Offer Just for You! 🎁', '{{offer_description}}', '{"action": "view_offers"}'),
  ('low_stock_alert', 'Low Stock Alert ⚠️', 'Some products in your wishlist are running low on stock!', '{"action": "wishlist"}'),
  ('price_drop', 'Price Drop Alert! 💰', '{{product_name}} is now available at a lower price!', '{"action": "product_details"}')
ON CONFLICT (template_key) DO NOTHING;

-- =====================================================
-- 11. FUNCTIONS FOR REMOTE CONFIG
-- =====================================================

-- Function to get active app config
CREATE OR REPLACE FUNCTION get_app_config(config_key TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT value 
    FROM app_config 
    WHERE key = config_key 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if feature is enabled
CREATE OR REPLACE FUNCTION is_feature_enabled(feature TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT is_enabled 
    FROM feature_flags 
    WHERE feature_key = feature
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get active banners
CREATE OR REPLACE FUNCTION get_active_banners()
RETURNS TABLE (
  id UUID,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  action_type TEXT,
  action_value TEXT,
  position INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.subtitle,
    b.image_url,
    b.action_type,
    b.action_value,
    b.position
  FROM banners b
  WHERE b.is_active = true
    AND b.start_date <= NOW()
    AND b.end_date >= NOW()
  ORDER BY b.position ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to apply promotion code
CREATE OR REPLACE FUNCTION apply_promotion_code(
  promo_code TEXT,
  user_id UUID,
  order_amount NUMERIC
)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_amount NUMERIC,
  message TEXT
) AS $$
DECLARE
  promotion_record RECORD;
  user_usage_count INTEGER;
  calculated_discount NUMERIC;
BEGIN
  -- Get promotion details
  SELECT * INTO promotion_record
  FROM promotions
  WHERE code = promo_code
    AND is_active = true
    AND start_date <= NOW()
    AND end_date >= NOW()
    AND (usage_limit IS NULL OR usage_count < usage_limit);

  -- Check if promotion exists and is valid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'Invalid or expired promotion code';
    RETURN;
  END IF;

  -- Check minimum order amount
  IF order_amount < promotion_record.min_order_amount THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 
      'Minimum order amount of ₹' || promotion_record.min_order_amount || ' required';
    RETURN;
  END IF;

  -- Check user usage limit
  SELECT COUNT(*) INTO user_usage_count
  FROM promotion_usage
  WHERE promotion_id = promotion_record.id
    AND user_id = apply_promotion_code.user_id;

  IF user_usage_count >= promotion_record.usage_per_user THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'You have already used this promotion code';
    RETURN;
  END IF;

  -- Calculate discount
  IF promotion_record.discount_type = 'percentage' THEN
    calculated_discount := (order_amount * promotion_record.discount_value / 100);
  ELSIF promotion_record.discount_type = 'fixed' THEN
    calculated_discount := promotion_record.discount_value;
  END IF;

  -- Apply max discount cap if exists
  IF promotion_record.max_discount_amount IS NOT NULL THEN
    calculated_discount := LEAST(calculated_discount, promotion_record.max_discount_amount);
  END IF;

  -- Ensure discount doesn't exceed order amount
  calculated_discount := LEAST(calculated_discount, order_amount);

  RETURN QUERY SELECT true, calculated_discount, 
    'Promotion applied successfully! You saved ₹' || calculated_discount;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Everyone can read these tables (they're public content)
CREATE POLICY "Public read access for app_config" ON app_config FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for banners" ON banners FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for promotions" ON promotions FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for feature_flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Public read access for categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for subcategories" ON subcategories FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for home_sections" ON home_sections FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for translations" ON translations FOR SELECT USING (true);

-- Only admins can modify (you'll need to add admin role checks)
-- For now, authenticated users can insert/update
-- Later, restrict this to admin role only

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Add comments to tables
COMMENT ON TABLE app_config IS 'Stores application-level configuration that can be changed without app updates';
COMMENT ON TABLE banners IS 'Dynamic banners for home screen carousel';
COMMENT ON TABLE promotions IS 'Promotional offers and discount codes';
COMMENT ON TABLE feature_flags IS 'Feature toggles for gradual rollouts and A/B testing';
COMMENT ON TABLE categories IS 'Product categories managed dynamically';
COMMENT ON TABLE subcategories IS 'Product subcategories';
COMMENT ON TABLE home_sections IS 'Controls the layout and content of home screen';
COMMENT ON TABLE translations IS 'Manages UI text translations for multiple languages';

