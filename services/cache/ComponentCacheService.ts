/**
 * ComponentCacheService - Generic cache service for component data
 * 
 * Implements Requirements 3.1, 3.2, 3.5:
 * - Check for component-level cached data before showing loading states
 * - Display cached content immediately when available
 * - Cache fresh data locally for next app session
 * 
 * This is a generic base class that can be used for any component data type
 * with stale-while-revalidate pattern support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache entry structure with metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiryTime: number;
  metadata?: Record<string, any>;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  key: string;
  ttl: number; // Time to live in milliseconds (when cache becomes stale)
  maxAge: number; // Maximum age in milliseconds (when cache expires completely)
  enableLogging?: boolean;
}

/**
 * Result of cache load operation
 */
export interface CacheLoadResult<T> {
  data: T | null;
  fromCache: boolean;
  isStale: boolean;
  isExpired: boolean;
  age?: number; // Age of cached data in milliseconds
}

/**
 * Generic component cache service with stale-while-revalidate pattern
 */
export class ComponentCacheService<T> {
  private cachePrefix: string;
  private defaultTTL: number;
  private defaultMaxAge: number;
  private enableLogging: boolean;

  /**
   * Create a new cache service instance
   * @param cachePrefix - Prefix for cache keys (e.g., 'products_', 'categories_')
   * @param defaultTTL - Default time to live in milliseconds (default: 5 minutes)
   * @param defaultMaxAge - Default maximum age in milliseconds (default: 30 minutes)
   * @param enableLogging - Enable console logging for debugging (default: true)
   */
  constructor(
    cachePrefix: string,
    defaultTTL: number = 5 * 60 * 1000, // 5 minutes
    defaultMaxAge: number = 30 * 60 * 1000, // 30 minutes
    enableLogging: boolean = true
  ) {
    this.cachePrefix = cachePrefix;
    this.defaultTTL = defaultTTL;
    this.defaultMaxAge = defaultMaxAge;
    this.enableLogging = enableLogging;
  }

  /**
   * Generate full cache key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.cachePrefix}${key}`;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.enableLogging) {
      console.log(`[ComponentCacheService:${this.cachePrefix}] ${message}`, ...args);
    }
  }

  /**
   * Load data from cache with stale-while-revalidate pattern
   * 
   * Returns cached data immediately if available, along with metadata
   * about whether the cache is stale or expired.
   * 
   * @param key - Cache key (without prefix)
   * @returns Cache load result with data and metadata
   */
  async loadFromCache(key: string): Promise<CacheLoadResult<T>> {
    const fullKey = this.getFullKey(key);
    const loadStartTime = Date.now();
    
    try {
      const cached = await AsyncStorage.getItem(fullKey);
      const loadTime = Date.now() - loadStartTime;
      
      if (!cached) {
        this.log(`[CACHE:MISS] No cached data found`, {
          key,
          loadTime: `${loadTime}ms`,
        });
        return {
          data: null,
          fromCache: false,
          isStale: false,
          isExpired: false,
        };
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();
      const age = now - entry.timestamp;
      const isStale = this.isStale(entry);
      const isExpired = this.isExpired(entry);
      const timeUntilExpiry = entry.expiryTime - now;
      const timeUntilStale = (entry.timestamp + this.defaultTTL) - now;

      if (isExpired) {
        this.log(`[CACHE:EXPIRED] Cache expired, clearing`, {
          key,
          age: `${age}ms`,
          ageMinutes: `${(age / 60000).toFixed(2)}min`,
          expiryTime: new Date(entry.expiryTime).toISOString(),
          loadTime: `${loadTime}ms`,
        });
        // Don't return expired data
        await this.clearCache(key);
        return {
          data: null,
          fromCache: false,
          isStale: false,
          isExpired: true,
          age,
        };
      }

      if (isStale) {
        this.log(`[CACHE:STALE] Cache is stale, needs background refresh`, {
          key,
          age: `${age}ms`,
          ageMinutes: `${(age / 60000).toFixed(2)}min`,
          timeUntilExpiry: `${timeUntilExpiry}ms`,
          ttl: `${this.defaultTTL}ms`,
          loadTime: `${loadTime}ms`,
          metadata: entry.metadata || null,
        });
      } else {
        this.log(`[CACHE:HIT] Cache hit with fresh data`, {
          key,
          age: `${age}ms`,
          ageMinutes: `${(age / 60000).toFixed(2)}min`,
          timeUntilStale: `${timeUntilStale}ms`,
          timeUntilExpiry: `${timeUntilExpiry}ms`,
          loadTime: `${loadTime}ms`,
          metadata: entry.metadata || null,
        });
      }

      return {
        data: entry.data,
        fromCache: true,
        isStale,
        isExpired: false,
        age,
      };
    } catch (error) {
      const loadTime = Date.now() - loadStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[ComponentCacheService:${this.cachePrefix}] [CACHE:ERROR] Error loading cache`, {
        key,
        error: errorMessage,
        loadTime: `${loadTime}ms`,
      });
      
      return {
        data: null,
        fromCache: false,
        isStale: false,
        isExpired: false,
      };
    }
  }

  /**
   * Save data to cache with expiry metadata
   * 
   * @param key - Cache key (without prefix)
   * @param data - Data to cache
   * @param ttl - Optional custom TTL (defaults to service default)
   * @param maxAge - Optional custom max age (defaults to service default)
   * @param metadata - Optional additional metadata to store
   */
  async saveToCache(
    key: string,
    data: T,
    ttl?: number,
    maxAge?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const now = Date.now();
    const effectiveTTL = ttl ?? this.defaultTTL;
    const effectiveMaxAge = maxAge ?? this.defaultMaxAge;
    const saveStartTime = Date.now();

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiryTime: now + effectiveMaxAge,
        metadata,
      };

      const serialized = JSON.stringify(entry);
      const sizeKB = (serialized.length / 1024).toFixed(2);
      
      await AsyncStorage.setItem(fullKey, serialized);
      
      const saveTime = Date.now() - saveStartTime;
      
      this.log(`[CACHE:SAVE] Cache saved successfully`, {
        key,
        ttl: `${effectiveTTL}ms`,
        ttlMinutes: `${(effectiveTTL / 60000).toFixed(2)}min`,
        maxAge: `${effectiveMaxAge}ms`,
        maxAgeMinutes: `${(effectiveMaxAge / 60000).toFixed(2)}min`,
        expiryTime: new Date(now + effectiveMaxAge).toISOString(),
        sizeKB: `${sizeKB}KB`,
        saveTime: `${saveTime}ms`,
        metadata: metadata || null,
      });
    } catch (error) {
      const saveTime = Date.now() - saveStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[ComponentCacheService:${this.cachePrefix}] [CACHE:SAVE_ERROR] Error saving cache`, {
        key,
        error: errorMessage,
        saveTime: `${saveTime}ms`,
      });
    }
  }

