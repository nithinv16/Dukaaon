-- Create the missing RPC function: public.create_delivery_batch
-- Aligns with services/masterOrderService.ts usage and master_order_system.sql reference

BEGIN;

-- Ensure the function exists with the expected signature
CREATE OR REPLACE FUNCTION public.create_delivery_batch(
    p_master_order_id UUID,
    p_pickup_locations JSONB,
    p_delivery_address JSONB,
    p_total_amount DECIMAL(10,2),
    p_delivery_fee DECIMAL(10,2),
    p_distance_km DECIMAL(8,2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_delivery_batch_id UUID;
    v_batch_number VARCHAR(50);
BEGIN
    -- Generate batch number (function should already exist)
    v_batch_number := public.generate_delivery_batch_number();

    -- Insert delivery batch
    INSERT INTO public.delivery_batches (
        batch_number,
        master_order_id,
        pickup_locations,
        delivery_address,
        total_amount,
        delivery_fee,
        distance_km
    ) VALUES (
        v_batch_number,
        p_master_order_id,
        p_pickup_locations,
        p_delivery_address,
        p_total_amount,
        p_delivery_fee,
        p_distance_km
    ) RETURNING id INTO v_delivery_batch_id;

    RETURN v_delivery_batch_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;