import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { supabase } from '../../services/supabase/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../store/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import envConfig from '../../config/environment';
import { translationService } from '../../services/translationService';

// Function to generate a valid UUID for Supabase
const generateValidUuid = (): string => {
  try {
    return uuidv4();
  } catch (error) {
    console.error('Error generating UUID:', error);
    return uuidv4();
  }
};

export default function OTP() {
  const router = useRouter();
  const { phone, role, isNewUser } = useLocalSearchParams<{
    phone: string;
    role: string;
    isNewUser: string;
  }>();
  const { currentLanguage, isLoading: languageLoading } = useLanguage();
  
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Original English text (never changes)
  const originalTexts = {
    title: 'Enter Verification Code',
    subtitle: `We've sent a 6-digit code to ${phone}`,
    otpLabel: 'Enter 6-digit code',
    verifyButton: 'Verify Code',
    resendButton: 'Resend Code',
    resendCountdown: 'Resend in',
    loading: 'Loading...',
    success: 'Success',
    verificationCodeSentSuccessfully: 'Verification code sent successfully!'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        console.log('OTP: Loading translations for language:', currentLanguage);
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
        console.log('OTP: Translations loaded successfully');
      } catch (error) {
        console.error('OTP translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage, phone]);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Show loading state while language is being loaded
  if (languageLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <SystemStatusBar style="dark" />
        <Text>{translations.loading}</Text>
      </View>
    );
  }

  // Handle successful authentication with Supabase user
  const handleSuccessfulAuth = async (supabaseUser: any, isNewUser: boolean) => {
    try {
      console.log('Processing successful authentication for user:', supabaseUser.id);
      
      // Store user data in AsyncStorage
      await AsyncStorage.setItem('user_id', supabaseUser.id);
      await AsyncStorage.setItem('user_phone', supabaseUser.phone || phone);
      
      // Get user role from AsyncStorage
      const userRole = await AsyncStorage.getItem('user_role');
      
      if (!userRole) {
        console.error('No user role found in storage');
        setError('User role not found. Please try logging in again.');
        return;
      }
      
      console.log('User role from storage:', userRole);
      
      // Update auth store with user data
      useAuthStore.getState().setUser({
        id: supabaseUser.id,
        phone_number: supabaseUser.phone || phone,
        email: supabaseUser.email,
        role: userRole as 'retailer' | 'seller' | 'wholesaler' | 'manufacturer',
        business_details: {}
      });
      
      // Check if user profile exists in Supabase (using 'profiles' table)
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', profileError);
      }
      
      if (existingProfile) {
        console.log('Existing user profile found:', existingProfile);
        await handleProfileSuccess();
      } else {
        // Profile should have been created in handleVerifyOTP
        console.log('Profile not found - this should not happen with the new flow');
        setError('Profile setup failed. Please try logging in again.');
      }
      
    } catch (error: any) {
      console.error('Error in handleSuccessfulAuth:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    }
  };

  useEffect(() => {
    // Load phone number from AsyncStorage for Supabase OTP
    const loadPhoneNumber = async () => {
      try {
        const savedPhone = await AsyncStorage.getItem('user_phone');
        if (savedPhone) {
          console.log('Retrieved phone number from storage for OTP verification:', savedPhone);
        } else {
          console.error('No phone number found in storage');
        }
      } catch (error) {
        console.error('Error loading phone number:', error);
      }
    };
    
    loadPhoneNumber();
  }, []);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Verifying OTP:', otp, 'for phone:', phone);
      
      // Verify OTP using Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone as string,
        token: otp,
        type: 'sms'
      });

      if (error) {
        console.error('OTP verification error:', error);
        
        let errorMsg = error.message || 'Invalid verification code';
        
        // Handle specific error cases
        if (errorMsg.includes('expired')) {
          errorMsg = 'Verification code has expired. Please request a new one.';
        } else if (errorMsg.includes('invalid') || errorMsg.includes('wrong')) {
          errorMsg = 'Invalid verification code. Please try again.';
        } else if (errorMsg.includes('rate')) {
          errorMsg = 'Too many attempts. Please try again later.';
        }
        
        setError(errorMsg);
        return;
      }

      if (data.user) {
        console.log('OTP verified successfully for user:', data.user.id);
        
        // Store user data
        await AsyncStorage.setItem('user_id', data.user.id);
        await AsyncStorage.setItem('user_phone', phone as string);
        await AsyncStorage.setItem('user_role', role as string);
        
        // Update auth store with user data BEFORE checking profile
        useAuthStore.getState().setUser({
          id: data.user.id,
          phone_number: phone as string,
          email: data.user.email,
          role: role as 'retailer' | 'seller' | 'wholesaler' | 'manufacturer',
          business_details: {}
        });
        
        // Check if profile exists, if not create it manually
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileCheckError && profileCheckError.code === 'PGRST116') {
          // Profile doesn't exist, create it manually
          console.log('Creating profile manually for user:', data.user.id);
          
          const { data: newProfile, error: profileCreateError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              phone_number: phone as string,
              role: role as string,
              language: 'en',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (profileCreateError) {
            console.error('Error creating profile manually:', profileCreateError);
            setError('Profile creation failed. Please try again.');
            return;
          }
          
          console.log('Profile created successfully:', newProfile);
        } else if (profileCheckError) {
          console.error('Error checking existing profile:', profileCheckError);
          setError('Profile verification failed. Please try again.');
          return;
        } else {
          console.log('Profile already exists:', existingProfile);
        }
        
        // Navigate based on user profile and role
        await handleProfileSuccess();
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setError(error.message || 'An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };



  // Function to handle successful profile creation/authentication
  const handleProfileSuccess = async () => {
    try {
      console.log('Handling profile success...');
      
      // Get the current user from auth store
      const currentUser = useAuthStore.getState().user;
      
      if (!currentUser) {
        console.error('No current user found in handleProfileSuccess');
        router.replace('/(auth)/login');
        return;
      }

      console.log('Current user from auth store:', currentUser);

      // Get the user's profile from Supabase to check role and status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Error getting profile:', profileError);
        router.replace('/(auth)/login');
        return;
      }

      if (!profile) {
        console.error('No profile found for user:', currentUser.id);
        router.replace('/(auth)/login');
        return;
      }

      console.log('Current user profile:', profile);
      console.log('Current user role:', profile.role);
      
      if (profile.role === 'seller' || profile.role === 'wholesaler') {
        // For all sellers (including wholesalers and manufacturers), check seller details
        console.log('User is a seller/wholesaler, checking seller details...');
        
        try {
          // Check for seller details - all required columns
          const { data: sellerData, error: sellerError } = await supabase
            .from('seller_details')
            .select('business_name, owner_name, seller_type, registration_number, gst_number, address')
            .eq('user_id', currentUser.id)
            .single();
            
          if (sellerError && sellerError.code !== 'PGRST116') {
            console.log('Error fetching seller details:', sellerError);
          }
          
          console.log('Seller details:', sellerData);
          
          // Check if all required seller details are complete
          const hasCompleteDetails = sellerData && 
            sellerData.business_name && 
            sellerData.owner_name && 
            sellerData.seller_type && 
            sellerData.registration_number && 
            sellerData.gst_number && 
            sellerData.address;
          
          if (hasCompleteDetails) {
            console.log('Seller has complete details, redirecting to wholesaler home');
            router.replace('/(main)/wholesaler');
          } else {
            // Otherwise redirect to seller KYC
            console.log('Seller missing details, redirecting to seller KYC');
            router.replace('/(auth)/seller-kyc');
          }
        } catch (error) {
          console.error('Error in seller details check:', error);
          router.replace('/(auth)/seller-kyc');
        }
      } else if (profile.role === 'retailer') {
        // For retailers, check if they have business details
        console.log('User is a retailer, checking business details...');
        console.log('Business details from profile:', profile.business_details);
        
        // Check if business_details exists and has all required fields
        const hasBusinessDetails = profile.business_details && 
            typeof profile.business_details === 'object' && 
            Object.keys(profile.business_details).length > 0 && 
            profile.business_details.shopName && 
            profile.business_details.shopName !== 'My Shop' && 
            profile.business_details.ownerName && 
            profile.business_details.address && 
            profile.business_details.address !== 'Address pending';
        
        console.log('Has complete business details:', hasBusinessDetails);
        
        if (hasBusinessDetails) {
          // Retailer has business details, redirect to home
          console.log('Retailer has complete business details, redirecting to home');
          router.replace('/(main)/home/');
        } else {
          // Retailer doesn't have business details or business_details is empty, redirect to KYC
          console.log('Retailer missing or empty business details, redirecting to retailer KYC');
          router.replace('/(auth)/retailer-kyc');
        }
      } else {
        // For any other roles, redirect to login
        console.log('Unknown role, redirecting to login');
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Error in handleProfileSuccess:', error);
      router.replace('/(auth)/login');
    }
  };

  // Helper function to check if this is a new phone number
  const isNewPhoneNumber = async (phoneNumber: string): Promise<boolean> => {
    try {
      const formattedPhone = phoneNumber;
      
      // Check if profile exists in Supabase
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', formattedPhone)
        .limit(1);
      
      if (error) {
        console.error('Error checking for existing profile:', error);
        return true; // Assume new user if we can't check
      }
      
      const isNew = !existingProfile || existingProfile.length === 0;
      console.log(`Phone ${formattedPhone} is ${isNew ? 'new' : 'existing'} user`);
      return isNew;
    } catch (error) {
      console.error('Error in isNewPhoneNumber check:', error);
      return true; // Assume new user if error occurs
    }
  };

  // Helper function to create profile using the unified function
  const createProfileSafely = async (
    userId: string, 
    phoneNumber: string, 
    userRole: string, 
    supabaseUser: any
  ) => {
    try {
      console.log('--------------------------------');
      console.log('PROFILE CREATION STARTED');
      console.log('User ID:', userId);
      console.log('Phone:', phoneNumber);
      console.log('Role:', userRole);
      console.log('--------------------------------');
      
      console.log('Attempting to create profile safely for phone:', phoneNumber);
      
      // Format phone number consistently
      const formattedPhone = phoneNumber;
      
      // Use the unified profile creation function
      console.log('Using create_profile_unified RPC function...');
      
      const { data: result, error } = await supabase.rpc(
        'create_profile_unified', 
        {
          phone_number: formattedPhone,
          user_role: userRole
        }
      );
      
      if (error) {
        console.error('Error using create_profile_unified:', error);
        throw new Error(`Profile creation failed: ${error.message}`);
      }
      
      if (result && result.success) {
        console.log('Successfully created profile with create_profile_unified:', result);
        return result.profile;
      } else {
        console.error('Profile creation returned unsuccessful result:', result);
        throw new Error('Profile creation was not successful');
      }
      
    } catch (error) {
      console.error('Unhandled error in createProfileSafely:', error);
      throw new Error('Profile creation failed');
    }
  };

  // Validate if a string is a valid UUID
  const isValidUuid = (str: string): boolean => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
  };

  // Firebase verification function removed - using Supabase auth only
  

  
  // Helper function to handle expired OTP
  const handleExpiredOTP = async () => {
    console.log('OTP expired, requesting a new one...');
    console.log('Environment:', envConfig.environment, 'Production:', envConfig.isProduction);
    
    // Clear any cached OTP state
    console.log('Clearing expired OTP state...');
    setOtp(''); // Clear the OTP input field
    
    // Automatically request a new OTP
    const formattedPhone = phone;
    try {
      console.log('Requesting new OTP after expiration for phone:', formattedPhone);
      
      // Use Supabase directly to send new OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      
      if (error) {
        console.error('Failed to send new OTP:', error);
        setError('Unable to send new verification code. Please try again later.');
      } else {
        console.log('Successfully requested new OTP via Supabase');
        setError('OTP expired. A new verification code has been sent to your phone.');
        setOtp(''); // Clear the OTP field
      }
    } catch (error: any) {
      console.error('Error requesting new OTP after expiration:', error);
      
      // Handle specific errors for production
      if (error.message?.includes('timeout')) {
        setError('Request timed out. Please check your internet connection and try again.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else if (error.code === 'auth/quota-exceeded') {
        setError('Service temporarily unavailable. Please try again later.');
      } else if (envConfig.isProduction) {
        setError('Unable to send new verification code. Please go back and try logging in again.');
      } else {
        setError(`Failed to request new verification code: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    setError('');

    try {
      console.log('Resending OTP to:', phone);
      
      // Resend OTP using Supabase
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone as string,
      });

      if (error) {
        console.error('Resend OTP error:', error);
        
        let errorMsg = error.message || 'Failed to resend verification code';
        
        if (errorMsg.includes('rate')) {
          errorMsg = 'Too many requests. Please try again later.';
        } else if (errorMsg.includes('Hook')) {
          errorMsg = 'OTP service temporarily unavailable. Please try again.';
        }
        
        setError(errorMsg);
        return;
      }

      console.log('OTP resent successfully');
      setCountdown(30); // Reset countdown
      Alert.alert(translations.success, translations.verificationCodeSentSuccessfully);
    } catch (error: any) {
      console.error('Resend error:', error);
      setError(error.message || 'Failed to resend verification code');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <View style={styles.content}>
        <Text style={styles.title}>{translations.title}</Text>
        <Text style={styles.subtitle}>
          {translations.subtitle}
        </Text>
        
        <View style={styles.otpContainer}>
          <TextInput
            mode="outlined"
            label={translations.otpLabel}
            value={otp}
            onChangeText={(text) => {
              // Only allow numeric input and limit to 6 digits
              const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
              setOtp(numericText);
            }}
            keyboardType="numeric"
            maxLength={6}
            style={styles.otpInput}
            autoFocus
            textAlign="center"
            error={!!error}
          />
        </View>
        
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
        
        <Button
          mode="contained"
          onPress={handleVerifyOTP}
          loading={loading}
          disabled={loading || otp.length !== 6}
          style={styles.verifyButton}
        >
          {translations.verifyButton}
        </Button>
        
        <Button
          mode="text"
          onPress={handleResendOTP}
          loading={resendLoading}
          disabled={resendLoading || countdown > 0}
          style={styles.resendButton}
        >
          {countdown > 0 
            ? `${translations.resendCountdown} ${countdown}s`
            : translations.resendButton
          }
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 40,
  },
  otpContainer: {
    marginBottom: 30,
    width: '100%',
  },
  otpInput: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  verifyButton: {
    marginBottom: 20,
    minWidth: 200,
  },
  resendButton: {
    minWidth: 200,
  },
});