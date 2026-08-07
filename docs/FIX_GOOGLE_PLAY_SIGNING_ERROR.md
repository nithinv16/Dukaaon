# Fix Google Play Console Signing Error

## Problem
You're getting this error when uploading AAB to Google Play Console:
```
Your Android App Bundle is signed with the wrong key.
Expected SHA1: 61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88
Actual SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

## Root Cause
The build is using a different keystore than the one registered with Google Play Console.

## Solution

The correct keystore is: `credentials/android/dukaaon_upload_new.jks`
- **SHA1**: `61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88` ✅
- **Alias**: `dukaaon_upload`

### For Local Builds

The `android/app/build.gradle` has been updated to use the correct keystore for release builds.

#### Step 1: Verify Keystore Passwords

Check `gradle.properties` to ensure the keystore passwords are set:
```properties
KEYSTORE_PASSWORD=dukaaon
KEY_PASSWORD=dukaaon
```

If your passwords are different, update them in `gradle.properties`.

#### Step 2: Build Release AAB

Build the release app bundle:

```bash
cd android
./gradlew bundleRelease
```

The AAB will be located at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

#### Step 3: Verify the Signature

Before uploading, verify the AAB is signed with the correct key:

```bash
# Extract and verify the signature
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Or check the certificate fingerprint:
```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

The SHA1 should match: `61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88`

#### Step 4: Upload to Google Play Console

Upload the AAB file to Google Play Console. The signing error should be resolved.

### For EAS Builds

If you're using EAS Build instead of local builds:

#### Step 1: Update EAS Credentials

```bash
# Make sure you're logged in to EAS
eas login

# Update Android credentials for production builds
eas credentials
```

When prompted:
1. Select **Android**
2. Select **production** profile
3. Choose **Set up new credentials** or **Update existing credentials**
4. Select **Upload a keystore**
5. Provide the path: `credentials/android/dukaaon_upload_new.jks`
6. Enter the keystore password when prompted
7. Enter the key alias: `dukaaon_upload`
8. Enter the key password when prompted

#### Step 2: Build New AAB

```bash
eas build --platform android --profile production
```

## Alternative: Manual Keystore Verification

If you need to verify which keystore is currently configured, you can check:

```bash
# Check the correct keystore fingerprint
keytool -list -v -keystore "credentials/android/dukaaon_upload_new.jks" | findstr /i "SHA1"

# Should output:
# SHA1: 61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88
```

## Troubleshooting

### If credentials update fails:
1. Make sure you have the keystore password
2. Verify the keystore file exists at `credentials/android/dukaaon_upload_new.jks`
3. Check that the alias name is correct: `dukaaon_upload`

### If build still uses wrong keystore:
1. Clear EAS build cache: `eas build --platform android --profile production --clear-cache`
2. Make sure you selected the **production** profile when updating credentials
3. Verify credentials again with `eas credentials`

## Important Notes

- **Never commit keystore files to version control** (they should be in `.gitignore`)
- **Keep keystore passwords secure** - store them in a password manager
- **Backup your keystore** - losing it means you can't update your app on Google Play
- The keystore `nithinv1608_dukaaon.jks` in the root directory has a different SHA1 and should not be used for production builds

## Related Files

- Keystore: `credentials/android/dukaaon_upload_new.jks`
- Documentation: `credentials/android/NEW_KEYSTORE_DOCUMENTATION.md`
- EAS Config: `eas.json`

