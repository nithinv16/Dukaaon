import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { RoleSelector } from '../../components/forms/RoleSelector';
import { supabase } from '../../services/supabase/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translationService } from '../../services/translationService';
// Removed sendOTP import - now using direct supabase.auth.signInWithOtp

export default function Login() {
  const router = useRouter();
  const { currentLanguage, isLoading: languageLoading } = useLanguage();
  
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('retailer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Original English text (never changes)
  const originalTexts = {
    title: 'Welcome to Dukaaon',
    subtitle: 'Enter your phone number to continue',
    continue: 'Continue',
    loading: 'Loading...'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      console.log('Loading login translations for language:', currentLanguage);
      
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`Translating login "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`Login translation result: "${translated.translatedText}"`);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('All login translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Login screen translation error:', error);
        // Fallback to original text on error
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  // Show loading state while language is being loaded
  if (languageLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <SystemStatusBar style="dark" />
        <Text>{translations.loading}</Text>
      </View>
    );
  }
  // Handle Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        console.log('User is signed in:', session.user.id);
      } else {
        console.log('User is signed out');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRoleChange = (newRole: string) => {
    console.log('Role changed to:', newRole);
    setRole(newRole);
    setError('');
    setPhone('');
  };

  const validatePhone = () => {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }
    setError('');
    return true;
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      if (!validatePhone()) {
        setLoading(false);
        return;
      }
      
      // Store role and phone in local storage for later use
      await AsyncStorage.setItem('user_role', role);
      await AsyncStorage.setItem('user_phone', phone);
      
      // Use phone number without country code prefix
      const formattedPhone = phone;
      console.log('Sending OTP via Supabase Auth Hook to phone:', formattedPhone);
      
      try {
        // Send OTP using Supabase directly (like working sample)
        console.log('Sending OTP via Supabase to:', formattedPhone);
        console.log('Note: OTP will be sent via configured Auth Hook (AuthKey API)');
        
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
          throw error;
        }
        
        console.log('OTP sent successfully via Supabase Auth Hook');
        router.replace(`/(auth)/otp?phone=${phone}&role=${role}&isNewUser=true`);
      } catch (supabaseError: any) {
        console.error('Supabase phone auth error:', supabaseError);
        
        let errorMsg = supabaseError.message || 'Failed to send verification code';
        
        // Handle specific Supabase/Auth Hook errors
        if (errorMsg.includes('rate')) {
          errorMsg = 'Too many requests. Please try again later.';
        } else if (errorMsg.includes('Hook')) {
          errorMsg = 'OTP service temporarily unavailable. Please try again.';
        } else if (errorMsg.includes('phone')) {
          errorMsg = 'The phone number format is incorrect. Please use format: 9876543210';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          errorMsg = 'Network error. Please check your internet connection and try again.';
        }
        
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />
      
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          {translations.title}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {translations.subtitle}
        </Text>
      </View>

      <View style={styles.form}>
        <RoleSelector 
          value={role} 
          onChange={handleRoleChange} 
        />

        <PhoneInput
          value={phone}
          onChange={setPhone}
          error={error}
        />

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          {translations.continue}
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
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  form: {
    padding: 20,
  },
  button: {
    marginTop: 20,
  },
});