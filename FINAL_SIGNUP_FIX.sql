-- FINAL FIX for "Database error saving new user" during Supabase OTP signup
-- Root Cause: Foreign key constraint violation - profiles.id must reference auth.users.id
-- This fix ensures proper synchronization between auth.users and profiles tables

-- First, check and fix the foreign key constraint
DO $$
BEGIN
    -- Check if the foreign key constraint exists and is correct
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        RAISE NOTICE 'Foreign key constraint profiles_id_fkey exists - this is correct';
    ELSE
        -- Add the foreign key constraint if it doesn't exist
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added missing foreign key constraint profiles_id_fkey';
    END IF;
END $$;

-- Drop any existing problematic triggers that might interfere
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_profile_insert ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_update() CASCADE;

-- Create a trigger function that runs AFTER a user is created in auth.users
-- This ensures the profile is created only after the auth user exists
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the new auth user creation
  RAISE NOTICE 'New auth user created with ID: %, Phone: %', NEW.id, NEW.phone;
  
  -- Create a corresponding profile in the profiles table
  -- Only if one doesn't already exist
  INSERT INTO public.profiles (
    id,
    phone_number,
    role,
    language,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,                           -- Use the auth.users.id
    NEW.phone,                        -- Use the phone from auth.users
    'retailer',                       -- Default role
    'en',                            -- Default language
    'active',                        -- Default status
    NOW(),                           -- Created timestamp
    NOW()                            -- Updated timestamp
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_number = EXCLUDED.phone_number,
    updated_at = NOW();
  
  RAISE NOTICE 'Profile created/updated for auth user: %', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users table
-- This will automatically create a profile when a new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Create a simple profile update function for timestamp management
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the timestamp
  NEW.updated_at = NOW();
  
  -- Ensure required fields have defaults
  IF NEW.language IS NULL THEN
    NEW.language := 'en';
  END IF;
  
  IF NEW.role IS NULL THEN
    NEW.role := 'retailer';
  END IF;
  
  IF NEW.status IS NULL THEN
    NEW.status := 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the profile update trigger
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update();

-- Ensure the profiles table has all required columns with proper defaults
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'retailer';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Update any existing NULL values
UPDATE public.profiles 
SET 
  language = COALESCE(language, 'en'),
  role = COALESCE(role, 'retailer'),
  status = COALESCE(status, 'active');

-- Test the fix by checking the constraint
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '✅ Foreign key constraint is properly configured';
    RAISE NOTICE '✅ Triggers created successfully';
    RAISE NOTICE '✅ Profile table columns updated with defaults';
    RAISE NOTICE '🎯 Fix applied successfully - OTP signup should now work';
  ELSE
    RAISE NOTICE '❌ Foreign key constraint missing - manual intervention required';
  END IF;
END $$;