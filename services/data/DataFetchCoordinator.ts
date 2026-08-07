/**
 * DataFetchCoordinator - Central service for orchestrating data fetches
 * 
 * Implements Requirements 1.1, 2.1, 2.2, 2.4, 2.5:
 * - Trigger data fetching when profile loads from any source
 * - Coordinate parallel fetches for home screen components (categories, sellers)
 * - Prevent duplicate coordinator invocations
 * - Cancel all in-progress fetches on logout
 * 
 * This service listens to auth store changes and automatically triggers
 * parallel data fetches for categories, wholesalers, and manufacturers
 * whenever a user profile becomes available.
 * 
 * Note: Products are NOT fetched here - they are loaded on-demand by individual
 * components (ProductCarousel, etc.) to avoid slow "all products" queries.
 */

import { Profile } from '../../types/auth';
// Note: ProductsDataService import removed - products are loaded on-demand by components
import { CategoriesDataService } from './CategoriesDataService';
import { SellersDataService } from './SellersDataService';

// Lazy import to break circular dependency with auth store
// The auth store imports DataFetchCoordinator, so we can't import it at module level
let _useAuthStore: any = null;
const getAuthStore = () => {
  if (!_useAuthStore) {
    // Dynamic import at runtime breaks the cycle
    _useAuthStore = require('../../store/auth').useAuthStore;
  }
  return _useAuthStore;
};

/**
 * Configuration for the DataFetchCoordinator
 */
export interface DataFetchCoordinatorConfig {
  enableParallelFetch: boolean;
  fetchTimeout: number;
  maxRetries: number;
  enableCaching: boolean;
  enableLogging: boolean;
}

/**
 * Result of a single data fetch operation
 */
export interface DataFetchResult {
  success: boolean;
  dataType: 'products' | 'categories' | 'wholesalers' | 'manufacturers';
  fromCache: boolean;
  fetchTime: number;
  error?: string;
}

/**
 * Internal state of the coordinator
 */
interface CoordinatorState {
  isRunning: boolean;
  currentUserId: string | null;
  lastFetchTime: number;
  activeFetches: Map<string, AbortController>;
  fetchResults: Map<string, DataFetchResult>;
}

/**
 * DataFetchCoordinator - Singleton service for coordinating data fetches
 */
class DataFetchCoordinatorClass {
  private static instance: DataFetchCoordinatorClass;
  
  private config: DataFetchCoordinatorConfig = {
    enableParallelFetch: true,
    fetchTimeout: 30000, // 30 seconds
    maxRetries: 3,
    enableCaching: true,
    enableLogging: true,
  };

  private state: CoordinatorState = {
    isRunning: false,
    currentUserId: null,
    lastFetchTime: 0,
    activeFetches: new Map(),
    fetchResults: new Map(),
  };

