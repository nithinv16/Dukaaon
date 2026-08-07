/**
 * SimpleAuthLoader - Simplified auth loading service
 * 
 * Replaces the complex ProfileLoader, AuthStateManager, and authSync utilities
 * with a simple, linear AsyncStorage-based approach.
 * 
 * Key principles:
 * 1. Trust the cache, validate in background
 * 2. Cache-first navigation - don't wait for network
 * 3. Non-blocking validation - session check happens after navigation
 * 4. Fail-safe fallback - any error leads to language screen
 * 
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.4
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/supabase';
import { Profile } from '../../types/auth';
import { Session } from '@supabase/supabase-js';
import { LoggingService } from '../logging';

// Create scoped logger
const logger = LoggingService.createScope('SimpleAuthLoader');

// AsyncStorage keys
const AUTH_KEYS = {
  AUTH_VERIFIED: 'auth_verified',
  USER_ID: 'user_id',
  USER_PROFILE: 'user_profile',
  SESSION_EXPIRY: 'session_expiry',
} as const;

// Navigation targets
type NavigationTarget = '/(main)' | '/(auth)/language' | '/(auth)/login';

// Result of checking cached auth
export interface CachedAuthResult {
  isAuthenticated: boolean;
  profile: Profile | null;
  navigateTo: NavigationTarget;
}

// Background validation callback type
type LogoutCallback = () => void;

/**
 * SimpleAuthLoader class - Singleton for simplified auth loading
 */
class SimpleAuthLoaderClass {
  // Logout callback for background validation
  private _logoutCallback: LogoutCallback | null = null;

  /**
   * Set the logout callback for background validation failures
   */
  setLogoutCallback(callback: LogoutCallback): void {
    this._logoutCallback = callback;
  }

