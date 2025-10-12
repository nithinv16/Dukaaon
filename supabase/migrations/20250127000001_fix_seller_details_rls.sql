-- Fix RLS policies for seller_details table to allow proper access for product display
-- This migration resolves the "Unknown Seller" issue in category screens

-- Drop all existing conflicting policies for seller_details
DROP POLICY IF EXISTS "Users can view their own seller details" ON public.seller_details;
DROP POLICY IF EXISTS "Allow authenticated users to read seller details" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_public_access" ON public.seller_details;
DROP POLICY IF EXISTS "Users can update their own seller details" ON public.seller_details;
DROP POLICY IF EXISTS "Users can insert their own seller details" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_own_access" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_read_access" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_update_access" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_insert_access" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_update_own" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_insert_own" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_delete_own" ON public.seller_details;

-- Ensure RLS is enabled
ALTER TABLE public.seller_details ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies

-- 1. Allow users to manage their own seller details (all operations)
CREATE POLICY "seller_details_own_access" ON public.seller_details
    FOR ALL USING (
        user_id = auth.uid()
    );

-- 2. Allow all authenticated users to read seller details (for product display)
-- Using business_name IS NOT NULL as a simple filter instead of is_active
CREATE POLICY "seller_details_read_access" ON public.seller_details
    FOR SELECT TO authenticated USING (
        business_name IS NOT NULL 
        AND business_name != ''
    );

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'seller_details RLS policies updated successfully - simplified version without is_active dependency';
END $$;