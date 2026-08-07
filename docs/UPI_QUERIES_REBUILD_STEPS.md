# Steps to Apply UPI App Queries

## The Problem
After rebuilding, the UPI app queries are not appearing in AndroidManifest.xml. This is because Expo doesn't automatically apply the `queries` field from `app.config.js`.

## The Solution
I've created a config plugin (`withUpiAppQueries`) in `app.plugin.js` that will automatically add the queries during the build process.

## Steps to Apply

### 1. Clean the Android Build
```bash
# Remove the android folder completely
rm -rf android

# Or on Windows PowerShell:
Remove-Item -Recurse -Force android
```

### 2. Rebuild with Prebuild
```bash
# This will regenerate android folder and apply all config plugins
npx expo prebuild --clean

# Then build and run
npx expo run:android
```

### 3. Verify AndroidManifest.xml
After rebuilding, check `android/app/src/main/AndroidManifest.xml`:

```xml
<queries>
  <!-- Existing HTTPS intent -->
  <intent>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https"/>
  </intent>
  
  <!-- NEW: UPI app packages (should be added by plugin) -->
  <package android:name="com.google.android.apps.nbu.paisa.user" />
  <package android:name="com.phonepe.app" />
  <package android:name="net.one97.paytm" />
  <package android:name="in.org.npci.upiapp" />
  
  <!-- NEW: SEND intent for UPI flow -->
  <intent>
    <action android:name="android.intent.action.SEND" />
  </intent>
</queries>
```

### 4. If Queries Still Missing
If the queries are still not added after rebuild, manually add them:

1. Open `android/app/src/main/AndroidManifest.xml`
2. Find the `<queries>` section (around line 18)
3. Add the package queries inside `<queries>`:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https"/>
  </intent>
  
  <!-- Add these lines -->
  <package android:name="com.google.android.apps.nbu.paisa.user" />
  <package android:name="com.phonepe.app" />
  <package android:name="net.one97.paytm" />
  <package android:name="in.org.npci.upiapp" />
  <intent>
    <action android:name="android.intent.action.SEND" />
  </intent>
</queries>
```

4. Save and rebuild:
```bash
npx expo run:android
```

## Why This Is Needed

Android 11+ (API 30+) requires apps to declare which other apps they want to query/interact with. Without these queries:
- Your app cannot detect installed UPI apps
- Razorpay cannot show direct UPI app options
- Users will only see manual UPI ID entry

## Testing

After adding queries and rebuilding:
1. Install at least one UPI app (Google Pay, PhonePe, or Paytm) on your test device
2. Open your app and go to payment
3. Select Razorpay
4. Select UPI as payment method
5. You should now see direct app options (Google Pay, PhonePe, etc.) instead of just manual UPI ID entry

