-- Scalable Product Loading: Composite Indexes for Cursor Pagination
-- Requirements: 3.3 - Use composite indexes on (seller_id, category, id) for optimal performance

-- ============================================
-- COMPOSITE INDEXES FOR CURSOR PAGINATION
-- ============================================

-- Primary composite index for cursor pagination with category filter
-- This index supports: WHERE seller_id = ? AND category = ? AND id > cursor ORDER BY id
CREATE INDEX IF NOT EXISTS idx_products_seller_category_id 
ON products(seller_id, category, id);

-- Composite index for subcategory filtering with cursor pagination
-- This index supports: WHERE seller_id = ? AND category = ? AND subcategory = ? AND id > cursor ORDER BY id
CREATE INDEX IF NOT EXISTS idx_products_seller_category_subcategory_id 
ON products(seller_id, category, subcategory, id);

-- Add subcategory column if it doesn't exist (needed for hierarchical filtering)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);

-- Create index on subcategory for filtering
CREATE INDEX IF NOT EXISTS idx_products_subcategory 
ON products(subcategory);

-- Add comments to document the indexes
COMMENT ON INDEX idx_products_seller_category_id IS 'Composite index for cursor-based pagination with category filter - O(1) performance';
COMMENT ON INDEX idx_products_seller_category_subcategory_id IS 'Composite index for cursor-based pagination with category and subcategory filter';

-- ============================================
-- ANALYZE TABLE FOR QUERY OPTIMIZATION
-- ============================================

-- Update table statistics for query planner
ANALYZE products;

-- Log the migration completion
DO $
BEGIN
    RAISE NOTICE 'Created composite indexes for cursor-based pagination on products table';
END $;
