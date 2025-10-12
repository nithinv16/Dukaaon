/**
 * Utilities for managing authentication flags
 * This ensures consistent handling of auth state across the app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Router } from 'expo-router';

// Keys used for storing authentication data
const AUTH_KEYS = {
  VERIFIED: 'auth_verified',
  PHONE: 'user_phone',
  ROLE: 'user_role',
  PROFILE_ID: 'user_profile_id'
};

/**
 * Set all authentication flags at once
 */
export const setAuthFlags = async (params: {
  phone?: string;
  role?: string;
  profileId?: string;
  verified?: boolean;
}): Promise<void> => {
  try {
    const batch = [];
    
    if (params.verified !== undefined) {
      batch.push(AsyncStorage.setItem(AUTH_KEYS.VERIFIED, params.verified ? 'true' : 'false'));
    }
    
    if (params.phone) {
      batch.push(AsyncStorage.setItem(AUTH_KEYS.PHONE, params.phone));
    }
    
    if (params.role) {
      batch.push(AsyncStorage.setItem(AUTH_KEYS.ROLE, params.role));
    }
    
    if (params.profileId) {
      batch.push(AsyncStorage.setItem(AUTH_KEYS.PROFILE_ID, params.profileId));
    }
    
    await Promise.all(batch);
    console.log('Auth flags set successfully');
  } catch (error) {
    console.error('Error setting auth flags:', error);
  }
};

/**
 * Clear all authentication flags
 */
export const clearAuthFlags = async (): Promise<void> => {
  try {
    const keys = Object.values(AUTH_KEYS);
    await AsyncStorage.multiRemove(keys);
    console.log('Auth flags cleared successfully');
  } catch (error) {
    console.error('Error clearing auth flags:', error);
  }
};

/**
 * Get all authentication flags at once
 */
export const getAuthFlags = async (): Promise<{
  verified: boolean;
  phone: string | null;
  role: string | null;
  profileId: string | null;
}> => {
  try {
    const [verified, phone, role, profileId] = await Promise.all([
      AsyncStorage.getItem(AUTH_KEYS.VERIFIED),
      AsyncStorage.getItem(AUTH_KEYS.PHONE),
      AsyncStorage.getItem(AUTH_KEYS.ROLE),
      AsyncStorage.getItem(AUTH_KEYS.PROFILE_ID)
    ]);
    
    return {
      verified: verified === 'true',
      phone,
      role,
      profileId
    };
  } catch (error) {
    console.error('Error getting auth flags:', error);
    return {
      verified: false,
      phone: null,
      role: null,
      profileId: null
    };
  }
};

/**
 * Navigate to the appropriate screen based on authentication state
 * This provides consistent navigation logic throughout the app
 */
export const navigateAfterAuth = (router: Router, force?: boolean): void => {
  // Default behavior is to navigate to home
  console.log('Navigating after auth', force ? '(forced)' : '');
  
  // Use replace to avoid navigation stack issues - navigate specifically to home index
  router.replace('/(main)/home/');
};

/**
 * Mark authentication as verified and navigate
 */
export const completeAuthentication = async (
  router: Router, 
  params: { 
    phone?: string; 
    role?: string; 
    profileId?: string;
  }
): Promise<void> => {
  try {
    console.log('Completing authentication with params:', params);
    
    // Set all flags including verified=true
    await setAuthFlags({
      ...params,
      verified: true
    });
    
    // Force any pending updates to persist
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Auth flags set, attempting navigation to home screen');
    
    // First try to navigate with replace (recommended way) - navigate specifically to home index
    try {
      router.replace('/(main)/home/');
    } catch (navError) {
      console.error('Replace navigation failed, trying direct navigation:', navError);
      
      // If replace fails, try direct navigation
      try {
        // Add a slight delay to allow the router to recover
        setTimeout(() => {
          router.navigate('/(main)/home/');
        }, 300);
      } catch (directNavError) {
        console.error('Direct navigation also failed:', directNavError);
        
        // As a last resort, try reset
        try {
          router.reset({
            routes: [{ name: '/(main)/home/' }],
          });
        } catch (resetError) {
          console.error('All navigation methods failed:', resetError);
        }
      }
    }
  } catch (error) {
    console.error('Error completing authentication:', error);
  }
};