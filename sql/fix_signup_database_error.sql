-- Fix for Supabase OTP signup error: "Database error saving new user"
-- This script fixes the database triggers that are causing the error

-- Fix the handle_new_user function that's causing profile creation errors
-- The function was trying to access NEW.phone instead of NEW.phone_number

-- Drop the existing broken function and triggers
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_profile_update() CASCADE;

-- Create a proper handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the profile creation for debugging
  RAISE NOTICE 'New profile created with ID: %, Phone: %, Role: %', 
               NEW.id, NEW.phone_number, NEW.role;
  
  -- The profile is already being created, so we just need to return NEW
  -- Any additional logic for new user handling can be added here
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create handle_profile_update function with correct field references
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the profile update for debugging
  RAISE NOTICE 'Profile updated with ID: %, Phone: %, Role: %', 
               NEW.id, NEW.phone_number, NEW.role;
  
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the triggers with the fixed functions
DROP TRIGGER IF EXISTS on_profile_insert ON public.profiles;
CREATE TRIGGER on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update();

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Handles new profile creation, fixed to use phone_number instead of phone';
COMMENT ON FUNCTION public.handle_profile_update() IS 'Handles profile updates, fixed to use phone_number instead of phone';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Database triggers fixed successfully!';
    RAISE NOTICE 'The signup error should now be resolved.';
    RAISE NOTICE 'Functions updated: handle_new_user, handle_profile_update';
    RAISE NOTICE 'Triggers recreated: on_profile_insert, on_profile_update';
END
$$;