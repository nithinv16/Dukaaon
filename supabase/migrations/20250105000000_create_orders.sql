-- Create orders table for managing customer orders
-- This table stores order information between sellers and customers

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    retailer_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Direct reference to retailer profile
    
    -- Order details
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'completed')),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Financial details
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    
    -- Payment details
    payment_method TEXT DEFAULT 'cash', -- cash, credit, online, upi
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
    payment_terms TEXT DEFAULT 'cash', -- cash, credit_7, credit_15, credit_30
    due_date DATE,
    
    -- Delivery details
    delivery_address JSONB DEFAULT '{}',
    delivery_instructions TEXT,
    delivery_contact_name TEXT,
    delivery_contact_phone TEXT,
    
    -- Metadata
    notes TEXT,
    internal_notes TEXT, -- Private notes for seller
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table for individual items in an order
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Product details (snapshot at time of order)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_description TEXT,
    
    -- Quantity and pricing
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    
    -- Fulfillment tracking
    fulfilled_quantity INTEGER DEFAULT 0,
    pending_quantity INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    -- Get current date in YYYYMMDD format
    new_number := 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get count of orders created today
    SELECT COUNT(*) + 1 INTO counter
    FROM orders
    WHERE order_number LIKE new_number || '%';
    
    -- Append counter with zero padding
    new_number := new_number || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_retailer_id ON public.orders(retailer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON public.orders(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for orders table
CREATE POLICY "Sellers can view their own orders" ON public.orders
    FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own orders" ON public.orders
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own orders" ON public.orders
    FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own orders" ON public.orders
    FOR DELETE USING (seller_id = auth.uid());

-- Enable RLS on order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for order_items table
CREATE POLICY "Sellers can view their order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can insert their order items" ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can update their order items" ON public.order_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can delete their order items" ON public.order_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.seller_id = auth.uid()
        )
    );

-- Function to calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_totals(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
    v_subtotal DECIMAL(12, 2);
    v_total_amount DECIMAL(12, 2);
BEGIN
    -- Calculate subtotal from order items
    SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM order_items
    WHERE order_id = p_order_id;
    
    -- Update order with calculated totals
    UPDATE orders 
    SET 
        subtotal = v_subtotal,
        total_amount = v_subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_amount, 0) - COALESCE(discount_amount, 0),
        updated_at = NOW()
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate order totals when items change
CREATE OR REPLACE FUNCTION trigger_calculate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_order_totals(OLD.order_id);
        RETURN OLD;
    ELSE
        PERFORM calculate_order_totals(NEW.order_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_items_totals
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_order_totals();

-- Function to update product stock when order is confirmed
CREATE OR REPLACE FUNCTION update_stock_on_order_confirm()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        -- Reduce stock for each order item
        UPDATE products 
        SET 
            stock_quantity = stock_quantity - oi.quantity,
            status = CASE 
                WHEN stock_quantity - oi.quantity <= 0 THEN 'out_of_stock'
                ELSE status
            END,
            updated_at = NOW()
        FROM order_items oi
        WHERE products.id = oi.product_id 
        AND oi.order_id = NEW.id;
        
    -- Restore stock when order is cancelled
    ELSIF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
        -- Restore stock for each order item
        UPDATE products 
        SET 
            stock_quantity = stock_quantity + oi.quantity,
            status = CASE 
                WHEN stock_quantity + oi.quantity > 0 AND status = 'out_of_stock' THEN 'available'
                ELSE status
            END,
            updated_at = NOW()
        FROM order_items oi
        WHERE products.id = oi.product_id 
        AND oi.order_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_order_confirm
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_order_confirm();

-- Function to get order summary
CREATE OR REPLACE FUNCTION get_order_summary(
    p_seller_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_orders BIGINT,
    confirmed_orders BIGINT,
    completed_orders BIGINT,
    cancelled_orders BIGINT,
    total_revenue DECIMAL,
    pending_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status IN ('pending', 'partial')), 0) as pending_amount
    FROM orders
    WHERE 
        seller_id = p_seller_id
        AND (p_start_date IS NULL OR order_date::DATE >= p_start_date)
        AND (p_end_date IS NULL OR order_date::DATE <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Log the table creation
DO $$
BEGIN
    RAISE NOTICE 'orders and order_items tables created successfully with all required columns and functions';
END $$;