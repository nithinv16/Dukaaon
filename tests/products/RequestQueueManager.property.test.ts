/**
 * Property-based tests for RequestQueueManager
 * 
 * Tests request deduplication, cancellation, and queue management properties.
 */

import * as fc from 'fast-check';
import { 
  RequestQueueManagerClass, 
  generateCacheKey,
  type CursorPaginationParams,
  type CursorPaginationResult,
} from '../../services/products/RequestQueueManager';

// Arbitrary generators for test data
const sellerIdArb = fc.uuid();
const categoryArb = fc.option(fc.constantFrom('Electronics', 'Groceries', 'Clothing', 'Home', 'Beauty'), { nil: undefined });
const subcategoryArb = fc.option(fc.constantFrom('Phones', 'Laptops', 'Snacks', 'Beverages', 'Shirts'), { nil: undefined });
const searchTermArb = fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined });
const cursorArb = fc.option(fc.uuid(), { nil: undefined });
const limitArb = fc.option(fc.integer({ min: 10, max: 50 }), { nil: undefined });

// Generate valid CursorPaginationParams
const paramsArb = fc.record({
  sellerId: sellerIdArb,
  category: categoryArb,
  subcategory: subcategoryArb,
  searchTerm: searchTermArb,
  cursor: cursorArb,
  limit: limitArb,
});

// Mock executor that resolves after a delay
const createMockExecutor = (delay: number = 10, result?: Partial<CursorPaginationResult>) => {
  return (signal: AbortSignal): Promise<CursorPaginationResult> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        resolve({
          products: result?.products || [],
          nextCursor: result?.nextCursor || null,
          hasMore: result?.hasMore || false,
          fromCache: result?.fromCache || false,
        });
      }, delay);

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  };
};

