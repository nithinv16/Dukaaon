-- Create product_reviews table for storing ratings and comments
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, user_id) -- One review per user per product
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON public.product_reviews(product_id, rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON public.product_reviews(product_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public read access for product reviews" ON public.product_reviews
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own reviews" ON public.product_reviews
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews" ON public.product_reviews
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reviews" ON public.product_reviews
    FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMENT ON TABLE public.product_reviews IS 'Stores product reviews with ratings and comments';
COMMENT ON COLUMN public.product_reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN public.product_reviews.is_verified_purchase IS 'Whether the reviewer purchased this product';
COMMENT ON COLUMN public.product_reviews.helpful_count IS 'Number of users who found this review helpful';

DO $$
BEGIN
    RAISE NOTICE 'Created product_reviews table successfully';
END $$;

