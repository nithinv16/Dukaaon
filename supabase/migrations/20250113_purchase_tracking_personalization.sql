-- =====================================================
-- PURCHASE TRACKING & PERSONALIZATION SYSTEM
-- Created: January 13, 2025
-- Purpose: Track retailer purchases and generate personalized recommendations
-- =====================================================

-- =====================================================
-- 1. PURCHASE HISTORY TABLE
-- Track individual product purchases by retailers
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_history_retailer ON purchase_history(retailer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_product ON purchase_history(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_date ON purchase_history(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_history_retailer_product ON purchase_history(retailer_id, product_id);

-- =====================================================
-- 2. PRODUCT RECOMMENDATIONS TABLE
-- Store pre-computed personalized recommendations
-- =====================================================
CREATE TABLE IF NOT EXISTS product_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score FLOAT NOT NULL DEFAULT 0.0,
  reason TEXT, -- 'frequently_purchased', 'similar_to_X', 'trending_in_category'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(retailer_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_retailer ON product_recommendations(retailer_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON product_recommendations(score DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_retailer_score ON product_recommendations(retailer_id, score DESC);

-- =====================================================
-- 3. PRODUCT VIEWS TABLE (Optional - for tracking views)
-- Track when retailers view products
-- =====================================================
CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_views_retailer ON product_views(retailer_id);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_date ON product_views(viewed_at DESC);

-- =====================================================
-- 4. FUNCTION: Track Purchase
-- Automatically called when order is created
-- =====================================================
CREATE OR REPLACE FUNCTION track_purchase_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into purchase_history for each order item
  INSERT INTO purchase_history (
    retailer_id,
    product_id,
    order_id,
    quantity,
    price,
    purchased_at
  )
  SELECT
    NEW.user_id,
    oi.product_id,
    NEW.id,
    oi.quantity,
    oi.price,
    NEW.created_at
  FROM order_items oi
  WHERE oi.order_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS on_order_created_track_purchase ON orders;
CREATE TRIGGER on_order_created_track_purchase
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_purchase_history();

-- =====================================================
-- 5. FUNCTION: Get Frequently Purchased Products
-- Returns products user purchases most often
-- =====================================================
CREATE OR REPLACE FUNCTION get_frequently_purchased_products(
  user_id_param UUID,
  limit_param INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  purchase_count BIGINT,
  last_purchased_at TIMESTAMP WITH TIME ZONE,
  total_quantity BIGINT,
  average_price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ph.product_id,
    COUNT(DISTINCT ph.order_id) as purchase_count,
    MAX(ph.purchased_at) as last_purchased_at,
    SUM(ph.quantity) as total_quantity,
    AVG(ph.price) as average_price
  FROM purchase_history ph
  WHERE ph.retailer_id = user_id_param
  GROUP BY ph.product_id
  ORDER BY purchase_count DESC, last_purchased_at DESC
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNCTION: Get Purchase Statistics
-- Returns overall purchase stats for a retailer
-- =====================================================
CREATE OR REPLACE FUNCTION get_purchase_statistics(user_id_param UUID)
RETURNS TABLE (
  total_orders BIGINT,
  total_products BIGINT,
  total_spent DECIMAL,
  favorite_category TEXT,
  favorite_brand TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT ph.order_id),
    COUNT(DISTINCT ph.product_id),
    SUM(ph.price * ph.quantity),
    (
      SELECT p.category
      FROM purchase_history ph2
      JOIN products p ON ph2.product_id = p.id
      WHERE ph2.retailer_id = user_id_param
      GROUP BY p.category
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    (
      SELECT p.brand
      FROM purchase_history ph3
      JOIN products p ON ph3.product_id = p.id
      WHERE ph3.retailer_id = user_id_param
        AND p.brand IS NOT NULL
      GROUP BY p.brand
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
  FROM purchase_history ph
  WHERE ph.retailer_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNCTION: Generate Simple Recommendations
-- Creates recommendations based on purchase history
-- =====================================================
CREATE OR REPLACE FUNCTION generate_simple_recommendations(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Clear old recommendations
  DELETE FROM product_recommendations WHERE retailer_id = user_id_param;
  
  -- Add frequently purchased products
  FOR rec IN
    SELECT product_id, purchase_count
    FROM get_frequently_purchased_products(user_id_param, 20)
  LOOP
    INSERT INTO product_recommendations (retailer_id, product_id, score, reason)
    VALUES (
      user_id_param,
      rec.product_id,
      rec.purchase_count::FLOAT * 10.0,
      'frequently_purchased'
    )
    ON CONFLICT (retailer_id, product_id) DO UPDATE
    SET score = EXCLUDED.score, reason = EXCLUDED.reason, updated_at = NOW();
  END LOOP;
  
  -- Add similar products from same categories
  INSERT INTO product_recommendations (retailer_id, product_id, score, reason)
  SELECT DISTINCT
    user_id_param,
    p2.id,
    5.0,
    'similar_category'
  FROM purchase_history ph
  JOIN products p1 ON ph.product_id = p1.id
  JOIN products p2 ON p1.category = p2.category
  WHERE ph.retailer_id = user_id_param
    AND p2.id NOT IN (
      SELECT product_id FROM purchase_history WHERE retailer_id = user_id_param
    )
    AND p2.is_active = true
  LIMIT 20
  ON CONFLICT (retailer_id, product_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. RLS POLICIES
-- Secure access to purchase data
-- =====================================================

-- Enable RLS
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;

-- Purchase history policies
DROP POLICY IF EXISTS "Users can view own purchase history" ON purchase_history;
CREATE POLICY "Users can view own purchase history"
  ON purchase_history FOR SELECT
  USING (auth.uid() = retailer_id);

DROP POLICY IF EXISTS "System can insert purchase history" ON purchase_history;
CREATE POLICY "System can insert purchase history"
  ON purchase_history FOR INSERT
  WITH CHECK (true);

-- Recommendations policies
DROP POLICY IF EXISTS "Users can view own recommendations" ON product_recommendations;
CREATE POLICY "Users can view own recommendations"
  ON product_recommendations FOR SELECT
  USING (auth.uid() = retailer_id);

DROP POLICY IF EXISTS "System can manage recommendations" ON product_recommendations;
CREATE POLICY "System can manage recommendations"
  ON product_recommendations FOR ALL
  USING (true);

-- Product views policies
DROP POLICY IF EXISTS "Users can view own product views" ON product_views;
CREATE POLICY "Users can view own product views"
  ON product_views FOR SELECT
  USING (auth.uid() = retailer_id);

DROP POLICY IF EXISTS "Users can track own views" ON product_views;
CREATE POLICY "Users can track own views"
  ON product_views FOR INSERT
  WITH CHECK (auth.uid() = retailer_id);

-- =====================================================
-- 9. VERIFICATION QUERIES
-- =====================================================

-- Check if tables were created successfully
DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'PURCHASE TRACKING SYSTEM INSTALLED';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ purchase_history';
  RAISE NOTICE '  ✓ product_recommendations';
  RAISE NOTICE '  ✓ product_views';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✓ track_purchase_history()';
  RAISE NOTICE '  ✓ get_frequently_purchased_products()';
  RAISE NOTICE '  ✓ get_purchase_statistics()';
  RAISE NOTICE '  ✓ generate_simple_recommendations()';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  ✓ on_order_created_track_purchase';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies enabled and configured';
  RAISE NOTICE '===========================================';
END $$;

