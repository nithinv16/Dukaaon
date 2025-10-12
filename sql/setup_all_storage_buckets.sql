-- Comprehensive Storage Bucket Setup Script
-- This script creates all required storage buckets for the Dukaaon app

-- Enable the storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage" WITH SCHEMA "storage";

-- Create all required buckets
\i create_profiles_bucket.sql
\i create_product_images_bucket.sql
\i create_id_verification_bucket.sql
\i create_shop_images_bucket.sql

-- Verify all buckets are created
SELECT 
  id,
  name,
  public,
  created_at,
  updated_at
FROM storage.buckets 
WHERE id IN ('profiles', 'product-images', 'id_verification', 'shop-images')
ORDER BY id;

-- Show storage policies for verification
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;