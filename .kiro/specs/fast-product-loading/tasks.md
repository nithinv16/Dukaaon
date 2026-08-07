# Implementation Plan

- [x] 1. Create Memory Cache Service
  - [x] 1.1 Implement MemoryCacheService class with Map-based storage
    - Create `services/cache/MemoryCacheService.ts`
    - Implement `get`, `set`, `has`, `clear` methods
    - Add TTL checking on get operations
    - Add LRU tracking with `accessTime` field
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Write property test for LRU eviction
    - **Property 3: Memory Cache LRU Eviction**
    - **Validates: Requirements 2.4**

  - [x] 1.3 Implement LRU eviction when cache exceeds maxEntries
    - Track access time on every get operation
    - Evict least-recently-accessed entry when adding to full cache
    - _Requirements: 2.4_

  - [x] 1.4 Implement app state change handling
    - Listen to AppState changes
    - Clear memory cache when backgrounded for more than 10 minutes
    - _Requirements: 2.5_

  - [x] 1.5 Write unit tests for MemoryCacheService
    - Test TTL expiration
    - Test edge cases (empty cache, single entry)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrate Memory Cache with ProductCacheService
  - [x] 3.1 Add memory cache instance to ProductCacheService
    - Import and instantiate MemoryCacheService in ProductCacheService
    - Configure with 100 max entries and 5-minute TTL
    - _Requirements: 2.1_

  - [x] 3.2 Write property test for cache-first data return
    - **Property 2: Cache-First Data Return**
    - **Validates: Requirements 1.2, 2.2, 2.3**

  - [x] 3.3 Modify getProducts to check memory cache first
    - Check memory cache synchronously before AsyncStorage
    - Return immediately if memory cache has valid data
    - Fall back to existing AsyncStorage logic on miss
    - _Requirements: 2.2, 2.3_

  - [x] 3.4 Write property test for dual cache update
    - **Property 7: Dual Cache Update**
    - **Validates: Requirements 4.4**

  - [x] 3.5 Implement dual cache update after network fetch
    - Update memory cache after successful network fetch
    - Update AsyncStorage cache (existing behavior)
    - Use same timestamp for both caches
    - _Requirements: 4.4_

  - [x] 3.6 Implement cache warming from AsyncStorage
    - Add `warmCache(sellerIds: string[])` method
    - Load data from AsyncStorage into memory cache on startup
    - Limit to 5 most recently viewed wholesalers
    - _Requirements: 7.5_

  - [x] 3.7 Write property test for cache warming
    - **Property 12: Cache Warming on Startup**
    - **Validates: Requirements 7.5**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create PrefetchManager
  - [x] 5.1 Implement PrefetchManager class
    - Create `services/products/PrefetchManager.ts`
    - Implement queue with Map storage
    - Add AbortController for cancellation
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Write property test for prefetch queue management
    - **Property 4: Prefetch Queue Management**
    - **Validates: Requirements 3.4**

  - [x] 5.3 Implement queue size management with priority
    - Cancel oldest low-priority request when queue exceeds 3
    - High-priority requests (long-press) are not auto-cancelled
    - _Requirements: 3.4_

  - [x] 5.4 Write property test for network-adaptive prefetch
    - **Property 5: Network-Adaptive Prefetch**
    - **Validates: Requirements 3.5, 5.4**

  - [x] 5.5 Integrate NetworkQualityService for adaptive prefetching
    - Disable automatic prefetch on slow networks (2G/3G)
    - Allow explicit user-triggered prefetch on slow networks
    - _Requirements: 3.5_

  - [x] 5.6 Write property test for critical data selection
    - **Property 9: Critical Data Selection**
    - **Validates: Requirements 3.3, 5.2**

  - [x] 5.7 Implement critical-data-only prefetch
    - Fetch only id, name, price, image_url, min_quantity, unit, seller_id
    - Use optimized RPC function
    - _Requirements: 3.3, 5.2_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create useInstantProducts Hook
  - [x] 7.1 Implement useInstantProducts hook
    - Create `hooks/useInstantProducts.ts`
    - Implement cache-first loading strategy
    - Return cacheStatus to indicate data source
    - _Requirements: 1.2, 1.4_

  - [x] 7.2 Write property test for immediate skeleton render
    - **Property 1: Immediate Skeleton Render**
    - **Validates: Requirements 1.1, 6.1**

  - [x] 7.3 Implement skeleton state management
    - Show skeleton only on cold cache (no memory or storage data)
    - Transition directly from skeleton to content
    - _Requirements: 1.1, 6.1, 6.2_

  - [x] 7.4 Write property test for background sync non-blocking
    - **Property 6: Background Sync Non-Blocking**
    - **Validates: Requirements 4.1**

  - [x] 7.5 Implement background refresh with stale-while-revalidate
    - Trigger background fetch when cache is stale
    - Update UI smoothly without layout shifts
    - _Requirements: 4.1, 4.2_

  - [x] 7.6 Write property test for exponential backoff retry
    - **Property 8: Exponential Backoff Retry**
    - **Validates: Requirements 4.5**

  - [x] 7.7 Implement retry logic with exponential backoff
    - Retry failed background syncs with 1s, 2s, 4s delays
    - Maximum 3 attempts before giving up
    - _Requirements: 4.5_

  - [x] 7.8 Write property test for offline cache serving
    - **Property 10: Offline Cache Serving**
    - **Validates: Requirements 1.5, 5.5**

  - [x] 7.9 Implement offline mode handling
    - Serve cached data when offline
    - Show subtle offline indicator
    - No error states if cache has data
    - _Requirements: 1.5, 5.5_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Enhance useSellerPrefetch Hook
  - [x] 9.1 Add prefetchVisible method
    - Prefetch products for array of visible seller IDs
    - Use PrefetchManager for queue management
    - _Requirements: 3.1_

  - [x] 9.2 Add onLongPress handler for priority prefetch
    - Trigger high-priority prefetch on long-press
    - Works even on slow networks
    - _Requirements: 3.2_

  - [x] 9.3 Write unit tests for enhanced useSellerPrefetch
    - Test prefetchVisible with multiple sellers
    - Test onLongPress priority handling
    - _Requirements: 3.1, 3.2_