  private unsubscribe: (() => void) | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(): DataFetchCoordinatorClass {
    if (!DataFetchCoordinatorClass.instance) {
      DataFetchCoordinatorClass.instance = new DataFetchCoordinatorClass();
    }
    return DataFetchCoordinatorClass.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.log('DataFetchCoordinator instance created');
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[DataFetchCoordinator] ${message}`, ...args);
    }
  }

  /**
   * Initialize the coordinator and subscribe to auth store changes
   * 
   * This should be called once when the app starts.
   * It sets up a subscription to the auth store and triggers data fetches
   * whenever the user state changes from null to a valid user.
   */
  public initialize(): void {
    if (this.unsubscribe) {
      this.log('Already initialized, skipping');
      return;
    }

    this.log('Initializing DataFetchCoordinator');

    // Subscribe to auth store changes
    // Note: Zustand subscribe takes a single callback that receives the full state
    let previousUser: Profile | null = null;
    const authStore = getAuthStore();
    
    this.unsubscribe = authStore.subscribe((state: any) => {
      const user = state.user;
      
      // Only trigger if user changed from null to a valid user
      // or if user ID changed (different user logged in)
      if (user && (!previousUser || previousUser.id !== user.id)) {
        this.log('User state changed, triggering data fetch', {
          userId: user.id,
          previousUserId: previousUser?.id,
        });

        // Trigger data fetch with a small delay to ensure auth state is fully settled
        setTimeout(() => {
          this.triggerDataFetch(user.id, user.latitude, user.longitude);
        }, 100); // 100ms delay as per design spec
      } else if (!user && previousUser) {
        this.log('User logged out, cancelling all fetches');
        this.cancelAllFetches();
        this.resetState();
      }
      
      // Update previous user for next comparison
      previousUser = user;
    });

    this.log('DataFetchCoordinator initialized successfully');
  }

  /**
   * Trigger parallel data fetches for all home screen components
   * 
   * This method:
   * 1. Checks if a fetch is already running (prevents duplicates)
   * 2. Initiates parallel fetches for products, categories, wholesalers, manufacturers
   * 3. Returns immediately with cached data if available
   * 4. Fetches fresh data in background
   * 
   * @param userId - User ID to fetch data for
   * @param userLatitude - Optional user latitude for nearby sellers
   * @param userLongitude - Optional user longitude for nearby sellers
   * @returns Promise that resolves with fetch results
   */
  public async triggerDataFetch(
    userId: string,
    userLatitude?: number,
    userLongitude?: number
  ): Promise<DataFetchResult[]> {
    // Prevent duplicate invocations
    if (this.state.isRunning) {
      this.log('[EVENT:DUPLICATE_PREVENTED] Fetch already running, skipping duplicate invocation', {
        currentUserId: this.state.currentUserId,
        requestedUserId: userId,
        activeFetches: Array.from(this.state.activeFetches.keys()),
      });
      return Array.from(this.state.fetchResults.values());
    }

    // Check if we recently fetched for this user (cooldown period)
    const now = Date.now();
    const timeSinceLastFetch = now - this.state.lastFetchTime;
    const cooldownPeriod = 5000; // 5 seconds

    if (
      this.state.currentUserId === userId &&
      timeSinceLastFetch < cooldownPeriod
    ) {
      this.log(
        `[EVENT:COOLDOWN_ACTIVE] Fetch cooldown active, skipping`, {
          timeSinceLastFetch: `${timeSinceLastFetch}ms`,
          cooldownPeriod: `${cooldownPeriod}ms`,
          remainingCooldown: `${cooldownPeriod - timeSinceLastFetch}ms`,
          userId,
        }
      );
      return Array.from(this.state.fetchResults.values());
    }

    // Mark as running
    this.state.isRunning = true;
    this.state.currentUserId = userId;
    this.state.lastFetchTime = now;
    this.state.fetchResults.clear();

    this.log('[EVENT:TRIGGER] Starting parallel data fetch', {
      userId,
      hasLocation: !!(userLatitude && userLongitude),
      location: userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : null,
      timestamp: new Date(now).toISOString(),
    });

    const startTime = Date.now();

    // Prepare fetch options
    const userLocation =
      userLatitude && userLongitude
        ? { latitude: userLatitude, longitude: userLongitude }
        : undefined;

    // Create abort controllers for each fetch
    // Note: Products fetch is skipped - loaded on-demand by components
    const categoriesController = new AbortController();
    const wholesalersController = new AbortController();
    const manufacturersController = new AbortController();

    this.state.activeFetches.set('categories', categoriesController);
    this.state.activeFetches.set('wholesalers', wholesalersController);
    this.state.activeFetches.set('manufacturers', manufacturersController);

    // Create fetch promises with individual error handling
    const fetchPromises: Promise<DataFetchResult>[] = [];

    // Skip products fetch from DataFetchCoordinator
    // Products are fetched on-demand by individual components (ProductCarousel, etc.)
    // This prevents the 30s timeout from blocking home screen loading
    // The generic "all products" query without filters is too slow for initial load
    this.log('[FETCH:SKIP] Skipping products fetch - loaded on-demand by components');

    // Fetch categories
    fetchPromises.push(
      this.fetchWithTimeout(
        'categories',
        async () => {
          const fetchStart = Date.now();
          const result = await CategoriesDataService.fetchCategories({
            limit: 20,
            showProductCount: false,
            useCache: this.config.enableCaching,
          });
          const fetchTime = Date.now() - fetchStart;

          return {
            success: !result.error,
            dataType: 'categories' as const,
            fromCache: result.fromCache,
            fetchTime,
            error: result.error,
          };
        },
        categoriesController
      )
    );

    // Fetch wholesalers (only if location available)
    if (userLocation) {
      fetchPromises.push(
        this.fetchWithTimeout(
          'wholesalers',
          async () => {
            const fetchStart = Date.now();
            const result = await SellersDataService.fetchNearbySellers({
              userId,
              userLocation,
              radiusKm: 50,
              sellerType: 'wholesaler',
              useCache: this.config.enableCaching,
            });
            const fetchTime = Date.now() - fetchStart;

            return {
              success: !result.error,
              dataType: 'wholesalers' as const,
              fromCache: result.fromCache,
              fetchTime,
              error: result.error,
            };
          },
          wholesalersController
        )
      );

      // Fetch manufacturers
      fetchPromises.push(
        this.fetchWithTimeout(
          'manufacturers',
          async () => {
            const fetchStart = Date.now();
            const result = await SellersDataService.fetchNearbySellers({
              userId,
              userLocation,
              radiusKm: 50,
              sellerType: 'manufacturer',
              useCache: this.config.enableCaching,
            });
            const fetchTime = Date.now() - fetchStart;

            return {
              success: !result.error,
              dataType: 'manufacturers' as const,
              fromCache: result.fromCache,
              fetchTime,
              error: result.error,
            };
          },
          manufacturersController
        )
      );
    } else {
      this.log('User location not available, skipping sellers fetch');
    }

    // Execute all fetches in parallel
    const results = await Promise.all(fetchPromises);

    // Store results
    results.forEach((result) => {
      this.state.fetchResults.set(result.dataType, result);
    });

    // Clean up abort controllers
    this.state.activeFetches.clear();

    // Mark as not running
    this.state.isRunning = false;

    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const cacheHits = results.filter(r => r.fromCache).length;
    const failures = results.filter(r => !r.success);

    this.log(`[EVENT:COMPLETE] Parallel data fetch completed`, {
      totalTime: `${totalTime}ms`,
      totalFetches: results.length,
      successful: successCount,
      failed: failures.length,
      cacheHits,
      networkFetches: results.length - cacheHits,
      results: results.map((r) => ({
        type: r.dataType,
        success: r.success,
        source: r.fromCache ? 'cache' : 'network',
        time: `${r.fetchTime}ms`,
        error: r.error || null,
      })),
    });

    // Log failures separately for visibility
    if (failures.length > 0) {
      this.log('[EVENT:FAILURES] Some fetches failed', {
        failedFetches: failures.map(f => ({
          type: f.dataType,
          error: f.error,
        })),
      });
    }

    return results;
  }

  /**
   * Fetch with timeout wrapper
   * 
   * Wraps a fetch function with timeout and error handling
   */
  private async fetchWithTimeout(
    dataType: string,
    fetchFn: () => Promise<DataFetchResult>,
    controller: AbortController
  ): Promise<DataFetchResult> {
    const fetchStartTime = Date.now();
    
    try {
      this.log(`[FETCH:START] Starting ${dataType} fetch`, {
        timeout: `${this.config.fetchTimeout}ms`,
      });

      // Create timeout promise
      const timeoutPromise = new Promise<DataFetchResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Fetch timeout for ${dataType}`));
        }, this.config.fetchTimeout);
      });

      // Race between fetch and timeout
      const result = await Promise.race([fetchFn(), timeoutPromise]);

      const totalFetchTime = Date.now() - fetchStartTime;

      this.log(`[FETCH:SUCCESS] ${dataType} fetch completed`, {
        success: result.success,
        source: result.fromCache ? 'cache' : 'network',
        fetchTime: `${result.fetchTime}ms`,
        totalTime: `${totalFetchTime}ms`,
        error: result.error || null,
      });

      return result;
    } catch (error) {
      const totalFetchTime = Date.now() - fetchStartTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.log(`[FETCH:ERROR] ${dataType} fetch failed`, {
        error: errorMessage,
        totalTime: `${totalFetchTime}ms`,
        isTimeout: errorMessage.includes('timeout'),
        isAborted: errorMessage.includes('abort'),
      });

      return {
        success: false,
        dataType: dataType as any,
        fromCache: false,
        fetchTime: totalFetchTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancel all in-progress fetches
   * 
   * This is called when the user logs out or when we need to
   * stop all ongoing fetch operations.
   */
  public cancelAllFetches(): void {
    const activeFetchTypes = Array.from(this.state.activeFetches.keys());
    
    this.log('[EVENT:CANCEL] Cancelling all in-progress fetches', {
      activeFetches: activeFetchTypes,
      count: activeFetchTypes.length,
    });

    // Abort all active fetches
    this.state.activeFetches.forEach((controller, dataType) => {
      this.log(`[FETCH:ABORT] Aborting ${dataType} fetch`);
      controller.abort();
    });

    // Clear active fetches
    this.state.activeFetches.clear();

    // Mark as not running
    this.state.isRunning = false;

    this.log('[EVENT:CANCEL_COMPLETE] All fetches cancelled', {
      cancelledCount: activeFetchTypes.length,
    });
  }

  /**
   * Reset coordinator state
   * 
   * Called on logout to clear all state
   */
  private resetState(): void {
    this.state.isRunning = false;
    this.state.currentUserId = null;
    this.state.lastFetchTime = 0;
    this.state.activeFetches.clear();
    this.state.fetchResults.clear();

    this.log('Coordinator state reset');
  }

  /**
   * Clean up subscriptions
   * 
   * This should be called when the app is shutting down
   * or when you need to stop the coordinator.
   */
  public cleanup(): void {
    this.log('Cleaning up DataFetchCoordinator');

    // Cancel all fetches
    this.cancelAllFetches();

    // Unsubscribe from auth store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Reset state
    this.resetState();

    this.log('DataFetchCoordinator cleaned up');
  }

  /**
   * Update configuration
   * 
   * @param config - Partial configuration to update
   */
  public updateConfig(config: Partial<DataFetchCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Configuration updated:', this.config);
  }

  /**
   * Get current state (for debugging)
   */
  public getState(): Readonly<CoordinatorState> {
    return { ...this.state };
  }

  /**
   * Get current configuration (for debugging)
   */
  public getConfig(): Readonly<DataFetchCoordinatorConfig> {
    return { ...this.config };
  }
}

// Export singleton instance
export const DataFetchCoordinator = DataFetchCoordinatorClass.getInstance();

// Export class for testing
export { DataFetchCoordinatorClass };
