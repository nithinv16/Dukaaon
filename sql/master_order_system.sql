-- Master Order System Implementation
-- This SQL script creates the complete database structure for handling
-- both single-seller and multi-seller orders as unified delivery batches

-- =====================================================
-- 1. CREATE NEW TABLES
-- =====================================================

-- Master Orders Table
-- Groups individual orders from one or more sellers into a single customer order
CREATE TABLE IF NOT EXISTS master_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'processing', 'out_for_delivery', 
        'delivered', 'cancelled', 'refunded'
    )),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'failed', 'refunded'
    )),
    payment_method VARCHAR(50),
    delivery_address JSONB NOT NULL,
    delivery_instructions TEXT,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Batches Table
-- Represents a single delivery unit for delivery partners
CREATE TABLE IF NOT EXISTS delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    master_order_id UUID NOT NULL REFERENCES master_orders(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES delivery_partners(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'assigned', 'accepted', 'picked_up', 
        'in_transit', 'delivered', 'cancelled', 'failed'
    )),
    pickup_locations JSONB NOT NULL, -- Array of seller locations
    delivery_address JSONB NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL,
    distance_km DECIMAL(8,2),
    estimated_pickup_time TIMESTAMP WITH TIME ZONE,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_pickup_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. MODIFY EXISTING ORDERS TABLE
-- =====================================================

