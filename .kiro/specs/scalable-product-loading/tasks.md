# Implementation Plan

- [x] 1. Database Schema and Functions
  - [x] 1.1 Create composite indexes for cursor pagination
    - Add index on (seller_id, category, id)
    - Add index on (seller_id, category, subcategory, id)
    - Run ANALYZE on products table
    - _Requirements: 3.3_

  - [x] 1.2 Add full-text search column and index
    - Add search_vector tsvector column to products table
    - Create GIN index on search_vector
    - Create trigger to auto-update search_vector on insert/update
    - Backfill existing products with search vectors
    - _Requirements: 3.4, 9.1_

  - [x] 1.3 Create cursor-based pagination RPC function
    - Create `get_products_cursor` function with cursor pagination
    - Use `WHERE id > cursor` instead of OFFSET
    - Return `has_more` flag by fetching limit + 1
    - Support category, subcategory, and search filters
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.5_

  - [x] 1.4 Write property test for cursor ordering
    - **Property 1: Cursor Ordering Consistency**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.5 Write property test for has_more accuracy
    - **Property 3: Has-More Flag Accuracy**
    - **Validates: Requirements 1.4, 3.5**

  - [x] 1.6 Create materialized view for category counts
    - Create `seller_category_counts` materialized view
    - Add unique index for concurrent refresh
    - Create refresh function
    - _Requirements: 4.2_

  - [x] 1.7 Create category counts RPC function
    - Create `get_seller_category_counts` function
    - Query from materialized view for fast response
    - Return category, subcategory, and counts
    - _Requirements: 4.1, 4.3_

- [x] 2. Checkpoint - Verify database changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Request Queue Manager
  - [x] 3.1 Implement RequestQueueManager class
    - Create `services/products/RequestQueueManager.ts`
    - Implement request queue with Map storage
    - Add AbortController for each request
    - _Requirements: 5.1, 5.3_

  - [x] 3.2 Write property test for request deduplication
    - **Property 5: Request Deduplication**
    - **Validates: Requirements 5.1**

  - [x] 3.3 Implement request deduplication
    - Check if identical request is in-flight
    - Return existing promise if duplicate
    - Track in-flight requests by cache key
    - _Requirements: 5.1_

  - [x] 3.4 Implement request cancellation
    - Add `cancel(requestId)` method
    - Add `cancelMatching(pattern)` for bulk cancellation
    - Call AbortController.abort() on cancellation
    - _Requirements: 5.2, 5.3_

  - [x] 3.5 Write property test for cancellation on filter change
    - **Property 4: Request Cancellation on Filter Change**
    - **Validates: Requirements 2.4, 5.2**

  - [x] 3.6 Write unit tests for RequestQueueManager
    - Test enqueue and dequeue
    - Test cancellation
    - Test deduplication
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Checkpoint - Verify request management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Product Query Service
  - [x] 5.1 Implement ProductQueryService class
    - Create `services/products/ProductQueryService.ts`
    - Integrate with RequestQueueManager
    - Implement cache key generation
    - _Requirements: 1.1, 8.1_

  - [x] 5.2 Write property test for cache key uniqueness
    - **Property 10: Cache Key Uniqueness**
    - **Validates: Requirements 8.1**

  - [x] 5.3 Implement cursor-based fetch
    - Call `get_products_cursor` RPC
    - Parse response and extract nextCursor
    - Handle has_more flag
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 5.4 Write property test for filter correctness
    - **Property 2: Filter Correctness**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 5.5 Implement category-specific caching
    - Cache by (sellerId, category, subcategory, cursor)
    - Track cache timestamps
    - Implement cache size limit (50MB)
    - _Requirements: 8.1, 8.4_

  - [x] 5.6 Write property test for cache-first with revalidation
    - **Property 11: Cache-First with Stale Revalidation**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 5.7 Implement stale-while-revalidate
    - Return cached data immediately if available
    - Trigger background refresh if data > 5 minutes old
    - Update cache on background refresh complete
    - _Requirements: 8.2, 8.3_

  - [x] 5.8 Write property test for cache invalidation
    - **Property 12: Cache Invalidation by Seller**
    - **Validates: Requirements 8.5**

  - [x] 5.9 Implement cache invalidation
    - Add `invalidateCache(sellerId)` method
    - Remove all entries matching seller pattern
    - _Requirements: 8.5_

  - [x] 5.10 Implement prefetch for next batch
    - Add `prefetchNext(params, currentCursor)` method
    - Fetch next batch in background
    - Store in cache for instant access
    - _Requirements: 7.2_

