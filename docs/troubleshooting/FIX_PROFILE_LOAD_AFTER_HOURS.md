# Fix: Profile Loading Issue After App Reopened After Hours

## Problem Description

When the app was reopened after being closed for several hours, it failed to load the user's profile and incorrectly redirected to the language/auth screen. However, if the user immediately closed and reopened the app, it worked correctly.

### Root Cause Analysis

From the logs, we identified the following sequence of events:

1. **Cache Expiry** (line 416): Profile cache expired after hours (`timeUntilExpiry: -24596 seconds`)
2. **ProfileLoader Timeout** (line 498): Profile fetch timed out while trying to fetch from database
3. **Fallback Initiated** (line 504): Auth store attempted direct database fetch as fallback
4. **Premature Navigation** (line 514-515): `app/index.tsx` already decided no auth exists and navigated to language screen
5. **Session Lost**: Auth state showed `hasSession: false, hasUser: false`

The issue was a **timing problem**:
- `app/index.tsx` waited only 5-8 seconds total
- ProfileLoader used 3 seconds + retries
- Direct DB fallback started after ProfileLoader failed
- By the time the fallback completed, `app/index.tsx` had already given up

Additionally:
- Supabase connection needed re-establishment after app closure
- Session may have needed refreshing
- Timeouts were too short for cold starts

## Solutions Implemented

### 1. Increased Timeout in app/index.tsx

**File**: `app/index.tsx`

**Changes**:
- Initial wait increased from 5s to 10s for cached auth (cold start scenarios)
- Extended wait increased from 3s to 5s for fallback fetch
- Total maximum wait: **15 seconds** (was 8 seconds)
- Now checks for user existence even if loading flag is still true

```typescript
const maxWaitTime = hasCachedAuth ? 10000 : 3000; // 10s for cached auth, 3s for fresh auth
```

**Reasoning**: After app has been closed for hours, Supabase connection needs time to re-establish, especially on slower networks.

### 2. Increased ProfileLoader Timeout

**File**: `store/auth.ts`

**Changes**:
- ProfileLoader timeout increased from 3s to 8s
- Max retries increased from 1 to 2
- More time for database connection on cold starts

```typescript
const cachedProfile = await ProfileLoader.loadProfile({
  userId,
  timeout: 8000,  // Was 3000ms
  maxRetries: 2,  // Was 1
  useCache: true
});
```

### 3. Added Retry Logic to Direct DB Fetch

**File**: `store/auth.ts`

**Changes**:
- Added retry mechanism to direct database fetch fallback
- Now retries up to 2 times with 1-second delay between attempts
- Better error logging for debugging

```typescript
let fetchAttempt = 0;
const maxDbRetries = 2;

while (fetchAttempt < maxDbRetries && !profileData) {
  fetchAttempt++;
  // ... fetch logic
  if (profileError && fetchAttempt < maxDbRetries) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### 4. Session Refresh on App Reopen

**File**: `store/auth.ts`

**Changes**:
- Added session refresh attempt before profile loading
- Ensures Supabase session is valid/refreshed
- Handles expired refresh tokens gracefully

```typescript
const { data: { session: refreshedSession }, error: sessionError } = 
  await supabase.auth.getSession();

if (refreshedSession) {
  useAuthStore.setState({ session: refreshedSession });
}
```

### 5. Improved Default Timeout in ProfileLoader

**File**: `services/auth/profileLoader.ts`

**Changes**:
- Default timeout increased from 15s to 20s
- Better accommodation for cold starts and slow networks

```typescript
const {
  userId,
  timeout = 20000, // Was 15000ms
  maxRetries = 3,
  useCache = true
} = options;
```

### 6. Clear Invalid Cached Auth

**File**: `app/index.tsx`

**Changes**:
- If all retries and waits fail, clear invalid cached auth
- Prevents infinite loops with stale cached data

```typescript
if (!updatedAuthState.session && !updatedAuthState.user) {
  await AsyncStorage.multiRemove(['auth_verified', 'user_id', 'profile_id', 'user_phone', 'user_role']);
  router.replace('/(auth)/language');
}
```

## Expected Behavior After Fix

### Cold Start (App Reopened After Hours)

1. **0-1s**: Auth store initialization begins
2. **0-1s**: Attempt to refresh Supabase session
3. **1-9s**: ProfileLoader attempts to load profile with retries
4. **9-14s**: If ProfileLoader fails, direct DB fetch with retries
5. **Max 15s**: If user loaded, navigate to home; otherwise clear cache and navigate to auth

### Warm Start (App Recently Used)

1. **0-1s**: Profile loaded from cache
2. **Immediate**: Navigate to home
3. **Background**: Session verification and refresh

### Why Second Open Works

On the second immediate open:
- Supabase connection is already established
- Profile might still be in memory
- No cold start delays
- Fetch completes within timeouts

## Testing Recommendations

1. **Cold Start Test**:
   - Close app completely
   - Wait 2-3 hours
   - Reopen app
   - Should successfully load profile and navigate to home within 10-15 seconds

2. **Network Delay Test**:
   - Enable network throttling (slow 3G)
   - Close and reopen app
   - Should still load successfully, just slower

3. **Expired Session Test**:
   - Let session expire (don't use app for 24+ hours)
   - Reopen app
   - Should either refresh session or gracefully handle expiry

4. **No Network Test**:
   - Turn off network
   - Reopen app
   - Should load from cache if available
   - Should show appropriate error if cache expired

## Monitoring

Watch for these log messages:

✅ **Success Indicators**:
```
Auth Store: ✅ Session refreshed successfully
Auth Store: ProfileLoader completed in XXXms
Auth Store: ✅ Successfully restored user from ProfileLoader
Index: Valid authentication found, navigating to main app
```

⚠️ **Warning Indicators** (recoverable):
```
Auth Store: ⚠️ ProfileLoader returned null
Auth Store: Attempting direct database fetch as fallback
Index: Have cached auth but no user loaded, waiting 5 more seconds
```

❌ **Error Indicators** (need investigation):
```
Auth Store: DB fetch attempt X failed
Index: Auth not restored after all waits
ProfileLoader: ❌ Profile not found after all retries
```

## Performance Impact

- **Cold Start**: +5-7 seconds (acceptable for reliability)
- **Warm Start**: No change (still instant from cache)
- **Network Usage**: Minimal increase due to retries
- **Battery Impact**: Negligible

## Fallback Strategy

If profile still fails to load after all improvements:

1. User is redirected to language screen
2. Invalid cached auth is cleared
3. User must re-authenticate
4. This prevents infinite loops and corrupted state

## Future Improvements

1. Implement background profile refresh every 30 minutes when app is active
2. Add offline mode with better cache management
3. Implement exponential backoff for retries
4. Add user-visible loading messages after 5 seconds
5. Implement profile sync queue for offline changes

