-- ============================================
-- SCALABLE PRODUCT LOADING - COMBINED MIGRATION
-- ============================================
-- Run this entire script in your Supabase SQL Editor
-- This creates all the necessary indexes, functions, and views
-- for the scalable product loading feature to work.
-- ============================================

-- ============================================
-- PART 1: COMPOSITE INDEXES FOR CURSOR PAGINATION
-- Requirements: 3.3 - Use composite indexes on (seller_id, category, id)
-- ============================================

-- Primary composite index for cursor pagination with category filter
CREATE INDEX IF NOT EXISTS idx_products_seller_category_id 
ON products(seller_id, category, id);

-- Composite index for subcategory filtering with cursor pagination
CREATE INDEX IF NOT EXISTS idx_products_seller_category_subcategory_id 
ON products(seller_id, category, subcategory, id);

-- Add subcategory column if it doesn't exist
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);

-- Create index on subcategory for filtering
CREATE INDEX IF NOT EXISTS idx_products_subcategory 
ON products(subcategory);

-- Update table statistics for query planner
ANALYZE products;

RAISE NOTICE 'Part 1 Complete: Created composite indexes';

-- ============================================
-- PART 2: FULL-TEXT SEARCH SETUP
-- Requirements: 3.4, 9.1 - Use full-text search with GIN indexes
-- ============================================

-- Add search_vector column for full-text search
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index on search_vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_products_search_vector 
ON products USING gin(search_vector);

-- Function to update search vector on insert/update
CREATE OR REPLACE FUNCTION products_search_vector_update() 
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.name, '') || ' ' || 
    coalesce(NEW.brand, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.subcategory, '') || ' ' ||
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;

-- Create trigger to auto-update search_vector on insert/update
CREATE TRIGGER products_search_vector_trigger
BEFORE INSERT OR UPDATE OF name, brand, category, subcategory, description
ON products
FOR EACH ROW 
EXECUTE FUNCTION products_search_vector_update();

-- Backfill existing products with search vectors
UPDATE products 
SET search_vector = to_tsvector('english', 
  coalesce(name, '') || ' ' || 
  coalesce(brand, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(subcategory, '') || ' ' ||
  coalesce(description, '')
)
WHERE search_vector IS NULL;

RAISE NOTICE 'Part 2 Complete: Added full-text search';

-- ============================================
-- PART 3: CURSOR-BASED PAGINATION RPC FUNCTION
-- Requirements: 1.1, 1.2, 1.4, 3.1, 3.5
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_products_cursor(uuid, text, text, text, uuid, integer);

-- Create optimized cursor-based pagination function
CREATE OR REPLACE FUNCTION get_products_cursor(
  p_seller_id uuid,
  p_category text DEFAULT NULL,
  p_subcategory text DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_cursor uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  subcategory text,
  brand text,
  image_url text,
  price numeric,
  mrp numeric,
  min_quantity integer,
  unit text,
  stock_available integer,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actual_count integer;
BEGIN
  -- Create temp table with filtered products (limit + 1 to check has_more)
  CREATE TEMP TABLE temp_products ON COMMIT DROP AS
  SELECT 
    p.id,
    p.name::text,
    p.category::text,
    p.subcategory::text,
    p.brand::text,
    p.image_url::text,
    p.price,
    p.mrp,
    p.min_quantity,
    p.unit_of_measure::text as unit,
    p.stock_quantity as stock_available
  FROM products p
  WHERE 
    p.seller_id = p_seller_id
    AND p.is_active = true
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_subcategory IS NULL OR p.subcategory = p_subcategory)
    AND (p_cursor IS NULL OR p.id > p_cursor)
    AND (
      p_search_term IS NULL 
      OR p.search_vector @@ plainto_tsquery('english', p_search_term)
      OR p.name ILIKE '%' || p_search_term || '%'
    )
  ORDER BY p.id
  LIMIT p_limit + 1;

  -- Get actual count to determine has_more
  SELECT COUNT(*) INTO v_actual_count FROM temp_products;

  -- Return results with has_more flag
  RETURN QUERY
  SELECT 
    tp.id,
    tp.name,
    tp.category,
    tp.subcategory,
    tp.brand,
    tp.image_url,
    tp.price,
    tp.mrp,
    tp.min_quantity,
    tp.unit,
    tp.stock_available,
    (v_actual_count > p_limit) as has_more
  FROM temp_products tp
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_products_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_cursor TO anon;

RAISE NOTICE 'Part 3 Complete: Created cursor pagination RPC';

-- ============================================
-- PART 4: MATERIALIZED VIEW FOR CATEGORY COUNTS
-- Requirements: 4.1, 4.2, 4.3
-- ============================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS seller_category_counts;

-- Create materialized view for fast category counts
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
CREATE UNIQUE INDEX idx_seller_category_counts_unique 
ON seller_category_counts(seller_id, COALESCE(category, ''), COALESCE(subcategory, ''));

-- Create index for fast lookups by seller_id
CREATE INDEX idx_seller_category_counts_seller 
ON seller_category_counts(seller_id);

-- Function to refresh category counts
CREATE OR REPLACE FUNCTION refresh_category_counts() 
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY seller_category_counts;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_category_counts TO authenticated;

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
AS $$
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
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_seller_category_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_category_counts TO anon;

RAISE NOTICE 'Part 4 Complete: Created category counts materialized view';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
RAISE NOTICE '========================================';
RAISE NOTICE 'SCALABLE PRODUCT LOADING MIGRATION COMPLETE!';
RAISE NOTICE '========================================';
RAISE NOTICE 'Created:';
RAISE NOTICE '  - Composite indexes for cursor pagination';
RAISE NOTICE '  - Full-text search with GIN index';
RAISE NOTICE '  - get_products_cursor RPC function';
RAISE NOTICE '  - seller_category_counts materialized view';
RAISE NOTICE '  - get_seller_category_counts RPC function';
RAISE NOTICE '========================================';
