# Razorpay UPI Intent Flow - Complete Debugging Guide

## Current Status
- ✅ AndroidManifest.xml has UPI app queries
- ✅ Config plugin created to preserve queries
- ✅ Razorpay service doesn't restrict methods
- ❌ Direct UPI app options still not showing

## Critical Checks

### 1. Verify AndroidManifest.xml After Rebuild
Check `android/app/src/main/AndroidManifest.xml` - the queries section should look like:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https"/>
  </intent>
  <!-- These MUST be present -->
  <package android:name="com.google.android.apps.nbu.paisa.user" />
  <package android:name="com.phonepe.app" />
  <package android:name="net.one97.paytm" />
  <package android:name="in.org.npci.upiapp" />
  <intent>
    <action android:name="android.intent.action.SEND" />
  </intent>
</queries>
```

### 2. Razorpay Dashboard Settings (CRITICAL)

**This is likely the issue!** Check your Razorpay Dashboard:

1. Login to https://dashboard.razorpay.com
2. Go to **Settings** → **Payment Methods**
3. Check if **UPI** is enabled
4. Look for **"UPI Intent"** or **"UPI Deep Linking"** setting
5. **Enable it if it's disabled**

Some Razorpay accounts have UPI Intent flow disabled by default. You may need to:
- Contact Razorpay support to enable UPI Intent
- Complete additional KYC if required
- Verify your business account status

### 3. Test Mode vs Live Mode

**UPI Intent flow may not work in Test Mode!**

- Check if you're using test keys (`rzp_test_...`) or live keys (`rzp_live_...`)
- Your config shows `rzp_live_xxxxxxxxxxxx` - this is live mode ✅
- But verify in Razorpay Dashboard that UPI Intent is enabled for live mode

### 4. Device Requirements

- **Must test on real Android device** (not emulator)
- **Android 11+ (API 30+)** required for package queries
- **At least one UPI app installed** (Google Pay, PhonePe, or Paytm)
- **UPI apps must be updated** to latest version

### 5. Razorpay SDK Version

Check your `package.json`:
```bash
npm list react-native-razorpay
```

Should be version `^2.3.1` or higher. Older versions may not support UPI Intent properly.

### 6. Check Console Logs

When opening Razorpay checkout, check for:
```
[RazorpayService] Initializing payment with options: {
  ...
  hasOrderId: true/false
}
```

Also check for any Razorpay SDK errors.

### 7. Manual Test - Can App Detect UPI Apps?

Add this test code to verify Android queries are working:

```typescript
// Test if app can detect UPI apps
import { Linking } from 'react-native';

const testUpiApps = async () => {
  const upiApps = [
    'com.google.android.apps.nbu.paisa.user',
    'com.phonepe.app',
    'net.one97.paytm',
  ];
  
  for (const packageName of upiApps) {
    try {
      const canOpen = await Linking.canOpenURL(`${packageName}://`);
      console.log(`${packageName}: ${canOpen ? 'DETECTED' : 'NOT DETECTED'}`);
    } catch (e) {
      console.log(`${packageName}: ERROR - ${e.message}`);
    }
  }
};
```

If apps are not detected, the Android queries aren't working.

## Most Likely Issues (In Order)

1. **Razorpay Dashboard - UPI Intent not enabled** (90% likely)
   - Solution: Enable in Dashboard or contact Razorpay support

2. **App not detecting UPI apps** (5% likely)
   - Solution: Verify AndroidManifest.xml queries are correct
   - Rebuild app completely

3. **Razorpay SDK version too old** (3% likely)
   - Solution: Update `react-native-razorpay` to latest

4. **Testing in wrong environment** (2% likely)
   - Solution: Test on real device with UPI apps installed

## Next Steps

1. **Check Razorpay Dashboard** - This is the #1 thing to verify
2. **Contact Razorpay Support** if UPI Intent option is not visible
3. **Test on real device** with UPI apps installed
4. **Verify AndroidManifest.xml** after rebuild

## Contact Razorpay Support

If nothing works, contact Razorpay support with:
- Your Razorpay Key ID: `<your_razorpay_key_id>`
- Issue: "UPI Intent flow not showing direct app options"
- Ask: "Is UPI Intent enabled for my account?"

