/**
 * PerformanceMonitoringService - Performance metric logging for product loading
 * 
 * Implements Requirements 7.1, 7.2, 7.3, 7.4 (fast-product-loading):
 * - Log time-to-first-content (skeleton render time)
 * - Log time-to-interactive (actual data render time)
 * - Log cache hit/miss with cache type (memory/storage/network)
 * - Emit warning log when load time exceeds 500ms
 * 
 * Implements Requirements 10.1, 10.2, 10.3, 10.5 (scalable-product-loading):
 * - Log database query time separately from network time
 * - Emit warning when request > 500ms with full context
 * - Report cache hit rates for the previous session
 * - Provide debug utilities to view cache state and pending requests
 * 
 * @module services/performance/PerformanceMonitoringService
 */

import { LoggingService } from '../logging';

export type CacheType = 'memory' | 'storage' | 'network' | 'none';

export interface LoadingMetrics {
  navigationStart: number;
  skeletonRender: number | null;
  firstContentRender: number | null;
  interactiveTime: number | null;
  cacheType: CacheType;
  productCount: number;
  sellerId?: string;
  categoryId?: string;
  searchTerm?: string;
}

export interface CacheMetrics {
  cacheType: CacheType;
  hit: boolean;
  key: string;
  timestamp: number;
  sellerId?: string;
}

/**
 * Query performance metrics - Requirements 10.1
 * Tracks database query time separately from network time
 */
export interface QueryPerformanceMetrics {
  sellerId: string;
  category?: string;
  subcategory?: string;
  searchTerm?: string;
  cursor?: string;
  databaseQueryTimeMs: number;
  networkTimeMs: number;
  totalTimeMs: number;
  productCount: number;
  cacheStatus: 'hit' | 'miss' | 'stale';
  networkQuality?: 'slow' | 'fast' | 'unknown';
  timestamp: number;
}

/**
 * Slow request context - Requirements 10.2
 * Full context for slow request warnings
 */
export interface SlowRequestContext {
  sellerId: string;
  category?: string;
  subcategory?: string;
  searchTerm?: string;
  cursor?: string;
  networkQuality?: 'slow' | 'fast' | 'unknown';
  productCount?: number;
  databaseQueryTimeMs?: number;
  networkTimeMs?: number;
  totalTimeMs: number;
  threshold: number;
}

/**
 * Debug cache state - Requirements 10.5
 */
export interface DebugCacheState {
  entries: number;
  sizeBytes: number;
  maxSizeBytes: number;
  keys: string[];
  hitRate: number;
  missRate: number;
  staleRate: number;
}

/**
 * Debug pending requests - Requirements 10.5
 */
export interface DebugPendingRequest {
  id: string;
  cacheKey: string;
  sellerId: string;
  category?: string;
  ageMs: number;
  status: 'pending' | 'in-flight';
}

// Performance thresholds
const SLOW_LOAD_THRESHOLD_MS = 500;
const VERY_SLOW_LOAD_THRESHOLD_MS = 2000;
const SLOW_DB_QUERY_THRESHOLD_MS = 100;

// Scoped logger for performance metrics
const logger = LoggingService.createScope('PerformanceMonitoring');

/**
 * Performance Monitoring Service for product loading
 * Tracks and logs performance metrics for cache operations and data loading
 */
class PerformanceMonitoringServiceClass {
  private metricsHistory: LoadingMetrics[] = [];
  private cacheMetricsHistory: CacheMetrics[] = [];
  private queryMetricsHistory: QueryPerformanceMetrics[] = [];
  private maxHistorySize = 100;
  private sessionStartTime: number = Date.now();


