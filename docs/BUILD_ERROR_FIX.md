# Build Error Fix: Plugin Conflict Resolution

## Error
```
Failed to apply plugin 'com.android.internal.library'.
> 'com.android.library' and 'com.android.application' plugins cannot be applied in the same project.
```

## Root Cause
The error occurs because Expo's autolinking script is trying to apply `com.android.library` plugin to the `:app` project, which already has `com.android.application` plugin applied.

## Fixes Applied

### 1. Fixed Plugin Application in Gradle Scripts ✅
**Files Fixed**:
- `absolute-exclusions.gradle`
- `final-conflict-resolver.gradle`

**Problem**: These configuration scripts had `apply plugin: 'com.android.application'` which was unnecessary and could cause conflicts.

**Solution**: Removed plugin application from these scripts since they are configuration-only and should not apply plugins. The target project must already have the plugin applied.

---

## Additional Troubleshooting Steps

### 1. Clean Build
```bash
cd android
./gradlew clean
```

### 2. Clear Expo Cache
```bash
npx expo start --clear
```

### 3. Rebuild
```bash
cd android
./gradlew assembleDebug
```

### 4. If Error Persists

Check if any other gradle scripts are applying plugins incorrectly:

```bash
# Search for plugin applications
grep -r "apply plugin" android/
```

### 5. Verify Settings.gradle
Ensure `settings.gradle` is correctly configured and doesn't have conflicting includes.

---

## Prevention

1. **Configuration scripts should NOT apply plugins**
   - Only `build.gradle` files in modules should apply plugins
   - Configuration scripts (like `*-exclusions.gradle`) should only configure existing plugins

2. **Check before applying**
   - If you must apply a plugin conditionally, check if it's already applied:
   ```gradle
   if (!project.plugins.hasPlugin('com.android.application')) {
       apply plugin: 'com.android.application'
   }
   ```

---

## Notes

- The `eas-nuclear-exclusions.gradle` is correctly configured (no plugin application)
- The `android/app/build.gradle` correctly applies `com.android.application`
- The conflict was in the helper scripts that shouldn't apply plugins

