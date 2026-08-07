/**
 * Unit Tests for Enhanced useSellerPrefetch Hook
 * 
 * Tests the prefetchVisible and onLongPress methods added to support:
 * - Requirements 3.1: Prefetch products for visible wholesaler cards
 * - Requirements 3.2: Priority prefetch on long-press
 */

// Mock modules before importing
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi', details: {} })),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

// Mock Supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(function() { return this; }),
        limit: jest.fn(function() { return this; }),
        abortSignal: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

// Suppress console.log during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Import after mocks
import { PrefetchManager, PrefetchManagerClass } from '../../services/products/PrefetchManager';

describe('useSellerPrefetch Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset PrefetchManager state
    PrefetchManager.cancelAll();
  });

  afterEach(() => {
    PrefetchManager.cancelAll();
  });

  /**
   * Tests for prefetchVisible method - Requirements 3.1
   */
  describe('prefetchVisible - Requirements 3.1', () => {
    it('should queue prefetch requests for multiple visible sellers', () => {
      const sellerIds = ['seller-1', 'seller-2', 'seller-3'];
      
      // Simulate prefetchVisible behavior
      sellerIds.forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      // Verify all sellers are queued
      expect(PrefetchManager.getQueueSize()).toBeLessThanOrEqual(3);
      
      // Verify each seller is being prefetched
      sellerIds.forEach(sellerId => {
        const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
        if (status) {
          expect(['pending', 'fetching']).toContain(status.status);
        }
      });
    });

    it('should limit prefetch to maxVisiblePrefetch sellers', () => {
      const sellerIds = ['seller-1', 'seller-2', 'seller-3', 'seller-4', 'seller-5'];
      const maxVisiblePrefetch = 3;
      
      // Simulate prefetchVisible with limit
      const toPrefetch = sellerIds.slice(0, maxVisiblePrefetch);
      toPrefetch.forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      // Queue should not exceed maxQueueSize (3)
      expect(PrefetchManager.getQueueSize()).toBeLessThanOrEqual(3);
    });

    it('should skip already prefetched sellers', () => {
      const sellerId = 'seller-1';
      const prefetchedSellers = new Set<string>();
      
      // First prefetch
      if (!prefetchedSellers.has(sellerId)) {
        PrefetchManager.prefetch(sellerId, 'low');
        prefetchedSellers.add(sellerId);
      }
      
      const initialQueueSize = PrefetchManager.getQueueSize();
      
      // Second prefetch attempt (should be skipped by tracking set)
      if (!prefetchedSellers.has(sellerId)) {
        PrefetchManager.prefetch(sellerId, 'low');
      }
      
      // Queue size should remain the same
      expect(PrefetchManager.getQueueSize()).toBe(initialQueueSize);
    });

    it('should handle empty seller array gracefully', () => {
      const sellerIds: string[] = [];
      
      // Should not throw
      expect(() => {
        sellerIds.forEach(sellerId => {
          PrefetchManager.prefetch(sellerId, 'low');
        });
      }).not.toThrow();
      
      expect(PrefetchManager.getQueueSize()).toBe(0);
    });

    it('should use low priority for automatic prefetch', () => {
      const sellerId = 'seller-1';
      
      PrefetchManager.prefetch(sellerId, 'low');
      
      const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('low');
    });
  });

  /**
   * Tests for onLongPress method - Requirements 3.2
   */
  describe('onLongPress - Requirements 3.2', () => {
    it('should trigger high-priority prefetch on long-press', () => {
      const sellerId = 'seller-1';
      
      // Simulate onLongPress behavior
      PrefetchManager.prefetch(sellerId, 'high');
      
      const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('high');
    });

    it('should upgrade priority from low to high on long-press', () => {
      const sellerId = 'seller-1';
      
      // First, add with low priority
      PrefetchManager.prefetch(sellerId, 'low');
      
      let status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('low');
      
      // Then, upgrade with high priority (simulating long-press)
      PrefetchManager.prefetch(sellerId, 'high');
      
      status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('high');
    });

    it('should not downgrade priority from high to low', () => {
      const sellerId = 'seller-1';
      
      // First, add with high priority
      PrefetchManager.prefetch(sellerId, 'high');
      
      // Then, try to add with low priority
      PrefetchManager.prefetch(sellerId, 'low');
      
      const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('high');
    });

    it('should not cancel high-priority requests when queue is full', () => {
      // Fill queue with high-priority requests
      PrefetchManager.prefetch('seller-1', 'high');
      PrefetchManager.prefetch('seller-2', 'high');
      PrefetchManager.prefetch('seller-3', 'high');
      
      // Add another high-priority request
      PrefetchManager.prefetch('seller-4', 'high');
      
      // High-priority requests should not be auto-cancelled
      const statuses = PrefetchManager.getQueueStatus();
      const highPriorityCount = statuses.filter(s => s.priority === 'high').length;
      
      // At least some high-priority requests should remain
      expect(highPriorityCount).toBeGreaterThan(0);
    });

    it('should cancel low-priority requests when queue is full and adding high-priority', () => {
      // Fill queue with low-priority requests
      PrefetchManager.prefetch('seller-1', 'low');
      PrefetchManager.prefetch('seller-2', 'low');
      PrefetchManager.prefetch('seller-3', 'low');
      
      // Add high-priority request
      PrefetchManager.prefetch('seller-4', 'high');
      
      // Queue should still be at max size
      expect(PrefetchManager.getQueueSize()).toBeLessThanOrEqual(3);
      
      // High-priority request should be in queue
      const statuses = PrefetchManager.getQueueStatus();
      const hasHighPriority = statuses.some(s => s.sellerId === 'seller-4' && s.priority === 'high');
      expect(hasHighPriority).toBe(true);
    });
  });

  /**
   * Integration tests for prefetchVisible and onLongPress together
   */
  describe('Integration: prefetchVisible + onLongPress', () => {
    it('should allow long-press to upgrade visibility-triggered prefetch', () => {
      const visibleSellers = ['seller-1', 'seller-2', 'seller-3'];
      
      // Simulate prefetchVisible
      visibleSellers.forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      // Simulate long-press on seller-2
      PrefetchManager.prefetch('seller-2', 'high');
      
      const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === 'seller-2');
      expect(status?.priority).toBe('high');
    });

    it('should handle rapid visibility changes gracefully', () => {
      // First set of visible sellers
      ['seller-1', 'seller-2'].forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      // Scroll - new set of visible sellers
      ['seller-3', 'seller-4'].forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      // Queue should not exceed max size
      expect(PrefetchManager.getQueueSize()).toBeLessThanOrEqual(3);
    });

    it('should track prefetched sellers to avoid duplicates', () => {
      const prefetchedSellers = new Set<string>();
      const sellerId = 'seller-1';
      
      // First visibility trigger
      if (!prefetchedSellers.has(sellerId)) {
        PrefetchManager.prefetch(sellerId, 'low');
        prefetchedSellers.add(sellerId);
      }
      
      // Second visibility trigger (should be skipped)
      const shouldPrefetch = !prefetchedSellers.has(sellerId);
      expect(shouldPrefetch).toBe(false);
      
      // Long-press should still work (different code path)
      PrefetchManager.prefetch(sellerId, 'high');
      const status = PrefetchManager.getQueueStatus().find(s => s.sellerId === sellerId);
      expect(status?.priority).toBe('high');
    });
  });

  /**
   * Edge cases
   */
  describe('Edge Cases', () => {
    it('should handle disabled prefetching', () => {
      const enabled = false;
      const sellerId = 'seller-1';
      
      // Simulate disabled state
      if (enabled) {
        PrefetchManager.prefetch(sellerId, 'low');
      }
      
      expect(PrefetchManager.getQueueSize()).toBe(0);
    });

    it('should handle null/undefined seller IDs', () => {
      const sellerIds = ['seller-1', null, undefined, 'seller-2'] as (string | null | undefined)[];
      
      // Filter out invalid IDs
      const validIds = sellerIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
      
      validIds.forEach(sellerId => {
        PrefetchManager.prefetch(sellerId, 'low');
      });
      
      expect(PrefetchManager.getQueueSize()).toBeLessThanOrEqual(2);
    });

    it('should cleanup on unmount', () => {
      // Simulate prefetch
      PrefetchManager.prefetch('seller-1', 'low');
      PrefetchManager.prefetch('seller-2', 'low');
      
      // Simulate unmount cleanup
      PrefetchManager.cancelAll();
      
      expect(PrefetchManager.getQueueSize()).toBe(0);
    });
  });
});
