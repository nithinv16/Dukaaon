# Implementation Plan

- [x] 1. Create SimpleAuthLoader service
  - [x] 1.1 Create services/auth/SimpleAuthLoader.ts with checkCachedAuth, cacheAuthData, clearCachedAuth methods
    - Implement checkCachedAuth to read auth_verified, user_id, user_profile from AsyncStorage
    - Return navigation target based on cache state
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Write property test for cache check timing
    - **Property 1: Navigation timing with cached auth**
    - **Validates: Requirements 1.1, 1.2, 5.2**
  - [x] 1.3 Write property test for no-cache navigation timing
    - **Property 2: Navigation timing without cached auth**
    - **Validates: Requirements 1.3, 5.1**
  - [x] 1.4 Implement validateSessionInBackground method
    - Perform Supabase session check without blocking
    - Only logout on definitive invalid token errors
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.5 Write property test for background validation
    - **Property 5: Background validation non-blocking**
    - **Validates: Requirements 3.1, 3.3**
  - [x] 1.6 Write property test for definitive logout
    - **Property 6: Definitive logout only**
    - **Validates: Requirements 3.2**

- [x] 2. Simplify app/index.tsx
  - [x] 2.1 Replace complex auth check with SimpleAuthLoader.checkCachedAuth()
    - Remove setUserAndWait, verifyUserLoaded calls
    - Remove multiple timeout mechanisms
    - Single useEffect for auth check and navigation
    - _Requirements: 4.1, 4.2, 5.1, 5.2_
  - [x] 2.2 Write property test for error fallback
    - **Property 7: Error fallback navigation**
    - **Validates: Requirements 5.3**
  - [x] 2.3 Write property test for splash duration
    - **Property 8: Maximum splash duration**
    - **Validates: Requirements 1.4**

- [x] 3. Simplify app/_layout.tsx
  - [x] 3.1 Remove 30-second safety timeout
    - Remove timeoutOccurred state and related logic
    - Keep only essential providers and navigation structure
    - _Requirements: 4.3_
  - [x] 3.2 Remove AuthStateManager import and usage
    - Layout should only render based on session state from store
    - _Requirements: 4.4_

- [x] 4. Simplify store/auth.ts
  - [x] 4.1 Remove ProfileLoader dependency and complex initialization
    - Remove initializeAuth function and helpers
    - Remove sessionValidationCount tracking
    - Keep simple setSession, setUser, clearAuth methods
    - _Requirements: 4.1, 4.4_
  - [x] 4.2 Update setSession to use SimpleAuthLoader.cacheAuthData
    - Cache profile data when session is set
    - _Requirements: 2.3_
  - [x] 4.3 Write property test for profile cache update timing
    - **Property 4: Profile cache update timing**
    - **Validates: Requirements 2.3**

- [x] 5. Update home screen to use cached profile
  - [x] 5.1 Ensure app/(main)/home/index.tsx reads profile from auth store synchronously
    - Remove any async profile loading on mount
    - Profile should already be in store from SimpleAuthLoader
    - _Requirements: 2.1, 2.2_
  - [x] 5.2 Write property test for profile synchronous availability
    - **Property 3: Profile data synchronous availability**
    - **Validates: Requirements 2.1, 2.2**

- [x] 6. Cleanup deprecated services
  - [x] 6.1 Remove or deprecate services/auth/AuthStateManager.ts
    - Add deprecation comment if keeping for reference
    - _Requirements: 4.4_
  - [x] 6.2 Remove utils/authSync.ts
    - setUserAndWait and verifyUserLoaded no longer needed
    - _Requirements: 4.4_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration testing
  - [ ] 8.1 Write integration test for full app loading flow
    - Test fresh install → language screen
    - Test cached auth → main screen
    - Test corrupted cache → language screen
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
