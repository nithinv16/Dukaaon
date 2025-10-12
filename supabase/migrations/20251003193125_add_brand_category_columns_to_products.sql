-- Add missing brand and category columns to products table
-- This migration adds the brand and category columns that are referenced in CategoryGrid.tsx

-- Add brand column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- Add category column to products table (separate from category_id)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Create indexes for better performance on the new columns
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category_new ON public.products(category);

-- Note: The brand and category columns will be NULL initially
-- They can be populated later through the application or data import

-- Add comments to document the new columns
COMMENT ON COLUMN public.products.brand IS 'Product brand name for filtering and display';
COMMENT ON COLUMN public.products.category IS 'Product category name for filtering and display (separate from category_id)';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Added brand and category columns to products table successfully';
END $$;