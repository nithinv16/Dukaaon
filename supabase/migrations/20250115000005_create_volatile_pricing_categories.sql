-- Create table for volatile pricing categories
CREATE TABLE IF NOT EXISTS public.volatile_pricing_categories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint that handles NULL subcategories properly
-- For rows with NULL subcategory, only one per category is allowed
-- For rows with non-NULL subcategory, combination must be unique
-- Using partial unique indexes for better NULL handling
CREATE UNIQUE INDEX IF NOT EXISTS idx_volatile_pricing_categories_unique_null 
ON public.volatile_pricing_categories(category) 
WHERE subcategory IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_volatile_pricing_categories_unique_not_null 
ON public.volatile_pricing_categories(category, subcategory) 
WHERE subcategory IS NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_volatile_pricing_categories_category 
ON public.volatile_pricing_categories(category);

CREATE INDEX IF NOT EXISTS idx_volatile_pricing_categories_active 
ON public.volatile_pricing_categories(is_active) 
WHERE is_active = TRUE;

COMMENT ON TABLE public.volatile_pricing_categories IS 'Categories and subcategories that have volatile pricing. Products in these categories automatically have volatile pricing.';
COMMENT ON COLUMN public.volatile_pricing_categories.category IS 'Category name (e.g., Vegetables, Grains)';
COMMENT ON COLUMN public.volatile_pricing_categories.subcategory IS 'Optional subcategory name (e.g., Root Vegetables, Pulses). NULL means all subcategories in the category.';

-- Enable RLS
ALTER TABLE public.volatile_pricing_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view volatile pricing categories
CREATE POLICY "Allow all authenticated users to view volatile pricing categories"
ON public.volatile_pricing_categories FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow only admins/sellers to manage volatile pricing categories
-- For now, allow authenticated users - you can restrict this later
CREATE POLICY "Allow authenticated users to insert volatile pricing categories"
ON public.volatile_pricing_categories FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update volatile pricing categories"
ON public.volatile_pricing_categories FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete volatile pricing categories"
ON public.volatile_pricing_categories FOR DELETE 
USING (auth.role() = 'authenticated');

-- Insert some default volatile categories
INSERT INTO public.volatile_pricing_categories (category, subcategory, description) 
SELECT * FROM (VALUES
    ('Vegetables', 'Root Vegetables', 'Root vegetables like onions, potatoes, garlic have volatile pricing'),
    ('Grains', 'Rice', 'Rice prices fluctuate frequently')
) AS v(category, subcategory, description)
WHERE NOT EXISTS (
    SELECT 1 FROM public.volatile_pricing_categories vpc 
    WHERE vpc.category = v.category 
    AND (vpc.subcategory = v.subcategory OR (vpc.subcategory IS NULL AND v.subcategory IS NULL))
);

DO $$
BEGIN
    RAISE NOTICE 'Created volatile_pricing_categories table with default data';
END $$;
