# Firebase OIDC Provider Warning - Complete Solution

## Current Issue

You're still seeing this warning despite having the custom access token hook:
```
WARN Warning during Supabase JWT auth: [AuthApiError: Custom OIDC provider "firebase" not allowed]
```

## Root Cause Analysis

The warning persists because:

1. **Hook Configuration Issue**: The custom access token hook may not be properly registered or enabled
2. **Third-Party Auth Mismatch**: Your `config.toml` shows Firebase third-party auth is enabled, but the hook approach conflicts with this
3. **JWT Token Flow**: The warning occurs during JWT validation before the hook can process the token
4. **Missing Hook Registration**: The hook might not be active in your Supabase instance

## Solution Options

### Option 1: Verify and Fix Hook Configuration (Recommended)

#### Step 1: Check Current Hook Status

Run this query in your Supabase SQL Editor:

```sql
-- Check if hook exists and is enabled
SELECT 
  id,
  hook_name,
  hook_type,
  postgres_function_name,
  enabled,
  created_at
FROM auth.hooks 
WHERE hook_name = 'firebase_custom_access_token';

-- Check if function exists
SELECT 
  proname as function_name,
  pronamespace::regnamespace as schema_name
FROM pg_proc 
WHERE proname = 'custom_access_token_hook';

-- Check function permissions
SELECT has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook', 'execute');
```

#### Step 2: Re-run Hook Configuration

If the hook doesn't exist or isn't enabled, run:

```sql
-- Delete existing hook if it exists
DELETE FROM auth.hooks WHERE hook_name = 'firebase_custom_access_token';

-- Re-create the hook
INSERT INTO auth.hooks (
  id,
  hook_name,
  hook_type,
  postgres_function_name,
  enabled,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'firebase_custom_access_token',
  'custom_access_token',
  'public.custom_access_token_hook',
  true,
  NOW(),
  NOW()
);

-- Verify creation
SELECT * FROM auth.hooks WHERE hook_name = 'firebase_custom_access_token';
```

#### Step 3: Update Hook Function (Enhanced Version)

