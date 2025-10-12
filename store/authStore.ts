import { create } from 'zustand';
import { forceProfileSync, forceAuthSync } from '../services/auth/firebaseSupabaseSync';
import { getCurrentUser } from '../services/auth/authService';
import { supabase } from '../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthStore = {
  isLoggedIn: boolean;
  user: any | null;
  loading: boolean;
  error: string | null;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  // New helper methods
  isProfileLoaded: () => boolean;
  retryProfileLoad: () => Promise<boolean>;
  clearError: () => void;
  setError: (error: string) => void;
  cleanupAuthState: () => Promise<void>;
};

const useAuthStore = create<AuthStore>((set, get) => ({
  isLoggedIn: false,
  user: null,
  loading: false,
  error: null,
  
  setUser: (user: any) => {
    set({ user, isLoggedIn: !!user });
  },
  
  logout: async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.multiRemove([
        'user_id',
        'user_phone', 
        'user_role',
        'auth_verified'
      ]);
      set({ user: null, isLoggedIn: false, error: null });
    } catch (error: any) {
      console.error('Logout error:', error);
      set({ error: error.message });
    }
  },
  
  refreshUserData: async () => {
    set({ loading: true });
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        set({ user: currentUser, isLoggedIn: true, loading: false });
      } else {
        set({ user: null, isLoggedIn: false, loading: false });
      }
    } catch (error: any) {
      console.error('Refresh user data error:', error);
      set({ error: error.message, loading: false });
    }
  },
  
  // New helper methods
  isProfileLoaded: () => {
    const user = get().user;
    return user !== null && user !== undefined;
  },
  
  clearError: () => set({ error: null }),
  
  setError: (error: string) => set({ error }),
  
  retryProfileLoad: async () => {
    const currentLoading = get().loading;
    
    if (currentLoading) {
      console.log('Already attempting to load profile, skipping retry');
      return false;
    }
    
    set({ loading: true, error: null });
    try {
      // First try the standard refresh
      await get().refreshUserData();
      
      // Check if we have a profile now
      if (get().user) {
        console.log('Successfully loaded profile through standard refresh');
        return true;
      }
      
      // If we don't have a profile, try force syncing
      console.log('Standard refresh failed, attempting force sync');
      const supabaseUser = await getCurrentUser();
      
      if (!supabaseUser) {
        console.error('No Supabase user available for force sync');
        set({ error: 'You are not signed in. Please log in again.' });
        return false;
      }
      
      // Try the force profile sync function
      const forceSyncResult = await forceProfileSync(supabaseUser);
      
      if (forceSyncResult.success) {
        console.log('Force profile sync succeeded');
        return true;
      }
      
      // Last resort: full auth sync
      console.log('Force profile sync failed, attempting full auth sync');
      const fullSyncResult = await forceAuthSync();
      
      if (fullSyncResult) {
        console.log('Full auth sync succeeded');
        return true;
      }
      
      // All methods failed
      set({ error: 'Unable to load your profile after multiple attempts. Please try logging in again.' });
      return false;
    } catch (error) {
      console.error('Error retrying profile load:', error);
      set({ error: `Error loading profile: ${error.message}` });
      return false;
    } finally {
      set({ loading: false });
    }
  },
  
  cleanupAuthState: async () => {
    console.log('Starting auth state cleanup');
    set({ loading: true, error: null });
    
    try {
      // First check what auth state we have
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      
      console.log('Current state - Supabase user:', !!supabaseUser);
      
      // Clear AsyncStorage auth flags to start fresh
      await AsyncStorage.removeItem('auth_verified');
      await AsyncStorage.removeItem('user_id');
      await AsyncStorage.removeItem('needs_profile_creation');
      
      // Keep phone and role if possible
      const phoneNumber = await AsyncStorage.getItem('user_phone');
      const userRole = await AsyncStorage.getItem('user_role');
      
      console.log('Stored phone:', phoneNumber, 'role:', userRole);
      
      // Sign out from Supabase
      if (supabaseUser) {
        console.log('Signing out from Supabase');
        await supabase.auth.signOut();
      }
      
      // Clear auth store state
      set({ 
        user: null, 
        isLoggedIn: false, 
        error: null 
      });
      
      console.log('Auth state cleanup complete');
    } catch (error) {
      console.error('Error in auth state cleanup:', error);
      set({ error: `Auth cleanup failed: ${error.message}` });
    } finally {
      set({ loading: false });
    }
  },
  
  // ... existing methods ...
}));

export { useAuthStore };