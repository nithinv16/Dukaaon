# Design Document

## Overview

This design document outlines the solution for fixing the stale cache data fetching issue in the DukaaOn mobile app. The core problem is that when the profile loads from stale cache, the dependent data components (products, categories, wholesalers, manufacturers) do not automatically fetch their data, leaving users stuck in a loading state until they restart the app.

The solution introduces a **Data Fetch Coordinator** service that listens to auth store changes and automatically triggers parallel data fetches whenever a user profile becomes available, regardless of whether it came from cache or database.

## Architecture

### Current Architecture Issues

1. **ProfileLoader** loads profile from cache/database but doesn't notify dependent components
2. **Auth Store** updates user state but no mechanism triggers data fetches
3. **Home Components** (DynamicHomeSections, NearbyWholesalers, etc.) wait for user prop but don't actively fetch when stale cache is used
4. **No coordination** between profile loading and data fetching - they operate independently

### Proposed Architecture

```
┌─────────────────┐
│  ProfileLoader  │
│  (loads profile)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────────┐
│   Auth Store    │─────▶│ Data Fetch Coordinator│
│ (user state)    │      │  (orchestrates data)  │
└─────────────────┘      └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  Products    │ │  Categories  │ │  Sellers     │
            │  Service     │ │  Service     │ │  Service     │
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────────────────────────────────┐
            │      Component-Level Caches              │
            │  (AsyncStorage for instant display)      │
            └──────────────────────────────────────────┘
```

### Key Components

1. **Data Fetch Coordinator**: Central service that orchestrates all data fetching
2. **Component-Level Cache Services**: Individual cache managers for each data type
3. **Auth Store Subscription**: Listener that triggers coordinator when user state changes
4. **Parallel Fetch Manager**: Handles concurrent data fetching without blocking

## Components and Interfaces

### 1. DataFetchCoordinator Service

```typescript
interface DataFetchCoordinatorConfig {
  enableParallelFetch: boolean;
  fetchTimeout: number;
  maxRetries: number;
  enableCaching: boolean;
}

interface DataFetchResult {
  success: boolean;
  dataType: 'products' | 'categories' | 'wholesalers' | 'manufacturers';
  fromCache: boolean;
  fetchTime: number;
  error?: string;
}

class DataFetchCoordinator {
  private isRunning: boolean = false;
  private currentUserId: string | null = null;
  private unsubscribe: (() => void) | null = null;
  
  /**
   * Initialize the coordinator and subscribe to auth store changes
   */
  initialize(): void;
  
  /**
   * Trigger parallel data fetches for all home screen components
   * Returns immediately with cached data, fetches fresh data in background
   */
  async triggerDataFetch(userId: string): Promise<DataFetchResult[]>;
  
  /**
   * Cancel all in-progress fetches
   */
  cancelAllFetches(): void;
  
  /**
   * Clean up subscriptions
   */
  cleanup(): void;
}
```

### 2. Component-Level Cache Services

Each data type (products, categories, sellers) gets its own cache service:

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiryTime: number;
}

interface CacheOptions {
  key: string;
  ttl: number; // Time to live in milliseconds
  staleThreshold: number; // When to trigger background refresh
}

class ComponentCacheService<T> {
  /**
   * Load data from cache with stale-while-revalidate pattern
   */
  async loadFromCache(key: string): Promise<CacheEntry<T> | null>;
  
  /**
   * Save data to cache with expiry
   */
  async saveToCache(key: string, data: T, ttl: number): Promise<void>;
  
  /**
   * Check if cache is stale (needs background refresh)
   */
  isStale(entry: CacheEntry<T>): boolean;
  
  /**
   * Check if cache is expired (must fetch)
   */
  isExpired(entry: CacheEntry<T>): boolean;
  
  /**
   * Clear cache for specific key
   */
  async clearCache(key: string): Promise<void>;
}
```

### 3. Data Fetching Services

Individual services for each data type:

```typescript
// Products Service
interface ProductsFetchOptions {
  userId: string;
  filter?: 'trending' | 'personalized' | 'all';
  limit?: number;
  useCache?: boolean;
}

class ProductsDataService {
  async fetchProducts(options: ProductsFetchOptions): Promise<Product[]>;
  async getCachedProducts(userId: string): Promise<Product[] | null>;
}

// Categories Service
interface CategoriesFetchOptions {
  limit?: number;
  showProductCount?: boolean;
  useCache?: boolean;
}

class CategoriesDataService {
  async fetchCategories(options: CategoriesFetchOptions): Promise<Category[]>;
  async getCachedCategories(): Promise<Category[] | null>;
}

