# Requirements Document

## Introduction

This specification addresses a comprehensive codebase audit and optimization initiative for the DukaaOn B2B marketplace app. The audit has identified multiple areas requiring attention including redundant code, performance bottlenecks, excessive logging, duplicate services, unused files, and architectural improvements. This document outlines the requirements for systematically addressing these issues to improve app performance, maintainability, and code quality.

## Glossary

- **DukaaOn**: The B2B marketplace mobile application connecting wholesalers/distributors to retailers
- **Redundant Code**: Code that performs the same function as other code in the codebase
- **Dead Code**: Code that is never executed or files that are never imported
- **Console Logging**: Debug statements that output to the console, impacting performance in production
- **Service Layer**: The collection of service classes that handle business logic and data operations
- **Polyfill**: Code that provides modern functionality on older environments
- **Bundle Size**: The total size of the compiled JavaScript code delivered to the app

## Requirements

### Requirement 1: Remove Redundant Service Files

**User Story:** As a developer, I want to eliminate duplicate service implementations, so that the codebase is maintainable and there's a single source of truth for each functionality.

#### Acceptance Criteria

1. WHEN the codebase contains multiple Supabase client implementations THEN the System SHALL consolidate to a single `services/supabase/supabase.ts` file and remove `services/SupabaseService.js`
2. WHEN the codebase contains multiple speech service implementations THEN the System SHALL use `services/speechService.ts` as the unified entry point and deprecate direct usage of `services/azureAI/speechService.ts`
3. WHEN duplicate utility functions exist across files THEN the System SHALL consolidate them into a single shared utility module
4. WHEN a service file imports from another service that re-exports the same functionality THEN the System SHALL import directly from the source
5. WHEN removing redundant files THEN the System SHALL update all import statements across the codebase to use the consolidated modules

### Requirement 2: Optimize Console Logging for Production

**User Story:** As a user, I want the app to perform optimally without unnecessary logging overhead, so that the app runs smoothly on my device.

#### Acceptance Criteria

1. WHEN the app runs in production mode THEN the System SHALL suppress all debug-level console.log statements
2. WHEN implementing logging THEN the System SHALL use a centralized logging service that respects environment settings
3. WHEN error logging is required THEN the System SHALL use console.error only for actual errors that need attention
4. WHEN performance-critical code paths execute THEN the System SHALL not contain any synchronous console operations
5. WHEN the logging service is configured THEN the System SHALL support log levels (debug, info, warn, error) with environment-based filtering

### Requirement 3: Remove Unused Test and Debug Files

**User Story:** As a developer, I want the codebase to contain only necessary files, so that the project is easier to navigate and maintain.

#### Acceptance Criteria

1. WHEN test files exist in the app directory (e.g., `app/(main)/test.tsx`, `app/(main)/test-notifications.tsx`) THEN the System SHALL move them to a dedicated `tests/` directory or remove if unused
2. WHEN debug components exist (e.g., `components/debug/`, `components/dev/`) THEN the System SHALL ensure they are excluded from production builds
3. WHEN SQL files exist in the app directory (e.g., `app/(auth)/handle_firebase_auth.sql`) THEN the System SHALL move them to the `sql/` directory
4. WHEN sample or backup files exist (e.g., `app/(main)/auth sample`) THEN the System SHALL remove them from the codebase
5. WHEN test components exist in `components/test/` THEN the System SHALL ensure they are not imported in production code

### Requirement 4: Consolidate Polyfill and Shim Files

**User Story:** As a developer, I want polyfills to be organized and loaded efficiently, so that the app startup time is minimized.

#### Acceptance Criteria

1. WHEN multiple polyfill files exist in the root directory THEN the System SHALL consolidate them into a single `polyfills/` directory
2. WHEN polyfills are loaded THEN the System SHALL load only the polyfills required for the target platform
3. WHEN the app initializes THEN the System SHALL load polyfills in the correct order before any dependent code
4. WHEN duplicate polyfill implementations exist THEN the System SHALL remove duplicates and use a single implementation
5. WHEN polyfills are consolidated THEN the System SHALL update `global-setup.js` to import from the new location

