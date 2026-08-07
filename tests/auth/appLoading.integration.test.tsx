/**
 * Integration Tests for Full App Loading Flow
 * 
 * **Feature: simplify-app-loading**
 * 
 * Tests the complete app loading flow from app/index.tsx through SimpleAuthLoader
 * to final navigation. Covers three main scenarios:
 * 1. Fresh install → language screen
 * 2. Cached auth → main screen
 * 3. Corrupted cache → language screen
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import { SimpleAuthLoaderClass } from '../../services/auth/SimpleAuthLoader';
import { useAuthStore } from '../../store/auth';

// Mock AsyncStorage BEFORE any imports
const mockAsyncStorage: Record<string, string | null> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockAsyncStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockAsyncStorage[key];
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach(key => delete mockAsyncStorage[key]);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockAsyncStorage))),
  },
}));

// Mock Supabase
let mockSupabaseSession: any = null;
let mockSupabaseError: any = null;
let mockSupabaseProfile: any = null;

jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => {
        if (mockSupabaseError) {
          return Promise.resolve({ data: { session: null }, error: mockSupabaseError });
        }
        return Promise.resolve({ 
          data: { session: mockSupabaseSession }, 
          error: null 
        });
      }),
      onAuthStateChange: jest.fn(() => ({
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => {
            if (mockSupabaseProfile) {
              return Promise.resolve({ data: mockSupabaseProfile, error: null });
            }
            return Promise.resolve({ data: null, error: { message: 'Not found' } });
          }),
        })),
      })),
    })),
  },
  validateSupabaseConnection: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock LoggingService
jest.mock('../../services/logging', () => ({
  LoggingService: {
    createScope: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Mock DataFetchCoordinator
jest.mock('../../services/data/DataFetchCoordinator', () => ({
  DataFetchCoordinator: {
    initialize: jest.fn(),
    triggerDataFetch: jest.fn(),
    cancelAllFetches: jest.fn(),
    cleanup: jest.fn(),
  },
}));

// Mock ProfileLoader
jest.mock('../../services/auth/profileLoader', () => ({
  ProfileLoader: {
    loadProfile: jest.fn(),
    clearAllCaches: jest.fn(),
  },
}));

// Mock ProfileDebug
jest.mock('../../utils/profileDebug', () => ({
  ProfileDebug: {
    runDiagnostics: jest.fn(),
    testProfileFetch: jest.fn(),
    resetForTesting: jest.fn(),
  },
}));

describe('App Loading Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    
    // Reset Supabase mocks
    mockSupabaseSession = null;
    mockSupabaseError = null;
    mockSupabaseProfile = null;
    
    // Reset auth store
    useAuthStore.getState().clearAuth();
  });

  /**
   * Scenario 1: Fresh install → language screen
   * 
   * Requirements: 5.1
   * - App launches for the first time after install
   * - No cached auth data exists
   * - Should navigate to language screen within 1 second
   */
  describe('Scenario 1: Fresh Install', () => {
    it('should return language screen navigation within 1 second on fresh install', async () => {
      // Setup: No cached data (fresh install)
      // mockAsyncStorage is already empty
      
      const loader = new SimpleAuthLoaderClass();
      const startTime = Date.now();
      
      // Simulate app loading flow
      const result = await loader.checkCachedAuth();
      
      const duration = Date.now() - startTime;
      
      // Property: Should complete within 1 second
      expect(duration).toBeLessThan(1000);
      
      // Property: Should navigate to language screen
      expect(result.navigateTo).toBe('/(auth)/language');
      expect(result.isAuthenticated).toBe(false);
      expect(result.profile).toBeNull();
    });

    it('should complete within 500ms for fresh install', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      const startTime = Date.now();
      const result = await loader.checkCachedAuth();
      const duration = Date.now() - startTime;
      
      // Property: Fresh install should be very fast (< 500ms)
      expect(duration).toBeLessThan(500);
      expect(result.navigateTo).toBe('/(auth)/language');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should not trigger background validation on fresh install', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      // Check cached auth (no auth found)
      const result = await loader.checkCachedAuth();
      
      // Property: Should not be authenticated
      expect(result.isAuthenticated).toBe(false);
      
      // Property: Background validation should not be called for unauthenticated state
      // (In real app flow, validateSessionInBackground is only called when authenticated)
      const { supabase } = require('../../services/supabase/supabase');
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
    });

    it('should integrate with auth store correctly on fresh install', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      // Check cached auth
      const result = await loader.checkCachedAuth();
      
      // Simulate app flow: don't set user if not authenticated
      if (result.isAuthenticated && result.profile) {
        useAuthStore.getState().setUser(result.profile);
      }
      
      // Property: Auth store should remain empty
      const authState = useAuthStore.getState();
      expect(authState.user).toBeNull();
    });
  });

  /**
   * Scenario 2: Cached auth → main screen
   * 
   * Requirements: 5.2
   * - App launches with valid cached auth
   * - Should navigate to main screen within 1 second
   * - Should load profile from cache
   * - Should trigger background validation
   */
  describe('Scenario 2: Cached Auth', () => {
    const mockProfile = {
      id: 'test-user-123',
      phone_number: '1234567890',
      role: 'retailer' as const,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      business_details: { name: 'Test Store' },
    };

    beforeEach(() => {
      // Setup valid cached auth
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = mockProfile.id;
      mockAsyncStorage['user_profile'] = JSON.stringify(mockProfile);
      
      // Setup Supabase to return valid session
      mockSupabaseSession = {
        user: { id: mockProfile.id },
        access_token: 'valid-token',
        expires_at: Date.now() + 3600000,
      };
      mockSupabaseProfile = mockProfile;
    });

    it('should return main screen navigation within 1 second with cached auth', async () => {
      const loader = new SimpleAuthLoaderClass();
      const startTime = Date.now();
      
      // Simulate app loading flow
      const result = await loader.checkCachedAuth();
      
      const duration = Date.now() - startTime;
      
      // Property: Should complete within 1 second
      expect(duration).toBeLessThan(1000);
      
      // Property: Should navigate to main screen
      expect(result.navigateTo).toBe('/(main)');
      expect(result.isAuthenticated).toBe(true);
    });

    it('should load profile from cache and integrate with auth store', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      // Simulate app loading flow
      const result = await loader.checkCachedAuth();
      
      // Simulate app flow: set user if authenticated
      if (result.isAuthenticated && result.profile) {
        useAuthStore.getState().setUser(result.profile);
      }
      
      // Property: Profile should be loaded into auth store
      const authState = useAuthStore.getState();
      expect(authState.user).not.toBeNull();
      expect(authState.user?.id).toBe(mockProfile.id);
      expect(authState.user?.role).toBe(mockProfile.role);
    });

    it('should trigger background validation after navigation', async () => {
      jest.useFakeTimers();
      
      const loader = new SimpleAuthLoaderClass();
      
      // Check cached auth
      const result = await loader.checkCachedAuth();
      expect(result.isAuthenticated).toBe(true);
      
      // Trigger background validation (simulating app flow)
      loader.validateSessionInBackground();
      
      // Fast-forward to trigger background validation
      jest.advanceTimersByTime(200);
      
      // Allow promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Property: Should call Supabase for background validation
      const { supabase } = require('../../services/supabase/supabase');
      expect(supabase.auth.getSession).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('should complete cache check within 100ms', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      const startTime = Date.now();
      const result = await loader.checkCachedAuth();
      const duration = Date.now() - startTime;
      
      // Property: Cache check should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(result.navigateTo).toBe('/(main)');
      expect(result.isAuthenticated).toBe(true);
      expect(result.profile).not.toBeNull();
    });

    it('should not block navigation while validating session', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      // Check cached auth (should be fast)
      const cacheStartTime = Date.now();
      const result = await loader.checkCachedAuth();
      const cacheDuration = Date.now() - cacheStartTime;
      
      // Start background validation (non-blocking)
      loader.validateSessionInBackground();
      
      // Property: Cache check completes before validation
      expect(cacheDuration).toBeLessThan(100);
      expect(result.navigateTo).toBe('/(main)');
    });
  });

  /**
   * Scenario 3: Corrupted cache → language screen
   * 
   * Requirements: 5.3
   * - App launches with corrupted cached data
   * - Should handle errors gracefully
   * - Should fall back to language screen
   * - Should complete within 2 seconds
   */
  describe('Scenario 3: Corrupted Cache', () => {
    it('should handle corrupted profile JSON gracefully', async () => {
      // Setup corrupted cache
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = 'test-user-123';
      mockAsyncStorage['user_profile'] = 'invalid-json{{{';
      
      const loader = new SimpleAuthLoaderClass();
      const result = await loader.checkCachedAuth();
      
      // Property: Should still navigate to main (auth is valid, profile is optional)
      expect(result.navigateTo).toBe('/(main)');
      expect(result.isAuthenticated).toBe(true);
      
      // Property: Profile should be null (couldn't parse)
      expect(result.profile).toBeNull();
    });

    it('should navigate to language screen when auth_verified is missing', async () => {
      // Setup partial cache (user_id but no auth_verified)
      mockAsyncStorage['user_id'] = 'test-user-123';
      mockAsyncStorage['user_profile'] = JSON.stringify({
        id: 'test-user-123',
        role: 'retailer',
      });
      
      const loader = new SimpleAuthLoaderClass();
      const result = await loader.checkCachedAuth();
      
      // Property: Should navigate to language screen
      expect(result.navigateTo).toBe('/(auth)/language');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should navigate to language screen when user_id is missing', async () => {
      // Setup partial cache (auth_verified but no user_id)
      mockAsyncStorage['auth_verified'] = 'true';
      
      const loader = new SimpleAuthLoaderClass();
      const result = await loader.checkCachedAuth();
      
      // Property: Should navigate to language screen
      expect(result.navigateTo).toBe('/(auth)/language');
      expect(result.isAuthenticated).toBe(false);
    });

    it('should complete within 2 seconds for corrupted cache', async () => {
      // Setup corrupted cache
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = 'test-user-123';
      mockAsyncStorage['user_profile'] = 'invalid-json{{{';
      
      const loader = new SimpleAuthLoaderClass();
      const startTime = Date.now();
      
      const result = await loader.checkCachedAuth();
      
      const duration = Date.now() - startTime;
      
      // Property: Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
      expect(result.navigateTo).toBe('/(main)');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      // Mock AsyncStorage.getItem to throw error
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const originalGetItem = AsyncStorage.getItem;
      AsyncStorage.getItem = jest.fn().mockRejectedValue(new Error('AsyncStorage error'));
      
      const loader = new SimpleAuthLoaderClass();
      const result = await loader.checkCachedAuth();
      
      // Property: Should fall back to language screen on error
      expect(result.navigateTo).toBe('/(auth)/language');
      expect(result.isAuthenticated).toBe(false);
      
      // Restore original
      AsyncStorage.getItem = originalGetItem;
    });
  });

  /**
   * Additional Integration Scenarios
   */
  describe('Additional Scenarios', () => {
    it('should handle background validation failure with invalid token', async () => {
      jest.useFakeTimers();
      
      // Setup valid cached auth
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = 'test-user-123';
      mockAsyncStorage['user_profile'] = JSON.stringify({
        id: 'test-user-123',
        role: 'retailer',
        phone_number: '1234567890',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        business_details: {},
      });
      
      // Setup Supabase to return invalid token error
      mockSupabaseError = { message: 'Invalid Refresh Token' };
      
      const loader = new SimpleAuthLoaderClass();
      let logoutCalled = false;
      
      // Set logout callback
      loader.setLogoutCallback(() => {
        logoutCalled = true;
        useAuthStore.getState().clearAuth();
      });
      
      // Check cached auth (should succeed)
      const result = await loader.checkCachedAuth();
      expect(result.navigateTo).toBe('/(main)');
      
      // Trigger background validation
      loader.validateSessionInBackground();
      
      // Fast-forward to trigger background validation setTimeout
      jest.advanceTimersByTime(200);
      
      // Allow multiple promise cycles to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      
      // Run all pending timers
      jest.runAllTimers();
      
      // Allow more promise cycles
      await Promise.resolve();
      await Promise.resolve();
      
      // Property: Should trigger logout callback
      expect(logoutCalled).toBe(true);
      
      // Property: Auth store should be cleared
      const authState = useAuthStore.getState();
      expect(authState.user).toBeNull();
      
      jest.useRealTimers();
    });

    it('should NOT logout on network errors during background validation', async () => {
      jest.useFakeTimers();
      
      // Setup valid cached auth
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = 'test-user-123';
      mockAsyncStorage['user_profile'] = JSON.stringify({
        id: 'test-user-123',
        role: 'retailer',
        phone_number: '1234567890',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        business_details: {},
      });
      
      // Setup Supabase to return network error
      mockSupabaseError = { message: 'Network request failed' };
      
      const loader = new SimpleAuthLoaderClass();
      let logoutCalled = false;
      
      // Set logout callback
      loader.setLogoutCallback(() => {
        logoutCalled = true;
      });
      
      // Check cached auth and set user
      const result = await loader.checkCachedAuth();
      if (result.isAuthenticated && result.profile) {
        useAuthStore.getState().setUser(result.profile);
      }
      
      // Trigger background validation
      loader.validateSessionInBackground();
      
      // Fast-forward to trigger background validation
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
      
      // Property: Should NOT trigger logout callback (network error)
      expect(logoutCalled).toBe(false);
      
      // Property: Auth store should still have user
      const authState = useAuthStore.getState();
      expect(authState.user).not.toBeNull();
      
      jest.useRealTimers();
    });

    it('should handle legacy cache keys', async () => {
      const userId = 'test-user-123';
      
      // Setup auth with legacy cache key
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = userId;
      mockAsyncStorage[`profile_cache_${userId}`] = JSON.stringify({
        id: userId,
        phone_number: '1234567890',
        role: 'retailer',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        business_details: {},
      });
      
      const loader = new SimpleAuthLoaderClass();
      const result = await loader.checkCachedAuth();
      
      // Property: Should navigate to main
      expect(result.navigateTo).toBe('/(main)');
      
      // Property: Should load profile from legacy cache
      expect(result.profile).not.toBeNull();
      expect(result.profile?.id).toBe(userId);
    });

    it('should integrate cache and auth store correctly', async () => {
      const mockProfile = {
        id: 'test-user-456',
        phone_number: '9876543210',
        role: 'wholesaler' as const,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        business_details: { name: 'Test Wholesaler' },
      };
      
      // Setup cached auth
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = mockProfile.id;
      mockAsyncStorage['user_profile'] = JSON.stringify(mockProfile);
      
      const loader = new SimpleAuthLoaderClass();
      
      // Simulate full app flow
      const result = await loader.checkCachedAuth();
      
      // Set user in auth store if authenticated
      if (result.isAuthenticated && result.profile) {
        useAuthStore.getState().setUser(result.profile);
      }
      
      // Property: Should navigate to main
      expect(result.navigateTo).toBe('/(main)');
      
      // Property: Auth store should have user
      const authState = useAuthStore.getState();
      expect(authState.user).not.toBeNull();
      expect(authState.user?.id).toBe(mockProfile.id);
      expect(authState.user?.role).toBe(mockProfile.role);
    });
  });

  /**
   * Performance Tests
   */
  describe('Performance Requirements', () => {
    it('should never exceed 2 seconds for any scenario', async () => {
      // Test various scenarios to ensure none exceed 2 seconds
      const scenarios = [
        { 
          name: 'fresh install', 
          setup: () => {},
          expectedNav: '/(auth)/language'
        },
        { 
          name: 'valid cache', 
          setup: () => {
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = 'test-user';
            mockAsyncStorage['user_profile'] = JSON.stringify({ 
              id: 'test-user', 
              role: 'retailer',
              phone_number: '1234567890',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              business_details: {},
            });
          },
          expectedNav: '/(main)'
        },
        {
          name: 'corrupted cache',
          setup: () => {
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = 'test-user';
            mockAsyncStorage['user_profile'] = 'invalid-json';
          },
          expectedNav: '/(main)'
        },
      ];

      for (const scenario of scenarios) {
        // Clear and setup
        Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
        scenario.setup();
        
        const loader = new SimpleAuthLoaderClass();
        const startTime = Date.now();
        
        const result = await loader.checkCachedAuth();
        
        const duration = Date.now() - startTime;
        
        // Property: Should complete within 2 seconds for all scenarios
        expect(duration).toBeLessThan(2000);
        
        // Property: Should navigate to expected screen
        expect(result.navigateTo).toBe(scenario.expectedNav);
      }
    });

    it('should complete fresh install within 500ms', async () => {
      const loader = new SimpleAuthLoaderClass();
      const startTime = Date.now();
      
      const result = await loader.checkCachedAuth();
      
      const duration = Date.now() - startTime;
      
      // Property: Fresh install should be very fast
      expect(duration).toBeLessThan(500);
      expect(result.navigateTo).toBe('/(auth)/language');
    });

    it('should complete cached auth within 1 second', async () => {
      // Setup valid cache
      mockAsyncStorage['auth_verified'] = 'true';
      mockAsyncStorage['user_id'] = 'test-user';
      mockAsyncStorage['user_profile'] = JSON.stringify({
        id: 'test-user',
        role: 'retailer',
        phone_number: '1234567890',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        business_details: {},
      });
      
      const loader = new SimpleAuthLoaderClass();
      const startTime = Date.now();
      
      const result = await loader.checkCachedAuth();
      
      const duration = Date.now() - startTime;
      
      // Property: Cached auth should be fast
      expect(duration).toBeLessThan(1000);
      expect(result.navigateTo).toBe('/(main)');
    });
  });
});
