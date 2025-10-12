-- Master Order System Implementation
-- This migration creates the complete database structure for handling
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

-- Delivery Partners Table (if not exists)
CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    vehicle_type VARCHAR(50),
    license_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    rating DECIMAL(3,2) DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
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

-- Add master_order_id to existing orders table (if not already added)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS master_order_id UUID REFERENCES master_orders(id) ON DELETE CASCADE;

-- =====================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_master_orders_user_id ON master_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_master_orders_status ON master_orders(status);
CREATE INDEX IF NOT EXISTS idx_master_orders_created_at ON master_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_partners_user_id ON delivery_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(status);

CREATE INDEX IF NOT EXISTS idx_delivery_batches_master_order_id ON delivery_batches(master_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_delivery_partner_id ON delivery_batches(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_status ON delivery_batches(status);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_created_at ON delivery_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_master_order_id ON orders(master_order_id);

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

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE master_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;

-- Policies for master_orders
CREATE POLICY "Users can view their own master orders" ON master_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own master orders" ON master_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own master orders" ON master_orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for delivery_partners
CREATE POLICY "Users can view their own delivery partner profile" ON delivery_partners
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own delivery partner profile" ON delivery_partners
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own delivery partner profile" ON delivery_partners
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for delivery_batches
CREATE POLICY "Delivery partners can view assigned batches" ON delivery_batches
    FOR SELECT USING (
        delivery_partner_id = auth.uid() OR 
        delivery_partner_id IS NULL OR
        EXISTS (
            SELECT 1 FROM master_orders mo 
            WHERE mo.id = delivery_batches.master_order_id 
            AND mo.user_id = auth.uid()
        )
    );

CREATE POLICY "Delivery partners can update assigned batches" ON delivery_batches
    FOR UPDATE USING (delivery_partner_id = auth.uid());

CREATE POLICY "System can insert delivery batches" ON delivery_batches
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- 7. CREATE VIEWS FOR EASY QUERYING
-- =====================================================

-- View for delivery partner batches
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
            'subtotal', o.total_amount,
            'status', o.status
        )
    ) as orders
FROM delivery_batches db
JOIN master_orders mo ON db.master_order_id = mo.id
LEFT JOIN orders o ON o.master_order_id = mo.id
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

-- Add comments to document the tables
COMMENT ON TABLE master_orders IS 'Groups individual orders from one or more sellers into a single customer order';
COMMENT ON TABLE delivery_partners IS 'Stores delivery partner information and profiles';
COMMENT ON TABLE delivery_batches IS 'Represents a single delivery unit for delivery partners';
COMMENT ON COLUMN orders.master_order_id IS 'Reference to the master order that groups this individual order';