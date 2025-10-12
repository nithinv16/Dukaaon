-- SQL Script to create product-images bucket and set up RLS policies

-- First, check if the bucket exists and create it if not
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

-- Delete any conflicting policies
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;

-- Create a policy for uploading product images
CREATE POLICY "Users can upload product images" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'product-images' AND
  (
    -- Allow authenticated users to upload
    auth.role() IN ('authenticated', 'anon', 'service_role')
  )
);

-- Create a policy for viewing product images
CREATE POLICY "Public can view product images" 
ON storage.objects 
FOR SELECT 
TO public
USING (
  bucket_id = 'product-images'
);

-- Create a policy for updating product images
CREATE POLICY "Users can update their product images" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'product-images'
)
WITH CHECK (
  bucket_id = 'product-images'
);

-- Create a policy for deleting product images
CREATE POLICY "Users can delete their product images" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'product-images'
);

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify buckets
SELECT * FROM storage.buckets WHERE id = 'product-images';

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
WHERE id = 'product-images';