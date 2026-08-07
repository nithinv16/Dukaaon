-- Migration: Update payment_transactions.payment_method constraint to allow new payment methods
-- This allows 'razorpay', 'cod', 'card', 'netbanking' in addition to existing values

-- First, check if the constraint exists and drop it
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'payment_transactions_payment_method_check' 
        AND conrelid = 'public.payment_transactions'::regclass
    ) THEN
        ALTER TABLE public.payment_transactions DROP CONSTRAINT payment_transactions_payment_method_check;
    END IF;
END $$;

-- Add new constraint that includes all payment methods
-- Note: If payment_transactions table doesn't exist, this will fail gracefully
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_transactions'
    ) THEN
        ALTER TABLE public.payment_transactions 
        ADD CONSTRAINT payment_transactions_payment_method_check 
        CHECK (payment_method IN ('upi', 'card', 'netbanking', 'cod', 'razorpay', 'cash', 'credit', 'online'));
        
        -- Add comment to document the change
        COMMENT ON COLUMN public.payment_transactions.payment_method IS 
        'Payment method: upi, card, netbanking, cod, razorpay, cash, credit, online';
    END IF;
END $$;

