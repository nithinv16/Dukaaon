/**
 * Unit tests for RequestQueueManager
 * 
 * Tests specific examples, edge cases, and error conditions for
 * request queue management, deduplication, and cancellation.
 */

import { 
  RequestQueueManagerClass, 
  generateCacheKey,
  type CursorPaginationParams,
  type CursorPaginationResult,
} from '../../services/products/RequestQueueManager';

// Helper to create mock executor
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

describe('RequestQueueManager Unit Tests', () => {
  let manager: RequestQueueManagerClass;

  beforeEach(() => {
    manager = new RequestQueueManagerClass({ enableLogging: false });
  });

  afterEach(() => {
    manager.cancelAll();
    manager.clear();
  });

  describe('generateCacheKey', () => {
    it('should generate key with all params', () => {
      const params: CursorPaginationParams = {
        sellerId: 'seller-123',
        category: 'Electronics',
        subcategory: 'Phones',
        cursor: 'cursor-abc',
        searchTerm: 'iphone',
        limit: 20,
      };

      const key = generateCacheKey(params);

      expect(key).toContain('seller-123');
      expect(key).toContain('Electronics');
      expect(key).toContain('Phones');
      expect(key).toContain('cursor-abc');
      expect(key).toContain('iphone');
      expect(key).toContain('20');
    });

    it('should use defaults for missing optional params', () => {
      const params: CursorPaginationParams = {
        sellerId: 'seller-123',
      };

      const key = generateCacheKey(params);

      expect(key).toContain('seller-123');
      expect(key).toContain('all'); // default for category
      expect(key).toContain('start'); // default for cursor
      expect(key).toContain('nosearch'); // default for no search
    });

    it('should produce different keys for different sellers', () => {
      const key1 = generateCacheKey({ sellerId: 'seller-1' });
      const key2 = generateCacheKey({ sellerId: 'seller-2' });

      expect(key1).not.toBe(key2);
    });

    it('should produce different keys for different categories', () => {
      const key1 = generateCacheKey({ sellerId: 'seller-1', category: 'Electronics' });
      const key2 = generateCacheKey({ sellerId: 'seller-1', category: 'Groceries' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('enqueue', () => {
    it('should enqueue a request and return promise', async () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      const executor = createMockExecutor(10, { products: [{ id: '1' }] as any });

      const { promise, requestId, abortController } = manager.enqueue(params, executor);

      expect(promise).toBeInstanceOf(Promise);
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req_/);
      expect(abortController).toBeInstanceOf(AbortController);

      const result = await promise;
      expect(result.products).toHaveLength(1);
    });

    it('should track request as in-flight', () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      const executor = createMockExecutor(100);

      expect(manager.isInFlight(params)).toBe(false);

      manager.enqueue(params, executor);

      expect(manager.isInFlight(params)).toBe(true);
    });

    it('should increment pending count', () => {
      const executor = createMockExecutor(100);

      expect(manager.getPendingCount()).toBe(0);

      manager.enqueue({ sellerId: 'seller-1' }, executor);
      expect(manager.getPendingCount()).toBe(1);

      manager.enqueue({ sellerId: 'seller-2' }, executor);
      expect(manager.getPendingCount()).toBe(2);
    });
  });

  describe('deduplication', () => {
    it('should return same promise for identical params', () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123', category: 'Electronics' };
      const executor = createMockExecutor(100);

      const request1 = manager.enqueue(params, executor);
      const request2 = manager.enqueue(params, executor);

      expect(request1.promise).toBe(request2.promise);
      expect(request1.requestId).toBe(request2.requestId);
    });

    it('should only call executor once for deduplicated requests', async () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      let callCount = 0;

      const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
        callCount++;
        return createMockExecutor(10)(signal);
      };

      const request1 = manager.enqueue(params, executor);
      const request2 = manager.enqueue(params, executor);
      const request3 = manager.enqueue(params, executor);

      await Promise.all([request1.promise, request2.promise, request3.promise]);

      expect(callCount).toBe(1);
    });

    it('should create new request for different params', () => {
      const executor = createMockExecutor(100);

      const request1 = manager.enqueue({ sellerId: 'seller-1' }, executor);
      const request2 = manager.enqueue({ sellerId: 'seller-2' }, executor);

      expect(request1.promise).not.toBe(request2.promise);
      expect(request1.requestId).not.toBe(request2.requestId);
    });
  });

  describe('cancel', () => {
    it('should cancel request by ID', () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      const executor = createMockExecutor(100);

      const { requestId } = manager.enqueue(params, executor);
      expect(manager.isInFlight(params)).toBe(true);

      const cancelled = manager.cancel(requestId);

      expect(cancelled).toBe(true);
      expect(manager.isInFlight(params)).toBe(false);
    });

    it('should return false for non-existent request ID', () => {
      const cancelled = manager.cancel('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should trigger AbortController abort', async () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      let wasAborted = false;

      const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            wasAborted = true;
            // Abort errors are silently handled by RequestQueueManager
            reject(new DOMException('Aborted', 'AbortError'));
          });
          setTimeout(() => resolve({ products: [], nextCursor: null, hasMore: false, fromCache: false }), 100);
        });
      };

      const { requestId } = manager.enqueue(params, executor);
      manager.cancel(requestId);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(wasAborted).toBe(true);
    });
  });

  describe('cancelMatching', () => {
    it('should cancel all requests for a seller', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1', category: 'Electronics' }, executor);
      manager.enqueue({ sellerId: 'seller-1', category: 'Groceries' }, executor);
      manager.enqueue({ sellerId: 'seller-2', category: 'Electronics' }, executor);

      expect(manager.getPendingCount()).toBe(3);

      const cancelled = manager.cancelMatching({ sellerId: 'seller-1' });

      expect(cancelled).toBe(2);
      expect(manager.getPendingCount()).toBe(1);
      expect(manager.isInFlight({ sellerId: 'seller-2', category: 'Electronics' })).toBe(true);
    });

    it('should cancel requests matching seller and category', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1', category: 'Electronics' }, executor);
      manager.enqueue({ sellerId: 'seller-1', category: 'Groceries' }, executor);

      const cancelled = manager.cancelMatching({ sellerId: 'seller-1', category: 'Electronics' });

      expect(cancelled).toBe(1);
      expect(manager.isInFlight({ sellerId: 'seller-1', category: 'Groceries' })).toBe(true);
    });

    it('should return 0 when no matches found', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1' }, executor);

      const cancelled = manager.cancelMatching({ sellerId: 'seller-2' });

      expect(cancelled).toBe(0);
      expect(manager.getPendingCount()).toBe(1);
    });
  });

  describe('cancelAllExcept', () => {
    it('should cancel all except specified category', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1', category: 'Electronics' }, executor);
      manager.enqueue({ sellerId: 'seller-1', category: 'Groceries' }, executor);
      manager.enqueue({ sellerId: 'seller-1', category: 'Clothing' }, executor);

      const cancelled = manager.cancelAllExcept('seller-1', 'Electronics');

      expect(cancelled).toBe(2);
      expect(manager.isInFlight({ sellerId: 'seller-1', category: 'Electronics' })).toBe(true);
      expect(manager.isInFlight({ sellerId: 'seller-1', category: 'Groceries' })).toBe(false);
      expect(manager.isInFlight({ sellerId: 'seller-1', category: 'Clothing' })).toBe(false);
    });

    it('should not affect other sellers', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1', category: 'Electronics' }, executor);
      manager.enqueue({ sellerId: 'seller-2', category: 'Electronics' }, executor);

      manager.cancelAllExcept('seller-1', 'Groceries');

      // seller-2's request should be unaffected
      expect(manager.isInFlight({ sellerId: 'seller-2', category: 'Electronics' })).toBe(true);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all pending requests', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1' }, executor);
      manager.enqueue({ sellerId: 'seller-2' }, executor);
      manager.enqueue({ sellerId: 'seller-3' }, executor);

      expect(manager.getPendingCount()).toBe(3);

      const cancelled = manager.cancelAll();

      expect(cancelled).toBe(3);
      expect(manager.getPendingCount()).toBe(0);
      expect(manager.isEmpty()).toBe(true);
    });

    it('should return 0 when queue is empty', () => {
      const cancelled = manager.cancelAll();
      expect(cancelled).toBe(0);
    });
  });

  describe('getPendingRequestsInfo', () => {
    it('should return info about pending requests', () => {
      const executor = createMockExecutor(100);

      manager.enqueue({ sellerId: 'seller-1', category: 'Electronics' }, executor);
      manager.enqueue({ sellerId: 'seller-2', category: 'Groceries' }, executor);

      const info = manager.getPendingRequestsInfo();

      expect(info).toHaveLength(2);
      expect(info[0]).toHaveProperty('id');
      expect(info[0]).toHaveProperty('cacheKey');
      expect(info[0]).toHaveProperty('params');
      expect(info[0]).toHaveProperty('age');
      expect(info[0].age).toBeGreaterThanOrEqual(0);
    });

    it('should return empty array when no pending requests', () => {
      const info = manager.getPendingRequestsInfo();
      expect(info).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle executor that throws', async () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      const executor = (): Promise<CursorPaginationResult> => {
        return Promise.reject(new Error('Network error'));
      };

      const { promise } = manager.enqueue(params, executor);

      await expect(promise).rejects.toThrow('Network error');
      expect(manager.isInFlight(params)).toBe(false);
    });

    it('should handle rapid enqueue/cancel cycles', () => {
      const executor = createMockExecutor(100);

      for (let i = 0; i < 10; i++) {
        const { requestId } = manager.enqueue({ sellerId: `seller-${i}` }, executor);
        manager.cancel(requestId);
      }

      expect(manager.getPendingCount()).toBe(0);
    });

    it('should allow re-enqueue after completion', async () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      let callCount = 0;

      const executor = (signal: AbortSignal): Promise<CursorPaginationResult> => {
        callCount++;
        return createMockExecutor(5)(signal);
      };

      // First request
      const request1 = manager.enqueue(params, executor);
      await request1.promise;
      
      // Wait for cleanup to complete (finally block runs async)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second request after completion
      const request2 = manager.enqueue(params, executor);
      await request2.promise;

      expect(callCount).toBe(2);
      expect(request1.requestId).not.toBe(request2.requestId);
    });

    it('should allow re-enqueue after cancellation', () => {
      const params: CursorPaginationParams = { sellerId: 'seller-123' };
      const executor = createMockExecutor(100);

      const request1 = manager.enqueue(params, executor);
      manager.cancel(request1.requestId);

      const request2 = manager.enqueue(params, executor);

      expect(request2.requestId).not.toBe(request1.requestId);
      expect(manager.isInFlight(params)).toBe(true);
    });
  });
});
