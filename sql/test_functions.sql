-- SQL Script to check if required functions exist in the database
-- Run this in Supabase SQL Editor to verify setup

-- Check if create_user_profile function exists
SELECT 
    routine_name, 
    data_type AS return_type,
    parameter_name,
    parameter_mode,
    udt_name AS parameter_type
FROM 
    information_schema.routines r
LEFT JOIN 
    information_schema.parameters p
ON 
    r.specific_name = p.specific_name
WHERE 
    routine_schema = 'public' 
    AND routine_name IN ('create_user_profile', 'link_firebase_to_profile', 'create_profile_safely')
ORDER BY 
    routine_name, 
    ordinal_position;

-- Test function calls with dummy data (these won't actually insert if you SELECT)
SELECT * FROM link_firebase_to_profile('test_firebase_id', '1234567890', 'retailer');

-- If function exists and is named create_user_profile (not create_user_with_profile)
SELECT * FROM create_user_profile('test_firebase_id', '1234567890', 'retailer');

-- Test create_profile_safely
SELECT * FROM create_profile_safely('test_firebase_id', '1234567890', 'retailer', 'active'); 