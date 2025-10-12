import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
// Firebase import removed - using Supabase auth only
import NetInfo from '@react-native-community/netinfo';
import { supabaseConfig } from '../../config/secrets';

// Use configuration from secrets
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': `DukaaOn-App/${Platform.OS}`
    }
  }
});

// Firebase auth integration removed - using Supabase auth only
// All authentication is now handled through Supabase Auth hooks

// Helper function to make authenticated requests with Supabase session
export const authenticatedRequest = async (requestFn: Function) => {
  try {
    // Get current Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting Supabase session:', error);
      throw error;
    }
    
    if (!session) {
      throw new Error('No active Supabase session found');
    }
    
    // Execute the request function with active session
    return await requestFn();
  } catch (error) {
    console.error('Error in authenticated request:', error);
    throw error;
  }
};

// Add helpers for standard storage operations
export const storage = {
  // Get URL for a file in the profiles bucket
  getProfileImageUrl: (userId: string) => {
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/profile_latest.jpg`).data.publicUrl;
  },
  
  // Build a full path for a profile image
  buildProfilePath: (userId: string) => {
    return `${userId}/profile_${Date.now()}.jpg`;
  },
  
  // Build a full path for a product image
  buildProductPath: (userId: string, productId?: string) => {
    const fileName = productId ? `${productId}_${Date.now()}.jpg` : `${Date.now()}.jpg`;
    return `${userId}/${fileName}`;
  },
  
  // Get URL for an ID image in the id_verification bucket
  getIdImageUrl: (userId: string, idType: string) => {
    return supabase.storage.from('id_verification').getPublicUrl(`${userId}/${idType}_latest.jpg`).data.publicUrl;
  },
  
  // Build a full path for an ID image
  buildIdPath: (userId: string, idType: string) => {
    return `${userId}/${idType}_${Date.now()}.jpg`;
  }
};

// Function to test Supabase connectivity
export const validateSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  serverTime?: string;
}> => {
  try {
    // First check internet connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return {
        success: false,
        message: 'No internet connection. Please check your network settings.'
      };
    }
    
    // Perform a simple query to test database connectivity
    console.log('Testing Supabase connectivity...');
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .from('_connectivity_test')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    // If the table doesn't exist, we'll get an error but the connection worked
    if (error && error.code === '42P01') { // "undefined_table" PostgreSQL error
      const pingTime = Date.now() - startTime;
      return {
        success: true,
        message: `Connected to Supabase (${pingTime}ms), but test table doesn't exist`,
        serverTime: new Date().toISOString()
      };
    }
    
    if (error) {
      console.error('Supabase connection test error:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`
      };
    }
    
    const pingTime = Date.now() - startTime;
    return {
      success: true,
      message: `Successfully connected to Supabase (${pingTime}ms)`,
      serverTime: data?.server_time || new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Failed to validate Supabase connection:', error);
    return {
      success: false,
      message: `Connection error: ${error.message}`
    };
  }
};