-- SQL Script to create id_verification bucket and set up RLS policies

-- First, check if the bucket exists and create it if not
INSERT INTO storage.buckets (id, name, public)
VALUES ('id_verification', 'id_verification', false)
ON CONFLICT (id) DO NOTHING;

-- Delete any conflicting policies
DROP POLICY IF EXISTS "Users can upload ID verification images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view ID verification images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their ID verification images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their ID verification images" ON storage.objects;

-- Create a policy for uploading ID verification images
CREATE POLICY "Users can upload ID verification images" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'id_verification' AND
  (
    -- Allow authenticated users to upload to their own folder
    auth.role() IN ('authenticated', 'anon', 'service_role') AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Create a policy for viewing ID verification images (restricted to admins and owners)
CREATE POLICY "Admins can view ID verification images" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'id_verification' AND
  (
    -- Allow users to view their own files
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Allow admins to view all files (you may need to adjust this based on your admin role setup)
    auth.jwt() ->> 'role' = 'admin'
  )
);

-- Create a policy for updating ID verification images
CREATE POLICY "Users can update their ID verification images" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'id_verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'id_verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create a policy for deleting ID verification images
CREATE POLICY "Users can delete their ID verification images" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'id_verification' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify buckets
SELECT * FROM storage.buckets WHERE id = 'id_verification';

-- Set up storage permissions for the bucket
BEGIN;
  -- Grant usage on schemas
  GRANT USAGE ON SCHEMA storage TO anon, authenticated;
  
  -- Grant ability to upload files
  GRANT INSERT, SELECT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
  
  -- Grant ability to get URLs
  GRANT EXECUTE ON FUNCTION storage.filename(name text) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION storage.foldername(name text) TO anon, authenticated;
COMMIT;

-- Test the bucket setup
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'id_verification';