import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';
import auth from '@react-native-firebase/auth';

// Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key';

// Helper function to get Firebase ID token
const getFirebaseAccessToken = async (): Promise<string | null> => {
  try {
    const currentUser = auth().currentUser;
    if (currentUser) {
      return await currentUser.getIdToken(false);
    }
    return null;
  } catch (error) {
    console.warn('Failed to get Firebase ID token:', error);
    return null;
  }
};

// Create a custom client for use in a React Native app with Firebase Auth integration
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Firebase Auth integration for third-party authentication
    accessToken: getFirebaseAccessToken,
  },
  global: {
    headers: {
      // Additional headers can be added here if needed
    },
  },
});

// Legacy client without Firebase integration (for backward compatibility)
export const supabaseLegacy = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});

// Add helpers for standard storage operations
export const storage = {
  // Get URL for a file in the profiles bucket
  getProfileImageUrl: (userId: string, fileName: string, userRole?: string) => {
    if (userRole === 'retailer') {
      return supabase.storage.from('profiles').getPublicUrl(`retailer/${userId}/avatar/${fileName}`).data.publicUrl;
    }
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/avatar/${fileName}`).data.publicUrl;
  },
  
  // Get URL for a shop image in the profiles bucket
  getShopImageUrl: (userId: string, fileName: string) => {
    return supabase.storage.from('profiles').getPublicUrl(`${userId}/shop/${fileName}`).data.publicUrl;
  },
  
  // Build a full path for an avatar
  buildAvatarPath: (userId: string, userRole?: string) => {
    if (userRole === 'retailer') {
      return `retailer/${userId}/avatar/${Date.now()}.jpg`;
    }
    return `${userId}/avatar/${Date.now()}.jpg`;
  },
  
  // Build a full path for a shop image
  buildShopPath: (userId: string) => {
    return `${userId}/shop/${Date.now()}.jpg`;
  },
  
  // Get URL for a product image in the product-images bucket
  getProductImageUrl: (userId: string, fileName: string) => {
    return supabase.storage.from('product-images').getPublicUrl(`${userId}/${fileName}`).data.publicUrl;
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