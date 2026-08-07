# Implementation Plan

- [ ] 1. Fix Android 15 Google Play Console Issues (Priority: Critical)

  - [ ] 1.1 Update ProGuard rules for deprecated API suppression
    - Add rules to keep AndroidX edge-to-edge classes
    - Add rules to suppress React Native StatusBarModule warnings
    - Add rules to suppress Material Design internal class warnings
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 1.2 Fix MainActivity.kt generation in app.plugin.js
    - Ensure `enableEdgeToEdge()` is called BEFORE `super.onCreate()`
    - Ensure `WindowCompat.setDecorFitsSystemWindows(window, false)` is called
    - Verify imports for `androidx.activity.enableEdgeToEdge` and `androidx.core.view.WindowCompat`
    - _Requirements: 11.2, 11.3, 14.4_

  - [ ] 1.3 Verify and fix 16KB native library alignment
    - Confirm NDK version is 26.1.10909125 or higher in build.gradle
    - Verify `useLegacyPackaging = false` in packagingOptions.jniLibs
    - Verify gradle.properties has `android.enableNativeLibraryAlignment=true`
    - Verify gradle.properties has `android.bundle.nativeLibsAlignment=16384`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 1.4 Update AndroidManifest.xml meta-data
    - Add edge-to-edge compatibility meta-data tags
    - Verify `android:enableOnBackInvokedCallback="true"` is set
    - _Requirements: 11.1, 14.5_

  - [ ] 1.5 Verify SDK and build tools versions
    - Confirm targetSdkVersion = 35
    - Confirm compileSdkVersion = 35
    - Confirm buildToolsVersion = 35.0.0
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 2. Checkpoint - Build and verify Android 15 fixes
  - Ensure all tests pass, ask the user if questions arise.
  - Build release APK/AAB and verify no Google Play Console warnings

- [x] 3. Create Centralized Logging Service

  - [x] 3.1 Create LoggingService with environment-aware filtering
    - Create `services/logging/LoggingService.ts`
    - Implement log levels: debug, info, warn, error, none
    - Suppress debug/info logs in production mode
    - Integrate with Sentry for error reporting
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Write property test for production logging suppression
    - **Property 1: Production Logging Suppression**
    - **Validates: Requirements 2.1**

  - [x] 3.3 Replace console.log calls with LoggingService
    - Update high-traffic files: store/auth.ts, services/auth/profileLoader.ts
    - Update service files to use LoggingService
    - Keep console.error for actual errors
    - _Requirements: 2.1, 2.3_

- [x] 4. Consolidate Redundant Service Files

  - [x] 4.1 Remove services/SupabaseService.js
    - Identify all imports of SupabaseService.js
    - Update imports to use services/supabase/supabase.ts
    - Remove the redundant file
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 4.2 Consolidate speech service usage
    - Ensure all speech functionality uses services/speechService.ts
    - Update any direct imports of azureAI/speechService.ts
    - _Requirements: 1.2_

  - [x] 4.3 Remove duplicate utility functions
    - Identify duplicate functions across files
    - Consolidate into shared utility modules
    - _Requirements: 1.3_

- [x] 5. Optimize Navigation and Screen Loading

  - [x] 5.1 Reduce navigation redirect chains
    - Analyze current navigation flow from index.tsx to home
    - Remove unnecessary intermediate screens (app/home.tsx)
    - Consolidate navigation logic in app/index.tsx
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Write property test for navigation redirect minimization
    - **Property 2: Navigation Redirect Minimization**
    - **Validates: Requirements 5.1**

  - [x] 5.3 Prevent redundant data fetches
    - Add state checks before triggering fetches in components
    - Use existing DataFetchCoordinator to prevent duplicate fetches
    - _Requirements: 5.2, 5.3_

  - [x] 5.4 Write property test for data fetch deduplication
    - **Property 3: Data Fetch Deduplication**
    - **Validates: Requirements 5.2**

- [x] 6. Optimize Auth Store Initialization

  - [x] 6.1 Remove redundant session checks
    - Audit initializeAuth function in store/auth.ts
    - Remove commented-out code and dead code paths
    - Ensure single coordinated initialization flow
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Write property test for auth initialization efficiency
    - **Property 4: Auth Initialization Efficiency**
    - **Validates: Requirements 7.1**

  - [x] 6.3 Batch state updates to prevent re-renders
    - Identify multiple sequential setState calls
    - Combine into single state updates where possible
    - _Requirements: 7.5_

- [ ] 7. Checkpoint - Verify performance optimizations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Clean Up Test and Debug Files

  - [x] 8.1 Move test files from app directory
    - Move app/(main)/test.tsx to tests/integration/
    - Move app/(main)/test-notifications.tsx to tests/integration/
    - Move app/(main)/test-translation.tsx to tests/integration/
    - _Requirements: 3.1_

  - [x] 8.2 Ensure debug components are excluded from production
    - Verify components/debug/ is not imported in production code
    - Verify components/dev/ is not imported in production code
    - Add __DEV__ guards if needed
    - _Requirements: 3.2, 3.5_

  - [x] 8.3 Move SQL files to proper location
    - Move app/(auth)/handle_firebase_auth.sql to sql/
    - _Requirements: 3.3_

  - [x] 8.4 Remove sample/backup files
    - Remove app/(main)/auth sample
    - _Requirements: 3.4_

- [x] 9. Consolidate Polyfill Files

  - [x] 9.1 Create polyfills directory
    - Create polyfills/ directory
    - Move services/crypto-polyfill.js to polyfills/
    - Move services/events-polyfill.js to polyfills/
    - Move services/stream-polyfill.js to polyfills/
    - _Requirements: 4.1, 4.4_

  - [x] 9.2 Update global-setup.js imports
    - Update imports to use new polyfills/ location
    - Ensure correct loading order
    - _Requirements: 4.3, 4.5_

- [x] 10. Clean Up Empty Directories

  - [x] 10.1 Remove or document empty directories
    - Check services/orders/, services/payment/, services/storage/
    - Either add README.md explaining purpose or remove
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 11. Standardize Error Handling

  - [x] 11.1 Create ServiceError class
    - Create services/errors/ServiceError.ts
    - Implement AppError interface
    - Include code, message, userMessage, originalError, context
    - _Requirements: 9.1, 9.4_

  - [x] 11.2 Update services to use standardized errors
    - Update key services to throw ServiceError
    - Ensure errors are logged through LoggingService
    - Ensure errors are reported to Sentry
    - _Requirements: 9.2, 9.3, 9.5_

- [ ] 12. Organize Documentation Files

  - [ ] 12.1 Create docs directory structure
    - Create docs/architecture/
    - Create docs/guides/
    - Create docs/troubleshooting/
    - _Requirements: 10.1_

  - [ ] 12.2 Move and organize markdown files
    - Move relevant .md files from root to docs/
    - Archive completed fix guides
    - Update or remove outdated documentation
    - _Requirements: 10.2, 10.4, 10.5_

  - [ ] 12.3 Consolidate SQL files
    - Ensure all SQL files are in sql/ or supabase/migrations/
    - Remove duplicates
    - _Requirements: 10.3_

- [ ] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify bundle size reduction
  - Verify no Google Play Console warnings