-- Add master_order_id to existing orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS master_order_id UUID REFERENCES master_orders(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_master_order_id ON orders(master_order_id);

-- =====================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_master_orders_user_id ON master_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_master_orders_status ON master_orders(status);
CREATE INDEX IF NOT EXISTS idx_master_orders_created_at ON master_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_master_order_id ON delivery_batches(master_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_delivery_partner_id ON delivery_batches(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_status ON delivery_batches(status);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_created_at ON delivery_batches(created_at DESC);

-- =====================================================
-- 4. CREATE SEQUENCES FOR ORDER NUMBERS
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS master_order_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS delivery_batch_number_seq START 1000;

-- =====================================================
-- 5. CREATE FUNCTIONS
-- =====================================================

-- Function to generate master order number
CREATE OR REPLACE FUNCTION generate_master_order_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'MO' || LPAD(nextval('master_order_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate delivery batch number
CREATE OR REPLACE FUNCTION generate_delivery_batch_number()
RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN 'DB' || LPAD(nextval('delivery_batch_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create master order with individual orders
CREATE OR REPLACE FUNCTION create_master_order(
    p_user_id UUID,
    p_total_amount DECIMAL(10,2),
    p_delivery_fee DECIMAL(10,2),
    p_delivery_address JSONB,
    p_payment_method VARCHAR(50) DEFAULT NULL,
    p_delivery_instructions TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_master_order_id UUID;
    v_order_number VARCHAR(50);
BEGIN
    -- Generate order number
    v_order_number := generate_master_order_number();
    
    -- Create master order
    INSERT INTO master_orders (
        order_number, user_id, total_amount, delivery_fee, 
        grand_total, delivery_address, payment_method, delivery_instructions
    ) VALUES (
        v_order_number, p_user_id, p_total_amount, p_delivery_fee,
        p_total_amount + p_delivery_fee, p_delivery_address, 
        p_payment_method, p_delivery_instructions
    ) RETURNING id INTO v_master_order_id;
    
    RETURN v_master_order_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create delivery batch
CREATE OR REPLACE FUNCTION create_delivery_batch(
    p_master_order_id UUID,
    p_pickup_locations JSONB,
    p_delivery_address JSONB,
    p_total_amount DECIMAL(10,2),
    p_delivery_fee DECIMAL(10,2),
    p_distance_km DECIMAL(8,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_delivery_batch_id UUID;
    v_batch_number VARCHAR(50);
BEGIN
    -- Generate batch number
    v_batch_number := generate_delivery_batch_number();
    
    -- Create delivery batch
    INSERT INTO delivery_batches (
        batch_number, master_order_id, pickup_locations, 
        delivery_address, total_amount, delivery_fee, distance_km
    ) VALUES (
        v_batch_number, p_master_order_id, p_pickup_locations,
        p_delivery_address, p_total_amount, p_delivery_fee, p_distance_km
    ) RETURNING id INTO v_delivery_batch_id;
    
    RETURN v_delivery_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to accept delivery batch
CREATE OR REPLACE FUNCTION accept_delivery_batch(
    p_batch_id UUID,
    p_delivery_partner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_master_order_id UUID;
BEGIN
    -- Update delivery batch
    UPDATE delivery_batches 
    SET 
        status = 'accepted',
        delivery_partner_id = p_delivery_partner_id,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_batch_id AND status = 'pending'
    RETURNING master_order_id INTO v_master_order_id;
    
    -- Check if update was successful
    IF v_master_order_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update master order status
    UPDATE master_orders 
    SET 
        status = 'confirmed',
        updated_at = NOW()
    WHERE id = v_master_order_id;
    
    -- Update all related individual orders
    UPDATE orders 
    SET 
        status = 'confirmed',
        updated_at = NOW()
    WHERE master_order_id = v_master_order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to update delivery batch status
CREATE OR REPLACE FUNCTION update_delivery_batch_status(
    p_batch_id UUID,
    p_status VARCHAR(50),
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_master_order_id UUID;
    v_order_status VARCHAR(50);
BEGIN
    -- Determine corresponding order status
    v_order_status := CASE p_status
        WHEN 'picked_up' THEN 'processing'
        WHEN 'in_transit' THEN 'out_for_delivery'
        WHEN 'delivered' THEN 'delivered'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'failed' THEN 'cancelled'
        ELSE 'confirmed'
    END;
    
    -- Update delivery batch
    UPDATE delivery_batches 
    SET 
        status = p_status,
        notes = COALESCE(p_notes, notes),
        actual_pickup_time = CASE WHEN p_status = 'picked_up' THEN NOW() ELSE actual_pickup_time END,
        actual_delivery_time = CASE WHEN p_status = 'delivered' THEN NOW() ELSE actual_delivery_time END,
        updated_at = NOW()
    WHERE id = p_batch_id
    RETURNING master_order_id INTO v_master_order_id;
    
    -- Check if update was successful
    IF v_master_order_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update master order status
    UPDATE master_orders 
    SET 
        status = v_order_status,
        actual_delivery_time = CASE WHEN p_status = 'delivered' THEN NOW() ELSE actual_delivery_time END,
        updated_at = NOW()
    WHERE id = v_master_order_id;
    
    -- Update all related individual orders
    UPDATE orders 
    SET 
        status = v_order_status,
        updated_at = NOW()
    WHERE master_order_id = v_master_order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGERS
-- =====================================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_master_orders_updated_at
    BEFORE UPDATE ON master_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_batches_updated_at
    BEFORE UPDATE ON delivery_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View for delivery partner dashboard
CREATE OR REPLACE VIEW delivery_partner_batches AS
SELECT 
    db.id as batch_id,
    db.batch_number,
    db.status as batch_status,
    db.pickup_locations,
    db.delivery_address,
    db.total_amount,
    db.delivery_fee,
    db.distance_km,
    db.estimated_pickup_time,
    db.estimated_delivery_time,
    db.notes,
    db.created_at as batch_created_at,
    mo.id as master_order_id,
    mo.order_number as master_order_number,
    mo.user_id,
    mo.delivery_instructions,
    COUNT(o.id) as total_orders,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'order_id', o.id,
            'order_number', o.order_number,
            'seller_id', o.seller_id,
            'items', o.items,
            'subtotal', o.total_amount
        )
    ) as orders
FROM delivery_batches db
JOIN master_orders mo ON db.master_order_id = mo.id
JOIN orders o ON o.master_order_id = mo.id
GROUP BY 
    db.id, db.batch_number, db.status, db.pickup_locations, 
    db.delivery_address, db.total_amount, db.delivery_fee, 
    db.distance_km, db.estimated_pickup_time, db.estimated_delivery_time,
    db.notes, db.created_at, mo.id, mo.order_number, 
    mo.user_id, mo.delivery_instructions;

-- View for customer order tracking
CREATE OR REPLACE VIEW customer_order_tracking AS
SELECT 
    mo.id as master_order_id,
    mo.order_number as master_order_number,
    mo.status as order_status,
    mo.total_amount,
    mo.delivery_fee,
    mo.grand_total,
    mo.payment_status,
    mo.delivery_address,
    mo.estimated_delivery_time,
    mo.actual_delivery_time,
    mo.created_at,
    db.id as delivery_batch_id,
    db.batch_number,
    db.status as delivery_status,
    db.delivery_partner_id,
    db.actual_pickup_time,
    db.actual_delivery_time as batch_delivery_time,
    COUNT(o.id) as total_orders,
    ARRAY_AGG(
        JSON_BUILD_OBJECT(
            'order_id', o.id,
            'order_number', o.order_number,
            'seller_id', o.seller_id,
            'items', o.items,
            'subtotal', o.total_amount,
            'status', o.status
        )
    ) as individual_orders
FROM master_orders mo
LEFT JOIN delivery_batches db ON db.master_order_id = mo.id
LEFT JOIN orders o ON o.master_order_id = mo.id
GROUP BY 
    mo.id, mo.order_number, mo.status, mo.total_amount, 
    mo.delivery_fee, mo.grand_total, mo.payment_status,
    mo.delivery_address, mo.estimated_delivery_time, 
    mo.actual_delivery_time, mo.created_at, db.id, 
    db.batch_number, db.status, db.delivery_partner_id,
    db.actual_pickup_time, db.actual_delivery_time;

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE master_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;

-- Policies for master_orders
CREATE POLICY "Users can view their own master orders" ON master_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own master orders" ON master_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own master orders" ON master_orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for delivery_batches
CREATE POLICY "Delivery partners can view assigned batches" ON delivery_batches
    FOR SELECT USING (
        delivery_partner_id = auth.uid() OR 
        delivery_partner_id IS NULL
    );

CREATE POLICY "Delivery partners can update assigned batches" ON delivery_batches
    FOR UPDATE USING (delivery_partner_id = auth.uid());

CREATE POLICY "System can insert delivery batches" ON delivery_batches
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- 9. SAMPLE USAGE QUERIES
-- =====================================================

/*
-- Example 1: Create a master order with single seller
SELECT create_master_order(
    'user-uuid-here'::UUID,
    500.00,
    50.00,
    '{"address": "123 Main St", "city": "Mumbai", "pincode": "400001"}'::JSONB,
    'razorpay',
    'Leave at door'
);

-- Example 2: Get pending delivery batches for delivery partner
SELECT * FROM delivery_partner_batches 
WHERE batch_status = 'pending'
ORDER BY batch_created_at DESC;

-- Example 3: Accept a delivery batch
SELECT accept_delivery_batch(
    'batch-uuid-here'::UUID,
    'delivery-partner-uuid-here'::UUID
);

-- Example 4: Update delivery status
SELECT update_delivery_batch_status(
    'batch-uuid-here'::UUID,
    'picked_up',
    'All items collected from sellers'
);

-- Example 5: Get customer order tracking info
SELECT * FROM customer_order_tracking 
WHERE master_order_id = 'master-order-uuid-here'::UUID;
*/

-- =====================================================
-- 10. MIGRATION SCRIPT FOR EXISTING DATA
-- =====================================================

/*
-- Run this after creating the new structure to migrate existing orders
-- This creates master orders for existing individual orders

DO $$
DECLARE
    order_record RECORD;
    master_order_id UUID;
    batch_id UUID;
BEGIN
    -- Process orders that don't have master_order_id
    FOR order_record IN 
        SELECT DISTINCT user_id, delivery_address, created_at::DATE as order_date
        FROM orders 
        WHERE master_order_id IS NULL
        ORDER BY created_at
    LOOP
        -- Create master order for each user/address/date combination
        master_order_id := create_master_order(
            order_record.user_id,
            (SELECT SUM(total_amount) FROM orders 
             WHERE user_id = order_record.user_id 
             AND delivery_address = order_record.delivery_address 
             AND created_at::DATE = order_record.order_date
             AND master_order_id IS NULL),
            50.00, -- Default delivery fee
            order_record.delivery_address,
            'cash_on_delivery'
        );
        
        -- Update individual orders
        UPDATE orders 
        SET master_order_id = master_order_id
        WHERE user_id = order_record.user_id 
        AND delivery_address = order_record.delivery_address 
        AND created_at::DATE = order_record.order_date
        AND master_order_id IS NULL;
        
        -- Create delivery batch
        batch_id := create_delivery_batch(
            master_order_id,
            '[]'::JSONB, -- Empty pickup locations for now
            order_record.delivery_address,
            (SELECT SUM(total_amount) FROM orders WHERE master_order_id = master_order_id),
            50.00,
            NULL
        );
        
    END LOOP;
END $$;
*/

COMMIT;