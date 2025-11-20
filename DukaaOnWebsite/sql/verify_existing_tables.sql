-- Verification script for existing database tables
-- This script checks the structure of existing tables that the website will use

-- ============================================================================
-- 1. VERIFY PROFILES TABLE (Main user table)
-- ============================================================================
-- The profiles table stores all users (retailers, wholesalers, manufacturers)
-- Sellers are profiles with role = 'wholesaler' or 'manufacturer'

SELECT 'Checking profiles table structure...' as status;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if profiles table has required fields for sellers
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'profiles' 
            AND column_name IN ('id', 'phone_number', 'role', 'business_details')
        ) 
        THEN '✓ Profiles table has required fields'
        ELSE '✗ Profiles table missing required fields'
    END as validation_result;

-- Sample query to get sellers (wholesalers and manufacturers)
SELECT 
    id,
    phone_number,
    role,
    business_details->>'shopName' as business_name,
    business_details->>'ownerName' as owner_name,
    business_details->>'address' as location_address,
    (business_details->>'latitude')::DECIMAL as latitude,
    (business_details->>'longitude')::DECIMAL as longitude,
    status,
    created_at
FROM profiles
WHERE role IN ('wholesaler', 'manufacturer')
AND status = 'active'
LIMIT 5;

-- ============================================================================
-- 2. VERIFY SELLER_DETAILS TABLE (Extended seller information)
-- ============================================================================
-- This table provides additional seller-specific information

SELECT 'Checking seller_details table structure...' as status;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'seller_details'
ORDER BY ordinal_position;

-- Check if seller_details table exists and has required fields
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'seller_details'
        ) 
        THEN '✓ Seller_details table exists'
        ELSE '✗ Seller_details table does not exist'
    END as validation_result;

-- Sample query to get seller details
SELECT 
    sd.id,
    sd.user_id,
    sd.seller_type,
    sd.business_name,
    sd.owner_name,
    sd.location_address,
    sd.latitude,
    sd.longitude,
    sd.is_active,
    p.phone_number,
    p.business_details
FROM seller_details sd
JOIN profiles p ON sd.user_id = p.id
WHERE sd.is_active = true
LIMIT 5;

-- ============================================================================
-- 3. VERIFY PRODUCTS/MASTER_PRODUCTS TABLE
-- ============================================================================
-- Check for products or master_products table

SELECT 'Checking for products tables...' as status;

-- Check if master_products table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'master_products'
        ) 
        THEN '✓ Master_products table exists'
        ELSE '✗ Master_products table does not exist'
    END as validation_result;

-- If master_products exists, show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'master_products'
ORDER BY ordinal_position;

-- Check if products table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'products'
        ) 
        THEN '✓ Products table exists'
        ELSE '✗ Products table does not exist'
    END as validation_result;

-- If products exists, show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'products'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. TEST DISTANCE CALCULATION QUERY
-- ============================================================================
-- Test the Haversine formula for distance calculation
-- This is what the website will use to find nearby sellers

SELECT 'Testing distance calculation...' as status;

-- Example: Find sellers within 100km of a test location (Mumbai coordinates)
-- Replace with actual coordinates for testing
WITH test_location AS (
    SELECT 19.0760 as user_lat, 72.8777 as user_lng, 100 as radius_km
)
SELECT 
    p.id,
    p.business_details->>'shopName' as business_name,
    p.role as business_type,
    p.business_details->>'address' as location,
    (p.business_details->>'latitude')::DECIMAL as latitude,
    (p.business_details->>'longitude')::DECIMAL as longitude,
    ROUND(
        (6371 * acos(
            cos(radians(tl.user_lat)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(tl.user_lng)) + 
            sin(radians(tl.user_lat)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        ))::NUMERIC, 2
    ) as distance_km
FROM profiles p, test_location tl
WHERE 
    p.role IN ('wholesaler', 'manufacturer')
    AND p.status = 'active'
    AND p.business_details IS NOT NULL
    AND p.business_details->>'latitude' IS NOT NULL
    AND p.business_details->>'longitude' IS NOT NULL
    AND (
        6371 * acos(
            cos(radians(tl.user_lat)) * 
            cos(radians((p.business_details->>'latitude')::DECIMAL)) * 
            cos(radians((p.business_details->>'longitude')::DECIMAL) - radians(tl.user_lng)) + 
            sin(radians(tl.user_lat)) * 
            sin(radians((p.business_details->>'latitude')::DECIMAL))
        )
    ) <= tl.radius_km
ORDER BY distance_km ASC
LIMIT 10;

-- ============================================================================
-- 5. CHECK INDEXES FOR PERFORMANCE
-- ============================================================================

SELECT 'Checking indexes on profiles table...' as status;

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
AND schemaname = 'public';

SELECT 'Checking indexes on seller_details table...' as status;

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'seller_details'
AND schemaname = 'public';

-- ============================================================================
-- 6. VERIFY RLS POLICIES
-- ============================================================================

SELECT 'Checking RLS policies on profiles table...' as status;

SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles'
AND schemaname = 'public';

-- ============================================================================
-- 7. COUNT AVAILABLE SELLERS
-- ============================================================================

SELECT 'Counting available sellers...' as status;

SELECT 
    role as seller_type,
    COUNT(*) as count,
    COUNT(CASE WHEN business_details->>'latitude' IS NOT NULL THEN 1 END) as with_location
FROM profiles
WHERE role IN ('wholesaler', 'manufacturer')
AND status = 'active'
GROUP BY role;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '
=============================================================================
VERIFICATION SUMMARY
=============================================================================

The DukaaOn website will use the following EXISTING tables:

1. PROFILES TABLE
   - Primary table for all users (retailers, wholesalers, manufacturers)
   - Sellers are identified by role IN (''wholesaler'', ''manufacturer'')
   - Contains business_details JSONB with:
     * shopName (business name)
     * ownerName
     * address (location)
     * latitude, longitude (for distance calculation)
   
2. SELLER_DETAILS TABLE (if exists)
   - Extended information for sellers
   - Links to profiles via user_id
   - Contains seller_type, business_name, location coordinates
   
3. PRODUCTS/MASTER_PRODUCTS TABLE (if exists)
   - Product listings for sellers
   - Will be used to display product images on seller profiles

The website will CREATE only ONE new table:
- ENQUIRY_MESSAGES: To store visitor enquiries

All queries will use the existing database structure from the root app.
No modifications to existing tables are needed.

=============================================================================
' as summary;
