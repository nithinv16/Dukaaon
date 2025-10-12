-- Cart Items Table Implementation
-- This migration creates the cart_items table for shopping cart functionality
-- Based on the usage patterns in store/cart.ts and services/aiAgent/bedrockAIService.ts

-- =====================================================
-- 1. CREATE CART_ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of retailer, seller, and product
    UNIQUE(retailer_id, seller_id, product_id)
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for retailer queries (most common)
CREATE INDEX IF NOT EXISTS idx_cart_items_retailer_id ON cart_items(retailer_id);

-- Index for seller queries
CREATE INDEX IF NOT EXISTS idx_cart_items_seller_id ON cart_items(seller_id);

-- Index for product queries
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Composite index for retailer-seller queries (for splitting cart by seller)
CREATE INDEX IF NOT EXISTS idx_cart_items_retailer_seller ON cart_items(retailer_id, seller_id);

-- Index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_cart_items_created_at ON cart_items(created_at DESC);

-- =====================================================
-- 3. CREATE SELLER_DETAILS VIEW (if not exists)
-- =====================================================

-- Drop existing seller_details if it exists as a table
DROP TABLE IF EXISTS seller_details CASCADE;




-- =====================================================
-- 4. CREATE FUNCTIONS FOR CART OPERATIONS
-- =====================================================

-- Function to add item to cart (with upsert logic)
CREATE OR REPLACE FUNCTION add_to_cart(
    p_retailer_id UUID,
    p_seller_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_price DECIMAL(10,2)
)
RETURNS UUID AS $$
DECLARE
    v_cart_item_id UUID;
    v_existing_quantity INTEGER;
BEGIN
    -- Check if item already exists
    SELECT id, quantity INTO v_cart_item_id, v_existing_quantity
    FROM cart_items
    WHERE retailer_id = p_retailer_id 
      AND seller_id = p_seller_id 
      AND product_id = p_product_id;
    
    IF FOUND THEN
        -- Update existing item
        UPDATE cart_items 
        SET 
            quantity = v_existing_quantity + p_quantity,
            price = p_price,
            updated_at = NOW()
        WHERE id = v_cart_item_id;
        
        RETURN v_cart_item_id;
    ELSE
        -- Insert new item
        INSERT INTO cart_items (retailer_id, seller_id, product_id, quantity, price)
        VALUES (p_retailer_id, p_seller_id, p_product_id, p_quantity, p_price)
        RETURNING id INTO v_cart_item_id;
        
        RETURN v_cart_item_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update cart item quantity
CREATE OR REPLACE FUNCTION update_cart_quantity(
    p_cart_item_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE cart_items 
    SET 
        quantity = p_quantity,
        updated_at = NOW()
    WHERE id = p_cart_item_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to remove cart item
CREATE OR REPLACE FUNCTION remove_cart_item(
    p_cart_item_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM cart_items WHERE id = p_cart_item_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to clear entire cart for a retailer
CREATE OR REPLACE FUNCTION clear_cart(
    p_retailer_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM cart_items WHERE retailer_id = p_retailer_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cart total
CREATE OR REPLACE FUNCTION get_cart_total(
    p_retailer_id UUID
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_total DECIMAL(12,2);
BEGIN
    SELECT COALESCE(SUM(quantity * price), 0)
    INTO v_total
    FROM cart_items
    WHERE retailer_id = p_retailer_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to get cart items count
CREATE OR REPLACE FUNCTION get_cart_items_count(
    p_retailer_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_count
    FROM cart_items
    WHERE retailer_id = p_retailer_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_items_updated_at();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Policy for retailers to view their own cart items
CREATE POLICY "Retailers can view their own cart items" ON cart_items
    FOR SELECT USING (auth.uid() = retailer_id);

-- Policy for retailers to manage their own cart items
CREATE POLICY "Retailers can manage their own cart items" ON cart_items
    FOR ALL USING (auth.uid() = retailer_id);

-- Policy for sellers to view cart items containing their products
CREATE POLICY "Sellers can view cart items with their products" ON cart_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.id = cart_items.seller_id
        )
    );

-- =====================================================
-- 7. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View for cart items with product and seller details
CREATE OR REPLACE VIEW cart_items_detailed AS
SELECT
    ci.id,
    ci.retailer_id,
    ci.seller_id,
    ci.product_id,
    ci.quantity,
    ci.price,
    ci.created_at,
    ci.updated_at,
    p.name as product_name,
    p.description as product_description,
    p.images as product_images,
    p.unit_of_measure as product_unit,
    p.stock_quantity as product_stock,
    CASE
        WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0
        THEN p.images[1]
        ELSE NULL
    END as image_url,
    COALESCE(
        sd.business_details->>'shopName',
        sd.business_details->>'businessName',
        'Unknown Business'
    ) as seller_business_name,
    sd.phone_number as seller_phone,
    sd.location_address as seller_address
FROM cart_items ci
JOIN products p ON ci.product_id = p.id
JOIN seller_details sd ON ci.seller_id = sd.id;

-- View for cart summary by retailer
CREATE OR REPLACE VIEW cart_summary AS
SELECT 
    retailer_id,
    COUNT(*) as total_items,
    SUM(quantity) as total_quantity,
    SUM(quantity * price) as total_amount,
    COUNT(DISTINCT seller_id) as unique_sellers,
    MAX(updated_at) as last_updated
FROM cart_items
GROUP BY retailer_id;

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE cart_items IS 'Stores shopping cart items for retailers/customers';
COMMENT ON COLUMN cart_items.retailer_id IS 'Reference to the retailer/customer who owns the cart';
COMMENT ON COLUMN cart_items.seller_id IS 'Reference to the seller who owns the product';
COMMENT ON COLUMN cart_items.product_id IS 'Reference to the product being added to cart';
COMMENT ON COLUMN cart_items.quantity IS 'Quantity of the product in the cart';
COMMENT ON COLUMN cart_items.price IS 'Price per unit at the time of adding to cart';

COMMENT ON VIEW seller_details IS 'Provides seller business information for cart queries';
COMMENT ON VIEW cart_items_detailed IS 'Cart items with complete product and seller information';
COMMENT ON VIEW cart_summary IS 'Summary statistics for each retailer cart';

COMMENT ON FUNCTION add_to_cart IS 'Adds or updates an item in the shopping cart';
COMMENT ON FUNCTION update_cart_quantity IS 'Updates the quantity of a cart item';
COMMENT ON FUNCTION remove_cart_item IS 'Removes an item from the cart';
COMMENT ON FUNCTION clear_cart IS 'Clears all items from a retailer cart';
COMMENT ON FUNCTION get_cart_total IS 'Calculates the total amount for a retailer cart';
COMMENT ON FUNCTION get_cart_items_count IS 'Gets the total number of items in a retailer cart';