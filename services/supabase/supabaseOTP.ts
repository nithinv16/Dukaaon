import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceError, ErrorCode } from '../errors';
import { LoggingService } from '../logging/LoggingService';

const logger = LoggingService.createScope('SupabaseOTP');

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
    logger.info('Sending OTP via Supabase Auth Hook', { phone: phoneNumber.slice(-4) });
    
    // Format phone number to ensure it has country code
    const formattedPhone = phoneNumber;
    
    // Store phone number for verification step
    await AsyncStorage.setItem('auth_phone_number', formattedPhone);
    
    // Send OTP using Supabase (will trigger Auth Hook to AuthKey API)
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });
    
    if (error) {
      logger.warn('Supabase OTP error', { errorMessage: error.message });
      
      // Map to specific error codes
      if (error.message.includes('Hook')) {
        throw new ServiceError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `OTP hook error: ${error.message}`,
          userMessage: 'OTP service temporarily unavailable. Please try again.',
          context: { service: 'supabaseOTP', operation: 'sendOTP' },
        });
      }
      if (error.message.includes('rate')) {
        throw new ServiceError({
          code: ErrorCode.AUTH_RATE_LIMITED,
          message: `Rate limited: ${error.message}`,
          userMessage: 'Too many requests. Please wait before requesting another OTP.',
          context: { service: 'supabaseOTP', operation: 'sendOTP' },
        });
      }
      if (error.message.includes('phone')) {
        throw new ServiceError({
          code: ErrorCode.DATA_VALIDATION_FAILED,
          message: `Invalid phone: ${error.message}`,
          userMessage: 'Invalid phone number format. Please check and try again.',
          context: { service: 'supabaseOTP', operation: 'sendOTP' },
        });
      }
      
      throw new ServiceError({
        code: ErrorCode.NETWORK_REQUEST_FAILED,
        message: error.message || 'Failed to send verification code',
        context: { service: 'supabaseOTP', operation: 'sendOTP' },
      });
    }
    
    logger.info('OTP sent successfully');
    
    return {
      success: true,
      message: 'OTP sent successfully'
    };
  } catch (error: unknown) {
    const serviceError = ServiceError.fromUnknown(error, {
      code: ErrorCode.NETWORK_REQUEST_FAILED,
      context: { service: 'supabaseOTP', operation: 'sendOTP' },
    });
    
    return {
      success: false,
      error: serviceError.userMessage
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
    logger.info('Verifying OTP via Supabase', { phone: phoneNumber?.slice(-4) });
    
    // Get the stored phone number if not provided
    const storedPhone = await AsyncStorage.getItem('auth_phone_number');
    const phoneToVerify = phoneNumber || storedPhone;
    
    if (!phoneToVerify) {
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: 'Phone number not found in storage',
        userMessage: 'Phone number not found. Please restart the verification process.',
        context: { service: 'supabaseOTP', operation: 'verifyOTP' },
      });
    }
    
    // Verify OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneToVerify,
      token: code,
      type: 'sms'
    });
    
    if (error) {
      logger.warn('Supabase OTP verification error', { errorMessage: error.message });
      
      // Map to specific error codes
      if (error.message.includes('expired')) {
        throw new ServiceError({
          code: ErrorCode.AUTH_OTP_EXPIRED,
          message: `OTP expired: ${error.message}`,
          userMessage: 'OTP has expired. Please request a new code.',
          context: { service: 'supabaseOTP', operation: 'verifyOTP' },
        });
      }
      if (error.message.includes('invalid')) {
        throw new ServiceError({
          code: ErrorCode.AUTH_OTP_INVALID,
          message: `Invalid OTP: ${error.message}`,
          userMessage: 'Invalid verification code. Please check and try again.',
          context: { service: 'supabaseOTP', operation: 'verifyOTP' },
        });
      }
      if (error.message.includes('attempts')) {
        throw new ServiceError({
          code: ErrorCode.AUTH_RATE_LIMITED,
          message: `Too many attempts: ${error.message}`,
          userMessage: 'Too many failed attempts. Please request a new code.',
          context: { service: 'supabaseOTP', operation: 'verifyOTP' },
        });
      }
      
      throw new ServiceError({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: error.message || 'Failed to verify code',
        context: { service: 'supabaseOTP', operation: 'verifyOTP' },
      });
    }
    
    if (!data.user || !data.session) {
      throw new ServiceError({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'Verification returned no user or session',
        userMessage: 'Verification failed. Please try again.',
        context: { service: 'supabaseOTP', operation: 'verifyOTP' },
      });
    }
    
    logger.info('OTP verification successful', { userId: data.user.id });
    
    // Store user ID in AsyncStorage for compatibility
    await AsyncStorage.setItem('userId', data.user.id);
    
    // Clean up stored phone number
    await AsyncStorage.removeItem('auth_phone_number');
    
    return {
      user: data.user,
      session: data.session
    };
  } catch (error: unknown) {
    // Re-throw ServiceErrors as-is
    if (ServiceError.isServiceError(error)) {
      throw error;
    }
    
    throw ServiceError.fromUnknown(error, {
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      context: { service: 'supabaseOTP', operation: 'verifyOTP' },
    });
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
      throw new ServiceError({
        code: ErrorCode.DATA_NOT_FOUND,
        message: 'Phone number not found in storage for resend',
        userMessage: 'Phone number not found. Please restart the verification process.',
        context: { service: 'supabaseOTP', operation: 'resendOTP' },
      });
    }
    
    logger.info('Resending OTP via Supabase Auth Hook', { phone: phoneToResend.slice(-4) });
    
    // Resend OTP using Supabase (will trigger Auth Hook to AuthKey API)
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneToResend,
    });
    
    if (error) {
      logger.warn('Supabase OTP resend error', { errorMessage: error.message });
      
      // Map to specific error codes
      if (error.message.includes('Hook')) {
        throw new ServiceError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `OTP hook error on resend: ${error.message}`,
          userMessage: 'OTP service temporarily unavailable. Please try again.',
          context: { service: 'supabaseOTP', operation: 'resendOTP' },
        });
      }
      if (error.message.includes('rate')) {
        throw new ServiceError({
          code: ErrorCode.AUTH_RATE_LIMITED,
          message: `Rate limited on resend: ${error.message}`,
          userMessage: 'Too many requests. Please wait before requesting another OTP.',
          context: { service: 'supabaseOTP', operation: 'resendOTP' },
        });
      }
      
      throw new ServiceError({
        code: ErrorCode.NETWORK_REQUEST_FAILED,
        message: error.message || 'Failed to resend verification code',
        context: { service: 'supabaseOTP', operation: 'resendOTP' },
      });
    }
    
    logger.info('OTP resent successfully');
    
    return {
      success: true,
      message: 'OTP resent successfully'
    };
  } catch (error: unknown) {
    const serviceError = ServiceError.fromUnknown(error, {
      code: ErrorCode.NETWORK_REQUEST_FAILED,
      context: { service: 'supabaseOTP', operation: 'resendOTP' },
    });
    
    return {
      success: false,
      error: serviceError.userMessage
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
    
    logger.info('User signed out successfully');
  } catch (error) {
    throw ServiceError.fromUnknown(error, {
      code: ErrorCode.AUTH_NOT_AUTHENTICATED,
      context: { service: 'supabaseOTP', operation: 'signOut' },
    });
  }
};

/**
 * Get current user from Supabase
 */
export const getCurrentUser = () => {
  const { data: { user } } = supabase.auth.getUser();
  logger.debug('Current user check', { hasUser: !!user });
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