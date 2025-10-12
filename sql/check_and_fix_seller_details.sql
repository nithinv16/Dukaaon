-- Check and fix seller_details table structure
-- This script ensures the seller_details table exists with all required columns

DO $$
DECLARE
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- Check if seller_details table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'seller_details'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'seller_details table does not exist. Creating it...';
        
        -- Create the table
        CREATE TABLE public.seller_details (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            seller_type TEXT NOT NULL DEFAULT 'wholesaler',
            business_name TEXT,
    owner_name TEXT,
            address JSONB DEFAULT '{}',
            location_address TEXT,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            image_url TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create unique constraint on user_id
        ALTER TABLE public.seller_details 
        ADD CONSTRAINT seller_details_user_id_unique UNIQUE (user_id);
        
        -- Create indexes
        CREATE INDEX idx_seller_details_user_id ON public.seller_details(user_id);
        CREATE INDEX idx_seller_details_seller_type ON public.seller_details(seller_type);
        CREATE INDEX idx_seller_details_location ON public.seller_details(latitude, longitude);
        CREATE INDEX idx_seller_details_active ON public.seller_details(is_active);
        
        RAISE NOTICE 'seller_details table created successfully';
    ELSE
        RAISE NOTICE 'seller_details table already exists. Checking columns...';
        
        -- Check and add missing columns
        
        -- Check business_name column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'seller_details' 
            AND column_name = 'business_name'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE seller_details ADD COLUMN business_name TEXT;
            RAISE NOTICE 'Added business_name column to seller_details';
        END IF;
        
        -- Check owner_name column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'seller_details' 
            AND column_name = 'owner_name'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE seller_details ADD COLUMN owner_name TEXT;
            RAISE NOTICE 'Added owner_name column to seller_details';
        END IF;
        
        -- Check image_url column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'seller_details' 
            AND column_name = 'image_url'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE seller_details ADD COLUMN image_url TEXT;
            RAISE NOTICE 'Added image_url column to seller_details';
        END IF;
        
        -- Check is_active column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'seller_details' 
            AND column_name = 'is_active'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE seller_details ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_active column to seller_details';
        END IF;
    END IF;
    
    -- Enable RLS if not already enabled
    IF table_exists OR NOT table_exists THEN
        ALTER TABLE public.seller_details ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on seller_details table';
    END IF;
    
END $$;

-- Show the current structure of seller_details table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'seller_details'
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;

-- Show sample data if any exists
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN business_name IS NOT NULL THEN 1 END) as records_with_business_name,
    COUNT(CASE WHEN owner_name IS NOT NULL THEN 1 END) as records_with_owner_name
FROM 
    seller_details;

RAISE NOTICE 'seller_details table structure check completed';