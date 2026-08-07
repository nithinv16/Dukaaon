-- Scalable Product Loading: Full-Text Search Setup
-- Requirements: 3.4, 9.1 - Use full-text search with GIN indexes instead of ILIKE

-- ============================================
-- FULL-TEXT SEARCH COLUMN AND INDEX
-- ============================================

-- Add search_vector column for full-text search
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index on search_vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_products_search_vector 
ON products USING gin(search_vector);

-- ============================================
-- TRIGGER TO AUTO-UPDATE SEARCH VECTOR
-- ============================================

-- Function to update search vector on insert/update
CREATE OR REPLACE FUNCTION products_search_vector_update() 
RETURNS trigger AS $
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
$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;

-- Create trigger to auto-update search_vector on insert/update
CREATE TRIGGER products_search_vector_trigger
BEFORE INSERT OR UPDATE OF name, brand, category, subcategory, description
ON products
FOR EACH ROW 
EXECUTE FUNCTION products_search_vector_update();

-- ============================================
-- BACKFILL EXISTING PRODUCTS WITH SEARCH VECTORS
-- ============================================

-- Update all existing products to populate search_vector
UPDATE products 
SET search_vector = to_tsvector('english', 
  coalesce(name, '') || ' ' || 
  coalesce(brand, '') || ' ' ||
  coalesce(category, '') || ' ' ||
  coalesce(subcategory, '') || ' ' ||
  coalesce(description, '')
)
WHERE search_vector IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.products.search_vector IS 'Full-text search vector for fast product search using GIN index';

-- Log the migration completion
DO $
BEGIN
    RAISE NOTICE 'Added full-text search column and trigger to products table';
END $;
