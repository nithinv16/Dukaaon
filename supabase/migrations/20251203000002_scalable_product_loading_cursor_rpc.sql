-- Scalable Product Loading: Cursor-Based Pagination RPC Function
-- Requirements: 1.1, 1.2, 1.4, 3.1, 3.5 - Cursor pagination with has_more flag

-- ============================================
-- CURSOR-BASED PAGINATION RPC FUNCTION
-- ============================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_products_cursor(uuid, text, text, text, uuid, integer);

-- Create optimized cursor-based pagination function
-- Uses WHERE id > cursor instead of OFFSET for O(1) performance
-- Returns has_more flag by fetching limit + 1 items
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
AS $
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
      OR p.name ILIKE '%' || p_search_term || '%'  -- Fallback for partial matches
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
$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_products_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_cursor TO anon;

-- Add comment to document the function
COMMENT ON FUNCTION get_products_cursor IS 'Cursor-based pagination for products with O(1) performance regardless of page number';

-- Log the migration completion
DO $
BEGIN
    RAISE NOTICE 'Created get_products_cursor RPC function for cursor-based pagination';
END $;
