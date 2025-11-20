-- TEMPORARY: Disable RLS for testing
-- This script disables RLS on enquiry_messages table to test if that's the issue
-- WARNING: Only use this for testing! Re-enable RLS before going to production

-- Disable RLS
ALTER TABLE enquiry_messages DISABLE ROW LEVEL SECURITY;

-- Test insert
INSERT INTO enquiry_messages (
    visitor_name,
    visitor_email,
    visitor_phone,
    visitor_location,
    message,
    enquiry_type
) VALUES (
    'Test User',
    'test@example.com',
    '+91-1234567890',
    'Mumbai',
    'This is a test message',
    'general'
);

-- Check if insert worked
SELECT * FROM enquiry_messages WHERE visitor_email = 'test@example.com';

-- If the above worked, the issue is definitely with RLS policies
-- Clean up test data
DELETE FROM enquiry_messages WHERE visitor_email = 'test@example.com';

SELECT 'RLS has been DISABLED. If your form works now, the issue is with RLS policies.' as status;
SELECT 'Run fix_rls_policies.sql to re-enable RLS with correct policies.' as next_step;
