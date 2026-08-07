# App Size Optimization Guide

This document outlines the optimizations implemented to reduce the Android app size for better download experience on low-end devices.

## Implemented Optimizations

### 1. Code Shrinking & Minification ✅
- **ProGuard Enabled**: Aggressive code minification with `proguard-android-optimize.txt`
- **Resource Shrinking**: Enabled to remove unused resources
- **Optimization Passes**: Increased to 7 passes for better code reduction
- **Log Removal**: Console logs removed in production builds (except errors/warnings)

**Expected Reduction**: 20-30% of code size

### 2. Architecture Optimization ✅
- **Removed x86/x86_64**: Only ARM architectures (armeabi-v7a, arm64-v8a) are included
- **Rationale**: x86/x86_64 architectures are rarely used on mobile devices (mostly emulators)
- **Separate APKs**: Enabled per-architecture builds for optimal size

**Expected Reduction**: 30-40% of native library size

### 3. Asset Optimization ✅
- **Selective Asset Bundling**: Only essential assets are bundled
- **PNG Crunching**: Enabled to compress PNG images
- **Large Assets**: Consider moving large images to CDN/remote storage

**Expected Reduction**: 10-20% of asset size

### 4. ProGuard Rules Enhancement ✅
- **Aggressive Optimization**: 7 optimization passes
- **Code Repackaging**: Enabled for better compression
- **Log Removal**: Android Log statements removed in release builds

**Expected Reduction**: 5-10% additional code reduction

## Configuration Files Modified

1. **android/app/build.gradle**
   - Enabled `shrinkResources = true`
   - Enabled `minifyEnabled = true`
   - Changed ProGuard file to `proguard-android-optimize.txt`
   - Removed x86/x86_64 from abiFilters

2. **android/gradle.properties**
   - Updated `reactNativeArchitectures` to only ARM
   - Enabled `android.enableShrinkResourcesInReleaseBuilds`

3. **app.config.js**
   - Optimized `assetBundlePatterns` to only include essential assets
   - Enabled resource shrinking

4. **proguard-rules.pro**
   - Increased optimization passes to 7
   - Added log removal rules
   - Enabled aggressive code shrinking

5. **babel.config.js**
   - Added console log removal in production builds

## Expected Total Size Reduction

- **Before**: ~50-80 MB (estimated)
- **After**: ~25-40 MB (estimated)
- **Reduction**: 40-50% smaller app size

## Additional Recommendations

### 1. Dependency Optimization (Future)
Consider reviewing large dependencies:
- `@aws-sdk/client-bedrock-runtime` (~5-10 MB)
- `@google-cloud/vision` (~3-5 MB)
- `microsoft-cognitiveservices-speech-sdk` (~2-3 MB)
- `@azure/identity` (~1-2 MB)

**Options**:
- Use dynamic imports for rarely-used features
- Consider lighter alternatives
- Move heavy SDKs to backend services

### 2. Image Optimization
- Compress all PNG/JPG images in `assets/` folder
- Use WebP format where possible (already enabled)
- Consider lazy loading for category/product images
- Move large images to CDN

### 3. Code Splitting
- Implement lazy loading for screens
- Use dynamic imports for heavy features (AI services, charts)
- Split vendor bundles

### 4. Native Module Optimization
- Review if all Expo modules are necessary
- Consider removing unused native modules
- Use Hermes (already enabled) for smaller JS bundle

## Testing Recommendations

1. **Build Release APK**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

2. **Check APK Size**:
   ```bash
   ls -lh android/app/build/outputs/apk/release/
   ```

3. **Analyze APK**:
   - Use Android Studio's APK Analyzer
   - Check which components take most space
   - Verify ProGuard is working correctly

4. **Test Functionality**:
   - Ensure all features work after optimization
   - Test on low-end devices
   - Verify images load correctly

## Monitoring

After deployment, monitor:
- App download completion rates
- User feedback on app size
- Performance on low-end devices
- Crash rates (ensure ProGuard didn't break anything)

## Rollback Plan

If issues occur:
1. Disable resource shrinking: `shrinkResources = false`
2. Revert ProGuard to `proguard-android.txt`
3. Add back x86 architectures if needed
4. Restore full asset bundle patterns

## Notes

- **Hermes**: Already enabled, which helps with JS bundle size
- **Separate APKs**: Google Play will serve the correct architecture automatically
- **ProGuard**: May require additional keep rules if features break
- **Testing**: Thoroughly test all features after optimization