describe('RequestQueueManager Property Tests', () => {
  let manager: RequestQueueManagerClass;

  beforeEach(() => {
    manager = new RequestQueueManagerClass({ enableLogging: false });
  });

  afterEach(() => {
    manager.cancelAll();
    manager.clear();
  });

  /**
   * **Feature: scalable-product-loading, Property 5: Request Deduplication**
   * *For any* set of concurrent identical requests (same params), only one 
   * network call SHALL be made and all callers SHALL receive the same result.
   * **Validates: Requirements 5.1**
   */
  describe('Property 5: Request Deduplication', () => {
    it('should return same promise for identical concurrent requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          paramsArb,
          fc.integer({ min: 2, max: 5 }),
          async (params, requestCount) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            let executorCallCount = 0;

            const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
              executorCallCount++;
              return createMockExecutor(20, { products: [{ id: '1' }] as any })(signal);
            };

            try {
              // Make multiple identical requests concurrently
              const requests = Array(requestCount).fill(null).map(() => 
                testManager.enqueue(params, executor)
              );

              // All should return the same promise reference
              const firstPromise = requests[0].promise;
              for (let i = 1; i < requests.length; i++) {
                expect(requests[i].promise).toBe(firstPromise);
              }

              // Wait for completion
              await Promise.all(requests.map(r => r.promise.catch(() => {})));

              // Executor should only be called once
              expect(executorCallCount).toBe(1);
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should make separate calls for different params', async () => {
      await fc.assert(
        fc.asyncProperty(
          paramsArb,
          paramsArb,
          async (params1, params2) => {
            // Ensure params are different
            const key1 = generateCacheKey(params1);
            const key2 = generateCacheKey(params2);
            
            if (key1 === key2) {
              // Skip if params happen to be identical
              return;
            }

            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            let executorCallCount = 0;

            const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
              executorCallCount++;
              return createMockExecutor(10)(signal);
            };

            try {
              // Make requests with different params
              const request1 = testManager.enqueue(params1, executor);
              const request2 = testManager.enqueue(params2, executor);

              // Should be different promises
              expect(request1.promise).not.toBe(request2.promise);

              // Wait for completion
              await Promise.all([
                request1.promise.catch(() => {}),
                request2.promise.catch(() => {}),
              ]);

              // Executor should be called twice
              expect(executorCallCount).toBe(2);
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow new request after previous completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          paramsArb,
          async (params) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            let executorCallCount = 0;

            const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
              executorCallCount++;
              return createMockExecutor(5)(signal);
            };

            try {
              // First request
              const request1 = testManager.enqueue(params, executor);
              await request1.promise;
              
              // Wait for cleanup to complete (finally block runs async)
              await new Promise(resolve => setTimeout(resolve, 10));

              // Second request after first completes
              const request2 = testManager.enqueue(params, executor);
              await request2.promise;

              // Both should have executed
              expect(executorCallCount).toBe(2);
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: scalable-product-loading, Property 10: Cache Key Uniqueness**
   * *For any* combination of (sellerId, category, subcategory, cursor), the 
   * generated cache key SHALL be unique and deterministic.
   * **Validates: Requirements 8.1**
   */
  describe('Property 10: Cache Key Uniqueness', () => {
    it('should generate deterministic cache keys', () => {
      fc.assert(
        fc.property(
          paramsArb,
          (params) => {
            const key1 = generateCacheKey(params);
            const key2 = generateCacheKey(params);
            
            // Same params should always produce same key
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique keys for different params', () => {
      fc.assert(
        fc.property(
          paramsArb,
          paramsArb,
          (params1, params2) => {
            const key1 = generateCacheKey(params1);
            const key2 = generateCacheKey(params2);
            
            // If any param differs, keys should differ
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
              expect(key1).not.toBe(key2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all relevant params in cache key', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          (sellerId) => {
            // Different categories should produce different keys
            const key1 = generateCacheKey({ sellerId, category: 'Electronics' });
            const key2 = generateCacheKey({ sellerId, category: 'Groceries' });
            expect(key1).not.toBe(key2);

            // Different cursors should produce different keys
            const key3 = generateCacheKey({ sellerId, cursor: 'cursor1' });
            const key4 = generateCacheKey({ sellerId, cursor: 'cursor2' });
            expect(key3).not.toBe(key4);

            // Different search terms should produce different keys
            const key5 = generateCacheKey({ sellerId, searchTerm: 'phone' });
            const key6 = generateCacheKey({ sellerId, searchTerm: 'laptop' });
            expect(key5).not.toBe(key6);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Queue State Management', () => {
    it('should track in-flight status correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          paramsArb,
          async (params) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(20);

            try {
              // Before enqueue, should not be in-flight
              expect(testManager.isInFlight(params)).toBe(false);

              // Enqueue request
              const { promise } = testManager.enqueue(params, executor);

              // Should be in-flight
              expect(testManager.isInFlight(params)).toBe(true);

              // Wait for completion
              await promise;
              
              // Wait for cleanup to complete (finally block runs async)
              await new Promise(resolve => setTimeout(resolve, 10));

              // Should no longer be in-flight
              expect(testManager.isInFlight(params)).toBe(false);
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track pending count correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(paramsArb, { minLength: 1, maxLength: 5 }),
          async (paramsArray) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(100);

            // Filter to unique params
            const uniqueParams = paramsArray.filter((p, i, arr) => 
              arr.findIndex(x => generateCacheKey(x) === generateCacheKey(p)) === i
            );

            try {
              // Enqueue all requests
              uniqueParams.forEach(params => {
                testManager.enqueue(params, executor);
              });

              // Pending count should match unique params
              expect(testManager.getPendingCount()).toBe(uniqueParams.length);

              // Cancel all and verify
              testManager.cancelAll();
              expect(testManager.getPendingCount()).toBe(0);
            } finally {
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('RequestQueueManager Cancellation Tests', () => {
  let manager: RequestQueueManagerClass;

  beforeEach(() => {
    manager = new RequestQueueManagerClass({ enableLogging: false });
  });

  afterEach(() => {
    manager.cancelAll();
    manager.clear();
  });

  /**
   * **Feature: scalable-product-loading, Property 4: Request Cancellation on Filter Change**
   * *For any* category change, all pending requests for the previous category 
   * SHALL be cancelled before the new request is initiated.
   * **Validates: Requirements 2.4, 5.2**
   */
  describe('Property 4: Request Cancellation on Filter Change', () => {
    it('should cancel all requests for a seller when category changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          sellerIdArb,
          fc.constantFrom('Electronics', 'Groceries', 'Clothing', 'Home', 'Beauty'),
          fc.constantFrom('Electronics', 'Groceries', 'Clothing', 'Home', 'Beauty'),
          async (sellerId, oldCategory, newCategory) => {
            // Ensure categories are different
            if (oldCategory === newCategory) {
              return;
            }

            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(200);

            try {
              // Create requests for old category
              const oldParams: CursorPaginationParams = { sellerId, category: oldCategory };
              testManager.enqueue(oldParams, executor);

              // Verify old request is in-flight
              expect(testManager.isInFlight(oldParams)).toBe(true);

              // Cancel all requests for the seller (simulating category change)
              const cancelledCount = testManager.cancelMatching({ sellerId });

              // Old request should be cancelled
              expect(cancelledCount).toBeGreaterThanOrEqual(1);
              expect(testManager.isInFlight(oldParams)).toBe(false);

              // New category request should work
              const newParams: CursorPaginationParams = { sellerId, category: newCategory };
              testManager.enqueue(newParams, executor);
              expect(testManager.isInFlight(newParams)).toBe(true);

              // Cleanup
              testManager.cancelAll();
            } finally {
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cancel requests matching seller pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          sellerIdArb,
          sellerIdArb,
          async (sellerId1, sellerId2) => {
            // Ensure sellers are different
            if (sellerId1 === sellerId2) {
              return;
            }

            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(200);

            try {
              // Create requests for both sellers
              const params1: CursorPaginationParams = { sellerId: sellerId1, category: 'Electronics' };
              const params2: CursorPaginationParams = { sellerId: sellerId2, category: 'Electronics' };

              testManager.enqueue(params1, executor);
              testManager.enqueue(params2, executor);

              // Both should be in-flight
              expect(testManager.getPendingCount()).toBe(2);

              // Cancel only seller1's requests
              const cancelledCount = testManager.cancelMatching({ sellerId: sellerId1 });

              // Only seller1's request should be cancelled
              expect(cancelledCount).toBe(1);
              expect(testManager.isInFlight(params1)).toBe(false);
              expect(testManager.isInFlight(params2)).toBe(true);
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cancel all except specified category', async () => {
      await fc.assert(
        fc.asyncProperty(
          sellerIdArb,
          fc.array(fc.constantFrom('Electronics', 'Groceries', 'Clothing', 'Home'), { minLength: 2, maxLength: 4 }),
          async (sellerId, categories) => {
            // Ensure unique categories
            const uniqueCategories = [...new Set(categories)];
            if (uniqueCategories.length < 2) {
              return;
            }

            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(200);

            try {
              // Create requests for all categories
              uniqueCategories.forEach(category => {
                testManager.enqueue({ sellerId, category }, executor);
              });

              // All should be in-flight
              expect(testManager.getPendingCount()).toBe(uniqueCategories.length);

              // Cancel all except first category
              const keepCategory = uniqueCategories[0];
              const cancelledCount = testManager.cancelAllExcept(sellerId, keepCategory);

              // All except keepCategory should be cancelled
              expect(cancelledCount).toBe(uniqueCategories.length - 1);
              expect(testManager.isInFlight({ sellerId, category: keepCategory })).toBe(true);

              // Other categories should be cancelled
              uniqueCategories.slice(1).forEach(category => {
                expect(testManager.isInFlight({ sellerId, category })).toBe(false);
              });
            } finally {
              testManager.cancelAll();
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use AbortController for cancellation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paramsArb,
          async (params) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            let wasAborted = false;

            const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
              return new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => {
                  wasAborted = true;
                  // Abort errors are silently handled by RequestQueueManager
                  reject(new DOMException('Aborted', 'AbortError'));
                });

                setTimeout(() => {
                  if (!signal.aborted) {
                    resolve({ products: [], nextCursor: null, hasMore: false, fromCache: false });
                  }
                }, 100);
              });
            };

            try {
              const { requestId } = testManager.enqueue(params, executor);

              // Cancel the request
              testManager.cancel(requestId);

              // Wait a bit for abort to propagate
              await new Promise(resolve => setTimeout(resolve, 30));

              // AbortController should have been triggered
              expect(wasAborted).toBe(true);
            } finally {
              testManager.clear();
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });

  describe('Cancel All Requests', () => {
    it('should cancel all pending requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(paramsArb, { minLength: 1, maxLength: 5 }),
          async (paramsArray) => {
            const testManager = new RequestQueueManagerClass({ enableLogging: false });
            const executor = createMockExecutor(200);

            // Filter to unique params
            const uniqueParams = paramsArray.filter((p, i, arr) => 
              arr.findIndex(x => generateCacheKey(x) === generateCacheKey(p)) === i
            );

            try {
              // Enqueue all requests
              uniqueParams.forEach(params => {
                testManager.enqueue(params, executor);
              });

              // Verify all are in-flight
              expect(testManager.getPendingCount()).toBe(uniqueParams.length);

              // Cancel all
              const cancelledCount = testManager.cancelAll();

              // All should be cancelled
              expect(cancelledCount).toBe(uniqueParams.length);
              expect(testManager.getPendingCount()).toBe(0);
              expect(testManager.isEmpty()).toBe(true);
            } finally {
              testManager.clear();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
