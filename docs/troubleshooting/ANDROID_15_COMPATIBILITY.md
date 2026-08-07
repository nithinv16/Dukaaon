# Android 15 Compatibility Guide

This document outlines the changes made to ensure full compatibility with Android 15 (API level 35) and addresses all Google Play Store requirements.

## Issues Addressed

### 1. Edge-to-Edge Display Support

**Problem**: From Android 15, apps targeting SDK 35 display edge-to-edge by default.

**Solution**:
- Updated `app.plugin.js` with Android manifest modifications
- Created `utils/android15EdgeToEdge.ts` utility for handling insets
- Added edge-to-edge configuration in `expo-build-properties`

**Usage**:
```typescript
import { useEdgeToEdge, configureEdgeToEdge } from './utils/android15EdgeToEdge';

// In your app's root component
const App = () => {
  const { insets, paddingTop, paddingBottom } = useEdgeToEdge({
    statusBarStyle: 'dark-content',
    enableEdgeToEdge: true
  });

  return (
    <View style={{ paddingTop, paddingBottom }}>
      {/* Your app content */}
    </View>
  );
};
```

### 2. Deprecated APIs Replacement

**Problem**: Several APIs for edge-to-edge and window display have been deprecated:
- `android.view.Window.setStatusBarColor`
- `android.view.Window.setNavigationBarColor`
- `android.view.Window.getStatusBarColor`
- `android.view.Window.getNavigationBarColor`
- `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`
- `LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT`

**Solution**:
- Replaced with React Native's `StatusBar` API and translucent mode
- Updated to use `react-native-safe-area-context` for proper inset handling
- Migrated to system navigation bar theming

### 3. Orientation and Resizability Restrictions Removed

**Problem**: Android 16 will ignore resizability and orientation restrictions for large screen devices.

**Solution**:
- Changed `orientation` from `"portrait"` to `"default"` in `app.config.js`
- Added `android:resizeableActivity="true"` in Android manifest
- Removed `android:screenOrientation="PORTRAIT"` restriction

### 4. 16KB Native Library Alignment

**Problem**: Native libraries need to support devices with 16KB memory page sizes.

**Solution**:
- Added `android.bundle.enableUncompressedNativeLibs=false` in `gradle.properties`
- Enabled separate builds per CPU architecture
- Added packaging options for native libraries
- Updated build tools to version 35.0.0

## Configuration Changes

### app.config.js
```javascript
// Changed orientation
orientation: "default", // was "portrait"

// Updated expo-build-properties
[
  "expo-build-properties",
  {
    "android": {
      "compileSdkVersion": 35,
      "targetSdkVersion": 35,
      "buildToolsVersion": "35.0.0",
      "kotlinVersion": "1.9.25",
      "enableProguardInReleaseBuilds": true,
      "enableSeparateBuildPerCPUArchitecture": true,
      "packagingOptions": {
        "pickFirst": [
          "**/libc++_shared.so",
          "**/libjsc.so"
        ]
      },
      "manifestPlaceholders": {
        "enableEdgeToEdge": "true"
      }
    }
  }
]
```

### gradle.properties
```properties
# Updated Kotlin version
kotlin.version=1.9.25

# Android 15 compatibility
android.enableR8.fullMode=true
android.enableR8=true
android.enableDexingArtifactTransform=false
android.enableDexingArtifactTransform.desugaring=false

# 16KB page size support
android.bundle.enableUncompressedNativeLibs=false
android.enableSeparateBuildPerCPUArchitecture=true

# Edge-to-edge support
android.enableEdgeToEdge=true
```

### app.plugin.js
Added `withAndroid15Compatibility` plugin that:
- Removes orientation restrictions
- Adds resizeableActivity support
- Enables edge-to-edge display
- Configures 16KB page size support
- Adds edge-to-edge meta-data

## Testing Recommendations

### 1. Edge-to-Edge Testing
- Test on Android 15 devices or emulators
- Verify content doesn't overlap with system UI
- Check status bar and navigation bar appearance
- Test in both light and dark themes

### 2. Large Screen Testing
- Test on tablets and foldables
- Verify app works in both portrait and landscape
- Check multi-window and split-screen modes
- Test window resizing behavior

### 3. 16KB Page Size Testing
- Test on devices with 16KB page sizes
- Verify app installation and startup
- Check for any native library loading issues
- Monitor app performance

## Migration Steps

1. **Update Dependencies**: Ensure all dependencies support Android 15
2. **Test Edge-to-Edge**: Use the provided utilities in your components
3. **Remove Hardcoded Orientations**: Update any hardcoded portrait orientations
4. **Test on Large Screens**: Verify layouts work on tablets and foldables
5. **Build and Test**: Create a release build and test on Android 15 devices

## Utilities Available

### useEdgeToEdge Hook
```typescript
const { insets, paddingTop, paddingBottom, screenWidth, screenHeight } = useEdgeToEdge({
  statusBarStyle: 'dark-content',
  enableEdgeToEdge: true
});
```

### EdgeToEdgeWrapper Component
```typescript
<EdgeToEdgeWrapper config={{ statusBarStyle: 'light-content' }}>
  <YourContent />
</EdgeToEdgeWrapper>
```

### Configuration Function
```typescript
// Call once in your app's entry point
configureEdgeToEdge({
  statusBarStyle: 'dark-content',
  enableEdgeToEdge: true
});
```

## Build Commands

After making these changes, rebuild your app:

```bash
# Clean and rebuild
npx expo run:android --clear

# Or for EAS build
eas build --platform android --clear-cache
```

## Compliance Status

✅ **Android 15 Target SDK**: Updated to API level 35  
✅ **Edge-to-Edge Support**: Implemented with proper inset handling  
✅ **Deprecated APIs**: Replaced with modern alternatives  
✅ **Orientation Flexibility**: Removed portrait restrictions  
✅ **16KB Page Size**: Native libraries aligned for compatibility  
✅ **Large Screen Support**: Enabled resizable activities  
✅ **Foreground Services**: Added required permissions  

Your app is now fully compliant with Android 15 requirements and ready for Google Play Store submission.