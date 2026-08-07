/**
 * Property-Based Tests for SimpleAuthLoader
 * 
 * **Feature: simplify-app-loading**
 * 
 * Tests the simplified auth loading service that replaces the complex
 * ProfileLoader, AuthStateManager, and authSync utilities.
 */

import * as fc from 'fast-check';
import { SimpleAuthLoaderClass, CachedAuthResult } from '../../services/auth/SimpleAuthLoader';

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string | null> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
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
}));

// Mock Supabase
const mockSession = {
  user: { id: 'test-user-id' },
  access_token: 'test-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000,
};

const mockProfile = {
  id: 'test-user-id',
  phone_number: '1234567890',
  role: 'retailer' as const,
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  business_details: {},
};

let mockSupabaseError: { message: string } | null = null;
let mockSupabaseSession = mockSession;

jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => {
        if (mockSupabaseError) {
          return Promise.resolve({ data: { session: null }, error: mockSupabaseError });
        }
        return Promise.resolve({ data: { session: mockSupabaseSession }, error: null });
      }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: mockProfile, error: null })),
        })),
      })),
    })),
  },
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

describe('SimpleAuthLoader Property Tests', () => {
  let authLoader: SimpleAuthLoaderClass;

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    
    // Reset Supabase mocks
    mockSupabaseError = null;
    mockSupabaseSession = mockSession;
    
    // Create fresh instance for each test
    authLoader = new SimpleAuthLoaderClass();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * **Feature: simplify-app-loading, Property 1: Navigation timing with cached auth**
   * **Validates: Requirements 1.1, 1.2, 5.2**
   * 
   * Property: For any valid cached auth state (auth_verified='true' and user_id exists),
   * the app SHALL navigate to the main screen within 1 second of launch.
   */
  describe('Property 1: Navigation timing with cached auth', () => {
    // Arbitrary for valid cached auth state
    const validCachedAuthArb = fc.record({
      userId: fc.uuid(),
      profile: fc.record({
        id: fc.uuid(),
        phone_number: fc.stringMatching(/^[0-9]{10}$/),
        role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer'),
        status: fc.constantFrom('active', 'pending'),
        created_at: fc.constant(new Date().toISOString()),
        updated_at: fc.constant(new Date().toISOString()),
        business_details: fc.constant({}),
      }),
    });

    it('should navigate to main screen within 1 second for valid cached auth', async () => {
      await fc.assert(
        fc.asyncProperty(
          validCachedAuthArb,
          async ({ userId, profile }) => {
            // Setup valid cached auth
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = JSON.stringify({ ...profile, id: userId });

            const loader = new SimpleAuthLoaderClass();
            
            const startTime = Date.now();
            const result = await loader.checkCachedAuth();
            const duration = Date.now() - startTime;

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should navigate to main screen
            expect(result.navigateTo).toBe('/(main)');
            expect(result.isAuthenticated).toBe(true);
            
            // Property: Should complete within 1 second (1000ms)
            expect(duration).toBeLessThan(1000);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return cached profile when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          validCachedAuthArb,
          async ({ userId, profile }) => {
            const fullProfile = { ...profile, id: userId };
            
            // Setup valid cached auth with profile
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = JSON.stringify(fullProfile);

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should return the cached profile
            expect(result.profile).not.toBeNull();
            expect(result.profile?.id).toBe(userId);
            expect(result.profile?.role).toBe(profile.role);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should still navigate to main even without cached profile if auth_verified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Setup auth verified but no profile
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            // No user_profile set

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should still navigate to main (profile can be null)
            expect(result.navigateTo).toBe('/(main)');
            expect(result.isAuthenticated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: simplify-app-loading, Property 2: Navigation timing without cached auth**
   * **Validates: Requirements 1.3, 5.1**
   * 
   * Property: For any empty or invalid cached auth state, the app SHALL navigate
   * to the language screen within 500ms of launch.
   */
  describe('Property 2: Navigation timing without cached auth', () => {
    // Arbitrary for invalid/empty cached auth states
    const invalidCachedAuthArb = fc.oneof(
      // No auth data at all
      fc.constant({ authVerified: null, userId: null }),
      // auth_verified is false
      fc.record({
        authVerified: fc.constant('false'),
        userId: fc.option(fc.uuid(), { nil: null }),
      }),
      // auth_verified is true but no userId
      fc.record({
        authVerified: fc.constant('true'),
        userId: fc.constant(null),
      }),
      // Random invalid values
      fc.record({
        authVerified: fc.constantFrom(null, '', 'invalid', 'FALSE'),
        userId: fc.option(fc.uuid(), { nil: null }),
      })
    );

    it('should navigate to language screen within 500ms for invalid/empty cached auth', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidCachedAuthArb,
          async ({ authVerified, userId }) => {
            // Setup invalid cached auth
            if (authVerified !== null) {
              mockAsyncStorage['auth_verified'] = authVerified;
            }
            if (userId !== null) {
              mockAsyncStorage['user_id'] = userId;
            }

            const loader = new SimpleAuthLoaderClass();
            
            const startTime = Date.now();
            const result = await loader.checkCachedAuth();
            const duration = Date.now() - startTime;

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should navigate to language screen
            expect(result.navigateTo).toBe('/(auth)/language');
            expect(result.isAuthenticated).toBe(false);
            
            // Property: Should complete within 500ms
            expect(duration).toBeLessThan(500);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null profile for invalid auth state', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidCachedAuthArb,
          async ({ authVerified, userId }) => {
            // Setup invalid cached auth
            if (authVerified !== null) {
              mockAsyncStorage['auth_verified'] = authVerified;
            }
            if (userId !== null) {
              mockAsyncStorage['user_id'] = userId;
            }

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Profile should be null for invalid auth
            expect(result.profile).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: simplify-app-loading, Property 5: Background validation non-blocking**
   * **Validates: Requirements 3.1, 3.3**
   * 
   * Property: For any app launch with cached auth, navigation to main screen SHALL
   * complete before session validation network request completes.
   */
  describe('Property 5: Background validation non-blocking', () => {
    it('should not block checkCachedAuth while validation runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Setup valid cached auth
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = JSON.stringify({ ...mockProfile, id: userId });

            const loader = new SimpleAuthLoaderClass();
            
            // Track timing
            const startTime = Date.now();
            
            // checkCachedAuth should return immediately
            const result = await loader.checkCachedAuth();
            const cacheCheckDuration = Date.now() - startTime;
            
            // Start background validation (non-blocking)
            loader.validateSessionInBackground();
            
            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Cache check should complete quickly (before any network call)
            expect(cacheCheckDuration).toBeLessThan(100);
            
            // Property: Should have navigation result immediately
            expect(result.navigateTo).toBe('/(main)');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use setTimeout for background validation to avoid blocking', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            const loader = new SimpleAuthLoaderClass();
            
            // Track if setTimeout was used
            const originalSetTimeout = global.setTimeout;
            let setTimeoutCalled = false;
            let setTimeoutDelay = 0;
            
            global.setTimeout = ((fn: Function, delay: number) => {
              setTimeoutCalled = true;
              setTimeoutDelay = delay;
              return originalSetTimeout(fn, delay);
            }) as typeof setTimeout;

            // Trigger background validation
            loader.validateSessionInBackground();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;

            // Property: Background validation should use setTimeout
            expect(setTimeoutCalled).toBe(true);
            
            // Property: Delay should be small (100ms as per design)
            expect(setTimeoutDelay).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: simplify-app-loading, Property 6: Definitive logout only**
   * **Validates: Requirements 3.2**
   * 
   * Property: For any background validation failure, logout SHALL only occur if
   * the error indicates an invalid/expired token, not for network errors.
   */
  describe('Property 6: Definitive logout only', () => {
    // Arbitrary for definitive invalid token errors
    const invalidTokenErrorArb = fc.constantFrom(
      'Invalid Refresh Token',
      'Refresh Token Not Found',
      'invalid_grant',
      'Token has expired',
      'JWT expired',
      'Invalid JWT',
      'Invalid Refresh Token: Already Used'
    );

    // Arbitrary for network/transient errors (should NOT trigger logout)
    const networkErrorArb = fc.constantFrom(
      'Network request failed',
      'Failed to fetch',
      'timeout',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'Network Error',
      'Unable to connect',
      'Connection refused',
      'DNS lookup failed'
    );

    it('should trigger logout callback for definitive invalid token errors', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      await fc.assert(
        fc.asyncProperty(
          invalidTokenErrorArb,
          async (errorMessage) => {
            // Setup valid cached auth
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = 'test-user';

            // Mock Supabase to return invalid token error
            mockSupabaseError = { message: errorMessage };

            const loader = new SimpleAuthLoaderClass();
            let logoutCalled = false;
            
            loader.setLogoutCallback(() => {
              logoutCalled = true;
            });

            // Run background validation
            loader.validateSessionInBackground();
            
            // Wait for setTimeout (100ms) and async operations to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Cleanup
            mockSupabaseError = null;
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Logout should be called for invalid token errors
            expect(logoutCalled).toBe(true);
          }
        ),
        { numRuns: 10 } // Reduce runs to speed up test
      );
    }, 30000);

    it('should NOT trigger logout for network errors', async () => {
      jest.useRealTimers(); // Use real timers for this test
      
      await fc.assert(
        fc.asyncProperty(
          networkErrorArb,
          async (errorMessage) => {
            // Setup valid cached auth
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = 'test-user';

            // Mock Supabase to return network error
            mockSupabaseError = { message: errorMessage };

            const loader = new SimpleAuthLoaderClass();
            let logoutCalled = false;
            
            loader.setLogoutCallback(() => {
              logoutCalled = true;
            });

            // Run background validation
            loader.validateSessionInBackground();
            
            // Wait for setTimeout (100ms) and async operations to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            // Cleanup
            mockSupabaseError = null;
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Logout should NOT be called for network errors
            expect(logoutCalled).toBe(false);
          }
        ),
        { numRuns: 10 } // Reduce runs to speed up test
      );
    }, 30000);

    it('should correctly identify invalid token patterns', async () => {
      const loader = new SimpleAuthLoaderClass();
      
      // Access private method for testing via type assertion
      const isInvalidToken = (loader as any).isDefinitiveInvalidToken.bind(loader);

      await fc.assert(
        fc.asyncProperty(
          fc.oneof(invalidTokenErrorArb, networkErrorArb),
          fc.boolean(),
          async (errorMessage, _) => {
            const result = isInvalidToken(errorMessage);
            
            // Check if it's an invalid token error
            const isActuallyInvalidToken = [
              'Invalid Refresh Token',
              'Refresh Token Not Found',
              'invalid_grant',
              'Token has expired',
              'JWT expired',
              'Invalid JWT',
            ].some(pattern => errorMessage.toLowerCase().includes(pattern.toLowerCase()));

            // Property: Detection should match actual invalid token patterns
            expect(result).toBe(isActuallyInvalidToken);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: simplify-app-loading, Property 4: Profile cache update timing**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any profile data change, AsyncStorage SHALL be updated
   * within 1 second of the change.
   */
  describe('Property 4: Profile cache update timing', () => {
    const profileArb = fc.record({
      id: fc.uuid(),
      phone_number: fc.stringMatching(/^[0-9]{10}$/),
      role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer') as fc.Arbitrary<'retailer' | 'wholesaler' | 'manufacturer'>,
      status: fc.constantFrom('active', 'pending'),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
      business_details: fc.constant({}),
    });

    it('should cache profile data within 1 second', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            const loader = new SimpleAuthLoaderClass();
            
            const startTime = Date.now();
            await loader.cacheAuthData(profile as any);
            const duration = Date.now() - startTime;

            // Verify data was cached
            const cachedProfile = mockAsyncStorage['user_profile'];
            const cachedAuthVerified = mockAsyncStorage['auth_verified'];
            const cachedUserId = mockAsyncStorage['user_id'];

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should complete within 1 second
            expect(duration).toBeLessThan(1000);
            
            // Property: Data should be cached correctly
            expect(cachedAuthVerified).toBe('true');
            expect(cachedUserId).toBe(profile.id);
            expect(cachedProfile).toBeDefined();
            
            const parsedProfile = JSON.parse(cachedProfile!);
            expect(parsedProfile.id).toBe(profile.id);
            expect(parsedProfile.role).toBe(profile.role);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update all required cache keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            const loader = new SimpleAuthLoaderClass();
            
            await loader.cacheAuthData(profile as any);

            // Check all required keys are set
            const requiredKeys = ['auth_verified', 'user_id', 'user_profile'];
            const allKeysSet = requiredKeys.every(key => mockAsyncStorage[key] !== undefined);

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: All required keys should be set
            expect(allKeysSet).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Cache clearing tests
   */
  describe('Cache Clearing', () => {
    it('should clear all auth-related keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Setup cached auth
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = JSON.stringify({ id: userId });
            mockAsyncStorage['profile_id'] = userId;
            mockAsyncStorage['user_phone'] = '1234567890';
            mockAsyncStorage['user_role'] = 'retailer';
            mockAsyncStorage[`profile_cache_${userId}`] = JSON.stringify({ id: userId });

            const loader = new SimpleAuthLoaderClass();
            await loader.clearCachedAuth();

            // Check all auth keys are cleared
            const authKeys = ['auth_verified', 'user_id', 'user_profile', 'profile_id', 'user_phone', 'user_role'];
            const allCleared = authKeys.every(key => mockAsyncStorage[key] === undefined);

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: All auth keys should be cleared
            expect(allCleared).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Error handling tests
   */
  describe('Error Handling', () => {
    it('should handle corrupted profile JSON gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string().filter(s => {
            try { JSON.parse(s); return false; } catch { return true; }
          }),
          async (userId, corruptedJson) => {
            // Setup auth with corrupted profile
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = corruptedJson;

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: Should still navigate to main (auth is valid)
            expect(result.navigateTo).toBe('/(main)');
            expect(result.isAuthenticated).toBe(true);
            
            // Property: Profile should be null due to parse error
            expect(result.profile).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
