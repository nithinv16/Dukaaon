# Fix Razorpay Key ID Cache Issue

If you're seeing `rzp_live_R` (10 characters) instead of the complete key, the app is using a cached value.

## Quick Fix Steps

### 1. Clear Expo/Metro Cache

```bash
# Stop your development server (Ctrl+C)

# Clear Metro bundler cache
npx expo start --clear

# Or if using npm/yarn
npm start -- --reset-cache
# or
yarn start --reset-cache
```

### 2. Clear App Data (Android)

If running on Android device/emulator:

```bash
# Clear app data
adb shell pm clear com.sixn8.dukaaon

# Or uninstall and reinstall
adb uninstall com.sixn8.dukaaon
```

### 3. Rebuild the App

For production builds:

```bash
# Rebuild with EAS
eas build --platform android --clear-cache

# Or locally
npx expo prebuild --clean
```

### 4. Verify Configuration

Check that these files have the correct values:

**`config/razorpay.ts`** (line 26):
```typescript
keyId: getConfigValue('EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_live_RxirgNtNjhxqSg'),
```

**`app.config.js`** (line 248):
```javascript
EXPO_PUBLIC_RAZORPAY_KEY_ID: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_live_RxirgNtNjhxqSg",
```

### 5. Check Environment Variables

If you have a `.env` file, make sure it has:

```bash
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_RxirgNtNjhxqSg
EXPO_PUBLIC_RAZORPAY_KEY_SECRET=XNC1LWew0Fd4Ly9LoWb4Egrp
```

**Important**: Environment variables take precedence over fallback values. If `EXPO_PUBLIC_RAZORPAY_KEY_ID` is set to `rzp_live_R` anywhere, it will override the fallback.

### 6. Check Console Logs

After restarting, look for these logs:
- `[RazorpayConfig] Loaded Key ID: rzp_live_RxirgNtNjhxqSg... (length: 21)`
- `[RazorpayService] Initialized with Key ID: rzp_live_RxirgNtNjhxqSg... (length: 21)`

If you see `length: 10`, the cache is still active.

## Why This Happens

Expo/React Native caches:
1. **Metro bundler cache** - JavaScript bundle cache
2. **Expo Constants cache** - App config values
3. **App data cache** - Stored app state

The old incomplete key (`rzp_live_R`) is likely cached in one of these.

## Nuclear Option

If nothing else works:

```bash
# 1. Stop everything
# 2. Delete all caches
rm -rf node_modules/.cache
rm -rf .expo
rm -rf android/app/build
rm -rf ios/build

# 3. Reinstall dependencies
npm install
# or
yarn install

# 4. Clear Metro cache and restart
npx expo start --clear
```

## Verify It's Fixed

After restarting, the console should show:
- ✅ Key ID length: 21 (not 10)
- ✅ Key ID starts with: `rzp_live_RxirgNtNjhxqSg`
- ✅ No validation errors

Then try a payment again!