// Sellers Service
interface SellersFetchOptions {
  userId: string;
  userLocation?: { latitude: number; longitude: number };
  radiusKm?: number;
  sellerType: 'wholesaler' | 'manufacturer';
  useCache?: boolean;
}

class SellersDataService {
  async fetchNearbySellers(options: SellersFetchOptions): Promise<Seller[]>;
  async getCachedSellers(userId: string, sellerType: string): Promise<Seller[] | null>;
}
```

### 4. Auth Store Integration

Modify the existing auth store to trigger the coordinator:

```typescript
// In store/auth.ts
import { DataFetchCoordinator } from '../services/data/DataFetchCoordinator';

export const useAuthStore = create<AuthState>((set, get) => ({
  // ... existing state ...
  
  setUser: (user: Profile | null) => {
    set({ user });
    
    // Trigger data fetch coordinator when user becomes available
    if (user?.id) {
      console.log('[AuthStore] User set, triggering data fetch coordinator');
      DataFetchCoordinator.getInstance().triggerDataFetch(user.id);
    }
  },
  
  // ... rest of store ...
}));

// Initialize coordinator on app start
DataFetchCoordinator.getInstance().initialize();
```

## Data Models

### Cache Entry Structure

```typescript
interface HomeSectionsCacheEntry {
  sections: HomeSection[];
  timestamp: number;
  expiryTime: number;
  userId: string;
}

interface ProductsCacheEntry {
  products: Product[];
  filter: string;
  timestamp: number;
  expiryTime: number;
  userId: string;
}

interface CategoriesCacheEntry {
  categories: Category[];
  timestamp: number;
  expiryTime: number;
}

