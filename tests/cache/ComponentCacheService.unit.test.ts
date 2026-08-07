/**
 * Unit tests for ComponentCacheService
 * 
 * Tests basic cache operations: save, load, stale detection, expiry detection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComponentCacheService } from '../../services/cache/ComponentCacheService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('ComponentCacheService', () => {
  let cacheService: ComponentCacheService<any>;
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create cache service with short TTL for testing
    cacheService = new ComponentCacheService(
      'test_',
      1000, // 1 second TTL
      5000, // 5 seconds max age
      false // Disable logging for tests
    );
  });

  describe('saveToCache', () => {
    it('should save data to AsyncStorage with correct structure', async () => {
      const testData = { id: 1, name: 'Test' };
      const testKey = 'test_key';

      await cacheService.saveToCache(testKey, testData);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
      const [key, value] = mockAsyncStorage.setItem.mock.calls[0];
      
      expect(key).toBe('test_test_key');
      const parsed = JSON.parse(value);
      expect(parsed.data).toEqual(testData);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.expiryTime).toBeDefined();
    });

    it('should use custom TTL and maxAge when provided', async () => {
      const testData = { id: 1 };
      const customTTL = 2000;
      const customMaxAge = 10000;

      await cacheService.saveToCache('key', testData, customTTL, customMaxAge);

      const [, value] = mockAsyncStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(value);
      
      // Verify expiry time is set correctly
      expect(parsed.expiryTime - parsed.timestamp).toBe(customMaxAge);
    });

    it('should handle save errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw
      await expect(cacheService.saveToCache('key', { data: 'test' })).resolves.not.toThrow();
    });
  });

  describe('loadFromCache', () => {
    it('should return cache miss when no data exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await cacheService.loadFromCache('missing_key');

      expect(result.data).toBeNull();
      expect(result.fromCache).toBe(false);
      expect(result.isStale).toBe(false);
      expect(result.isExpired).toBe(false);
    });

    it('should return fresh cached data', async () => {
      const testData = { id: 1, name: 'Test' };
      const now = Date.now();
      const cacheEntry = {
        data: testData,
        timestamp: now,
        expiryTime: now + 5000,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await cacheService.loadFromCache('test_key');

      expect(result.data).toEqual(testData);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.age).toBeDefined();
    });

    it('should detect stale cache', async () => {
      const testData = { id: 1 };
      const now = Date.now();
      const cacheEntry = {
        data: testData,
        timestamp: now - 2000, // 2 seconds old (stale but not expired)
        expiryTime: now + 3000,
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await cacheService.loadFromCache('test_key');

      expect(result.data).toEqual(testData);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('should not return expired cache', async () => {
      const testData = { id: 1 };
      const now = Date.now();
      const cacheEntry = {
        data: testData,
        timestamp: now - 6000, // 6 seconds old (expired)
        expiryTime: now - 1000, // Expired 1 second ago
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await cacheService.loadFromCache('test_key');

      expect(result.data).toBeNull();
      expect(result.fromCache).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test_test_key');
    });

    it('should handle load errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await cacheService.loadFromCache('key');

      expect(result.data).toBeNull();
      expect(result.fromCache).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should remove specific cache entry', async () => {
      await cacheService.clearCache('test_key');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test_test_key');
    });

    it('should handle clear errors gracefully', async () => {
      mockAsyncStorage.removeItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(cacheService.clearCache('key')).resolves.not.toThrow();
    });
  });

  describe('clearAllCaches', () => {
    it('should remove all caches with prefix', async () => {
      const allKeys = ['test_key1', 'test_key2', 'other_key', 'test_key3'];
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(allKeys);

      await cacheService.clearAllCaches();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'test_key1',
        'test_key2',
        'test_key3',
      ]);
    });

    it('should handle no matching keys', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(['other_key1', 'other_key2']);

      await cacheService.clearAllCaches();

      expect(mockAsyncStorage.multiRemove).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCache', () => {
    it('should remove caches matching pattern', async () => {
      const allKeys = ['test_user_123', 'test_user_456', 'test_product_789', 'other_key'];
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(allKeys);

      await cacheService.invalidateCache('user');

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'test_user_123',
        'test_user_456',
      ]);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const now = Date.now();
      const allKeys = ['test_fresh', 'test_stale', 'test_expired'];
      
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(allKeys);
      
      // Fresh cache
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
        data: {},
        timestamp: now,
        expiryTime: now + 5000,
      }));
      
      // Stale cache
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
        data: {},
        timestamp: now - 2000,
        expiryTime: now + 3000,
      }));
      
      // Expired cache
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
        data: {},
        timestamp: now - 6000,
        expiryTime: now - 1000,
      }));

      const stats = await cacheService.getCacheStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.freshEntries).toBe(1);
      expect(stats.staleEntries).toBe(1);
      expect(stats.expiredEntries).toBe(1);
    });
  });
});
