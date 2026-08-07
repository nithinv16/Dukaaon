/**
 * Property-Based Tests for PerformanceMonitoringService
 * 
 * **Feature: fast-product-loading, Property 11: Performance Metric Logging**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 * 
 * Tests that performance metrics are correctly logged for all product load operations.
 */

import * as fc from 'fast-check';
import {
  PerformanceMonitoringService,
  PerformanceMonitoringServiceClass,
  LoadMetricsTracker,
  LoadingMetrics,
  CacheMetrics,
  CacheType,
} from '../../services/performance';

// Mock LoggingService to capture log calls
const mockLogs: { level: string; message: string; context: any }[] = [];

jest.mock('../../services/logging', () => ({
  LoggingService: {
    createScope: () => ({
      info: (message: string, context?: any) => {
        mockLogs.push({ level: 'info', message, context });
      },
      warn: (message: string, context?: any) => {
        mockLogs.push({ level: 'warn', message, context });
      },
      error: (message: string, error?: any, context?: any) => {
        mockLogs.push({ level: 'error', message, context: context || error });
      },
    }),
  },
}));

describe('PerformanceMonitoringService Property Tests', () => {
  let service: PerformanceMonitoringServiceClass;

  beforeEach(() => {
    // Create fresh instance for each test
    service = new PerformanceMonitoringServiceClass();
    mockLogs.length = 0;
    service.clearHistory();
  });

  // Arbitraries for generating test data
  const cacheTypeArb = fc.constantFrom<CacheType>('memory', 'storage', 'network', 'none');
  const sellerIdArb = fc.uuid();
  const categoryIdArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }));
  const searchTermArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }));
  const productCountArb = fc.integer({ min: 0, max: 1000 });
  const timestampArb = fc.integer({ min: 1000000000000, max: 2000000000000 });


  /**
   * **Feature: fast-product-loading, Property 11: Performance Metric Logging**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   * 
   * Property: For any product load operation, the system should log time-to-first-content
   * and time-to-interactive metrics with cache type information.
   */
  describe('Property 11: Performance Metric Logging', () => {
    it('should log time-to-first-content for any skeleton render', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          timestampArb,
          fc.integer({ min: 1, max: 100 }), // delay in ms
          (sellerId, navigationStart, delay) => {
            mockLogs.length = 0;
            
            const skeletonRender = navigationStart + delay;
            
            service.logTimeToFirstContent({
              navigationStart,
              skeletonRender,
              sellerId,
            });

            // Should have logged time-to-first-content
            const ttfcLog = mockLogs.find(log => 
              log.message.includes('Time to first content')
            );
            
            expect(ttfcLog).toBeDefined();
            expect(ttfcLog?.context.timeToFirstContentMs).toBe(delay);
            expect(ttfcLog?.context.sellerId).toBe(sellerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log time-to-interactive for any data render', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          cacheTypeArb,
          productCountArb,
          timestampArb,
          fc.integer({ min: 1, max: 1000 }), // delay in ms
          (sellerId, cacheType, productCount, navigationStart, delay) => {
            mockLogs.length = 0;
            
            const metrics: LoadingMetrics = {
              navigationStart,
              skeletonRender: navigationStart + 10,
              firstContentRender: navigationStart + delay,
              interactiveTime: delay,
              cacheType,
              productCount,
              sellerId,
            };
            
            service.logTimeToInteractive(metrics);

            // Should have logged time-to-interactive
            const ttiLog = mockLogs.find(log => 
              log.message.includes('Time to interactive')
            );
            
            expect(ttiLog).toBeDefined();
            expect(ttiLog?.context.timeToInteractiveMs).toBe(delay);
            expect(ttiLog?.context.cacheType).toBe(cacheType);
            expect(ttiLog?.context.productCount).toBe(productCount);
            expect(ttiLog?.context.sellerId).toBe(sellerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log cache hit/miss with cache type for any cache operation', () => {
      fc.assert(
        fc.property(
          cacheTypeArb,
          fc.boolean(), // hit
          fc.string({ minLength: 1, maxLength: 100 }), // key
          sellerIdArb,
          timestampArb,
          (cacheType, hit, key, sellerId, timestamp) => {
            mockLogs.length = 0;
            
            const metrics: CacheMetrics = {
              cacheType,
              hit,
              key,
              timestamp,
              sellerId,
            };
            
            service.logCacheOperation(metrics);

            // Should have logged cache operation
            const cacheLog = mockLogs.find(log => 
              log.message.includes('Cache')
            );
            
            expect(cacheLog).toBeDefined();
            expect(cacheLog?.context.cacheType).toBe(cacheType);
            expect(cacheLog?.context.hit).toBe(hit);
            expect(cacheLog?.context.key).toBe(key);
            expect(cacheLog?.context.sellerId).toBe(sellerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log complete metrics for any load operation', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          categoryIdArb,
          searchTermArb,
          cacheTypeArb,
          productCountArb,
          timestampArb,
          fc.integer({ min: 10, max: 50 }), // skeleton delay
          fc.integer({ min: 50, max: 500 }), // content delay
          (sellerId, categoryId, searchTerm, cacheType, productCount, navigationStart, skeletonDelay, contentDelay) => {
            mockLogs.length = 0;
            
            const metrics: LoadingMetrics = {
              navigationStart,
              skeletonRender: navigationStart + skeletonDelay,
              firstContentRender: navigationStart + contentDelay,
              interactiveTime: contentDelay,
              cacheType,
              productCount,
              sellerId,
              categoryId: categoryId ?? undefined,
              searchTerm: searchTerm ?? undefined,
            };
            
            service.logLoadingComplete(metrics);

            // Should have logged complete metrics
            const completeLog = mockLogs.find(log => 
              log.message.includes('Product loading complete')
            );
            
            expect(completeLog).toBeDefined();
            expect(completeLog?.context.timeToFirstContentMs).toBe(skeletonDelay);
            expect(completeLog?.context.timeToInteractiveMs).toBe(contentDelay);
            expect(completeLog?.context.cacheType).toBe(cacheType);
            expect(completeLog?.context.productCount).toBe(productCount);
            expect(completeLog?.context.sellerId).toBe(sellerId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Slow loads (>500ms) should always emit warning logs
   * **Validates: Requirements 7.4**
   */
  describe('Slow Load Warning', () => {
    it('should emit warning for any load exceeding 500ms threshold', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          cacheTypeArb,
          productCountArb,
          timestampArb,
          fc.integer({ min: 501, max: 2000 }), // slow load time (>500ms)
          (sellerId, cacheType, productCount, navigationStart, loadTime) => {
            mockLogs.length = 0;
            
            const metrics: LoadingMetrics = {
              navigationStart,
              skeletonRender: navigationStart + 10,
              firstContentRender: navigationStart + loadTime,
              interactiveTime: loadTime,
              cacheType,
              productCount,
              sellerId,
            };
            
            service.logLoadingComplete(metrics);

            // Should have emitted a warning
            const warnLog = mockLogs.find(log => log.level === 'warn');
            expect(warnLog).toBeDefined();
            expect(warnLog?.message).toContain('Slow');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not emit warning for loads under 500ms', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          cacheTypeArb,
          productCountArb,
          timestampArb,
          fc.integer({ min: 1, max: 499 }), // fast load time (<500ms)
          (sellerId, cacheType, productCount, navigationStart, loadTime) => {
            mockLogs.length = 0;
            
            const metrics: LoadingMetrics = {
              navigationStart,
              skeletonRender: navigationStart + 10,
              firstContentRender: navigationStart + loadTime,
              interactiveTime: loadTime,
              cacheType,
              productCount,
              sellerId,
            };
            
            service.logLoadingComplete(metrics);

            // Should NOT have emitted a slow load warning
            const slowWarnLog = mockLogs.find(log => 
              log.level === 'warn' && log.message.includes('Slow product load')
            );
            expect(slowWarnLog).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: LoadMetricsTracker should correctly track all phases
   */
  describe('LoadMetricsTracker', () => {
    it('should track skeleton render and first content render for any load', () => {
      fc.assert(
        fc.property(
          sellerIdArb,
          categoryIdArb,
          searchTermArb,
          cacheTypeArb,
          productCountArb,
          (sellerId, categoryId, searchTerm, cacheType, productCount) => {
            mockLogs.length = 0;
            
            const tracker = service.createLoadTracker(
              sellerId,
              categoryId ?? undefined,
              searchTerm ?? undefined
            );
            
            // Mark skeleton render
            tracker.markSkeletonRender();
            
            // Should have logged skeleton render
            const skeletonLog = mockLogs.find(log => 
              log.message.includes('Time to first content')
            );
            expect(skeletonLog).toBeDefined();
            
            // Mark first content render
            tracker.markFirstContentRender(cacheType, productCount);
            
            // Should have logged first content render
            const contentLog = mockLogs.find(log => 
              log.message.includes('Time to interactive')
            );
            expect(contentLog).toBeDefined();
            expect(contentLog?.context.cacheType).toBe(cacheType);
            expect(contentLog?.context.productCount).toBe(productCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Cache hit rates should be correctly calculated
   */
  describe('Cache Hit Rate Calculation', () => {
    it('should correctly calculate hit rates for any sequence of cache operations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              cacheType: cacheTypeArb,
              hit: fc.boolean(),
              key: fc.string({ minLength: 1, maxLength: 50 }),
              timestamp: timestampArb,
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (operations) => {
            service.clearHistory();
            
            // Log all operations
            operations.forEach(op => {
              service.logCacheOperation(op);
            });
            
            const hitRates = service.getCacheHitRates();
            
            // Calculate expected hit rates
            const memoryOps = operations.filter(o => o.cacheType === 'memory');
            const storageOps = operations.filter(o => o.cacheType === 'storage');
            
            const expectedMemoryRate = memoryOps.length > 0
              ? Math.round((memoryOps.filter(o => o.hit).length / memoryOps.length) * 100)
              : 0;
            const expectedStorageRate = storageOps.length > 0
              ? Math.round((storageOps.filter(o => o.hit).length / storageOps.length) * 100)
              : 0;
            const expectedOverallRate = Math.round(
              (operations.filter(o => o.hit).length / operations.length) * 100
            );
            
            expect(hitRates.memory).toBe(expectedMemoryRate);
            expect(hitRates.storage).toBe(expectedStorageRate);
            expect(hitRates.overall).toBe(expectedOverallRate);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Performance summary should reflect all logged metrics
   */
  describe('Performance Summary', () => {
    it('should correctly count slow loads in summary', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              sellerId: sellerIdArb,
              cacheType: cacheTypeArb,
              productCount: productCountArb,
              loadTime: fc.integer({ min: 100, max: 1000 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (loads) => {
            service.clearHistory();
            
            const baseTime = Date.now();
            
            // Log all loads
            loads.forEach((load, index) => {
              const navigationStart = baseTime + index * 1000;
              service.logLoadingComplete({
                navigationStart,
                skeletonRender: navigationStart + 10,
                firstContentRender: navigationStart + load.loadTime,
                interactiveTime: load.loadTime,
                cacheType: load.cacheType,
                productCount: load.productCount,
                sellerId: load.sellerId,
              });
            });
            
            const summary = service.getPerformanceSummary();
            
            // Count expected slow loads (>500ms)
            const expectedSlowLoads = loads.filter(l => l.loadTime > 500).length;
            
            expect(summary.totalLoads).toBe(loads.length);
            expect(summary.slowLoads).toBe(expectedSlowLoads);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