  /**
   * Check if cache entry is stale (needs background refresh)
   * 
   * Stale means the data is still usable but should be refreshed
   * in the background to keep it fresh.
   * 
   * @param entry - Cache entry to check
   * @returns True if cache is stale
   */
  isStale(entry: CacheEntry<T>): boolean {
    const age = Date.now() - entry.timestamp;
    return age > this.defaultTTL;
  }

  /**
   * Check if cache entry is expired (must not be used)
   * 
   * Expired means the data is too old and should not be shown
   * to the user. Fresh data must be fetched.
   * 
   * @param entry - Cache entry to check
   * @returns True if cache is expired
   */
  isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() >= entry.expiryTime;
  }

  /**
   * Clear cache for specific key
   * 
   * @param key - Cache key (without prefix)
   */
  async clearCache(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    
    try {
      await AsyncStorage.removeItem(fullKey);
      this.log(`[CACHE:CLEAR] Cache cleared`, {
        key,
        fullKey,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ComponentCacheService:${this.cachePrefix}] [CACHE:CLEAR_ERROR] Error clearing cache`, {
        key,
        error: errorMessage,
      });
    }
  }

  /**
   * Clear all caches with this service's prefix
   */
  async clearAllCaches(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const prefixedKeys = allKeys.filter(key => key.startsWith(this.cachePrefix));
      
      if (prefixedKeys.length > 0) {
        await AsyncStorage.multiRemove(prefixedKeys);
        this.log(`Cleared ${prefixedKeys.length} cache entries`);
      } else {
        this.log('No cache entries to clear');
      }
    } catch (error) {
      console.error(`[ComponentCacheService:${this.cachePrefix}] Error clearing all caches:`, error);
    }
  }

  /**
   * Get cache statistics for debugging
   * 
   * @returns Object with cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    staleEntries: number;
    expiredEntries: number;
    freshEntries: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const prefixedKeys = allKeys.filter(key => key.startsWith(this.cachePrefix));
      
      let staleCount = 0;
      let expiredCount = 0;
      let freshCount = 0;

      for (const key of prefixedKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const entry: CacheEntry<T> = JSON.parse(cached);
            if (this.isExpired(entry)) {
              expiredCount++;
            } else if (this.isStale(entry)) {
              staleCount++;
            } else {
              freshCount++;
            }
          }
        } catch (error) {
          // Skip invalid entries
        }
      }

      return {
        totalEntries: prefixedKeys.length,
        staleEntries: staleCount,
        expiredEntries: expiredCount,
        freshEntries: freshCount,
      };
    } catch (error) {
      console.error(`[ComponentCacheService:${this.cachePrefix}] Error getting cache stats:`, error);
      return {
        totalEntries: 0,
        staleEntries: 0,
        expiredEntries: 0,
        freshEntries: 0,
      };
    }
  }

  /**
   * Invalidate caches matching a pattern
   * 
   * @param pattern - Pattern to match in cache keys (after prefix)
   */
  async invalidateCache(pattern: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => 
        key.startsWith(this.cachePrefix) && key.includes(pattern)
      );
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        this.log(`Invalidated ${keysToRemove.length} cache entries matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error(`[ComponentCacheService:${this.cachePrefix}] Error invalidating cache:`, error);
    }
  }
}
