-- Add KYC-related columns to loan_applications table
-- These fields will store data auto-fetched from retailer's KYC documents

ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS kyc_business_name TEXT,
ADD COLUMN IF NOT EXISTS kyc_owner_name TEXT,
ADD COLUMN IF NOT EXISTS kyc_gstin TEXT,
ADD COLUMN IF NOT EXISTS kyc_pan TEXT,
ADD COLUMN IF NOT EXISTS kyc_business_address TEXT,
ADD COLUMN IF NOT EXISTS kyc_pincode TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.loan_applications.kyc_business_name IS 'Business name auto-fetched from retailer KYC';
COMMENT ON COLUMN public.loan_applications.kyc_owner_name IS 'Owner name auto-fetched from retailer KYC';
COMMENT ON COLUMN public.loan_applications.kyc_gstin IS 'GSTIN auto-fetched from retailer KYC';
COMMENT ON COLUMN public.loan_applications.kyc_pan IS 'PAN auto-fetched from retailer KYC';
COMMENT ON COLUMN public.loan_applications.kyc_business_address IS 'Business address auto-fetched from retailer KYC';
COMMENT ON COLUMN public.loan_applications.kyc_pincode IS 'Pincode auto-fetched from retailer KYC';

-- Update repayment_frequency check constraint to include 'daily'
ALTER TABLE public.loan_applications
DROP CONSTRAINT IF EXISTS loan_applications_repayment_frequency_check;

ALTER TABLE public.loan_applications
ADD CONSTRAINT loan_applications_repayment_frequency_check 
CHECK (repayment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly'));

-- Add tenure_unit column to support days or months
ALTER TABLE public.loan_applications
ADD COLUMN IF NOT EXISTS tenure_unit TEXT DEFAULT 'months' CHECK (tenure_unit IN ('days', 'months'));

COMMENT ON COLUMN public.loan_applications.tenure_unit IS 'Unit for tenure: days or months';

DO $$
BEGIN
    RAISE NOTICE 'Added KYC fields, updated repayment_frequency constraint, and added tenure_unit to loan_applications table';
END $$;

