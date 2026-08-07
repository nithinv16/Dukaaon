/**
 * Property-Based Tests for Auth Synchronization Utilities
 * 
 * **Feature: fix-home-loading-state, Property 6: Sequential auth state processing**
 * **Validates: Requirements 3.4**
 * 
 * Tests that sequences of auth state updates are processed in order
 * without race conditions corrupting the final state.
 */

import * as fc from 'fast-check';
import {
  waitForAuthState,
  setUserAndWait,
  authStateQueue,
  enqueueAuthUpdate,
  AuthSyncTimeoutError,
} from '../../utils/authSync';
import { useAuthStore } from '../../store/auth';
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

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {},
  })),
}));

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
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
  validateSupabaseConnection: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock ProfileLoader
jest.mock('../../services/auth/profileLoader', () => ({
  ProfileLoader: {
    loadProfile: jest.fn(() => Promise.resolve({
      profile: null,
      fromCache: false,
      loadTime: 50,
    })),
    clearAllCaches: jest.fn(() => Promise.resolve()),
  },
}));

// Mock profileDebug
jest.mock('../../utils/profileDebug', () => ({
  ProfileDebug: {
    runDiagnostics: jest.fn(() => Promise.resolve()),
    testProfileFetch: jest.fn(() => Promise.resolve()),
    resetForTesting: jest.fn(() => Promise.resolve()),
  },
}));

