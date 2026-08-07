/**
 * Unit Tests for Cache Warming on App Start
 * 
 * **Feature: fast-product-loading, Task 14.3**
 * **Validates: Requirements 7.5**
 * 
 * Tests that cache warming loads correct sellers and respects the limit of 5 sellers.
 */

import { ProductCacheServiceClass, Product } from '../../services/products/ProductCacheService';

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string | null> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach(key => delete mockAsyncStorage[key]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockAsyncStorage))),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

// Mock Supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(function() { return this; }),
        ilike: jest.fn(function() { return this; }),
        range: jest.fn(function() { return this; }),
        order: jest.fn(() => Promise.resolve({ 
          data: [], 
          error: null, 
          count: 0 
        })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC not available' } })),
  },
}));

// Suppress console.log during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});


// Helper to create mock products
const createMockProducts = (count: number, sellerId: string): Product[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `product-${sellerId}-${i}`,
    name: `Product ${i}`,
    category: 'Test Category',
    price: 100 + i,
    seller_id: sellerId,
    stock_available: 10,
    min_quantity: 1,
    unit: 'piece',
  }));
};

// Helper to populate AsyncStorage cache for a seller
const populateSellerCache = (
  cacheService: ProductCacheServiceClass,
  sellerId: string,
  products: Product[],
  timestamp?: number
) => {
  const cacheKey = cacheService.getCacheKey({ sellerId, limit: 20 });
  const cacheEntry = {
    products,
    totalCount: products.length,
    timestamp: timestamp || Date.now(),
    queryKey: cacheKey,
  };
  mockAsyncStorage[cacheKey] = JSON.stringify(cacheEntry);
};

