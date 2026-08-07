/**
 * Property-Based Tests for Simplified Auth Store
 * 
 * **Feature: simplify-app-loading**
 * 
 * Tests the simplified auth store that uses SimpleAuthLoader for caching.
 */

import * as fc from 'fast-check';

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
}));

// Mock profile data for Supabase responses
let mockProfileData: any = null;
let mockProfileError: any = null;

// Mock Supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: mockProfileData, 
            error: mockProfileError 
          })),
          maybeSingle: jest.fn(() => Promise.resolve({ 
            data: mockProfileData, 
            error: mockProfileError 
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: mockProfileData, 
            error: mockProfileError 
          })),
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

// Import after mocks are set up
import { useAuthStore } from '../../store/auth';

describe('Auth Store Property Tests', () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    
    // Reset profile mocks
    mockProfileData = null;
    mockProfileError = null;
    
    // Reset store state
    useAuthStore.setState({
      session: null,
      user: null,
      loading: true,
    });
    
    jest.clearAllMocks();
  });

  /**
   * **Feature: simplify-app-loading, Property 4: Profile cache update timing**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any profile data change via setSession, AsyncStorage SHALL be 
   * updated within 1 second of the change.
   */
  describe('Property 4: Profile cache update timing', () => {
    // Arbitrary for valid profile data
    const profileArb = fc.record({
      id: fc.uuid(),
      phone_number: fc.stringMatching(/^[0-9]{10}$/),
      role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer'),
      status: fc.constantFrom('active', 'pending'),
      created_at: fc.constant(new Date().toISOString()),
      updated_at: fc.constant(new Date().toISOString()),
      business_details: fc.constant({}),
      latitude: fc.option(fc.double({ min: -90, max: 90 }), { nil: null }),
      longitude: fc.option(fc.double({ min: -180, max: 180 }), { nil: null }),
    });

    // Arbitrary for valid session
    const sessionArb = fc.record({
      user: fc.record({
        id: fc.uuid(),
      }),
      access_token: fc.string({ minLength: 10 }),
      refresh_token: fc.string({ minLength: 10 }),
      expires_at: fc.integer({ min: Date.now(), max: Date.now() + 86400000 }),
    });

    it('should cache profile data within 1 second when setSession is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          sessionArb,
          async (profile, session) => {
            // Setup: Make session user ID match profile ID
            const userId = profile.id;
            const sessionWithMatchingUser = {
              ...session,
              user: { id: userId },
            };

            // Mock Supabase to return this profile
            mockProfileData = profile;
            mockProfileError = null;

            const startTime = Date.now();
            
            // Call setSession
            await useAuthStore.getState().setSession(sessionWithMatchingUser);
            
            const duration = Date.now() - startTime;

            // Verify cache was updated
            const cachedAuthVerified = mockAsyncStorage['auth_verified'];
            const cachedUserId = mockAsyncStorage['user_id'];
            const cachedProfile = mockAsyncStorage['user_profile'];

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
            useAuthStore.setState({ session: null, user: null, loading: true });

            // Property: Should complete within 1 second
            expect(duration).toBeLessThan(1000);
            
            // Property: Auth data should be cached
            expect(cachedAuthVerified).toBe('true');
            expect(cachedUserId).toBe(userId);
            expect(cachedProfile).toBeDefined();
            
            // Property: Cached profile should match
            if (cachedProfile) {
              const parsedProfile = JSON.parse(cachedProfile);
              expect(parsedProfile.id).toBe(profile.id);
              expect(parsedProfile.role).toBe(profile.role);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update store state when setSession is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          profileArb,
          sessionArb,
          async (profile, session) => {
            const userId = profile.id;
            const sessionWithMatchingUser = {
              ...session,
              user: { id: userId },
            };

            mockProfileData = profile;
            mockProfileError = null;

            await useAuthStore.getState().setSession(sessionWithMatchingUser);

            const state = useAuthStore.getState();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
            useAuthStore.setState({ session: null, user: null, loading: true });

            // Property: Store state should be updated
            expect(state.user).not.toBeNull();
            expect(state.user?.id).toBe(profile.id);
            expect(state.loading).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should clear cache when setSession is called with null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Setup: Pre-populate cache
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = userId;
            mockAsyncStorage['user_profile'] = JSON.stringify({ id: userId });

            // Call setSession with null
            await useAuthStore.getState().setSession(null);

            // Verify cache was cleared
            const cachedAuthVerified = mockAsyncStorage['auth_verified'];
            const cachedUserId = mockAsyncStorage['user_id'];

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
            useAuthStore.setState({ session: null, user: null, loading: true });

            // Property: Cache should be cleared
            expect(cachedAuthVerified).toBeUndefined();
            expect(cachedUserId).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Store state consistency tests
   */
  describe('Store State Consistency', () => {
    it('should set loading to false after setSession completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(
            fc.record({
              user: fc.record({ id: fc.uuid() }),
              access_token: fc.string({ minLength: 10 }),
            }),
            { nil: null }
          ),
          async (session) => {
            mockProfileData = session ? { id: session.user.id, role: 'retailer' } : null;
            mockProfileError = null;

            await useAuthStore.getState().setSession(session);

            const state = useAuthStore.getState();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
            useAuthStore.setState({ session: null, user: null, loading: true });

            // Property: Loading should always be false after setSession
            expect(state.loading).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should clear user when clearAuth is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            phone_number: fc.stringMatching(/^[0-9]{10}$/),
            role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer'),
          }),
          async (profile) => {
            // Setup: Set user in store
            useAuthStore.setState({ 
              user: profile as any, 
              session: { user: { id: profile.id } } as any,
              loading: false 
            });

            // Pre-populate cache
            mockAsyncStorage['auth_verified'] = 'true';
            mockAsyncStorage['user_id'] = profile.id;

            // Call clearAuth
            await useAuthStore.getState().clearAuth();

            const state = useAuthStore.getState();

            // Cleanup
            Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);

            // Property: User should be null after clearAuth
            expect(state.user).toBeNull();
            expect(state.session).toBeNull();
            expect(state.loading).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * setUser and setLoading tests
   */
  describe('Direct State Setters', () => {
    it('setUser should update user state immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(
            fc.record({
              id: fc.uuid(),
              phone_number: fc.stringMatching(/^[0-9]{10}$/),
              role: fc.constantFrom('retailer', 'wholesaler', 'manufacturer'),
            }),
            { nil: null }
          ),
          async (profile) => {
            useAuthStore.getState().setUser(profile as any);

            const state = useAuthStore.getState();

            // Cleanup
            useAuthStore.setState({ user: null });

            // Property: User should match what was set
            if (profile) {
              expect(state.user?.id).toBe(profile.id);
            } else {
              expect(state.user).toBeNull();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('setLoading should update loading state immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (loading) => {
            useAuthStore.getState().setLoading(loading);

            const state = useAuthStore.getState();

            // Cleanup
            useAuthStore.setState({ loading: true });

            // Property: Loading should match what was set
            expect(state.loading).toBe(loading);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
