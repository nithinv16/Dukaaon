-- Create stock_delivery_bookings table
CREATE TABLE IF NOT EXISTS stock_delivery_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_address TEXT NOT NULL,
    delivery_instructions TEXT,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit > 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    delivery_fee DECIMAL(10,2) NOT NULL CHECK (delivery_fee >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('2wheeler', '3wheeler', '4wheeler')),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cod', 'prepaid')),
    google_maps_url TEXT,
    delivery_location JSONB, -- {"lat": number, "lng": number}
    distance_km DECIMAL(8,2) CHECK (distance_km >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'due')),
    delivery_partner_id UUID, -- Reference to delivery partner when assigned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE stock_delivery_bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own delivery bookings" ON stock_delivery_bookings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own delivery bookings" ON stock_delivery_bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own delivery bookings" ON stock_delivery_bookings
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_delivery_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_stock_delivery_bookings_updated_at
    BEFORE UPDATE ON stock_delivery_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_delivery_bookings_updated_at();

-- Create RPC function for creating delivery bookings
CREATE OR REPLACE FUNCTION create_stock_delivery_booking(
    p_customer_name VARCHAR(255),
    p_customer_phone VARCHAR(20),
    p_customer_address TEXT,
    p_delivery_instructions TEXT DEFAULT NULL,
    p_product_name VARCHAR(255) DEFAULT NULL,
    p_quantity INTEGER DEFAULT NULL,
    p_price_per_unit DECIMAL(10,2) DEFAULT NULL,
    p_subtotal DECIMAL(10,2) DEFAULT NULL,
    p_delivery_fee DECIMAL(10,2) DEFAULT NULL,
    p_total_amount DECIMAL(10,2) DEFAULT NULL,
    p_vehicle_type VARCHAR(20) DEFAULT NULL,
    p_payment_method VARCHAR(20) DEFAULT NULL,
    p_google_maps_url TEXT DEFAULT NULL,
    p_delivery_location JSONB DEFAULT NULL,
    p_distance_km DECIMAL(8,2) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_booking_id UUID;
    v_result JSON;
BEGIN
    -- Validate required parameters
    IF p_customer_name IS NULL OR p_customer_name = '' THEN
        RETURN json_build_object('success', false, 'error', 'Customer name is required');
    END IF;
    
    IF p_customer_phone IS NULL OR p_customer_phone = '' THEN
        RETURN json_build_object('success', false, 'error', 'Customer phone is required');
    END IF;
    
    IF p_customer_address IS NULL OR p_customer_address = '' THEN
        RETURN json_build_object('success', false, 'error', 'Customer address is required');
    END IF;
    
    IF p_product_name IS NULL OR p_product_name = '' THEN
        RETURN json_build_object('success', false, 'error', 'Product name is required');
    END IF;
    
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid quantity is required');
    END IF;
    
    IF p_price_per_unit IS NULL OR p_price_per_unit <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valid price per unit is required');
    END IF;
    
    IF p_vehicle_type NOT IN ('2wheeler', '3wheeler', '4wheeler') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid vehicle type');
    END IF;
    
    IF p_payment_method NOT IN ('cod', 'prepaid') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid payment method');
    END IF;
    
    -- Insert the delivery booking
    INSERT INTO stock_delivery_bookings (
        user_id,
        customer_name,
        customer_phone,
        customer_address,
        delivery_instructions,
        product_name,
        quantity,
        price_per_unit,
        subtotal,
        delivery_fee,
        total_amount,
        vehicle_type,
        payment_method,
        google_maps_url,
        delivery_location,
        distance_km,
        payment_status
    ) VALUES (
        auth.uid(),
        p_customer_name,
        p_customer_phone,
        p_customer_address,
        p_delivery_instructions,
        p_product_name,
        p_quantity,
        p_price_per_unit,
        p_subtotal,
        p_delivery_fee,
        p_total_amount,
        p_vehicle_type,
        p_payment_method,
        p_google_maps_url,
        p_delivery_location,
        p_distance_km,
        CASE WHEN p_payment_method = 'prepaid' THEN 'due' ELSE 'pending' END
    ) RETURNING id INTO v_booking_id;
    
    -- Return success response
    RETURN json_build_object(
        'success', true, 
        'booking_id', v_booking_id,
        'message', 'Delivery booking created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Failed to create delivery booking: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get delivery bookings for a user
CREATE OR REPLACE FUNCTION get_user_delivery_bookings(
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_status VARCHAR(20) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_bookings JSON;
    v_total_count INTEGER;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO v_total_count
    FROM stock_delivery_bookings
    WHERE user_id = auth.uid()
    AND (p_status IS NULL OR status = p_status);
    
    -- Get bookings
    SELECT json_agg(
        json_build_object(
            'id', id,
            'customer_name', customer_name,
            'customer_phone', customer_phone,
            'customer_address', customer_address,
            'delivery_instructions', delivery_instructions,
            'product_name', product_name,
            'quantity', quantity,
            'price_per_unit', price_per_unit,
            'subtotal', subtotal,
            'delivery_fee', delivery_fee,
            'total_amount', total_amount,
            'vehicle_type', vehicle_type,
            'payment_method', payment_method,
            'google_maps_url', google_maps_url,
            'delivery_location', delivery_location,
            'distance_km', distance_km,
            'status', status,
            'payment_status', payment_status,
            'delivery_partner_id', delivery_partner_id,
            'created_at', created_at,
            'updated_at', updated_at,
            'delivered_at', delivered_at
        ) ORDER BY created_at DESC
    ) INTO v_bookings
    FROM stock_delivery_bookings
    WHERE user_id = auth.uid()
    AND (p_status IS NULL OR status = p_status)
    LIMIT p_limit OFFSET p_offset;
    
    RETURN json_build_object(
        'success', true,
        'data', COALESCE(v_bookings, '[]'::json),
        'total_count', v_total_count,
        'limit', p_limit,
        'offset', p_offset
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to fetch delivery bookings: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update delivery booking status
CREATE OR REPLACE FUNCTION update_delivery_booking_status(
    p_booking_id UUID,
    p_status VARCHAR(20),
    p_payment_status VARCHAR(20) DEFAULT NULL,
    p_delivery_partner_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_updated_rows INTEGER;
BEGIN
    -- Validate status
    IF p_status NOT IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    -- Validate payment status if provided
    IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('pending', 'paid', 'due') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid payment status');
    END IF;
    
    -- Update the booking
    UPDATE stock_delivery_bookings
    SET 
        status = p_status,
        payment_status = COALESCE(p_payment_status, payment_status),
        delivery_partner_id = COALESCE(p_delivery_partner_id, delivery_partner_id),
        delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END
    WHERE id = p_booking_id AND user_id = auth.uid();
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        RETURN json_build_object('success', false, 'error', 'Booking not found or access denied');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Booking status updated successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to update booking status: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON stock_delivery_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION create_stock_delivery_booking TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_delivery_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION update_delivery_booking_status TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_user_id ON stock_delivery_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_status ON stock_delivery_bookings(status);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_user_status ON stock_delivery_bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_payment_status ON stock_delivery_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_delivery_partner ON stock_delivery_bookings(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_created_at_desc ON stock_delivery_bookings(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE stock_delivery_bookings IS 'Table to store delivery bookings for stock items';
COMMENT ON COLUMN stock_delivery_bookings.delivery_location IS 'JSON object containing latitude and longitude coordinates';
COMMENT ON COLUMN stock_delivery_bookings.vehicle_type IS 'Type of delivery vehicle: 2wheeler, 3wheeler, or 4wheeler';
COMMENT ON COLUMN stock_delivery_bookings.payment_method IS 'Payment method: cod (Cash on Delivery) or prepaid';
COMMENT ON COLUMN stock_delivery_bookings.payment_status IS 'Payment status: pending, paid, or due (for prepaid orders)';
COMMENT ON FUNCTION create_stock_delivery_booking IS 'Creates a new delivery booking with validation and returns booking ID';
COMMENT ON FUNCTION get_user_delivery_bookings IS 'Retrieves delivery bookings for the authenticated user with pagination';
COMMENT ON FUNCTION update_delivery_booking_status IS 'Updates the status of a delivery booking';