### Requirement 5: Optimize Navigation and Screen Loading

**User Story:** As a user, I want screens to load quickly when I navigate, so that I have a smooth browsing experience.

#### Acceptance Criteria

1. WHEN the app has multiple redirect screens (e.g., `app/home.tsx`, `app/(main)/index.tsx`) THEN the System SHALL consolidate navigation logic to reduce redirect chains
2. WHEN a screen component mounts THEN the System SHALL not perform redundant data fetches if data is already available in state
3. WHEN navigating between screens THEN the System SHALL use lazy loading for non-critical components
4. WHEN the home screen loads THEN the System SHALL prioritize above-the-fold content rendering
5. WHEN navigation occurs THEN the System SHALL not block the UI thread with synchronous operations

### Requirement 6: Clean Up Empty and Placeholder Directories

**User Story:** As a developer, I want the project structure to be clean and meaningful, so that I can easily understand the codebase organization.

#### Acceptance Criteria

1. WHEN a directory contains no files (e.g., `services/orders/`, `services/payment/`, `services/storage/`) THEN the System SHALL either add placeholder documentation or remove the empty directory
2. WHEN a directory is planned for future use THEN the System SHALL contain a README.md explaining its intended purpose
3. WHEN directories are removed THEN the System SHALL update any configuration files that reference them
4. WHEN the project structure is cleaned THEN the System SHALL maintain consistency with the documented architecture

### Requirement 7: Optimize Auth Store Initialization

**User Story:** As a user, I want the app to start quickly with my session restored, so that I can immediately use the app without waiting.

#### Acceptance Criteria

1. WHEN the auth store initializes THEN the System SHALL not perform redundant session checks if cached auth is valid
2. WHEN multiple auth initialization paths exist THEN the System SHALL use a single coordinated initialization flow
3. WHEN the auth store contains commented-out code THEN the System SHALL remove dead code and document the current approach
4. WHEN session refresh occurs THEN the System SHALL not block the UI while waiting for network response
5. WHEN auth state changes THEN the System SHALL batch state updates to prevent multiple re-renders

### Requirement 8: Reduce Bundle Size

**User Story:** As a user with limited storage, I want the app to be as small as possible, so that it doesn't take up too much space on my device.

#### Acceptance Criteria

1. WHEN the app is built THEN the System SHALL tree-shake unused exports from service files
2. WHEN large dependencies are imported THEN the System SHALL use selective imports instead of importing entire libraries
3. WHEN images are bundled THEN the System SHALL ensure they are optimized for mobile
4. WHEN the app contains duplicate functionality THEN the System SHALL consolidate to reduce code duplication
5. WHEN analyzing bundle size THEN the System SHALL identify and address the largest contributors

### Requirement 9: Standardize Error Handling

**User Story:** As a developer, I want consistent error handling across the app, so that errors are properly caught, logged, and reported.

#### Acceptance Criteria

1. WHEN an error occurs in a service THEN the System SHALL use a standardized error handling pattern
2. WHEN errors are caught THEN the System SHALL log them through the centralized logging service
3. WHEN network errors occur THEN the System SHALL provide user-friendly error messages
4. WHEN async operations fail THEN the System SHALL not leave the app in an inconsistent state
5. WHEN error boundaries catch errors THEN the System SHALL report them to the monitoring service (Sentry)

### Requirement 10: Clean Up Documentation Files

**User Story:** As a developer, I want documentation to be organized and up-to-date, so that I can quickly find relevant information.

#### Acceptance Criteria

1. WHEN multiple markdown files exist in the root directory THEN the System SHALL organize them into a `docs/` subdirectory by category
2. WHEN documentation references outdated code THEN the System SHALL update or remove the documentation
3. WHEN SQL migration files exist outside the `sql/` or `supabase/migrations/` directories THEN the System SHALL consolidate them
4. WHEN README files exist THEN the System SHALL ensure they accurately describe the current state of the code
5. WHEN fix or troubleshooting guides exist THEN the System SHALL archive completed fixes and keep only relevant documentation

