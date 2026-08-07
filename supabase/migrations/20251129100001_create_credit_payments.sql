-- Migration: Create credit_payments table
-- Requirements: 4.1, 4.7 - Credit payments to wholesalers

CREATE TABLE IF NOT EXISTS public.credit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES profiles(id),
    wholesaler_id UUID NOT NULL REFERENCES profiles(id),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    repayment_period TEXT NOT NULL CHECK (repayment_period IN ('daily', 'weekly', 'monthly')),
    repayment_days INTEGER NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    processing_fee DECIMAL(5,2) DEFAULT 2.0,
    total_repayment DECIMAL(12,2) NOT NULL,
    emi_amount DECIMAL(12,2) NOT NULL,
    outstanding_amount DECIMAL(12,2) NOT NULL,
    next_payment_date DATE,
    status TEXT DEFAULT 'pending_mandate' 
        CHECK (status IN ('pending_mandate', 'active', 'completed', 'defaulted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_payments_retailer_id ON credit_payments(retailer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_wholesaler_id ON credit_payments(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_status ON credit_payments(status);
CREATE INDEX IF NOT EXISTS idx_credit_payments_next_payment ON credit_payments(next_payment_date) WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Retailers can view their own credit payments
CREATE POLICY "Retailers can view own credit payments"
    ON credit_payments FOR SELECT
    USING (auth.uid() = retailer_id);

-- Wholesalers can view payments made to them
CREATE POLICY "Wholesalers can view payments to them"
    ON credit_payments FOR SELECT
    USING (auth.uid() = wholesaler_id);

-- Retailers can create credit payments
CREATE POLICY "Retailers can create credit payments"
    ON credit_payments FOR INSERT
    WITH CHECK (auth.uid() = retailer_id);

-- Retailers can update their own credit payments (for status updates)
CREATE POLICY "Retailers can update own credit payments"
    ON credit_payments FOR UPDATE
    USING (auth.uid() = retailer_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_credit_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_payments_updated_at
    BEFORE UPDATE ON credit_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_payments_updated_at();

COMMENT ON TABLE credit_payments IS 'Stores credit payment records from retailers to wholesalers with repayment schedules';