interface SellersCacheEntry {
  sellers: Seller[];
  sellerType: 'wholesaler' | 'manufacturer';
  location: { latitude: number; longitude: number };
  timestamp: number;
  expiryTime: number;
  userId: string;
}
```

### Coordinator State

```typescript
interface CoordinatorState {
  isRunning: boolean;
  currentUserId: string | null;
  lastFetchTime: number;
  activeFetches: Map<string, AbortController>;
  fetchResults: Map<string, DataFetchResult>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Profile load triggers data fetch

*For any* user profile load (from cache or database), the Data Fetch Coordinator should be triggered within 100ms of the user state being set in the auth store.

**Validates: Requirements 1.1, 1.2**

### Property 2: Parallel fetch coordination

*For any* data fetch coordinator invocation, all data types (products, categories, wholesalers, manufacturers) should be fetched in parallel, not sequentially.

**Validates: Requirements 2.2**

### Property 3: No duplicate coordinator invocations

*For any* time window where the coordinator is already running, subsequent invocations should be ignored until the current run completes.

**Validates: Requirements 2.4**

### Property 4: Component cache availability

*For any* component data type, if cached data exists and is not expired, it should be returned immediately before triggering a background fetch.

**Validates: Requirements 3.1, 3.2**

### Property 5: Cache update after fetch

*For any* successful data fetch, the corresponding component-level cache should be updated with the fresh data and a new expiry timestamp.

**Validates: Requirements 3.5**

### Property 6: Stale cache detection

*For any* cached data that exceeds the stale threshold but not the expiry time, the system should serve the stale data immediately and trigger a background refresh.

**Validates: Requirements 2.1, 2.2**

### Property 7: Network failure graceful degradation

*For any* data fetch that fails due to network error, the system should continue displaying cached data without showing error states to the user.

**Validates: Requirements 5.1, 5.2**

### Property 8: Coordinator cleanup on logout

*For any* user logout event, all in-progress data fetches should be cancelled and the coordinator state should be reset.

**Validates: Requirements 2.5**

## Error Handling

### 1. Network Errors

- **Strategy**: Graceful degradation with cached data
- **Implementation**: Catch network errors, log them, continue with cached data
- **User Experience**: No error messages, seamless use of cached content

### 2. Cache Read/Write Errors

- **Strategy**: Continue without cache, fetch from database
- **Implementation**: Try-catch around AsyncStorage operations
- **User Experience**: Slightly slower load, but no visible errors

### 3. Database Query Errors

- **Strategy**: Retry with exponential backoff, fall back to cache
- **Implementation**: Retry up to 3 times with 1s, 2s, 4s delays
- **User Experience**: Loading states with eventual fallback to cached data

### 4. Coordinator Race Conditions

- **Strategy**: Use flags and locks to prevent duplicate runs
- **Implementation**: `isRunning` flag, abort controllers for cancellation
- **User Experience**: Consistent, predictable data loading

### 5. Component Mount/Unmount During Fetch

- **Strategy**: Use abort controllers and cleanup functions
- **Implementation**: Cancel fetches on component unmount
- **User Experience**: No memory leaks, clean state management

## Testing Strategy

### Unit Tests

1. **DataFetchCoordinator Tests**
   - Test initialization and cleanup
   - Test single invocation behavior
   - Test duplicate invocation prevention
   - Test cancellation of in-progress fetches

2. **ComponentCacheService Tests**
   - Test cache save and load operations
   - Test stale detection logic
   - Test expiry detection logic
   - Test cache clearing

3. **Data Service Tests**
   - Test fetch with cache enabled/disabled
   - Test error handling and retries
   - Test data transformation and validation

### Property-Based Tests

The property-based tests will use **fast-check** library for React Native/TypeScript. Each test will run a minimum of 100 iterations.

1. **Property 1 Test: Profile load triggers data fetch**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 1: Profile load triggers data fetch
   // Test that coordinator is triggered within 100ms of user state change
   ```

2. **Property 2 Test: Parallel fetch coordination**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 2: Parallel fetch coordination
   // Test that all data types are fetched concurrently
   ```

3. **Property 3 Test: No duplicate coordinator invocations**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 3: No duplicate coordinator invocations
   // Test that rapid invocations are deduplicated
   ```

4. **Property 4 Test: Component cache availability**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 4: Component cache availability
   // Test that cached data is returned before fetch
   ```

5. **Property 5 Test: Cache update after fetch**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 5: Cache update after fetch
   // Test that cache is updated with fresh data
   ```

6. **Property 6 Test: Stale cache detection**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 6: Stale cache detection
   // Test stale-while-revalidate pattern
   ```

7. **Property 7 Test: Network failure graceful degradation**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 7: Network failure graceful degradation
   // Test that network errors don't break the UI
   ```

8. **Property 8 Test: Coordinator cleanup on logout**
   ```typescript
   // Feature: fix-stale-cache-data-fetch, Property 8: Coordinator cleanup on logout
   // Test that logout cancels all fetches
   ```

### Integration Tests

1. **End-to-End Profile Load Flow**
   - Test complete flow from profile load to data display
   - Verify all components receive data
   - Verify loading states are handled correctly

2. **Stale Cache Scenario**
   - Simulate stale cache condition
   - Verify immediate display of stale data
   - Verify background refresh occurs
   - Verify UI updates with fresh data

3. **Network Offline Scenario**
   - Simulate offline condition
   - Verify cached data is used
   - Verify no error messages shown
   - Verify retry on network restoration

## Implementation Notes

### Performance Considerations

1. **Parallel Fetching**: Use `Promise.all()` with individual error handling to fetch all data types simultaneously
2. **Cache First**: Always check cache before network to minimize latency
3. **Background Refresh**: Use non-blocking background refreshes to avoid UI freezes
4. **Abort Controllers**: Cancel unnecessary fetches to save bandwidth and battery

### Cache Strategy

- **TTL**: 5 minutes for most data, 24 hours for profile
- **Stale Threshold**: 1 minute - trigger background refresh after this
- **Storage**: AsyncStorage for persistence across app restarts
- **Keys**: Namespaced by user ID to prevent cross-user data leaks

### Logging Strategy

- **Coordinator Events**: Log all trigger, start, complete, cancel events
- **Cache Operations**: Log cache hits, misses, staleness, expiry
- **Fetch Results**: Log success/failure, timing, data source (cache vs network)
- **Errors**: Log all errors with context for debugging

### Migration Path

1. **Phase 1**: Implement DataFetchCoordinator and ComponentCacheService
2. **Phase 2**: Integrate with auth store and ProfileLoader
3. **Phase 3**: Update individual data services to use caching
4. **Phase 4**: Update components to use cached data
5. **Phase 5**: Add logging and monitoring
6. **Phase 6**: Test and validate with property-based tests

## Dependencies

- **@react-native-async-storage/async-storage**: For persistent caching
- **zustand**: For state management (already in use)
- **fast-check**: For property-based testing
- **@supabase/supabase-js**: For database queries (already in use)

## Security Considerations

1. **User Data Isolation**: Cache keys include user ID to prevent data leaks
2. **Cache Clearing on Logout**: All cached data is cleared when user logs out
3. **No Sensitive Data in Cache**: Only display data is cached, no auth tokens
4. **Cache Encryption**: Consider encrypting sensitive cached data (future enhancement)
