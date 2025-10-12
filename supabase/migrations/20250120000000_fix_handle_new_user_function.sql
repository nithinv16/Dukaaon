-- Fix the handle_new_user function that's causing profile creation errors
-- The function was incomplete and trying to access NEW.phone instead of NEW.phone_number

-- Drop the existing broken function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a proper handle_new_user function
-- This function should be triggered when a new profile is inserted
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

-- Also check and fix handle_profile_update function if it has the same issue
DROP FUNCTION IF EXISTS public.handle_profile_update() CASCADE;

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

-- Add a comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Handles new profile creation, fixed to use phone_number instead of phone';
COMMENT ON FUNCTION public.handle_profile_update() IS 'Handles profile updates, fixed to use phone_number instead of phone';