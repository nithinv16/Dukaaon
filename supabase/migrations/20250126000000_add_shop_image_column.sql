-- Add shop_image column to profiles table
-- The code expects 'shop_image' but the table has 'shop_image_url'
-- Adding shop_image column for compatibility

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS shop_image TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_shop_image ON public.profiles(shop_image);

-- Update RLS policies to allow access to shop_image column
-- Users can view their own shop_image
DROP POLICY IF EXISTS "Users can view own shop_image" ON public.profiles;
CREATE POLICY "Users can view own shop_image" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
    );

-- Users can update their own shop_image
DROP POLICY IF EXISTS "Users can update own shop_image" ON public.profiles;
CREATE POLICY "Users can update own shop_image" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
    );

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.shop_image IS 'Shop image URL - used by mobile app for shop image uploads';

-- Migrate existing data from shop_image_url to shop_image if needed
UPDATE public.profiles 
SET shop_image = shop_image_url 
WHERE shop_image IS NULL AND shop_image_url IS NOT NULL;