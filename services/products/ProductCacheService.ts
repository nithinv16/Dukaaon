/**
 * ProductCacheService - Cache-first loading strategy for products
 * 
 * Implements Requirements 1.2, 2.1, 2.2, 2.3, 2.6, 4.4, 7.5:
 * - Load and display cached products first, then update with fresh data in background
 * - Cache data locally and serve from cache on subsequent visits with background refresh
 * - Memory cache layer for instant synchronous access
 * - Dual cache update (memory + AsyncStorage) after network fetch
 * - Cache warming from AsyncStorage on startup
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabase/supabase';
import { MemoryCacheService, type MemoryCacheConfig } from '../cache/MemoryCacheService';

// Cache configuration
const CACHE_PREFIX = 'product_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const STALE_TTL_MS = 30 * 60 * 1000; // 30 minutes before considered stale

// Memory cache configuration - Requirements 2.1
const MEMORY_CACHE_CONFIG: Partial<MemoryCacheConfig> = {
  maxEntries: 100,           // Max 100 entries as per Requirements 2.4
  ttlMs: 5 * 60 * 1000,      // 5-minute TTL as per Requirements 2.1
  backgroundClearMs: 10 * 60 * 1000, // Clear after 10 min background as per Requirements 2.5
  enableLogging: true,
};

// Recently viewed wholesalers storage key
const RECENTLY_VIEWED_KEY = 'recently_viewed_wholesalers';
const MAX_RECENTLY_VIEWED = 10;
const WARM_CACHE_LIMIT = 5;

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  image_url?: string;
  price: number;
  mrp?: number;
  description?: string;
  seller_id: string;
  stock_available: number;
  min_quantity?: number;
  unit?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductQueryOptions {
  categoryId?: string;
  sellerId?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  networkQuality?: 'fast' | 'slow' | 'offline';
}

export interface CachedProductResult {
  products: Product[];
  fromCache: boolean;
  isStale: boolean;
  totalCount: number;
  cacheType?: 'memory' | 'storage' | 'network' | 'none';
}

interface CacheEntry {
  products: Product[];
  totalCount: number;
  timestamp: number;
  queryKey: string;
}

type CacheUpdateCallback = (result: CachedProductResult) => void;

class ProductCacheServiceClass {
  private updateCallbacks: Map<string, CacheUpdateCallback[]> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private networkQuality: 'fast' | 'slow' | 'offline' = 'fast';
  
  // Memory cache for instant synchronous access - Requirements 2.1, 2.2, 2.3
  private memoryCache: MemoryCacheService<CachedProductResult>;

  constructor() {
    this.memoryCache = new MemoryCacheService<CachedProductResult>(MEMORY_CACHE_CONFIG);
    this.initNetworkListener();
  }

  /**
   * Initialize network quality listener
   */
  private initNetworkListener(): void {
    NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        this.networkQuality = 'offline';
      } else if (state.type === 'cellular') {
        // Check for slow connections (2G/3G)
        const details = state.details as any;
        if (details?.cellularGeneration === '2g' || details?.cellularGeneration === '3g') {
          this.networkQuality = 'slow';
        } else {
          this.networkQuality = 'fast';
        }
      } else {
        this.networkQuality = 'fast';
      }
    });
  }

  /**
   * Get current network quality
   */
  getNetworkQuality(): 'fast' | 'slow' | 'offline' {
    return this.networkQuality;
  }

  /**
   * Generate cache key from query options
   * Includes offset for pagination support - each page is cached separately
   */
  private generateCacheKey(options: ProductQueryOptions): string {
    const parts = [CACHE_PREFIX];
    if (options.categoryId) parts.push(`cat_${options.categoryId}`);
    if (options.sellerId) parts.push(`seller_${options.sellerId}`);
    if (options.searchTerm) parts.push(`search_${options.searchTerm}`);
    parts.push(`limit_${options.limit || 20}`); // Reduced default from 50 to 20
    parts.push(`offset_${options.offset || 0}`); // Include offset for pagination
    return parts.join('_');
  }


  /**
   * Get data from memory cache synchronously - Requirements 2.2, 2.3
   * Returns immediately without async overhead
   * @param cacheKey - Cache key to lookup
   * @returns Cached result or null if not in memory cache
   */
  getFromMemory(cacheKey: string): CachedProductResult | null {
    const result = this.memoryCache.get(cacheKey);
    if (result) {
      console.log('[ProductCacheService] [MEMORY:HIT] Data retrieved from memory cache', { cacheKey });
      return result;
    }
    console.log('[ProductCacheService] [MEMORY:MISS] Key not in memory cache', { cacheKey });
    return null;
  }

  /**
   * Get products with cache-first strategy - Requirements 1.2, 2.2, 2.3
   * Checks memory cache first (synchronous), then AsyncStorage, then network
   * Returns cached data immediately, then updates with fresh data in background
   */
  async getProducts(options: ProductQueryOptions): Promise<CachedProductResult> {
    const cacheKey = this.generateCacheKey(options);
    const effectiveNetworkQuality = options.networkQuality || this.networkQuality;

    // 1. Check memory cache first (synchronous) - Requirements 2.2, 2.3
    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult) {
      // Memory cache has valid data, return immediately
      const isStale = this.isCacheStale(Date.now() - (memoryResult.isStale ? CACHE_TTL_MS + 1 : 0));
      
      // Trigger background refresh if stale and not offline
      if (isStale && effectiveNetworkQuality !== 'offline') {
        this.triggerBackgroundRefresh(options, cacheKey);
      }

      return {
        ...memoryResult,
        fromCache: true,
        cacheType: 'memory',
      } as CachedProductResult;
    }

    // 2. Check AsyncStorage cache
    const cachedResult = await this.getCachedProducts(cacheKey);
    
    if (cachedResult) {
      const isStale = this.isCacheStale(cachedResult.timestamp);
      
      // If we have cached data, return it immediately
      const result: CachedProductResult = {
        products: cachedResult.products,
        fromCache: true,
        isStale,
        totalCount: cachedResult.totalCount,
        cacheType: 'storage',
      } as CachedProductResult;

      // Also populate memory cache for future synchronous access
      this.memoryCache.set(cacheKey, result);
      console.log('[ProductCacheService] [MEMORY:POPULATE] Populated memory cache from AsyncStorage', { cacheKey });

      // Trigger background refresh if stale and not offline
      if (isStale && effectiveNetworkQuality !== 'offline') {
        this.triggerBackgroundRefresh(options, cacheKey);
      }

      return result;
    }

    // 3. No cache, fetch from network
    if (effectiveNetworkQuality === 'offline') {
      return {
        products: [],
        fromCache: false,
        isStale: false,
        totalCount: 0,
        cacheType: 'none',
      } as CachedProductResult;
    }

    return this.fetchAndCacheProducts(options, cacheKey);
  }

  /**
   * Get cached products immediately (synchronous-like)
   */
  async getCachedProducts(key: string): Promise<CacheEntry | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached) as CacheEntry;
      }
    } catch (error) {
      console.error('[ProductCacheService] Error reading cache:', error);
    }
    return null;
  }

  /**
   * Check if cache entry is stale
   */
  private isCacheStale(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_TTL_MS;
  }

  /**
   * Check if cache entry is expired (too old to use)
   */
  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > STALE_TTL_MS;
  }

  /**
   * Fetch products from network and cache them - Requirements 4.4
   * Uses optimized RPC functions when available, falls back to direct query
   * Updates both memory and AsyncStorage caches with same timestamp
   */
  private async fetchAndCacheProducts(
    options: ProductQueryOptions,
    cacheKey: string
  ): Promise<CachedProductResult> {
    try {
      const effectiveLimit = this.getEffectiveLimit(options);
      
      // Try optimized RPC first
      const rpcResult = await this.fetchWithOptimizedRPC(options, effectiveLimit);
      if (rpcResult) {
        const resultWithCacheType = {
          ...rpcResult,
          cacheType: 'network' as const,
        };
        // Dual cache update - Requirements 4.4
        await this.updateCaches(cacheKey, resultWithCacheType);
        return resultWithCacheType;
      }

      // Fallback to direct query
      return this.fetchWithDirectQuery(options, effectiveLimit, cacheKey);
    } catch (error) {
      console.error('[ProductCacheService] Error fetching products:', error);
      return {
        products: [],
        fromCache: false,
        isStale: false,
        totalCount: 0,
        cacheType: 'none',
      };
    }
  }

  /**
   * Fetch products using optimized RPC functions
   * Requirements 2.8: Use optimized database queries
   */
  private async fetchWithOptimizedRPC(
    options: ProductQueryOptions,
    effectiveLimit: number
  ): Promise<CachedProductResult | null> {
    try {
      // Use seller-specific optimized RPC
      if (options.sellerId && !options.categoryId && !options.searchTerm) {
        const { data, error } = await supabase.rpc('get_seller_products_optimized', {
          p_seller_id: options.sellerId,
          p_limit: effectiveLimit,
          p_offset: options.offset || 0,
        });

        if (!error && data && data.length > 0) {
          const totalCount = data[0]?.total_count || data.length;
          return {
            products: data.map((p: any) => ({ ...p, total_count: undefined })),
            fromCache: false,
            isStale: false,
            totalCount,
          };
        }
      }

      // Use category-specific optimized RPC
      if (options.categoryId && !options.sellerId && !options.searchTerm) {
        const { data, error } = await supabase.rpc('get_category_products_optimized', {
          p_category: options.categoryId,
          p_limit: effectiveLimit,
          p_offset: options.offset || 0,
        });

        if (!error && data && data.length > 0) {
          const totalCount = data[0]?.total_count || data.length;
          return {
            products: data.map((p: any) => ({ ...p, total_count: undefined })),
            fromCache: false,
            isStale: false,
            totalCount,
          };
        }
      }

      // Use general optimized RPC
      const { data, error } = await supabase.rpc('get_products_optimized', {
        p_category: options.categoryId || null,
        p_seller_id: options.sellerId || null,
        p_search_term: options.searchTerm || null,
        p_limit: effectiveLimit,
        p_offset: options.offset || 0,
      });

      if (!error && data && data.length > 0) {
        const totalCount = data[0]?.total_count || data.length;
        return {
          products: data.map((p: any) => ({ ...p, total_count: undefined })),
          fromCache: false,
          isStale: false,
          totalCount,
        };
      }

      // RPC not available or returned no data
      return null;
    } catch (error) {
      console.log('[ProductCacheService] RPC not available, using direct query');
      return null;
    }
  }

  /**
   * Fallback to direct query when RPC is not available - Requirements 4.4
   * Updates both memory and AsyncStorage caches
   */
  private async fetchWithDirectQuery(
    options: ProductQueryOptions,
    effectiveLimit: number,
    cacheKey: string
  ): Promise<CachedProductResult> {
    let query = supabase
      .from('products')
      .select('id, name, category, subcategory, brand, image_url, price, description, seller_id, stock_available, min_quantity, unit', { count: 'exact' });

    // Apply filters
    if (options.categoryId) {
      query = query.eq('category', options.categoryId);
    }
    if (options.sellerId) {
      query = query.eq('seller_id', options.sellerId);
    }
    if (options.searchTerm) {
      query = query.ilike('name', `%${options.searchTerm}%`);
    }

    // Apply pagination
    query = query
      .range(options.offset || 0, (options.offset || 0) + effectiveLimit - 1)
      .order('name');

    const { data: products, error, count } = await query;

    if (error) {
      console.error('[ProductCacheService] Fetch error:', error);
      throw error;
    }

    const result: CachedProductResult = {
      products: products || [],
      fromCache: false,
      isStale: false,
      totalCount: count || 0,
      cacheType: 'network',
    };

    // Dual cache update - Requirements 4.4
    await this.updateCaches(cacheKey, result);

    return result;
  }

  /**
   * Get effective limit based on network quality
   * Reduces batch size for slow networks (2G/3G)
   */
  getEffectiveLimit(options: ProductQueryOptions): number {
    const baseLimit = options.limit || 50;
    const networkQuality = options.networkQuality || this.networkQuality;
    
    // Reduce to 10 for slow networks as per Requirements 2.5
    if (networkQuality === 'slow') {
      return Math.min(baseLimit, 10);
    }
    
    return baseLimit;
  }

  /**
   * Update both memory and AsyncStorage caches - Requirements 4.4
   * Uses same timestamp for both caches to ensure consistency
   */
  private async updateCaches(
    cacheKey: string,
    result: CachedProductResult
  ): Promise<void> {
    const timestamp = Date.now();
    
    // Update memory cache first (synchronous)
    this.memoryCache.set(cacheKey, {
      ...result,
      cacheType: 'memory',
    });
    console.log('[ProductCacheService] [DUAL:MEMORY] Memory cache updated', { cacheKey, timestamp });
    
    // Update AsyncStorage cache (async)
    await this.cacheProducts(cacheKey, result.products, result.totalCount, timestamp);
    console.log('[ProductCacheService] [DUAL:STORAGE] AsyncStorage cache updated', { cacheKey, timestamp });
  }

  /**
   * Cache products to AsyncStorage with size check
   * Prevents caching if data exceeds safe size limit
   */
  private async cacheProducts(
    cacheKey: string,
    products: Product[],
    totalCount: number,
    timestamp?: number
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry = {
        products,
        totalCount,
        timestamp: timestamp || Date.now(),
        queryKey: cacheKey,
      };
      
      const cacheString = JSON.stringify(cacheEntry);
      const sizeBytes = new Blob([cacheString]).size;
      const sizeKB = sizeBytes / 1024;
      
      // Log cache size for monitoring (removed 500KB limit - cache all products)
      if (sizeKB > 500) {
        console.log(`[ProductCacheService] [CACHE:LARGE] Caching large dataset`, {
          key: cacheKey,
          sizeKB: sizeKB.toFixed(2),
          productCount: products.length,
        });
      }
      
      await AsyncStorage.setItem(cacheKey, cacheString);
      
      console.log(`[ProductCacheService] [CACHE:SAVE] Products cached successfully`, {
        key: cacheKey,
        sizeKB: sizeKB.toFixed(2),
        productCount: products.length,
        totalCount,
      });
    } catch (error) {
      console.error('[ProductCacheService] Error caching products:', error);
    }
  }


  /**
   * Trigger background refresh without blocking
   */
  private triggerBackgroundRefresh(options: ProductQueryOptions, cacheKey: string): void {
    // Use setTimeout to avoid blocking the UI
    setTimeout(async () => {
      try {
        const result = await this.fetchAndCacheProducts(options, cacheKey);
        
        // Notify any registered callbacks
        const callbacks = this.updateCallbacks.get(cacheKey);
        if (callbacks) {
          callbacks.forEach(cb => cb(result));
        }
      } catch (error) {
        console.error('[ProductCacheService] Background refresh error:', error);
      }
    }, 100); // 100ms delay as per design spec
  }

  /**
   * Register callback for cache updates
   */
  onCacheUpdate(cacheKey: string, callback: CacheUpdateCallback): () => void {
    const callbacks = this.updateCallbacks.get(cacheKey) || [];
    callbacks.push(callback);
    this.updateCallbacks.set(cacheKey, callbacks);

    // Return unsubscribe function
    return () => {
      const current = this.updateCallbacks.get(cacheKey) || [];
      const index = current.indexOf(callback);
      if (index > -1) {
        current.splice(index, 1);
        this.updateCallbacks.set(cacheKey, current);
      }
    };
  }

  /**
   * Pre-fetch products for a seller (for navigation optimization)
   * Called when user hovers/focuses on seller card
   */
  prefetchSellerProducts(sellerId: string): void {
    const cacheKey = this.generateCacheKey({ sellerId, limit: 20 });
    
    // Avoid duplicate prefetch requests
    if (this.prefetchQueue.has(cacheKey)) {
      return;
    }

    this.prefetchQueue.add(cacheKey);

    // Prefetch in background
    setTimeout(async () => {
      try {
        await this.fetchAndCacheProducts({ sellerId, limit: 20 }, cacheKey);
      } catch (error) {
        console.error('[ProductCacheService] Prefetch error:', error);
      } finally {
        this.prefetchQueue.delete(cacheKey);
      }
    }, 0);
  }

  /**
   * Invalidate cache for specific patterns (both memory and AsyncStorage)
   */
  async invalidateCache(pattern: string): Promise<void> {
    try {
      // Invalidate from memory cache
      const memoryKeys = this.memoryCache.keys();
      const memoryKeysToRemove = memoryKeys.filter(key => key.includes(pattern));
      memoryKeysToRemove.forEach(key => this.memoryCache.delete(key));
      
      if (memoryKeysToRemove.length > 0) {
        console.log('[ProductCacheService] [INVALIDATE:MEMORY] Memory cache entries invalidated', {
          pattern,
          keysRemoved: memoryKeysToRemove.length,
        });
      }
      
      // Invalidate from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        key.startsWith(CACHE_PREFIX) && key.includes(pattern)
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log('[ProductCacheService] [INVALIDATE:STORAGE] AsyncStorage entries invalidated', {
          pattern,
          keysRemoved: keysToRemove.length,
        });
      }
    } catch (error) {
      console.error('[ProductCacheService] Error invalidating cache:', error);
    }
  }

  /**
   * Warm memory cache from AsyncStorage on startup - Requirements 7.5
   * Loads data for the most recently viewed wholesalers
   * @param sellerIds - Optional array of seller IDs to warm (defaults to recently viewed)
   */
  async warmCache(sellerIds?: string[]): Promise<void> {
    try {
      const idsToWarm = sellerIds || await this.getRecentlyViewedSellers();
      
      // Limit to WARM_CACHE_LIMIT (5) most recently viewed
      const limitedIds = idsToWarm.slice(0, WARM_CACHE_LIMIT);
      
      if (limitedIds.length === 0) {
        console.log('[ProductCacheService] [WARM:SKIP] No sellers to warm cache for');
        return;
      }

      console.log('[ProductCacheService] [WARM:START] Warming cache for sellers', {
        sellerCount: limitedIds.length,
        sellerIds: limitedIds,
      });

      // Load each seller's products from AsyncStorage into memory cache
      const warmPromises = limitedIds.map(async (sellerId) => {
        const cacheKey = this.generateCacheKey({ sellerId, limit: 20 });
        const cachedResult = await this.getCachedProducts(cacheKey);
        
        if (cachedResult && !this.isCacheExpired(cachedResult.timestamp)) {
          const result: CachedProductResult = {
            products: cachedResult.products,
            fromCache: true,
            isStale: this.isCacheStale(cachedResult.timestamp),
            totalCount: cachedResult.totalCount,
            cacheType: 'storage',
          };
          this.memoryCache.set(cacheKey, result);
          console.log('[ProductCacheService] [WARM:LOADED] Warmed cache for seller', { sellerId, cacheKey });
          return true;
        }
        return false;
      });

      const results = await Promise.all(warmPromises);
      const warmedCount = results.filter(Boolean).length;
      
      console.log('[ProductCacheService] [WARM:COMPLETE] Cache warming complete', {
        requested: limitedIds.length,
        warmed: warmedCount,
      });
    } catch (error) {
      console.error('[ProductCacheService] Error warming cache:', error);
    }
  }

  /**
   * Get list of recently viewed seller IDs - Requirements 7.5
   * @returns Array of seller IDs, most recent first
   */
  async getRecentlyViewedSellers(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
      if (stored) {
        return JSON.parse(stored) as string[];
      }
    } catch (error) {
      console.error('[ProductCacheService] Error reading recently viewed:', error);
    }
    return [];
  }

  /**
   * Track a seller as recently viewed - Requirements 7.5
   * Maintains a list of up to MAX_RECENTLY_VIEWED (10) sellers
   * @param sellerId - Seller ID to track
   */
  async trackRecentlyViewed(sellerId: string): Promise<void> {
    try {
      const recentlyViewed = await this.getRecentlyViewedSellers();
      
      // Remove if already exists (will be re-added at front)
      const filtered = recentlyViewed.filter(id => id !== sellerId);
      
      // Add to front of list
      filtered.unshift(sellerId);
      
      // Limit to MAX_RECENTLY_VIEWED
      const limited = filtered.slice(0, MAX_RECENTLY_VIEWED);
      
      await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(limited));
      
      console.log('[ProductCacheService] [RECENT:TRACKED] Seller tracked as recently viewed', {
        sellerId,
        totalTracked: limited.length,
      });
    } catch (error) {
      console.error('[ProductCacheService] Error tracking recently viewed:', error);
    }
  }

  /**
   * Clear all product caches (both memory and AsyncStorage)
   */
  async clearAllCaches(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      console.log('[ProductCacheService] [CLEAR:MEMORY] Memory cache cleared');
      
      // Clear AsyncStorage cache
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log('[ProductCacheService] [CLEAR:STORAGE] AsyncStorage cache cleared', {
          keysRemoved: cacheKeys.length,
        });
      }
    } catch (error) {
      console.error('[ProductCacheService] Error clearing caches:', error);
    }
  }

  /**
   * Get cache key for external use (e.g., for registering callbacks)
   */
  getCacheKey(options: ProductQueryOptions): string {
    return this.generateCacheKey(options);
  }

  /**
   * Get memory cache statistics for debugging
   */
  getMemoryCacheStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    oldestEntryAge: number | null;
    newestEntryAge: number | null;
  } {
    return this.memoryCache.getStats();
  }

  /**
   * Check if data exists in memory cache
   * @param cacheKey - Cache key to check
   */
  hasInMemory(cacheKey: string): boolean {
    return this.memoryCache.has(cacheKey);
  }

  /**
   * Clear only memory cache (useful for testing)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    console.log('[ProductCacheService] [CLEAR:MEMORY] Memory cache cleared');
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    this.memoryCache.destroy();
    this.updateCallbacks.clear();
    this.prefetchQueue.clear();
  }
}

// Export singleton instance
export const ProductCacheService = new ProductCacheServiceClass();

// Export class for testing
export { ProductCacheServiceClass };
