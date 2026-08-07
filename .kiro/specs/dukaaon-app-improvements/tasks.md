# Implementation Plan

- [x] 1. Fix Profile Loading on Cold Start






  - [x] 1.1 Create AuthStateManager service with mutex lock

    - Create `services/auth/AuthStateManager.ts` with single entry point for auth initialization
    - Implement mutex lock to prevent concurrent auth checks
    - Add state machine for auth flow: `initializing` → `checking_cache` → `refreshing_session` → `loading_profile` → `complete`
    - _Requirements: 1.1, 1.7_


  - [x] 1.2 Write property test for race condition prevention

    - **Property 6: Race Condition Prevention**
    - **Validates: Requirements 1.7**

  - [x] 1.3 Implement session refresh before profile fetch


    - Modify `initializeAuth` to call `supabase.auth.refreshSession()` before any profile queries
    - Handle expired refresh token by clearing all cached auth data
    - Add proper error handling for network failures during refresh
    - _Requirements: 1.2, 1.5_


  - [x] 1.4 Write property test for session refresh ordering

    - **Property 2: Session Refresh Before Profile Fetch**
    - **Validates: Requirements 1.2**


  - [x] 1.5 Implement retry with exponential backoff

    - Add retry logic to ProfileLoader with delays: 1s, 2s, 4s
    - Fall back to cached profile after 3 failed attempts
    - Log retry attempts for debugging
    - _Requirements: 1.4_


  - [x] 1.6 Write property test for exponential backoff

    - **Property 3: Retry with Exponential Backoff**
    - **Validates: Requirements 1.4**


  - [x] 1.7 Implement cache-first with background refresh

    - Load cached profile immediately on cold start
    - Set user state from cache before network calls
    - Trigger background refresh that updates state without blocking navigation
    - _Requirements: 1.3, 1.6_


  - [x] 1.8 Write property test for background refresh

    - **Property 5: Background Refresh After Cache Load**
    - **Validates: Requirements 1.6**


  - [x] 1.9 Update app entry points to use AuthStateManager

    - Refactor `app/index.tsx` to use AuthStateManager instead of direct auth store access
    - Refactor `app/_layout.tsx` to coordinate with AuthStateManager
    - Remove duplicate auth initialization logic
    - _Requirements: 1.1, 1.7_


  - [x] 1.10 Write property test for cold start session restoration

    - **Property 1: Cold Start Session Restoration**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 1.11 Write property test for invalid token cleanup


    - **Property 4: Invalid Token Cleanup**
    - **Validates: Requirements 1.5**

- [x] 2. Checkpoint - Ensure all auth tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Product Screen Performance Optimization





  - [x] 3.1 Create ProductCacheService


    - Create `services/products/ProductCacheService.ts`
    - Implement cache-first loading strategy with AsyncStorage
    - Add cache invalidation and TTL management
    - _Requirements: 2.2, 2.6_



  - [x] 3.2 Write property test for cache-first loading
    - **Property 8: Cache-First Product Loading**
    - **Validates: Requirements 2.2, 2.6**

  - [x] 3.3 Implement skeleton loading components
    - Create `components/products/ProductCardSkeleton.tsx`
    - Create `components/products/ProductListSkeleton.tsx`
    - Ensure skeleton renders within 100ms of screen mount


    - _Requirements: 2.1_

  - [x] 3.4 Write property test for skeleton loading timing
    - **Property 7: Skeleton Loading Timing**
    - **Validates: Requirements 2.1**

  - [x] 3.5 Implement adaptive batch sizing
    - Add network quality detection using NetInfo
    - Reduce batch size to 10 for slow networks (2G/3G)
    - Implement infinite scroll pagination
    - _Requirements: 2.5_

  - [x] 3.6 Write property test for adaptive batch sizing
    - **Property 9: Adaptive Batch Sizing**
    - **Validates: Requirements 2.5**

  - [x] 3.7 Implement pre-fetching for seller navigation
    - Add prefetch trigger when user hovers/focuses on seller card
    - Cache seller products during navigation animation
    - _Requirements: 2.3_

  - [x] 3.8 Implement progressive image loading
    - Add low-resolution placeholder generation
    - Implement progressive upgrade to full resolution
    - Use react-native-fast-image for caching
    - _Requirements: 2.4_

  - [x] 3.9 Implement virtualized product list
    - Replace FlatList with FlashList for better performance
    - Configure proper item height estimation
    - Implement windowed rendering
    - _Requirements: 2.7_

  - [x] 3.10 Optimize database queries
    - Add database indexes for common query patterns
    - Limit initial fetch to essential fields only
    - Create optimized RPC functions for product queries
    - _Requirements: 2.8_

