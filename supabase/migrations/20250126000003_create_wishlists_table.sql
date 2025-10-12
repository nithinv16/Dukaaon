-- Create wishlists table for managing user wishlists
-- This table stores products that users have added to their wishlist

CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_at_wishlist DECIMAL(10, 2), -- Price when added to wishlist for comparison
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate wishlist entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlists_user_product ON public.wishlists(user_id, product_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_created_at ON public.wishlists(created_at DESC);

-- Add comments to document the table and columns
COMMENT ON TABLE public.wishlists IS 'Stores user wishlist items with product references';
COMMENT ON COLUMN public.wishlists.user_id IS 'Reference to the user profile who owns the wishlist';
COMMENT ON COLUMN public.wishlists.product_id IS 'Reference to the product in the wishlist';
COMMENT ON COLUMN public.wishlists.price_at_wishlist IS 'Product price when added to wishlist for price tracking';

-- Enable Row Level Security (RLS)
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wishlists
CREATE POLICY "Users can view their own wishlist items" ON public.wishlists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlist items" ON public.wishlists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlist items" ON public.wishlists
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlist items" ON public.wishlists
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wishlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wishlists_updated_at
    BEFORE UPDATE ON public.wishlists
    FOR EACH ROW
    EXECUTE FUNCTION update_wishlists_updated_at();