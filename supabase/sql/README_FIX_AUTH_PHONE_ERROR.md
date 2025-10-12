# Fix for 'record new has no field phone' Error

## Issue Explanation

The persistent "record new has no field phone" error occurs in the `create_profile_unified` function when trying to create or update user profiles. This happens because:

1. When inserting into the `auth.users` table, the function wasn't explicitly listing all required fields
2. There might be triggers or constraints in Supabase Auth that expect the `phone` field to be present
3. The JSON formatting for metadata fields might have been incorrect

## Solution

I've created two ways to fix this issue:

### Option 1: Run the manual SQL script (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `manual_fix_auth_phone_trigger.sql`
4. Click "Run"

This will drop the old function and create a new robust version that:

- Explicitly lists all required fields when inserting into `auth.users`
- Sets the proper search path to include both `public` and `auth` schemas
- Uses proper JSONB type casting
- Includes comprehensive error handling

### Option 2: Apply as a migration

If you prefer to apply this as a migration, you can use the new migration file `20250412000001_fix_auth_phone_trigger_robust.sql` and run:

```bash
npx supabase migration up
```

However, note that you might encounter conflicts if other migrations have issues (as we saw with the trigger conflict earlier).

## Verification

After applying the fix, you can verify it works by:

1. Trying to create a new user profile using the OTP flow
2. Running the `create_profile_unified` function directly with test data

## What the Fix Does

1. **Explicit Field Listing**: When inserting into `auth.users`, all required fields are explicitly listed to ensure the `phone` field is properly set
2. **Schema Path Management**: The search path is set to include both `public` and `auth` schemas to ensure proper access
3. **Proper JSONB Formatting**: JSON values are properly cast to JSONB type
4. **Robust Error Handling**: Better error logging and recovery mechanisms

If you have any questions or encounter further issues, please let me know!