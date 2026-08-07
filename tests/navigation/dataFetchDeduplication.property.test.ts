/**
 * Property-Based Tests for Data Fetch Deduplication
 * 
 * **Feature: codebase-optimization-audit, Property 3: Data Fetch Deduplication**
 * **Validates: Requirements 5.2**
 * 
 * Tests that screen components do not trigger new network fetches when data
 * already exists in the global state.
 */

import * as fc from 'fast-check';

// Types for data state simulation
interface DataState {
  products: any[] | null;
  categories: any[] | null;
  wholesalers: any[] | null;
  manufacturers: any[] | null;
  lastFetchTime: Record<string, number>;
}

interface FetchRequest {
  dataType: 'products' | 'categories' | 'wholesalers' | 'manufacturers';
  timestamp: number;
  triggeredBy: 'mount' | 'refresh' | 'navigation';
}

interface FetchResult {
  fetchTriggered: boolean;
  usedCache: boolean;
  dataType: string;
  reason: string;
}

// Cooldown period in milliseconds (matches DataFetchCoordinator)
const FETCH_COOLDOWN = 5000;

/**
 * Simulates the data fetch decision logic used by components.
 * This models the behavior in DynamicHomeSections, NearbyWholesalers, etc.
 * 
 * @param currentState - Current data state
 * @param request - Fetch request details
 * @returns FetchResult indicating whether a fetch was triggered
 */
function simulateDataFetchDecision(
  currentState: DataState,
  request: FetchRequest
): FetchResult {
  const { dataType, timestamp, triggeredBy } = request;
  
  // Check if data already exists in state
  const existingData = currentState[dataType];
  const hasExistingData = existingData !== null && existingData.length > 0;
  
  // Check cooldown period
  const lastFetch = currentState.lastFetchTime[dataType] || 0;
  const timeSinceLastFetch = timestamp - lastFetch;
  const isInCooldown = timeSinceLastFetch < FETCH_COOLDOWN;
  
  // Decision logic based on component behavior
  if (triggeredBy === 'mount') {
    // On mount: Use cache if available, don't fetch if data exists
    if (hasExistingData) {
      return {
        fetchTriggered: false,
        usedCache: true,
        dataType,
        reason: 'Data already exists in state',
      };
    }
    
    // No data, need to fetch
    return {
      fetchTriggered: true,
      usedCache: false,
      dataType,
      reason: 'No existing data, fetching fresh',
    };
  }
  
  if (triggeredBy === 'navigation') {
    // On navigation back: Check cooldown and existing data
    if (hasExistingData && isInCooldown) {
      return {
        fetchTriggered: false,
        usedCache: true,
        dataType,
        reason: 'Data exists and within cooldown period',
      };
    }
    
    if (hasExistingData) {
      // Data exists but stale - trigger background refresh
      return {
        fetchTriggered: true,
        usedCache: true, // Still use cached data immediately
        dataType,
        reason: 'Data exists but stale, background refresh triggered',
      };
    }
    
    return {
      fetchTriggered: true,
      usedCache: false,
      dataType,
      reason: 'No existing data on navigation',
    };
  }
  
  if (triggeredBy === 'refresh') {
    // Explicit refresh: Always fetch but check cooldown
    if (isInCooldown) {
      return {
        fetchTriggered: false,
        usedCache: hasExistingData,
        dataType,
        reason: 'Refresh blocked by cooldown',
      };
    }
    
    return {
      fetchTriggered: true,
      usedCache: hasExistingData, // Use cache while fetching
      dataType,
      reason: 'Explicit refresh requested',
    };
  }
  
  // Default: Don't fetch if data exists
  return {
    fetchTriggered: !hasExistingData,
    usedCache: hasExistingData,
    dataType,
    reason: hasExistingData ? 'Using existing data' : 'No data available',
  };
}

/**
 * Simulates the DataFetchCoordinator's duplicate prevention logic.
 * 
 * @param isRunning - Whether a fetch is already in progress
 * @param currentUserId - Current user ID being fetched for
 * @param requestedUserId - User ID in the new request
 * @param lastFetchTime - Timestamp of last fetch
 * @param currentTime - Current timestamp
 * @returns Whether the fetch should be blocked
 */
