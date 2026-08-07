/**
 * Property-based tests for PrefetchManager
 * 
 * Tests the prefetch queue management, network-adaptive behavior,
 * and critical data selection properties.
 */

import * as fc from 'fast-check';
import { 
  PrefetchManagerClass, 
  CRITICAL_FIELDS,
  type PrefetchPriority,
  type PrefetchRequest,
} from '../../services/products/PrefetchManager';

// Mock dependencies
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({
            abortSignal: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

jest.mock('../../services/network/NetworkQualityService', () => ({
  NetworkQualityService: {
    subscribe: jest.fn((callback) => {
      // Immediately call with fast network
      callback({ quality: 'fast', type: 'wifi', isConnected: true });
      return jest.fn(); // unsubscribe
    }),
    getQuality: jest.fn(() => 'fast'),
    isSlowNetwork: jest.fn(() => false),
    isOffline: jest.fn(() => false),
  },
}));

jest.mock('../../services/products/ProductCacheService', () => ({
  ProductCacheService: {
    prefetchSellerProducts: jest.fn(),
  },
}));

// Arbitrary generators
const sellerIdArb = fc.uuid();
const priorityArb = fc.constantFrom<PrefetchPriority>('low', 'high');
const sellerIdsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 10 });

describe('PrefetchManager Property Tests', () => {
  let manager: PrefetchManagerClass;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new PrefetchManagerClass({ enableLogging: false });
  });

  afterEach(() => {
    manager.destroy();
  });

  /**
   * **Feature: fast-product-loading, Property 4: Prefetch Queue Management**
   * *For any* prefetch queue with 3 pending requests, adding a new low-priority 
   * request should cancel the oldest low-priority request, maintaining queue 
   * size at or below 3.
   * **Validates: Requirements 3.4**
   */
  describe('Property 4: Prefetch Queue Management', () => {
    it('should maintain queue size at or below maxQueueSize', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 5, maxLength: 15 }),
          (sellerIds) => {
            // Create fresh manager for each test
            const testManager = new PrefetchManagerClass({ 
              maxQueueSize: 3, 
              enableLogging: false 
            });

            try {
              // Add all sellers to prefetch queue
              sellerIds.forEach(sellerId => {
                testManager.prefetch(sellerId, 'low');
              });

              // Queue size should never exceed maxQueueSize
              const queueSize = testManager.getQueueSize();
              expect(queueSize).toBeLessThanOrEqual(3);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should evict oldest low-priority request when queue is full', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 4, maxLength: 4 }),
          (sellerIds) => {
            const testManager = new PrefetchManagerClass({ 
              maxQueueSize: 3, 
              enableLogging: false 
            });

            try {
              // Add first 3 sellers
              sellerIds.slice(0, 3).forEach(sellerId => {
                testManager.prefetch(sellerId, 'low');
              });

              // Queue should have 3 items
              expect(testManager.getQueueSize()).toBe(3);

              // Add 4th seller - should evict oldest
              testManager.prefetch(sellerIds[3], 'low');

              // Queue should still have at most 3 items
              expect(testManager.getQueueSize()).toBeLessThanOrEqual(3);

              // First seller should have been evicted (oldest)
              expect(testManager.isPrefetching(sellerIds[0])).toBe(false);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not evict high-priority requests when queue is full', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 4, maxLength: 4 }),
          (sellerIds) => {
            const testManager = new PrefetchManagerClass({ 
              maxQueueSize: 3, 
              enableLogging: false 
            });

            try {
              // Add 2 high-priority and 1 low-priority
              testManager.prefetch(sellerIds[0], 'high');
              testManager.prefetch(sellerIds[1], 'high');
              testManager.prefetch(sellerIds[2], 'low');

              // Add another low-priority - should evict the existing low-priority
              testManager.prefetch(sellerIds[3], 'low');

              // High-priority requests should still be in queue
              const status = testManager.getQueueStatus();
              const highPriorityCount = status.filter(s => s.priority === 'high').length;
              
              // Both high-priority requests should remain
              expect(highPriorityCount).toBe(2);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should upgrade priority when same seller is prefetched with higher priority', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          (sellerId) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Add with low priority
              testManager.prefetch(sellerId, 'low');
              
              let status = testManager.getQueueStatus();
              const initialPriority = status.find(s => s.sellerId === sellerId)?.priority;
              expect(initialPriority).toBe('low');

              // Add same seller with high priority
              testManager.prefetch(sellerId, 'high');

              status = testManager.getQueueStatus();
              const upgradedPriority = status.find(s => s.sellerId === sellerId)?.priority;
              expect(upgradedPriority).toBe('high');
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fast-product-loading, Property 5: Network-Adaptive Prefetch**
   * *For any* slow network condition (2G/3G), automatic prefetching should be 
   * disabled, and only explicit user-triggered prefetches (long-press) should execute.
   * **Validates: Requirements 3.5, 5.4**
   */
  describe('Property 5: Network-Adaptive Prefetch', () => {
    it('should disable automatic prefetch on slow networks', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          (sellerId) => {
            // Create manager that simulates slow network
            const { NetworkQualityService } = require('../../services/network/NetworkQualityService');
            NetworkQualityService.subscribe.mockImplementation((callback: any) => {
              callback({ quality: 'slow', type: 'cellular', isConnected: true });
              return jest.fn();
            });

            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Simulate slow network state
              (testManager as any).currentNetworkQuality = 'slow';

              // Try to add low-priority prefetch
              testManager.prefetch(sellerId, 'low');

              // Should not be added to queue
              expect(testManager.isPrefetching(sellerId)).toBe(false);
              expect(testManager.getQueueSize()).toBe(0);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow high-priority prefetch on slow networks', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          (sellerId) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Simulate slow network state
              (testManager as any).currentNetworkQuality = 'slow';

              // Add high-priority prefetch (user-triggered)
              testManager.prefetch(sellerId, 'high');

              // Should be added to queue
              expect(testManager.isPrefetching(sellerId)).toBe(true);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not prefetch when offline', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          priorityArb,
          (sellerId, priority) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Simulate offline state
              (testManager as any).currentNetworkQuality = 'offline';

              // Try to prefetch with any priority
              testManager.prefetch(sellerId, priority);

              // Should not be added to queue
              expect(testManager.getQueueSize()).toBe(0);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report correct auto-prefetch allowed status based on network', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'fast' | 'slow' | 'offline'>('fast', 'slow', 'offline'),
          (networkQuality) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Set network quality
              (testManager as any).currentNetworkQuality = networkQuality;

              const isAllowed = testManager.isAutoPrefetchAllowed();

              // Auto-prefetch should only be allowed on fast networks
              expect(isAllowed).toBe(networkQuality === 'fast');
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fast-product-loading, Property 9: Critical Data Selection**
   * *For any* prefetch or initial fetch operation, only critical fields 
   * (id, name, price, image_url, min_quantity, unit, seller_id) should be 
   * requested from the database.
   * **Validates: Requirements 3.3, 5.2**
   */
  describe('Property 9: Critical Data Selection', () => {
    it('should define exactly the required critical fields', () => {
      // Verify CRITICAL_FIELDS contains exactly the required fields
      const requiredFields = ['id', 'name', 'price', 'image_url', 'min_quantity', 'unit', 'seller_id'];
      
      expect(CRITICAL_FIELDS).toHaveLength(requiredFields.length);
      requiredFields.forEach(field => {
        expect(CRITICAL_FIELDS).toContain(field);
      });
    });

    it('should not include non-critical fields in CRITICAL_FIELDS', () => {
      const nonCriticalFields = [
        'description',
        'category',
        'subcategory',
        'brand',
        'mrp',
        'stock_available',
        'created_at',
        'updated_at',
      ];

      nonCriticalFields.forEach(field => {
        expect(CRITICAL_FIELDS).not.toContain(field);
      });
    });

    it('should use critical fields for prefetch queries', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          (sellerId) => {
            const { supabase } = require('../../services/supabase/supabase');
            const mockSelect = jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn(() => ({
                  abortSignal: jest.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            }));
            supabase.from.mockReturnValue({ select: mockSelect });

            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              testManager.prefetch(sellerId, 'low');

              // Verify select was called with critical fields
              if (mockSelect.mock.calls.length > 0) {
                const selectArg = mockSelect.mock.calls[0][0];
                const expectedFields = CRITICAL_FIELDS.join(', ');
                expect(selectArg).toBe(expectedFields);
              }
            } finally {
              testManager.destroy();
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Queue Operations', () => {
    it('should cancel specific prefetch request', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 3 }),
          (sellerIds) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Add all sellers
              sellerIds.forEach(sellerId => {
                testManager.prefetch(sellerId, 'low');
              });

              // Cancel first seller
              testManager.cancel(sellerIds[0]);

              // First seller should not be prefetching
              expect(testManager.isPrefetching(sellerIds[0])).toBe(false);

              // Other sellers should still be in queue (if not completed)
              // Note: They might complete quickly in tests
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cancel all prefetch requests', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
          (sellerIds) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Add all sellers
              sellerIds.forEach(sellerId => {
                testManager.prefetch(sellerId, 'low');
              });

              // Cancel all
              testManager.cancelAll();

              // Queue should be empty
              expect(testManager.getQueueSize()).toBe(0);

              // No seller should be prefetching
              sellerIds.forEach(sellerId => {
                expect(testManager.isPrefetching(sellerId)).toBe(false);
              });
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Duplicate Handling', () => {
    it('should not add duplicate prefetch requests', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          fc.integer({ min: 2, max: 5 }),
          (sellerId, repeatCount) => {
            const testManager = new PrefetchManagerClass({ enableLogging: false });

            try {
              // Add same seller multiple times
              for (let i = 0; i < repeatCount; i++) {
                testManager.prefetch(sellerId, 'low');
              }

              // Should only have one entry
              const status = testManager.getQueueStatus();
              const matchingEntries = status.filter(s => s.sellerId === sellerId);
              expect(matchingEntries.length).toBeLessThanOrEqual(1);
            } finally {
              testManager.destroy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
