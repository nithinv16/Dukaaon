// Firebase imports removed - using Supabase auth only
import { supabase } from '../supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set to false for production
const USE_MOCK_AUTH = false;

/**
 * Send OTP to phone number
 * @param phoneNumber - Phone number with country code (e.g. +911234567890)
 */
export const sendOTP = async (phoneNumber: string) => {
  try {
    console.log(`Sending OTP to ${phoneNumber}`);
    
    if (USE_MOCK_AUTH) {
      // Mock implementation (kept for development testing)
      console.log('Using mock authentication');
      return {
        confirm: async (code: string) => {
          console.log(`Verifying mock OTP: ${code}`);
          if (code.length === 6) {
            const userId = generateUUID();
            return { 
              user: { 
                uid: userId,
                phoneNumber: phoneNumber
              } 
            };
          } else {
            throw new Error('Invalid OTP');
          }
        }
      };
    } else {
      // PRODUCTION: Use Supabase OTP authentication
      try {
        console.log('Starting phone authentication with Supabase...');
        console.log('Phone number:', phoneNumber);
        
        const { data, error } = await supabase.auth.signInWithOtp({
          phone: phoneNumber,
          options: {
            channel: 'sms'
          }
        });
        
        if (error) {
          console.error('Supabase OTP error:', error);
          throw error;
        }
        
        console.log('OTP sent successfully via Supabase');
        return { data };
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        throw supabaseError;
      }
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP
 * @param confirmation - Confirmation result from sendOTP
 * @param code - OTP code received by user
 */
export const verifyOTP = async (confirmation: any, code: string) => {
  try {
    console.log('Verifying OTP code:', code);
    const result = await confirmation.confirm(code);
    console.log('OTP verified successfully, user:', result.user.uid);
    return result.user;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP with Supabase
 */
export const verifyOTPWithSupabase = async (phone: string, token: string) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms'
    });
    
    if (error) {
      console.error('Supabase OTP verification error:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error verifying OTP with Supabase:', error);
    throw error;
  }
};

/**
 * Sign out from Supabase
 */
export const signOut = async () => {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear AsyncStorage auth flags
    await AsyncStorage.removeItem('auth_verified');
    await AsyncStorage.removeItem('user_phone');
    await AsyncStorage.removeItem('user_role');
    await AsyncStorage.removeItem('user_id');
    
    console.log('User signed out successfully from Supabase');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get current Supabase user
 */
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    console.log('Current Supabase user:', user ? user.id : 'No user signed in');
    return user;
  } catch (error) {
    console.error('Exception getting current user:', error);
    return null;
  }
};

/**
 * Get user profile from Supabase by user ID
 */
export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception fetching user profile:', error);
    return null;
  }
};

/**
 * Get user profile from Supabase by phone number
 */
export const getUserProfileByPhone = async (phoneNumber: string) => {
  try {
    // Normalize phone number by removing '+91' prefix if present
    const normalizedPhone = phoneNumber.startsWith('+91') 
      ? phoneNumber.substring(3) 
      : phoneNumber;
      
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching user profile by phone:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception fetching user profile by phone:', error);
    return null;
  }
};

/**
 * Create or update user profile in Supabase
 */
export const syncUserProfile = async (
  userId: string, 
  phoneNumber: string, 
  role: string = 'retailer'
) => {
  try {
    console.log('Syncing user profile with user ID:', userId);
    
    // First try RPC method which bypasses RLS
    try {
      console.log('Trying RPC method for profile creation...');
      const { data: profile, error: rpcError } = await supabase.rpc('create_user_profile', {
        user_id: userId,
        user_phone: phoneNumber.startsWith('+91') ? phoneNumber.substring(3) : phoneNumber,
        user_role: role
      });
      
      if (rpcError) {
        console.error('Error creating/updating profile via RPC:', rpcError);
      } else {
        console.log('Profile synced successfully via RPC:', profile);
        return profile;
      }
    } catch (rpcException) {
      console.error('Exception in RPC profile creation:', rpcException);
    }
    
    // Fallback to direct upsert (may encounter RLS issues)
    try {
      console.log('Trying direct upsert for profile creation...');
      const normalizedPhone = phoneNumber.startsWith('+91') 
        ? phoneNumber.substring(3) 
        : phoneNumber;
        
      const { data: profile, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          phone_number: normalizedPhone,
          role: role,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();
        
      if (upsertError) {
        console.error('Error upserting profile:', upsertError);
        return null;
      }
      
      console.log('Profile synced successfully via upsert:', profile);
      return profile;
    } catch (upsertException) {
      console.error('Exception in profile upsert:', upsertException);
      return null;
    }
  } catch (error) {
    console.error('Error syncing profile:', error);
    return null;
  }
};

/**
 * Test Supabase connection
 */
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Exception testing Supabase connection:', error);
    return false;
  }
};

/**
 * Create user profile directly with phone number
 */
export const createProfileDirectly = async (phoneNumber: string, role: string = 'retailer') => {
  try {
    console.log('Creating profile directly with phone:', phoneNumber, 'role:', role);
    
    if (!phoneNumber) {
      console.error('Phone number is required for profile creation');
      return null;
    }
    
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
      console.error('Error finding existing profile:', findError);
    }
    
    // If profile exists, return it
    if (existingProfile) {
      console.log('Found existing profile:', existingProfile.id);
      return existingProfile;
    }
    
    // Try RPC approach first (should bypass RLS)
    try {
      console.log('Trying RPC method for profile creation...');
      const { data, error: rpcError } = await supabase.rpc('create_profile_if_not_exists', {
        p_user_id: null, // Will be set after authentication
        p_phone: normalizedPhone,
        p_role: role,
        p_language: 'en',
        p_status: 'pending'
      });
      
      if (rpcError) {
        console.error('Error creating profile via RPC:', rpcError);
      } else if (data && data.length > 0) {
        console.log('Profile created successfully via RPC:', JSON.stringify(data));
        return data[0]; // Return the first profile from the result set
      }
    } catch (rpcException) {
      console.error('Exception in RPC profile creation:', rpcException);
    }
    
    // Fallback to direct insert with service key if available
    console.log('Attempting direct profile creation...');
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        phone_number: normalizedPhone,
        role: role || 'retailer',
        status: 'pending',
        business_details: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating new profile:', createError);
      
      // Last resort - try Anonymous authentication with Supabase
      try {
        console.log('Trying anonymous authentication as last resort...');
        await supabase.auth.signInAnonymously();
        
        // Try insert again after anonymous auth
        const { data: anonProfile, error: anonError } = await supabase
          .from('profiles')
          .insert({
            phone_number: normalizedPhone,
            role: role || 'retailer',
            status: 'pending',
            business_details: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (anonError) {
          console.error('Error creating profile after anonymous auth:', anonError);
          return null;
        }
        
        console.log('Created profile after anonymous auth:', anonProfile.id);
        return anonProfile;
      } catch (anonException) {
        console.error('Exception in anonymous auth profile creation:', anonException);
        return null;
      }
    }
    
    console.log('Created new profile directly:', newProfile.id);
    return newProfile;
  } catch (error) {
    console.error('Exception in createProfileDirectly:', error);
    return null;
  }
};

// Helper function to generate UUID (for mock auth)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default {
  sendOTP,
  verifyOTP,
  verifyOTPWithSupabase,
  signOut,
  getCurrentUser,
  getUserProfile,
  getUserProfileByPhone,
  syncUserProfile,
  testSupabaseConnection,
  createProfileDirectly
};