# Firebase-Supabase Integration Setup Guide

This guide explains how to set up the official Firebase third-party authentication with Supabase as recommended in the [Supabase documentation](https://supabase.com/docs/guides/auth/third-party/firebase-auth).

## Overview

The integration allows Firebase Auth to work seamlessly with Supabase by:
- Automatically assigning the `authenticated` role to Firebase users
- Using Firebase ID tokens for Supabase authentication
- Maintaining security through proper role-based access control

## Prerequisites

- Firebase project with Authentication enabled
- Supabase project
- Firebase Admin SDK service account key
- Node.js environment for running scripts

## Setup Steps

### 1. Configure Supabase Third-Party Auth

The `supabase/config.toml` file has been updated with Firebase third-party auth configuration:

```toml
# Firebase Third-party Authentication Configuration
[auth.third_party.firebase]
enabled = true
project_id = "dukaaon"
```

### 2. Update Supabase Client

The Supabase client (`lib/supabase/client.ts`) now includes Firebase accessToken integration:

```typescript
// Enhanced client with Firebase integration
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Firebase Auth integration for third-party authentication
    accessToken: getFirebaseAccessToken,
  },
});

// Legacy client for backward compatibility
export const supabaseLegacy = createClient<Database>(supabaseUrl, supabaseKey, {
  // Standard configuration without Firebase integration
});
```

### 3. Deploy Firebase Cloud Functions

Firebase Cloud Functions have been created to handle role assignment:

#### Install Dependencies

```bash
cd firebase/functions
npm install
```

#### Deploy Functions

```bash
firebase deploy --only functions
```

The functions include:
- `setUserRole`: Assigns 'authenticated' role to the current user (call after registration)
- `assignRoleToAllUsers`: Bulk assign roles to existing users
- `verifyUserClaims`: Debug function to check user claims

### 4. Assign Roles to Existing Users

#### Option A: Using the Admin Script (Recommended)

1. Download your Firebase service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `credentials/firebase-service-account-key.json`

2. Run the admin script:

```bash
node scripts/assign-firebase-roles.js
```

#### Option B: Using the Cloud Function

Call the `assignRoleToAllUsers` function from your app or Firebase console.

### 5. Verify Integration

Use the `FirebaseRoleManager` service to verify the integration:

```typescript
import { FirebaseRoleManager } from '../services/auth/firebaseRoleManager';

// Check if user has authenticated role
const hasRole = await FirebaseRoleManager.hasAuthenticatedRole();

// Verify complete integration
const status = await FirebaseRoleManager.verifyIntegration();
console.log('Integration status:', status);

// Debug authentication state
await FirebaseRoleManager.debugAuthState();
```

## Usage Examples

### Basic Authentication Flow

```typescript
import auth from '@react-native-firebase/auth';
import { supabase } from '../lib/supabase/client';
import { FirebaseRoleManager } from '../services/auth/firebaseRoleManager';

// Sign up new user
const signUp = async (email: string, password: string) => {
  try {
    // Create Firebase user
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    
    // Assign the authenticated role
    const roleResult = await FirebaseRoleManager.assignUserRole();
    if (!roleResult.success) {
      console.warn('Failed to assign role:', roleResult.message);
    }
    
    // Wait for custom claims to be available
    await FirebaseRoleManager.waitForClaims();
    
    // Verify integration
    const verification = await FirebaseRoleManager.verifyIntegration();
    console.log('Integration status:', verification);
    
    return userCredential.user;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

// Sign in existing user
const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    
    // Verify role is present
    const hasRole = await FirebaseRoleManager.hasAuthenticatedRole();
    if (!hasRole) {
      console.warn('User does not have authenticated role');
      // Optionally assign role if missing
      await FirebaseRoleManager.assignUserRole();
    }
    
    return userCredential.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};
```

### Using Both Clients

```typescript
import { supabase, supabaseLegacy } from '../lib/supabase/client';

// Use Firebase-integrated client for authenticated operations
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .single();

// Use legacy client for public operations (if needed)
const { data: publicData } = await supabaseLegacy
  .from('public_table')
  .select('*');
```

## Security Considerations

### Row Level Security (RLS)

Ensure your Supabase tables have proper RLS policies that work with Firebase Auth:

```sql
-- Example RLS policy for profiles table
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

### Custom Claims Verification

Always verify that users have the correct role claims:

```typescript
const verifyUserRole = async () => {
  const hasRole = await FirebaseRoleManager.hasAuthenticatedRole();
  
  if (!hasRole) {
    throw new Error('User does not have authenticated role');
  }
};
```

## Troubleshooting

### Common Issues

1. **Claims not available immediately after sign-up**
   - Use `FirebaseRoleManager.waitForClaims()` to wait for claims
   - Firebase Cloud Functions may take a moment to execute

2. **Supabase auth fails**
   - Verify Firebase ID token is valid
   - Check that third-party auth is enabled in Supabase
   - Ensure project ID matches in config.toml

3. **RLS policies blocking access**
   - Verify policies work with Firebase Auth JWT structure
   - Test with `auth.uid()` and `auth.role()`

### Debug Tools

```typescript
// Debug current auth state
await FirebaseRoleManager.debugAuthState();

// Get detailed token information
const tokenInfo = await FirebaseRoleManager.getIdTokenWithClaims();
console.log('Token info:', tokenInfo);

// Verify integration status
const status = await FirebaseRoleManager.verifyIntegration();
console.log('Integration status:', status);
```

## Migration from Custom Sync

If you were previously using a custom Firebase-Supabase sync service:

1. **Gradual Migration**: Use both clients during transition
2. **Test Thoroughly**: Verify all functionality works with new integration
3. **Update Code**: Replace custom sync calls with standard Supabase operations
4. **Monitor**: Watch for any authentication issues during migration

## Environment Variables

Ensure these environment variables are set:

```env
FIREBASE_PROJECT_ID=dukaaon
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Next Steps

1. Deploy the Firebase Cloud Functions
2. Run the role assignment script for existing users
3. Test the integration with your app
4. Update any existing authentication flows
5. Monitor for any issues and adjust as needed

## Support

For issues with this integration:
1. Check the Firebase and Supabase console logs
2. Use the debug tools provided in `FirebaseRoleManager`
3. Refer to the [official Supabase documentation](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
4. Check Firebase Cloud Functions logs for any errors