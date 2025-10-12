-- SQL Script to create profiles bucket and set up RLS policies

-- First, check if the bucket exists and create it if not
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', false)
ON CONFLICT (id) DO NOTHING;

-- Delete any conflicting policies
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their profile images" ON storage.objects;

-- Create a policy for uploading profile images
CREATE POLICY "Users can upload profile images" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'profiles' AND
  (
    -- Allow authenticated users to upload to their own folder (legacy path)
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = auth.uid()::text) OR
    -- Allow retailers to upload to retailer-specific path
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- Create a policy for viewing profile images
CREATE POLICY "Users can view profile images" 
ON storage.objects 
FOR SELECT 
TO public
USING (
  bucket_id = 'profiles' AND
  (
    -- Allow authenticated users to view their own images (legacy path)
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = auth.uid()::text) OR
    -- Allow retailers to view their retailer-specific images
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- Create a policy for updating profile images
CREATE POLICY "Users can update their profile images" 
ON storage.objects 
FOR UPDATE 
TO public
USING (
  bucket_id = 'profiles' AND
  (
    -- Allow authenticated users to update their own images (legacy path)
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = auth.uid()::text) OR
    -- Allow retailers to update their retailer-specific images
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
)
WITH CHECK (
  bucket_id = 'profiles' AND
  (
    -- Allow authenticated users to update their own images (legacy path)
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = auth.uid()::text) OR
    -- Allow retailers to update their retailer-specific images
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- Create a policy for deleting profile images
CREATE POLICY "Users can delete their profile images" 
ON storage.objects 
FOR DELETE 
TO public
USING (
  bucket_id = 'profiles' AND
  (
    -- Allow authenticated users to delete their own images (legacy path)
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = auth.uid()::text) OR
    -- Allow retailers to delete their retailer-specific images
    (auth.role() IN ('authenticated', 'anon', 'service_role') AND
     (storage.foldername(name))[1] = 'retailer' AND
     (storage.foldername(name))[2] = auth.uid()::text)
  )
);

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify buckets
SELECT * FROM storage.buckets WHERE id = 'profiles';

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
WHERE id = 'profiles';