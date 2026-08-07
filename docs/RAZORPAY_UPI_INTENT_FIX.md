# Razorpay UPI Intent Flow - Troubleshooting Guide

## Issue
Direct UPI app redirection (Google Pay, PhonePe, Paytm, etc.) is not showing in Razorpay checkout.

## Root Cause
The edge function is NOT the issue. The edge function only creates Razorpay orders and doesn't affect payment method display. The issue is likely:

1. **App not rebuilt** - Android queries need a full rebuild
2. **Razorpay account settings** - Payment methods might be restricted in dashboard
3. **Configuration syntax** - React Native SDK might need specific setup

## Solution Steps

### 1. Verify Configuration Files

#### ✅ Android Queries (app.config.js)
```javascript
android: {
  queries: [
    {
      package: ["com.google.android.apps.nbu.paisa.user"], // Google Pay
    },
    {
      package: ["com.phonepe.app"], // PhonePe
    },
    {
      package: ["net.one97.paytm"], // Paytm
    },
    {
      package: ["in.org.npci.upiapp"], // BHIM
    },
    {
      intent: [
        {
          action: "android.intent.action.SEND",
        },
      ],
    },
  ],
}
```

#### ✅ iOS Info.plist (app.config.js)
```javascript
ios: {
  infoPlist: {
    LSApplicationQueriesSchemes: [
      "tez",        // Google Pay
      "phonepe",    // PhonePe
      "paytmmp",    // Paytm
      "bhim",       // BHIM
      "credpay",    // CRED UPI
    ]
  }
}
```

#### ✅ Razorpay Service (services/payment/razorpayService.ts)
- **DO NOT** specify `method` field in `razorpayOptions`
- This allows ALL payment methods to be shown
- UPI intent flow works automatically when Android queries are configured

### 2. Rebuild the App (CRITICAL)

**Android queries are only applied during build time.** You MUST rebuild:

```bash
# Clean and rebuild
npx expo prebuild --clean
npx expo run:android

# Or if using EAS Build
eas build --platform android --profile production
```

**Important:** Simply restarting the app is NOT enough. You need a full rebuild.

### 3. Verify Razorpay Dashboard Settings

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Go to **Settings** → **Payment Methods**
3. Ensure all payment methods are enabled:
   - ✅ UPI
   - ✅ Cards
   - ✅ Netbanking
   - ✅ Wallets
   - ✅ EMI

### 4. Test on Real Device

- UPI intent flow requires:
  - Real Android device (not emulator)
  - UPI apps installed (Google Pay, PhonePe, etc.)
  - Internet connection

### 5. Check Console Logs

When opening Razorpay checkout, check console for:
```
[RazorpayService] Initializing payment with options: {
  ...
  hasOrderId: true/false
}
```

### 6. Verify AndroidManifest.xml

After rebuilding, check `android/app/src/main/AndroidManifest.xml`:

```xml
<queries>
  <package android:name="com.google.android.apps.nbu.paisa.user" />
  <package android:name="com.phonepe.app" />
  <package android:name="net.one97.paytm" />
  <package android:name="in.org.npci.upiapp" />
  <intent>
    <action android:name="android.intent.action.SEND" />
  </intent>
</queries>
```

If these are missing, the queries weren't applied during build.

## Common Issues

### Issue: Still showing only manual UPI ID entry
**Solution:** 
- Rebuild the app completely
- Verify Android queries are in AndroidManifest.xml
- Check if UPI apps are installed on device

### Issue: No UPI apps showing
**Solution:**
- Ensure at least one UPI app (Google Pay, PhonePe, Paytm) is installed
- Verify Android queries are correctly configured
- Test on real device, not emulator

### Issue: Payment methods restricted
**Solution:**
- Check Razorpay Dashboard → Settings → Payment Methods
- Ensure all methods are enabled for your account

## Testing Checklist

- [ ] App rebuilt after adding Android queries
- [ ] AndroidManifest.xml contains UPI app queries
- [ ] UPI apps installed on test device
- [ ] Razorpay Dashboard has all payment methods enabled
- [ ] Testing on real Android device (not emulator)
- [ ] Using live mode (not test mode) for full functionality

## Still Not Working?

1. **Check Razorpay Account Status:**
   - Ensure account is fully activated
   - Verify KYC is complete
   - Check if there are any restrictions

2. **Contact Razorpay Support:**
   - They can check account-level settings
   - Verify if UPI intent is enabled for your account

3. **Verify SDK Version:**
   ```bash
   npm list react-native-razorpay
   ```
   Ensure you're using the latest version (^2.3.1)

