-- Create customers table for sellers to manage their customer relationships
-- This table allows sellers to add customers manually or select from retailer database

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Customer identification
    retailer_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Link to existing retailer profile if selected from database
    
    -- Customer details (can be manually entered or copied from retailer profile)
    business_name TEXT NOT NULL,
    owner_name TEXT,
    phone_number TEXT NOT NULL,
    email TEXT,
    address JSONB DEFAULT '{}', -- {"street": "", "city": "", "state": "", "pincode": "", "landmark": ""}
    location_address TEXT, -- Full formatted address
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Customer relationship data
    customer_type TEXT DEFAULT 'manual' CHECK (customer_type IN ('manual', 'retailer')), -- manual = manually added, retailer = selected from retailer database
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    
    -- Business relationship
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    payment_terms TEXT DEFAULT 'cash', -- cash, credit_7, credit_15, credit_30
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    tags TEXT[], -- Array of tags for categorization
    added_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_order_date TIMESTAMP WITH TIME ZONE,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate customers for same seller
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_seller_phone 
ON public.customers(seller_id, phone_number) 
WHERE status != 'blocked';

-- Create unique constraint for retailer profile per seller (prevent adding same retailer twice)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_seller_retailer 
ON public.customers(seller_id, retailer_profile_id) 
WHERE retailer_profile_id IS NOT NULL AND status != 'blocked';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON public.customers(seller_id);
CREATE INDEX IF NOT EXISTS idx_customers_retailer_profile_id ON public.customers(retailer_profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_location ON public.customers(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON public.customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON public.customers(business_name);

-- Enable RLS on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Sellers can manage their own customers" ON public.customers;
CREATE POLICY "Sellers can manage their own customers" ON public.customers
    FOR ALL USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = customers.seller_id 
            AND profiles.phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        )
    );

-- Function to update customer stats when orders are placed
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update customer stats when an order is created/updated
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE customers 
        SET 
            total_orders = (
                SELECT COUNT(*) 
                FROM orders 
                WHERE retailer_id = NEW.retailer_id 
                AND seller_id = NEW.seller_id
            ),
            total_spent = (
                SELECT COALESCE(SUM(total_amount), 0) 
                FROM orders 
                WHERE retailer_id = NEW.retailer_id 
                AND seller_id = NEW.seller_id
                AND status NOT IN ('cancelled', 'refunded')
            ),
            last_order_date = (
                SELECT MAX(created_at) 
                FROM orders 
                WHERE retailer_id = NEW.retailer_id 
                AND seller_id = NEW.seller_id
            ),
            updated_at = NOW()
        WHERE seller_id = NEW.seller_id 
        AND (
            retailer_profile_id = NEW.retailer_id 
            OR phone_number = (
                SELECT phone_number 
                FROM profiles 
                WHERE id = NEW.retailer_id
            )
        );
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update customer stats
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON orders;
CREATE TRIGGER trigger_update_customer_stats
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();

-- Function to get nearby retailers for customer selection
CREATE OR REPLACE FUNCTION get_nearby_retailers(
    seller_lat DECIMAL,
    seller_lng DECIMAL,
    radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    business_name TEXT,
    owner_name TEXT,
    phone_number TEXT,
    address JSONB,
    location_address TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        COALESCE(p.business_details->>'shopName', 'Unknown Business') as business_name,
        COALESCE(p.business_details->>'ownerName', 'Unknown Owner') as owner_name,
        p.phone_number,
        COALESCE(p.business_details->'address', '{}'::jsonb) as address,
        COALESCE(p.business_details->>'address', '') as location_address,
        (p.business_details->>'latitude')::DECIMAL as latitude,
        (p.business_details->>'longitude')::DECIMAL as longitude,
        (
            6371 * acos(
                cos(radians(seller_lat)) * 
                cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
                cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(seller_lng)) + 
                sin(radians(seller_lat)) * 
                sin(radians((p.business_details->>'latitude')::DECIMAL))
            )
        ) as distance_km
    FROM profiles p
    WHERE 
        p.role = 'retailer'
        AND p.business_details IS NOT NULL
        AND p.business_details->>'latitude' IS NOT NULL
        AND p.business_details->>'longitude' IS NOT NULL
        AND p.business_details->>'shopName' IS NOT NULL
        AND p.business_details->>'shopName' != ''
        AND (
            6371 * acos(
                cos(radians(seller_lat)) * 
                cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
                cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(seller_lng)) + 
                sin(radians(seller_lat)) * 
                sin(radians((p.business_details->>'latitude')::DECIMAL))
            )
        ) <= radius_km
    ORDER BY distance_km ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Function to add retailer as customer
CREATE OR REPLACE FUNCTION add_retailer_as_customer(
    p_seller_id UUID,
    p_retailer_id UUID
)
RETURNS UUID AS $$
DECLARE
    customer_id UUID;
    retailer_data RECORD;
BEGIN
    -- Get retailer data
    SELECT 
        COALESCE(business_details->>'shopName', 'Unknown Business') as business_name,
        COALESCE(business_details->>'ownerName', 'Unknown Owner') as owner_name,
        phone_number,
        COALESCE(business_details->'address', '{}'::jsonb) as address,
        COALESCE(business_details->>'address', '') as location_address,
        (business_details->>'latitude')::DECIMAL as latitude,
        (business_details->>'longitude')::DECIMAL as longitude
    INTO retailer_data
    FROM profiles
    WHERE id = p_retailer_id AND role = 'retailer';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Retailer not found';
    END IF;
    
    -- Insert customer record
    INSERT INTO customers (
        seller_id,
        retailer_profile_id,
        business_name,
        owner_name,
        phone_number,
        address,
        location_address,
        latitude,
        longitude,
        customer_type
    ) VALUES (
        p_seller_id,
        p_retailer_id,
        retailer_data.business_name,
        retailer_data.owner_name,
        retailer_data.phone_number,
        retailer_data.address,
        retailer_data.location_address,
        retailer_data.latitude,
        retailer_data.longitude,
        'retailer'
    )
    RETURNING id INTO customer_id;
    
    RETURN customer_id;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON customers;
CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log the table creation
RAISE NOTICE 'customers table created successfully with all required columns and functions';