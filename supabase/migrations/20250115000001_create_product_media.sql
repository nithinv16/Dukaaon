-- Create product_media table for storing multiple images and videos for products
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER DEFAULT 0,
    caption TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON public.product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_display_order ON public.product_media(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_media_primary ON public.product_media(product_id, is_primary) WHERE is_primary = true;

-- Enable RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read access for product media" ON public.product_media
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sellers can manage their product media" ON public.product_media
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM products
            WHERE products.id = product_media.product_id
            AND products.seller_id = auth.uid()
        )
    );

COMMENT ON TABLE public.product_media IS 'Stores multiple images and videos for products';
COMMENT ON COLUMN public.product_media.media_type IS 'Type of media: image or video';
COMMENT ON COLUMN public.product_media.display_order IS 'Order in which media should be displayed';
COMMENT ON COLUMN public.product_media.is_primary IS 'Whether this is the primary/featured image';

DO $$
BEGIN
    RAISE NOTICE 'Created product_media table successfully';
END $$;

