-- Migration: Create upi_mandates table
-- Requirements: 4.6 - UPI Autopay mandates for credit payments

CREATE TABLE IF NOT EXISTS public.upi_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_payment_id UUID NOT NULL REFERENCES credit_payments(id) ON DELETE CASCADE,
    mandate_urn TEXT,
    upi_id TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    amount DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_upi_mandates_credit_payment_id ON upi_mandates(credit_payment_id);
CREATE INDEX IF NOT EXISTS idx_upi_mandates_status ON upi_mandates(status);
CREATE INDEX IF NOT EXISTS idx_upi_mandates_mandate_urn ON upi_mandates(mandate_urn) WHERE mandate_urn IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE upi_mandates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view mandates for their credit payments
CREATE POLICY "Users can view own mandates"
    ON upi_mandates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = upi_mandates.credit_payment_id 
            AND cp.retailer_id = auth.uid()
        )
    );

-- Users can create mandates for their credit payments
CREATE POLICY "Users can create own mandates"
    ON upi_mandates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = upi_mandates.credit_payment_id 
            AND cp.retailer_id = auth.uid()
        )
    );

-- Users can update their own mandates
CREATE POLICY "Users can update own mandates"
    ON upi_mandates FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM credit_payments cp 
            WHERE cp.id = upi_mandates.credit_payment_id 
            AND cp.retailer_id = auth.uid()
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_upi_mandates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_upi_mandates_updated_at
    BEFORE UPDATE ON upi_mandates
    FOR EACH ROW
    EXECUTE FUNCTION update_upi_mandates_updated_at();

COMMENT ON TABLE upi_mandates IS 'Stores UPI autopay mandate information for recurring credit payments';
