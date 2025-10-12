-- Update profiles bucket RLS policies to support retailer-specific paths

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;

-- Create updated policy for uploading profile images
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

-- Create updated policy for viewing profile images
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

-- Create updated policy for updating profile images
CREATE POLICY "Users can update profile images" 
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

-- Create updated policy for deleting profile images
CREATE POLICY "Users can delete profile images" 
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