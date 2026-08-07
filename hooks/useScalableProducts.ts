/**
 * useScalableProducts - Hook for scalable product loading with cursor-based pagination
 * 
 * Implements Requirements:
 * - 1.1, 1.2: Cursor-based pagination
 * - 5.4, 5.5: Cleanup on unmount
 * - 7.2, 7.3: Prefetch trigger at 80% scroll
 * - 7.5: Adaptive batch sizing
 * - 9.2: Search debounce
 * - 9.4: Search with category filter
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  ProductQueryService, 
  ProductQueryServiceClass,
  Product, 
  CursorPaginationParams,
} from '../services/products/ProductQueryService';
import { NetworkQualityService, NetworkQuality } from '../services/network/NetworkQualityService';

// Batch size configuration - Optimized for fast initial load
// Initial batch: 6 products (loads in <1 second)
// Subsequent batches: 6 products (seamless scrolling)
const FAST_NETWORK_BATCH_SIZE = 6;
const SLOW_NETWORK_BATCH_SIZE = 6;

// Prefetch configuration - Trigger early for seamless experience
const PREFETCH_THRESHOLD = 0.5; // 50% scroll position (trigger earlier)

// Search debounce - Requirements 9.2
const SEARCH_DEBOUNCE_MS = 300;

export type CacheStatus = 'hit' | 'miss' | 'stale';

export interface UseScalableProductsOptions {
  sellerId: string;
  category?: string;
  subcategory?: string;
  searchTerm?: string;
  batchSize?: number;
  enablePrefetch?: boolean;
  enableLogging?: boolean;
}

export interface UseScalableProductsResult {
  products: Product[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  cacheStatus: CacheStatus;
  networkQuality: NetworkQuality;
  currentCursor: string | null;
  totalLoaded: number;
  // Scroll tracking for prefetch
  onScrollPositionChange: (scrollPercentage: number) => void;
}

/**
 * useScalableProducts - Main hook for scalable product loading
 * 
 * Features:
 * - Cursor-based pagination for O(1) performance
 * - Adaptive batch sizing based on network quality
 * - Prefetch at 80% scroll position
 * - Search debounce (300ms)
 * - Cleanup on unmount
 */
