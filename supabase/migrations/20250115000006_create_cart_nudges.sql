-- Create table for cart nudges/messages
CREATE TABLE IF NOT EXISTS public.cart_nudges (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    nudge_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('warning', 'info', 'success', 'error')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    icon TEXT,
    priority INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('always', 'volatile_products', 'min_order', 'item_count', 'delivery_distance', 'custom', 'category')),
    condition_value JSONB, -- Flexible condition storage (e.g., {"min_subtotal": 500, "max_item_count": 10})
    condition_description TEXT, -- Human-readable description of the condition
    storage_key TEXT NOT NULL UNIQUE, -- AsyncStorage key for dismissal
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_cart_nudges_active 
ON public.cart_nudges(is_active, priority DESC, display_order) 
WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cart_nudges_nudge_id 
ON public.cart_nudges(nudge_id);

COMMENT ON TABLE public.cart_nudges IS 'Dynamic cart nudges/messages that can be managed from the database';
COMMENT ON COLUMN public.cart_nudges.nudge_id IS 'Unique identifier for the nudge (e.g., price-warning, min-order)';
COMMENT ON COLUMN public.cart_nudges.type IS 'Nudge type: warning, info, success, or error';
COMMENT ON COLUMN public.cart_nudges.condition_type IS 'Type of condition to check: always, volatile_products, min_order, item_count, delivery_distance, custom, category';
COMMENT ON COLUMN public.cart_nudges.condition_value IS 'JSON object containing condition parameters (e.g., {"min_subtotal": 500, "categories": ["Vegetables"]})';
COMMENT ON COLUMN public.cart_nudges.storage_key IS 'AsyncStorage key used to track dismissal state';

-- Enable RLS
ALTER TABLE public.cart_nudges ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view cart nudges
CREATE POLICY "Allow all authenticated users to view cart nudges"
ON public.cart_nudges FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow only admins/sellers to manage cart nudges
-- For now, allow authenticated users - you can restrict this later
CREATE POLICY "Allow authenticated users to insert cart nudges"
ON public.cart_nudges FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update cart nudges"
ON public.cart_nudges FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete cart nudges"
ON public.cart_nudges FOR DELETE 
USING (auth.role() = 'authenticated');

-- Insert default cart nudges
INSERT INTO public.cart_nudges (
    nudge_id, 
    type, 
    title, 
    message, 
    icon, 
    priority, 
    condition_type, 
    condition_value,
    condition_description,
    storage_key,
    display_order
) VALUES
(
    'price-warning',
    'warning',
    'Price may vary for some products',
    'Some products like Onions, Potatoes, Garlic, and Rice have prices that change frequently. The seller may not update prices in real-time. You can check the final bill and pay by Cash on Delivery.',
    'alert-circle',
    10,
    'volatile_products',
    NULL,
    'Show when cart contains products with volatile pricing',
    'cart_price_warning_dismissed',
    0
),
(
    'cod-payment-info',
    'info',
    'Cash on Delivery available',
    'You can verify the product prices and pay by cash when the order is delivered.',
    'cash',
    5,
    'always',
    NULL,
    'Show for all orders when COD payment method is selected',
    'cart_cod_info_dismissed',
    1
)
ON CONFLICT (nudge_id) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Created cart_nudges table with default data';
END $$;