describe('Cache Warming Unit Tests', () => {
  let cacheService: ProductCacheServiceClass;

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    
    // Create fresh instance
    cacheService = new ProductCacheServiceClass();
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    cacheService.destroy();
  });

  describe('warmCache', () => {
    it('should warm memory cache for provided seller IDs', async () => {
      // Setup: Create cached data for 3 sellers
      const sellerIds = ['seller-1', 'seller-2', 'seller-3'];
      
      for (const sellerId of sellerIds) {
        const products = createMockProducts(5, sellerId);
        populateSellerCache(cacheService, sellerId, products);
      }
      
      // Ensure memory cache is empty
      cacheService.clearMemoryCache();
      
      // Act: Warm cache
      await cacheService.warmCache(sellerIds);
      
      // Assert: All 3 sellers should be in memory cache
      for (const sellerId of sellerIds) {
        const cacheKey = cacheService.getCacheKey({ sellerId, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(true);
      }
    });

    it('should limit warming to 5 sellers maximum', async () => {
      // Setup: Create cached data for 8 sellers
      const sellerIds = Array.from({ length: 8 }, (_, i) => `seller-${i}`);
      
      for (const sellerId of sellerIds) {
        const products = createMockProducts(5, sellerId);
        populateSellerCache(cacheService, sellerId, products);
      }
      
      cacheService.clearMemoryCache();
      
      // Act: Warm cache with all 8 sellers
      await cacheService.warmCache(sellerIds);
      
      // Assert: Only first 5 should be warmed
      const first5 = sellerIds.slice(0, 5);
      const remaining = sellerIds.slice(5);
      
      for (const sellerId of first5) {
        const cacheKey = cacheService.getCacheKey({ sellerId, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(true);
      }
      
      for (const sellerId of remaining) {
        const cacheKey = cacheService.getCacheKey({ sellerId, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(false);
      }
    });

    it('should skip sellers without cached data', async () => {
      // Setup: Only create cache for seller-1 and seller-3
      const products1 = createMockProducts(5, 'seller-1');
      const products3 = createMockProducts(5, 'seller-3');
      
      populateSellerCache(cacheService, 'seller-1', products1);
      populateSellerCache(cacheService, 'seller-3', products3);
      
      cacheService.clearMemoryCache();
      
      // Act: Try to warm cache for 3 sellers (seller-2 has no cache)
      await cacheService.warmCache(['seller-1', 'seller-2', 'seller-3']);
      
      // Assert: Only seller-1 and seller-3 should be warmed
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-1', limit: 20 }))).toBe(true);
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-2', limit: 20 }))).toBe(false);
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-3', limit: 20 }))).toBe(true);
    });

    it('should skip expired cache entries', async () => {
      // Setup: Create fresh and expired cache entries
      const freshProducts = createMockProducts(5, 'seller-fresh');
      const expiredProducts = createMockProducts(5, 'seller-expired');
      
      populateSellerCache(cacheService, 'seller-fresh', freshProducts, Date.now());
      // 35 minutes ago - past the 30 minute stale TTL
      populateSellerCache(cacheService, 'seller-expired', expiredProducts, Date.now() - 35 * 60 * 1000);
      
      cacheService.clearMemoryCache();
      
      // Act: Warm cache
      await cacheService.warmCache(['seller-fresh', 'seller-expired']);
      
      // Assert: Only fresh entry should be warmed
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-fresh', limit: 20 }))).toBe(true);
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-expired', limit: 20 }))).toBe(false);
    });

    it('should handle empty seller list gracefully', async () => {
      // Act: Warm cache with empty list
      await cacheService.warmCache([]);
      
      // Assert: No errors, memory cache should be empty
      const stats = cacheService.getMemoryCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should use recently viewed sellers when no IDs provided', async () => {
      // Setup: Track some recently viewed sellers
      await cacheService.trackRecentlyViewed('seller-recent-1');
      await cacheService.trackRecentlyViewed('seller-recent-2');
      
      // Create cache for these sellers
      populateSellerCache(cacheService, 'seller-recent-1', createMockProducts(5, 'seller-recent-1'));
      populateSellerCache(cacheService, 'seller-recent-2', createMockProducts(5, 'seller-recent-2'));
      
      cacheService.clearMemoryCache();
      
      // Act: Warm cache without providing IDs
      await cacheService.warmCache();
      
      // Assert: Recently viewed sellers should be warmed
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-recent-2', limit: 20 }))).toBe(true);
      expect(cacheService.hasInMemory(cacheService.getCacheKey({ sellerId: 'seller-recent-1', limit: 20 }))).toBe(true);
    });
  });


  describe('trackRecentlyViewed', () => {
    it('should add seller to recently viewed list', async () => {
      // Act: Track a seller
      await cacheService.trackRecentlyViewed('seller-1');
      
      // Assert: Seller should be in recently viewed
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      expect(recentlyViewed).toContain('seller-1');
    });

    it('should maintain order with most recent first', async () => {
      // Act: Track sellers in order
      await cacheService.trackRecentlyViewed('seller-1');
      await cacheService.trackRecentlyViewed('seller-2');
      await cacheService.trackRecentlyViewed('seller-3');
      
      // Assert: Most recent should be first
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      expect(recentlyViewed[0]).toBe('seller-3');
      expect(recentlyViewed[1]).toBe('seller-2');
      expect(recentlyViewed[2]).toBe('seller-1');
    });

    it('should move existing seller to front when re-viewed', async () => {
      // Setup: Track sellers
      await cacheService.trackRecentlyViewed('seller-1');
      await cacheService.trackRecentlyViewed('seller-2');
      await cacheService.trackRecentlyViewed('seller-3');
      
      // Act: Re-view seller-1
      await cacheService.trackRecentlyViewed('seller-1');
      
      // Assert: seller-1 should now be first
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      expect(recentlyViewed[0]).toBe('seller-1');
      expect(recentlyViewed.length).toBe(3); // No duplicates
    });

    it('should limit to 10 entries', async () => {
      // Act: Track 15 sellers
      for (let i = 0; i < 15; i++) {
        await cacheService.trackRecentlyViewed(`seller-${i}`);
      }
      
      // Assert: Should only have 10 entries
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      expect(recentlyViewed.length).toBe(10);
      
      // Most recent should be first
      expect(recentlyViewed[0]).toBe('seller-14');
      
      // Oldest should be dropped
      expect(recentlyViewed).not.toContain('seller-0');
      expect(recentlyViewed).not.toContain('seller-4');
    });

    it('should not create duplicates', async () => {
      // Act: Track same seller multiple times
      await cacheService.trackRecentlyViewed('seller-1');
      await cacheService.trackRecentlyViewed('seller-1');
      await cacheService.trackRecentlyViewed('seller-1');
      
      // Assert: Should only have one entry
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      expect(recentlyViewed.length).toBe(1);
      expect(recentlyViewed[0]).toBe('seller-1');
    });
  });

  describe('getRecentlyViewedSellers', () => {
    it('should return empty array when no sellers tracked', async () => {
      // Clear any existing data
      delete mockAsyncStorage['recently_viewed_wholesalers'];
      
      // Act
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      
      // Assert
      expect(recentlyViewed).toEqual([]);
    });

    it('should return tracked sellers in correct order', async () => {
      // Setup: Track sellers
      await cacheService.trackRecentlyViewed('seller-a');
      await cacheService.trackRecentlyViewed('seller-b');
      await cacheService.trackRecentlyViewed('seller-c');
      
      // Act
      const recentlyViewed = await cacheService.getRecentlyViewedSellers();
      
      // Assert: Most recent first
      expect(recentlyViewed).toEqual(['seller-c', 'seller-b', 'seller-a']);
    });
  });

  describe('Integration: Cache Warming with Recently Viewed', () => {
    it('should warm cache for recently viewed sellers on app start simulation', async () => {
      // Simulate user viewing wholesalers during previous session
      await cacheService.trackRecentlyViewed('wholesaler-1');
      await cacheService.trackRecentlyViewed('wholesaler-2');
      await cacheService.trackRecentlyViewed('wholesaler-3');
      
      // Create cached product data for these wholesalers
      for (const id of ['wholesaler-1', 'wholesaler-2', 'wholesaler-3']) {
        populateSellerCache(cacheService, id, createMockProducts(10, id));
      }
      
      // Simulate app restart - clear memory cache
      cacheService.clearMemoryCache();
      
      // Simulate app start - warm cache
      await cacheService.warmCache();
      
      // Assert: All recently viewed wholesalers should be in memory cache
      for (const id of ['wholesaler-1', 'wholesaler-2', 'wholesaler-3']) {
        const cacheKey = cacheService.getCacheKey({ sellerId: id, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(true);
        
        // Verify data is correct
        const cachedData = cacheService.getFromMemory(cacheKey);
        expect(cachedData).not.toBeNull();
        expect(cachedData?.products.length).toBe(10);
      }
    });

    it('should prioritize most recently viewed sellers when warming', async () => {
      // Track 8 sellers (more than the 5 limit)
      for (let i = 0; i < 8; i++) {
        await cacheService.trackRecentlyViewed(`seller-${i}`);
        populateSellerCache(cacheService, `seller-${i}`, createMockProducts(5, `seller-${i}`));
      }
      
      cacheService.clearMemoryCache();
      
      // Warm cache
      await cacheService.warmCache();
      
      // Assert: Only the 5 most recent should be warmed (seller-7 through seller-3)
      // seller-7 is most recent, seller-0 is oldest
      for (let i = 7; i >= 3; i--) {
        const cacheKey = cacheService.getCacheKey({ sellerId: `seller-${i}`, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(true);
      }
      
      // Older sellers should not be warmed
      for (let i = 2; i >= 0; i--) {
        const cacheKey = cacheService.getCacheKey({ sellerId: `seller-${i}`, limit: 20 });
        expect(cacheService.hasInMemory(cacheKey)).toBe(false);
      }
    });
  });
});