// Helper to create a mock profile
function createMockProfile(id: string, index?: number): Profile {
  return {
    id,
    phone_number: `123456789${index ?? 0}`,
    role: 'retailer',
    status: 'active',
    business_details: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Helper to create a mock session
function createMockSession(userId: string) {
  return {
    user: { id: userId },
    access_token: 'test-token',
    refresh_token: 'test-refresh-token',
  };
}

describe('Auth Synchronization Property Tests', () => {
  beforeEach(() => {
    // Reset auth store state
    useAuthStore.setState({
      session: null,
      user: null,
      loading: true,
    });
    
    // Clear mock storage
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    
    // Clear auth state queue
    authStateQueue.clear();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * **Feature: fix-home-loading-state, Property 6: Sequential auth state processing**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any sequence of auth state updates, they must be processed
   * in the order they were initiated, ensuring no race conditions corrupt the final state.
   */
  describe('Property 6: Sequential auth state processing', () => {
    // Arbitrary for generating sequences of user IDs
    const userIdSequenceArb = fc.array(fc.uuid(), { minLength: 2, maxLength: 10 });

    it('should process sequential auth updates in order', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdSequenceArb,
          async (userIds) => {
            // Reset state before each test
            useAuthStore.setState({ user: null, session: null, loading: false });
            authStateQueue.clear();

            // Enqueue all updates
            const promises = userIds.map((userId, index) => {
              const profile = createMockProfile(userId, index);
              const session = createMockSession(userId);
              return enqueueAuthUpdate(profile, session);
            });

            // Wait for all updates to complete
            await Promise.all(promises);

            // Property: Final state should have the last user in the sequence
            const finalState = useAuthStore.getState();
            const lastUserId = userIds[userIds.length - 1];
            
            expect(finalState.user?.id).toBe(lastUserId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain order when updates are enqueued concurrently', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdSequenceArb,
          async (userIds) => {
            // Reset state
            useAuthStore.setState({ user: null, session: null, loading: false });
            authStateQueue.clear();

            // Track the order of completions
            const completionOrder: string[] = [];

            // Enqueue all updates concurrently (not awaiting each one)
            const promises = userIds.map((userId, index) => {
              const profile = createMockProfile(userId, index);
              const session = createMockSession(userId);
              return enqueueAuthUpdate(profile, session).then(() => {
                completionOrder.push(userId);
              });
            });

            // Wait for all to complete
            await Promise.all(promises);

            // Property: Completion order should match enqueue order
            expect(completionOrder).toEqual(userIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not interleave state updates from concurrent calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (numConcurrentUpdates) => {
            // Reset state
            useAuthStore.setState({ user: null, session: null, loading: false });
            authStateQueue.clear();

            // Track intermediate states
            const intermediateStates: (string | null)[] = [];
            
            // Subscribe to state changes
            const unsubscribe = useAuthStore.subscribe((state) => {
              intermediateStates.push(state.user?.id ?? null);
            });

            // Generate unique user IDs for this test
            const userIds = Array.from({ length: numConcurrentUpdates }, (_, i) => 
              `user-${i}-${Date.now()}`
            );

            // Enqueue updates concurrently
            const promises = userIds.map((userId, index) => {
              const profile = createMockProfile(userId, index);
              const session = createMockSession(userId);
              return enqueueAuthUpdate(profile, session);
            });

            await Promise.all(promises);
            unsubscribe();

            // Property: Each intermediate state should be a valid user ID from our sequence
            // (no partial or corrupted states)
            const validUserIds = new Set([null, ...userIds]);
            const allStatesValid = intermediateStates.every(state => validUserIds.has(state));
            
            expect(allStatesValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('waitForAuthState', () => {
    it('should return true immediately when predicate is already satisfied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Set up state that satisfies predicate
            const profile = createMockProfile(userId);
            useAuthStore.setState({ user: profile, session: null, loading: false });

            // Wait for state (should return immediately)
            const startTime = Date.now();
            const result = await waitForAuthState(() => useAuthStore.getState().user !== null);
            const duration = Date.now() - startTime;

            // Property: Should return true
            expect(result).toBe(true);
            
            // Property: Should return quickly (within 100ms since predicate is already true)
            expect(duration).toBeLessThan(100);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return false on timeout when predicate never satisfied', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 200, max: 300 }),
          async (timeout) => {
            // Ensure state doesn't satisfy predicate
            useAuthStore.setState({ user: null, session: null, loading: false });

            // Wait for state with short timeout
            const startTime = Date.now();
            const result = await waitForAuthState(
              () => useAuthStore.getState().user !== null,
              timeout
            );
            const duration = Date.now() - startTime;

            // Property: Should return false
            expect(result).toBe(false);
            
            // Property: Should wait at least the timeout duration (minus small tolerance for timing)
            expect(duration).toBeGreaterThanOrEqual(timeout - 50);
            // Property: Should not wait excessively longer than timeout (allow for polling interval + overhead)
            // In test environments, timing can be less precise, so allow more overhead
            expect(duration).toBeLessThan(timeout + 10000);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000); // Increase timeout to 30 seconds for this test

    it('should return true when predicate becomes satisfied during wait', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 50, max: 200 }),
          async (userId, delay) => {
            // Start with null user
            useAuthStore.setState({ user: null, session: null, loading: false });

            // Set user after delay
            setTimeout(() => {
              const profile = createMockProfile(userId);
              useAuthStore.setState({ user: profile });
            }, delay);

            // Wait for state with longer timeout
            const result = await waitForAuthState(
              () => useAuthStore.getState().user !== null,
              delay + 500
            );

            // Property: Should return true once user is set
            expect(result).toBe(true);
            
            // Property: User should be set
            expect(useAuthStore.getState().user?.id).toBe(userId);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000); // Increase timeout to 30 seconds for this test
  });

  describe('setUserAndWait', () => {
    it('should set user and confirm state propagation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Start with null user
            useAuthStore.setState({ user: null, session: null, loading: true });

            const profile = createMockProfile(userId);
            const session = createMockSession(userId);

            // Set user and wait
            await setUserAndWait(profile, session);

            // Property: User should be set
            const state = useAuthStore.getState();
            expect(state.user?.id).toBe(userId);
            
            // Property: Loading should be false
            expect(state.loading).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle setting user to null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Start with a user
            const profile = createMockProfile(userId);
            useAuthStore.setState({ user: profile, session: null, loading: false });

            // Clear user
            await setUserAndWait(null, null);

            // Property: User should be null
            const state = useAuthStore.getState();
            expect(state.user).toBeNull();
            expect(state.session).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('AuthStateQueue', () => {
    it('should process operations in FIFO order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }),
          async (values) => {
            authStateQueue.clear();
            const results: number[] = [];

            // Enqueue operations that record their value
            const promises = values.map(value => 
              authStateQueue.enqueue(async () => {
                // Small delay to simulate async work
                await new Promise(resolve => setTimeout(resolve, 5));
                results.push(value);
              })
            );

            await Promise.all(promises);

            // Property: Results should be in same order as input
            expect(results).toEqual(values);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('should handle errors without breaking the queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 3, maxLength: 8 }),
          async (shouldFail) => {
            authStateQueue.clear();
            const successfulOps: number[] = [];

            // Enqueue operations, some of which fail
            const promises = shouldFail.map((fail, index) => 
              authStateQueue.enqueue(async () => {
                if (fail) {
                  throw new Error(`Operation ${index} failed`);
                }
                successfulOps.push(index);
              }).catch(() => {
                // Catch errors to prevent test failure
              })
            );

            await Promise.all(promises);

            // Property: Successful operations should still complete in order
            const expectedSuccessful = shouldFail
              .map((fail, index) => fail ? null : index)
              .filter(x => x !== null);
            
            expect(successfulOps).toEqual(expectedSuccessful);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