- [x] 6. Checkpoint - Verify query service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. useScalableProducts Hook
  - [x] 7.1 Implement useScalableProducts hook
    - Create `hooks/useScalableProducts.ts`
    - Integrate with ProductQueryService
    - Manage loading states (initial, loadMore, refresh)
    - _Requirements: 1.1, 7.1_

  - [x] 7.2 Implement cursor state management
    - Track current cursor
    - Accumulate products across pages
    - Reset on filter change
    - _Requirements: 1.1, 1.2_

  - [x] 7.3 Write property test for cleanup on unmount
    - **Property 6: Cleanup on Unmount**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 7.4 Implement cleanup on unmount
    - Cancel all pending requests on unmount
    - Use useEffect cleanup function
    - Prevent state updates after unmount
    - _Requirements: 5.4, 5.5_

  - [x] 7.5 Write property test for adaptive batch sizing
    - **Property 9: Adaptive Batch Sizing**
    - **Validates: Requirements 7.5, 10.4**

  - [x] 7.6 Implement adaptive batch sizing
    - Detect network quality (2G/3G vs fast)
    - Use 10 items for slow networks
    - Use 20 items for fast networks
    - _Requirements: 7.5_

  - [x] 7.7 Write property test for prefetch trigger
    - **Property 8: Prefetch Trigger Threshold**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 7.8 Implement prefetch trigger at 80% scroll
    - Calculate scroll percentage
    - Trigger prefetch when >= 80%
    - Prevent duplicate prefetch requests
    - _Requirements: 7.2, 7.3_

  - [x] 7.9 Write property test for search debounce
    - **Property 13: Search Debounce**
    - **Validates: Requirements 9.2**

  - [x] 7.10 Implement search debounce
    - Debounce search input by 300ms
    - Cancel previous search on new input
    - _Requirements: 9.2_

  - [x] 7.11 Write property test for search with category
    - **Property 14: Search with Category Filter**
    - **Validates: Requirements 9.4**

- [x] 8. Checkpoint - Verify hook implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Category Sidebar Component
  - [x] 9.1 Create CategorySidebar component
    - Create `components/products/CategorySidebar.tsx`
    - Display categories with counts
    - Support subcategory expansion
    - _Requirements: 4.1, 4.3_

  - [x] 9.2 Implement useCategorySidebar hook
    - Create `hooks/useCategorySidebar.ts`
    - Fetch category counts from RPC
    - Cache counts locally
    - _Requirements: 4.1, 4.2_

  - [x] 9.3 Implement category selection with request cancellation
    - Cancel pending requests on category change
    - Reset product list on category change
    - Update URL/state with selected category
    - _Requirements: 2.4_

  - [x] 9.4 Write unit tests for CategorySidebar
    - Test category display
    - Test subcategory expansion
    - Test selection handling
    - _Requirements: 4.1, 4.3_

- [x] 10. Virtualized Product List
  - [x] 10.1 Enhance VirtualizedProductList component
    - Update `components/products/VirtualizedProductList.tsx`
    - Configure windowSize for buffer (10 items above/below)
    - Use fixed item heights for accurate scroll calculation
    - _Requirements: 6.1, 6.3_

  - [x] 10.2 Write property test for render bounds
    - **Property 7: Virtualization Render Bounds**
    - **Validates: Requirements 6.1**

  - [x] 10.3 Implement scroll position tracking
    - Track scroll percentage
    - Trigger loadMore at 80% threshold
    - _Requirements: 7.3_

  - [x] 10.4 Implement inline loading skeleton
    - Show skeleton items at bottom during loadMore
    - Use ProductCardSkeleton component
    - _Requirements: 7.4_

  - [x] 10.5 Write unit tests for VirtualizedProductList
    - Test render count
    - Test scroll handling
    - Test skeleton display
    - _Requirements: 6.1, 7.3, 7.4_

- [x] 11. Checkpoint - Verify UI components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Integrate into WholesalerProductScreen
  - [x] 12.1 Replace useInstantProducts with useScalableProducts
    - Update `app/(main)/retailer/wholesaler/[id].tsx`
    - Remove old hook usage
    - Use new cursor-based hook
    - _Requirements: 1.1, 1.2_

  - [x] 12.2 Add CategorySidebar to products screen
    - Add sidebar layout
    - Connect category selection to product filtering
    - _Requirements: 2.1, 4.1_

  - [x] 12.3 Update product list to use VirtualizedProductList
    - Replace FlatList with enhanced VirtualizedProductList
    - Configure for cursor-based pagination
    - _Requirements: 6.1_

  - [x] 12.4 Implement search with full-text search
    - Update search to use new RPC
    - Combine search with category filter
    - _Requirements: 9.1, 9.4_

  - [x] 12.5 Write integration tests for WholesalerProductScreen
    - Test initial load performance
    - Test category switching
    - Test search functionality
    - Test infinite scroll
    - _Requirements: 1.1, 2.1, 7.1, 9.1_

- [x] 13. Performance Monitoring
  - [x] 13.1 Add performance logging
    - Log database query time
    - Log network time
    - Log cache hit/miss rates
    - _Requirements: 10.1, 10.3_

  - [x] 13.2 Add slow request warnings
    - Emit warning when request > 500ms
    - Include context (sellerId, category, network quality)
    - _Requirements: 10.2_

  - [x] 13.3 Add debug utilities
    - Add method to view cache state
    - Add method to view pending requests
    - _Requirements: 10.5_

- [x] 14. Final Checkpoint - Verify complete implementation
  - Ensure all tests pass, ask the user if questions arise.
