# Duplicate Class Resolution for EAS Cloud Builds

This document outlines the comprehensive solution implemented to resolve the duplicate class conflicts between AndroidX and legacy Android Support Libraries during EAS cloud builds.

## Problem Description

The build was failing with duplicate class errors:
```
Duplicate class android.support.v4.app.INotificationSideChannel found in modules:
- core-1.16.0.aar -> core-1.16.0-runtime (androidx.core:core:1.16.0)
- support-compat-28.0.0.aar -> support-compat-28.0.0-runtime (com.android.support:support-compat:28.0.0)
```

This occurs when both AndroidX libraries and legacy support libraries are present in the dependency tree, causing namespace conflicts.

## Solution Overview

We implemented a multi-layered approach to ensure only AndroidX libraries are used:

### 1. Gradle Build Scripts

#### Created `android/app/eas-build-exclusions.gradle`
- Forces specific AndroidX versions (androidx.core:core:1.16.0, androidx.versionedparcelable:versionedparcelable:1.1.1)
- Excludes ALL legacy support libraries from all configurations
- Implements dependency resolution strategy to replace legacy libraries with AndroidX equivalents
- Includes packaging options to handle native library conflicts
- Adds verification task to ensure no legacy support libraries are included

#### Updated `android/app/build.gradle`
- Added comprehensive exclusions for legacy support libraries
- Forced specific AndroidX versions in dependencies block
- Enhanced packaging options to exclude problematic META-INF files

#### Updated `android/build.gradle`
- Added global resolution strategy to force AndroidX versions
- Implemented project-wide exclusions for com.android.support group

### 2. EAS Build Configuration

#### Updated `eas.json`
- Added environment variables to force AndroidX usage
- Disabled Jetifier (ANDROID_ENABLE_JETIFIER=false) since we're using pure AndroidX
- Added specific version forcing for core AndroidX libraries
- Enhanced Gradle options for better memory management

#### Updated `app.config.js`
- Added `eas-build-exclusions.gradle` to both `applyScript` and `gradleScriptPaths`
- Enhanced gradle properties with exclusion settings
- Configured packaging options to exclude legacy support libraries

### 3. Metro Configuration

#### Updated `metro.config.js`
- Enhanced resolver to exclude com.android.support modules during bundling
- Added comprehensive exclusions for support library modules
- Prevents problematic modules from being included in the bundle

### 4. Build Preparation Script

#### Enhanced `prepare-for-eas.js`
- Added dependency conflict checking
- Gradle exclusion script verification
- EAS configuration validation
- Comprehensive pre-build validation

## Key Configuration Changes

### Environment Variables (EAS)
```json
{
  "ANDROID_USE_ANDROIDX": "true",
  "ANDROID_ENABLE_JETIFIER": "false",
  "ANDROID_FORCE_ANDROIDX_CORE_VERSION": "1.16.0",
  "ANDROID_FORCE_ANDROIDX_VERSIONEDPARCELABLE_VERSION": "1.1.1",
  "ANDROID_EXCLUDE_LEGACY_SUPPORT": "true",
  "ANDROID_DISABLE_LEGACY_SUPPORT_LIBRARIES": "true"
}
```

### Forced Dependencies
```gradle
resolutionStrategy {
    force 'androidx.core:core:1.16.0'
    force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
}
```

### Exclusions
```gradle
configurations.all {
    exclude group: 'com.android.support', module: 'support-compat'
    exclude group: 'com.android.support', module: 'support-v4'
    exclude group: 'com.android.support', module: 'versionedparcelable'
    // ... and many more
}
```

## Verification

The solution includes multiple verification layers:

1. **Pre-build validation** via `prepare-for-eas.js`
2. **Gradle task verification** to ensure no legacy libraries are included
3. **EAS environment validation** to confirm proper configuration
4. **Metro bundler exclusions** to prevent problematic modules

## Testing

To test the solution:

1. Run the preparation script:
   ```bash
   node prepare-for-eas.js
   ```

2. Verify local build:
   ```bash
   cd android && .\gradlew clean && .\gradlew assembleDebug
   ```

3. Submit EAS build:
   ```bash
   eas build --platform android --profile production
   ```

## Expected Results

- ✅ No duplicate class errors
- ✅ Only AndroidX libraries in the final build
- ✅ Consistent dependency versions
- ✅ Successful EAS cloud builds
- ✅ Proper namespace isolation

## Troubleshooting

If issues persist:

1. Check that all Gradle scripts are properly applied
2. Verify EAS environment variables are set correctly
3. Ensure no dependencies are explicitly requiring legacy support libraries
4. Run the preparation script to validate configuration
5. Check the build logs for any remaining legacy library references

## Files Modified

- `android/app/eas-build-exclusions.gradle` (created)
- `android/app/build.gradle` (updated)
- `android/build.gradle` (updated)
- `eas.json` (updated)
- `app.config.js` (updated)
- `metro.config.js` (already had some exclusions)
- `prepare-for-eas.js` (enhanced)

This comprehensive solution ensures that EAS cloud builds will not encounter duplicate class conflicts between AndroidX and legacy support libraries.