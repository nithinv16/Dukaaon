-- Create seller_details table with all required columns
-- This table stores seller-specific information for wholesalers and manufacturers

CREATE TABLE IF NOT EXISTS public.seller_details (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_details_user_id ON public.seller_details(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_details_seller_type ON public.seller_details(seller_type);
CREATE INDEX IF NOT EXISTS idx_seller_details_location ON public.seller_details(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_seller_details_active ON public.seller_details(is_active);

-- Enable RLS on seller_details table
ALTER TABLE public.seller_details ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own seller details" ON public.seller_details;
CREATE POLICY "Users can view their own seller details" ON public.seller_details
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = seller_details.user_id 
            AND profiles.phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        )
    );

DROP POLICY IF EXISTS "Users can update their own seller details" ON public.seller_details;
CREATE POLICY "Users can update their own seller details" ON public.seller_details
    FOR UPDATE USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = seller_details.user_id 
            AND profiles.phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        )
    );

DROP POLICY IF EXISTS "Users can insert their own seller details" ON public.seller_details;
CREATE POLICY "Users can insert their own seller details" ON public.seller_details
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = seller_details.user_id 
            AND profiles.phone_number = (current_setting('request.jwt.claims', true)::json->>'phone')::text
        )
    );

-- Allow authenticated users to read all seller details (for nearby searches)
DROP POLICY IF EXISTS "Allow authenticated users to read seller details" ON public.seller_details;
CREATE POLICY "Allow authenticated users to read seller details" ON public.seller_details
    FOR SELECT TO authenticated USING (is_active = true);

-- Log the table creation
DO $$
BEGIN
    RAISE NOTICE 'seller_details table created successfully with all required columns';
END $$;