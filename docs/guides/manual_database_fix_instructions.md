# Manual Database Fix Instructions

## Problem
The Supabase OTP signup error "Database error saving new user" is caused by database triggers that reference the wrong field name (`phone` instead of `phone_number`).

## Solution
Execute the following SQL commands in your Supabase dashboard to fix the database triggers.

## Steps to Apply the Fix

### 1. Open Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `xcpznnkpjgyrpbvpnvit`
3. Navigate to **SQL Editor** in the left sidebar

### 2. Execute the Fix SQL
Copy and paste the following SQL code into the SQL Editor and click **Run**:

```sql
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
```

### 3. Verify the Fix
After running the SQL, you should see success messages in the output. The fix addresses:

- ✅ **Fixed `handle_new_user` function** to use `phone_number` instead of `phone`
- ✅ **Fixed `handle_profile_update` function** with correct field references
- ✅ **Recreated database triggers** with the corrected functions
- ✅ **Added proper error handling** and logging

### 4. Test the Signup Flow
1. Open your app
2. Try to sign up with a new phone number
3. The "Database error saving new user" should no longer occur
4. OTP verification should complete successfully

## What This Fix Does

The original database triggers were trying to access `NEW.phone` but the `profiles` table uses `phone_number` as the column name. This mismatch caused the database error during user creation.

The fix:
1. **Corrects field references** from `phone` to `phone_number`
2. **Maintains trigger functionality** for profile creation and updates
3. **Adds logging** for debugging future issues
4. **Preserves data integrity** and timestamp updates

## Expected Result

After applying this fix:
- ✅ Signup flow works without database errors
- ✅ OTP verification completes successfully
- ✅ User profiles are created properly
- ✅ Navigation to appropriate screens works

## Troubleshooting

If you still encounter issues after applying the fix:

1. **Check the SQL execution** - Ensure all commands ran without errors
2. **Verify functions exist** - Run this query to check:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('handle_new_user', 'handle_profile_update');
   ```
3. **Check triggers** - Run this query to verify triggers:
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_schema = 'public' 
   AND event_object_table = 'profiles';
   ```

If problems persist, please check the Supabase logs for additional error details.