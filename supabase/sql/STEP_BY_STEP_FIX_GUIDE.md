# Step-by-Step Guide to Fix 'record new has no field phone' Error

## Problem

You're seeing this error when trying to create user profiles:
```
ERROR  Profile creation returned unsuccessful result: {"error": "record \"new\" has no field \"phone\"", "message": "Failed to create or update profile", "success": false}
```

## Solution

Follow these simple steps to apply the fix:

### Step 1: Go to Supabase Dashboard

1. Open your web browser and go to [app.supabase.com](https://app.supabase.com)
2. Log in to your account
3. Select your project from the dashboard

### Step 2: Access the SQL Editor

1. In the left sidebar, click on the "SQL Editor" icon (it looks like a database with a pen)
2. You should see a blank SQL editor window

### Step 3: Copy the Fix Code

1. Open the file `manual_fix_auth_phone_trigger.sql` from this directory
2. Select all the code (Ctrl+A or Cmd+A)
3. Copy the code (Ctrl+C or Cmd+C)

### Step 4: Paste and Run the Fix

1. Go back to the Supabase SQL Editor
2. Paste the code (Ctrl+V or Cmd+V)
3. Click the "Run" button at the top of the editor (green button with play icon)

### Step 5: Verify the Fix Worked

1. After running the script, you should see a message that says `Function created successfully`
2. Try creating a user profile again through your app's OTP flow
3. The error should now be resolved!

## What the Fix Does

- Drops the old problematic `create_profile_unified` function
- Creates a new robust version that explicitly lists all required fields when inserting into `auth.users`
- Ensures the `phone` field is properly set and accessible
- Sets the correct search path to include both `public` and `auth` schemas
- Uses proper JSONB type casting for metadata fields
- Improves error handling and logging

## If You Still Have Issues

If the error persists after applying this fix:

1. Double-check that you ran the entire script successfully
2. Verify that you're using the correct Supabase project
3. Try running `SELECT * FROM information_schema.routines WHERE routine_name = 'create_profile_unified'` in the SQL Editor to confirm the function was updated

If you need further assistance, please let me know!