- [x] 10. Integrate into WholesalerProductScreen
  - [x] 10.1 Replace direct Supabase queries with useInstantProducts
    - Update `app/(main)/retailer/wholesaler/[id].tsx`
    - Remove direct supabase.from('products') calls
    - Use useInstantProducts hook instead
    - _Requirements: 1.4_

  - [x] 10.2 Add ProductListSkeleton for loading state
    - Import existing ProductListSkeleton component
    - Show skeleton on cold cache only
    - _Requirements: 1.1, 6.1_

  - [x] 10.3 Add offline indicator UI
    - Show subtle banner when offline with cached data
    - Hide when back online
    - _Requirements: 1.5_

  - [x] 10.4 Implement infinite scroll with inline skeleton
    - Show skeleton items at bottom during load more
    - Use existing ProductCardSkeleton
    - _Requirements: 6.3_

  - [x] 10.5 Write integration tests for WholesalerProductScreen
    - Test cache-first loading
    - Test offline mode
    - Test infinite scroll
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 11. Integrate Prefetching into NearbyWholesalers
  - [x] 11.1 Add prefetch trigger for visible wholesalers
    - Update `components/home/NearbyWholesalers.tsx`
    - Call prefetchVisible when wholesaler cards become visible
    - Use onViewableItemsChanged callback
    - _Requirements: 3.1_

  - [x] 11.2 Add long-press handler for priority prefetch
    - Add onLongPress to wholesaler card
    - Trigger high-priority prefetch
    - _Requirements: 3.2_

  - [x] 11.3 Write unit tests for prefetch integration
    - Test prefetch triggers on visibility
    - Test long-press priority
    - _Requirements: 3.1, 3.2_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add Performance Monitoring
  - [x] 13.1 Implement performance metric logging
    - Log time-to-first-content (skeleton render)
    - Log time-to-interactive (data render)
    - Log cache hit/miss with cache type
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 13.2 Write property test for performance metric logging
    - **Property 11: Performance Metric Logging**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 13.3 Add performance warning for slow loads
    - Emit warning log when load time exceeds 500ms
    - Include context (seller ID, cache status, network quality)
    - _Requirements: 7.4_

- [x] 14. Implement Cache Warming on App Start
  - [x] 14.1 Add cache warming to app initialization
    - Update `app/_layout.tsx` or appropriate entry point
    - Call ProductCacheService.warmCache on app start
    - Load 5 most recently viewed wholesalers
    - _Requirements: 7.5_

  - [x] 14.2 Track recently viewed wholesalers
    - Store list of recently viewed seller IDs in AsyncStorage
    - Update list when user views a wholesaler
    - Limit to 10 entries
    - _Requirements: 7.5_

  - [x] 14.3 Write unit tests for cache warming
    - Test warming loads correct sellers
    - Test limit of 5 sellers
    - _Requirements: 7.5_

- [x] 15. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

