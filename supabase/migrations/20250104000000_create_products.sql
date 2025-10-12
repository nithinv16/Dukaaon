-- Create products table for inventory management
-- This table stores product information for sellers

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    category_id UUID, -- Can reference a categories table if needed
    category_name TEXT, -- Simple category name for now
    keywords TEXT[], -- For fuzzy search
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'out_of_stock', 'discontinued')),
    sku VARCHAR(100), -- Stock Keeping Unit
    barcode VARCHAR(100),
    unit_of_measure TEXT DEFAULT 'piece', -- piece, kg, liter, etc.
    minimum_stock_level INTEGER DEFAULT 0,
    maximum_stock_level INTEGER,
    supplier_info JSONB DEFAULT '{}',
    images TEXT[], -- Array of image URLs
    tags TEXT[], -- Array of tags for categorization
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_name);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_keywords ON public.products USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- Create unique constraint on seller_id and sku
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_seller_sku 
ON public.products(seller_id, sku) 
WHERE sku IS NOT NULL AND is_active = true;

-- Enable RLS on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products table
CREATE POLICY "Sellers can view their own products" ON public.products
    FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own products" ON public.products
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own products" ON public.products
    FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own products" ON public.products
    FOR DELETE USING (seller_id = auth.uid());

-- Allow authenticated users to view active products from other sellers (for ordering)
CREATE POLICY "Allow authenticated users to view active products" ON public.products
    FOR SELECT TO authenticated USING (is_active = true AND status = 'available');

-- Function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_operation TEXT DEFAULT 'subtract' -- 'add' or 'subtract'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT stock_quantity INTO current_stock
    FROM products
    WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;
    
    -- Calculate new stock
    IF p_operation = 'add' THEN
        new_stock := current_stock + p_quantity_change;
    ELSE
        new_stock := current_stock - p_quantity_change;
    END IF;
    
    -- Ensure stock doesn't go negative
    IF new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', current_stock, p_quantity_change;
    END IF;
    
    -- Update stock
    UPDATE products 
    SET 
        stock_quantity = new_stock,
        status = CASE 
            WHEN new_stock = 0 THEN 'out_of_stock'
            WHEN new_stock > 0 AND status = 'out_of_stock' THEN 'available'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to search products by keywords
CREATE OR REPLACE FUNCTION search_products(
    p_seller_id UUID,
    p_search_term TEXT,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    price DECIMAL,
    stock_quantity INTEGER,
    category_name TEXT,
    status TEXT,
    sku VARCHAR,
    images TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.category_name,
        p.status,
        p.sku,
        p.images
    FROM products p
    WHERE 
        p.seller_id = p_seller_id
        AND p.is_active = true
        AND (
            p_search_term IS NULL 
            OR p.name ILIKE '%' || p_search_term || '%'
            OR p.description ILIKE '%' || p_search_term || '%'
            OR p_search_term = ANY(p.keywords)
            OR p_search_term = ANY(p.tags)
        )
        AND (
            p_category IS NULL 
            OR p.category_name ILIKE '%' || p_category || '%'
        )
    ORDER BY 
        CASE WHEN p.name ILIKE p_search_term || '%' THEN 1 ELSE 2 END,
        p.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products(
    p_seller_id UUID
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    stock_quantity INTEGER,
    minimum_stock_level INTEGER,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.stock_quantity,
        p.minimum_stock_level,
        p.status
    FROM products p
    WHERE 
        p.seller_id = p_seller_id
        AND p.is_active = true
        AND p.stock_quantity <= p.minimum_stock_level
    ORDER BY p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql;

-- Log the table creation
DO $$
BEGIN
    RAISE NOTICE 'products table created successfully with all required columns and functions';
END $$;