// Supabase-only authentication sync functions
// Replaces Firebase authentication with Supabase auth

import { supabase } from '../supabase/supabase';
import { getCurrentUser, getUserProfile, syncUserProfile } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthResult {
  success: boolean;
  error?: string;
  user?: any;
  profile?: any;
}

/**
 * Handle Supabase authentication (replaces handleFirebaseAuth)
 * @param user - Supabase user object
 */
export const handleSupabaseAuth = async (user: any): Promise<AuthResult> => {
  try {
    if (!user || !user.id) {
      return {
        success: false,
        error: 'No valid user provided'
      };
    }

    console.log('Handling Supabase auth for user:', user.id);

    // Get or create user profile
    let profile = await getUserProfile(user.id);
    
    if (!profile && user.phone) {
      // Create profile if it doesn't exist
      profile = await syncUserProfile(user.id, user.phone, 'retailer');
    }

    if (!profile) {
      return {
        success: false,
        error: 'Failed to create or retrieve user profile'
      };
    }

    // Store auth information
    await AsyncStorage.setItem('auth_verified', 'true');
    await AsyncStorage.setItem('user_id', user.id);
    if (user.phone) {
      await AsyncStorage.setItem('user_phone', user.phone);
    }

    return {
      success: true,
      user,
      profile
    };
  } catch (error) {
    console.error('Error handling Supabase auth:', error);
    return {
      success: false,
      error: error.message || 'Authentication failed'
    };
  }
};

/**
 * Create Supabase session (replaces createSupabaseSessionFromFirebase)
 * @param user - Supabase user object
 */
export const createSupabaseSession = async (user: any): Promise<AuthResult> => {
  try {
    if (!user) {
      return {
        success: false,
        error: 'No user provided'
      };
    }

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting Supabase session:', error);
      return {
        success: false,
        error: 'Failed to get session'
      };
    }

    if (!session) {
      return {
        success: false,
        error: 'No active session'
      };
    }

    return {
      success: true,
      user: session.user
    };
  } catch (error) {
    console.error('Error creating Supabase session:', error);
    return {
      success: false,
      error: error.message || 'Session creation failed'
    };
  }
};

/**
 * Force authentication sync (replaces forceAuthSync)
 */
export const forceAuthSync = async (): Promise<boolean> => {
  try {
    console.log('Forcing auth sync...');
    
    // Get current Supabase user
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }

    // Handle authentication
    const authResult = await handleSupabaseAuth(user);
    
    if (!authResult.success) {
      console.error('Auth sync failed:', authResult.error);
      return false;
    }

    console.log('Auth sync completed successfully');
    return true;
  } catch (error) {
    console.error('Error in force auth sync:', error);
    return false;
  }
};

/**
 * Force profile sync (replaces forceProfileSync)
 * @param user - Supabase user object
 */
export const forceProfileSync = async (user?: any): Promise<AuthResult> => {
  try {
    console.log('Forcing profile sync...');
    
    // Use provided user or get current user
    const currentUser = user || await getCurrentUser();
    
    if (!currentUser) {
      return {
        success: false,
        error: 'No authenticated user found'
      };
    }

    // Get user profile
    let profile = await getUserProfile(currentUser.id);
    
    if (!profile) {
      // Try to create profile if phone number is available
      const phone = currentUser.phone || await AsyncStorage.getItem('user_phone');
      const role = await AsyncStorage.getItem('user_role') || 'retailer';
      
      if (phone) {
        profile = await syncUserProfile(currentUser.id, phone, role);
      }
    }

    if (!profile) {
      return {
        success: false,
        error: 'Failed to sync user profile'
      };
    }

    return {
      success: true,
      user: currentUser,
      profile
    };
  } catch (error) {
    console.error('Error in force profile sync:', error);
    return {
      success: false,
      error: error.message || 'Profile sync failed'
    };
  }
};

// Legacy function names for backward compatibility
export const handleFirebaseAuth = handleSupabaseAuth;
export const createSupabaseSessionFromFirebase = createSupabaseSession;

export default {
  handleSupabaseAuth,
  handleFirebaseAuth,
  createSupabaseSession,
  createSupabaseSessionFromFirebase,
  forceAuthSync,
  forceProfileSync
};