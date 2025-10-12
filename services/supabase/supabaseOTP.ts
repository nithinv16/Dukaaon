import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Supabase OTP Service
 * Replaces Firebase OTP with Supabase Auth using configured Auth Hook (AuthKey API)
 * 
 * AuthKey API Configuration:
 * AUTHKEY=904251f34754cedc
 * Endpoint: https://xcpznnkpjgyrpbvpnvit.supabase.co/functions/v1/sms-hook
 */

interface OTPResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface VerificationResult {
  user: any;
  session: any;
}

/**
 * Send OTP to phone number using Supabase Auth
 * This will trigger the configured Auth Hook to send SMS via AuthKey API
 * @param phoneNumber - Phone number with country code (e.g. +911234567890)
 */
export const sendOTP = async (phoneNumber: string): Promise<OTPResult> => {
  try {
    console.log(`Sending OTP via Supabase Auth Hook to ${phoneNumber}`);
    console.log('Note: OTP will be sent via configured Auth Hook (AuthKey API)');
    
    // Format phone number to ensure it has country code
    const formattedPhone = phoneNumber;
    
    // Store phone number for verification step
    await AsyncStorage.setItem('auth_phone_number', formattedPhone);
    
    // Send OTP using Supabase (will trigger Auth Hook to AuthKey API)
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    
    if (error) {
      console.error('Supabase OTP error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('Hook')) {
        throw new Error('OTP service temporarily unavailable. Please try again.');
      }
      if (error.message.includes('rate')) {
        throw new Error('Too many requests. Please wait before requesting another OTP.');
      }
      if (error.message.includes('phone')) {
        throw new Error('Invalid phone number format. Please check and try again.');
      }
      
      throw new Error(error.message || 'Failed to send verification code');
    }
    
    console.log('OTP sent successfully via Supabase Auth Hook');
    
    return {
      success: true,
      message: 'OTP sent successfully'
    };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      error: error.message || 'Failed to send verification code'
    };
  }
};

/**
 * Verify OTP using Supabase Auth
 * @param phoneNumber - Phone number with country code
 * @param code - OTP code received by user
 */
export const verifyOTP = async (phoneNumber: string, code: string): Promise<VerificationResult> => {
  try {
    console.log('Verifying OTP via Supabase for phone:', phoneNumber);
    
    // Get the stored phone number if not provided
    const storedPhone = await AsyncStorage.getItem('auth_phone_number');
    const phoneToVerify = phoneNumber || storedPhone;
    
    if (!phoneToVerify) {
      throw new Error('Phone number not found. Please restart the verification process.');
    }
    
    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneToVerify,
      token: code,
      type: 'sms'
    });
    
    if (error) {
      console.error('Supabase OTP verification error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('expired')) {
        throw new Error('OTP has expired. Please request a new code.');
      }
      if (error.message.includes('invalid')) {
        throw new Error('Invalid verification code. Please check and try again.');
      }
      if (error.message.includes('attempts')) {
        throw new Error('Too many failed attempts. Please request a new code.');
      }
      
      throw new Error(error.message || 'Failed to verify code');
    }
    
    if (!data.user || !data.session) {
      throw new Error('Verification failed. Please try again.');
    }
    
    console.log('OTP verification successful:', data.user.id);
    
    // Store user ID in AsyncStorage for compatibility
    await AsyncStorage.setItem('userId', data.user.id);
    
    // Clean up stored phone number
    await AsyncStorage.removeItem('auth_phone_number');
    
    return {
      user: data.user,
      session: data.session
    };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Resend OTP using Supabase Auth
 * @param phoneNumber - Phone number with country code (optional, will use stored if not provided)
 */
export const resendOTP = async (phoneNumber?: string): Promise<OTPResult> => {
  try {
    // Get the stored phone number if not provided
    const storedPhone = await AsyncStorage.getItem('auth_phone_number');
    const phoneToResend = phoneNumber || storedPhone;
    
    if (!phoneToResend) {
      throw new Error('Phone number not found. Please restart the verification process.');
    }
    
    console.log(`Resending OTP via Supabase Auth Hook to: ${phoneToResend}`);
    console.log('Note: OTP will be sent via configured Auth Hook (AuthKey API)');
    
    // Resend OTP using Supabase (will trigger Auth Hook to AuthKey API)
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneToResend,
    });
    
    if (error) {
      console.error('Supabase OTP resend error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('Hook')) {
        throw new Error('OTP service temporarily unavailable. Please try again.');
      }
      if (error.message.includes('rate')) {
        throw new Error('Too many requests. Please wait before requesting another OTP.');
      }
      
      throw new Error(error.message || 'Failed to resend verification code');
    }
    
    console.log('OTP resent successfully via Supabase Auth Hook');
    
    return {
      success: true,
      message: 'OTP resent successfully'
    };
  } catch (error: any) {
    console.error('Error resending OTP:', error);
    return {
      success: false,
      error: error.message || 'Failed to resend verification code'
    };
  }
};

/**
 * Sign out from Supabase
 */
export const signOut = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
    
    // Clean up stored data
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('auth_phone_number');
    await AsyncStorage.removeItem('verificationId'); // Clean up any Firebase remnants
    
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get current user from Supabase
 */
export const getCurrentUser = () => {
  const { data: { user } } = supabase.auth.getUser();
  console.log('Current user:', user ? user.id : 'No user signed in');
  return user;
};

/**
 * Get current user without logging (for routine checks)
 */
export const getCurrentUserSilent = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Get current session from Supabase
 */
export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export default {
  sendOTP,
  verifyOTP,
  resendOTP,
  signOut,
  getCurrentUser,
  getCurrentUserSilent,
  getCurrentSession
};