Replace your current hook function with this enhanced version:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(
  event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLAIRE
  claims jsonb;
  user_profile record;
  firebase_uid text;
  supabase_url text;
BEGIN
  -- Extract the user ID from the event
  firebase_uid := event->>'user_id';
  
  -- Get Supabase URL from environment or use default
  supabase_url := 'https://xcpznnkpjgyrpbvpnvit.supabase.co';
  
  -- Initialize claims with proper issuer
  claims := jsonb_build_object(
    'iss', supabase_url || '/auth/v1',
    'aud', 'authenticated',
    'role', 'authenticated',
    'sub', firebase_uid
  );
  
  -- Try to find the user profile by Firebase ID
  SELECT * INTO user_profile
  FROM profiles
  WHERE fire_id = firebase_uid
  LIMIT 1;
  
  -- If profile found, add custom claims
  IF user_profile IS NOT NULL THEN
    claims := claims || jsonb_build_object(
      'user_id', user_profile.id,
      'firebase_uid', user_profile.fire_id,
      'phone_number', user_profile.phone_number,
      'role', COALESCE(user_profile.role, 'retailer'),
      'status', COALESCE(user_profile.status, 'active'),
      'business_details', user_profile.business_details,
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      ),
      'user_metadata', jsonb_build_object(
        'phone_number', user_profile.phone_number,
        'role', user_profile.role,
        'firebase_uid', user_profile.fire_id
      )
    );
  ELSE
    -- If no profile found, add minimal claims for Firebase user
    claims := claims || jsonb_build_object(
      'firebase_uid', firebase_uid,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      ),
      'user_metadata', jsonb_build_object(
        'firebase_uid', firebase_uid
      )
    );
  END IF;
  
  -- Log for debugging (remove in production)
  RAISE LOG 'Custom access token hook executed for Firebase UID: %', firebase_uid;
  
  -- Return the event with custom claims
  RETURN jsonb_build_object(
    'claims', claims
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error for debugging
  RAISE LOG 'Error in custom_access_token_hook: %', SQLERRM;
  
  -- In case of any error, return minimal safe claims
  RETURN jsonb_build_object(
    'claims', jsonb_build_object(
      'iss', supabase_url || '/auth/v1',
      'aud', 'authenticated',
      'role', 'authenticated',
      'sub', firebase_uid,
      'firebase_uid', firebase_uid,
      'app_metadata', jsonb_build_object(
        'provider', 'firebase',
        'providers', ARRAY['firebase']
      )
    )
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

### Option 2: Alternative - Disable Third-Party Auth and Use Hook Only

If the hook approach doesn't work, modify your `supabase/config.toml`:

```toml
# Comment out or remove Firebase third-party auth
# [auth.third_party.firebase]
# enabled = true
# project_id = "dukaaon"

[functions.check-profile]
enabled = true
verify_jwt = true
import_map = "./functions/check-profile/deno.json"
entrypoint = "./functions/check-profile/index.ts"
```

Then redeploy your Supabase configuration.

### Option 3: Use Official Third-Party Auth (Cleanest Solution)

Instead of custom hooks, use Supabase's official Firebase third-party auth:

#### Step 1: Configure in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Firebase** in the third-party providers
4. Enable it and configure:
   - **Project ID**: `dukaaon`
   - **Service Account Key**: Your Firebase service account JSON

#### Step 2: Update Your Authentication Code

Modify your Firebase-Supabase integration to use the official third-party auth:

```typescript
// In your firebaseSupabaseSync.ts
export const syncFirebaseWithSupabase = async (firebaseUser: any) => {
  try {
    // Get Firebase ID token
    const idToken = await firebaseUser.getIdToken();
    
    // Use Supabase's official Firebase auth
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'firebase',
      token: idToken,
    });
    
    if (error) {
      console.error('Supabase Firebase auth error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Firebase-Supabase sync error:', error);
    return null;
  }
};
```

## Testing and Verification

### Test Hook Function

```sql
-- Test the hook function directly
SELECT public.custom_access_token_hook(
  jsonb_build_object('user_id', 'test-firebase-uid')
);
```

### Monitor Hook Execution

```sql
-- Check Supabase logs for hook execution
-- Look for LOG messages from the hook function
```

### Test Authentication Flow

1. Clear your app's authentication state
2. Authenticate with Firebase
3. Check browser console for warnings
4. Verify JWT token contains expected claims

## Debugging Steps

### 1. Enable Detailed Logging

Add this to your authentication code:

```typescript
// Add detailed logging
console.log('Firebase user:', firebaseUser);
console.log('Firebase ID token:', await firebaseUser.getIdToken());
console.log('Supabase session:', supabaseSession);
```

### 2. Check Supabase Logs

In your Supabase Dashboard:
1. Go to **Logs** → **Auth Logs**
2. Look for hook execution entries
3. Check for any error messages

### 3. Verify Database State

```sql
-- Check if profiles are properly linked
SELECT id, fire_id, phone_number, role 
FROM profiles 
WHERE fire_id IS NOT NULL;

-- Check auth users
SELECT id, email, phone, raw_app_meta_data, raw_user_meta_data
FROM auth.users
LIMIT 5;
```

## Expected Results

After implementing the solution:

✅ **No more OIDC provider warnings**
✅ **Seamless Firebase-Supabase authentication**
✅ **Proper JWT claims with user profile data**
✅ **Role-based access control working**
✅ **Profile synchronization functioning**

## Next Steps

1. **Choose your preferred solution** (Hook-based or Official third-party auth)
2. **Implement the chosen approach**
3. **Test thoroughly** with your authentication flow
4. **Monitor logs** for any remaining issues
5. **Update documentation** with the final configuration

The hook-based approach (Option 1) is recommended if you need custom JWT claims and fine-grained control over the authentication process. The official third-party auth (Option 3) is cleaner but may have limitations on custom claims.