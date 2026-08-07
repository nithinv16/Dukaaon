# Requirements Document

## Introduction

This feature enhances the product loading system in the DukaaOn app to achieve instant product display similar to major e-commerce and quick commerce applications (Flipkart, Amazon, Swiggy). While skeleton loading components already exist, the retailer-facing wholesaler product screens (`retailer/wholesaler/[id].tsx`) currently fetch data directly from Supabase without utilizing the existing `ProductCacheService`. This feature integrates the cache-first loading strategy, predictive prefetching, and memory caching to achieve sub-100ms perceived loading times.

## Glossary

- **ProductLoadingSystem**: The unified system responsible for fast product data retrieval, caching, and display
- **SkeletonUI**: Placeholder UI components that match the final layout, shown while data loads (already implemented)
- **Prefetch**: Loading data in advance before the user navigates to a screen
- **StaleWhileRevalidate**: Cache strategy that serves stale data immediately while fetching fresh data in background
- **MemoryCache**: In-memory Map-based cache for instant data access without AsyncStorage overhead
- **BackgroundSync**: Process that updates cached data without blocking UI
- **CriticalData**: Minimum fields required to render product cards (id, name, price, image_url, min_quantity, unit)
- **WholesalerProductScreen**: The `retailer/wholesaler/[id].tsx` screen where retailers browse wholesaler products

## Requirements

### Requirement 1: Integrate Cache Service in Wholesaler Product Screen

**User Story:** As a retailer, I want to see product content immediately when I tap on a wholesaler, so that I don't have to wait for loading spinners.

#### Acceptance Criteria

1. WHEN a retailer navigates to WholesalerProductScreen THEN the ProductLoadingSystem SHALL display SkeletonUI within 50ms
2. WHEN cached product data exists for the wholesaler THEN the ProductLoadingSystem SHALL render cached products within 100ms of navigation
3. WHEN no cached data exists THEN the ProductLoadingSystem SHALL show skeleton while fetching from network
4. WHEN displaying products THEN the ProductLoadingSystem SHALL use the existing ProductCacheService instead of direct Supabase queries
5. IF network fetch fails THEN the ProductLoadingSystem SHALL continue displaying cached data with a subtle offline indicator

### Requirement 2: Memory Cache Layer

**User Story:** As a retailer, I want products to appear instantly when I navigate back to a previously viewed wholesaler, so that I can compare products quickly.

#### Acceptance Criteria

1. WHEN products are fetched THEN the ProductLoadingSystem SHALL store them in an in-memory Map cache with 5-minute TTL
2. WHEN loading products THEN the ProductLoadingSystem SHALL check memory cache first before AsyncStorage
3. WHEN memory cache has data THEN the ProductLoadingSystem SHALL return data synchronously without async overhead
4. WHEN memory cache exceeds 100 entries THEN the ProductLoadingSystem SHALL evict least-recently-used entries
5. WHEN the app is backgrounded for more than 10 minutes THEN the ProductLoadingSystem SHALL clear memory cache

### Requirement 3: Predictive Prefetching on Wholesaler List

**User Story:** As a retailer, I want products to load instantly when I tap on a wholesaler card, so that I can browse without delays.

#### Acceptance Criteria

1. WHEN a retailer views the NearbyWholesalers list THEN the ProductLoadingSystem SHALL prefetch products for visible wholesaler cards
2. WHEN a retailer long-presses on a wholesaler card THEN the ProductLoadingSystem SHALL prioritize prefetching that wholesaler's products
3. WHEN prefetching products THEN the ProductLoadingSystem SHALL fetch only CriticalData (id, name, price, image_url, min_quantity, unit)
4. WHEN the prefetch queue exceeds 3 wholesalers THEN the ProductLoadingSystem SHALL cancel oldest prefetch requests
5. WHILE the device is on a slow network (2G/3G) THEN the ProductLoadingSystem SHALL disable automatic prefetching

### Requirement 4: Background Data Synchronization

**User Story:** As a retailer, I want to see up-to-date prices and stock levels without manual refresh, so that I can make informed purchasing decisions.

#### Acceptance Criteria

1. WHILE displaying cached products THEN the ProductLoadingSystem SHALL fetch fresh data in background without blocking UI
2. WHEN fresh data differs from cached data THEN the ProductLoadingSystem SHALL update the UI smoothly without layout shifts
3. WHEN the WholesalerProductScreen gains focus THEN the ProductLoadingSystem SHALL trigger background sync if cache is stale
4. WHEN background sync completes THEN the ProductLoadingSystem SHALL update both memory and AsyncStorage caches
5. IF background sync fails THEN the ProductLoadingSystem SHALL retry with exponential backoff up to 3 attempts

### Requirement 5: Optimized Initial Fetch

**User Story:** As a retailer on a slow network, I want the app to load essential product data first, so that I can start browsing quickly.

#### Acceptance Criteria

1. WHEN fetching products for a seller THEN the ProductLoadingSystem SHALL use the existing optimized RPC function `get_seller_products_optimized`
2. WHEN fetching product lists THEN the ProductLoadingSystem SHALL select only CriticalData fields initially
3. WHEN paginating products THEN the ProductLoadingSystem SHALL use 20-item pages for fast initial load
4. WHEN network quality is slow (2G/3G) THEN the ProductLoadingSystem SHALL reduce page size to 10 items
5. WHEN offline THEN the ProductLoadingSystem SHALL serve all available cached data without network requests

### Requirement 6: Skeleton Loading Integration

**User Story:** As a retailer, I want to see a visual placeholder immediately when loading products, so that I know the app is responsive.

#### Acceptance Criteria

1. WHEN WholesalerProductScreen mounts THEN the ProductLoadingSystem SHALL render ProductListSkeleton within 16ms (one frame)
2. WHEN cached data is available THEN the ProductLoadingSystem SHALL replace skeleton with products without intermediate loading state
3. WHEN scrolling to load more products THEN the ProductLoadingSystem SHALL show inline skeleton items at the bottom
4. WHEN a category filter is applied THEN the ProductLoadingSystem SHALL show skeleton only if no cached data exists for that category
5. WHEN search is performed THEN the ProductLoadingSystem SHALL show skeleton while fetching search results

### Requirement 7: Performance Metrics

**User Story:** As a developer, I want to monitor loading performance, so that I can identify and fix performance regressions.

#### Acceptance Criteria

1. WHEN products are loaded THEN the ProductLoadingSystem SHALL log time-to-first-content metric (skeleton render time)
2. WHEN products are loaded THEN the ProductLoadingSystem SHALL log time-to-interactive metric (actual data render time)
3. WHEN cache operations occur THEN the ProductLoadingSystem SHALL log hit/miss ratios with cache type (memory/storage)
4. WHEN loading time exceeds 500ms THEN the ProductLoadingSystem SHALL emit warning logs with context
5. WHEN the app starts THEN the ProductLoadingSystem SHALL warm memory cache from AsyncStorage for recently viewed wholesalers