  /**
   * Log time-to-first-content metric - Requirements 7.1
   * Records when skeleton UI is rendered
   * @param metrics - Loading metrics with navigationStart and skeletonRender times
   */
  logTimeToFirstContent(metrics: Pick<LoadingMetrics, 'navigationStart' | 'skeletonRender' | 'sellerId'>): void {
    if (!metrics.skeletonRender) return;

    const timeToFirstContent = metrics.skeletonRender - metrics.navigationStart;
    
    logger.info('Time to first content (skeleton render)', {
      timeToFirstContentMs: timeToFirstContent,
      sellerId: metrics.sellerId,
      timestamp: new Date().toISOString(),
    });

    // Warn if skeleton render is slow (should be < 16ms for one frame)
    if (timeToFirstContent > 50) {
      logger.warn('Slow skeleton render detected', {
        timeToFirstContentMs: timeToFirstContent,
        sellerId: metrics.sellerId,
        threshold: '50ms',
      });
    }
  }

  /**
   * Log time-to-interactive metric - Requirements 7.2
   * Records when actual data is rendered and interactive
   * @param metrics - Complete loading metrics
   */
  logTimeToInteractive(metrics: LoadingMetrics): void {
    if (!metrics.firstContentRender) return;

    const timeToInteractive = metrics.firstContentRender - metrics.navigationStart;
    
    logger.info('Time to interactive (data render)', {
      timeToInteractiveMs: timeToInteractive,
      cacheType: metrics.cacheType,
      productCount: metrics.productCount,
      sellerId: metrics.sellerId,
      categoryId: metrics.categoryId,
      searchTerm: metrics.searchTerm,
      timestamp: new Date().toISOString(),
    });

    // Store in history for analysis
    this.addToHistory(metrics);

    // Check for slow loads - Requirements 7.4
    this.checkSlowLoad(timeToInteractive, metrics);
  }

  /**
   * Log cache hit/miss with cache type - Requirements 7.3
   * @param metrics - Cache operation metrics
   */
  logCacheOperation(metrics: CacheMetrics): void {
    const hitMiss = metrics.hit ? 'HIT' : 'MISS';
    
    logger.info(`Cache ${hitMiss}: ${metrics.cacheType}`, {
      cacheType: metrics.cacheType,
      hit: metrics.hit,
      key: metrics.key,
      sellerId: metrics.sellerId,
      timestamp: new Date().toISOString(),
    });

    // Store cache metrics
    this.addToCacheHistory(metrics);
  }

  /**
   * Check and warn for slow loads - Requirements 7.4
   * Emits warning when load time exceeds 500ms
   * @param loadTimeMs - Load time in milliseconds
   * @param metrics - Loading metrics for context
   */
  private checkSlowLoad(loadTimeMs: number, metrics: LoadingMetrics): void {
    if (loadTimeMs > VERY_SLOW_LOAD_THRESHOLD_MS) {
      logger.error('Very slow product load detected', undefined, {
        loadTimeMs,
        threshold: `${VERY_SLOW_LOAD_THRESHOLD_MS}ms`,
        cacheType: metrics.cacheType,
        sellerId: metrics.sellerId,
        categoryId: metrics.categoryId,
        productCount: metrics.productCount,
      });
    } else if (loadTimeMs > SLOW_LOAD_THRESHOLD_MS) {
      logger.warn('Slow product load detected', {
        loadTimeMs,
        threshold: `${SLOW_LOAD_THRESHOLD_MS}ms`,
        cacheType: metrics.cacheType,
        sellerId: metrics.sellerId,
        categoryId: metrics.categoryId,
        productCount: metrics.productCount,
      });
    }
  }

