# Firebase Authentication Troubleshooting Guide

## Common Error: `auth/missing-client-identifier`

This error occurs when Firebase cannot verify your app's identity. Here are the solutions:

### 1. SHA Fingerprint Issues

**Problem**: The SHA-1 or SHA-256 fingerprints in Firebase Console don't match your app's signature.

**Solution**:
1. Get your app's SHA fingerprints:
   ```bash
   # For debug builds
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   
   # For release builds (if you have a release keystore)
   keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
   ```

2. Add these fingerprints to Firebase Console:
   - Go to Firebase Console → Project Settings → Your Apps
   - Click on your Android app
   - Add the SHA-1 and SHA-256 fingerprints
   - Download the updated `google-services.json`

### 2. Package Name Mismatch

**Problem**: Package name in `google-services.json` doesn't match `app.config.js`.

**Current Configuration**:
- `app.config.js`: `com.sixn8.dukaaon`
- `google-services.json`: Has two clients with different package names

**Solution**: Ensure consistency across all configuration files.

### 3. Development Environment Issues

**Problem**: Play Integrity and reCAPTCHA checks fail in development.

**Solution**: Use test phone numbers in Firebase Console:
1. Go to Firebase Console → Authentication → Sign-in method
2. Click on "Phone" provider
3. Add test phone numbers with verification codes
4. Use these numbers during development

### 4. App Verification Settings

**Current Implementation**:
- Development: App verification disabled
- Production: App verification enabled
- reCAPTCHA flow controlled based on environment

### 5. Emergency Fallback

If Firebase authentication continues to fail, the app includes a development fallback:
- Uses verification ID: `dev-{timestamp}`
- Default OTP: `123456`
- Only active in development mode

## Recommended Test Phone Numbers

Add these to Firebase Console for testing:
- `+91 9999999999` → Code: `123456`
- `+91 8888888888` → Code: `654321`

## Production Checklist

- [ ] SHA fingerprints added to Firebase Console
- [ ] Package names consistent across all files
- [ ] `google-services.json` updated and placed correctly
- [ ] Test phone numbers configured (for testing)
- [ ] App verification enabled in production builds
- [ ] reCAPTCHA flow enabled in production

## Debug Commands

```bash
# Check current SHA fingerprints
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Verify package name in APK
aapt dump badging your-app.apk | grep package

# Check Firebase configuration
adb logcat | grep Firebase
```

## Contact Information

If issues persist:
1. Check Firebase Console logs
2. Verify all configuration files
3. Test with registered test phone numbers
4. Contact Firebase support with error logs