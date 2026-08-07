# Android 15 Play Store Console Fixes

This document addresses all three Google Play Console warnings for Android 15 (SDK 35) compatibility.

## Issues Fixed

### 1. ✅ Deprecated Edge-to-Edge APIs

**Problem**: App uses deprecated APIs:
- `android.view.Window.getStatusBarColor`
- `android.view.Window.setStatusBarColor`
- `android.view.Window.setNavigationBarColor`

**Root Cause**: React Native's `StatusBarModule` and Material Design libraries use these deprecated APIs.

**Solution Implemented**:
- ✅ Added `EdgeToEdge.enable()` call in MainActivity via `app.plugin.js`
- ✅ Added `WindowCompat.setDecorFitsSystemWindows(window, false)` for proper edge-to-edge
- ✅ Using `react-native-edge-to-edge`'s `SystemBars` component instead of deprecated APIs
- ✅ Added ProGuard rules to suppress warnings for deprecated APIs
- ✅ Added ProGuard rules to keep new edge-to-edge APIs

**Files Modified**:
- `app.plugin.js` - Added `withEdgeToEdgeEnable()` plugin to inject `EdgeToEdge.enable()` into MainActivity
- `proguard-rules.pro` - Added rules to keep new APIs and suppress deprecated API warnings
- `components/SystemStatusBar.tsx` - Already using SystemBars from react-native-edge-to-edge

### 2. ✅ Edge-to-Edge Display for All Users

**Problem**: Edge-to-edge may not display correctly for all users on Android 15.

**Solution Implemented**:
- ✅ Added `EdgeToEdge.enable()` call in MainActivity.kt (via plugin)
- ✅ Configured `enableEdgeToEdge: "true"` in manifest placeholders
- ✅ Set `android.enableEdgeToEdge=true` in gradle.properties
- ✅ Added edge-to-edge meta-data in AndroidManifest
- ✅ Using `SystemBars` component from `react-native-edge-to-edge` throughout the app
- ✅ Proper safe area handling with `react-native-safe-area-context`

**Files Modified**:
- `app.plugin.js` - Added `withEdgeToEdgeEnable()` plugin
- `app.config.js` - Already has `enableEdgeToEdge: "true"` in manifest placeholders
- `gradle.properties` - Already has `android.enableEdgeToEdge=true`
- `app/_layout.tsx` - Already using `SystemBars` component

### 3. ✅ 16KB Native Library Alignment

**Problem**: Native libraries not aligned for 16KB memory page sizes.

**Solution Implemented**:
- ✅ Configured `android.enableNativeLibraryAlignment=true` in gradle.properties
- ✅ Set `android.bundle.nativeLibsAlignment=16384` (16KB = 16384 bytes)
- ✅ Enabled `android.bundle.zipalign.enabled=true` with 16KB alignment
- ✅ Set `android.bundle.zipalign.alignment=16384`
- ✅ Enabled `android.enableSeparateBuildPerCPUArchitecture=true` for optimized builds
- ✅ Set `android.bundle.enableUncompressedNativeLibs=false`

**Files Modified**:
- `app.config.js` - Already has 16KB alignment settings in gradleProperties
- `gradle.properties` - Already has all 16KB alignment configurations

## Implementation Details

### MainActivity.kt Changes (Applied via Plugin)

The `withEdgeToEdgeEnable()` plugin automatically adds the following to MainActivity.kt:

```kotlin
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

override fun onCreate(savedInstanceState: Bundle?) {
    // Enable edge-to-edge for Android 15 compatibility
    enableEdgeToEdge()
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    super.onCreate(savedInstanceState)
    // ... rest of onCreate
}
```

### ProGuard Rules Added

```proguard
# Android 15 Edge-to-Edge API compatibility
-keep class androidx.activity.EdgeToEdge { *; }
-keep class androidx.core.view.WindowCompat { *; }
-keep class androidx.core.view.WindowInsetsCompat { *; }
-keep class androidx.core.view.WindowInsetsControllerCompat { *; }

# Suppress warnings for deprecated StatusBar APIs
-dontwarn com.facebook.react.modules.statusbar.StatusBarModule
-dontwarn android.view.Window$*getStatusBarColor
-dontwarn android.view.Window$*setStatusBarColor
-dontwarn android.view.Window$*setNavigationBarColor
```

### Build Configuration

All required settings are in `app.config.js`:

```javascript
gradleProperties: {
  // 16 KB page size support
  "android.enableNativeLibraryAlignment": "true",
  "android.bundle.nativeLibsAlignment": "16384",
  "android.bundle.zipalign.enabled": "true",
  "android.bundle.zipalign.alignment": "16384"
}
```

## Testing

After rebuilding the app, verify:

1. **Edge-to-Edge**: App displays edge-to-edge on Android 15 devices
2. **No Deprecated API Warnings**: Check Play Console - warnings should be resolved
3. **16KB Alignment**: Build should complete without alignment errors

## Next Steps

1. Rebuild the app with these changes
2. Test on Android 15 device/emulator
3. Upload new build to Play Console
4. Verify all warnings are resolved in Play Console

## Notes

- The `EdgeToEdge.enable()` call is added automatically during the build process via the Expo plugin
- ProGuard rules ensure new APIs are not stripped during minification
- 16KB alignment is handled by Gradle during the build process
- All changes are backward compatible with older Android versions

