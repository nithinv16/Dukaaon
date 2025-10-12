-- Shared Stock Table Implementation
-- This migration creates the shared_stock table for product sharing functionality
-- Based on the SharedProduct interface and usage patterns in the codebase

-- =====================================================
-- 1. CREATE SHARED_STOCK TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS shared_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    units VARCHAR(50) NOT NULL, -- e.g., kg, pieces, liters
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    image_url TEXT,
    description TEXT,
    latitude DECIMAL(10, 8), -- GPS coordinates for location-based search
    longitude DECIMAL(11, 8),
    location_address TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_shared_stock_user_id ON shared_stock(user_id);

-- Index for product name searches
CREATE INDEX IF NOT EXISTS idx_shared_stock_name ON shared_stock USING gin(to_tsvector('english', name));

-- Index for location-based queries (using PostGIS if available, otherwise simple lat/lng)
CREATE INDEX IF NOT EXISTS idx_shared_stock_location ON shared_stock(latitude, longitude);

-- Index for availability
CREATE INDEX IF NOT EXISTS idx_shared_stock_available ON shared_stock(is_available) WHERE is_available = true;

-- Index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_shared_stock_created_at ON shared_stock(created_at DESC);

-- =====================================================
-- 3. CREATE FUNCTIONS FOR LOCATION-BASED SEARCH
-- =====================================================

-- Function to calculate distance between two points using Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371; -- Earth's radius in kilometers
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dLat := radians(lat2 - lat1);
    dLon := radians(lon2 - lon1);
    a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find nearby shared products
