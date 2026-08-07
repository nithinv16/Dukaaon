# Expo Autolinking Plugin Conflict - Summary & Solution

## Error
```
Failed to apply plugin 'com.android.internal.library'.
> 'com.android.library' and 'com.android.application' plugins cannot be applied in the same project.
```

**Location**: `node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle` line 333/347

## Root Cause
Expo's autolinking script applies ALL module plugins to ALL projects that have the `com.android.application` plugin. One or more Expo modules declare `com.android.library` plugin, and the autolinking script tries to apply it to the `:app` module, causing a conflict.

## Attempted Fixes

### ✅ Fix 1: Removed Plugin Applications from Config Scripts
- Removed `apply plugin: 'com.android.application'` from `absolute-exclusions.gradle`
- Removed `apply plugin: 'com.android.application'` from `final-conflict-resolver.gradle`

### ✅ Fix 2: Commented Out applyScript
- Temporarily disabled `applyScript` in `app.config.js`

### ❌ Fix 3-6: Multiple Interception Attempts
- Tried intercepting plugin application at various points
- Added guards in `android/app/build.gradle` and `android/build.gradle`
- Issue: Expo autolinking applies plugins directly during configuration phase, bypassing interceptors

### ❌ Fix 7: Direct Patch to Autolinking Script
- Modified `node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle`
- Added checks to skip library plugins for app module
- Issue: Checks aren't catching the plugin application - may be timing issue or different code path

## Recommended Solution

Since direct patching isn't working reliably, use **patch-package** to create a permanent patch:

1. **Install patch-package**:
   ```bash
   npm install --save-dev patch-package postinstall-postinstall
   ```

2. **Update package.json**:
   ```json
   {
     "scripts": {
       "postinstall": "patch-package"
     }
   }
   ```

3. **Apply the fix** to `node_modules/expo-modules-autolinking/scripts/android/autolinking_implementation.gradle`:
   - Add check at line 333 to skip library plugins for app module
   - Or change the logic to not apply plugins to projects that already have application plugin

4. **Create the patch**:
   ```bash
   npx patch-package expo-modules-autolinking
   ```

## Alternative Solutions

### Option 1: Use Community Autolinking
```bash
$env:EXPO_USE_COMMUNITY_AUTOLINKING="1"
cd android
./gradlew clean
```

### Option 2: Identify and Exclude Problematic Module
Find which Expo module is declaring the library plugin and exclude it from autolinking.

### Option 3: Upgrade/Downgrade Expo SDK
This might be a known bug in Expo SDK 52. Check Expo GitHub issues and consider version change.

### Option 4: Report Bug to Expo
If this is a bug in Expo SDK 52, report it to Expo team with full stack trace.

## Current Status
- Build is blocked
- Direct patch attempts have failed
- Need to use patch-package for permanent fix or try alternative solutions








