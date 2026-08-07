# Dependency Optimization Plan

## Removable Dependencies

### 1. ✅ Duplicate Slider Library
- **Remove**: `@miblanchard/react-native-slider` (^2.6.0)
- **Keep**: `@react-native-community/slider` (4.5.5)
- **Reason**: Only `@react-native-community/slider` is used in the codebase
- **Size Savings**: ~500 KB

### 2. ✅ Unused Google Cloud Vision SDK
- **Remove**: `@google-cloud/vision` (^5.2.0)
- **Reason**: The app uses REST API calls (fetch) instead of the SDK
- **Evidence**: `services/googleCloud/visionOCRService.ts` uses fetch, not SDK imports
- **Size Savings**: ~3-5 MB

### 3. ✅ Unused Database Client
- **Remove**: `pg` (^8.16.3) and `@types/pg` (^8.15.5)
- **Reason**: PostgreSQL client should only be in backend, not React Native app
- **Size Savings**: ~2-3 MB

### 4. ✅ Unused Web Dependencies
- **Remove**: `react-dom` (18.3.1)
- **Reason**: Not needed for React Native (only for web builds)
- **Note**: Keep if you plan to support web platform
- **Size Savings**: ~1-2 MB

### 5. ✅ Next.js (Removed)
- **Removed**: `next` (^15.5.4)
- **Reason**: Only used in backend files (`pages/api/`, `middleware/`), not in React Native app code
- **Note**: Expo handles web builds, not Next.js. If you have a separate Next.js website, it should have its own package.json
- **Size Savings**: ~10-15 MB

### 6. ✅ Google Auth Library (Removed)
- **Removed**: `google-auth-library` (^10.1.0)
- **Reason**: Not used in React Native app code. Google Cloud Vision uses REST API with API key, not OAuth
- **Size Savings**: ~1-2 MB

## Deprecated Code to Remove

### 1. ✅ Deprecated Auth Modules
- **Files**: 
  - `utils/authSync.ts` (marked deprecated)
  - `services/auth/AuthStateManager.ts` (marked deprecated)
- **Status**: Not imported anywhere in the codebase
- **Action**: Safe to delete
- **Size Savings**: Minimal (code only, but improves maintainability)

## Heavy Dependencies to Consider

### 1. AWS SDK
- **Package**: `@aws-sdk/client-bedrock-runtime` (^3.901.0)
- **Size**: ~5-10 MB
- **Status**: Already using dynamic imports (good!)
- **Recommendation**: Consider moving to backend API if possible
- **Alternative**: Keep as-is (already optimized with dynamic imports)

### 2. Azure SDKs
- **Packages**: 
  - `@azure/identity` (^4.11.1) - ~1-2 MB
  - `microsoft-cognitiveservices-speech-sdk` (^1.45.0) - ~2-3 MB
- **Status**: Used for AI features
- **Recommendation**: Keep if essential, or move to backend

### 3. Sentry
- **Package**: `@sentry/react-native` (~6.10.0)
- **Size**: ~2-3 MB
- **Status**: Important for error tracking
- **Recommendation**: Keep (essential for production)

## Total Estimated Savings

**Completed Removals**:
- ✅ Duplicate slider: ~500 KB
- ✅ Google Cloud Vision SDK: ~3-5 MB
- ✅ pg + types: ~2-3 MB
- ✅ react-dom: ~1-2 MB
- ✅ Next.js: ~10-15 MB
- ✅ google-auth-library: ~1-2 MB
- **Total: ~18-27 MB reduction**

## Implementation Steps

1. ✅ Remove duplicate slider library
2. ✅ Remove unused Google Cloud Vision SDK
3. ✅ Remove pg and @types/pg
4. ⚠️ Verify and remove react-dom (if not building web)
5. ⚠️ Verify and remove Next.js (if backend-only)
6. ✅ Remove deprecated code files
7. Test build to ensure nothing breaks

