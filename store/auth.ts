/**
 * Simplified Auth Store
 * 
 * This store manages authentication state with a simple, linear approach.
 * Complex initialization logic has been moved to SimpleAuthLoader.
 * 
 * Key principles:
 * 1. Simple state management - just setters and getters
 * 2. Cache updates via SimpleAuthLoader.cacheAuthData
 * 3. No complex initialization or background validation here
 * 
 * Requirements: 4.1, 4.4, 2.3
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase/supabase';
import { AuthState, Profile } from '../types/auth';
import { SimpleAuthLoader } from '../services/auth/SimpleAuthLoader';
import { LoggingService } from '../services/logging';

// Create scoped logger for AuthStore
const logger = LoggingService.createScope('AuthStore');

// Simplified AuthState interface - removed debugging methods
interface SimplifiedAuthState extends AuthState {
  // Core state setters
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;

  // Session management
  setSession: (session: any) => Promise<void>;
  clearAuth: () => Promise<void>;

  // Profile creation (kept for backward compatibility)
  createProfileDirectly: (phoneNumber: string, role?: string) => Promise<Profile | null>;
}

export const useAuthStore = create<SimplifiedAuthState>((set, get) => ({
  session: null,
  user: null,
  loading: true,
  role: null,

  /**
   * Set user profile directly
   * Used by SimpleAuthLoader after loading from cache
   */
  setUser: (user: Profile | null) => {
    logger.debug('setUser called', { userId: user?.id, hasUser: !!user });
    set({ user });
  },

  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => {
    logger.debug('setLoading called', { loading });
    set({ loading });
  },

  /**
   * Set session and cache auth data
   * 
   * Requirements: 2.3
   * - Caches profile data when session is set
   * - Uses SimpleAuthLoader.cacheAuthData for consistency
   * - Handles new users who don't have a profile yet
   */
  setSession: async (session) => {
    try {
      if (!session?.user) {
        logger.debug('setSession called with null session');
        set({ session: null, user: null, loading: false });
        await SimpleAuthLoader.clearCachedAuth();
        return;
      }

      logger.debug('setSession called', { userId: session.user.id });

      // Fetch profile from database
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
          latitude,
          longitude,
          seller_details:seller_details(*)
        `)
        .eq('id', session.user.id)
        .single();

      if (error) {
        // PGRST116 means no rows found - this is expected for new users
        if (error.code === 'PGRST116') {
          logger.debug('No profile found for user - this is expected for new users', { userId: session.user.id });

          // For new users, create a minimal profile object from session data
          // This allows the app to continue and redirect to KYC screens
          // The actual profile creation happens in otp.tsx after OTP verification
          const minimalProfile: Profile = {
            id: session.user.id,
            phone_number: session.user.phone || '',
            role: 'retailer', // Will be updated after profile is created
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            business_details: {}
          };

          // Try to get the role from AsyncStorage if available
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const savedRole = await AsyncStorage.getItem('user_role');
            if (savedRole) {
              minimalProfile.role = savedRole as 'retailer' | 'seller' | 'wholesaler' | 'manufacturer';
              logger.debug('Using saved role from AsyncStorage', { role: savedRole });
            }
          } catch (storageError) {
            logger.debug('Could not get role from AsyncStorage', { error: storageError });
          }

          // Update state with minimal profile - allows app to proceed
          set({
            session,
            user: minimalProfile,
            loading: false
          });

          logger.debug('Session set with minimal profile for new user', {
            userId: minimalProfile.id,
            role: minimalProfile.role
          });
          return;
        }

        // For other errors, log and set user to null
        logger.error('Error fetching profile in setSession', { errorCode: error.code, errorMessage: error.message });
        set({ session, user: null, loading: false });
        return;
      }

      if (profile) {
        // Cache auth data using SimpleAuthLoader (Requirements: 2.3)
        await SimpleAuthLoader.cacheAuthData(profile, session);
        logger.debug('Profile cached via SimpleAuthLoader', { userId: profile.id });
      }

      // Update state
      set({
        session,
        user: profile || null,
        loading: false
      });

      logger.debug('Session set successfully', {
        userId: profile?.id,
        role: profile?.role
      });

    } catch (error) {
      logger.error('Error in setSession', error);
      set({ session: null, user: null, loading: false });
    }
  },

  /**
   * Clear all auth state and cached data
   */
  clearAuth: async () => {
    logger.debug('Clearing auth');

    try {
      // Clear the in-memory token cache first
      const { setCachedAccessToken } = require('../services/supabase/supabase');
      setCachedAccessToken(null);
      logger.debug('In-memory token cache cleared');

      await SimpleAuthLoader.clearCachedAuth();
    } catch (error) {
      logger.error('Error clearing cached auth', error);
    }

    set({
      session: null,
      user: null,
      loading: false
    });
  },

  /**
   * Create profile directly (kept for backward compatibility)
   * Used during signup flow
   */
  createProfileDirectly: async (phoneNumber: string, role: string = 'retailer') => {
    try {
      logger.debug('Creating profile directly', { phone: phoneNumber, role });

      // Normalize phone number by removing '+91' prefix if present
      const normalizedPhone = phoneNumber.startsWith('+91')
        ? phoneNumber.substring(3)
        : phoneNumber;

      // First check if profile exists with this phone number
      const { data: existingProfile, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (findError) {
        logger.error('Error finding existing profile', findError);
      }

      // If profile exists, return it
      if (existingProfile) {
        logger.debug('Found existing profile', { id: existingProfile.id });
        set({ user: existingProfile });

        // Cache the profile
        await SimpleAuthLoader.cacheAuthData(existingProfile);

        return existingProfile;
      }

      // Otherwise, create a new profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone_number: normalizedPhone,
          role: role,
          status: 'pending',
          business_details: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        logger.error('Error creating new profile', createError);
        return null;
      }

      logger.debug('Created new profile', { id: newProfile.id });
      set({ user: newProfile });

      // Cache the new profile
      await SimpleAuthLoader.cacheAuthData(newProfile);

      return newProfile;
    } catch (error) {
      logger.error('Exception in createProfileDirectly', error);
      return null;
    }
  },
}));

// Set up logout callback for SimpleAuthLoader background validation
SimpleAuthLoader.setLogoutCallback(() => {
  logger.debug('Logout callback triggered from background validation');
  useAuthStore.getState().clearAuth();
});

// Listen for auth changes with error handling
// CRITICAL: Do NOT use async/await inside onAuthStateChange as it causes deadlocks!
// Use fire-and-forget pattern with .then().catch() instead.
// See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
supabase.auth.onAuthStateChange((event, session) => {
  logger.debug('Auth state changed', { event, hasSession: !!session });

  // Handle different auth events appropriately - ALL MUST BE NON-BLOCKING
  switch (event) {
    case 'TOKEN_REFRESHED':
      // Token refresh is automatic - don't disrupt the UI
      // Just update the session object without fetching profile again
      // The user profile is already loaded from cache by SimpleAuthLoader
      if (session) {
        // Use atomic setState callback to avoid race between getState/setState
        useAuthStore.setState((state) => {
          logger.debug('Token refreshed, keeping current user state', {
            hasCurrentUser: !!state.user,
            userId: state.user?.id
          });
          return { session, loading: false };
        });

        // Silently update cache in background (non-blocking) only if we have a user
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          SimpleAuthLoader.cacheAuthData(currentUser, session).catch(err => {
            logger.debug('Background cache update failed (non-critical)', { error: err });
          });
        }
      }
      break;

    case 'SIGNED_IN':
      // Full session setup only on explicit sign in - fire and forget
      if (session) {
        useAuthStore.getState().setSession(session).catch(err => {
          logger.error('Error setting session on SIGNED_IN', err);
          useAuthStore.setState({ loading: false });
        });
      }
      break;

    case 'SIGNED_OUT':
      logger.debug('User signed out');
      useAuthStore.getState().clearAuth().catch(err => {
        logger.error('Error clearing auth on SIGNED_OUT', err);
        useAuthStore.setState({ loading: false });
      });
      break;

    case 'INITIAL_SESSION':
      // On initial session, check if we already have a user from cache
      if (session) {
        // Use atomic setState callback to read+write atomically
        let needsFullSetup = false;
        useAuthStore.setState((state) => {
          if (state.user?.id === session.user.id) {
            // User already loaded from cache - just update session
            logger.debug('Initial session with cached user, updating session only');
            return { session, loading: false };
          }
          // Different user or no cache — flag for full setup
          needsFullSetup = true;
          return state; // No change yet
        });

        if (needsFullSetup) {
          // No cached user or different user - do full session setup (fire and forget)
          useAuthStore.getState().setSession(session).catch(err => {
            logger.error('Error setting session on INITIAL_SESSION', err);
            useAuthStore.setState({ loading: false });
          });
        }
      } else {
        // No session on initial load - set loading to false so index.tsx can navigate
        logger.debug('No session on initial load, setting loading to false');
        useAuthStore.setState({ loading: false });
      }
      break;

    case 'USER_UPDATED':
      // User profile was updated - refresh the profile (fire and forget)
      if (session) {
        useAuthStore.getState().setSession(session).catch(err => {
          logger.error('Error setting session on USER_UPDATED', err);
          useAuthStore.setState({ loading: false });
        });
      }
      break;

    default:
      // For any other events, do a full session setup if session exists (fire and forget)
      if (session) {
        useAuthStore.getState().setSession(session).catch(err => {
          logger.error('Error setting session on default event', err);
          useAuthStore.setState({ loading: false });
        });
      }
      break;
  }
});