CREATE OR REPLACE FUNCTION get_nearby_shared_products(
    p_user_latitude DECIMAL(10, 8),
    p_user_longitude DECIMAL(11, 8),
    p_radius_km DECIMAL(8, 2) DEFAULT 10.0,
    p_exclude_user_id UUID DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(255),
    brand VARCHAR(100),
    category VARCHAR(100),
    sub_category VARCHAR(100),
    units VARCHAR(50),
    price DECIMAL(10,2),
    image_url TEXT,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_address TEXT,
    is_available BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    distance DECIMAL(8, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ss.id,
        ss.user_id,
        ss.name,
        ss.brand,
        ss.category,
        ss.sub_category,
        ss.units,
        ss.price,
        ss.image_url,
        ss.description,
        ss.latitude,
        ss.longitude,
        ss.location_address,
        ss.is_available,
        ss.created_at,
        ss.updated_at,
        calculate_distance(p_user_latitude, p_user_longitude, ss.latitude, ss.longitude)::DECIMAL(8, 2) AS distance
    FROM shared_stock ss
    WHERE 
        ss.is_available = true
        AND ss.latitude IS NOT NULL 
        AND ss.longitude IS NOT NULL
        AND (p_exclude_user_id IS NULL OR ss.user_id != p_exclude_user_id)
        AND (p_category IS NULL OR ss.category = p_category)
        AND calculate_distance(p_user_latitude, p_user_longitude, ss.latitude, ss.longitude) <= p_radius_km
    ORDER BY distance ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search shared products by text
CREATE OR REPLACE FUNCTION search_shared_products(
    p_search_term TEXT,
    p_user_latitude DECIMAL(10, 8) DEFAULT NULL,
    p_user_longitude DECIMAL(11, 8) DEFAULT NULL,
    p_radius_km DECIMAL(8, 2) DEFAULT 50.0,
    p_exclude_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(255),
    brand VARCHAR(100),
    category VARCHAR(100),
    sub_category VARCHAR(100),
    units VARCHAR(50),
    price DECIMAL(10,2),
    image_url TEXT,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_address TEXT,
    is_available BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    distance DECIMAL(8, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ss.id,
        ss.user_id,
        ss.name,
        ss.brand,
        ss.category,
        ss.sub_category,
        ss.units,
        ss.price,
        ss.image_url,
        ss.description,
        ss.latitude,
        ss.longitude,
        ss.location_address,
        ss.is_available,
        ss.created_at,
        ss.updated_at,
        CASE 
            WHEN p_user_latitude IS NOT NULL AND p_user_longitude IS NOT NULL 
                 AND ss.latitude IS NOT NULL AND ss.longitude IS NOT NULL
            THEN ROUND(
                earth_distance(
                    ll_to_earth(p_user_latitude, p_user_longitude),
                    ll_to_earth(ss.latitude, ss.longitude)
                ) / 1000.0, 2
            )::DECIMAL(8, 2)
            ELSE NULL
        END AS distance
    FROM shared_stock ss
    WHERE 
        ss.is_available = true
        AND (p_exclude_user_id IS NULL OR ss.user_id != p_exclude_user_id)
        AND (
            to_tsvector('english', ss.name) @@ plainto_tsquery('english', p_search_term)
            OR LOWER(ss.name) LIKE LOWER('%' || p_search_term || '%')
            OR LOWER(ss.brand) LIKE LOWER('%' || p_search_term || '%')
            OR LOWER(ss.category) LIKE LOWER('%' || p_search_term || '%')
            OR LOWER(ss.sub_category) LIKE LOWER('%' || p_search_term || '%')
            OR LOWER(ss.description) LIKE LOWER('%' || p_search_term || '%')
        )
        AND (
            p_user_latitude IS NULL 
            OR p_user_longitude IS NULL 
            OR ss.latitude IS NULL 
            OR ss.longitude IS NULL
            OR earth_distance(
                ll_to_earth(p_user_latitude, p_user_longitude),
                ll_to_earth(ss.latitude, ss.longitude)
            ) <= (p_radius_km * 1000)
        )
    ORDER BY 
        CASE 
            WHEN p_user_latitude IS NOT NULL AND p_user_longitude IS NOT NULL 
                 AND ss.latitude IS NOT NULL AND ss.longitude IS NOT NULL
            THEN earth_distance(
                ll_to_earth(p_user_latitude, p_user_longitude),
                ll_to_earth(ss.latitude, ss.longitude)
            )
            ELSE 999999999
        END ASC,
        ss.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_shared_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_shared_stock_updated_at
    BEFORE UPDATE ON shared_stock
    FOR EACH ROW
    EXECUTE FUNCTION update_shared_stock_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE shared_stock ENABLE ROW LEVEL SECURITY;

-- Policy for users to view all available shared products
CREATE POLICY "Users can view available shared products" ON shared_stock
    FOR SELECT USING (is_available = true);

-- Policy for users to manage their own shared products
CREATE POLICY "Users can manage their own shared products" ON shared_stock
    FOR ALL USING (auth.uid() = user_id);

-- Policy for authenticated users to insert shared products
CREATE POLICY "Authenticated users can insert shared products" ON shared_stock
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE shared_stock IS 'Stores products shared by users for community trading and selling';
COMMENT ON COLUMN shared_stock.user_id IS 'Reference to the user who shared the product';
COMMENT ON COLUMN shared_stock.name IS 'Name of the shared product';
COMMENT ON COLUMN shared_stock.brand IS 'Brand of the product (optional)';
COMMENT ON COLUMN shared_stock.category IS 'Main category of the product';
COMMENT ON COLUMN shared_stock.sub_category IS 'Sub-category for more specific classification';
COMMENT ON COLUMN shared_stock.units IS 'Unit of measurement (kg, pieces, liters, etc.)';
COMMENT ON COLUMN shared_stock.price IS 'Price per unit in the local currency';
COMMENT ON COLUMN shared_stock.image_url IS 'URL to the product image';
COMMENT ON COLUMN shared_stock.description IS 'Detailed description of the product';
COMMENT ON COLUMN shared_stock.latitude IS 'GPS latitude for location-based searches';
COMMENT ON COLUMN shared_stock.longitude IS 'GPS longitude for location-based searches';
COMMENT ON COLUMN shared_stock.location_address IS 'Human-readable address';
COMMENT ON COLUMN shared_stock.is_available IS 'Whether the product is currently available for sharing';

COMMENT ON FUNCTION get_nearby_shared_products IS 'Finds shared products within a specified radius from given coordinates';
COMMENT ON FUNCTION search_shared_products IS 'Searches shared products by text with optional location filtering';