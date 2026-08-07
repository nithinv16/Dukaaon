# Implementation Plan

- [x] 1. Create auth synchronization utilities





  - [x] 1.1 Create `utils/authSync.ts` with `waitForAuthState` and `setUserAndWait` functions

    - Implement `waitForAuthState(predicate, timeout)` that polls auth store state
    - Implement `setUserAndWait(user, session)` that sets state and waits for propagation
    - Add proper TypeScript types and error handling
    - _Requirements: 3.1, 3.2_

  - [x] 1.2 Write property test for auth synchronization

    - **Property 6: Sequential auth state processing**
    - **Validates: Requirements 3.4**

- [-] 2. Fix index screen navigation timing



  - [x] 2.1 Update `app/index.tsx` to await state updates before navigation


    - Import and use `setUserAndWait` instead of direct `setState`
    - Add verification that user is in store before `router.replace()`
    - Remove redundant navigation attempts and simplify flow
    - _Requirements: 1.2, 1.3, 3.1, 3.2_

  - [x] 2.2 Write property test for navigation timing

    - **Property 1: Navigation requires loaded user**
    - **Validates: Requirements 1.2, 1.3, 3.1, 3.2**
  - [x] 2.3 Write property test for cache restoration






    - **Property 2: Cache restoration before navigation**
    - **Validates: Requirements 2.1, 2.2**
- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Fix home screen loading state




  - [x] 4.1 Update `app/(main)/home/index.tsx` to handle auth state reactively

    - Add `useEffect` that watches for user becoming available
    - Skip loading state if user already exists in store on mount
    - Implement 5-second timeout with error state and retry option
    - _Requirements: 2.3, 3.3, 1.4_

  - [x] 4.2 Write property test for skip redundant loading



    - **Property 3: Skip redundant loading when user exists**
    - **Validates: Requirements 2.3**
  - [x] 4.3 Write property test for reactive subscription



    - **Property 5: Reactive auth state subscription**
    - **Validates: Requirements 3.3**

- [-] 5. Verify stale-while-revalidate pattern




  - [x] 5.1 Review and verify `ProfileLoader.loadFromCache` implements stale-while-revalidate correctly
    - Ensure stale cache returns data immediately
    - Verify background refresh is triggered for stale data
    - Add logging to confirm pattern is working

    - _Requirements: 2.4_
  - [x] 5.2 Write property test for stale-while-revalidate

    - **Property 4: Stale-while-revalidate pattern**
    - **Validates: Requirements 2.4**

- [x] 6. Optimize home screen data loading for parallel execution
  - [x] 6.1 Refactor home screen to load profile and location in parallel
    - Remove sequential loading pattern from `useEffect` chains
    - Use `Promise.allSettled()` to start both operations simultaneously
    - Ensure location fetch is non-blocking and doesn't delay rendering
    - Fixed background revalidation cooldown bug (using global variable instead of ref)
    - Added caching to DynamicHomeSections for instant display on app resume
    - _Requirements: 4.1, 4.4_
  
  - [ ] 6.2 Write property test for parallel data loading
    - **Property 7: Parallel data loading**
    - **Validates: Requirements 4.1**

- [x] 7. Add defensive data checks to home screen components
  - [x] 7.1 Update `NearbyWholesalers` component with data availability guards
    - Add check for `userId` before rendering
    - Add check for `userLocation` before fetching wholesalers
    - Show component-specific loading state when location is missing
    - _Requirements: 4.2, 4.4_
  
  - [x] 7.2 Update `NearbyManufacturers` component with data availability guards
    - Add check for `userId` before rendering
    - Add check for `userLocation` before fetching manufacturers
    - Show component-specific loading state when location is missing
    - _Requirements: 4.2, 4.4_
  
  - [x] 7.3 Update `DynamicHomeSections` component with data availability guards
    - Add check for `userId` before fetching personalized content
    - Handle missing user gracefully with default content
    - _Requirements: 4.2_
  
  - [x] 7.4 Write property test for component data availability checks
    - **Property 8: Component data availability check**
    - **Validates: Requirements 4.2**

- [x] 8. Add error boundaries for graceful degradation
  - [x] 8.1 Create `HomeComponentErrorBoundary` wrapper
    - Implement React error boundary for home screen sections
    - Show fallback UI when a component crashes
    - Log errors for debugging without crashing entire screen
    - _Requirements: 4.3_
  
  - [x] 8.2 Wrap home screen sections with error boundaries
    - Wrap `NearbyWholesalers` with error boundary
    - Wrap `NearbyManufacturers` with error boundary
    - Wrap `DynamicHomeSections` with error boundary
    - _Requirements: 4.3_
  
  - [x] 8.3 Write property test for graceful component degradation
    - **Property 9: Graceful component degradation**
    - **Validates: Requirements 4.3**

- [x] 9. Implement background revalidation on app resume
  - [x] 9.1 Add app state listener to home screen
    - Listen for app state changes (background/foreground)
    - Trigger background revalidation when app resumes
    - Don't show loading states during revalidation
    - _Requirements: 4.5_
  
  - [x] 9.2 Write property test for background revalidation
    - **Property 11: Background revalidation on app resume**
    - **Validates: Requirements 4.5**

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
