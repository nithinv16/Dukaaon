/**
 * useInstantProducts - Hook for instant product loading with cache-first strategy
 * 
 * Implements Requirements 1.2, 1.4, 1.5, 4.1, 4.2, 4.5, 5.5, 6.1, 6.2:
 * - Cache-first loading strategy with memory cache priority
 * - Return cacheStatus to indicate data source
 * - Skeleton state management (show only on cold cache)
 * - Background refresh with stale-while-revalidate
 * - Exponential backoff retry for failed syncs
 * - Offline mode handling with cached data serving
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ProductCacheService, Product, ProductQueryOptions, CachedProductResult } from '../services/products/ProductCacheService';
import { NetworkQualityService, NetworkQuality } from '../services/network/NetworkQualityService';
import { PerformanceMonitoringService, LoadMetricsTracker } from '../services/performance';

export type CacheStatus = 'memory' | 'storage' | 'network' | 'none';

export interface UseInstantProductsOptions {
  sellerId: string;
  categoryFilter?: string;
  searchTerm?: string;
  pageSize?: number;
}

export interface UseInstantProductsResult {
  products: Product[];
  isLoading: boolean;           // True only on cold cache (no memory or storage data)
  isRefreshing: boolean;        // True during background refresh
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  cacheStatus: CacheStatus;
  isOffline: boolean;
  totalCount: number;
}

// Retry configuration - Requirements 4.5
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s exponential backoff
const MAX_RETRY_ATTEMPTS = 3;

// Performance logging - now using PerformanceMonitoringService
// Local interface kept for backward compatibility
interface LoadMetrics {
  navigationStart: number;
  skeletonRender: number | null;
  firstContentRender: number | null;
  cacheType: CacheStatus;
}

export function useInstantProducts(options: UseInstantProductsOptions): UseInstantProductsResult {
  const { sellerId, categoryFilter, searchTerm, pageSize = 20 } = options;

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>('none');
  const [isOffline, setIsOffline] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Refs for tracking state across renders
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsRef = useRef<LoadMetrics>({
    navigationStart: Date.now(),
    skeletonRender: null,
    firstContentRender: null,
    cacheType: 'none',
  });
  const mountedRef = useRef(true);
  
  // Performance tracker using PerformanceMonitoringService - Requirements 7.1, 7.2, 7.3
  const performanceTrackerRef = useRef<LoadMetricsTracker | null>(null);

  // Generate cache key for current query
  const cacheKey = useMemo(() => {
    return ProductCacheService.getCacheKey({
      sellerId,
      categoryId: categoryFilter,
      searchTerm,
      limit: pageSize,
      offset: 0,
    });
  }, [sellerId, categoryFilter, searchTerm, pageSize]);

  // Subscribe to network quality changes
  useEffect(() => {
    const unsubscribe = NetworkQualityService.subscribe((state) => {
      setIsOffline(state.quality === 'offline');
    });
    return unsubscribe;
  }, []);


  /**
   * Log performance metrics - Requirements 7.1, 7.2, 7.3
   * Now uses PerformanceMonitoringService for centralized logging
   */
  const logPerformanceMetrics = useCallback((metrics: LoadMetrics, productCount: number = 0) => {
    const timeToFirstContent = metrics.skeletonRender 
      ? metrics.skeletonRender - metrics.navigationStart 
      : null;
    const timeToInteractive = metrics.firstContentRender 
      ? metrics.firstContentRender - metrics.navigationStart 
      : null;

    // Log using PerformanceMonitoringService - Requirements 7.1, 7.2, 7.3
    PerformanceMonitoringService.logLoadingComplete({
      navigationStart: metrics.navigationStart,
      skeletonRender: metrics.skeletonRender,
      firstContentRender: metrics.firstContentRender,
      interactiveTime: timeToInteractive,
      cacheType: metrics.cacheType,
      productCount,
      sellerId,
      categoryId: categoryFilter,
      searchTerm,
    });

    // Also log to console for backward compatibility
    console.log('[useInstantProducts] [METRICS]', {
      sellerId,
      cacheType: metrics.cacheType,
      timeToFirstContent: timeToFirstContent ? `${timeToFirstContent}ms` : 'N/A',
      timeToInteractive: timeToInteractive ? `${timeToInteractive}ms` : 'N/A',
    });

    // Warn if load time exceeds 500ms - Requirements 7.4
    if (timeToInteractive && timeToInteractive > 500) {
      PerformanceMonitoringService.logSlowLoadWarning(timeToInteractive, {
        sellerId,
        cacheStatus: metrics.cacheType,
        networkQuality: NetworkQualityService.getQuality(),
        productCount,
      });
    }
  }, [sellerId, categoryFilter, searchTerm]);

  /**
   * Load products with cache-first strategy - Requirements 1.2, 2.2, 2.3
   */
  const loadProducts = useCallback(async (isRefresh: boolean = false) => {
    if (isLoadingRef.current && !isRefresh) return;
    
    isLoadingRef.current = true;
    
    if (isRefresh) {
      offsetRef.current = 0;
    }
    
    setError(null);

    const queryOptions: ProductQueryOptions = {
      sellerId,
      categoryId: categoryFilter,
      searchTerm,
      limit: pageSize,
      offset: offsetRef.current,
      networkQuality: NetworkQualityService.getQuality(),
    };

    try {
      // 1. Try memory cache first (synchronous) - Requirements 2.2, 2.3
      const memoryCacheKey = ProductCacheService.getCacheKey(queryOptions);
      const memoryResult = ProductCacheService.getFromMemory(memoryCacheKey);
      
      if (memoryResult && !isRefresh) {
        // Memory cache hit - instant render
        // Log cache hit - Requirements 7.3
        PerformanceMonitoringService.logCacheOperation({
          cacheType: 'memory',
          hit: true,
          key: memoryCacheKey,
          timestamp: Date.now(),
          sellerId,
        });
        
        if (isRefresh || offsetRef.current === 0) {
          setProducts(memoryResult.products);
        } else {
          setProducts(prev => [...prev, ...memoryResult.products]);
        }
        
        setTotalCount(memoryResult.totalCount);
        setCacheStatus('memory');
        setIsLoading(false);
        setHasMore(offsetRef.current + memoryResult.products.length < memoryResult.totalCount);
        offsetRef.current += memoryResult.products.length;
        
        // Log first content render time
        if (!metricsRef.current.firstContentRender) {
          metricsRef.current.firstContentRender = Date.now();
          metricsRef.current.cacheType = 'memory';
          logPerformanceMetrics(metricsRef.current, memoryResult.products.length);
        }

        // Trigger background refresh if stale - Requirements 4.1
        if (memoryResult.isStale && !isOffline) {
          triggerBackgroundRefresh(queryOptions);
        }
        
        isLoadingRef.current = false;
        return;
      }

      // 2. Fetch from ProductCacheService (checks storage then network)
      const result: CachedProductResult = await ProductCacheService.getProducts(queryOptions);

      if (!mountedRef.current) return;

      // Log cache operation - Requirements 7.3
      const resultCacheType = result.cacheType || (result.fromCache ? 'storage' : 'network');
      PerformanceMonitoringService.logCacheOperation({
        cacheType: resultCacheType,
        hit: result.fromCache,
        key: memoryCacheKey,
        timestamp: Date.now(),
        sellerId,
      });

      if (isRefresh || offsetRef.current === 0) {
        setProducts(result.products);
      } else {
        setProducts(prev => [...prev, ...result.products]);
      }

      setTotalCount(result.totalCount);
      setCacheStatus(resultCacheType);
      setHasMore(offsetRef.current + result.products.length < result.totalCount);
      offsetRef.current += result.products.length;
      
      // Log first content render time
      if (!metricsRef.current.firstContentRender) {
        metricsRef.current.firstContentRender = Date.now();
        metricsRef.current.cacheType = resultCacheType;
        logPerformanceMetrics(metricsRef.current, result.products.length);
      }

      // Reset retry count on success
      retryCountRef.current = 0;

    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      
      // Only show error if we have no cached data - Requirements 1.5, 5.5
      if (products.length === 0) {
        setError(errorMessage);
      }
      
      console.error('[useInstantProducts] [ERROR]', { sellerId, error: errorMessage });
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
        isLoadingRef.current = false;
      }
    }
  }, [sellerId, categoryFilter, searchTerm, pageSize, isOffline, products.length, logPerformanceMetrics]);


  /**
   * Trigger background refresh without blocking UI - Requirements 4.1, 4.2
   */
  const triggerBackgroundRefresh = useCallback(async (queryOptions: ProductQueryOptions) => {
    if (isRefreshing || isOffline) return;
    
    setIsRefreshing(true);
    
    try {
      const result = await ProductCacheService.getProducts({
        ...queryOptions,
        networkQuality: 'fast', // Force network fetch for refresh
      });

      if (!mountedRef.current) return;

      // Update UI smoothly without layout shifts - Requirements 4.2
      if (result.products.length > 0) {
        setProducts(result.products);
        setTotalCount(result.totalCount);
        setCacheStatus(result.cacheType || 'network');
        setHasMore(result.products.length < result.totalCount);
      }

      // Reset retry count on success
      retryCountRef.current = 0;
      
      console.log('[useInstantProducts] [BACKGROUND_REFRESH:SUCCESS]', { sellerId });
      
    } catch (err) {
      console.error('[useInstantProducts] [BACKGROUND_REFRESH:ERROR]', { 
        sellerId, 
        error: err instanceof Error ? err.message : 'Unknown error',
        retryCount: retryCountRef.current,
      });
      
      // Retry with exponential backoff - Requirements 4.5
      scheduleRetry(queryOptions);
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [sellerId, isRefreshing, isOffline]);

  /**
   * Schedule retry with exponential backoff - Requirements 4.5
   * Retries: 1s, 2s, 4s delays, max 3 attempts
   */
  const scheduleRetry = useCallback((queryOptions: ProductQueryOptions) => {
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      console.warn('[useInstantProducts] [RETRY:MAX_REACHED]', { 
        sellerId, 
        attempts: retryCountRef.current,
      });
      return;
    }

    const delay = RETRY_DELAYS[retryCountRef.current] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    retryCountRef.current += 1;

    console.log('[useInstantProducts] [RETRY:SCHEDULED]', { 
      sellerId, 
      attempt: retryCountRef.current,
      delay: `${delay}ms`,
    });

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !isOffline) {
        triggerBackgroundRefresh(queryOptions);
      }
    }, delay);
  }, [sellerId, isOffline, triggerBackgroundRefresh]);

  /**
   * Load more products for infinite scroll - Requirements 6.3
   */
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isRefreshing) return;
    loadProducts(false);
  }, [hasMore, isLoading, isRefreshing, loadProducts]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    metricsRef.current = {
      navigationStart: Date.now(),
      skeletonRender: null,
      firstContentRender: null,
      cacheType: 'none',
    };
    loadProducts(true);
  }, [loadProducts]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    metricsRef.current.navigationStart = Date.now();
    
    // Initialize performance tracker - Requirements 7.1, 7.2, 7.3
    performanceTrackerRef.current = PerformanceMonitoringService.createLoadTracker(
      sellerId,
      categoryFilter,
      searchTerm
    );
    
    // Log skeleton render time - Requirements 6.1, 7.1
    metricsRef.current.skeletonRender = Date.now();
    performanceTrackerRef.current.markSkeletonRender();
    
    // Track recently viewed seller - Requirements 7.5
    ProductCacheService.trackRecentlyViewed(sellerId);
    
    loadProducts(true);

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [sellerId, categoryFilter, searchTerm]);

  // Register for cache updates
  useEffect(() => {
    const unsubscribe = ProductCacheService.onCacheUpdate(cacheKey, (updatedResult) => {
      if (mountedRef.current && offsetRef.current <= pageSize) {
        setProducts(updatedResult.products);
        setTotalCount(updatedResult.totalCount);
        setCacheStatus(updatedResult.cacheType || 'network');
      }
    });

    return unsubscribe;
  }, [cacheKey, pageSize]);

  return {
    products,
    isLoading,
    isRefreshing,
    hasMore,
    error,
    loadMore,
    refresh,
    cacheStatus,
    isOffline,
    totalCount,
  };
}

export default useInstantProducts;
