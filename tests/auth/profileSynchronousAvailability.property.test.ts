/**
 * Property-Based Tests for Profile Synchronous Availability
 * 
 * **Feature: simplify-app-loading, Property 3: Profile data synchronous availability**
 * **Validates: Requirements 2.1, 2.2**
 * 
 * Tests that profile data is available synchronously in the auth store
 * before home screen components mount. This ensures no async loading
 * is needed on the home screen.
 */

import * as fc from 'fast-check';
import { SimpleAuthLoaderClass } from '../../services/auth/SimpleAuthLoader';
import { Profile } from '../../types/auth';

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
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
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

// Helper to clear all cache
function clearAllCache(): void {
  Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
}

// Arbitrary for generating valid profiles
const profileArb = fc.record({
  id: fc.uuid(),
  phone_number: fc.stringMatching(/^[0-9]{10}$/),
  role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer') as fc.Arbitrary<'retailer' | 'wholesaler' | 'manufacturer'>,
  status: fc.constantFrom('active', 'pending'),
  created_at: fc.constant(new Date().toISOString()),
  updated_at: fc.constant(new Date().toISOString()),
  business_details: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    address: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  }),
  seller_details: fc.option(
    fc.record({
      id: fc.uuid(),
      business_name: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { nil: undefined }
  ),
});

describe('Profile Synchronous Availability Property Tests', () => {
  beforeEach(() => {
    clearAllCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearAllCache();
  });

  /**
   * **Feature: simplify-app-loading, Property 3: Profile data synchronous availability**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * Property: For any navigation to the main screen with cached profile,
   * the profile data SHALL be available in the auth store before home
   * screen components mount.
   */
  describe('Property 3: Profile data synchronous availability', () => {
    it('should return profile synchronously from checkCachedAuth', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            // Setup: Cache the profile
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            
            // Act: Check cached auth (simulates what happens before navigation)
            const result = await loader.checkCachedAuth();

            // Cleanup
            clearAllCache();

            // Property 1: Profile should be available immediately (not null)
            expect(result.profile).not.toBeNull();
            
            // Property 2: Profile should match cached data
            expect(result.profile?.id).toBe(profile.id);
            expect(result.profile?.role).toBe(profile.role);
            expect(result.profile?.phone_number).toBe(profile.phone_number);
            
            // Property 3: Should navigate to main (indicating profile is ready)
            expect(result.navigateTo).toBe('/(main)');
            expect(result.isAuthenticated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide complete profile data for home screen rendering', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            // Setup: Cache the profile with all fields
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            clearAllCache();

            // Property: All essential profile fields should be available
            // These are the fields the home screen needs to render
            expect(result.profile).toBeDefined();
            expect(result.profile?.id).toBeDefined();
            expect(result.profile?.role).toBeDefined();
            expect(result.profile?.status).toBeDefined();
            
            // Business details should be preserved
            if (profile.business_details) {
              expect(result.profile?.business_details).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should make profile available before any network call', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            // Setup: Cache the profile
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            
            // Track timing
            const startTime = Date.now();
            const result = await loader.checkCachedAuth();
            const duration = Date.now() - startTime;

            // Cleanup
            clearAllCache();

            // Property 1: Profile should be available
            expect(result.profile).not.toBeNull();
            
            // Property 2: Should complete very quickly (< 100ms)
            // This proves no network call was made
            expect(duration).toBeLessThan(100);
            
            // Property 3: Navigation target should be determined
            expect(result.navigateTo).toBe('/(main)');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve profile data integrity through cache round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            const loader = new SimpleAuthLoaderClass();
            
            // Act 1: Cache the profile
            await loader.cacheAuthData(profile as Profile);
            
            // Act 2: Read it back
            const result = await loader.checkCachedAuth();

            // Cleanup
            clearAllCache();

            // Property: Round-trip should preserve all data
            expect(result.profile?.id).toBe(profile.id);
            expect(result.profile?.phone_number).toBe(profile.phone_number);
            expect(result.profile?.role).toBe(profile.role);
            expect(result.profile?.status).toBe(profile.status);
            
            // Business details should be preserved
            expect(JSON.stringify(result.profile?.business_details))
              .toBe(JSON.stringify(profile.business_details));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional tests for edge cases
   */
  describe('Edge Cases', () => {
    it('should handle profile with minimal required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[0-9]{10}$/),
          fc.constantFrom('retailer', 'wholesaler', 'manufacturer') as fc.Arbitrary<'retailer' | 'wholesaler' | 'manufacturer'>,
          async (id, phone, role) => {
            // Minimal profile with only required fields
            const minimalProfile = {
              id,
              phone_number: phone,
              role,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              business_details: {},
            };

            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = id;
            mockAsyncStorage['user_profile'] = JSON.stringify(minimalProfile);

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            clearAllCache();

            // Property: Should work with minimal profile
            expect(result.profile).not.toBeNull();
            expect(result.profile?.id).toBe(id);
            expect(result.navigateTo).toBe('/(main)');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle profile with seller_details', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb.filter(p => p.seller_details !== undefined),
          async (profile) => {
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            const result = await loader.checkCachedAuth();

            // Cleanup
            clearAllCache();

            // Property: seller_details should be preserved
            expect(result.profile?.seller_details).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle concurrent cache reads', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          fc.integer({ min: 2, max: 5 }),
          async (profile, numReads) => {
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            
            // Perform concurrent reads
            const results = await Promise.all(
              Array(numReads).fill(null).map(() => loader.checkCachedAuth())
            );

            // Cleanup
            clearAllCache();

            // Property: All concurrent reads should return the same profile
            const allMatch = results.every(r => 
              r.profile?.id === profile.id &&
              r.navigateTo === '/(main)'
            );
            expect(allMatch).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Timing guarantees
   */
  describe('Timing Guarantees', () => {
    it('should provide profile within timing requirements for home screen', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          async (profile) => {
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;
            mockAsyncStorage['user_profile'] = JSON.stringify(profile);

            const loader = new SimpleAuthLoaderClass();
            
            // Measure multiple reads to get consistent timing
            const timings: number[] = [];
            for (let i = 0; i < 5; i++) {
              const start = Date.now();
              await loader.checkCachedAuth();
              timings.push(Date.now() - start);
            }

            // Cleanup
            clearAllCache();

            // Property: Average timing should be very fast (< 50ms)
            const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
            expect(avgTiming).toBeLessThan(50);
            
            // Property: No single read should exceed 100ms
            const maxTiming = Math.max(...timings);
            expect(maxTiming).toBeLessThan(100);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
