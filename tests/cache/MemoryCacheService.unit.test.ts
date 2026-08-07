/**
 * Unit Tests for MemoryCacheService
 * 
 * **Feature: fast-product-loading**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 * 
 * Tests edge cases and specific scenarios for the in-memory cache service.
 */

import { MemoryCacheService } from '../../services/cache/MemoryCacheService';

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

interface TestData {
  id: string;
  name: string;
  value: number;
}

describe('MemoryCacheService Unit Tests', () => {
  describe('Empty Cache', () => {
    it('should return null for non-existent key', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      expect(cache.get('non-existent')).toBeNull();
      expect(cache.has('non-existent')).toBe(false);
      
      cache.destroy();
    });

    it('should have size 0 when empty', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      expect(cache.size()).toBe(0);
      expect(cache.keys()).toEqual([]);
      
      cache.destroy();
    });

    it('should handle clear on empty cache', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      // Should not throw
      expect(() => cache.clear()).not.toThrow();
      expect(cache.size()).toBe(0);
      
      cache.destroy();
    });

    it('should handle delete on non-existent key', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      const result = cache.delete('non-existent');
      expect(result).toBe(false);
      
      cache.destroy();
    });
  });

  describe('Single Entry', () => {
    it('should store and retrieve single entry', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      const data: TestData = { id: '1', name: 'Test', value: 100 };
      
      cache.set('key1', data);
      
      expect(cache.get('key1')).toEqual(data);
      expect(cache.has('key1')).toBe(true);
      expect(cache.size()).toBe(1);
      
      cache.destroy();
    });

    it('should update existing entry', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      const data1: TestData = { id: '1', name: 'Original', value: 100 };
      const data2: TestData = { id: '1', name: 'Updated', value: 200 };
      
      cache.set('key1', data1);
      cache.set('key1', data2);
      
      expect(cache.get('key1')).toEqual(data2);
      expect(cache.size()).toBe(1);
      
      cache.destroy();
    });

    it('should delete single entry', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      const data: TestData = { id: '1', name: 'Test', value: 100 };
      
      cache.set('key1', data);
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.size()).toBe(0);
      
      cache.destroy();
    });
  });

  describe('TTL Edge Cases', () => {
    it('should expire entry exactly at TTL boundary', async () => {
      const ttlMs = 100;
      const cache = new MemoryCacheService<TestData>({
        ttlMs,
        enableLogging: false,
      });
      
      cache.set('key1', { id: '1', name: 'Test', value: 100 });
      
      // Just before expiry
      await new Promise(resolve => setTimeout(resolve, ttlMs - 20));
      expect(cache.get('key1')).not.toBeNull();
      
      // After expiry
      await new Promise(resolve => setTimeout(resolve, 40));
      expect(cache.get('key1')).toBeNull();
      
      cache.destroy();
    });

    it('should handle very short TTL', async () => {
      const cache = new MemoryCacheService<TestData>({
        ttlMs: 10, // Very short TTL
        enableLogging: false,
      });
      
      cache.set('key1', { id: '1', name: 'Test', value: 100 });
      
      // Entry should exist immediately after set
      expect(cache.get('key1')).not.toBeNull();
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Entry should now be expired
      expect(cache.get('key1')).toBeNull();
      
      cache.destroy();
    });
  });

  describe('LRU Edge Cases', () => {
    it('should handle maxEntries of 1', () => {
      const cache = new MemoryCacheService<TestData>({
        maxEntries: 1,
        enableLogging: false,
      });
      
      cache.set('key1', { id: '1', name: 'First', value: 1 });
      cache.set('key2', { id: '2', name: 'Second', value: 2 });
      
      expect(cache.size()).toBe(1);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      
      cache.destroy();
    });

    it('should evict correct entry when all have same access time', () => {
      const cache = new MemoryCacheService<TestData>({
        maxEntries: 3,
        enableLogging: false,
      });
      
      // Add entries rapidly (same access time)
      cache.set('key1', { id: '1', name: 'First', value: 1 });
      cache.set('key2', { id: '2', name: 'Second', value: 2 });
      cache.set('key3', { id: '3', name: 'Third', value: 3 });
      
      // Add one more - should evict one of the existing
      cache.set('key4', { id: '4', name: 'Fourth', value: 4 });
      
      expect(cache.size()).toBe(3);
      expect(cache.has('key4')).toBe(true);
      
      cache.destroy();
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty cache', () => {
      const cache = new MemoryCacheService<TestData>({
        maxEntries: 100,
        ttlMs: 5000,
        enableLogging: false,
      });
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(0);
      expect(stats.maxEntries).toBe(100);
      expect(stats.ttlMs).toBe(5000);
      expect(stats.oldestEntryAge).toBeNull();
      expect(stats.newestEntryAge).toBeNull();
      
      cache.destroy();
    });

    it('should return correct stats for populated cache', async () => {
      const cache = new MemoryCacheService<TestData>({
        maxEntries: 100,
        ttlMs: 60000,
        enableLogging: false,
      });
      
      cache.set('key1', { id: '1', name: 'First', value: 1 });
      await new Promise(resolve => setTimeout(resolve, 50));
      cache.set('key2', { id: '2', name: 'Second', value: 2 });
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.oldestEntryAge).toBeGreaterThan(stats.newestEntryAge!);
      
      cache.destroy();
    });
  });

  describe('keys()', () => {
    it('should return all keys', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      cache.set('key1', { id: '1', name: 'First', value: 1 });
      cache.set('key2', { id: '2', name: 'Second', value: 2 });
      cache.set('key3', { id: '3', name: 'Third', value: 3 });
      
      const keys = cache.keys();
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      
      cache.destroy();
    });
  });

  describe('Default Configuration', () => {
    it('should use default values when no config provided', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      const stats = cache.getStats();
      
      expect(stats.maxEntries).toBe(100);
      expect(stats.ttlMs).toBe(5 * 60 * 1000); // 5 minutes
      
      cache.destroy();
    });

    it('should allow partial config override', () => {
      const cache = new MemoryCacheService<TestData>({
        maxEntries: 50,
        enableLogging: false,
      });
      
      const stats = cache.getStats();
      
      expect(stats.maxEntries).toBe(50);
      expect(stats.ttlMs).toBe(5 * 60 * 1000); // Default TTL
      
      cache.destroy();
    });
  });

  describe('destroy()', () => {
    it('should clear cache and cleanup resources', () => {
      const cache = new MemoryCacheService<TestData>({ enableLogging: false });
      
      cache.set('key1', { id: '1', name: 'Test', value: 100 });
      expect(cache.size()).toBe(1);
      
      cache.destroy();
      
      expect(cache.size()).toBe(0);
    });
  });
});