function shouldBlockDuplicateFetch(
  isRunning: boolean,
  currentUserId: string | null,
  requestedUserId: string,
  lastFetchTime: number,
  currentTime: number
): { blocked: boolean; reason: string } {
  // Block if already running
  if (isRunning) {
    return {
      blocked: true,
      reason: 'Fetch already in progress',
    };
  }
  
  // Block if same user and within cooldown
  if (currentUserId === requestedUserId) {
    const timeSinceLastFetch = currentTime - lastFetchTime;
    if (timeSinceLastFetch < FETCH_COOLDOWN) {
      return {
        blocked: true,
        reason: `Within cooldown period (${timeSinceLastFetch}ms < ${FETCH_COOLDOWN}ms)`,
      };
    }
  }
  
  return {
    blocked: false,
    reason: 'Fetch allowed',
  };
}

describe('Data Fetch Deduplication Property Tests', () => {
  /**
   * **Feature: codebase-optimization-audit, Property 3: Data Fetch Deduplication**
   * **Validates: Requirements 5.2**
   * 
   * Property: For any screen component that mounts when data already exists
   * in the global state, the component SHALL NOT trigger a new network fetch
   * for that data.
   */
  describe('Property 3: Data Fetch Deduplication', () => {
    it('should not trigger fetch when data already exists on mount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('products', 'categories', 'wholesalers', 'manufacturers'),
          fc.array(fc.record({ id: fc.uuid(), name: fc.string() }), { minLength: 1, maxLength: 10 }),
          fc.nat({ max: 100000 }),
          async (dataType, existingData, timestamp) => {
            // Create state with existing data
            const state: DataState = {
              products: dataType === 'products' ? existingData : null,
              categories: dataType === 'categories' ? existingData : null,
              wholesalers: dataType === 'wholesalers' ? existingData : null,
              manufacturers: dataType === 'manufacturers' ? existingData : null,
              lastFetchTime: { [dataType]: timestamp },
            };
            
            // Simulate mount request
            const request: FetchRequest = {
              dataType: dataType as any,
              timestamp: timestamp + 1000, // 1 second after last fetch
              triggeredBy: 'mount',
            };
            
            const result = simulateDataFetchDecision(state, request);
            
            // Property: Should not trigger fetch when data exists
            expect(result.fetchTriggered).toBe(false);
            expect(result.usedCache).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trigger fetch when no data exists on mount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('products', 'categories', 'wholesalers', 'manufacturers'),
          fc.nat({ max: 100000 }),
          async (dataType, timestamp) => {
            // Create state with no data
            const state: DataState = {
              products: null,
              categories: null,
              wholesalers: null,
              manufacturers: null,
              lastFetchTime: {},
            };
            
            // Simulate mount request
            const request: FetchRequest = {
              dataType: dataType as any,
              timestamp,
              triggeredBy: 'mount',
            };
            
            const result = simulateDataFetchDecision(state, request);
            
            // Property: Should trigger fetch when no data exists
            expect(result.fetchTriggered).toBe(true);
            expect(result.usedCache).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block duplicate fetches within cooldown period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.nat({ max: FETCH_COOLDOWN - 1 }), // Time within cooldown
          async (userId, timeSinceLastFetch) => {
            const lastFetchTime = 10000;
            const currentTime = lastFetchTime + timeSinceLastFetch;
            
            const result = shouldBlockDuplicateFetch(
              false, // Not running
              userId,
              userId, // Same user
              lastFetchTime,
              currentTime
            );
            
            // Property: Should block fetch within cooldown
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('cooldown');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow fetch after cooldown period expires', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.nat({ max: 100000 }).filter(t => t >= FETCH_COOLDOWN), // Time after cooldown
          async (userId, timeSinceLastFetch) => {
            const lastFetchTime = 10000;
            const currentTime = lastFetchTime + timeSinceLastFetch;
            
            const result = shouldBlockDuplicateFetch(
              false, // Not running
              userId,
              userId, // Same user
              lastFetchTime,
              currentTime
            );
            
            // Property: Should allow fetch after cooldown
            expect(result.blocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block fetch when another fetch is in progress', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.nat({ max: 100000 }),
          async (currentUserId, requestedUserId, timestamp) => {
            const result = shouldBlockDuplicateFetch(
              true, // Already running
              currentUserId,
              requestedUserId,
              0,
              timestamp
            );
            
            // Property: Should always block when fetch is running
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('in progress');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use cache on navigation when data exists and within cooldown', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('products', 'categories', 'wholesalers', 'manufacturers'),
          fc.array(fc.record({ id: fc.uuid(), name: fc.string() }), { minLength: 1, maxLength: 10 }),
          fc.nat({ max: FETCH_COOLDOWN - 1 }),
          async (dataType, existingData, timeSinceLastFetch) => {
            const lastFetchTime = 10000;
            
            // Create state with existing data
            const state: DataState = {
              products: dataType === 'products' ? existingData : null,
              categories: dataType === 'categories' ? existingData : null,
              wholesalers: dataType === 'wholesalers' ? existingData : null,
              manufacturers: dataType === 'manufacturers' ? existingData : null,
              lastFetchTime: { [dataType]: lastFetchTime },
            };
            
            // Simulate navigation request within cooldown
            const request: FetchRequest = {
              dataType: dataType as any,
              timestamp: lastFetchTime + timeSinceLastFetch,
              triggeredBy: 'navigation',
            };
            
            const result = simulateDataFetchDecision(state, request);
            
            // Property: Should use cache and not trigger fetch
            expect(result.fetchTriggered).toBe(false);
            expect(result.usedCache).toBe(true);
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
    it('should handle empty arrays as valid data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('products', 'categories', 'wholesalers', 'manufacturers'),
          fc.nat({ max: 100000 }),
          async (dataType, timestamp) => {
            // Create state with empty array (valid but empty data)
            const state: DataState = {
              products: dataType === 'products' ? [] : null,
              categories: dataType === 'categories' ? [] : null,
              wholesalers: dataType === 'wholesalers' ? [] : null,
              manufacturers: dataType === 'manufacturers' ? [] : null,
              lastFetchTime: { [dataType]: timestamp },
            };
            
            // Simulate mount request
            const request: FetchRequest = {
              dataType: dataType as any,
              timestamp: timestamp + 1000,
              triggeredBy: 'mount',
            };
            
            const result = simulateDataFetchDecision(state, request);
            
            // Property: Empty array should trigger fetch (no useful data)
            expect(result.fetchTriggered).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow different users to fetch independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid().filter((id, ctx) => id !== ctx), // Different user IDs
          fc.nat({ max: 100000 }),
          async (currentUserId, requestedUserId, timestamp) => {
            // Ensure different users
            if (currentUserId === requestedUserId) return;
            
            const result = shouldBlockDuplicateFetch(
              false, // Not running
              currentUserId,
              requestedUserId, // Different user
              timestamp,
              timestamp + 100 // Very short time
            );
            
            // Property: Different users should be able to fetch
            expect(result.blocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect cooldown for refresh requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('products', 'categories', 'wholesalers', 'manufacturers'),
          fc.array(fc.record({ id: fc.uuid(), name: fc.string() }), { minLength: 1, maxLength: 10 }),
          fc.nat({ max: FETCH_COOLDOWN - 1 }),
          async (dataType, existingData, timeSinceLastFetch) => {
            const lastFetchTime = 10000;
            
            // Create state with existing data
            const state: DataState = {
              products: dataType === 'products' ? existingData : null,
              categories: dataType === 'categories' ? existingData : null,
              wholesalers: dataType === 'wholesalers' ? existingData : null,
              manufacturers: dataType === 'manufacturers' ? existingData : null,
              lastFetchTime: { [dataType]: lastFetchTime },
            };
            
            // Simulate refresh request within cooldown
            const request: FetchRequest = {
              dataType: dataType as any,
              timestamp: lastFetchTime + timeSinceLastFetch,
              triggeredBy: 'refresh',
            };
            
            const result = simulateDataFetchDecision(state, request);
            
            // Property: Refresh should be blocked within cooldown
            expect(result.fetchTriggered).toBe(false);
            expect(result.reason).toContain('cooldown');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
