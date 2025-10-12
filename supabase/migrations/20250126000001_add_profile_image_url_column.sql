-- Add profile_image_url column to profiles table
-- The application expects 'profile_image_url' but the table doesn't have it

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_profile_image_url ON public.profiles(profile_image_url);

-- Update RLS policies to allow access to profile_image_url column
-- Users can view their own profile_image_url
DROP POLICY IF EXISTS "Users can view own profile_image_url" ON public.profiles;
CREATE POLICY "Users can view own profile_image_url" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
    );

-- Users can update their own profile_image_url
DROP POLICY IF EXISTS "Users can update own profile_image_url" ON public.profiles;
CREATE POLICY "Users can update own profile_image_url" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
    );

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.profile_image_url IS 'Profile image URL - used by mobile app for user avatar/profile images';

-- Migrate existing data from shop_image_url to profile_image_url if needed
-- This is for cases where shop_image_url might contain profile images
UPDATE public.profiles 
SET profile_image_url = shop_image_url 
WHERE profile_image_url IS NULL AND shop_image_url IS NOT NULL;