# Autolinking Plugin Conflict Fix

## Error
```
Failed to apply plugin 'com.android.internal.library'.
> 'com.android.library' and 'com.android.application' plugins cannot be applied in the same project.
```

## Root Cause
Expo's autolinking script is trying to apply `com.android.library` plugin to the `:app` project, which already has `com.android.application` plugin applied.

## Solution Applied

### 1. Temporarily Disabled applyScript ✅
**File**: `app.config.js`

**Change**: Commented out `applyScript` and `gradleScriptPaths` that might be causing conflicts:
```javascript
// Temporarily disabled to fix plugin conflict
// "applyScript": [
//   "eas-nuclear-exclusions.gradle"
// ],
// "gradleScriptPaths": [
//   "./android/eas-ultimate-fix.gradle"
// ],
```

### 2. Added Safety Check ✅
**File**: `android/app/build.gradle`

**Change**: Added check to prevent library plugin from being applied:
```gradle
afterEvaluate {
    if (plugins.hasPlugin('com.android.library')) {
        throw new GradleException("CRITICAL: com.android.library plugin cannot be applied to app module!")
    }
}
```

### 3. Cleaned Build Directories ✅
- Removed `android/build/` directory
- Removed `android/.gradle/` directory

---

## Next Steps

1. **Try building again**:
   ```bash
   cd android
   ./gradlew clean
   ./gradlew assembleDebug
   ```

2. **If error persists**, try:
   ```bash
   npx expo prebuild --clean
   ```

3. **Alternative**: Try using community autolinking:
   ```bash
   $env:EXPO_USE_COMMUNITY_AUTOLINKING="1"
   cd android
   ./gradlew clean
   ```

---

## Alternative Solutions

### Option 1: Use Community Autolinking
Set environment variable:
```bash
$env:EXPO_USE_COMMUNITY_AUTOLINKING="1"
```

### Option 2: Regenerate Android Project
```bash
npx expo prebuild --clean --platform android
```

### Option 3: Check Expo/React Native Version Compatibility
The issue might be due to version incompatibility. Check:
- Expo SDK version
- React Native version
- Gradle plugin version

---

## Notes

- The `eas-nuclear-exclusions.gradle` script is safe (doesn't apply plugins)
- The issue is in Expo's autolinking logic, not our scripts
- The safety check will help identify if library plugin is being applied








