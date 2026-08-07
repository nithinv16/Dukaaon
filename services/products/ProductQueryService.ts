/**
 * ProductQueryService - Cursor-based product fetching with caching and request management
 * 
 * Implements Requirements:
 * - 1.1, 1.2, 1.4: Cursor-based pagination
 * - 2.1, 2.2: Server-side category filtering
 * - 5.1, 5.2, 5.3: Request deduplication and cancellation
 * - 8.1, 8.2, 8.3, 8.4, 8.5: Category-specific caching with stale-while-revalidate
 * - 7.2: Prefetch for next batch
 */

import { supabase } from '../supabase/supabase';
import { 
  RequestQueueManagerClass,
  generateCacheKey,
  type CursorPaginationParams,
  type CursorPaginationResult,
} from './RequestQueueManager';
import { PerformanceMonitoringService, type QueryPerformanceMetrics } from '../performance';

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - Requirements 8.3
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before triggering background refresh
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB - Requirements 8.4
// Optimized batch sizes for fast initial load (<1 second)
const DEFAULT_BATCH_SIZE = 6;
const SLOW_NETWORK_BATCH_SIZE = 6;

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  image_url?: string;
  price: number;
  mrp?: number;
  min_quantity?: number;
  unit?: string;
  stock_available?: number;
  seller_id: string;
}

export interface ProductQueryResult extends CursorPaginationResult<Product> {
  cacheStatus: 'hit' | 'miss' | 'stale';
  queryTime?: number;
}

interface CacheEntry {
  result: CursorPaginationResult<Product>;
  timestamp: number;
  sizeBytes: number;
}

export interface ProductQueryServiceConfig {
  enableLogging?: boolean;
  cacheTtlMs?: number;
  maxCacheSizeBytes?: number;
}

const DEFAULT_CONFIG: ProductQueryServiceConfig = {
  enableLogging: true,
  cacheTtlMs: CACHE_TTL_MS,
  maxCacheSizeBytes: MAX_CACHE_SIZE_BYTES,
};

/**
 * ProductQueryService - Main service for fetching products with cursor pagination
 * 
 * Features:
 * - Cursor-based pagination for O(1) performance
 * - Request deduplication via RequestQueueManager
 * - Category-specific caching with LRU eviction
 * - Stale-while-revalidate pattern
 * - Background prefetching
 */
export class ProductQueryServiceClass {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private currentCacheSize: number = 0;
  private requestQueue: RequestQueueManagerClass<Product>;
  private config: ProductQueryServiceConfig;
  private backgroundRefreshInProgress: Set<string> = new Set();

