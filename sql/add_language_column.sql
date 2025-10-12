-- Add language column to profiles table
-- This migration adds a language column to store user's preferred language

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Add comment to the column
COMMENT ON COLUMN public.profiles.language IS 'User preferred language code (e.g., en, hi, te, ta, kn, ml)';

-- Update existing records to have default language
UPDATE public.profiles 
SET language = 'en' 
WHERE language IS NULL;

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name = 'language';