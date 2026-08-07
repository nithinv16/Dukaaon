# Razorpay React Native SDK - Deep Dive Investigation

## Problem Statement
- ✅ Same API keys work on website (UPI Intent enabled)
- ❌ UPI apps not showing in React Native app
- ❌ Clicking GPay icon → Opens Razorpay → But GPay option not available

## Key Differences: Web SDK vs React Native SDK

### Web SDK Behavior
- Auto-detects UPI apps installed on device
- Shows UPI apps directly when UPI is selected
- Works with just Android queries configuration

### React Native SDK Behavior (Based on Research)
- **Does NOT auto-detect UPI apps** - requires explicit configuration
- **May require different method configuration** than web SDK
- **User must select UPI first** - then UPI apps appear
- **Method configuration might restrict options** if set incorrectly

## Current Implementation Analysis

### What We're Doing Now
```typescript
razorpayOptions.method = {
  upi: {
    flow: 'intent', // 'intent' = direct app redirection
  },
};
```

### Potential Issues

#### Issue 1: Method Configuration Format
The React Native SDK might not support the object format `{ upi: { flow: 'intent' } }`. 
It might need:
- No `method` field at all (let Razorpay show all methods)
- Or a different format entirely

#### Issue 2: Order ID Requirement
Some sources suggest that UPI Intent might require an `order_id` to be present.
Our code creates an order, but if it fails, we continue without `order_id`.

#### Issue 3: React Native SDK Limitations
According to GitHub issues:
- React Native SDK might not support pre-selecting UPI to show only UPI apps
- User must manually select "UPI" in Razorpay UI first
- Then UPI apps (Google Pay, PhonePe) appear

## Investigation Steps

### Step 1: Remove Method Configuration (Test)
Try removing the `method` field entirely and see if UPI apps appear when user selects UPI:

```typescript
// DON'T set method at all
const razorpayOptions: any = {
  description: options.description,
  currency: 'INR',
  key: this.keyId,
  amount: amountInPaise,
  name: this.merchantName,
  // NO method field - let Razorpay show all methods
};
```

**Expected Behavior:**
- Razorpay shows all payment methods (Cards, UPI, Netbanking, Wallets)
- User selects "UPI"
- UPI apps (Google Pay, PhonePe, Paytm) should appear

### Step 2: Verify Order ID is Always Present
Ensure `order_id` is always set (don't continue without it):

```typescript
if (!razorpayOrderId) {
  throw new Error('Razorpay order creation failed. Cannot proceed without order_id.');
}
```

### Step 3: Check React Native SDK Version
Current: `react-native-razorpay@^2.3.1`

Check if there's a newer version with UPI Intent fixes:
```bash
npm view react-native-razorpay versions --json
```

### Step 4: Test Without forceUpi Flag
The `forceUpi` flag might be causing issues. Test without it:

```typescript
// Remove forceUpi completely
// Just open Razorpay with all methods available
// Let user select UPI manually
```

### Step 5: Check Razorpay Dashboard - App-Specific Settings
Even though UPI Intent works on website, there might be **app-specific settings**:

1. Go to Razorpay Dashboard
2. Settings → **API Keys** → Check if there are app-specific restrictions
3. Settings → **Payment Methods** → Check if there are app/package name restrictions
4. Settings → **Webhooks** → Verify app package name is registered

### Step 6: Verify Package Name Registration
Razorpay might need your app's package name registered:

1. Dashboard → Settings → **Applications** or **Mobile Apps**
2. Register package name: `com.sixn8.dukaaon`
3. This might be required for UPI Intent in mobile apps

## Most Likely Root Causes (In Order)

### 1. Method Configuration Format (60% likely)
**Hypothesis:** React Native SDK doesn't support `method: { upi: { flow: 'intent' } }` format
**Solution:** Remove `method` field entirely, let user select UPI manually

### 2. Package Name Not Registered (25% likely)
**Hypothesis:** Razorpay requires app package name to be registered for UPI Intent
**Solution:** Register `com.sixn8.dukaaon` in Razorpay Dashboard

### 3. Order ID Missing (10% likely)
**Hypothesis:** UPI Intent requires `order_id` to be present
**Solution:** Ensure order creation always succeeds before opening Razorpay

### 4. SDK Version Issue (5% likely)
**Hypothesis:** Current SDK version has UPI Intent bugs
**Solution:** Update to latest version or check GitHub issues

## Testing Plan

### Test 1: Remove Method Configuration
```typescript
// Remove this entire block:
if (options.forceUpi) {
  razorpayOptions.method = { ... };
} else {
  razorpayOptions.method = { ... };
}
```

### Test 2: Ensure Order ID Always Present
```typescript
if (!razorpayOrderId) {
  throw new Error('Cannot proceed without Razorpay order_id');
}
```

### Test 3: Check Package Name Registration
- Login to Razorpay Dashboard
- Check if `com.sixn8.dukaaon` is registered
- If not, register it

### Test 4: Update SDK Version
```bash
npm install react-native-razorpay@latest
```

## Expected Behavior After Fix

1. User clicks "GPay" icon
2. App navigates to checkout
3. Razorpay opens showing all payment methods
4. User selects "UPI" 
5. **UPI apps appear** (Google Pay, PhonePe, Paytm)
6. User selects "Google Pay"
7. Google Pay app opens

## References
- [Razorpay React Native SDK GitHub](https://github.com/razorpay/react-native-razorpay)
- [Razorpay UPI Intent Android Docs](https://razorpay.com/docs/payments/payment-methods/upi-intent/android/)
- [React Native SDK Issues](https://github.com/razorpay/react-native-razorpay/issues)

