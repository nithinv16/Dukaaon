-- Add latitude and longitude columns to stock_delivery_bookings table
ALTER TABLE stock_delivery_bookings 
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8);

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_location 
ON stock_delivery_bookings (delivery_latitude, delivery_longitude);

-- Create index for user_id and status for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_delivery_bookings_user_status 
ON stock_delivery_bookings (user_id, status);

-- Update the create_stock_delivery_booking function to include coordinates
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
    p_distance_km DECIMAL(8,2) DEFAULT NULL,
    p_delivery_latitude DECIMAL(10,8) DEFAULT NULL,
    p_delivery_longitude DECIMAL(11,8) DEFAULT NULL
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
    
    -- Extract coordinates from delivery_location JSONB if not provided separately
    IF p_delivery_latitude IS NULL AND p_delivery_location IS NOT NULL THEN
        p_delivery_latitude := (p_delivery_location->>'lat')::DECIMAL(10,8);
    END IF;
    
    IF p_delivery_longitude IS NULL AND p_delivery_location IS NOT NULL THEN
        p_delivery_longitude := (p_delivery_location->>'lng')::DECIMAL(11,8);
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
        delivery_latitude,
        delivery_longitude,
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
        p_delivery_latitude,
        p_delivery_longitude,
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

-- Create function to find nearby delivery bookings
CREATE OR REPLACE FUNCTION get_nearby_delivery_bookings(
    p_latitude DECIMAL(10,8),
    p_longitude DECIMAL(11,8),
    p_radius_km DECIMAL(8,2) DEFAULT 10.0,
    p_limit INTEGER DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
    v_bookings JSON;
BEGIN
    -- Get nearby delivery bookings using Haversine formula
    SELECT json_agg(
        json_build_object(
            'id', id,
            'customer_name', customer_name,
            'customer_address', customer_address,
            'product_name', product_name,
            'quantity', quantity,
            'delivery_fee', delivery_fee,
            'vehicle_type', vehicle_type,
            'status', status,
            'distance_km', distance_km,
            'delivery_latitude', delivery_latitude,
            'delivery_longitude', delivery_longitude,
            'created_at', created_at,
            'calculated_distance', (
                6371 * acos(
                    cos(radians(p_latitude)) * 
                    cos(radians(delivery_latitude)) * 
                    cos(radians(delivery_longitude) - radians(p_longitude)) + 
                    sin(radians(p_latitude)) * 
                    sin(radians(delivery_latitude))
                )
            )
        ) ORDER BY (
            6371 * acos(
                cos(radians(p_latitude)) * 
                cos(radians(delivery_latitude)) * 
                cos(radians(delivery_longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * 
                sin(radians(delivery_latitude))
            )
        )
    ) INTO v_bookings
    FROM stock_delivery_bookings
    WHERE delivery_latitude IS NOT NULL 
    AND delivery_longitude IS NOT NULL
    AND status IN ('pending', 'confirmed')
    AND (
        6371 * acos(
            cos(radians(p_latitude)) * 
            cos(radians(delivery_latitude)) * 
            cos(radians(delivery_longitude) - radians(p_longitude)) + 
            sin(radians(p_latitude)) * 
            sin(radians(delivery_latitude))
        )
    ) <= p_radius_km
    LIMIT p_limit;
    
    RETURN json_build_object(
        'success', true,
        'data', COALESCE(v_bookings, '[]'::json)
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to fetch nearby delivery bookings: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;