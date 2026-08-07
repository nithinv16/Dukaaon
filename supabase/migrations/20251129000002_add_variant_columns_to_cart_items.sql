-- Add variant columns to cart_items table
-- This is an ADDITIVE migration - NO existing columns are modified or deleted
-- Requirements 3.6: Cart item SHALL contain the specific variant_id and SKU

-- Add variant_id column to reference product_variants
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);

-- Add variant_sku for quick reference without join
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_sku VARCHAR(100);

-- Add variant_details for display (e.g., "500ml", "Chocolate")
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS variant_details TEXT;

-- Create index for variant lookups
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id) WHERE variant_id IS NOT NULL;

-- Create unique constraint for product+variant combination per user
-- This ensures a user can't have duplicate entries for the same product variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product_variant 
ON cart_items(retailer_id, product_id, variant_id) 
WHERE variant_id IS NOT NULL;

-- For products without variants, ensure uniqueness on product_id alone
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_user_product_no_variant 
ON cart_items(retailer_id, product_id) 
WHERE variant_id IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Variant columns added to cart_items table successfully';
END $$;
