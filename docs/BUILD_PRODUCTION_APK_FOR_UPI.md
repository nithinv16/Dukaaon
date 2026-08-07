# Building Production APK for UPI Intent Testing

## Issue
UPI Intent flow (Google Pay, PhonePe, Paytm) might not work in development/debug builds because:
1. Debug builds use debug signing which UPI apps might reject
2. Android package queries behave differently in debug builds
3. UPI apps have strict security checks for unsigned/debug apps

## Solution: Build a Properly Signed Production APK

### Current Issue
Your `android/app/build.gradle` shows:
```gradle
buildTypes {
    release {
        signingConfig signingConfigs.debug  // ❌ Using debug signing!
    }
}
```

This means even "release" builds are using debug signing, which UPI apps might reject.

### Option 1: Build Release APK with EAS Build (Recommended - Easiest)

EAS Build will handle signing automatically:

```bash
# Install EAS CLI if not installed
npm install -g eas-cli

# Login to Expo
eas login

# Build production APK (signed automatically)
eas build --platform android --profile apk

# The build will:
# - Sign the APK with a proper keystore
# - Apply all Android queries correctly
# - Use production build configuration
# - Enable UPI Intent flow properly
```

After build completes, download and install the APK on your device.

### Option 2: Build Release APK Locally with Proper Signing

#### Step 1: Create a Keystore (if you don't have one)

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore dukaaon-release-key.jks -alias dukaaon-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**Important:** Save the passwords and alias name! You'll need them.

#### Step 2: Configure Signing in build.gradle

Edit `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            // Remove: signingConfig signingConfigs.debug
            signingConfig signingConfigs.release  // ✅ Use release signing
            shrinkResources false
            minifyEnabled false
        }
    }
}
```

#### Step 3: Create gradle.properties

Create/update `android/gradle.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=app/dukaaon-release-key.jks
MYAPP_RELEASE_KEY_ALIAS=dukaaon-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-store-password
MYAPP_RELEASE_KEY_PASSWORD=your-key-password
```

**Security Note:** Add `android/gradle.properties` to `.gitignore` to avoid committing passwords!

#### Step 4: Build Release APK

```bash
# Clean and rebuild
npx expo prebuild --clean

# Build release APK
cd android
./gradlew assembleRelease

# APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

#### Step 5: Install on Device

```bash
# Install via ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# Or transfer APK to device and install manually
```

### Option 3: Quick Test with Debug-Signed Release Build

If you just want to test quickly (might not work for UPI, but worth trying):

```bash
# Clean and rebuild
npx expo prebuild --clean

# Build release APK (will use debug signing)
cd android
./gradlew assembleRelease

# Install
adb install android/app/build/outputs/apk/release/app-release.apk
```

**Note:** This might still not work for UPI Intent because it's still using debug signing.

## Testing After Building Production APK

1. **Install the production APK** on a real Android device
2. **Ensure UPI apps are installed** (Google Pay, PhonePe, Paytm)
3. **Test payment flow:**
   - Click on Google Pay icon
   - Razorpay should open
   - Select **UPI** as payment method
   - UPI apps (Google Pay, PhonePe, Paytm) should appear
   - Select Google Pay → Should redirect to Google Pay app

## Why Production Build is Required

1. **Security**: UPI apps verify app signatures before responding to intents
2. **Package Visibility**: Android 11+ package queries work better with properly signed apps
3. **Intent Filtering**: UPI apps might reject intents from debug-signed apps
4. **Razorpay SDK**: Some SDK features work better in production builds

## Troubleshooting

### If UPI apps still don't show after production build:

1. **Verify APK is properly signed:**
   ```bash
   # Check APK signature
   apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
   ```

2. **Check AndroidManifest.xml:**
   - Verify `<queries>` section is present
   - Verify UPI app packages are listed

3. **Check Razorpay Dashboard:**
   - UPI Intent must be enabled
   - Test with live keys (not test keys)

4. **Device Requirements:**
   - Android 11+ (API 30+)
   - Real device (not emulator)
   - UPI apps installed and updated

## Recommended Approach

**Use EAS Build** - It's the easiest and most reliable:
- ✅ Automatic signing
- ✅ Proper build configuration
- ✅ No local setup needed
- ✅ Works consistently

```bash
eas build --platform android --profile apk
```

