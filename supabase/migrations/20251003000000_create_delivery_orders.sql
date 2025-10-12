-- Create delivery_orders table for managing wholesaler deliveries
-- This table stores delivery bookings made by sellers (wholesalers) to retailers or manual entries

CREATE TABLE IF NOT EXISTS public.delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actors
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    retailer_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Reference to retailer profile (nullable for manual entries)

    -- Manual retailer entry (used when retailer_id is NULL)
    manual_retailer JSONB, -- { business_name, address, phone }

    -- Contact phone for delivery
    phone_number VARCHAR(20),

    -- Optional delivery partner location/notes
    delivery_partner_location TEXT,

    -- Scheduling
    estimated_delivery_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    -- UI expects these fields for details page; keep in sync via trigger
    delivery_date DATE,
    delivery_time TIME WITHOUT TIME ZONE,

    -- Financials & metadata
    amount_to_collect DECIMAL(10,2),
    delivery_notes TEXT, -- free-form notes or JSON text from manual entry

    -- Status lifecycle
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending','in_transit','delivered','cancelled')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_orders_seller_id ON public.delivery_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_retailer_id ON public.delivery_orders(retailer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON public.delivery_orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_estimated_time ON public.delivery_orders(estimated_delivery_time DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at ON public.delivery_orders(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies: sellers (wholesalers) can manage their own delivery orders
CREATE POLICY "Sellers can view their own delivery orders" ON public.delivery_orders
    FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own delivery orders" ON public.delivery_orders
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own delivery orders" ON public.delivery_orders
    FOR UPDATE USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own delivery orders" ON public.delivery_orders
    FOR DELETE USING (seller_id = auth.uid());

-- Trigger: keep updated_at fresh and backfill UI helper fields
CREATE OR REPLACE FUNCTION public.delivery_orders_before_write()
RETURNS TRIGGER AS $$
DECLARE
    v_json JSONB;
BEGIN
    -- Always bump updated_at on write
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at := NOW();
    END IF;

    -- Derive delivery_date and delivery_time from estimated_delivery_time for UI components
    IF NEW.estimated_delivery_time IS NOT NULL THEN
        NEW.delivery_date := DATE(NEW.estimated_delivery_time);
        NEW.delivery_time := CAST(NEW.estimated_delivery_time AS TIME);
    END IF;

    -- Populate manual_retailer JSONB from delivery_notes when provided as JSON text
    -- Expected keys: business_name, address, phone
    IF NEW.retailer_id IS NULL AND NEW.delivery_notes IS NOT NULL THEN
        BEGIN
            v_json := NEW.delivery_notes::jsonb;
        EXCEPTION WHEN others THEN
            v_json := NULL;
        END;

        IF v_json IS NOT NULL THEN
            NEW.manual_retailer := jsonb_build_object(
                'business_name', v_json->>'business_name',
                'address', v_json->>'address',
                'phone', v_json->>'phone'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delivery_orders_before_write ON public.delivery_orders;
CREATE TRIGGER trigger_delivery_orders_before_write
    BEFORE INSERT OR UPDATE ON public.delivery_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.delivery_orders_before_write();