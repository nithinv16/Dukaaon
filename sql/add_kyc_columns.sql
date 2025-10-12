-- Add KYC document URL columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS id_proof TEXT,
ADD COLUMN IF NOT EXISTS address_proof TEXT,
ADD COLUMN IF NOT EXISTS business_proof TEXT;

-- Add kyc_status column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_status BOOLEAN DEFAULT FALSE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);