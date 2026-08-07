-- Optimize Product Queries
-- Implements Requirements 2.8:
-- - Add database indexes for common query patterns
-- - Limit initial fetch to essential fields only
-- - Create optimized RPC functions for product queries

-- ============================================
-- INDEXES FOR COMMON QUERY PATTERNS
-- ============================================

-- Index for category-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category);

-- Index for seller-based queries
CREATE INDEX IF NOT EXISTS idx_products_seller_id 
ON products(seller_id);

-- Composite index for category + seller queries
CREATE INDEX IF NOT EXISTS idx_products_category_seller 
ON products(category, seller_id);

-- Index for search queries on product name
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
ON products USING gin(name gin_trgm_ops);

-- Index for active products (commonly filtered)
CREATE INDEX IF NOT EXISTS idx_products_active 
ON products(stock_available) 
WHERE stock_available > 0;

-- Index for sorting by name
CREATE INDEX IF NOT EXISTS idx_products_name 
ON products(name);

-- Index for sorting by price
CREATE INDEX IF NOT EXISTS idx_products_price 
ON products(price);

-- Index for created_at (for recent products)
CREATE INDEX IF NOT EXISTS idx_products_created_at 
ON products(created_at DESC);

-- ============================================
-- OPTIMIZED RPC FUNCTION FOR PRODUCT QUERIES
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_products_optimized(text, uuid, text, integer, integer);

-- Create optimized product query function
CREATE OR REPLACE FUNCTION get_products_optimized(
  p_category text DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
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
  seller_id uuid,
  stock_available integer,
  min_quantity integer,
  unit text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count first (for pagination)
  SELECT COUNT(*)
  INTO v_total_count
  FROM products p
  WHERE 
    (p_category IS NULL OR p.category = p_category)
    AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
    AND (p_search_term IS NULL OR p.name ILIKE '%' || p_search_term || '%');

  -- Return products with essential fields only
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.category,
    p.subcategory,
    p.brand,
    p.image_url,
    p.price,
    p.mrp,
    p.seller_id,
    p.stock_available,
    p.min_quantity,
    p.unit,
    v_total_count as total_count
  FROM products p
  WHERE 
    (p_category IS NULL OR p.category = p_category)
    AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
    AND (p_search_term IS NULL OR p.name ILIKE '%' || p_search_term || '%')
  ORDER BY p.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_products_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_optimized TO anon;

-- ============================================
-- OPTIMIZED RPC FOR SELLER PRODUCTS
-- ============================================

DROP FUNCTION IF EXISTS get_seller_products_optimized(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_seller_products_optimized(
  p_seller_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  image_url text,
  price numeric,
  stock_available integer,
  min_quantity integer,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count
  SELECT COUNT(*)
  INTO v_total_count
  FROM products p
  WHERE p.seller_id = p_seller_id;

  -- Return minimal fields for fast loading
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.category,
    p.image_url,
    p.price,
    p.stock_available,
    p.min_quantity,
    v_total_count as total_count
  FROM products p
  WHERE p.seller_id = p_seller_id
  ORDER BY p.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_seller_products_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_products_optimized TO anon;

-- ============================================
-- OPTIMIZED RPC FOR CATEGORY PRODUCTS
-- ============================================

DROP FUNCTION IF EXISTS get_category_products_optimized(text, integer, integer);

CREATE OR REPLACE FUNCTION get_category_products_optimized(
  p_category text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
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
  seller_id uuid,
  stock_available integer,
  min_quantity integer,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- Get total count
  SELECT COUNT(*)
  INTO v_total_count
  FROM products p
  WHERE p.category = p_category;

  -- Return products
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.category,
    p.subcategory,
    p.brand,
    p.image_url,
    p.price,
    p.mrp,
    p.seller_id,
    p.stock_available,
    p.min_quantity,
    v_total_count as total_count
  FROM products p
  WHERE p.category = p_category
  ORDER BY p.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_category_products_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_products_optimized TO anon;

-- ============================================
-- ANALYZE TABLES FOR QUERY OPTIMIZATION
-- ============================================

ANALYZE products;
