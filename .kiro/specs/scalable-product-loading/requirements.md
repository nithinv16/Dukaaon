# Requirements Document

## Introduction

This feature redesigns the product loading system in the DukaaOn app to handle 10,000+ products with sub-second loading times. The current implementation suffers from slow initial loads (20+ seconds for 135 products) due to inefficient database queries, lack of server-side pagination, and redundant COUNT operations. This redesign implements cursor-based pagination, server-side filtering, optimized database functions, and a hierarchical data loading strategy.

## Glossary

- **ScalableProductSystem**: The redesigned system for loading large product catalogs efficiently
- **CursorPagination**: Pagination using a unique identifier (cursor) instead of offset, providing consistent O(1) performance regardless of page number
- **ServerSideFiltering**: Filtering products by category/subcategory at the database level before returning results
- **HierarchicalLoading**: Loading category structure first, then products on-demand per category
- **VirtualizedList**: A list component that only renders visible items, reducing memory and render time
- **IncrementalCount**: Estimating total count without running expensive COUNT(*) queries
- **CategorySidebar**: The sidebar in the products screen for filtering by category/subcategory
- **ProductChunk**: A batch of products (20-50 items) loaded as a single unit

## Requirements

### Requirement 1: Cursor-Based Pagination

**User Story:** As a retailer browsing 10,000+ products, I want smooth infinite scrolling without slowdowns, so that I can browse the entire catalog efficiently.

#### Acceptance Criteria

1. WHEN fetching products THEN the ScalableProductSystem SHALL use cursor-based pagination with the product ID as cursor
2. WHEN loading the next page THEN the ScalableProductSystem SHALL fetch products with ID greater than the last loaded product ID
3. WHEN the user scrolls to load more THEN the ScalableProductSystem SHALL maintain consistent sub-200ms response times regardless of how many products have been loaded
4. WHEN returning paginated results THEN the ScalableProductSystem SHALL include the next cursor value for subsequent requests
5. IF the cursor is invalid or missing THEN the ScalableProductSystem SHALL start from the beginning of the result set

### Requirement 2: Server-Side Category Filtering

**User Story:** As a retailer, I want to filter products by category instantly, so that I can find products without waiting for full page reloads.

#### Acceptance Criteria

1. WHEN a retailer selects a category from the sidebar THEN the ScalableProductSystem SHALL fetch only products matching that category from the database
2. WHEN a retailer selects a subcategory THEN the ScalableProductSystem SHALL fetch only products matching both category and subcategory
3. WHEN filtering by category THEN the ScalableProductSystem SHALL use indexed database queries with sub-100ms query time
4. WHEN switching categories THEN the ScalableProductSystem SHALL cancel any pending requests for the previous category
5. WHEN the "All" category is selected THEN the ScalableProductSystem SHALL load products without category filter

### Requirement 3: Optimized Database Functions

**User Story:** As a system, I want efficient database queries, so that product loading scales to 10,000+ products.

#### Acceptance Criteria

1. WHEN fetching products THEN the ScalableProductSystem SHALL use a single optimized query without separate COUNT operations
2. WHEN the database function executes THEN the ScalableProductSystem SHALL return results within 50ms for indexed queries
3. WHEN filtering products THEN the ScalableProductSystem SHALL use composite indexes on (seller_id, category, id) for optimal performance
4. WHEN searching products THEN the ScalableProductSystem SHALL use full-text search with GIN indexes instead of ILIKE
5. WHEN returning results THEN the ScalableProductSystem SHALL include a has_more boolean flag instead of total count

### Requirement 4: Hierarchical Category Loading

**User Story:** As a retailer, I want to see category counts quickly, so that I know which categories have products before browsing.

#### Acceptance Criteria

1. WHEN entering the products screen THEN the ScalableProductSystem SHALL load category list with approximate counts within 200ms
2. WHEN displaying category counts THEN the ScalableProductSystem SHALL use pre-computed or estimated counts instead of real-time COUNT queries
3. WHEN a category is expanded THEN the ScalableProductSystem SHALL load subcategories with their counts
4. WHEN category data changes THEN the ScalableProductSystem SHALL update counts in background without blocking UI
5. IF pre-computed counts are unavailable THEN the ScalableProductSystem SHALL display categories without counts and load them asynchronously

