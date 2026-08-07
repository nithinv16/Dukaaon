import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { supabase } from '../../services/supabase/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuthStore } from '../../store/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import envConfig from '../../config/environment';
import { translationService } from '../../services/translationService';

export default function OTP() {
  const router = useRouter();
  const { phone, role, isNewUser } = useLocalSearchParams<{
    phone: string;
    role: string;
    isNewUser: string;
  }>();
  const { currentLanguage, isLoading: languageLoading } = useLanguage();

  const VALID_ROLES = ['retailer', 'seller', 'wholesaler', 'manufacturer'] as const;
  type ValidRole = typeof VALID_ROLES[number];

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

      if (!userRole || !VALID_ROLES.includes(userRole as ValidRole)) {
        console.error('Invalid or missing user role in storage:', userRole);
        setError('User role not found. Please try logging in again.');
        return;
      }

      const validatedRole: ValidRole = userRole as ValidRole;
      console.log('User role from storage:', validatedRole);

      // Update auth store with user data
      useAuthStore.getState().setUser({
        id: supabaseUser.id,
        phone_number: supabaseUser.phone || phone,
        email: supabaseUser.email,
        role: validatedRole,
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
    if (!phone || !/^\d{10}$/.test(phone)) {
      setError('Invalid phone number. Please go back and try again.');
      return;
    }

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

        // Store user data in AsyncStorage
        await AsyncStorage.setItem('user_id', data.user.id);
        await AsyncStorage.setItem('user_phone', phone as string);
        await AsyncStorage.setItem('user_role', role as string);

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

          // CHECK IF USER CHANGED ROLE AND IF KYC IS INCOMPLETE
          // Allow role change only if KYC is not completed
          const existingRole = existingProfile.role;
          const selectedRole = role as string;

          if (existingRole !== selectedRole) {
            console.log(`User changed role from ${existingRole} to ${selectedRole}. Checking KYC status...`);

            // Check if KYC is completed for the existing role
            let isKycCompleted = false;

            if (existingRole === 'seller' || existingRole === 'wholesaler') {
              // Check seller_details table
              const { data: sellerData, error: sellerError } = await supabase
                .from('seller_details')
                .select('business_name, owner_name, gst_number')
                .eq('user_id', data.user.id)
                .single();

              // KYC is complete if seller_details exists with all required fields
              isKycCompleted = !sellerError && sellerData &&
                sellerData.business_name &&
                sellerData.owner_name &&
                sellerData.gst_number;

              console.log('Seller KYC completion status:', isKycCompleted);
            } else if (existingRole === 'retailer') {
              // Check business_details in profile
              const hasBusinessDetails = existingProfile.business_details &&
                typeof existingProfile.business_details === 'object' &&
                Object.keys(existingProfile.business_details).length > 0 &&
                existingProfile.business_details.shopName &&
                existingProfile.business_details.shopName !== 'My Shop' &&
                existingProfile.business_details.ownerName &&
                existingProfile.business_details.address &&
                existingProfile.business_details.address !== 'Address pending';

              isKycCompleted = hasBusinessDetails;
              console.log('Retailer KYC completion status:', isKycCompleted);
            }

            if (!isKycCompleted) {
              // KYC not completed, allow role change
              console.log('KYC not completed. Updating role to:', selectedRole);

              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  role: selectedRole,
                  updated_at: new Date().toISOString()
                })
                .eq('id', data.user.id);

              if (updateError) {
                console.error('Error updating role:', updateError);
              } else {
                console.log('Role updated successfully to:', selectedRole);
              }
            } else {
              // KYC completed, ignore role change
              console.log('KYC already completed. Keeping existing role:', existingRole);
              console.log('User cannot change role after completing KYC');
              // Update AsyncStorage to reflect the existing role
              await AsyncStorage.setItem('user_role', existingRole);
            }
          }
        }

        // CRITICAL FIX: Set the session in auth store to properly initialize auth state
        // This ensures the user and session are properly set before navigation
        if (data.session) {
          console.log('Setting session in auth store after OTP verification');

          // Add a small delay to ensure database has committed the profile
          // This is important in production where there might be replication delay
          await new Promise(resolve => setTimeout(resolve, 300));

          await useAuthStore.getState().setSession(data.session);
          console.log('Session set successfully, user state initialized');
        } else {
          console.error('No session available after OTP verification');
          setError('Authentication failed. Please try again.');
          return;
        }

        // Set auth_verified flag for persistent login
        await AsyncStorage.setItem('auth_verified', 'true');

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

      // Fetch profile with retry logic to handle database replication delay
      // This is especially important in production where there might be slight delays
      let profile = null;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelays = [500, 1000, 2000]; // Exponential backoff

      while (!profile && retryCount < maxRetries) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (!profileError && profileData) {
          profile = profileData;
          console.log('Profile fetched successfully on attempt', retryCount + 1);
        } else if (profileError && profileError.code === 'PGRST116') {
          // Profile not found - might be replication delay
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Profile not found, retrying in ${retryDelays[retryCount - 1]}ms (attempt ${retryCount}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount - 1]));
          }
        } else if (profileError) {
          console.error('Error getting profile:', profileError);
          break;
        }
      }

      if (!profile) {
        // If we still can't find the profile after retries, use the currentUser from auth store
        // This is the minimal profile we created in setSession for new users
        console.log('Could not fetch profile from DB, using auth store user');
        profile = currentUser;
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