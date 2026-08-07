-- Scalable Product Loading: Materialized View for Category Counts
-- Requirements: 4.1, 4.2, 4.3 - Pre-computed category counts for fast loading

-- ============================================
-- MATERIALIZED VIEW FOR CATEGORY COUNTS
-- ============================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS seller_category_counts;

-- Create materialized view for fast category counts
-- This avoids expensive COUNT(*) queries on every request
CREATE MATERIALIZED VIEW seller_category_counts AS
SELECT 
  seller_id,
  category,
  subcategory,
  COUNT(*) as product_count
FROM products
WHERE is_active = true
GROUP BY seller_id, category, subcategory;

-- Create unique index for concurrent refresh
-- This allows REFRESH MATERIALIZED VIEW CONCURRENTLY without blocking reads
CREATE UNIQUE INDEX idx_seller_category_counts_unique 
ON seller_category_counts(seller_id, COALESCE(category, ''), COALESCE(subcategory, ''));

-- Create index for fast lookups by seller_id
CREATE INDEX idx_seller_category_counts_seller 
ON seller_category_counts(seller_id);

-- ============================================
-- REFRESH FUNCTION
-- ============================================

-- Function to refresh category counts (call periodically or on product changes)
CREATE OR REPLACE FUNCTION refresh_category_counts() 
RETURNS void AS $
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY seller_category_counts;
END;
$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_category_counts TO authenticated;

-- ============================================
-- RPC FUNCTION FOR CATEGORY COUNTS
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_seller_category_counts(uuid);

-- Create RPC function to get category counts for a seller
CREATE OR REPLACE FUNCTION get_seller_category_counts(
  p_seller_id uuid
)
RETURNS TABLE (
  category text,
  subcategory text,
  product_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
  RETURN QUERY
  SELECT 
    scc.category::text,
    scc.subcategory::text,
    scc.product_count
  FROM seller_category_counts scc
  WHERE scc.seller_id = p_seller_id
  ORDER BY scc.category, scc.subcategory;
END;
$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_seller_category_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_category_counts TO anon;

-- ============================================
-- TRIGGER TO AUTO-REFRESH ON PRODUCT CHANGES
-- ============================================

-- Function to trigger refresh on product changes (debounced)
-- Note: In production, consider using pg_cron for periodic refresh instead
CREATE OR REPLACE FUNCTION trigger_category_counts_refresh()
RETURNS trigger AS $
BEGIN
  -- Only refresh if category-related columns changed
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' OR 
     (TG_OP = 'UPDATE' AND (
       OLD.category IS DISTINCT FROM NEW.category OR
       OLD.subcategory IS DISTINCT FROM NEW.subcategory OR
       OLD.is_active IS DISTINCT FROM NEW.is_active OR
       OLD.seller_id IS DISTINCT FROM NEW.seller_id
     )) THEN
    -- Schedule refresh (in production, use pg_cron or background job)
    -- For now, we'll do immediate refresh for small datasets
    -- PERFORM refresh_category_counts();
    NULL; -- Disabled auto-refresh to avoid performance issues on large datasets
  END IF;
  RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON MATERIALIZED VIEW seller_category_counts IS 'Pre-computed category counts for fast sidebar loading';
COMMENT ON FUNCTION get_seller_category_counts IS 'Get category counts for a seller from materialized view';
COMMENT ON FUNCTION refresh_category_counts IS 'Refresh category counts materialized view (call periodically)';

-- Log the migration completion
DO $
BEGIN
    RAISE NOTICE 'Created seller_category_counts materialized view and get_seller_category_counts RPC function';
END $;
