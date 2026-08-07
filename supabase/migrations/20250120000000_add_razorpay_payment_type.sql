-- Migration: Add 'razorpay' as a valid payment method type
-- This allows Razorpay to be stored as a payment method in the database

-- Drop the existing CHECK constraint
ALTER TABLE public.payment_methods 
DROP CONSTRAINT IF EXISTS payment_methods_type_check;

-- Add new CHECK constraint that includes 'razorpay'
ALTER TABLE public.payment_methods 
ADD CONSTRAINT payment_methods_type_check 
CHECK (type IN ('upi', 'card', 'netbanking', 'cod', 'razorpay'));

-- Add comment to document the change
COMMENT ON COLUMN public.payment_methods.type IS 
'Payment method type: upi, card, netbanking, cod, or razorpay (payment gateway)';