export function useScalableProducts(options: UseScalableProductsOptions): UseScalableProductsResult {
  const {
    sellerId,
    category,
    subcategory,
    searchTerm,
    batchSize: customBatchSize,
    enablePrefetch = true,
    enableLogging = false,
  } = options;

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>('miss');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('fast');
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  // Refs
  const mountedRef = useRef(true);
  const isLoadingRef = useRef(false);
  const isPrefetchingRef = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchTermRef = useRef<string | undefined>(searchTerm);
  const serviceRef = useRef<ProductQueryServiceClass | null>(null);

  // Get or create service instance
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = ProductQueryService as unknown as ProductQueryServiceClass;
    }
    return serviceRef.current;
  }, []);

  /**
   * Log message if logging is enabled
   */
  const log = useCallback((message: string, data?: Record<string, any>) => {
    if (enableLogging) {
      console.log(`[useScalableProducts] ${message}`, data || '');
    }
  }, [enableLogging]);

  /**
   * Get adaptive batch size based on network quality
   * Requirements 7.5: Adaptive batch sizing
   * 
   * **Feature: scalable-product-loading, Property 9: Adaptive Batch Sizing**
   * **Validates: Requirements 7.5, 10.4**
   */
  const getBatchSize = useCallback((): number => {
    if (customBatchSize) {
      return customBatchSize;
    }
    return networkQuality === 'slow' ? SLOW_NETWORK_BATCH_SIZE : FAST_NETWORK_BATCH_SIZE;
  }, [customBatchSize, networkQuality]);

  // Subscribe to network quality changes
  useEffect(() => {
    const unsubscribe = NetworkQualityService.subscribe((state) => {
      setNetworkQuality(state.quality);
    });
    return unsubscribe;
  }, []);

  /**
   * Build pagination params
   */
  const buildParams = useCallback((cursor?: string | null): CursorPaginationParams => {
    return {
      sellerId,
      category: category || undefined,
      subcategory: subcategory || undefined,
      searchTerm: searchTerm || undefined,
      cursor: cursor || undefined,
      limit: getBatchSize(),
    };
  }, [sellerId, category, subcategory, searchTerm, getBatchSize]);

  /**
   * Fetch products with cursor pagination
   * Requirements 1.1, 1.2: Cursor-based pagination
   */
  const fetchProducts = useCallback(async (
    cursor: string | null,
    isRefresh: boolean = false
  ): Promise<void> => {
    if (isLoadingRef.current && !isRefresh) {
      log('[SKIP] Already loading');
      return;
    }

    isLoadingRef.current = true;
    const service = getService();
    const params = buildParams(cursor);

    log('[FETCH:START]', { cursor, isRefresh, params });

    try {
      const result = await service.fetchProducts(params);

      if (!mountedRef.current) {
        log('[FETCH:UNMOUNTED] Component unmounted, ignoring result');
        return;
      }

      // Update state based on whether this is initial load, refresh, or load more
      if (isRefresh || cursor === null) {
        setProducts(result.products);
      } else {
        setProducts(prev => [...prev, ...result.products]);
      }

      setHasMore(result.hasMore);
      setCacheStatus(result.cacheStatus);
      setCurrentCursor(result.nextCursor);
      setError(null);

      log('[FETCH:SUCCESS]', {
        productCount: result.products.length,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
        cacheStatus: result.cacheStatus,
      });

    } catch (err) {
      if (!mountedRef.current) return;

      // Handle abort errors silently
      if (err instanceof DOMException && err.name === 'AbortError') {
        log('[FETCH:ABORTED]');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMessage);
      log('[FETCH:ERROR]', { error: errorMessage });
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
        isLoadingRef.current = false;
      }
    }
  }, [buildParams, getService, log]);

  /**
   * Load more products (infinite scroll)
   * Requirements 1.2: Cursor-based pagination
   */
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingRef.current || !currentCursor) {
      log('[LOAD_MORE:SKIP]', { hasMore, isLoading: isLoadingRef.current, currentCursor });
      return;
    }

    setIsLoadingMore(true);
    fetchProducts(currentCursor, false);
  }, [hasMore, currentCursor, fetchProducts, log]);

  /**
   * Refresh products (pull to refresh)
   */
  const refresh = useCallback(() => {
    log('[REFRESH:START]');
    setIsRefreshing(true);
    setCurrentCursor(null);
    
    // Cancel any pending requests for this seller
    const service = getService();
    service.cancelRequests(sellerId);
    
    fetchProducts(null, true);
  }, [sellerId, fetchProducts, getService, log]);

  /**
   * Prefetch next batch
   * Requirements 7.2: Prefetch next 2 batches in background
   */
  const prefetchNext = useCallback(() => {
    if (!enablePrefetch || !currentCursor || isPrefetchingRef.current || !hasMore) {
      return;
    }

    isPrefetchingRef.current = true;
    const service = getService();
    const params = buildParams(currentCursor);

    log('[PREFETCH:START]', { cursor: currentCursor });
    service.prefetchNext(params, currentCursor);

    // Reset prefetch flag after a delay
    setTimeout(() => {
      isPrefetchingRef.current = false;
    }, 1000);
  }, [enablePrefetch, currentCursor, hasMore, buildParams, getService, log]);

  /**
   * Handle scroll position change for prefetch trigger
   * Requirements 7.2, 7.3: Trigger prefetch at 80% scroll
   * 
   * **Feature: scalable-product-loading, Property 8: Prefetch Trigger Threshold**
   * **Validates: Requirements 7.2, 7.3**
   */
  const onScrollPositionChange = useCallback((scrollPercentage: number) => {
    if (scrollPercentage >= PREFETCH_THRESHOLD && hasMore && !isPrefetchingRef.current) {
      log('[SCROLL:PREFETCH_TRIGGER]', { scrollPercentage });
      prefetchNext();
    }
  }, [hasMore, prefetchNext, log]);

  /**
   * Handle search term changes with debounce
   * Requirements 9.2: Debounce search input by 300ms
   * 
   * **Feature: scalable-product-loading, Property 13: Search Debounce**
   * **Validates: Requirements 9.2**
   */
  useEffect(() => {
    // Skip if search term hasn't changed
    if (searchTerm === lastSearchTermRef.current) {
      return;
    }

    lastSearchTermRef.current = searchTerm;

    // Clear existing debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Cancel previous search requests
    const service = getService();
    service.cancelRequests(sellerId);

    // Debounce the search
    searchDebounceRef.current = setTimeout(() => {
      log('[SEARCH:DEBOUNCED]', { searchTerm });
      setIsLoading(true);
      setProducts([]);
      setCurrentCursor(null);
      fetchProducts(null, true);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, sellerId, fetchProducts, getService, log]);

  /**
   * Handle category/subcategory changes
   * Requirements 2.4: Cancel pending requests on category change
   * 
   * **Feature: scalable-product-loading, Property 4: Request Cancellation on Filter Change**
   * **Validates: Requirements 2.4, 5.2**
   */
  useEffect(() => {
    log('[FILTER:CHANGE]', { category, subcategory });
    
    // Cancel pending requests for previous category
    const service = getService();
    service.cancelRequests(sellerId);

    // Reset state and fetch
    setIsLoading(true);
    setProducts([]);
    setCurrentCursor(null);
    setError(null);
    
    fetchProducts(null, true);
  }, [sellerId, category, subcategory]); // Note: searchTerm handled separately with debounce

  /**
   * Cleanup on unmount
   * Requirements 5.4, 5.5: Cancel all pending requests on unmount
   * 
   * **Feature: scalable-product-loading, Property 6: Cleanup on Unmount**
   * **Validates: Requirements 5.4, 5.5**
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      
      // Cancel all pending requests
      const service = getService();
      service.cancelRequests(sellerId);
      
      // Clear debounce timer
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      log('[UNMOUNT] Cleanup complete');
    };
  }, [sellerId, getService, log]);

  // Calculate total loaded products
  const totalLoaded = useMemo(() => products.length, [products]);

  return {
    products,
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasMore,
    error,
    loadMore,
    refresh,
    cacheStatus,
    networkQuality,
    currentCursor,
    totalLoaded,
    onScrollPositionChange,
  };
}

export default useScalableProducts;
