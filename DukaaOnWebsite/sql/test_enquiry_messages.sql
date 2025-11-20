-- Test script for enquiry_messages table
-- Run this after creating the table to verify everything works correctly

-- 1. Verify table exists and check structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'enquiry_messages'
ORDER BY ordinal_position;

-- 2. Verify indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'enquiry_messages';

-- 3. Verify RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'enquiry_messages';

-- 4. Test insert (simulating a visitor enquiry)
INSERT INTO enquiry_messages (
    visitor_name,
    visitor_email,
    visitor_phone,
    visitor_location,
    message,
    enquiry_type
) VALUES (
    'Test Visitor',
    'test@example.com',
    '+91-9876543210',
    'Mumbai, Maharashtra',
    'I would like to know more about your products.',
    'general'
);

-- 5. Test insert with seller_id (simulating a seller-specific enquiry)
-- Note: Replace 'SELLER_UUID_HERE' with an actual seller UUID from your sellers table
-- INSERT INTO enquiry_messages (
--     seller_id,
--     visitor_name,
--     visitor_email,
--     visitor_phone,
--     visitor_location,
--     message,
--     enquiry_type
-- ) VALUES (
--     'SELLER_UUID_HERE',
--     'Test Retailer',
--     'retailer@example.com',
--     '+91-9876543211',
--     'Delhi, India',
--     'I am interested in your wholesale products.',
--     'seller'
-- );

-- 6. Test select (verify data was inserted)
SELECT 
    id,
    seller_id,
    visitor_name,
    visitor_email,
    enquiry_type,
    status,
    created_at
FROM enquiry_messages
ORDER BY created_at DESC
LIMIT 5;

-- 7. Test update (change status)
UPDATE enquiry_messages
SET status = 'read'
WHERE status = 'new'
AND visitor_email = 'test@example.com';

-- 8. Verify updated_at trigger works
SELECT 
    id,
    visitor_name,
    status,
    created_at,
    updated_at
FROM enquiry_messages
WHERE visitor_email = 'test@example.com';

-- 9. Test filtering by enquiry_type
SELECT 
    enquiry_type,
    COUNT(*) as count
FROM enquiry_messages
GROUP BY enquiry_type;

-- 10. Test filtering by status
SELECT 
    status,
    COUNT(*) as count
FROM enquiry_messages
GROUP BY status;

-- 11. Clean up test data (optional - uncomment to remove test records)
-- DELETE FROM enquiry_messages WHERE visitor_email = 'test@example.com';
