/**
 * @deprecated This service is deprecated and will be removed in a future version.
 * Use SimpleAuthLoader instead for auth initialization.
 * 
 * Migration guide:
 * - Replace AuthStateManager.initializeAuth() with SimpleAuthLoader.checkCachedAuth()
 * - Replace AuthStateManager.clearAllCachedAuth() with SimpleAuthLoader.clearCachedAuth()
 * - Replace AuthStateManager.saveCachedAuthData() with SimpleAuthLoader.cacheAuthData()
 * - Background validation is now handled by SimpleAuthLoader.validateSessionInBackground()
 * 
 * Reason for deprecation:
 * The complex multi-layered auth system with mutex locks, state machines, and multiple
 * competing services caused race conditions and app hangs on first launch. SimpleAuthLoader
 * provides a simpler, linear approach that trusts the cache and validates in background.
 * 
 * Original description:
 * AuthStateManager - Single entry point for auth initialization
 * 
 * Implements:
 * - Mutex lock to prevent concurrent auth checks
 * - State machine for auth flow: initializing → checking_cache → refreshing_session → loading_profile → complete
 * - Coordinated auth state management to prevent race conditions
 * 
 * Requirements: 1.1, 1.7
 * 
 * @see SimpleAuthLoader for the replacement implementation
 */

import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/supabase';
import { ProfileLoader } from './profileLoader';
import { Profile } from '../../types/auth';

// Auth flow states
export type AuthFlowState = 
  | 'idle'
  | 'initializing'
  | 'checking_cache'
  | 'refreshing_session'
  | 'loading_profile'
  | 'complete'
  | 'error';

// Auth result interface
export interface AuthResult {
  success: boolean;
  navigateTo: 'home' | 'login' | 'onboarding';
  user?: Profile;
  session?: Session;
  error?: string;
  source: 'cache' | 'network' | 'none';
}

// Auth state interface
export interface AuthState {
  isAuthenticated: boolean;
  user: Profile | null;
  session: Session | null;
  source: 'cache' | 'network' | 'none';
  needsRefresh: boolean;
}

// Cached auth data interface
interface CachedAuthData {
  authVerified: boolean;
  userId: string | null;
  profileId: string | null;
  userPhone: string | null;
  userRole: string | null;
}

// Session refresh result
interface SessionRefreshResult {
  success: boolean;
  session: Session | null;
  error?: string;
  tokenExpired?: boolean;
}

// State change listener type
type StateChangeListener = (state: AuthFlowState) => void;

/**
 * AuthStateManager class - Singleton for managing auth state
 */
class AuthStateManagerClass {
  // Mutex lock for preventing concurrent auth checks
  private _isLocked: boolean = false;
  private _lockPromise: Promise<void> | null = null;
  private _lockResolve: (() => void) | null = null;
  
  // Current auth flow state
  private _currentState: AuthFlowState = 'idle';
  
  // State change listeners
  private _stateListeners: Set<StateChangeListener> = new Set();
  
  // Initialization tracking
  private _isInitialized: boolean = false;
  private _initializationPromise: Promise<AuthResult> | null = null;
  
  // Constants
  private readonly SESSION_REFRESH_TIMEOUT = 10000; // 10 seconds
  private readonly PROFILE_LOAD_TIMEOUT = 8000; // 8 seconds
  private readonly MAX_RETRIES = 3;
  private readonly BACKGROUND_REFRESH_DELAY = 100; // 100ms

  /**
   * Get current auth flow state
   */
  get currentState(): AuthFlowState {
    return this._currentState;
  }

