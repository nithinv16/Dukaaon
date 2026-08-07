# Building AAB Locally for Google Play

## Quick Start

After configuring the correct keystore, build your release AAB:

```bash
cd android
./gradlew bundleRelease
```

The AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

## Configuration

The build is configured to use:
- **Keystore**: `credentials/android/dukaaon_upload_new.jks`
- **Alias**: `dukaaon_upload`
- **SHA1**: `61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88`

Passwords are stored in `gradle.properties`:
- `KEYSTORE_PASSWORD`
- `KEY_PASSWORD`

## Verify Signature

Before uploading, verify the AAB is signed correctly:

### Option 1: Using keytool
```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

Look for the SHA1 fingerprint - it should match:
```
SHA1: 61:34:1A:D2:C2:E9:84:68:D4:2B:90:86:BE:A9:D1:F4:32:75:1B:88
```

### Option 2: Using jarsigner
```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

## Troubleshooting

### Build fails with "keystore not found"
- Verify the keystore exists at: `credentials/android/dukaaon_upload_new.jks`
- Check the path in `android/app/build.gradle` (should be `../../credentials/android/dukaaon_upload_new.jks`)

### Build fails with "password incorrect"
- Check `gradle.properties` for `KEYSTORE_PASSWORD` and `KEY_PASSWORD`
- Verify the passwords match the keystore

### Wrong signature after build
- Make sure you're building `bundleRelease` (not `assembleRelease`)
- Clean and rebuild: `./gradlew clean bundleRelease`
- Verify the signing config in `android/app/build.gradle` uses `signingConfigs.release`

## Clean Build

If you need a clean build:

```bash
cd android
./gradlew clean
./gradlew bundleRelease
```


