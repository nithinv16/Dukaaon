/**
 * Property-Based Tests for MemoryCacheService
 * 
 * **Feature: fast-product-loading**
 * 
 * Tests the in-memory cache service with LRU eviction, TTL expiration,
 * and app state handling.
 */

import * as fc from 'fast-check';
import { MemoryCacheService, MemoryCacheConfig } from '../../services/cache/MemoryCacheService';

// Mock React Native AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

// Suppress console.log during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Arbitrary generators
const cacheKeyArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const cacheDataArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  value: fc.integer({ min: 0, max: 10000 }),
});

type CacheData = { id: string; name: string; value: number };

describe('MemoryCacheService Property Tests', () => {
  /**
   * **Feature: fast-product-loading, Property 3: Memory Cache LRU Eviction**
   * **Validates: Requirements 2.4**
   * 
   * Property: For any memory cache with 100 entries, adding a new entry should
   * evict the least-recently-accessed entry, maintaining the cache size at or below 100 entries.
   */
  describe('Property 3: Memory Cache LRU Eviction', () => {
    it('should evict LRU entry when cache exceeds maxEntries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }), // maxEntries (smaller for faster tests)
          fc.array(cacheDataArb, { minLength: 1, maxLength: 30 }), // entries to add
          async (maxEntries, entries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries,
              ttlMs: 60000, // 1 minute TTL
              enableLogging: false,
            });

            // Add entries with unique keys
            const keys: string[] = [];
            for (let i = 0; i < entries.length; i++) {
              const key = `key_${i}`;
              keys.push(key);
              cache.set(key, entries[i]);
              
              // Small delay to ensure different access times
              await new Promise(resolve => setTimeout(resolve, 1));
            }

            // Property: Cache size should never exceed maxEntries
            expect(cache.size()).toBeLessThanOrEqual(maxEntries);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout

    it('should evict least recently accessed entry, not oldest entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // maxEntries
          async (maxEntries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Fill cache to capacity
            for (let i = 0; i < maxEntries; i++) {
              cache.set(`key_${i}`, { id: `${i}`, name: `Item ${i}`, value: i });
              await new Promise(resolve => setTimeout(resolve, 2));
            }

            // Access the first entry to make it recently used
            const firstKey = 'key_0';
            cache.get(firstKey);
            await new Promise(resolve => setTimeout(resolve, 2));

            // Add a new entry, which should evict key_1 (least recently accessed)
            cache.set('new_key', { id: 'new', name: 'New Item', value: 999 });

            // Property: First key should still exist (was recently accessed)
            expect(cache.has(firstKey)).toBe(true);

            // Property: New key should exist
            expect(cache.has('new_key')).toBe(true);

            // Property: Cache size should be at maxEntries
            expect(cache.size()).toBe(maxEntries);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout

    it('should maintain exactly maxEntries when continuously adding', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }), // maxEntries
          fc.integer({ min: 20, max: 50 }), // total entries to add
          async (maxEntries, totalEntries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Add more entries than maxEntries
            for (let i = 0; i < totalEntries; i++) {
              cache.set(`key_${i}`, { id: `${i}`, name: `Item ${i}`, value: i });
            }

            // Property: Cache size should be exactly maxEntries
            expect(cache.size()).toBe(maxEntries);

            // Property: Most recent entries should be present
            for (let i = totalEntries - maxEntries; i < totalEntries; i++) {
              expect(cache.has(`key_${i}`)).toBe(true);
            }

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not evict when updating existing key', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // maxEntries
          async (maxEntries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Fill cache to capacity
            for (let i = 0; i < maxEntries; i++) {
              cache.set(`key_${i}`, { id: `${i}`, name: `Item ${i}`, value: i });
            }

            const sizeBeforeUpdate = cache.size();

            // Update an existing key
            cache.set('key_0', { id: '0', name: 'Updated Item', value: 9999 });

            // Property: Size should remain the same
            expect(cache.size()).toBe(sizeBeforeUpdate);

            // Property: Updated value should be retrievable
            const updated = cache.get('key_0');
            expect(updated?.value).toBe(9999);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * TTL Expiration Tests
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('TTL Expiration', () => {
    it('should return null for expired entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          cacheKeyArb,
          cacheDataArb,
          async (key, data) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 50, // Very short TTL for testing
              enableLogging: false,
            });

            cache.set(key, data);
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 60));

            // Property: Expired entry should return null
            const result = cache.get(key);
            expect(result).toBeNull();

            // Property: has() should return false for expired entry
            expect(cache.has(key)).toBe(false);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 50 } // Fewer runs due to timing
      );
    });

    it('should return data for non-expired entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          cacheKeyArb,
          cacheDataArb,
          async (key, data) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000, // Long TTL
              enableLogging: false,
            });

            cache.set(key, data);

            // Property: Non-expired entry should return data
            const result = cache.get(key);
            expect(result).toEqual(data);

            // Property: has() should return true
            expect(cache.has(key)).toBe(true);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Basic Operations Tests
   */
  describe('Basic Operations', () => {
    it('should store and retrieve data correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(cacheKeyArb, cacheDataArb), { minLength: 1, maxLength: 50 }),
          async (entries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Use unique keys
            const uniqueEntries = new Map<string, CacheData>();
            entries.forEach(([key, data], i) => {
              const uniqueKey = `${key}_${i}`;
              uniqueEntries.set(uniqueKey, data);
              cache.set(uniqueKey, data);
            });

            // Property: All stored entries should be retrievable
            for (const [key, expectedData] of uniqueEntries) {
              const result = cache.get(key);
              expect(result).toEqual(expectedData);
            }

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clear all entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(cacheDataArb, { minLength: 1, maxLength: 20 }),
          async (entries) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Add entries
            entries.forEach((data, i) => {
              cache.set(`key_${i}`, data);
            });

            expect(cache.size()).toBeGreaterThan(0);

            // Clear cache
            cache.clear();

            // Property: Cache should be empty after clear
            expect(cache.size()).toBe(0);

            // Property: All keys should return null
            entries.forEach((_, i) => {
              expect(cache.get(`key_${i}`)).toBeNull();
            });

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete specific entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(cacheDataArb, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          async (entries, deleteIndex) => {
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000,
              enableLogging: false,
            });

            // Add entries
            entries.forEach((data, i) => {
              cache.set(`key_${i}`, data);
            });

            const actualDeleteIndex = deleteIndex % entries.length;
            const keyToDelete = `key_${actualDeleteIndex}`;
            const sizeBeforeDelete = cache.size();

            // Delete one entry
            const deleted = cache.delete(keyToDelete);

            // Property: Delete should return true for existing key
            expect(deleted).toBe(true);

            // Property: Size should decrease by 1
            expect(cache.size()).toBe(sizeBeforeDelete - 1);

            // Property: Deleted key should return null
            expect(cache.get(keyToDelete)).toBeNull();

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * App State Handling Tests
   * **Validates: Requirements 2.5**
   */
  describe('App State Handling', () => {
    it('should clear cache when backgrounded for too long', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(cacheDataArb, { minLength: 1, maxLength: 10 }),
          async (entries) => {
            const backgroundClearMs = 100; // Short threshold for testing
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000,
              backgroundClearMs,
              enableLogging: false,
            });

            // Add entries
            entries.forEach((data, i) => {
              cache.set(`key_${i}`, data);
            });

            expect(cache.size()).toBeGreaterThan(0);

            // Simulate going to background
            cache.onAppStateChange('background');

            // Wait longer than backgroundClearMs
            await new Promise(resolve => setTimeout(resolve, backgroundClearMs + 50));

            // Simulate coming back to foreground
            cache.onAppStateChange('active');

            // Property: Cache should be cleared after long background
            expect(cache.size()).toBe(0);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 50 } // Fewer runs due to timing
      );
    }, 20000); // 20 second timeout

    it('should preserve cache when backgrounded briefly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(cacheDataArb, { minLength: 1, maxLength: 10 }),
          async (entries) => {
            const backgroundClearMs = 1000; // Longer threshold
            const cache = new MemoryCacheService<CacheData>({
              maxEntries: 100,
              ttlMs: 60000,
              backgroundClearMs,
              enableLogging: false,
            });

            // Add entries
            entries.forEach((data, i) => {
              cache.set(`key_${i}`, data);
            });

            const sizeBeforeBackground = cache.size();

            // Simulate brief background
            cache.onAppStateChange('background');
            await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause
            cache.onAppStateChange('active');

            // Property: Cache should be preserved after brief background
            expect(cache.size()).toBe(sizeBeforeBackground);

            // Cleanup
            cache.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
