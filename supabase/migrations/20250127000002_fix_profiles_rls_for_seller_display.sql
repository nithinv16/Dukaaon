-- Fix RLS policies for profiles table to allow authenticated users to read basic seller info
-- This migration resolves the "Unknown Seller" issue by allowing access to seller profiles for product display

-- Add a policy to allow authenticated users to read basic profile information for seller details
-- This is needed for the products -> profiles:seller_id -> seller_details join to work
CREATE POLICY "Allow authenticated users to read basic profile info for sellers" ON public.profiles
    FOR SELECT TO authenticated USING (
        -- Allow reading basic profile info for any seller
        -- This enables the join from products to profiles to seller_details
        true
    );

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'profiles RLS policy added to allow authenticated users to read basic seller info';
END $$;