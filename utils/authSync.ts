/**
 * @deprecated This module is deprecated and will be removed in a future version.
 * Use SimpleAuthLoader instead for auth state management.
 * 
 * Migration guide:
 * - setUserAndWait() is no longer needed - SimpleAuthLoader.checkCachedAuth() handles this
 * - verifyUserLoaded() is no longer needed - profile is available synchronously from auth store
 * - waitForAuthState() is no longer needed - SimpleAuthLoader uses cache-first approach
 * - enqueueAuthUpdate() is no longer needed - SimpleAuthLoader handles sequential updates
 * 
 * Reason for deprecation:
 * The new SimpleAuthLoader uses a simpler cache-first approach where:
 * 1. Cached auth data is loaded synchronously before navigation
 * 2. Profile is available in auth store before home screen mounts
 * 3. Background validation happens after navigation, not blocking UI
 * 
 * Original description:
 * Auth Synchronization Utilities
 * 
 * Provides utilities to ensure auth state updates complete before navigation,
 * eliminating race conditions between state propagation and navigation.
 * 
 * **Feature: fix-home-loading-state**
 * **Validates: Requirements 3.1, 3.2**
 * 
 * @see SimpleAuthLoader for the replacement implementation
 */

import { useAuthStore } from '../store/auth';
import { Profile } from '../types/auth';
import { Session } from '@supabase/supabase-js';

/**
 * Configuration for auth sync operations
 */
interface AuthSyncConfig {
  /** Default timeout for waiting operations (ms) */
  defaultTimeout: number;
  /** Polling interval for state checks (ms) */
  pollInterval: number;
}

const DEFAULT_CONFIG: AuthSyncConfig = {
  defaultTimeout: 5000,
  pollInterval: 50,
};

/**
 * Error thrown when auth state wait times out
 */
export class AuthSyncTimeoutError extends Error {
  constructor(message: string = 'Auth state wait timed out') {
    super(message);
    this.name = 'AuthSyncTimeoutError';
  }
}

/**
 * @deprecated Use SimpleAuthLoader.checkCachedAuth() instead.
 * With the new cache-first approach, waiting for auth state is no longer needed.
 * 
 * Waits for the auth store state to satisfy a given predicate.
 * Polls the auth store at regular intervals until the predicate returns true
 * or the timeout is reached.
 * 
 * @param predicate - Function that receives current auth state and returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 5000ms)
 * @returns Promise that resolves to true when predicate is satisfied, false on timeout
 * 
 * @example
 * // Wait for user to be loaded
 * const userLoaded = await waitForAuthState(() => useAuthStore.getState().user !== null);
 * 
 * @example
 * // Wait for specific user ID
 * const userReady = await waitForAuthState(
 *   () => useAuthStore.getState().user?.id === expectedUserId,
 *   3000
 * );
 */
export async function waitForAuthState(
  predicate: () => boolean,
  timeout: number = DEFAULT_CONFIG.defaultTimeout
): Promise<boolean> {
  const startTime = Date.now();
  
  // Check immediately first
  if (predicate()) {
    return true;
  }
  
  return new Promise<boolean>((resolve) => {
    const checkState = () => {
      // Check if predicate is satisfied
      if (predicate()) {
        resolve(true);
        return;
      }
      
      // Check if timeout exceeded
      if (Date.now() - startTime >= timeout) {
        console.warn(`[AuthSync] waitForAuthState timed out after ${timeout}ms`);
        resolve(false);
        return;
      }
      
      // Schedule next check
      setTimeout(checkState, DEFAULT_CONFIG.pollInterval);
    };
    
    // Start polling
    setTimeout(checkState, DEFAULT_CONFIG.pollInterval);
  });
}

/**
 * @deprecated Use SimpleAuthLoader.checkCachedAuth() instead.
 * The new approach loads profile from cache before navigation, eliminating the need
 * to wait for state propagation.
 * 
 * Sets user and session in the auth store and waits for the state to propagate.
 * This ensures that the state update is complete before any subsequent navigation.
 * 
 * @param user - The user profile to set (or null to clear)
 * @param session - The session to set (or null to clear)
 * @param timeout - Maximum time to wait for propagation (default: 5000ms)
 * @returns Promise that resolves when state is confirmed set, rejects on timeout
 * 
 * @example
 * // Set user and wait before navigating
 * await setUserAndWait(profile, session);
 * router.replace('/(main)');
 * 
 * **Validates: Requirements 3.1, 3.2**
 */
