# Seller Sign-Up Flow Test Plan

## 🎯 Objective
Validate that the complete seller sign-up flow works end-to-end after applying the profile creation fix.

## 🔄 Complete Seller Sign-Up Flow

### Step 1: Phone Number Entry
**Location**: `app/(auth)/login.tsx`
- User enters phone number
- App calls `supabase.auth.signInWithOtp({ phone: phoneNumber })`
- OTP is sent via SMS

### Step 2: OTP Verification  
**Location**: `app/(auth)/otp.tsx`
- User enters 6-digit OTP code
- App calls `supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })`
- **Critical Point**: This creates entry in `auth.users` table
- After successful verification, calls `createProfileSafely()`

### Step 3: Profile Creation
**Location**: `app/(auth)/otp.tsx` → `createProfileSafely()` function
- Uses `create_profile_unified` RPC function (our fix target)
- Creates entry in `public.profiles` table with proper timestamps
- **Fixed Issue**: Now includes `created_at` and `updated_at` columns

### Step 4: Role-Based Redirect
**Location**: `app/(auth)/otp.tsx` → `handleProfileSuccess()`
- Checks user role from profile
- For sellers: Redirects to seller KYC form
- For retailers: Redirects to retailer dashboard

### Step 5: Seller KYC Completion
**Location**: `app/(auth)/seller-kyc.tsx`
- Seller fills business details form
- Creates entry in `seller_details` table
- Updates profile status to complete

## 🧪 Test Scenarios

### Test Case 1: New Seller Registration
**Prerequisites**: 
- Fresh phone number (not previously registered)
- Profile creation fix deployed

**Steps**:
1. Open app and navigate to login
2. Enter new phone number
3. Select "Seller" role
4. Request OTP
5. Enter valid OTP code
6. Verify successful profile creation
7. Complete seller KYC form
8. Verify redirect to seller dashboard

**Expected Results**:
- ✅ OTP verification succeeds
- ✅ Profile created in `public.profiles` with timestamps
- ✅ No "Profile creation failed" error
- ✅ Successful redirect to seller KYC
- ✅ Seller details saved successfully

### Test Case 2: Existing User Login
**Prerequisites**: 
- Previously registered seller account

**Steps**:
1. Enter existing phone number
2. Request and verify OTP
3. Verify successful login

**Expected Results**:
- ✅ Login succeeds without profile creation
- ✅ Redirect to appropriate dashboard based on completion status

### Test Case 3: Error Handling
**Prerequisites**: 
- Various error conditions

**Steps**:
1. Test with invalid OTP
2. Test with expired OTP
3. Test network connectivity issues

**Expected Results**:
- ✅ Proper error messages displayed
- ✅ No app crashes
- ✅ User can retry

## 🔍 Validation Points

### Database Validation
After successful sign-up, verify:

```sql
-- Check auth.users entry
SELECT id, phone, created_at FROM auth.users WHERE phone = '+91XXXXXXXXXX';

-- Check profiles entry with timestamps
SELECT id, phone_number, role, status, created_at, updated_at 
FROM public.profiles WHERE phone_number = '+91XXXXXXXXXX';

-- Check seller_details entry (after KYC)
SELECT user_id, business_name, owner_name, status, created_at 
FROM public.seller_details WHERE user_id = 'USER_ID_FROM_PROFILES';
```

### App State Validation
- ✅ User session established in auth store
- ✅ Profile data loaded correctly
- ✅ Navigation works as expected
- ✅ No console errors

## 🚨 Critical Success Criteria

1. **No "Profile creation failed" errors** during OTP verification
2. **Timestamps properly set** in profiles table (`created_at`, `updated_at`)
3. **Successful navigation** from OTP → KYC → Dashboard
4. **Data consistency** between `auth.users` and `public.profiles`
5. **Error handling** works for edge cases

## 🛠️ Testing Tools

### Manual Testing
- Use real device with SMS capability
- Test with multiple phone numbers
- Verify on both iOS and Android

### Automated Validation
- Run `validate_profile_fix.js` to verify database function
- Check Supabase dashboard for data consistency
- Monitor error logs during testing

### Database Monitoring
```sql
-- Monitor profile creation in real-time
SELECT COUNT(*) as total_profiles, 
       COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as with_timestamps
FROM public.profiles;

-- Check for any failed profile creations
SELECT * FROM public.profiles 
WHERE created_at IS NULL OR updated_at IS NULL;
```

## 📊 Test Results Template

### Test Execution Log
```
Date: ___________
Tester: ___________
Environment: Production/Staging

Test Case 1 - New Seller Registration:
[ ] Phone number entry: PASS/FAIL
[ ] OTP request: PASS/FAIL  
[ ] OTP verification: PASS/FAIL
[ ] Profile creation: PASS/FAIL
[ ] KYC form: PASS/FAIL
[ ] Final redirect: PASS/FAIL

Issues Found:
- 
- 

Database Verification:
[ ] auth.users entry created: PASS/FAIL
[ ] profiles entry with timestamps: PASS/FAIL
[ ] seller_details entry: PASS/FAIL
```

## 🎉 Success Metrics

- **0 profile creation failures** during testing
- **100% successful** new seller registrations
- **Proper timestamp data** in all profile records
- **Smooth user experience** with no errors or crashes

---

**Status**: Ready for Testing
**Priority**: HIGH - Critical user registration flow
**Estimated Testing Time**: 30-45 minutes per test cycle