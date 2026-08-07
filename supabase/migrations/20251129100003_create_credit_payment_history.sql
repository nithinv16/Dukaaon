-- Migration: Create credit_payment_history table
-- Requirements: 4.7, 4.8 - Payment history for credit payments

CREATE TABLE IF NOT EXISTS public.credit_payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_payment_id UUID NOT NULL REFERENCES credit_payments(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method TEXT DEFAULT 'upi_mandate',
    transaction_id TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_payment_history_credit_payment_id ON credit_payment_history(credit_payment_id);
CREATE INDEX IF NOT EXISTS idx_credit_payment_history_payment_date ON credit_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_credit_payment_history_status ON credit_payment_history(status);
CREATE INDEX IF NOT EXISTS idx_credit_payment_history_transaction_id ON credit_payment_history(transaction_id) WHERE transaction_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE credit_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view payment history for their credit payments
CREATE POLICY "Users can view own payment history"
    ON credit_payment_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = credit_payment_history.credit_payment_id 
            AND cp.retailer_id = auth.uid()
        )
    );

-- Wholesalers can view payment history for payments to them
CREATE POLICY "Wholesalers can view payment history"
    ON credit_payment_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = credit_payment_history.credit_payment_id 
            AND cp.wholesaler_id = auth.uid()
        )
    );

-- System can insert payment history (via service role)
CREATE POLICY "System can create payment history"
    ON credit_payment_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = credit_payment_history.credit_payment_id 
            AND cp.retailer_id = auth.uid()
        )
    );

COMMENT ON TABLE credit_payment_history IS 'Stores individual payment records for credit repayments';

-- Create a function to update outstanding amount after payment
CREATE OR REPLACE FUNCTION update_outstanding_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' THEN
        UPDATE credit_payments
        SET outstanding_amount = outstanding_amount - NEW.amount,
            status = CASE 
                WHEN outstanding_amount - NEW.amount <= 0 THEN 'completed'
                ELSE status
            END
        WHERE id = NEW.credit_payment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_outstanding_after_payment
    AFTER INSERT ON credit_payment_history
    FOR EACH ROW
    EXECUTE FUNCTION update_outstanding_after_payment();
