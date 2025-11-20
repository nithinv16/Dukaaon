-- Simple RLS fix for enquiry_messages table
-- This uses a more permissive approach that should work with Supabase client

-- Step 1: Drop ALL existing policies
DROP POLICY IF EXISTS "Allow public insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow anonymous insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated insert on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated read on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Allow authenticated update on enquiry_messages" ON enquiry_messages;
DROP POLICY IF EXISTS "Enable insert for anon users" ON enquiry_messages;
DROP POLICY IF EXISTS "Enable insert for all users" ON enquiry_messages;

-- Step 2: Enable RLS
ALTER TABLE enquiry_messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a simple permissive policy for INSERT that works for everyone
-- This allows both anonymous and authenticated users to insert
CREATE POLICY "Enable insert for all users"
ON enquiry_messages
FOR INSERT
WITH CHECK (true);

-- Step 4: Allow authenticated users to read (for admin)
CREATE POLICY "Enable read for authenticated users"
ON enquiry_messages
FOR SELECT
TO authenticated
USING (true);

-- Step 5: Allow authenticated users to update (for admin)
CREATE POLICY "Enable update for authenticated users"
ON enquiry_messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'enquiry_messages'
ORDER BY policyname;

SELECT 'RLS policies updated with simple permissive approach!' as status;
