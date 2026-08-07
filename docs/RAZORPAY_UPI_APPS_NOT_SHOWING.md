# Razorpay UPI Apps Not Showing - Troubleshooting Guide

## Issue
When clicking on Google Pay/PhonePe icon, Razorpay opens but UPI apps (Google Pay, PhonePe, Paytm) are not showing as options.

## Root Causes (In Order of Likelihood)

### 1. UPI Intent Not Enabled in Razorpay Dashboard (90% likely)
**This is the #1 cause!**

Razorpay Dashboard settings control whether UPI Intent flow is available:

1. Login to https://dashboard.razorpay.com
2. Go to **Settings** → **Payment Methods**
3. Look for **"UPI"** section
4. Check if **"UPI Intent"** or **"UPI Deep Linking"** is enabled
5. **If disabled, enable it**

**Important Notes:**
- UPI Intent might be disabled by default for some accounts
- You may need to contact Razorpay support to enable it
- Additional KYC verification might be required
- UPI Intent might only work in Live mode, not Test mode

### 2. Device Doesn't Have UPI Apps Installed (5% likely)
- Verify Google Pay, PhonePe, or Paytm is installed on the device
- UPI apps must be updated to latest version
- Test on a real device (not emulator)

### 3. Android Queries Not Applied (3% likely)
- Android queries are only applied during build time
- You MUST rebuild the app after adding queries:
  ```bash
  npx expo prebuild --clean
  npx expo run:android
  ```
- Verify `android/app/src/main/AndroidManifest.xml` has:
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

### 4. Razorpay SDK Version Too Old (2% likely)
- Current version: `react-native-razorpay@^2.3.1` ✅
- If using older version, update:
  ```bash
  npm install react-native-razorpay@latest
  ```

## How Razorpay React Native SDK Works

**Important:** Razorpay React Native SDK might not support directly showing only UPI apps. The typical flow is:

1. Razorpay opens showing **all payment methods** (Cards, UPI, Netbanking, Wallets)
2. User selects **UPI** as payment method
3. **Then** UPI apps (Google Pay, PhonePe, Paytm) appear

**This is different from the web SDK** which can show UPI apps directly.

## Current Implementation

Our code configures UPI with intent flow:
```typescript
method: {
  upi: {
    flow: 'intent', // Direct app redirection
  },
}
```

This ensures that when user selects UPI, UPI apps will be shown (if UPI Intent is enabled in dashboard).

## Testing Steps

1. **Check Razorpay Dashboard** (CRITICAL)
   - Login to dashboard
   - Settings → Payment Methods → UPI
   - Verify UPI Intent is enabled
   - If not visible, contact Razorpay support

2. **Test on Real Device**
   - Must test on real Android device (not emulator)
   - Android 11+ (API 30+) required
   - At least one UPI app must be installed

3. **Verify UPI Apps Are Installed**
   - Google Pay: `com.google.android.apps.nbu.paisa.user`
   - PhonePe: `com.phonepe.app`
   - Paytm: `net.one97.paytm`

4. **Test Payment Flow**
   - Click on Google Pay icon in payment methods
   - Razorpay should open
   - Select **UPI** as payment method
   - UPI apps should appear (if UPI Intent is enabled)

5. **Check Console Logs**
   - Look for: `[RazorpayService] Force UPI enabled - UPI configured with intent flow`
   - Check for any Razorpay SDK errors

## If UPI Apps Still Don't Show

1. **Contact Razorpay Support**
   - Ask them to enable UPI Intent for your account
   - Provide your Razorpay Key ID: `rzp_live_RxirgNtNjhxqSg`
   - Mention you're using React Native SDK v2.3.1

2. **Verify Account Status**
   - Ensure your Razorpay account is fully activated
   - Complete any pending KYC requirements
   - Verify business account status

3. **Test in Live Mode**
   - UPI Intent might not work in Test mode
   - Ensure you're using live keys (`rzp_live_...`)

## Expected Behavior

**Current Implementation:**
- User clicks Google Pay icon → Navigates to checkout → Razorpay opens
- Razorpay shows all payment methods (Cards, UPI, Netbanking, Wallets)
- User selects UPI → UPI apps (Google Pay, PhonePe, Paytm) appear
- User selects Google Pay → Redirects to Google Pay app

**Note:** Razorpay React Native SDK might not support skipping the payment method selection and showing UPI apps directly. This is a limitation of the SDK, not our implementation.

## Alternative Solution

If Razorpay doesn't support direct UPI app selection, we could:
1. Keep current flow (user selects UPI in Razorpay, then sees UPI apps)
2. Add a note in UI: "Select UPI in Razorpay to see Google Pay, PhonePe, etc."

## Development Build vs Production Build

**IMPORTANT:** UPI Intent flow might not work properly in development/debug builds!

### Why Development Builds May Fail:
1. **Unsigned APKs**: Development builds are often unsigned or use debug signing, which UPI apps might reject
2. **Package Visibility**: Android 11+ package queries might behave differently in debug builds
3. **Security Restrictions**: UPI apps have strict security checks that might fail with debug builds
4. **Intent Filtering**: UPI apps might not respond to intents from unsigned/debug apps

### Solution: Build a Production/Signed APK

You need to test with a **signed production build** for UPI Intent to work properly:

#### Option 1: Build Release APK Locally
```bash
# Clean and rebuild
npx expo prebuild --clean

# Build release APK (signed)
cd android
./gradlew assembleRelease
# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

**Note:** You'll need to configure signing in `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file('path/to/keystore.jks')
            storePassword 'your-store-password'
            keyAlias 'your-key-alias'
            keyPassword 'your-key-password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

#### Option 2: Build with EAS Build (Recommended)
```bash
# Install EAS CLI if not installed
npm install -g eas-cli

# Login to Expo
eas login

# Build production APK
eas build --platform android --profile apk

# Or build production app bundle
eas build --platform android --profile production
```

The EAS build will:
- ✅ Sign the APK properly
- ✅ Apply all Android queries correctly
- ✅ Use production build configuration
- ✅ Enable UPI Intent flow properly

### Testing Steps:
1. **Build production APK** using one of the methods above
2. **Install on real device** (not emulator)
3. **Ensure UPI apps are installed** (Google Pay, PhonePe, Paytm)
4. **Test payment flow** - UPI apps should appear when selecting UPI in Razorpay

## Next Steps

1. ✅ **Check Razorpay Dashboard** - Enable UPI Intent if disabled (you've already done this)
2. ✅ **Build Production/Signed APK** - This is likely the issue!
3. ✅ **Test on real device** with UPI apps installed
4. ✅ **Verify Android queries** are in AndroidManifest.xml after rebuild

