# Firebase "Too Many Requests" Error Analysis

## Problem Identified

The Firebase phone authentication error "We have blocked all requests from this device due to unusual activity" is caused by **multiple simultaneous authentication requests** being sent to Firebase. This analysis identifies the root causes and provides solutions.

## Root Causes

### 1. Multiple Authentication Flows

The app has **two separate auth stores** that can trigger simultaneous Firebase requests:
- `store/auth.ts` - Main Supabase auth store
- `store/authStore.ts` - Firebase-specific auth store

### 2. Duplicate Firebase Calls in OTP Component

**File: `app/(auth)/otp.tsx`**

**Problem Areas:**

#### A. Automatic OTP Renewal (Lines 1050-1070)
```typescript
// Automatically request a new OTP when expired
const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
```

#### B. Manual Resend OTP (Lines 1072-1105)
```typescript
const handleResendOTP = async () => {
  const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
}
```

#### C. Initial OTP Request in Login (Lines 70-85)
```typescript
// In login.tsx
const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
```

### 3. Firebase Configuration Issues

**File: `services/firebase/firebase.ts`**
```typescript
// Force reCAPTCHA flow increases request frequency
auth().settings.forceRecaptchaFlow = true;
```

### 4. Multiple Auth State Listeners

**File: `app/(auth)/login.tsx` (Lines 28-36)**
```typescript
useEffect(() => {
  const unsubscribe = auth().onAuthStateChanged((user) => {
    // This can trigger additional requests
  });
  return unsubscribe;
}, []);
```

### 5. Concurrent Sync Operations

**File: `services/auth/firebaseSupabaseSync.ts`**
- Multiple profile lookup attempts
- Simultaneous Supabase session creation
- Retry mechanisms that can compound the issue

## Specific Request Multiplication Scenarios

### Scenario 1: OTP Expiration
1. User enters expired OTP
2. `handleVerify` fails
3. Automatic renewal triggers `signInWithPhoneNumber`
4. User clicks "Resend OTP" simultaneously
5. **Result: 2+ concurrent Firebase requests**

### Scenario 2: Network Issues
1. Initial login request times out
2. User clicks login again
3. Both requests eventually reach Firebase
4. **Result: Duplicate authentication attempts**

### Scenario 3: Auth State Conflicts
1. Firebase auth state changes
2. Both auth stores react simultaneously
3. Each triggers profile sync
4. **Result: Multiple concurrent operations**

## Solutions

### 1. Implement Request Debouncing

**Create: `services/firebase/authRequestManager.ts`**
```typescript
class AuthRequestManager {
  private static instance: AuthRequestManager;
  private pendingRequests = new Map<string, Promise<any>>();
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new AuthRequestManager();
    }
    return this.instance;
  }
  
  async signInWithPhoneNumber(phoneNumber: string) {
    const key = `phone_${phoneNumber}`;
    
    if (this.pendingRequests.has(key)) {
      console.log('Reusing existing phone auth request for:', phoneNumber);
      return this.pendingRequests.get(key);
    }
    
    const request = auth().signInWithPhoneNumber(phoneNumber);
    this.pendingRequests.set(key, request);
    
    try {
      const result = await request;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}

export const authRequestManager = AuthRequestManager.getInstance();
```

### 2. Fix OTP Component

**Update: `app/(auth)/otp.tsx`**

```typescript
// Add request state management
const [isRequestingOTP, setIsRequestingOTP] = useState(false);

const handleResendOTP = async () => {
  if (isRequestingOTP) {
    console.log('OTP request already in progress');
    return;
  }
  
  setIsRequestingOTP(true);
  setLoading(true);
  setError('');
  
  try {
    const formattedPhone = `+91${phone}`;
    console.log('Resending OTP to phone:', formattedPhone);
    
    // Use the request manager to prevent duplicates
    const confirmation = await authRequestManager.signInWithPhoneNumber(formattedPhone);
    
    if (confirmation && confirmation.verificationId) {
      await AsyncStorage.setItem('verificationId', confirmation.verificationId);
      setVerificationId(confirmation.verificationId);
      alert('A new OTP has been sent to your phone');
    }
  } catch (error: any) {
    console.error('Error resending OTP:', error);
    setError('Failed to resend OTP. Please try again later.');
  } finally {
    setLoading(false);
    setIsRequestingOTP(false);
  }
};

// Remove automatic OTP renewal - let user manually request
// Comment out the automatic renewal in handleVerify
```

### 3. Consolidate Auth Stores

**Problem:** Two auth stores can conflict
**Solution:** Use only `store/auth.ts` and remove `store/authStore.ts`

### 4. Add Request Cooldown

```typescript
// Add to login.tsx and otp.tsx
const [lastRequestTime, setLastRequestTime] = useState(0);
const REQUEST_COOLDOWN = 30000; // 30 seconds

const canMakeRequest = () => {
  const now = Date.now();
  return now - lastRequestTime > REQUEST_COOLDOWN;
};

const handleLogin = async () => {
  if (!canMakeRequest()) {
    const remainingTime = Math.ceil((REQUEST_COOLDOWN - (Date.now() - lastRequestTime)) / 1000);
    setError(`Please wait ${remainingTime} seconds before requesting another OTP`);
    return;
  }
  
  setLastRequestTime(Date.now());
  // ... rest of login logic
};
```

### 5. Update Firebase Configuration

**Update: `services/firebase/firebase.ts`**
```typescript
try {
  if (auth()) {
    // Disable forced reCAPTCHA to reduce request frequency
    auth().settings.forceRecaptchaFlow = false;
    
    // Enable app verification for production
    auth().settings.appVerificationDisabledForTesting = false;
    
    console.log('Firebase: Optimized configuration for rate limiting');
  }
} catch (error) {
  console.log('Firebase auth settings configuration error:', error);
}
```

## Implementation Priority

1. **High Priority:** Implement request debouncing (Solution 1)
2. **High Priority:** Fix OTP component duplicate requests (Solution 2)
3. **Medium Priority:** Add request cooldown (Solution 4)
4. **Medium Priority:** Update Firebase configuration (Solution 5)
5. **Low Priority:** Consolidate auth stores (Solution 3)

## Testing

After implementing fixes:

1. Test rapid clicking of "Send OTP" button
2. Test OTP expiration scenarios
3. Test network interruption during auth
4. Monitor Firebase console for request patterns
5. Test with multiple devices to ensure rate limits are respected

## Prevention

- Always check for pending requests before making new ones
- Implement proper loading states
- Add user feedback for request cooldowns
- Monitor Firebase usage in production
- Set up alerts for rate limit violations

## Firebase Console Monitoring

Check Firebase Console → Authentication → Usage for:
- Request patterns
- Rate limit violations
- Unusual activity alerts
- Daily/monthly quotas