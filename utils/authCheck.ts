import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth/authService';
import { getCurrentUser } from '../services/auth/authService';

/**
 * Check if user is authenticated via Supabase
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    // Check for Supabase user
    const supabaseUser = await getCurrentUser();
    if (supabaseUser) return true;
    
    // Check for AsyncStorage flags
    const isVerified = await AsyncStorage.getItem('auth_verified');
    if (isVerified === 'true') return true;
    
    return false;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Force sign out from all services
 */
export const forceSignOut = async (): Promise<void> => {
  try {
    await authService.signOut();
    // Clear all auth-related AsyncStorage keys
    const keysToRemove = [
      'auth_verified',
      'user_phone',
      'user_role',
      'user_id',
      'needs_profile_creation',
      'verification_id'
    ];
    
    await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
    console.log('User signed out and storage cleared');
  } catch (error) {
    console.error('Error during force sign out:', error);
    throw error;
  }
};

/**
 * Get current auth status with all related info
 */
export const getAuthStatus = async () => {
  try {
    const supabaseUser = await getCurrentUser();
    const isVerified = await AsyncStorage.getItem('auth_verified');
    const userPhone = await AsyncStorage.getItem('user_phone');
    const userRole = await AsyncStorage.getItem('user_role');
    const needsProfileCreation = await AsyncStorage.getItem('needs_profile_creation');
    
    let profile = null;
    if (supabaseUser) {
      profile = await authService.getUserProfile(supabaseUser.id);
    }
    
    return {
      isAuthenticated: !!supabaseUser || isVerified === 'true',
      supabaseUser,
      isVerified: isVerified === 'true',
      userPhone,
      userRole,
      needsProfileCreation: needsProfileCreation === 'true',
      profile
    };
  } catch (error) {
    console.error('Error getting auth status:', error);
    return {
      isAuthenticated: false,
      supabaseUser: null,
      isVerified: false,
      userPhone: null,
      userRole: null,
      needsProfileCreation: false,
      profile: null
    };
  }
};

export default {
  isAuthenticated,
  forceSignOut,
  getAuthStatus
};