- [x] 4. Checkpoint - Ensure all performance tests pass






  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Product Variants System




  - [x] 5.1 Create product_variants database migration


    - Create migration file for `product_variants` table
    - Add indexes for performance
    - Enable RLS policies
    - _Requirements: 3.9_


  - [x] 5.2 Add variant columns to products table

    - Create additive migration for `has_variants`, `variant_display_type`, `parent_product_id`
    - Ensure no existing columns are modified
    - Add indexes for variant queries
    - _Requirements: 3.9_


  - [x] 5.3 Write property test for backward compatibility

    - **Property 12: Backward Compatibility**
    - **Validates: Requirements 3.10, 3.11**

  - [x] 5.4 Create variant service and types


    - Create `services/products/VariantService.ts`
    - Define TypeScript interfaces for variants
    - Implement CRUD operations for variants
    - _Requirements: 3.1, 3.2_

  - [x] 5.5 Implement variant grouping logic

    - Create function to group size variants within product card
    - Create function to separate flavor variants into different cards
    - Handle mixed variant types
    - _Requirements: 3.1, 3.8_


  - [x] 5.6 Write property test for variant grouping
    - **Property 10: Variant Grouping Consistency**
    - **Validates: Requirements 3.1, 3.3**


  - [x] 5.7 Write property test for flavor variant separation
    - **Property 11: Flavor Variant Separation**
    - **Validates: Requirements 3.8**

  - [x] 5.8 Create variant selector UI components


    - Create `components/products/VariantSelector.tsx`
    - Implement size/weight selector as chips
    - Implement flavor selector as dropdown or chips
    - Show price differences between variants
    - _Requirements: 3.2, 3.4, 3.5_


  - [x] 5.9 Update product card to support variants

    - Modify `ProductCard` component to show variant selector for products with variants
    - Update price, stock, and image on variant selection
    - Show "Out of Stock" for unavailable variants
    - _Requirements: 3.1, 3.3, 3.5_


  - [x] 5.10 Update product detail screen for variants

    - Add variant selection UI to product detail screen
    - Show all variant options with prices
    - Update displayed information on variant change
    - _Requirements: 3.2, 3.3, 3.4_


  - [x] 5.11 Update cart to handle variants

    - Modify cart item structure to include variant_id and SKU
    - Display variant details in cart (e.g., "Mirinda 500ml")
    - Handle quantity updates for specific variants

    - _Requirements: 3.6_

  - [x] 5.12 Write property test for cart variant recording
    - **Property 13: Cart Variant Recording**
    - **Validates: Requirements 3.6**


  - [x] 5.13 Create seller variant management UI

    - Add variant creation interface in seller product upload
    - Allow defining variant groups (size, flavor, etc.)
    - Support adding multiple variants with individual pricing
    - _Requirements: 3.7_

- [x] 6. Checkpoint - Ensure all variant tests pass



  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement Credit/Loan Payment System



  - [x] 7.1 Create credit system database migrations

    - Create migration for `credit_facilities` table
    - Create migration for `credit_payments` table
    - Create migration for `upi_mandates` table
    - Create migration for `credit_payment_history` table
    - _Requirements: 4.1, 4.7_


  - [x] 7.2 Create CreditService

    - Create `services/credit/CreditService.ts`
    - Implement credit limit checking
    - Implement interest calculation based on repayment period
    - _Requirements: 4.2, 4.3, 4.10_


  - [x] 7.3 Write property test for interest calculation

    - **Property 14: Interest Calculation Accuracy**
    - **Validates: Requirements 4.3, 4.10**

  - [x] 7.4 Implement KYC verification flow


    - Create KYC status checking function
    - Implement redirect to KYC flow for unverified users
    - Display KYC status and rejection reasons
    - _Requirements: 4.4, 4.5, 4.9_


  - [x] 7.5 Write property test for KYC gate enforcement

    - **Property 15: KYC Gate Enforcement**
    - **Validates: Requirements 4.4, 4.9**


  - [x] 7.6 Implement UPI autopay mandate integration

    - Create `services/credit/UPIMandateService.ts`
    - Implement mandate creation flow
    - Handle mandate status callbacks
    - _Requirements: 4.6_


  - [x] 7.7 Implement credit payment processing

    - Create payment flow: mandate → payment → record
    - Implement wholesaler payment transfer
    - Create credit record with repayment schedule
    - _Requirements: 4.6, 4.7_

  - [x] 7.8 Write property test for payment flow integrity








    - **Property 16: Credit Payment Flow Integrity**
    - **Validates: Requirements 4.6, 4.7**

  - [ ] 7.9 Update LoanScreen with Pay to Wholesaler section






    - Add "Pay to Wholesaler" section to LoanScreen
    - Display available credit limit
    - Show list of connected wholesalers
    - _Requirements: 4.1_
-

  - [x] 7.10 Create credit payment form UI




    - Create payment amount input
    - Add repayment period selector (daily, weekly, monthly)
    - Display calculated interest and EMI breakdown
    - _Requirements: 4.2, 4.3_

  - [x] 7.11 Create active credits display





    - Show outstanding balance
    - Display next payment date
    - Show payment history
    - Add prepayment option
    - _Requirements: 4.8_
-

- [x] 8. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
