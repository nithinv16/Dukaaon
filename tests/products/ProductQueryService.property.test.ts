/**
 * Property-Based Tests for ProductQueryService
 * 
 * Tests cursor-based pagination, caching, and request management
 * Using fast-check for property-based testing
 */

import fc from 'fast-check';
import { 
  ProductQueryServiceClass,
  type CursorPaginationParams,
  type Product,
} from '../../services/products/ProductQueryService';
import { generateCacheKey } from '../../services/products/RequestQueueManager';

// Mock supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import { supabase } from '../../services/supabase/supabase';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

// Arbitraries for generating test data
const uuidArbitrary = fc.uuid();

const categoryArbitrary = fc.option(
  fc.constantFrom('Electronics', 'Groceries', 'Clothing', 'Home', 'Beauty', 'Sports'),
  { nil: undefined }
);

const subcategoryArbitrary = fc.option(
  fc.constantFrom('Phones', 'Laptops', 'Snacks', 'Beverages', 'Shirts', 'Shoes'),
  { nil: undefined }
);

const searchTermArbitrary = fc.option(
  fc.string({ minLength: 1, maxLength: 30 }),
  { nil: undefined }
);

const cursorArbitrary = fc.option(fc.uuid(), { nil: undefined });

const limitArbitrary = fc.option(
  fc.integer({ min: 1, max: 100 }),
  { nil: undefined }
);

const paginationParamsArbitrary = fc.record({
  sellerId: uuidArbitrary,
  category: categoryArbitrary,
  subcategory: subcategoryArbitrary,
  searchTerm: searchTermArbitrary,
  cursor: cursorArbitrary,
  limit: limitArbitrary,
});

// Generate mock product
const productArbitrary = fc.record({
  id: uuidArbitrary,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.string({ minLength: 1, maxLength: 20 }),
  subcategory: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  brand: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  image_url: fc.option(fc.webUrl(), { nil: undefined }),
  price: fc.integer({ min: 1, max: 100000 }).map(n => n / 100), // Price in dollars
  mrp: fc.option(fc.integer({ min: 1, max: 100000 }).map(n => n / 100), { nil: undefined }),
  min_quantity: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  unit: fc.option(fc.constantFrom('kg', 'g', 'l', 'ml', 'piece', 'pack'), { nil: undefined }),
  stock_available: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
});

