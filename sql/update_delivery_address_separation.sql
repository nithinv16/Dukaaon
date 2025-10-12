-- SQL script to separate smart address search from manual address input
-- This update adds new columns to distinguish between smart search and manual entry

-- Add new columns to separate address types
ALTER TABLE stock_delivery_bookings 
ADD COLUMN IF NOT EXISTS address_type VARCHAR(20) DEFAULT 'manual' CHECK (address_type IN ('smart', 'manual', 'both')),
ADD COLUMN IF NOT EXISTS manual_address TEXT,
ADD COLUMN IF NOT EXISTS smart_address TEXT;

-- Update existing records to set address_type based on existing data
-- If google_maps_url or delivery_location exists, it's likely from smart search
UPDATE stock_delivery_bookings 
SET 
    address_type = CASE 
        WHEN google_maps_url IS NOT NULL OR delivery_location IS NOT NULL THEN 'smart'
        ELSE 'manual'
    END,
    smart_address = CASE 
        WHEN google_maps_url IS NOT NULL OR delivery_location IS NOT NULL THEN customer_address
        ELSE NULL
    END,
    manual_address = CASE 
        WHEN google_maps_url IS NULL AND delivery_location IS NULL THEN customer_address
        ELSE NULL
    END;

-- Update the create_stock_delivery_booking function to handle new address structure
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
    p_address_type VARCHAR(20) DEFAULT 'manual',
    p_manual_address TEXT DEFAULT NULL,
    p_smart_address TEXT DEFAULT NULL
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
    
    IF p_address_type NOT IN ('smart', 'manual', 'both') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid address type');
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
        payment_status,
        address_type,
        manual_address,
        smart_address
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
        CASE WHEN p_payment_method = 'prepaid' THEN 'due' ELSE 'pending' END,
        p_address_type,
        p_manual_address,
        p_smart_address
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

-- Create function to extract coordinates from Google Maps URL
CREATE OR REPLACE FUNCTION extract_coordinates_from_google_maps_url(maps_url TEXT)
RETURNS JSONB AS $$
DECLARE
    lat_match TEXT;
    lng_match TEXT;
    coordinates JSONB;
BEGIN
    -- Return null if URL is empty
    IF maps_url IS NULL OR maps_url = '' THEN
        RETURN NULL;
    END IF;
    
    -- Extract coordinates from various Google Maps URL formats
    -- Format 1: @lat,lng,zoom
    lat_match := substring(maps_url from '@(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)');
    
    IF lat_match IS NOT NULL THEN
        lng_match := substring(maps_url from '@-?[0-9]+\.?[0-9]*,(-?[0-9]+\.?[0-9]*)');
        
        IF lng_match IS NOT NULL THEN
            coordinates := json_build_object(
                'lat', lat_match::DECIMAL(10,8),
                'lng', lng_match::DECIMAL(11,8)
            );
            RETURN coordinates;
        END IF;
    END IF;
    
    -- Format 2: ll=lat,lng
    lat_match := substring(maps_url from 'll=(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)');
    
    IF lat_match IS NOT NULL THEN
        lng_match := substring(maps_url from 'll=-?[0-9]+\.?[0-9]*,(-?[0-9]+\.?[0-9]*)');
        
        IF lng_match IS NOT NULL THEN
            coordinates := json_build_object(
                'lat', lat_match::DECIMAL(10,8),
                'lng', lng_match::DECIMAL(11,8)
            );
            RETURN coordinates;
        END IF;
    END IF;
    
    -- Format 3: q=lat,lng
    lat_match := substring(maps_url from 'q=(-?[0-9]+\.?[0-9]*),(-?[0-9]+\.?[0-9]*)');
    
    IF lat_match IS NOT NULL THEN
        lng_match := substring(maps_url from 'q=-?[0-9]+\.?[0-9]*,(-?[0-9]+\.?[0-9]*)');
        
        IF lng_match IS NOT NULL THEN
            coordinates := json_build_object(
                'lat', lat_match::DECIMAL(10,8),
                'lng', lng_match::DECIMAL(11,8)
            );
            RETURN coordinates;
        END IF;
    END IF;
    
    -- If no coordinates found, return null
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL(10,8),
    lng1 DECIMAL(11,8),
    lat2 DECIMAL(10,8),
    lng2 DECIMAL(11,8)
)
RETURNS DECIMAL(8,2) AS $$
DECLARE
    earth_radius CONSTANT DECIMAL := 6371; -- Earth's radius in kilometers
    dlat DECIMAL;
    dlng DECIMAL;
    a DECIMAL;
    c DECIMAL;
    distance DECIMAL;
BEGIN
    -- Convert degrees to radians
    dlat := radians(lat2 - lat1);
    dlng := radians(lng2 - lng1);
    
    -- Haversine formula
    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2) * sin(dlng/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    distance := earth_radius * c;
    
    RETURN ROUND(distance, 2);
END;
$$ LANGUAGE plpgsql;

-- Update get_user_delivery_bookings function to include new address fields
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
            'address_type', address_type,
            'manual_address', manual_address,
            'smart_address', smart_address,
            'created_at', created_at,
            'updated_at', updated_at,
            'delivered_at', delivered_at
        ) ORDER BY created_at DESC
    ) INTO v_bookings
    FROM stock_delivery_bookings
    WHERE user_id = auth.uid()
    AND (p_status IS NULL OR status = p_status)
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    
    RETURN json_build_object(
        'bookings', COALESCE(v_bookings, '[]'::json),
        'total_count', v_total_count,
        'limit', p_limit,
        'offset', p_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE stock_delivery_bookings IS 'Updated table structure to separate smart address search from manual address input';
COMMENT ON COLUMN stock_delivery_bookings.address_type IS 'Type of address entry: smart (from Google Places/Maps) or manual (typed by user)';
COMMENT ON COLUMN stock_delivery_bookings.manual_address IS 'Address entered manually by the user';
COMMENT ON COLUMN stock_delivery_bookings.smart_address IS 'Address selected from Google Places autocomplete or extracted from Maps URL';