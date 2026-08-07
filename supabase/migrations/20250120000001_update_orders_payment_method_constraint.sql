-- Migration: Update orders.payment_method constraint to allow new payment methods
-- This allows 'razorpay', 'cod', 'card', 'netbanking' in addition to existing values

-- First, check if the constraint exists and drop it
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'valid_payment_method' 
        AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT valid_payment_method;
    END IF;
END $$;

-- Add new constraint that includes all payment methods
ALTER TABLE public.orders 
ADD CONSTRAINT valid_payment_method 
CHECK (payment_method IN ('cash', 'credit', 'online', 'upi', 'razorpay', 'cod', 'card', 'netbanking'));

-- Add comment to document the change
COMMENT ON COLUMN public.orders.payment_method IS 
'Payment method: cash (COD), credit, online (includes razorpay, card, netbanking), upi, razorpay, cod, card, netbanking';

