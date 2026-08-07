# 16 KB Page Size Support Implementation

## Overview
This document outlines the changes made to support 16 KB memory page sizes, which is required for Google Play compatibility starting November 1, 2025, for apps targeting Android 15+ (API level 35+).

## Reference
- [Android Developer Guide: Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes#build)

## Changes Made

### 1. `gradle.properties`
Added/updated the following properties for 16 KB page size support:
- `android.enableNativeLibraryAlignment=true` - Enables native library alignment
- `android.bundle.nativeLibsAlignment=16384` - Sets native library alignment to 16 KB (16384 bytes)
- `android.bundle.zipalign.enabled=true` - Enables zipalign for bundles
- `android.bundle.zipalign.alignment=16384` - Sets zipalign alignment to 16 KB

### 2. `android/app/build.gradle`
- Updated `packagingOptions` to ensure native libraries are properly aligned
- Added verification task `verify16KbAlignment` that runs after package tasks
- Added comments documenting 16 KB page size support requirements

### 3. `android/build.gradle`
- Added comment confirming NDK version 26.1.10909125 supports 16 KB page sizes
- NDK r26+ includes necessary toolchain updates for 16 KB alignment

### 4. `app.config.js`
Updated `expo-build-properties` plugin configuration with:
- `android.enableNativeLibraryAlignment: "true"`
- `android.bundle.nativeLibsAlignment: "16384"`
- `android.bundle.zipalign.enabled: "true"`
- `android.bundle.zipalign.alignment: "16384"`

## How It Works

1. **Native Library Alignment**: The Android Gradle Plugin automatically aligns native libraries (.so files) to 16 KB boundaries when `android.enableNativeLibraryAlignment=true` is set.

2. **APK/AAB Alignment**: The build system automatically zipaligns APK and AAB files with 16 KB alignment when the zipalign properties are configured.

3. **NDK Support**: NDK version 26.1+ includes the necessary toolchain updates to build native libraries compatible with 16 KB page sizes.

## Verification

After building your app, you can verify 16 KB alignment:

### For APK files:
```bash
zipalign -c -v -P 16 4 your-app.apk
```

### For AAB files:
AAB files are automatically aligned during bundle creation. The Android Gradle Plugin handles this when the configuration is set correctly.

### Check device page size:
```bash
adb shell getconf PAGE_SIZE
```
Should return `16384` on devices with 16 KB page sizes.

## Testing

To test your app on a 16 KB device:

1. **Android Emulator**: Use Android 15+ system images with 16 KB page size support
2. **Physical Device**: Some Pixel devices support 16 KB mode via developer options
3. **Samsung Remote Test Lab**: Use Samsung devices that support 16 KB page sizes

## Important Notes

- **Google Play Requirement**: Starting November 1, 2025, all new apps and updates targeting Android 15+ must support 16 KB page sizes
- **Backward Compatibility**: Apps built with 16 KB support will still work on 4 KB page size devices
- **Native Libraries**: If your app uses any NDK libraries (directly or through SDKs), they must be rebuilt with NDK r26+ for 16 KB support

## Next Steps

1. Build a new release with these changes
2. Test the app on a 16 KB device or emulator
3. Verify alignment using the commands above
4. Submit to Google Play Console

## Troubleshooting

If you encounter issues:

1. Ensure all native dependencies are built with NDK r26+
2. Check that `android.enableNativeLibraryAlignment=true` is set in `gradle.properties`
3. Verify your Android Gradle Plugin version is 8.0+ (currently using 8.7.2)
4. Check build logs for any alignment warnings

## Recent Updates (Latest Fix)

The following critical changes were made to ensure 16 KB page size support:

1. **Root `build.gradle`**: Added `ndkVersion = "26.1.10909125"` in the ext block
2. **`android/app/build.gradle`**:
   - Explicitly set `useLegacyPackaging = false` in `packagingOptions.jniLibs` (critical!)
   - Added NDK configuration in `defaultConfig` with ABI filters
   - Added comments documenting 16 KB support requirements
3. **`app.config.js`**: Added `ndkVersion: "26.1.10909125"` to expo-build-properties
4. **`eas-build-config.js`**: Updated to use NDK 26.1+ and SDK 35, added 16 KB alignment properties

### Key Fix: `useLegacyPackaging = false`

The most critical fix was explicitly setting `useLegacyPackaging = false` in the packaging options. Legacy packaging does NOT support 16 KB alignment, which is why Google Play Console was still showing warnings even after other configurations were set.

### Verification Steps

After building your app, verify 16 KB alignment:

```bash
# For APK files
zipalign -c -v -P 16 4 your-app.apk

# For AAB files (check build logs for alignment confirmation)
# The Android Gradle Plugin should automatically align AAB files when configured correctly
```

### Next Steps

1. Clean your build: `cd android && ./gradlew clean`
2. Rebuild your app bundle: `eas build --platform android --profile production`
3. Upload to Google Play Console - the 16 KB warning should be resolved
4. If warnings persist, check that all third-party native libraries are built with NDK 26.1+