### Requirement 5: Request Deduplication and Cancellation

**User Story:** As a retailer rapidly switching between categories, I want only the latest selection to load, so that I don't see stale data or experience slowdowns.

#### Acceptance Criteria

1. WHEN multiple requests are made for the same data THEN the ScalableProductSystem SHALL deduplicate and return a single response
2. WHEN a new category is selected THEN the ScalableProductSystem SHALL cancel pending requests for previous categories
3. WHEN a request is cancelled THEN the ScalableProductSystem SHALL abort the network request using AbortController
4. WHEN the user navigates away THEN the ScalableProductSystem SHALL cancel all pending product requests
5. WHEN a cancelled request completes THEN the ScalableProductSystem SHALL ignore the response

### Requirement 6: Virtualized Product List

**User Story:** As a retailer with a low-end device, I want smooth scrolling through thousands of products, so that the app remains responsive.

#### Acceptance Criteria

1. WHEN displaying products THEN the ScalableProductSystem SHALL render only visible items plus a small buffer (10 items above/below)
2. WHEN scrolling rapidly THEN the ScalableProductSystem SHALL maintain 60fps frame rate
3. WHEN products are loaded THEN the ScalableProductSystem SHALL use fixed-height items to enable accurate scroll position calculation
4. WHEN memory usage exceeds threshold THEN the ScalableProductSystem SHALL unload off-screen product images
5. WHEN the list is idle THEN the ScalableProductSystem SHALL pre-render items just outside the viewport

### Requirement 7: Incremental Data Loading

**User Story:** As a retailer, I want to see products immediately while more load in the background, so that I can start browsing right away.

#### Acceptance Criteria

1. WHEN entering the products screen THEN the ScalableProductSystem SHALL display the first 20 products within 500ms
2. WHEN the first batch is displayed THEN the ScalableProductSystem SHALL prefetch the next 2 batches in background
3. WHEN scrolling approaches loaded data boundary THEN the ScalableProductSystem SHALL trigger next batch fetch at 80% scroll position
4. WHEN a batch is loading THEN the ScalableProductSystem SHALL show inline skeleton placeholders
5. IF network is slow THEN the ScalableProductSystem SHALL reduce batch size to 10 products

### Requirement 8: Category-Specific Caching

**User Story:** As a retailer switching between categories, I want previously viewed categories to load instantly, so that I can compare products across categories.

#### Acceptance Criteria

1. WHEN products are loaded for a category THEN the ScalableProductSystem SHALL cache them keyed by (seller_id, category, subcategory, cursor)
2. WHEN returning to a previously viewed category THEN the ScalableProductSystem SHALL display cached products immediately
3. WHEN cache exists THEN the ScalableProductSystem SHALL trigger background refresh if data is older than 5 minutes
4. WHEN cache size exceeds 50MB THEN the ScalableProductSystem SHALL evict least-recently-used category data
5. WHEN the seller's products are updated THEN the ScalableProductSystem SHALL invalidate all caches for that seller

### Requirement 9: Search Optimization

**User Story:** As a retailer searching for a specific product, I want instant search results, so that I can find products quickly.

#### Acceptance Criteria

1. WHEN searching products THEN the ScalableProductSystem SHALL use full-text search with ranking
2. WHEN the user types THEN the ScalableProductSystem SHALL debounce search input by 300ms
3. WHEN search results are returned THEN the ScalableProductSystem SHALL highlight matching terms
4. WHEN searching within a category THEN the ScalableProductSystem SHALL combine full-text search with category filter
5. IF search returns no results THEN the ScalableProductSystem SHALL suggest similar products or categories

### Requirement 10: Performance Monitoring

**User Story:** As a developer, I want to track loading performance, so that I can identify and fix bottlenecks.

#### Acceptance Criteria

1. WHEN products are loaded THEN the ScalableProductSystem SHALL log database query time separately from network time
2. WHEN a request exceeds 500ms THEN the ScalableProductSystem SHALL emit a warning with full context
3. WHEN the app starts THEN the ScalableProductSystem SHALL report cache hit rates for the previous session
4. WHEN performance degrades THEN the ScalableProductSystem SHALL automatically reduce batch sizes
5. WHEN debugging THEN the ScalableProductSystem SHALL provide a way to view current cache state and pending requests