  /**
   * Log complete loading metrics - combines all metric types
   * @param metrics - Complete loading metrics
   */
  logLoadingComplete(metrics: LoadingMetrics): void {
    const timeToFirstContent = metrics.skeletonRender 
      ? metrics.skeletonRender - metrics.navigationStart 
      : null;
    const timeToInteractive = metrics.firstContentRender 
      ? metrics.firstContentRender - metrics.navigationStart 
      : null;

    logger.info('Product loading complete', {
      timeToFirstContentMs: timeToFirstContent,
      timeToInteractiveMs: timeToInteractive,
      cacheType: metrics.cacheType,
      productCount: metrics.productCount,
      sellerId: metrics.sellerId,
      categoryId: metrics.categoryId,
      searchTerm: metrics.searchTerm,
      timestamp: new Date().toISOString(),
    });

    // Store in history
    this.addToHistory(metrics);

    // Check for slow loads
    if (timeToInteractive !== null) {
      this.checkSlowLoad(timeToInteractive, metrics);
    }
  }

  /**
   * Log slow load warning with full context - Requirements 7.4
   * @param loadTimeMs - Load time in milliseconds
   * @param context - Additional context for debugging
   */
  logSlowLoadWarning(
    loadTimeMs: number,
    context: {
      sellerId?: string;
      cacheStatus: CacheType;
      networkQuality?: string;
      productCount?: number;
    }
  ): void {
    logger.warn('Product load exceeded threshold', {
      loadTimeMs,
      threshold: `${SLOW_LOAD_THRESHOLD_MS}ms`,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add metrics to history with size limit
   */
  private addToHistory(metrics: LoadingMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Add cache metrics to history with size limit
   */
  private addToCacheHistory(metrics: CacheMetrics): void {
    this.cacheMetricsHistory.push(metrics);
    if (this.cacheMetricsHistory.length > this.maxHistorySize) {
      this.cacheMetricsHistory.shift();
    }
  }

  /**
   * Get cache hit rate statistics
   * @returns Cache hit rate by type
   */
  getCacheHitRates(): { memory: number; storage: number; overall: number } {
    if (this.cacheMetricsHistory.length === 0) {
      return { memory: 0, storage: 0, overall: 0 };
    }

    const memoryOps = this.cacheMetricsHistory.filter(m => m.cacheType === 'memory');
    const storageOps = this.cacheMetricsHistory.filter(m => m.cacheType === 'storage');
    const allOps = this.cacheMetricsHistory;

    const memoryHitRate = memoryOps.length > 0 
      ? memoryOps.filter(m => m.hit).length / memoryOps.length 
      : 0;
    const storageHitRate = storageOps.length > 0 
      ? storageOps.filter(m => m.hit).length / storageOps.length 
      : 0;
    const overallHitRate = allOps.filter(m => m.hit).length / allOps.length;

    return {
      memory: Math.round(memoryHitRate * 100),
      storage: Math.round(storageHitRate * 100),
      overall: Math.round(overallHitRate * 100),
    };
  }

  /**
   * Get average load times by cache type
   * @returns Average load times in milliseconds
   */
  getAverageLoadTimes(): { memory: number; storage: number; network: number } {
    const byType = {
      memory: [] as number[],
      storage: [] as number[],
      network: [] as number[],
    };

    this.metricsHistory.forEach(m => {
      if (m.firstContentRender && m.cacheType !== 'none') {
        const loadTime = m.firstContentRender - m.navigationStart;
        byType[m.cacheType]?.push(loadTime);
      }
    });

    const avg = (arr: number[]) => arr.length > 0 
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) 
      : 0;

    return {
      memory: avg(byType.memory),
      storage: avg(byType.storage),
      network: avg(byType.network),
    };
  }

  /**
   * Get performance summary for debugging
   */
  getPerformanceSummary(): {
    totalLoads: number;
    cacheHitRates: { memory: number; storage: number; overall: number };
    averageLoadTimes: { memory: number; storage: number; network: number };
    slowLoads: number;
  } {
    const slowLoads = this.metricsHistory.filter(m => {
      if (!m.firstContentRender) return false;
      return (m.firstContentRender - m.navigationStart) > SLOW_LOAD_THRESHOLD_MS;
    }).length;

    return {
      totalLoads: this.metricsHistory.length,
      cacheHitRates: this.getCacheHitRates(),
      averageLoadTimes: this.getAverageLoadTimes(),
      slowLoads,
    };
  }

  /**
   * Clear metrics history (useful for testing)
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.cacheMetricsHistory = [];
    this.queryMetricsHistory = [];
  }

  /**
   * Log database query performance - Requirements 10.1
   * Logs database query time separately from network time
   * 
   * @param metrics - Query performance metrics
   */
  logQueryPerformance(metrics: QueryPerformanceMetrics): void {
    logger.info('Query performance metrics', {
      sellerId: metrics.sellerId,
      category: metrics.category,
      subcategory: metrics.subcategory,
      searchTerm: metrics.searchTerm,
      cursor: metrics.cursor,
      databaseQueryTimeMs: metrics.databaseQueryTimeMs,
      networkTimeMs: metrics.networkTimeMs,
      totalTimeMs: metrics.totalTimeMs,
      productCount: metrics.productCount,
      cacheStatus: metrics.cacheStatus,
      networkQuality: metrics.networkQuality,
      timestamp: new Date(metrics.timestamp).toISOString(),
    });

    // Store in history
    this.addToQueryHistory(metrics);

    // Check for slow database queries
    if (metrics.databaseQueryTimeMs > SLOW_DB_QUERY_THRESHOLD_MS) {
      logger.warn('Slow database query detected', {
        databaseQueryTimeMs: metrics.databaseQueryTimeMs,
        threshold: `${SLOW_DB_QUERY_THRESHOLD_MS}ms`,
        sellerId: metrics.sellerId,
        category: metrics.category,
        productCount: metrics.productCount,
      });
    }

    // Check for slow total request - Requirements 10.2
    if (metrics.totalTimeMs > SLOW_LOAD_THRESHOLD_MS) {
      this.logSlowRequest({
        sellerId: metrics.sellerId,
        category: metrics.category,
        subcategory: metrics.subcategory,
        searchTerm: metrics.searchTerm,
        cursor: metrics.cursor,
        networkQuality: metrics.networkQuality,
        productCount: metrics.productCount,
        databaseQueryTimeMs: metrics.databaseQueryTimeMs,
        networkTimeMs: metrics.networkTimeMs,
        totalTimeMs: metrics.totalTimeMs,
        threshold: SLOW_LOAD_THRESHOLD_MS,
      });
    }
  }

  /**
   * Log slow request warning with full context - Requirements 10.2
   * Emits warning when request > 500ms with sellerId, category, network quality
   * 
   * @param context - Full context for the slow request
   */
  logSlowRequest(context: SlowRequestContext): void {
    const severity = context.totalTimeMs > VERY_SLOW_LOAD_THRESHOLD_MS ? 'error' : 'warn';
    
    const logData = {
      totalTimeMs: context.totalTimeMs,
      threshold: `${context.threshold}ms`,
      sellerId: context.sellerId,
      category: context.category || 'all',
      subcategory: context.subcategory || 'all',
      searchTerm: context.searchTerm || 'none',
      cursor: context.cursor || 'start',
      networkQuality: context.networkQuality || 'unknown',
      productCount: context.productCount,
      databaseQueryTimeMs: context.databaseQueryTimeMs,
      networkTimeMs: context.networkTimeMs,
      timestamp: new Date().toISOString(),
    };

    if (severity === 'error') {
      logger.error('Very slow request detected (>2s)', undefined, logData);
    } else {
      logger.warn('Slow request detected (>500ms)', logData);
    }
  }

  /**
   * Add query metrics to history with size limit
   */
  private addToQueryHistory(metrics: QueryPerformanceMetrics): void {
    this.queryMetricsHistory.push(metrics);
    if (this.queryMetricsHistory.length > this.maxHistorySize) {
      this.queryMetricsHistory.shift();
    }
  }

  /**
   * Get cache hit rates for session - Requirements 10.3
   * Reports cache hit rates for the current/previous session
   */
  getSessionCacheStats(): {
    sessionDurationMs: number;
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    staleHits: number;
    hitRate: number;
    missRate: number;
    staleRate: number;
    avgDatabaseQueryTimeMs: number;
    avgNetworkTimeMs: number;
    avgTotalTimeMs: number;
    slowRequestCount: number;
  } {
    const sessionDurationMs = Date.now() - this.sessionStartTime;
    const totalRequests = this.queryMetricsHistory.length;
    
    const cacheHits = this.queryMetricsHistory.filter(m => m.cacheStatus === 'hit').length;
    const cacheMisses = this.queryMetricsHistory.filter(m => m.cacheStatus === 'miss').length;
    const staleHits = this.queryMetricsHistory.filter(m => m.cacheStatus === 'stale').length;
    
    const hitRate = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
    const missRate = totalRequests > 0 ? Math.round((cacheMisses / totalRequests) * 100) : 0;
    const staleRate = totalRequests > 0 ? Math.round((staleHits / totalRequests) * 100) : 0;
    
    const avgDatabaseQueryTimeMs = this.calculateAverage(
      this.queryMetricsHistory.map(m => m.databaseQueryTimeMs)
    );
    const avgNetworkTimeMs = this.calculateAverage(
      this.queryMetricsHistory.map(m => m.networkTimeMs)
    );
    const avgTotalTimeMs = this.calculateAverage(
      this.queryMetricsHistory.map(m => m.totalTimeMs)
    );
    
    const slowRequestCount = this.queryMetricsHistory.filter(
      m => m.totalTimeMs > SLOW_LOAD_THRESHOLD_MS
    ).length;

    return {
      sessionDurationMs,
      totalRequests,
      cacheHits,
      cacheMisses,
      staleHits,
      hitRate,
      missRate,
      staleRate,
      avgDatabaseQueryTimeMs,
      avgNetworkTimeMs,
      avgTotalTimeMs,
      slowRequestCount,
    };
  }

  /**
   * Report session cache stats to log - Requirements 10.3
   * Call this when app starts to report previous session stats
   */
  reportSessionStats(): void {
    const stats = this.getSessionCacheStats();
    
    logger.info('Session performance report', {
      sessionDurationMs: stats.sessionDurationMs,
      totalRequests: stats.totalRequests,
      cacheHitRate: `${stats.hitRate}%`,
      cacheMissRate: `${stats.missRate}%`,
      staleHitRate: `${stats.staleRate}%`,
      avgDatabaseQueryTimeMs: stats.avgDatabaseQueryTimeMs,
      avgNetworkTimeMs: stats.avgNetworkTimeMs,
      avgTotalTimeMs: stats.avgTotalTimeMs,
      slowRequestCount: stats.slowRequestCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate average of numbers array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Get debug cache state - Requirements 10.5
   * Provides a way to view current cache state for debugging
   * 
   * @param cacheState - External cache state from ProductQueryService
   */
  getDebugCacheState(cacheState: {
    entries: number;
    sizeBytes: number;
    maxSizeBytes: number;
    keys: string[];
  }): DebugCacheState {
    const stats = this.getSessionCacheStats();
    
    return {
      entries: cacheState.entries,
      sizeBytes: cacheState.sizeBytes,
      maxSizeBytes: cacheState.maxSizeBytes,
      keys: cacheState.keys,
      hitRate: stats.hitRate,
      missRate: stats.missRate,
      staleRate: stats.staleRate,
    };
  }

  /**
   * Format debug pending requests - Requirements 10.5
   * Provides a way to view pending requests for debugging
   * 
   * @param pendingRequests - External pending requests from ProductQueryService
   */
  formatDebugPendingRequests(pendingRequests: Array<{
    id: string;
    cacheKey: string;
    params: { sellerId: string; category?: string };
    age: number;
  }>): DebugPendingRequest[] {
    return pendingRequests.map(req => ({
      id: req.id,
      cacheKey: req.cacheKey,
      sellerId: req.params.sellerId,
      category: req.params.category,
      ageMs: req.age,
      status: 'in-flight' as const,
    }));
  }

  /**
   * Log debug info for cache and pending requests - Requirements 10.5
   */
  logDebugInfo(
    cacheState: { entries: number; sizeBytes: number; maxSizeBytes: number; keys: string[] },
    pendingRequests: Array<{ id: string; cacheKey: string; params: { sellerId: string; category?: string }; age: number }>
  ): void {
    const debugCache = this.getDebugCacheState(cacheState);
    const debugPending = this.formatDebugPendingRequests(pendingRequests);
    
    logger.info('Debug: Cache state', {
      entries: debugCache.entries,
      sizeBytes: debugCache.sizeBytes,
      maxSizeBytes: debugCache.maxSizeBytes,
      hitRate: `${debugCache.hitRate}%`,
      missRate: `${debugCache.missRate}%`,
      staleRate: `${debugCache.staleRate}%`,
      keys: debugCache.keys.slice(0, 10), // Limit to first 10 keys
      totalKeys: debugCache.keys.length,
    });
    
    logger.info('Debug: Pending requests', {
      count: debugPending.length,
      requests: debugPending.map(r => ({
        id: r.id,
        sellerId: r.sellerId,
        category: r.category || 'all',
        ageMs: r.ageMs,
      })),
    });
  }

  /**
   * Get query metrics history (for testing)
   */
  getQueryMetricsHistory(): QueryPerformanceMetrics[] {
    return [...this.queryMetricsHistory];
  }

  /**
   * Reset session start time (for testing)
   */
  resetSession(): void {
    this.sessionStartTime = Date.now();
    this.clearHistory();
  }

  /**
   * Create a metrics tracker for a single load operation
   * @param sellerId - Seller ID being loaded
   * @returns Metrics tracker object
   */
  createLoadTracker(sellerId: string, categoryId?: string, searchTerm?: string): LoadMetricsTracker {
    return new LoadMetricsTracker(this, sellerId, categoryId, searchTerm);
  }
}

/**
 * Helper class to track metrics for a single load operation
 */
export class LoadMetricsTracker {
  private metrics: LoadingMetrics;
  private service: PerformanceMonitoringServiceClass;

  constructor(
    service: PerformanceMonitoringServiceClass,
    sellerId: string,
    categoryId?: string,
    searchTerm?: string
  ) {
    this.service = service;
    this.metrics = {
      navigationStart: Date.now(),
      skeletonRender: null,
      firstContentRender: null,
      interactiveTime: null,
      cacheType: 'none',
      productCount: 0,
      sellerId,
      categoryId,
      searchTerm,
    };
  }

  /**
   * Mark skeleton render time
   */
  markSkeletonRender(): void {
    this.metrics.skeletonRender = Date.now();
    this.service.logTimeToFirstContent(this.metrics);
  }

  /**
   * Mark first content render with cache type
   */
  markFirstContentRender(cacheType: CacheType, productCount: number): void {
    this.metrics.firstContentRender = Date.now();
    this.metrics.cacheType = cacheType;
    this.metrics.productCount = productCount;
    this.service.logTimeToInteractive(this.metrics);
  }

  /**
   * Mark loading complete
   */
  markComplete(cacheType: CacheType, productCount: number): void {
    if (!this.metrics.firstContentRender) {
      this.metrics.firstContentRender = Date.now();
    }
    this.metrics.cacheType = cacheType;
    this.metrics.productCount = productCount;
    this.service.logLoadingComplete(this.metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): LoadingMetrics {
    return { ...this.metrics };
  }
}

// Export singleton instance
export const PerformanceMonitoringService = new PerformanceMonitoringServiceClass();

// Export class for testing
export { PerformanceMonitoringServiceClass };
