import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  priority: 'high' | 'medium' | 'low';
  size: number; // in bytes
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxMemorySize: number; // in bytes
  maxStorageSize: number; // in bytes
  defaultTTL: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  compressionEnabled: boolean;
  persistToDisk: boolean;
}

export class TranslationCacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };
  
  private readonly config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY_PREFIX = 'translation_cache_';
  private readonly STATS_KEY = 'translation_cache_stats';

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupInterval: 30 * 60 * 1000, // 30 minutes
      compressionEnabled: true,
      persistToDisk: true,
      ...config
    };

    this.initializeCache();
    this.startCleanupTimer();
  }

  /**
   * Initialize cache by loading from AsyncStorage
   */
  private async initializeCache(): Promise<void> {
    try {
      if (!this.config.persistToDisk) return;

      // Load cache statistics
      const statsData = await AsyncStorage.getItem(this.STATS_KEY);
      if (statsData) {
        const stats = JSON.parse(statsData);
        this.cacheStats = { ...this.cacheStats, ...stats };
      }

      // Load cache entries
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
      
      if (cacheKeys.length === 0) return;

      const cacheData = await AsyncStorage.multiGet(cacheKeys);
      let loadedCount = 0;
      let totalSize = 0;

      for (const [key, value] of cacheData) {
        if (value) {
          try {
            const entry: CacheEntry<any> = JSON.parse(value);
            const cacheKey = key.replace(this.STORAGE_KEY_PREFIX, '');
            
            // Check if entry is still valid
            if (this.isEntryValid(entry)) {
              // Only load to memory if within memory limits
              if (totalSize + entry.size < this.config.maxMemorySize) {
                this.memoryCache.set(cacheKey, entry);
                totalSize += entry.size;
                loadedCount++;
              }
            } else {
              // Remove expired entries from storage
              await AsyncStorage.removeItem(key);
            }
          } catch (error) {
            console.error(`Error loading cache entry ${key}:`, error);
            await AsyncStorage.removeItem(key);
          }
        }
      }

      console.log(`Translation cache initialized: ${loadedCount} entries loaded (${this.formatBytes(totalSize)})`);
    } catch (error) {
      console.error('Error initializing translation cache:', error);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.config.defaultTTL;
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate cache key with language and content hash
   */
  generateCacheKey(
    text: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    context?: string
  ): string {
    const contextSuffix = context ? `_${context}` : '';
    const textHash = this.simpleHash(text);
    return `${sourceLanguage}_${targetLanguage}_${textHash}${contextSuffix}`;
  }

  /**
   * Simple hash function for text
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached translation
   */
  async get<T>(key: string): Promise<T | null> {
    this.cacheStats.totalRequests++;

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isEntryValid(memoryEntry)) {
      memoryEntry.accessCount++;
      memoryEntry.lastAccessed = Date.now();
      this.cacheStats.hits++;
      
      console.log(`Translation cache hit (memory): ${key}`);
      return memoryEntry.data as T;
    }

    // Check disk cache if memory miss
    if (this.config.persistToDisk) {
      try {
        const storageKey = this.STORAGE_KEY_PREFIX + key;
        const storedData = await AsyncStorage.getItem(storageKey);
        
        if (storedData) {
          const entry: CacheEntry<T> = JSON.parse(storedData);
          
          if (this.isEntryValid(entry)) {
            entry.accessCount++;
            entry.lastAccessed = Date.now();
            
            // Promote to memory cache if there's space
            const currentMemorySize = this.getCurrentMemorySize();
            if (currentMemorySize + entry.size < this.config.maxMemorySize) {
              this.memoryCache.set(key, entry);
            }
            
            // Update storage with new access info
            await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
            
            this.cacheStats.hits++;
            console.log(`Translation cache hit (disk): ${key}`);
            return entry.data;
          } else {
            // Remove expired entry
            await AsyncStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.error(`Error reading from disk cache for key ${key}:`, error);
      }
    }

    this.cacheStats.misses++;
    console.log(`Translation cache miss: ${key}`);
    return null;
  }

  /**
   * Set cached translation
   */
  async set<T>(
    key: string, 
    data: T, 
    priority: 'high' | 'medium' | 'low' = 'medium',
    ttl?: number
  ): Promise<void> {
    const now = Date.now();
    const size = this.calculateSize(data);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      priority,
      size
    };

    // Always try to store in memory first
    const currentMemorySize = this.getCurrentMemorySize();
    if (currentMemorySize + size < this.config.maxMemorySize) {
      this.memoryCache.set(key, entry);
    } else {
      // Evict least important entries to make space
      await this.evictFromMemory(size);
      this.memoryCache.set(key, entry);
    }

    // Store to disk if enabled
    if (this.config.persistToDisk) {
      try {
        const storageKey = this.STORAGE_KEY_PREFIX + key;
        await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (error) {
        console.error(`Error storing to disk cache for key ${key}:`, error);
      }
    }

    console.log(`Translation cached: ${key} (${this.formatBytes(size)})`);
  }

  /**
   * Get current memory cache size
   */
  private getCurrentMemorySize(): number {
    let totalSize = 0;
    this.memoryCache.forEach(entry => {
      totalSize += entry.size;
    });
    return totalSize;
  }

  /**
   * Evict entries from memory to make space
   */
  private async evictFromMemory(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by priority and last accessed time (LRU with priority)
    entries.sort((a, b) => {
      const priorityOrder = { low: 0, medium: 1, high: 2 };
      const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, use LRU
      return a[1].lastAccessed - b[1].lastAccessed;
    });

    let freedSpace = 0;
    const keysToEvict: string[] = [];

    for (const [key, entry] of entries) {
      keysToEvict.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSpace) break;
    }

    // Remove from memory
    keysToEvict.forEach(key => {
      this.memoryCache.delete(key);
      this.cacheStats.evictions++;
    });

    console.log(`Evicted ${keysToEvict.length} entries from memory cache (${this.formatBytes(freedSpace)} freed)`);
  }

  /**
   * Batch set multiple translations
   */
  async setBatch<T>(
    entries: Array<{
      key: string;
      data: T;
      priority?: 'high' | 'medium' | 'low';
    }>
  ): Promise<void> {
    const storageOperations: Array<[string, string]> = [];
    
    for (const { key, data, priority = 'medium' } of entries) {
      const now = Date.now();
      const size = this.calculateSize(data);
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        accessCount: 1,
        lastAccessed: now,
        priority,
        size
      };

      // Add to memory if space available
      const currentMemorySize = this.getCurrentMemorySize();
      if (currentMemorySize + size < this.config.maxMemorySize) {
        this.memoryCache.set(key, entry);
      }

      // Prepare for batch storage operation
      if (this.config.persistToDisk) {
        const storageKey = this.STORAGE_KEY_PREFIX + key;
        storageOperations.push([storageKey, JSON.stringify(entry)]);
      }
    }

    // Batch write to storage
    if (storageOperations.length > 0) {
      try {
        await AsyncStorage.multiSet(storageOperations);
        console.log(`Batch cached ${entries.length} translations`);
      } catch (error) {
        console.error('Error in batch cache operation:', error);
      }
    }
  }

  /**
   * Perform periodic cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Clean memory cache
      const memoryKeysToDelete: string[] = [];
      this.memoryCache.forEach((entry, key) => {
        if (!this.isEntryValid(entry)) {
          memoryKeysToDelete.push(key);
        }
      });

      memoryKeysToDelete.forEach(key => {
        this.memoryCache.delete(key);
        cleanedCount++;
      });

      // Clean disk cache
      if (this.config.persistToDisk) {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
        const keysToRemove: string[] = [];

        for (const key of cacheKeys) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const entry: CacheEntry<any> = JSON.parse(data);
              if (!this.isEntryValid(entry)) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            keysToRemove.push(key); // Remove corrupted entries
          }
        }

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
          cleanedCount += keysToRemove.length;
        }
      }

      if (cleanedCount > 0) {
        console.log(`Translation cache cleanup: ${cleanedCount} expired entries removed`);
      }

      // Save updated statistics
      await this.saveStats();

    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Save cache statistics
   */
  private async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(this.cacheStats));
    } catch (error) {
      console.error('Error saving cache stats:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const entries = Array.from(this.memoryCache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const timestamps = entries.map(entry => entry.timestamp);
    
    return {
      totalEntries: this.memoryCache.size,
      totalSize,
      hitRate: this.cacheStats.totalRequests > 0 ? 
        this.cacheStats.hits / this.cacheStats.totalRequests : 0,
      missRate: this.cacheStats.totalRequests > 0 ? 
        this.cacheStats.misses / this.cacheStats.totalRequests : 0,
      evictionCount: this.cacheStats.evictions,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear disk cache
      if (this.config.persistToDisk) {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => 
          key.startsWith(this.STORAGE_KEY_PREFIX) || key === this.STATS_KEY
        );
        
        if (cacheKeys.length > 0) {
          await AsyncStorage.multiRemove(cacheKeys);
        }
      }

      // Reset statistics
      this.cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalRequests: 0
      };

      console.log('Translation cache cleared completely');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Preload translations for common content
   */
  async preloadCommonTranslations(
    commonContent: { [key: string]: string },
    targetLanguages: string[],
    translationFunction: (text: string, targetLang: string) => Promise<string>
  ): Promise<void> {
    console.log('Preloading common translations...');
    
    const preloadPromises: Promise<void>[] = [];

    for (const [contentKey, text] of Object.entries(commonContent)) {
      for (const targetLang of targetLanguages) {
        if (targetLang === 'en') continue; // Skip English
        
        const cacheKey = this.generateCacheKey(text, 'en', targetLang, 'app_content');
        
        preloadPromises.push(
          (async () => {
            try {
              const cached = await this.get(cacheKey);
              if (!cached) {
                const translated = await translationFunction(text, targetLang);
                await this.set(cacheKey, translated, 'high');
              }
            } catch (error) {
              console.error(`Error preloading translation for ${contentKey} -> ${targetLang}:`, error);
            }
          })()
        );
      }
    }

    await Promise.all(preloadPromises);
    console.log('Common translations preloading completed');
  }

  /**
   * Cleanup and destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.memoryCache.clear();
    console.log('Translation cache manager destroyed');
  }
}

// Export singleton instance
let cacheManagerInstance: TranslationCacheManager | null = null;

export const getTranslationCacheManager = (config?: Partial<CacheConfig>): TranslationCacheManager => {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new TranslationCacheManager(config);
  }
  return cacheManagerInstance;
};

export default getTranslationCacheManager;