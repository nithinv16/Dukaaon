-- Add has_volatile_pricing flag to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS has_volatile_pricing BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_volatile_pricing 
ON public.products(has_volatile_pricing) 
WHERE has_volatile_pricing = TRUE;

COMMENT ON COLUMN public.products.has_volatile_pricing IS 'Indicates if the product has volatile pricing that changes frequently (e.g., onions, potatoes, garlic, rice)';

-- Update existing products that match volatile pricing keywords
UPDATE public.products
SET has_volatile_pricing = TRUE
WHERE LOWER(name) ~ '(onion|potato|garlic|rice|tomato|potatoes|onions|tomatoes)'
  AND has_volatile_pricing IS NULL OR has_volatile_pricing = FALSE;

DO $$
BEGIN
    RAISE NOTICE 'Added has_volatile_pricing column to products table and updated existing products';
END $$;