export async function setUserAndWait(
  user: Profile | null,
  session: Session | { user: { id: string } } | null,
  timeout: number = DEFAULT_CONFIG.defaultTimeout
): Promise<void> {
  const expectedUserId = user?.id ?? null;
  
  console.log(`[AuthSync] setUserAndWait called - userId: ${expectedUserId}`);
  
  // Set the state synchronously
  useAuthStore.setState({
    user,
    session: session as Session | null,
    loading: false,
  });
  
  // Wait for state to propagate
  const stateSet = await waitForAuthState(() => {
    const state = useAuthStore.getState();
    
    // If we're setting null, verify it's null
    if (expectedUserId === null) {
      return state.user === null;
    }
    
    // Otherwise verify the user ID matches
    return state.user?.id === expectedUserId;
  }, timeout);
  
  if (!stateSet) {
    throw new AuthSyncTimeoutError(
      `Failed to confirm auth state update for user ${expectedUserId} within ${timeout}ms`
    );
  }
  
  console.log(`[AuthSync] State confirmed for user: ${expectedUserId}`);
}

/**
 * @deprecated Use useAuthStore.getState().user instead.
 * With SimpleAuthLoader, the profile is available synchronously in the auth store
 * before home screen components mount.
 * 
 * Verifies that the auth store has a valid user before proceeding.
 * Useful as a guard before navigation to ensure user is loaded.
 * 
 * @param timeout - Maximum time to wait (default: 5000ms)
 * @returns Promise that resolves to the user if available, null if timeout
 * 
 * @example
 * const user = await verifyUserLoaded();
 * if (user) {
 *   router.replace('/(main)');
 * } else {
 *   // Handle timeout - show error or retry
 * }
 */
export async function verifyUserLoaded(
  timeout: number = DEFAULT_CONFIG.defaultTimeout
): Promise<Profile | null> {
  const userLoaded = await waitForAuthState(
    () => useAuthStore.getState().user !== null,
    timeout
  );
  
  if (userLoaded) {
    return useAuthStore.getState().user;
  }
  
  return null;
}

/**
 * Creates a subscription to auth state changes with automatic cleanup.
 * Returns a function to unsubscribe.
 * 
 * @param callback - Function called when user state changes
 * @returns Unsubscribe function
 * 
 * @example
 * const unsubscribe = subscribeToAuthChanges((user) => {
 *   if (user) {
 *     setIsLoading(false);
 *   }
 * });
 * 
 * // Later, cleanup
 * unsubscribe();
 */
export function subscribeToAuthChanges(
  callback: (user: Profile | null) => void
): () => void {
  let previousUser: Profile | null = useAuthStore.getState().user;
  
  return useAuthStore.subscribe((state) => {
    const currentUser = state.user;
    // Only call callback if user actually changed
    if (currentUser !== previousUser) {
      previousUser = currentUser;
      callback(currentUser);
    }
  });
}

/**
 * Queue for sequential auth state processing.
 * Ensures auth state updates are processed in order without race conditions.
 * 
 * **Validates: Requirements 3.4**
 */
class AuthStateQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  
  /**
   * Enqueues an auth state update operation.
   * Operations are processed sequentially in FIFO order.
   * 
   * @param operation - Async function to execute
   * @returns Promise that resolves when the operation completes
   */
  async enqueue(operation: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await operation();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('[AuthSync] Queue operation failed:', error);
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Returns the current queue length (for testing)
   */
  get length(): number {
    return this.queue.length;
  }
  
  /**
   * Returns whether the queue is currently processing (for testing)
   */
  get isProcessing(): boolean {
    return this.processing;
  }
  
  /**
   * Clears the queue (for testing/cleanup)
   */
  clear(): void {
    this.queue = [];
    this.processing = false;
  }
}

// Singleton instance for global auth state queue
export const authStateQueue = new AuthStateQueue();

/**
 * @deprecated Use SimpleAuthLoader.cacheAuthData() instead.
 * The new approach uses a simpler sequential flow without queuing.
 * 
 * Enqueues a user state update to be processed sequentially.
 * This ensures multiple rapid auth state changes don't cause race conditions.
 * 
 * @param user - The user profile to set
 * @param session - The session to set
 * @returns Promise that resolves when the update is complete
 * 
 * **Validates: Requirements 3.4**
 */
export async function enqueueAuthUpdate(
  user: Profile | null,
  session: Session | { user: { id: string } } | null
): Promise<void> {
  return authStateQueue.enqueue(async () => {
    await setUserAndWait(user, session);
  });
}
