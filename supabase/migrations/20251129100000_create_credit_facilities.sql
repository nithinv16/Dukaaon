-- Migration: Create credit_facilities table
-- Requirements: 4.1, 4.7 - Credit facility for retailers

CREATE TABLE IF NOT EXISTS public.credit_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
    available_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_rejection_reason TEXT,
    kyc_verified_at TIMESTAMP WITH TIME ZONE,
    nbfc_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(retailer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_facilities_retailer_id ON credit_facilities(retailer_id);
CREATE INDEX IF NOT EXISTS idx_credit_facilities_kyc_status ON credit_facilities(kyc_status);

-- Enable Row Level Security
ALTER TABLE credit_facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Retailers can view their own credit facility
CREATE POLICY "Users can view own credit facility"
    ON credit_facilities FOR SELECT
    USING (auth.uid() = retailer_id);

-- Retailers can update their own credit facility (for KYC submission)
CREATE POLICY "Users can update own credit facility"
    ON credit_facilities FOR UPDATE
    USING (auth.uid() = retailer_id);

-- Allow insert for authenticated users (for initial credit facility creation)
CREATE POLICY "Users can create own credit facility"
    ON credit_facilities FOR INSERT
    WITH CHECK (auth.uid() = retailer_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_credit_facilities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_facilities_updated_at
    BEFORE UPDATE ON credit_facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_facilities_updated_at();

COMMENT ON TABLE credit_facilities IS 'Stores credit facility information for retailers including KYC status and credit limits';
