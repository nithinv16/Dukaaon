/**
 * MemoryCacheService - In-memory Map-based cache for instant data access
 * 
 * Implements Requirements 2.1, 2.2, 2.3, 2.4, 2.5:
 * - Store products in an in-memory Map cache with 5-minute TTL
 * - Check memory cache first before AsyncStorage
 * - Return data synchronously without async overhead
 * - Evict least-recently-used entries when exceeding 100 entries
 * - Clear memory cache when app is backgrounded for more than 10 minutes
 */

import { AppState, AppStateStatus } from 'react-native';

/**
 * Memory cache entry with data, timestamp, and access tracking
 */
export interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
  accessTime: number;
}

/**
 * Configuration options for MemoryCacheService
 */
export interface MemoryCacheConfig {
  maxEntries: number;        // Maximum number of entries (default: 100)
  ttlMs: number;             // Time to live in milliseconds (default: 5 minutes)
  backgroundClearMs: number; // Time before clearing on background (default: 10 minutes)
  enableLogging?: boolean;   // Enable console logging (default: true)
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: MemoryCacheConfig = {
  maxEntries: 100,
  ttlMs: 5 * 60 * 1000,           // 5 minutes
  backgroundClearMs: 10 * 60 * 1000, // 10 minutes
  enableLogging: true,
};

/**
 * Generic in-memory cache service with LRU eviction and TTL support
 */
export class MemoryCacheService<T> {
  private cache: Map<string, MemoryCacheEntry<T>>;
  private config: MemoryCacheConfig;
  private lastActiveTime: number;
  private appStateSubscription: { remove: () => void } | null = null;


  /**
   * Create a new MemoryCacheService instance
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<MemoryCacheConfig> = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastActiveTime = Date.now();
    this.initAppStateListener();
  }

  /**
   * Initialize app state listener for background handling
   * Clears cache when app is backgrounded for more than configured time
   */
  private initAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      this.onAppStateChange(nextAppState === 'active' ? 'active' : 'background');
    });
  }

  /**
   * Handle app state changes
   * Clears memory cache if app was backgrounded for too long
   * @param state - Current app state ('active' or 'background')
   */
  onAppStateChange(state: 'active' | 'background'): void {
    const now = Date.now();
    
    if (state === 'background') {
      this.lastActiveTime = now;
      this.log('[STATE:BACKGROUND] App backgrounded, recording time');
    } else if (state === 'active') {
      const backgroundDuration = now - this.lastActiveTime;
      
      if (backgroundDuration > this.config.backgroundClearMs) {
        this.log('[STATE:CLEAR] App was backgrounded too long, clearing cache', {
          backgroundDuration: `${backgroundDuration}ms`,
          threshold: `${this.config.backgroundClearMs}ms`,
          entriesCleared: this.cache.size,
        });
        this.clear();
      } else {
        this.log('[STATE:ACTIVE] App resumed within threshold', {
          backgroundDuration: `${backgroundDuration}ms`,
          threshold: `${this.config.backgroundClearMs}ms`,
        });
      }
      
      this.lastActiveTime = now;
    }
  }

  /**
   * Get data from cache synchronously
   * Returns null if key doesn't exist or entry is expired
   * Updates access time for LRU tracking
   * @param key - Cache key
   * @returns Cached data or null
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.log('[CACHE:MISS] Key not found', { key });
      return null;
    }

    // Check TTL expiration
    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttlMs) {
      this.log('[CACHE:EXPIRED] Entry expired, removing', {
        key,
        age: `${age}ms`,
        ttl: `${this.config.ttlMs}ms`,
      });
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU tracking
    entry.accessTime = Date.now();
    
    this.log('[CACHE:HIT] Data retrieved', {
      key,
      age: `${age}ms`,
    });
    
    return entry.data;
  }

  /**
   * Set data in cache with automatic LRU eviction
   * @param key - Cache key
   * @param data - Data to cache
   */
  set(key: string, data: T): void {
    const now = Date.now();
    
    // Evict LRU entries if at capacity (before adding new entry)
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: MemoryCacheEntry<T> = {
      data,
      timestamp: now,
      accessTime: now,
    };

    this.cache.set(key, entry);
    
    this.log('[CACHE:SET] Data cached', {
      key,
      cacheSize: this.cache.size,
      maxEntries: this.config.maxEntries,
    });
  }

  /**
   * Check if key exists and is not expired
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check TTL expiration
    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    
    this.log('[CACHE:CLEAR] Cache cleared', {
      entriesCleared: previousSize,
    });
  }

  /**
   * Delete a specific key from cache
   * @param key - Cache key to delete
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.log('[CACHE:DELETE] Entry deleted', { key });
    }
    
    return deleted;
  }

  /**
   * Get current cache size
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in cache
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Evict least-recently-used entry when cache is at capacity
   * Finds entry with oldest accessTime and removes it
   */
  private evictLRU(): void {
    if (this.cache.size === 0) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;

    // Find the least recently accessed entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessTime < oldestAccessTime) {
        oldestAccessTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.log('[CACHE:EVICT] LRU entry evicted', {
        evictedKey: oldestKey,
        accessTime: new Date(oldestAccessTime).toISOString(),
        cacheSize: this.cache.size,
      });
    }
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: Record<string, any>): void {
    if (this.config.enableLogging) {
      if (data) {
        console.log(`[MemoryCacheService] ${message}`, data);
      } else {
        console.log(`[MemoryCacheService] ${message}`);
      }
    }
  }

  /**
   * Cleanup resources when service is no longer needed
   */
  destroy(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    oldestEntryAge: number | null;
    newestEntryAge: number | null;
  } {
    const now = Date.now();
    let oldestAge: number | null = null;
    let newestAge: number | null = null;

    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }
      if (newestAge === null || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge,
    };
  }
}

// Export a factory function for creating typed instances
export function createMemoryCache<T>(config?: Partial<MemoryCacheConfig>): MemoryCacheService<T> {
  return new MemoryCacheService<T>(config);
}
