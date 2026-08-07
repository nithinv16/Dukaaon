/**
 * ProductsDataService - Unified products data fetching with caching
 * 
 * Implements Requirements 1.2, 1.3, 5.1:
 * - Fetch products from database with cache support
 * - Handle network failures gracefully
 * - Retry with exponential backoff
 * 
 * This service wraps the existing ProductCacheService and provides
 * a consistent interface for the DataFetchCoordinator.
 */

import { ProductCacheService, Product, ProductQueryOptions, CachedProductResult } from '../products/ProductCacheService';

export interface ProductsFetchOptions {
  userId: string;
  filter?: 'trending' | 'personalized' | 'all';
  limit?: number;
  useCache?: boolean;
}

export interface ProductsFetchResult {
  products: Product[];
  fromCache: boolean;
  error?: string;
}

class ProductsDataServiceClass {
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  /**
   * Fetch products with cache-first strategy
   * Returns cached data immediately if available, triggers background refresh if stale
   * Uses smaller page size (20) to prevent cache size issues
   */
  async fetchProducts(options: ProductsFetchOptions): Promise<ProductsFetchResult> {
    const { userId, filter = 'all', limit = 20, useCache = true } = options;
    const fetchStartTime = Date.now();

    console.log('[ProductsDataService] [FETCH:START] Starting products fetch', {
      userId,
      filter,
      limit,
      useCache,
    });

    try {
      if (!useCache) {
        console.log('[ProductsDataService] [FETCH:FORCE] Forcing fresh fetch without cache');
        // Force fresh fetch without cache
        return await this.fetchWithRetry(options);
      }

      // Use cache-first strategy via ProductCacheService
      const queryOptions: ProductQueryOptions = {
        limit,
        // Add filter-specific logic here if needed
      };

      const result = await ProductCacheService.getProducts(queryOptions);
      const fetchTime = Date.now() - fetchStartTime;

      console.log('[ProductsDataService] [FETCH:SUCCESS] Products fetch completed', {
        source: result.fromCache ? 'cache' : 'network',
        productCount: result.products.length,
        fetchTime: `${fetchTime}ms`,
        filter,
      });

      return {
        products: result.products,
        fromCache: result.fromCache,
      };
    } catch (error) {
      const fetchTime = Date.now() - fetchStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[ProductsDataService] [FETCH:ERROR] Error fetching products', {
        error: errorMessage,
        userId,
        filter,
        fetchTime: `${fetchTime}ms`,
      });
      
      // Try to get cached products as fallback
      if (useCache) {
        console.log('[ProductsDataService] [FETCH:FALLBACK] Attempting to use cached products as fallback');
        const cachedResult = await this.getCachedProducts(userId);
        if (cachedResult) {
          console.log('[ProductsDataService] [FETCH:FALLBACK_SUCCESS] Using cached products', {
            productCount: cachedResult.products.length,
          });
          return cachedResult;
        }
        console.log('[ProductsDataService] [FETCH:FALLBACK_FAILED] No cached products available');
      }

      return {
        products: [],
        fromCache: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get cached products without triggering a fetch
   */
  async getCachedProducts(userId: string): Promise<ProductsFetchResult | null> {
    try {
      const cacheKey = ProductCacheService.getCacheKey({ limit: 50 });
      const cached = await ProductCacheService.getCachedProducts(cacheKey);

      if (cached) {
        return {
          products: cached.products,
          fromCache: true,
        };
      }

      return null;
    } catch (error) {
      console.error('[ProductsDataService] Error getting cached products:', error);
      return null;
    }
  }

  /**
   * Fetch products with exponential backoff retry
   * Implements Requirements 1.5: Retry with exponential backoff up to 3 attempts
   */
  private async fetchWithRetry(
    options: ProductsFetchOptions,
    attempt: number = 1
  ): Promise<ProductsFetchResult> {
    const retryStartTime = Date.now();
    
    try {
      console.log('[ProductsDataService] [RETRY:ATTEMPT] Fetch attempt', {
        attempt,
        maxRetries: this.maxRetries,
        userId: options.userId,
      });

      const queryOptions: ProductQueryOptions = {
        limit: options.limit || 20,
      };

      const result = await ProductCacheService.getProducts(queryOptions);
      const retryTime = Date.now() - retryStartTime;

      console.log('[ProductsDataService] [RETRY:SUCCESS] Fetch succeeded', {
        attempt,
        productCount: result.products.length,
        retryTime: `${retryTime}ms`,
      });

      return {
        products: result.products,
        fromCache: false,
      };
    } catch (error) {
      const retryTime = Date.now() - retryStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt >= this.maxRetries) {
        console.error('[ProductsDataService] [RETRY:FAILED] Max retries reached', {
          attempt,
          maxRetries: this.maxRetries,
          error: errorMessage,
          totalRetryTime: `${retryTime}ms`,
        });
        throw error;
      }

      // Calculate delay with exponential backoff: 1s, 2s, 4s
      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      
      console.log(`[ProductsDataService] [RETRY:BACKOFF] Retrying after delay`, {
        attempt,
        nextAttempt: attempt + 1,
        delay: `${delay}ms`,
        error: errorMessage,
        retryTime: `${retryTime}ms`,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.fetchWithRetry(options, attempt + 1);
    }
  }

  /**
   * Clear product caches
   */
  async clearCache(): Promise<void> {
    await ProductCacheService.clearAllCaches();
  }

  /**
   * Invalidate cache for specific pattern
   */
  async invalidateCache(pattern: string): Promise<void> {
    await ProductCacheService.invalidateCache(pattern);
  }
}

// Export singleton instance
export const ProductsDataService = new ProductsDataServiceClass();

// Export class for testing
export { ProductsDataServiceClass };
