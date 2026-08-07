-- Add tags column to seller_details table
-- Tags represent product brands/categories that sellers specialize in or exclusively sell
-- Example: A Kanbros distributor might tag: ['Cadbury', 'Parle', 'Chocolates', 'Biscuits']

ALTER TABLE public.seller_details
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_seller_details_tags ON public.seller_details USING GIN(tags);

-- Add comment explaining the tags column
COMMENT ON COLUMN public.seller_details.tags IS 'Array of tags representing product brands, categories, or specialties. Example: ["Cadbury", "Parle", "Chocolates"]';

DO $$
BEGIN
    RAISE NOTICE 'Added tags column to seller_details table successfully';
    RAISE NOTICE 'Tags can be used to filter sellers by product brands/categories they specialize in';
END $$;