### Requirement 11: Fix Android 15 Edge-to-Edge Display Issues (Google Play Console)

**User Story:** As a user on Android 15, I want the app to display correctly edge-to-edge without UI elements being cut off or overlapping system bars, so that I have a proper visual experience.

#### Acceptance Criteria

1. WHEN the app runs on Android 15 (SDK 35) THEN the System SHALL display edge-to-edge by default without content overlapping system bars
2. WHEN the app initializes THEN the System SHALL call `enableEdgeToEdge()` in MainActivity before `super.onCreate()`
3. WHEN content is displayed THEN the System SHALL properly handle window insets using `WindowInsetsCompat` for status bar and navigation bar areas
4. WHEN the app uses `react-native-edge-to-edge` THEN the System SHALL ensure the `SystemBars` component is rendered in the root layout
5. WHEN building for release THEN the System SHALL include ProGuard rules to keep `androidx.activity.EdgeToEdge` and `androidx.core.view.WindowCompat` classes

### Requirement 12: Replace Deprecated Edge-to-Edge APIs (Google Play Console)

**User Story:** As a developer, I want to eliminate deprecated API warnings from Google Play Console, so that the app passes all compliance checks.

#### Acceptance Criteria

1. WHEN the app sets status bar color THEN the System SHALL NOT use `android.view.Window.setStatusBarColor` but instead use `SystemBars` component from `react-native-edge-to-edge`
2. WHEN the app sets navigation bar color THEN the System SHALL NOT use `android.view.Window.setNavigationBarColor` but instead use `SystemBars` component
3. WHEN the app gets status bar color THEN the System SHALL NOT use `android.view.Window.getStatusBarColor` as this API is deprecated
4. WHEN React Native's StatusBarModule is used THEN the System SHALL add ProGuard rules to suppress warnings for `com.facebook.react.modules.statusbar.StatusBarModule`
5. WHEN Material Design components use deprecated APIs THEN the System SHALL add ProGuard rules to suppress warnings for `com.google.android.material.internal` classes

### Requirement 13: Enable 16KB Native Library Alignment (Google Play Console)

**User Story:** As a user with a device that has 16KB memory page sizes, I want the app to install and run correctly, so that I can use the app without crashes.

#### Acceptance Criteria

1. WHEN the app is built THEN the System SHALL compile native libraries with 16KB page size alignment using NDK 26.1+
2. WHEN packaging the APK/AAB THEN the System SHALL set `useLegacyPackaging = false` in `packagingOptions.jniLibs`
3. WHEN configuring Gradle THEN the System SHALL set `android.bundle.nativeLibsAlignment=16384` in gradle.properties
4. WHEN configuring Gradle THEN the System SHALL set `android.enableNativeLibraryAlignment=true` in gradle.properties
5. WHEN building the release bundle THEN the System SHALL verify that all native libraries (.so files) are aligned to 16KB boundaries
6. WHEN the app targets SDK 35 THEN the System SHALL ensure all ABI architectures (armeabi-v7a, arm64-v8a, x86, x86_64) support 16KB alignment

### Requirement 14: Update Android Build Configuration

**User Story:** As a developer, I want the Android build configuration to be correct and complete, so that Google Play Console warnings are resolved.

#### Acceptance Criteria

1. WHEN building for Android THEN the System SHALL use `targetSdkVersion = 35` and `compileSdkVersion = 35`
2. WHEN building for Android THEN the System SHALL use NDK version 26.1.10909125 or higher for 16KB support
3. WHEN building for Android THEN the System SHALL use build tools version 35.0.0
4. WHEN the MainActivity.kt is generated THEN the System SHALL include `enableEdgeToEdge()` call before `super.onCreate()`
5. WHEN the AndroidManifest.xml is generated THEN the System SHALL include edge-to-edge compatibility meta-data tags
6. WHEN ProGuard is enabled THEN the System SHALL include rules to keep AndroidX edge-to-edge classes and suppress deprecated API warnings

