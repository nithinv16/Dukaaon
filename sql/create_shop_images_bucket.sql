-- SQL Script to create shop-images bucket and set up RLS policies

-- First, check if the bucket exists and create it if not
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-images', 'shop-images', false)
ON CONFLICT (id) DO NOTHING;

-- Delete any conflicting policies
DROP POLICY IF EXISTS "Users can upload shop images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shop images" ON storage.objects;

-- Create a policy for the storage.objects table for uploading shop images
CREATE POLICY "Users can upload shop images" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'shop-images' AND
  (
    -- Allow authenticated users to upload 
    auth.role() IN ('authenticated', 'anon', 'service_role')
  )
);

-- Create a policy for SELECT to allow accessing the uploaded images
CREATE POLICY "Public can view shop images" 
ON storage.objects 
FOR SELECT 
TO public
USING (
  bucket_id = 'shop-images'
);

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify buckets
SELECT * FROM storage.buckets WHERE id = 'shop-images';

-- Set up storage permissions for the bucket
BEGIN;
  -- Grant usage on schemas
  GRANT USAGE ON SCHEMA storage TO anon, authenticated;
  
  -- Grant ability to upload files
  GRANT INSERT, SELECT ON storage.objects TO anon, authenticated;
  
  -- Grant ability to get URLs
  GRANT EXECUTE ON FUNCTION storage.filename(name text) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION storage.foldername(name text) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION storage.extension(name text) TO anon, authenticated;
COMMIT; 