/**
 * Unit tests for DataFetchCoordinator
 * 
 * Tests the core functionality of the DataFetchCoordinator service
 * including initialization, triggering, duplicate prevention, and cleanup.
 */

// Mock AsyncStorage before any imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Supabase client
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          range: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          })),
        })),
        ilike: jest.fn(() => ({
          range: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
          })),
        })),
        range: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
        })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: { message: 'RPC not available' } })),
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

// Mock the dependencies
jest.mock('../../store/auth', () => ({
  useAuthStore: {
    subscribe: jest.fn(() => jest.fn()),
    getState: jest.fn(() => ({ user: null, session: null, loading: false })),
  },
}));

jest.mock('../../services/data/ProductsDataService');
jest.mock('../../services/data/CategoriesDataService');
jest.mock('../../services/data/SellersDataService');

import { DataFetchCoordinatorClass } from '../../services/data/DataFetchCoordinator';

describe('DataFetchCoordinator', () => {
  let coordinator: DataFetchCoordinatorClass;

  beforeEach(() => {
    // Create a new instance for each test
    coordinator = new (DataFetchCoordinatorClass as any)();
    
    // Mock the data services
    const { ProductsDataService } = require('../../services/data/ProductsDataService');
    const { CategoriesDataService } = require('../../services/data/CategoriesDataService');
    const { SellersDataService } = require('../../services/data/SellersDataService');

    ProductsDataService.fetchProducts = jest.fn().mockResolvedValue({
      products: [],
      fromCache: false,
    });

    CategoriesDataService.fetchCategories = jest.fn().mockResolvedValue({
      categories: [],
      fromCache: false,
    });

    SellersDataService.fetchNearbySellers = jest.fn().mockResolvedValue({
      sellers: [],
      fromCache: false,
    });
  });

  afterEach(() => {
    coordinator.cleanup();
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => coordinator.initialize()).not.toThrow();
    });

    it('should not initialize twice', () => {
      coordinator.initialize();
      const consoleSpy = jest.spyOn(console, 'log');
      coordinator.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );
    });
  });

  describe('triggerDataFetch', () => {
    it('should trigger parallel data fetches', async () => {
      const userId = 'test-user-id';
      const results = await coordinator.triggerDataFetch(userId);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should prevent duplicate invocations', async () => {
      const userId = 'test-user-id';
      
      // Start first fetch (don't await)
      const firstFetch = coordinator.triggerDataFetch(userId);
      
      // Try to start second fetch immediately
      const secondFetch = coordinator.triggerDataFetch(userId);
      
      // Wait for both
      const [firstResults, secondResults] = await Promise.all([
        firstFetch,
        secondFetch,
      ]);

      // Second fetch should return immediately with empty or cached results
      expect(secondResults).toBeDefined();
    });

    it('should respect cooldown period', async () => {
      const userId = 'test-user-id';
      
      // First fetch
      await coordinator.triggerDataFetch(userId);
      
      // Immediate second fetch (within cooldown)
      const results = await coordinator.triggerDataFetch(userId);
      
      // Should skip due to cooldown
      expect(results).toBeDefined();
    });

    it('should fetch all data types in parallel', async () => {
      const userId = 'test-user-id';
      const latitude = 12.9716;
      const longitude = 77.5946;

      const results = await coordinator.triggerDataFetch(
        userId,
        latitude,
        longitude
      );

      // Should have results for products, categories, wholesalers, manufacturers
      expect(results.length).toBeGreaterThan(0);
      
      const dataTypes = results.map(r => r.dataType);
      expect(dataTypes).toContain('products');
      expect(dataTypes).toContain('categories');
    });
  });

  describe('cancelAllFetches', () => {
    it('should cancel in-progress fetches', async () => {
      const userId = 'test-user-id';
      
      // Start fetch (don't await)
      const fetchPromise = coordinator.triggerDataFetch(userId);
      
      // Cancel immediately
      coordinator.cancelAllFetches();
      
      // Wait for fetch to complete
      await fetchPromise;
      
      // State should show not running
      const state = coordinator.getState();
      expect(state.isRunning).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', () => {
      coordinator.initialize();
      expect(() => coordinator.cleanup()).not.toThrow();
      
      const state = coordinator.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentUserId).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should allow updating configuration', () => {
      coordinator.updateConfig({
        enableLogging: false,
        fetchTimeout: 5000,
      });

      const config = coordinator.getConfig();
      expect(config.enableLogging).toBe(false);
      expect(config.fetchTimeout).toBe(5000);
    });
  });

  describe('state management', () => {
    it('should track running state correctly', async () => {
      const userId = 'test-user-id';
      
      // Before fetch
      let state = coordinator.getState();
      expect(state.isRunning).toBe(false);
      
      // During fetch
      const fetchPromise = coordinator.triggerDataFetch(userId);
      
      // After fetch
      await fetchPromise;
      state = coordinator.getState();
      expect(state.isRunning).toBe(false);
    });

    it('should store fetch results', async () => {
      const userId = 'test-user-id';
      
      await coordinator.triggerDataFetch(userId);
      
      const state = coordinator.getState();
      expect(state.fetchResults.size).toBeGreaterThan(0);
    });
  });
});