  /**
   * Check cached auth and return navigation target
   * 
   * This is the main entry point for auth initialization.
   * It reads from AsyncStorage and returns immediately without network calls.
   * 
   * Requirements: 1.1, 1.2, 1.3
   * - Checks AsyncStorage within 100ms
   * - Navigates to main screen immediately if cached auth exists
   * - Navigates to language screen within 500ms if no cached auth
   */
  async checkCachedAuth(): Promise<CachedAuthResult> {
    const startTime = Date.now();
    logger.debug('Checking cached auth');

    try {
      // Read all auth data in parallel for speed
      const [authVerified, userId, profileStr] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEYS.AUTH_VERIFIED),
        AsyncStorage.getItem(AUTH_KEYS.USER_ID),
        AsyncStorage.getItem(AUTH_KEYS.USER_PROFILE),
      ]);

      const checkTime = Date.now() - startTime;
      logger.debug('Cache check completed', { checkTime, hasAuth: authVerified === 'true' });

      // No cached auth - check if language was previously selected
      if (authVerified !== 'true' || !userId) {
        logger.debug('No cached auth found, navigating to language screen');

        // Always navigate to language screen when not authenticated
        // This ensures a consistent onboarding experience
        return {
          isAuthenticated: false,
          profile: null,
          navigateTo: '/(auth)/language',
        };
      }

      // Try to parse cached profile
      let profile: Profile | null = null;
      if (profileStr) {
        try {
          profile = JSON.parse(profileStr);
          logger.debug('Profile loaded from cache', {
            userId: profile?.id,
            role: profile?.role
          });
        } catch (parseError) {
          logger.warn('Failed to parse cached profile', { error: parseError });
          // Continue without profile - we still have auth verified
        }
      }

      // If we have auth but no profile, try legacy cache key
      if (!profile) {
        const legacyCacheKey = `profile_cache_${userId}`;
        const legacyProfileStr = await AsyncStorage.getItem(legacyCacheKey);
        if (legacyProfileStr) {
          try {
            profile = JSON.parse(legacyProfileStr);
            logger.debug('Profile loaded from legacy cache', { userId: profile?.id });
            // Migrate to new cache key
            await AsyncStorage.setItem(AUTH_KEYS.USER_PROFILE, legacyProfileStr);
          } catch (parseError) {
            logger.warn('Failed to parse legacy cached profile');
          }
        }
      }

      // Have cached auth - navigate to main
      return {
        isAuthenticated: true,
        profile,
        navigateTo: '/(main)',
      };

    } catch (error) {
      // AsyncStorage error - treat as no cached auth
      logger.error('Error checking cached auth', error);
      return {
        isAuthenticated: false,
        profile: null,
        navigateTo: '/(auth)/language',
      };
    }
  }

  /**
   * Save auth data to cache
   * 
   * Called after successful login or profile update.
   * 
   * Requirements: 2.3
   * - Updates AsyncStorage within 1 second of change
   */
  async cacheAuthData(profile: Profile, session?: Session): Promise<void> {
    const startTime = Date.now();
    logger.debug('Caching auth data', { userId: profile.id });

    try {
      const operations: Promise<void>[] = [
        AsyncStorage.setItem(AUTH_KEYS.AUTH_VERIFIED, 'true'),
        AsyncStorage.setItem(AUTH_KEYS.USER_ID, profile.id),
        AsyncStorage.setItem(AUTH_KEYS.USER_PROFILE, JSON.stringify(profile)),
      ];

      // Store session expiry if available
      if (session?.expires_at) {
        operations.push(
          AsyncStorage.setItem(AUTH_KEYS.SESSION_EXPIRY, session.expires_at.toString())
        );
      }

      // Also update legacy cache keys for backward compatibility
      operations.push(
        AsyncStorage.setItem('profile_id', profile.id),
        AsyncStorage.setItem(`profile_cache_${profile.id}`, JSON.stringify(profile))
      );

      if (profile.phone_number) {
        operations.push(AsyncStorage.setItem('user_phone', profile.phone_number));
      }
      if (profile.role) {
        operations.push(AsyncStorage.setItem('user_role', profile.role));
      }

      await Promise.all(operations);

      const cacheTime = Date.now() - startTime;
      logger.debug('Auth data cached', { cacheTime });

    } catch (error) {
      logger.error('Error caching auth data', error);
      // Don't throw - caching failure shouldn't break the app
    }
  }

  /**
   * Clear all cached auth data
   * 
   * Called on logout or when session is definitively invalid.
   */
  async clearCachedAuth(): Promise<void> {
    logger.debug('Clearing cached auth');

    try {
      // Get user ID before clearing to clean up profile cache
      const userId = await AsyncStorage.getItem(AUTH_KEYS.USER_ID);

      const keysToRemove = [
        AUTH_KEYS.AUTH_VERIFIED,
        AUTH_KEYS.USER_ID,
        AUTH_KEYS.USER_PROFILE,
        AUTH_KEYS.SESSION_EXPIRY,
        // Legacy keys
        'profile_id',
        'user_phone',
        'user_role',
      ];

      // Add user-specific cache keys
      if (userId) {
        keysToRemove.push(`profile_cache_${userId}`);
        keysToRemove.push(`profile_cache_expiry_${userId}`);
      }

      await AsyncStorage.multiRemove(keysToRemove);
      logger.debug('Cached auth cleared');

    } catch (error) {
      logger.error('Error clearing cached auth', error);
    }
  }

  /**
   * Validate session in background (non-blocking)
   * 
   * This should be called AFTER navigation to main screen.
   * It validates the session and only logs out if the token is definitively invalid.
   * 
   * Requirements: 3.1, 3.2, 3.3
   * - Performs validation after navigation
   * - Only logs out on definitive invalid token (not network errors)
   * - Silently updates session on success
   */
  validateSessionInBackground(): void {
    logger.debug('Starting background session validation');

    // Use setTimeout to ensure this doesn't block
    setTimeout(async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          // Check if this is a definitive invalid token error
          const isInvalidToken = this.isDefinitiveInvalidToken(error.message);

          if (isInvalidToken) {
            logger.warn('Session definitively invalid, logging out', {
              error: error.message
            });
            await this.clearCachedAuth();
            this._logoutCallback?.();
          } else {
            // Network error or transient issue - keep current state
            logger.debug('Session validation failed (non-critical)', {
              error: error.message
            });
          }
          return;
        }

        if (data.session) {
          logger.debug('Background session validation successful');

          // Silently update profile if session is valid
          const userId = data.session.user.id;
          await this.refreshProfileInBackground(userId);
        } else {
          // No session but no error - might be logged out
          // Check if we should clear auth
          const authVerified = await AsyncStorage.getItem(AUTH_KEYS.AUTH_VERIFIED);
          if (authVerified === 'true') {
            logger.debug('No session found but auth was verified, keeping cached state');
            // Don't logout - might be a temporary issue
          }
        }

      } catch (error) {
        // Network or other error - keep current state
        logger.debug('Background validation error (non-critical)', { error });
      }
    }, 100); // Small delay to ensure navigation completes first
  }

  /**
   * Check if an error indicates a definitively invalid token
   * 
   * Requirements: 3.2
   * - Only returns true for definitive invalid token errors
   * - Returns false for network errors or transient issues
   */
  private isDefinitiveInvalidToken(errorMessage: string): boolean {
    const invalidTokenPatterns = [
      'Invalid Refresh Token',
      'Refresh Token Not Found',
      'invalid_grant',
      'Token has expired',
      'JWT expired',
      'Invalid JWT',
    ];

    return invalidTokenPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Refresh profile data in background
   * 
   * Called after successful session validation to update cached profile.
   */
  private async refreshProfileInBackground(userId: string): Promise<void> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          id, 
          phone_number, 
          role, 
          status, 
          created_at, 
          updated_at, 
          business_details,
          seller_details:seller_details(*)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        logger.debug('Background profile refresh failed', { error: error.message });
        return;
      }

      if (profile) {
        logger.debug('Background profile refresh successful');
        await this.cacheAuthData(profile);
      }

    } catch (error) {
      logger.debug('Background profile refresh error', { error });
    }
  }
}

// Export singleton instance
export const SimpleAuthLoader = new SimpleAuthLoaderClass();

// Export class for testing
export { SimpleAuthLoaderClass };
