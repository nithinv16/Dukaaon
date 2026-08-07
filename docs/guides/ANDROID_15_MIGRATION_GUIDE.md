# Android 15 Migration Guide

This guide addresses the Google Play Console recommendations for Android 15 (API 35) compatibility.

## Issues Addressed

### 1. Edge-to-Edge Display Compatibility

**Issue**: Apps targeting SDK 35 will display edge-to-edge by default on Android 15.

**Solution**: 
- ✅ Already implemented `useEdgeToEdge` hook in `utils/android15EdgeToEdge.tsx`
- ✅ Configured `enableEdgeToEdge=true` in `gradle.properties`
- ✅ Added manifest placeholder `enableEdgeToEdge: "true"` in `app.config.js`
- ✅ Using `react-native-safe-area-context` for proper inset handling

### 2. Deprecated APIs Migration

**Issue**: App uses deprecated window APIs:
- `android.view.Window.getStatusBarColor`
- `android.view.Window.setStatusBarColor` 
- `android.view.Window.setNavigationBarColor`

**Root Cause**: These are called by React Native's StatusBar module and third-party libraries:
- `com.facebook.react.modules.statusbar.StatusBarModule`
- `com.google.android.material.internal.d.a`

**Solution**:
- ✅ Replaced with `StatusBar.setTranslucent(true)` and `StatusBar.setBackgroundColor('transparent')`
- ✅ Using system navigation bar theming instead of direct color setting
- ✅ Implemented proper edge-to-edge handling in `android15EdgeToEdge.tsx`

### 3. 16KB Native Library Alignment

**Issue**: Native libraries not aligned for 16KB memory page sizes.

**Solution**:
- ✅ Added `android.bundle.enableUncompressedNativeLibs=false` in `gradle.properties`
- ✅ Enabled `enableSeparateBuildPerCPUArchitecture=true` for optimized builds
- ✅ Set `extractNativeLibs=false` in Android manifest via plugin
- ✅ Using build tools version 35.0.0 with proper alignment

## Implementation Details

### Edge-to-Edge Configuration

```javascript
// app.config.js
android: {
  compileSdkVersion: 35,
  targetSdkVersion: 35,
  manifestPlaceholders: {
    enableEdgeToEdge: "true"
  }
}
```

### Safe Area Handling

```typescript
// Usage in components
import { useEdgeToEdge, getSafeAreaStyles } from '../utils/android15EdgeToEdge';

const MyComponent = () => {
  const { insets } = useEdgeToEdge({
    statusBarStyle: 'dark-content',
    enableEdgeToEdge: true
  });
  
  return (
    <View style={getSafeAreaStyles(insets)}>
      {/* Content */}
    </View>
  );
};
```

### Native Library Optimization

```properties
# gradle.properties
android.bundle.enableUncompressedNativeLibs=false
android.enableSeparateBuildPerCPUArchitecture=true
android.enableEdgeToEdge=true
```

## Testing Recommendations

1. **Edge-to-Edge Testing**:
   - Test on devices with different screen sizes and cutouts
   - Verify content doesn't overlap with system UI
   - Check both portrait and landscape orientations

2. **16KB Page Size Testing**:
   - Test on devices with 16KB page sizes (if available)
   - Monitor app startup performance
   - Check for any native library loading issues

3. **API Compatibility Testing**:
   - Test status bar and navigation bar theming
   - Verify no crashes related to deprecated API usage
   - Check system UI integration

## Migration Checklist

- [x] Update target SDK to 35
- [x] Enable edge-to-edge display
- [x] Implement safe area handling
- [x] Configure 16KB page size support
- [x] Remove deprecated API usage
- [x] Update build configuration
- [x] Add Android 15 compatibility plugin
- [ ] Test on Android 15 devices
- [ ] Test edge-to-edge on various screen sizes
- [ ] Performance testing with 16KB page sizes

## Known Limitations

1. **Third-party Libraries**: Some libraries may still use deprecated APIs internally
2. **React Native Core**: StatusBar module may trigger warnings until React Native updates
3. **Material Design**: Google Material components may use deprecated APIs

## Future Considerations

- Monitor React Native updates for deprecated API fixes
- Update third-party libraries when Android 15 compatible versions are available
- Consider migrating to newer Android theming APIs when available

## Resources

- [Android 15 Edge-to-Edge Guide](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [16KB Page Size Support](https://developer.android.com/guide/practices/page-sizes)
- [Deprecated API Migration](https://developer.android.com/about/versions/15/migration)