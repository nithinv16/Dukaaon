/**
 * Performance Monitoring Module
 * 
 * Provides performance metric logging for product loading operations.
 * 
 * Usage:
 * ```typescript
 * import { PerformanceMonitoringService, LoadMetricsTracker } from '@/services/performance';
 * 
 * // Create a tracker for a load operation
 * const tracker = PerformanceMonitoringService.createLoadTracker(sellerId);
 * tracker.markSkeletonRender();
 * tracker.markFirstContentRender('memory', products.length);
 * 
 * // Or log metrics directly
 * PerformanceMonitoringService.logCacheOperation({
 *   cacheType: 'memory',
 *   hit: true,
 *   key: cacheKey,
 *   timestamp: Date.now(),
 *   sellerId,
 * });
 * 
 * // Get performance summary
 * const summary = PerformanceMonitoringService.getPerformanceSummary();
 * ```
 */

export {
  PerformanceMonitoringService,
  PerformanceMonitoringServiceClass,
  LoadMetricsTracker,
  type LoadingMetrics,
  type CacheMetrics,
  type CacheType,
  type QueryPerformanceMetrics,
  type SlowRequestContext,
  type DebugCacheState,
  type DebugPendingRequest,
} from './PerformanceMonitoringService';
