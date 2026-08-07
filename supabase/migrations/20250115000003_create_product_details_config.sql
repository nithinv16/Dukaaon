-- Create product_details_config table for dynamic layout configuration
-- This allows sellers to customize how their product details are displayed
CREATE TABLE IF NOT EXISTS public.product_details_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    layout_type TEXT DEFAULT 'default' CHECK (layout_type IN ('default', 'minimal', 'detailed', 'custom')),
    show_videos_first BOOLEAN DEFAULT false,
    show_seller_info BOOLEAN DEFAULT true,
    show_similar_products BOOLEAN DEFAULT true,
    show_recommended_products BOOLEAN DEFAULT true,
    show_reviews BOOLEAN DEFAULT true,
    sections_order JSONB DEFAULT '[]'::jsonb, -- Array of section names in display order
    custom_styles JSONB DEFAULT '{}'::jsonb, -- Custom CSS-like styles for different sections
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_details_config_product_id ON public.product_details_config(product_id);
CREATE INDEX IF NOT EXISTS idx_product_details_config_layout_type ON public.product_details_config(layout_type);

-- Enable RLS
ALTER TABLE public.product_details_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read access for product details config" ON public.product_details_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sellers can manage their product details config" ON public.product_details_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM products
            WHERE products.id = product_details_config.product_id
            AND products.seller_id = auth.uid()
        )
    );

COMMENT ON TABLE public.product_details_config IS 'Stores dynamic layout configuration for product details pages';
COMMENT ON COLUMN public.product_details_config.layout_type IS 'Type of layout: default, minimal, detailed, or custom';
COMMENT ON COLUMN public.product_details_config.sections_order IS 'JSON array defining the order of sections to display';
COMMENT ON COLUMN public.product_details_config.custom_styles IS 'JSON object with custom styling for different sections';

DO $$
BEGIN
    RAISE NOTICE 'Created product_details_config table successfully';
END $$;

