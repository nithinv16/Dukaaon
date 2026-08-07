-- Add description column to seller_details table
-- This allows sellers to provide a brief description of their business

ALTER TABLE public.seller_details 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.seller_details.description IS 'Brief description of the seller business, displayed in nearby seller cards';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Added description column to seller_details table successfully';
END $$;