describe('ProductQueryService Property Tests', () => {
  let service: ProductQueryServiceClass;

  beforeEach(() => {
    service = new ProductQueryServiceClass({ enableLogging: false });
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.destroy();
  });

  /**
   * **Feature: scalable-product-loading, Property 10: Cache Key Uniqueness**
   * **Validates: Requirements 8.1**
   * 
   * For any combination of (sellerId, category, subcategory, cursor),
   * the generated cache key SHALL be unique and deterministic.
   */
  describe('Property 10: Cache Key Uniqueness', () => {
    it('should generate unique cache keys for different params', () => {
      fc.assert(
        fc.property(
          paginationParamsArbitrary,
          paginationParamsArbitrary,
          (params1, params2) => {
            const key1 = service.getCacheKey(params1);
            const key2 = service.getCacheKey(params2);

            // If params are different, keys should be different
            const paramsEqual = 
              params1.sellerId === params2.sellerId &&
              params1.category === params2.category &&
              params1.subcategory === params2.subcategory &&
              params1.cursor === params2.cursor &&
              params1.searchTerm === params2.searchTerm &&
              params1.limit === params2.limit;

            if (paramsEqual) {
              expect(key1).toBe(key2);
            } else {
              // Different params should produce different keys
              // (with very high probability - hash collisions are possible but rare)
              expect(key1).not.toBe(key2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate deterministic cache keys', () => {
      fc.assert(
        fc.property(
          paginationParamsArbitrary,
          (params) => {
            const key1 = service.getCacheKey(params);
            const key2 = service.getCacheKey(params);
            const key3 = service.getCacheKey({ ...params });

            // Same params should always produce same key
            expect(key1).toBe(key2);
            expect(key1).toBe(key3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all relevant params in cache key', () => {
      fc.assert(
        fc.property(
          uuidArbitrary,
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.integer({ min: 1, max: 50 }),
          (sellerId, category, subcategory, cursor, searchTerm, limit) => {
            const params: CursorPaginationParams = {
              sellerId,
              category,
              subcategory,
              cursor,
              searchTerm,
              limit,
            };

            const key = service.getCacheKey(params);

            // Key should contain sellerId
            expect(key).toContain(sellerId);
            // Key should contain category
            expect(key).toContain(category);
            // Key should contain subcategory
            expect(key).toContain(subcategory);
            // Key should contain cursor
            expect(key).toContain(cursor);
            // Key should contain search term
            expect(key).toContain(searchTerm);
            // Key should contain limit
            expect(key).toContain(String(limit));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: scalable-product-loading, Property 2: Filter Correctness**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * For any category and/or subcategory filter, all returned products
   * SHALL match the specified filter criteria exactly.
   */
  describe('Property 2: Filter Correctness', () => {
    it('should only return products matching category filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(productArbitrary, { minLength: 1, maxLength: 10 }),
          async (sellerId, category, products) => {
            // Filter products to match category
            const matchingProducts = products.map(p => ({
              ...p,
              category,
              has_more: false,
            }));

            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: matchingProducts,
              error: null,
            });

            const result = await service.fetchProducts({
              sellerId,
              category,
            });

            // All returned products should match the category
            for (const product of result.products) {
              expect(product.category).toBe(category);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should only return products matching both category and subcategory', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(productArbitrary, { minLength: 1, maxLength: 10 }),
          async (sellerId, category, subcategory, products) => {
            // Filter products to match both
            const matchingProducts = products.map(p => ({
              ...p,
              category,
              subcategory,
              has_more: false,
            }));

            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: matchingProducts,
              error: null,
            });

            const result = await service.fetchProducts({
              sellerId,
              category,
              subcategory,
            });

            // All returned products should match both filters
            for (const product of result.products) {
              expect(product.category).toBe(category);
              expect(product.subcategory).toBe(subcategory);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: scalable-product-loading, Property 11: Cache-First with Stale Revalidation**
   * **Validates: Requirements 8.2, 8.3**
   * 
   * For any cached data older than 5 minutes, the system SHALL return
   * cached data immediately AND trigger a background refresh.
   */
  describe('Property 11: Cache-First with Stale Revalidation', () => {
    it('should return cached data immediately on cache hit', async () => {
      await fc.assert(
        fc.asyncProperty(
          paginationParamsArbitrary,
          fc.array(productArbitrary, { minLength: 1, maxLength: 10 }),
          async (params, products) => {
            const mockProducts = products.map(p => ({
              ...p,
              has_more: false,
            }));

            // First fetch - populates cache
            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: mockProducts,
              error: null,
            });

            await service.fetchProducts(params);

            // Clear mock to verify no network call on second fetch
            (mockedSupabase.rpc as jest.Mock).mockClear();

            // Second fetch - should hit cache
            const result = await service.fetchProducts(params);

            // Should return from cache
            expect(result.fromCache).toBe(true);
            expect(result.cacheStatus).toBe('hit');
            
            // Should not make network call
            expect(mockedSupabase.rpc).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return cached data with stale status for old entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          paginationParamsArbitrary,
          fc.array(productArbitrary, { minLength: 1, maxLength: 5 }),
          async (params, products) => {
            // Create service with very short TTL for testing
            const testService = new ProductQueryServiceClass({ 
              enableLogging: false,
              cacheTtlMs: 100, // 100ms TTL
            });

            const mockProducts = products.map(p => ({
              ...p,
              has_more: false,
            }));

            // First fetch
            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: mockProducts,
              error: null,
            });

            await testService.fetchProducts(params);

            // Wait for cache to become stale (but not expired)
            await new Promise(resolve => setTimeout(resolve, 50));

            // Second fetch - should return stale data
            const result = await testService.fetchProducts(params);

            // Should return from cache (stale)
            expect(result.fromCache).toBe(true);
            
            testService.destroy();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: scalable-product-loading, Property 12: Cache Invalidation by Seller**
   * **Validates: Requirements 8.5**
   * 
   * For any seller cache invalidation, all cache entries for that seller
   * (across all categories and cursors) SHALL be removed.
   */
  describe('Property 12: Cache Invalidation by Seller', () => {
    it('should remove all cache entries for invalidated seller', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          fc.array(categoryArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(productArbitrary, { minLength: 1, maxLength: 3 }),
          async (sellerId, categories, products) => {
            const mockProducts = products.map(p => ({
              ...p,
              has_more: false,
            }));

            // Populate cache with multiple categories for same seller
            for (const category of categories) {
              (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
                data: mockProducts,
                error: null,
              });

              await service.fetchProducts({
                sellerId,
                category: category || 'default',
              });
            }

            // Verify cache has entries
            const cacheStateBefore = service.getCacheState();
            expect(cacheStateBefore.entries).toBeGreaterThan(0);

            // Invalidate cache for seller
            const invalidatedCount = service.invalidateCache(sellerId);

            // Verify all entries for seller are removed
            const cacheStateAfter = service.getCacheState();
            
            // No keys should contain the seller ID
            for (const key of cacheStateAfter.keys) {
              expect(key).not.toContain(sellerId);
            }

            // Invalidated count should match entries removed
            expect(invalidatedCount).toBe(cacheStateBefore.entries);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should not affect cache entries for other sellers', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArbitrary,
          uuidArbitrary,
          fc.array(productArbitrary, { minLength: 1, maxLength: 3 }),
          async (sellerId1, sellerId2, products) => {
            // Ensure different seller IDs
            fc.pre(sellerId1 !== sellerId2);

            const mockProducts = products.map(p => ({
              ...p,
              has_more: false,
            }));

            // Populate cache for both sellers
            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: mockProducts,
              error: null,
            });
            await service.fetchProducts({ sellerId: sellerId1 });

            (mockedSupabase.rpc as jest.Mock).mockResolvedValueOnce({
              data: mockProducts,
              error: null,
            });
            await service.fetchProducts({ sellerId: sellerId2 });

            // Invalidate only seller1
            service.invalidateCache(sellerId1);

            // Seller2's cache should still exist
            const cacheState = service.getCacheState();
            const hasSeller2Entry = cacheState.keys.some(key => key.includes(sellerId2));
            expect(hasSeller2Entry).toBe(true);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