  constructor(config: Partial<ProductQueryServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requestQueue = new RequestQueueManagerClass({ enableLogging: this.config.enableLogging });
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.config.enableLogging) {
      console.log(`[ProductQueryService] ${message}`, data || '');
    }
  }

  /**
   * Generate unique cache key from params
   * Requirements 8.1: Cache key uniqueness
   * 
   * **Feature: scalable-product-loading, Property 10: Cache Key Uniqueness**
   * **Validates: Requirements 8.1**
   */
  getCacheKey(params: CursorPaginationParams): string {
    return generateCacheKey(params);
  }

  /**
   * Estimate size of cache entry in bytes
   */
  private estimateSizeBytes(result: CursorPaginationResult<Product>): number {
    // Rough estimate: JSON stringify and get length
    try {
      return JSON.stringify(result).length * 2; // UTF-16 chars = 2 bytes each
    } catch {
      return result.products.length * 500; // Fallback: ~500 bytes per product
    }
  }

  /**
   * Check if cache entry is stale (older than threshold)
   */
  private isCacheStale(timestamp: number): boolean {
    return Date.now() - timestamp > STALE_THRESHOLD_MS;
  }

  /**
   * Check if cache entry is expired (older than TTL)
   */
  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > (this.config.cacheTtlMs || CACHE_TTL_MS);
  }

  /**
   * Get from cache if available
   * Requirements 8.1, 8.2: Cache-first strategy
   */
  getFromCache(params: CursorPaginationParams): ProductQueryResult | null {
    const cacheKey = this.getCacheKey(params);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.log('[CACHE:MISS] No cache entry', { cacheKey });
      return null;
    }

    // Check if expired
    if (this.isCacheExpired(entry.timestamp)) {
      this.log('[CACHE:EXPIRED] Entry expired, removing', { cacheKey });
      this.cache.delete(cacheKey);
      this.currentCacheSize -= entry.sizeBytes;
      return null;
    }

    const isStale = this.isCacheStale(entry.timestamp);
    
    this.log('[CACHE:HIT] Returning cached data', { 
      cacheKey, 
      isStale,
      age: Date.now() - entry.timestamp,
    });

    return {
      ...entry.result,
      fromCache: true,
      cacheStatus: isStale ? 'stale' : 'hit',
    };
  }

  /**
   * Store result in cache with LRU eviction
   * Requirements 8.1, 8.4: Category-specific caching with size limit
   */
  private setCache(params: CursorPaginationParams, result: CursorPaginationResult<Product>): void {
    const cacheKey = this.getCacheKey(params);
    const sizeBytes = this.estimateSizeBytes(result);

    // Evict entries if cache would exceed max size
    while (this.currentCacheSize + sizeBytes > (this.config.maxCacheSizeBytes || MAX_CACHE_SIZE_BYTES)) {
      if (!this.evictLRU()) {
        break; // No more entries to evict
      }
    }

    // Remove existing entry if present
    const existingEntry = this.cache.get(cacheKey);
    if (existingEntry) {
      this.currentCacheSize -= existingEntry.sizeBytes;
    }

    // Add new entry
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      sizeBytes,
    };

    this.cache.set(cacheKey, entry);
    this.cacheTimestamps.set(cacheKey, entry.timestamp);
    this.currentCacheSize += sizeBytes;

    this.log('[CACHE:SET] Cached result', {
      cacheKey,
      sizeBytes,
      totalCacheSize: this.currentCacheSize,
      productCount: result.products.length,
    });
  }

  /**
   * Evict least-recently-used cache entry
   * Requirements 8.4: LRU eviction when exceeding 50MB
   */
  private evictLRU(): boolean {
    if (this.cache.size === 0) {
      return false;
    }

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentCacheSize -= entry.sizeBytes;
      }
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
      
      this.log('[CACHE:EVICT] LRU entry evicted', { evictedKey: oldestKey });
      return true;
    }

    return false;
  }

  /**
   * Fetch products from database using cursor pagination
   * Requirements 1.1, 1.2, 1.4: Cursor-based pagination
   * Requirements 10.1, 10.2: Log database query time and slow request warnings
   */
  /**
   * Fallback query using standard Supabase query builder
   * Used when get_products_cursor RPC function doesn't exist
   */
  private async fetchFromDatabaseFallback(
    params: CursorPaginationParams,
    signal?: AbortSignal
  ): Promise<{ data: any[]; hasMore: boolean }> {
    const limit = params.limit || DEFAULT_BATCH_SIZE;
    
    this.log('[FETCH:FALLBACK] Using standard query (RPC not available)', {
      sellerId: params.sellerId,
      category: params.category,
    });

    // Build query with filters
    let query = supabase
      .from('products')
      .select('id, name, category, subcategory, brand, image_url, price, mrp, min_quantity, unit_of_measure, stock_quantity')
      .eq('seller_id', params.sellerId)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .limit(limit + 1); // Fetch one extra to check hasMore

    // Apply cursor filter
    if (params.cursor) {
      query = query.gt('id', params.cursor);
    }

    // Apply category filter
    if (params.category) {
      query = query.eq('category', params.category);
    }

    // Apply subcategory filter
    if (params.subcategory) {
      query = query.eq('subcategory', params.subcategory);
    }

    // Apply search filter (ILIKE fallback - slower than full-text search)
    if (params.searchTerm) {
      query = query.ilike('name', `%${params.searchTerm}%`);
    }

    // Check if aborted
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Check hasMore by seeing if we got more than limit
    const hasMore = (data?.length || 0) > limit;
    const products = (data || []).slice(0, limit);

    return { data: products, hasMore };
  }

  private async fetchFromDatabase(
    params: CursorPaginationParams,
    signal?: AbortSignal,
    cacheStatus: 'hit' | 'miss' | 'stale' = 'miss'
  ): Promise<CursorPaginationResult<Product> & { queryTimeMs: number }> {
    const requestStartTime = Date.now();
    const limit = params.limit || DEFAULT_BATCH_SIZE;

    this.log('[FETCH:START] Fetching from database', {
      sellerId: params.sellerId,
      category: params.category,
      cursor: params.cursor,
      limit,
    });

    try {
      // Check if aborted before making request
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      // Track database query time separately - Requirements 10.1
      const dbQueryStartTime = Date.now();
      
      let data: any[] | null = null;
      let hasMore = false;
      let usedFallback = false;

      // Try RPC first, fallback to standard query if RPC doesn't exist
      try {
        const rpcResult = await supabase.rpc('get_products_cursor', {
          p_seller_id: params.sellerId,
          p_category: params.category || null,
          p_subcategory: params.subcategory || null,
          p_search_term: params.searchTerm || null,
          p_cursor: params.cursor || null,
          p_limit: limit,
        });

        if (rpcResult.error) {
          // Check if error is because function doesn't exist
          if (rpcResult.error.message?.includes('function') || 
              rpcResult.error.code === '42883' || // undefined_function
              rpcResult.error.code === 'PGRST202') { // function not found
            this.log('[FETCH:RPC_NOT_FOUND] RPC function not found, using fallback');
            const fallbackResult = await this.fetchFromDatabaseFallback(params, signal);
            data = fallbackResult.data;
            hasMore = fallbackResult.hasMore;
            usedFallback = true;
          } else {
            throw rpcResult.error;
          }
        } else {
          data = rpcResult.data;
          // Get has_more from first row (all rows have same value)
          hasMore = data && data.length > 0 ? data[0].has_more : false;
        }
      } catch (rpcError: any) {
        // If RPC fails for any reason, try fallback
        if (!usedFallback) {
          this.log('[FETCH:RPC_ERROR] RPC failed, trying fallback', { error: String(rpcError) });
          const fallbackResult = await this.fetchFromDatabaseFallback(params, signal);
          data = fallbackResult.data;
          hasMore = fallbackResult.hasMore;
          usedFallback = true;
        } else {
          throw rpcError;
        }
      }

      const dbQueryEndTime = Date.now();
      const databaseQueryTimeMs = dbQueryEndTime - dbQueryStartTime;

      // Check if aborted after request
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      const totalTimeMs = Date.now() - requestStartTime;
      // Network time is total minus database query time (includes serialization, etc.)
      const networkTimeMs = totalTimeMs - databaseQueryTimeMs;
      
      // Parse response - handle both RPC and fallback formats
      const products: Product[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        subcategory: row.subcategory,
        brand: row.brand,
        image_url: row.image_url,
        price: row.price,
        mrp: row.mrp,
        min_quantity: row.min_quantity,
        unit: row.unit || row.unit_of_measure,
        stock_available: row.stock_available || row.stock_quantity,
        seller_id: params.sellerId,
      }));
      
      // Get next cursor from last product
      const nextCursor = products.length > 0 ? products[products.length - 1].id : null;

      this.log('[FETCH:SUCCESS] Fetched products', {
        count: products.length,
        hasMore,
        nextCursor,
        databaseQueryTimeMs,
        networkTimeMs,
        totalTimeMs,
      });

      // Log query performance metrics - Requirements 10.1, 10.2, 10.3
      const queryMetrics: QueryPerformanceMetrics = {
        sellerId: params.sellerId,
        category: params.category,
        subcategory: params.subcategory,
        searchTerm: params.searchTerm,
        cursor: params.cursor,
        databaseQueryTimeMs,
        networkTimeMs,
        totalTimeMs,
        productCount: products.length,
        cacheStatus,
        networkQuality: this.detectNetworkQuality(totalTimeMs, products.length),
        timestamp: Date.now(),
      };
      
      PerformanceMonitoringService.logQueryPerformance(queryMetrics);

      return {
        products,
        nextCursor,
        hasMore,
        fromCache: false,
        queryTimeMs: totalTimeMs,
      };
    } catch (error) {
      // Re-throw abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      
      this.log('[FETCH:ERROR] Fetch failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Detect network quality based on response time - Requirements 10.4
   */
  private detectNetworkQuality(totalTimeMs: number, productCount: number): 'slow' | 'fast' | 'unknown' {
    if (productCount === 0) return 'unknown';
    
    // Normalize by product count (time per product)
    const timePerProduct = totalTimeMs / productCount;
    
    // If > 25ms per product, consider it slow (2G/3G)
    if (timePerProduct > 25) return 'slow';
    // If < 10ms per product, consider it fast (4G/WiFi)
    if (timePerProduct < 10) return 'fast';
    
    return 'unknown';
  }


  /**
   * Fetch products with cache-first strategy and request deduplication
   * Requirements 1.1, 5.1, 8.2, 8.3: Cache-first with stale-while-revalidate
   * 
   * **Feature: scalable-product-loading, Property 11: Cache-First with Stale Revalidation**
   * **Validates: Requirements 8.2, 8.3**
   */
  async fetchProducts(params: CursorPaginationParams): Promise<ProductQueryResult> {
    const cacheKey = this.getCacheKey(params);
    const startTime = Date.now();

    // 1. Check cache first - Requirements 8.2
    const cachedResult = this.getFromCache(params);
    
    if (cachedResult) {
      // If stale, trigger background refresh - Requirements 8.3
      if (cachedResult.cacheStatus === 'stale') {
        this.triggerBackgroundRefresh(params, cacheKey);
      }
      
      return {
        ...cachedResult,
        queryTime: Date.now() - startTime,
      };
    }

    // 2. No cache, fetch from network with deduplication
    this.log('[FETCH:NETWORK] No cache, fetching from network', { cacheKey });

    try {
      const { promise } = this.requestQueue.enqueue(params, async (signal) => {
        return this.fetchFromDatabase(params, signal);
      });

      const result = await promise;
      
      // Cache the result
      this.setCache(params, result);

      return {
        ...result,
        cacheStatus: 'miss',
        queryTime: Date.now() - startTime,
      };
    } catch (error) {
      // Handle abort errors silently
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.log('[FETCH:ABORTED] Request was cancelled', { cacheKey });
        throw error;
      }
      
      this.log('[FETCH:ERROR] Network fetch failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Trigger background refresh for stale cache
   * Requirements 8.3: Background refresh if data > 5 minutes old
   */
  private triggerBackgroundRefresh(params: CursorPaginationParams, cacheKey: string): void {
    // Prevent duplicate background refreshes
    if (this.backgroundRefreshInProgress.has(cacheKey)) {
      this.log('[REFRESH:SKIP] Background refresh already in progress', { cacheKey });
      return;
    }

    this.backgroundRefreshInProgress.add(cacheKey);
    this.log('[REFRESH:START] Starting background refresh', { cacheKey });

    // Use setTimeout to avoid blocking
    setTimeout(async () => {
      try {
        const result = await this.fetchFromDatabase(params);
        this.setCache(params, result);
        this.log('[REFRESH:SUCCESS] Background refresh complete', { cacheKey });
      } catch (error) {
        this.log('[REFRESH:ERROR] Background refresh failed', { 
          cacheKey, 
          error: String(error),
        });
      } finally {
        this.backgroundRefreshInProgress.delete(cacheKey);
      }
    }, 100);
  }

  /**
   * Cancel all pending requests for a seller
   * Requirements 5.2: Cancel pending requests when category changes
   * 
   * **Feature: scalable-product-loading, Property 4: Request Cancellation on Filter Change**
   * **Validates: Requirements 2.4, 5.2**
   */
  cancelRequests(sellerId: string, category?: string): number {
    this.log('[CANCEL] Cancelling requests', { sellerId, category });
    return this.requestQueue.cancelMatching({ sellerId, category });
  }

  /**
   * Cancel all pending requests
   * Requirements 5.4: Cancel all pending requests on navigation away
   */
  cancelAllRequests(): number {
    this.log('[CANCEL:ALL] Cancelling all requests');
    return this.requestQueue.cancelAll();
  }

  /**
   * Invalidate cache for a seller
   * Requirements 8.5: Invalidate all caches for seller when products updated
   * 
   * **Feature: scalable-product-loading, Property 12: Cache Invalidation by Seller**
   * **Validates: Requirements 8.5**
   */
  invalidateCache(sellerId: string): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(sellerId)) {
        keysToDelete.push(key);
        this.currentCacheSize -= entry.sizeBytes;
        invalidatedCount++;
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }

    this.log('[CACHE:INVALIDATE] Invalidated cache for seller', {
      sellerId,
      invalidatedCount,
      remainingCacheSize: this.currentCacheSize,
    });

    return invalidatedCount;
  }

  /**
   * Prefetch next batch in background
   * Requirements 7.2: Prefetch next 2 batches in background
   */
  prefetchNext(params: CursorPaginationParams, currentCursor: string): void {
    const prefetchParams: CursorPaginationParams = {
      ...params,
      cursor: currentCursor,
    };

    const cacheKey = this.getCacheKey(prefetchParams);

    // Skip if already cached
    if (this.cache.has(cacheKey)) {
      this.log('[PREFETCH:SKIP] Already cached', { cacheKey });
      return;
    }

    // Skip if already in flight
    if (this.requestQueue.isInFlight(prefetchParams)) {
      this.log('[PREFETCH:SKIP] Already in flight', { cacheKey });
      return;
    }

    this.log('[PREFETCH:START] Prefetching next batch', { cacheKey });

    // Fetch in background without blocking
    setTimeout(async () => {
      try {
        const result = await this.fetchFromDatabase(prefetchParams);
        this.setCache(prefetchParams, result);
        this.log('[PREFETCH:SUCCESS] Prefetch complete', { cacheKey });
      } catch (error) {
        // Silently ignore prefetch errors
        this.log('[PREFETCH:ERROR] Prefetch failed', { 
          cacheKey, 
          error: String(error),
        });
      }
    }, 0);
  }

  /**
   * Get cache state for debugging
   * Requirements 10.5: Provide way to view current cache state
   */
  getCacheState(): {
    entries: number;
    sizeBytes: number;
    maxSizeBytes: number;
    keys: string[];
  } {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentCacheSize,
      maxSizeBytes: this.config.maxCacheSizeBytes || MAX_CACHE_SIZE_BYTES,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Get pending requests info for debugging
   * Requirements 10.5: Provide way to view pending requests
   */
  getPendingRequests(): Array<{
    id: string;
    cacheKey: string;
    params: CursorPaginationParams;
    age: number;
  }> {
    return this.requestQueue.getPendingRequestsInfo();
  }

  /**
   * Log debug info for cache and pending requests - Requirements 10.5
   * Provides a way to view current cache state and pending requests
   */
  logDebugInfo(): void {
    const cacheState = this.getCacheState();
    const pendingRequests = this.getPendingRequests();
    
    PerformanceMonitoringService.logDebugInfo(cacheState, pendingRequests);
  }

  /**
   * Get full debug state - Requirements 10.5
   * Returns combined cache and request state for debugging
   */
  getDebugState(): {
    cache: { entries: number; sizeBytes: number; maxSizeBytes: number; keys: string[] };
    pendingRequests: Array<{ id: string; cacheKey: string; params: CursorPaginationParams; age: number }>;
    sessionStats: {
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
    };
  } {
    return {
      cache: this.getCacheState(),
      pendingRequests: this.getPendingRequests(),
      sessionStats: PerformanceMonitoringService.getSessionCacheStats(),
    };
  }

  /**
   * Check if a request is currently in flight
   */
  isRequestInFlight(params: CursorPaginationParams): boolean {
    return this.requestQueue.isInFlight(params);
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.requestQueue.getPendingCount();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.currentCacheSize = 0;
    this.log('[CACHE:CLEAR] All caches cleared');
  }

  /**
   * Destroy service and cleanup resources
   */
  destroy(): void {
    this.cancelAllRequests();
    this.clearCache();
    this.backgroundRefreshInProgress.clear();
    this.log('[DESTROY] Service destroyed');
  }
}

// Export singleton instance
export const ProductQueryService = new ProductQueryServiceClass();

// Re-export types from RequestQueueManager
export type { CursorPaginationParams, CursorPaginationResult };
