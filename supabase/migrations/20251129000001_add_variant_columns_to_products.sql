-- Add variant-related columns to products table
-- This is an ADDITIVE migration - NO existing columns are modified or deleted
-- Requirements: 3.9 - Use additive migrations that do not modify or delete existing columns

-- Add has_variants column to indicate if product has variants
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- Add variant_display_type to control how variants are displayed
-- 'grouped' = all variants in one card (for size/weight)
-- 'separate' = each variant as separate card (for flavors)
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_display_type TEXT DEFAULT 'grouped' 
    CHECK (variant_display_type IN ('grouped', 'separate'));

-- Add parent_product_id for flavor variants that need separate cards
-- This allows linking flavor variants back to a parent product
ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id UUID REFERENCES products(id);

-- Create indexes for variant queries
CREATE INDEX IF NOT EXISTS idx_products_has_variants ON products(has_variants) WHERE has_variants = true;
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id) WHERE parent_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_variant_display ON products(variant_display_type);

-- Function to get products with their variants
CREATE OR REPLACE FUNCTION get_products_with_variants(
    p_seller_id UUID DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    name VARCHAR,
    description TEXT,
    price DECIMAL,
    stock_quantity INTEGER,
    category_name TEXT,
    status TEXT,
    sku VARCHAR,
    images TEXT[],
    has_variants BOOLEAN,
    variant_display_type TEXT,
    parent_product_id UUID,
    variants JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.seller_id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.category_name,
        p.status,
        p.sku,
        p.images,
        COALESCE(p.has_variants, false) as has_variants,
        COALESCE(p.variant_display_type, 'grouped') as variant_display_type,
        p.parent_product_id,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pv.id,
                        'sku', pv.sku,
                        'variant_type', pv.variant_type,
                        'variant_value', pv.variant_value,
                        'price', pv.price,
                        'mrp', pv.mrp,
                        'stock_quantity', pv.stock_quantity,
                        'image_url', pv.image_url,
                        'is_default', pv.is_default,
                        'display_order', pv.display_order
                    ) ORDER BY pv.variant_type, pv.display_order
                )
                FROM product_variants pv
                WHERE pv.product_id = p.id AND pv.is_active = true
            ),
            '[]'::jsonb
        ) as variants
    FROM products p
    WHERE 
        p.is_active = true
        AND p.status = 'available'
        AND (p_seller_id IS NULL OR p.seller_id = p_seller_id)
        AND (p_category IS NULL OR p.category_name ILIKE '%' || p_category || '%')
        AND p.parent_product_id IS NULL -- Only return parent products, not flavor variants
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get a single product with its variants
CREATE OR REPLACE FUNCTION get_product_with_variants(p_product_id UUID)
RETURNS TABLE (
    id UUID,
    seller_id UUID,
    name VARCHAR,
    description TEXT,
    price DECIMAL,
    stock_quantity INTEGER,
    category_name TEXT,
    status TEXT,
    sku VARCHAR,
    images TEXT[],
    has_variants BOOLEAN,
    variant_display_type TEXT,
    parent_product_id UUID,
    variants JSONB,
    variant_groups JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.seller_id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.category_name,
        p.status,
        p.sku,
        p.images,
        COALESCE(p.has_variants, false) as has_variants,
        COALESCE(p.variant_display_type, 'grouped') as variant_display_type,
        p.parent_product_id,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pv.id,
                        'sku', pv.sku,
                        'variant_type', pv.variant_type,
                        'variant_value', pv.variant_value,
                        'price', pv.price,
                        'mrp', pv.mrp,
                        'stock_quantity', pv.stock_quantity,
                        'image_url', pv.image_url,
                        'is_default', pv.is_default,
                        'display_order', pv.display_order
                    ) ORDER BY pv.variant_type, pv.display_order
                )
                FROM product_variants pv
                WHERE pv.product_id = p.id AND pv.is_active = true
            ),
            '[]'::jsonb
        ) as variants,
        COALESCE(
            (
                SELECT jsonb_agg(DISTINCT
                    jsonb_build_object(
                        'type', pv.variant_type,
                        'display_name', INITCAP(pv.variant_type),
                        'values', (
                            SELECT jsonb_agg(pv2.variant_value ORDER BY pv2.display_order)
                            FROM product_variants pv2
                            WHERE pv2.product_id = p.id 
                            AND pv2.variant_type = pv.variant_type
                            AND pv2.is_active = true
                        )
                    )
                )
                FROM product_variants pv
                WHERE pv.product_id = p.id AND pv.is_active = true
            ),
            '[]'::jsonb
        ) as variant_groups
    FROM products p
    WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a product has any variants
CREATE OR REPLACE FUNCTION product_has_variants(p_product_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    variant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO variant_count
    FROM product_variants
    WHERE product_id = p_product_id AND is_active = true;
    
    RETURN variant_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Variant columns added to products table successfully (additive migration)';
END $$;