  /**
   * Check if auth is currently locked
   */
  get isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * Check if auth has been initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(listener: StateChangeListener): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  /**
   * Update current state and notify listeners
   */
  private setState(newState: AuthFlowState): void {
    const previousState = this._currentState;
    this._currentState = newState;
    console.log(`AuthStateManager: State transition ${previousState} → ${newState}`);
    
    // Notify all listeners
    this._stateListeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        console.error('AuthStateManager: Error in state listener:', error);
      }
    });
  }

  /**
   * Acquire mutex lock for auth operations
   * Returns true if lock was acquired, false if already locked
   */
  async acquireAuthLock(): Promise<boolean> {
    if (this._isLocked) {
      console.log('AuthStateManager: Lock already held, waiting...');
      // Wait for existing lock to be released
      if (this._lockPromise) {
        await this._lockPromise;
      }
      return false;
    }

    this._isLocked = true;
    this._lockPromise = new Promise<void>((resolve) => {
      this._lockResolve = resolve;
    });
    console.log('AuthStateManager: Lock acquired');
    return true;
  }

  /**
   * Release mutex lock
   */
  releaseAuthLock(): void {
    if (this._isLocked) {
      this._isLocked = false;
      if (this._lockResolve) {
        this._lockResolve();
        this._lockResolve = null;
      }
      this._lockPromise = null;
      console.log('AuthStateManager: Lock released');
    }
  }

  /**
   * Wait for any existing auth operation to complete
   */
  async waitForLock(): Promise<void> {
    if (this._lockPromise) {
      await this._lockPromise;
    }
  }

  /**
   * Get cached auth data from AsyncStorage
   */
  async getCachedAuthData(): Promise<CachedAuthData> {
    try {
      const [authVerified, userId, profileId, userPhone, userRole] = await Promise.all([
        AsyncStorage.getItem('auth_verified'),
        AsyncStorage.getItem('user_id'),
        AsyncStorage.getItem('profile_id'),
        AsyncStorage.getItem('user_phone'),
        AsyncStorage.getItem('user_role')
      ]);

      return {
        authVerified: authVerified === 'true',
        userId,
        profileId,
        userPhone,
        userRole
      };
    } catch (error) {
      console.error('AuthStateManager: Error reading cached auth data:', error);
      return {
        authVerified: false,
        userId: null,
        profileId: null,
        userPhone: null,
        userRole: null
      };
    }
  }

  /**
   * Clear all cached auth data
   */
  async clearAllCachedAuth(): Promise<void> {
    console.log('AuthStateManager: Clearing all cached auth data');
    try {
      await Promise.all([
        AsyncStorage.removeItem('auth_verified'),
        AsyncStorage.removeItem('user_id'),
        AsyncStorage.removeItem('profile_id'),
        AsyncStorage.removeItem('user_phone'),
        AsyncStorage.removeItem('user_role')
      ]);
      
      // Also clear profile cache
      await ProfileLoader.clearAllCaches();
      
      console.log('AuthStateManager: All cached auth data cleared');
    } catch (error) {
      console.error('AuthStateManager: Error clearing cached auth data:', error);
      throw error;
    }
  }

  /**
   * Save auth data to cache
   */
  async saveCachedAuthData(profile: Profile): Promise<void> {
    try {
      const operations = [
        AsyncStorage.setItem('auth_verified', 'true'),
        AsyncStorage.setItem('user_id', profile.id),
        AsyncStorage.setItem('profile_id', profile.id)
      ];

      if (profile.phone_number) {
        operations.push(AsyncStorage.setItem('user_phone', profile.phone_number));
      }
      if (profile.role) {
        operations.push(AsyncStorage.setItem('user_role', profile.role));
      }

      await Promise.all(operations);
      console.log('AuthStateManager: Auth data saved to cache');
    } catch (error) {
      console.error('AuthStateManager: Error saving auth data to cache:', error);
    }
  }

  /**
   * Refresh Supabase session
   * This MUST be called before any profile fetch operations
   */
  async refreshSession(): Promise<SessionRefreshResult> {
    console.log('AuthStateManager: Refreshing session...');
    
    try {
      // First try to get existing session
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Session refresh timeout')), this.SESSION_REFRESH_TIMEOUT)
      );

      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) {
        // Check for invalid/expired refresh token
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('invalid_grant')) {
          console.log('AuthStateManager: Refresh token is invalid or expired');
          return {
            success: false,
            session: null,
            error: error.message,
            tokenExpired: true
          };
        }
        
        console.error('AuthStateManager: Session refresh error:', error.message);
        return {
          success: false,
          session: null,
          error: error.message,
          tokenExpired: false
        };
      }

      if (data.session) {
        console.log('AuthStateManager: Session refreshed successfully');
        return {
          success: true,
          session: data.session,
          tokenExpired: false
        };
      }

      // No session found - try explicit refresh
      console.log('AuthStateManager: No session found, attempting explicit refresh');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        if (refreshError.message?.includes('Invalid Refresh Token') || 
            refreshError.message?.includes('Refresh Token Not Found') ||
            refreshError.message?.includes('invalid_grant')) {
          return {
            success: false,
            session: null,
            error: refreshError.message,
            tokenExpired: true
          };
        }
        
        return {
          success: false,
          session: null,
          error: refreshError.message,
          tokenExpired: false
        };
      }

      return {
        success: !!refreshData.session,
        session: refreshData.session,
        tokenExpired: false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('AuthStateManager: Exception during session refresh:', errorMessage);
      
      return {
        success: false,
        session: null,
        error: errorMessage,
        tokenExpired: errorMessage.includes('Invalid Refresh Token') || 
                      errorMessage.includes('Refresh Token Not Found')
      };
    }
  }

  /**
   * Load profile with cache-first strategy
   */
  async loadProfile(userId: string, useCache: boolean = true): Promise<Profile | null> {
    console.log(`AuthStateManager: Loading profile for user ${userId}, useCache=${useCache}`);
    
    try {
      const result = await ProfileLoader.loadProfile({
        userId,
        timeout: this.PROFILE_LOAD_TIMEOUT,
        maxRetries: this.MAX_RETRIES,
        useCache
      });

      if (result.profile) {
        console.log(`AuthStateManager: Profile loaded (fromCache=${result.fromCache}, loadTime=${result.loadTime}ms)`);
        return result.profile;
      }

      console.log('AuthStateManager: Profile not found');
      return null;
    } catch (error) {
      console.error('AuthStateManager: Error loading profile:', error);
      return null;
    }
  }

  /**
   * Trigger background refresh of profile data
   * Does not block UI or navigation
   */
  triggerBackgroundRefresh(userId: string): void {
    console.log('AuthStateManager: Triggering background refresh');
    
    // Use setTimeout to ensure this doesn't block
    setTimeout(async () => {
      try {
        const result = await ProfileLoader.loadProfile({
          userId,
          timeout: this.PROFILE_LOAD_TIMEOUT,
          maxRetries: 1,
          useCache: false // Force network fetch
        });
        
        if (result.profile) {
          console.log('AuthStateManager: Background refresh completed successfully');
        } else {
          console.log('AuthStateManager: Background refresh returned no profile');
        }
      } catch (error) {
        console.log('AuthStateManager: Background refresh failed:', error);
      }
    }, this.BACKGROUND_REFRESH_DELAY);
  }

  /**
   * Get current auth state without triggering initialization
   */
  async getAuthState(): Promise<AuthState> {
    const cachedData = await this.getCachedAuthData();
    
    if (!cachedData.authVerified || !cachedData.userId) {
      return {
        isAuthenticated: false,
        user: null,
        session: null,
        source: 'none',
        needsRefresh: false
      };
    }

    // Try to load cached profile
    const profile = await this.loadProfile(cachedData.userId, true);
    
    // Check session status
    const { data } = await supabase.auth.getSession();
    
    return {
      isAuthenticated: !!profile,
      user: profile,
      session: data.session,
      source: profile ? 'cache' : 'none',
      needsRefresh: !data.session && !!profile
    };
  }

  /**
   * Main entry point for auth initialization
   * Implements the full auth flow state machine
   */
  async initializeAuth(): Promise<AuthResult> {
    // If already initializing, return the existing promise
    if (this._initializationPromise && this._currentState !== 'complete' && this._currentState !== 'error') {
      console.log('AuthStateManager: Initialization already in progress, returning existing promise');
      return this._initializationPromise;
    }

    // If already initialized and complete, return cached result
    if (this._isInitialized && this._currentState === 'complete') {
      console.log('AuthStateManager: Already initialized, getting current state');
      const state = await this.getAuthState();
      return {
        success: state.isAuthenticated,
        navigateTo: state.isAuthenticated ? 'home' : 'login',
        user: state.user || undefined,
        session: state.session || undefined,
        source: state.source
      };
    }

    // Create new initialization promise
    this._initializationPromise = this._performInitialization();
    return this._initializationPromise;
  }

  /**
   * Internal initialization implementation
   */
  private async _performInitialization(): Promise<AuthResult> {
    // Acquire lock to prevent concurrent auth checks
    const lockAcquired = await this.acquireAuthLock();
    
    if (!lockAcquired) {
      // Another initialization is in progress, wait for it
      await this.waitForLock();
      
      // Return current state after lock is released
      const state = await this.getAuthState();
      return {
        success: state.isAuthenticated,
        navigateTo: state.isAuthenticated ? 'home' : 'login',
        user: state.user || undefined,
        session: state.session || undefined,
        source: state.source
      };
    }

    try {
      // State: initializing
      this.setState('initializing');
      console.log('AuthStateManager: Starting auth initialization');

      // State: checking_cache
      this.setState('checking_cache');
      const cachedData = await this.getCachedAuthData();
      
      if (!cachedData.authVerified || !cachedData.userId) {
        console.log('AuthStateManager: No cached auth data found');
        this.setState('complete');
        this._isInitialized = true;
        return {
          success: false,
          navigateTo: 'login',
          source: 'none'
        };
      }

      console.log('AuthStateManager: Found cached auth data for user:', cachedData.userId);

      // Try to load cached profile immediately for fast UI
      const cachedProfile = await this.loadProfile(cachedData.userId, true);
      
      // State: refreshing_session
      this.setState('refreshing_session');
      const sessionResult = await this.refreshSession();

      // Handle expired/invalid refresh token
      if (sessionResult.tokenExpired) {
        console.log('AuthStateManager: Refresh token expired, clearing all auth data');
        await this.clearAllCachedAuth();
        this.setState('complete');
        this._isInitialized = true;
        return {
          success: false,
          navigateTo: 'login',
          error: 'Session expired. Please log in again.',
          source: 'none'
        };
      }

      // State: loading_profile
      this.setState('loading_profile');

      // If we have a valid session, load fresh profile
      if (sessionResult.success && sessionResult.session) {
        console.log('AuthStateManager: Session valid, loading fresh profile');
        const freshProfile = await this.loadProfile(sessionResult.session.user.id, false);
        
        if (freshProfile) {
          await this.saveCachedAuthData(freshProfile);
          this.setState('complete');
          this._isInitialized = true;
          return {
            success: true,
            navigateTo: 'home',
            user: freshProfile,
            session: sessionResult.session,
            source: 'network'
          };
        }
      }

      // If session refresh failed but we have cached profile, use it
      if (cachedProfile) {
        console.log('AuthStateManager: Using cached profile (session refresh failed or no session)');
        
        // Trigger background refresh
        this.triggerBackgroundRefresh(cachedData.userId);
        
        this.setState('complete');
        this._isInitialized = true;
        return {
          success: true,
          navigateTo: 'home',
          user: cachedProfile,
          session: sessionResult.session || undefined,
          source: 'cache'
        };
      }

      // No profile available
      console.log('AuthStateManager: No profile available, clearing auth');
      await this.clearAllCachedAuth();
      this.setState('complete');
      this._isInitialized = true;
      return {
        success: false,
        navigateTo: 'login',
        source: 'none'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('AuthStateManager: Initialization error:', errorMessage);
      
      this.setState('error');
      this._isInitialized = true;
      
      // Try to use cached profile as fallback
      const cachedData = await this.getCachedAuthData();
      if (cachedData.userId) {
        const cachedProfile = await this.loadProfile(cachedData.userId, true);
        if (cachedProfile) {
          return {
            success: true,
            navigateTo: 'home',
            user: cachedProfile,
            source: 'cache',
            error: errorMessage
          };
        }
      }

      return {
        success: false,
        navigateTo: 'login',
        error: errorMessage,
        source: 'none'
      };
    } finally {
      this.releaseAuthLock();
    }
  }

  /**
   * Reset the manager state (useful for testing or logout)
   */
  reset(): void {
    this._isInitialized = false;
    this._initializationPromise = null;
    this._currentState = 'idle';
    this.releaseAuthLock();
    console.log('AuthStateManager: Reset complete');
  }
}

/**
 * @deprecated Use SimpleAuthLoader instead. This singleton will be removed in a future version.
 * @see SimpleAuthLoader
 */
export const AuthStateManager = new AuthStateManagerClass();

/**
 * @deprecated Use SimpleAuthLoader instead. This class will be removed in a future version.
 * @see SimpleAuthLoader
 */
export { AuthStateManagerClass };
