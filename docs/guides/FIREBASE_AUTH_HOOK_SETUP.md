# Firebase Authentication Hook Setup

This document explains how to resolve the Supabase JWT authentication warning: `Custom OIDC provider "firebase" not allowed` by implementing a Custom Access Token Hook.

## Problem

When using Firebase Authentication with Supabase, you may encounter this warning:
```
WARN Warning during Supabase JWT auth: [AuthApiError: Custom OIDC provider "firebase" not allowed]
```

This occurs because Supabase doesn't recognize Firebase as a valid OIDC provider by default when using custom JWT tokens.

## Solution

We've implemented a **Custom Access Token Hook** that:
1. Intercepts the authentication flow
2. Provides custom JWT claims for Firebase-authenticated users
3. Maps Firebase users to Supabase profiles
4. Resolves the OIDC provider warning

## Files Created

### 1. `sql_functions/custom_access_token_hook.sql`

This PostgreSQL function serves as the Custom Access Token Hook:

**Key Features:**
- Extracts Firebase UID from authentication events
- Looks up user profiles using the Firebase ID (`fire_id` column)
- Adds custom claims including user role, phone number, and business details
- Provides fallback claims for users without profiles
- Handles errors gracefully

**Custom Claims Added:**
- `user_id`: Supabase profile ID
- `firebase_uid`: Firebase user ID
- `phone_number`: User's phone number
- `role`: User role (retailer, seller, etc.)
- `status`: Account status (active, pending, etc.)
- `business_details`: Business information
- `app_metadata`: Provider information
- `user_metadata`: User-specific metadata

### 2. `sql_functions/configure_auth_hooks.sql`

Configuration script that:
- Registers the hook in Supabase's auth system
- Sets proper permissions
- Provides a status check function
- Includes manual configuration instructions

## Installation Steps

### Step 1: Create the Hook Function

Run the SQL from `custom_access_token_hook.sql` in your Supabase SQL Editor:

```sql
-- This creates the public.custom_access_token_hook function
-- with proper security and permissions
```

### Step 2: Configure the Hook

Option A - **Automatic (Recommended)**:
Run the SQL from `configure_auth_hooks.sql`:

```sql
-- This registers the hook in auth.hooks table
-- and sets up proper permissions
```

Option B - **Manual via Dashboard**:
1. Go to Supabase Dashboard → Authentication → Hooks
2. Click "Create a new hook"
3. Configure:
   - **Hook Name**: `firebase_custom_access_token`
   - **Type**: `Custom Access Token`
   - **Postgres Function**: `public.custom_access_token_hook`
   - **Enabled**: ✓ (checked)
4. Click "Create Hook"

### Step 3: Verify Installation

Check if the hook is properly configured:

```sql
SELECT * FROM public.check_auth_hooks_status();
```

You should see your hook listed with `is_enabled = true`.

## How It Works

### Authentication Flow

1. **User authenticates with Firebase**
   - Firebase generates a JWT token
   - Token contains Firebase UID

2. **Supabase receives the token**
   - Custom Access Token Hook is triggered
   - Hook function receives authentication event

3. **Hook processes the token**
   - Extracts Firebase UID from event
   - Queries `profiles` table using `fire_id` column
   - Builds custom JWT claims

4. **Enhanced JWT is returned**
   - Contains Supabase-compatible claims
   - Includes user profile information
   - Resolves OIDC provider warning

### Database Integration

The hook integrates with your existing database schema:

```sql
-- Profiles table structure (relevant columns)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  fire_id TEXT,              -- Firebase UID
  phone_number TEXT,
  role TEXT,
  status TEXT,
  business_details JSONB,
  -- ... other columns
);
```

## Security Considerations

### Permissions
- Hook function has `SECURITY DEFINER` to bypass RLS
- Only `supabase_auth_admin` can execute the hook
- Public access is explicitly revoked

### Error Handling
- Function includes comprehensive error handling
- Returns safe fallback claims on errors
- Logs issues without exposing sensitive data

### Data Validation
- Validates Firebase UID presence
- Handles missing profile scenarios
- Provides default values for missing fields

## Testing

### 1. Test Hook Function Directly

```sql
SELECT public.custom_access_token_hook(
  jsonb_build_object('user_id', 'your-firebase-uid')
);
```

### 2. Test Authentication Flow

1. Authenticate with Firebase in your app
2. Check browser console for warnings
3. Verify JWT contains custom claims
4. Confirm profile data is accessible

### 3. Monitor Hook Status

```sql
SELECT * FROM public.check_auth_hooks_status()
WHERE hook_name = 'firebase_custom_access_token';
```

## Troubleshooting

### Common Issues

1. **Hook not triggering**
   - Verify hook is enabled in `auth.hooks`
   - Check function permissions
   - Ensure function name is correct

2. **Profile not found**
   - Verify `fire_id` column contains Firebase UID
   - Check if profile exists for the user
   - Run `handle_firebase_auth` function if needed

3. **Permission errors**
   - Ensure `supabase_auth_admin` has execute permissions
   - Verify RLS policies don't block profile access

### Debug Queries

```sql
-- Check if hook exists
SELECT * FROM auth.hooks WHERE hook_name = 'firebase_custom_access_token';

-- Check profile linking
SELECT id, fire_id, phone_number, role 
FROM profiles 
WHERE fire_id = 'your-firebase-uid';

-- Test function permissions
SELECT has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook', 'execute');
```

## Benefits

1. **Resolves OIDC Warning**: Eliminates the Firebase provider warning
2. **Enhanced Security**: Proper JWT claims validation
3. **Profile Integration**: Seamless access to user profile data
4. **Role-Based Access**: Supports role-based permissions
5. **Error Resilience**: Graceful handling of edge cases

## Maintenance

### Regular Checks
- Monitor hook execution logs
- Verify profile linking accuracy
- Update claims structure as needed

### Updates
- Modify hook function for new claim requirements
- Update permissions as roles change
- Sync with Firebase authentication changes

## Related Files

- `sql/handle_firebase_auth.sql` - Creates/links Firebase users
- `sql_functions/link_firebase_user.sql` - Manual profile linking
- `services/firebase/messaging.ts` - Firebase client integration
- `docs/Auth Configuration Auth Hooks.md` - General auth hooks documentation

This setup ensures seamless Firebase-Supabase authentication integration while maintaining security and providing rich user context through custom JWT claims.