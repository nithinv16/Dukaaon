-- Fix RLS policies for enquiry_messages table
-- This script completely resets the policies to allow anonymous (unauthenticated) users to insert enquiries

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Allow public insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow anonymous insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated read on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated update on enquiry_messages" ON enquiry_messages;

-- Step 2: Verify RLS is enabled
ALTER TABLE enquiry_messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Create new policies with correct roles

-- Allow anonymous (unauthenticated) users to insert enquiries
CREATE POLICY "Allow anonymous insert on enquiry_messages"
ON enquiry_messages
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated users to insert enquiries (for testing/admin)
CREATE POLICY "Allow authenticated insert on enquiry_messages"
ON enquiry_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to read all enquiries (for admin dashboard)
CREATE POLICY "Allow authenticated read on enquiry_messages"
ON enquiry_messages
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update enquiries (for admin to change status)
CREATE POLICY "Allow authenticated update on enquiry_messages"
ON enquiry_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Step 4: Verify the policies are created correctly
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
WHERE tablename = 'enquiry_messages'
ORDER BY policyname;

-- Step 5: Test insert as anonymous user (this should work)
-- Uncomment the following to test:
-- INSERT INTO enquiry_messages (
--     visitor_name,
--     visitor_email,
--     visitor_phone,
--     visitor_location,
--     message,
--     enquiry_type
-- ) VALUES (
--     'Test User',
--     'test@example.com',
--     '+91-1234567890',
--     'Mumbai',
--     'This is a test message',
--     'general'
-- );

SELECT 'RLS policies have been reset successfully!' as status;
