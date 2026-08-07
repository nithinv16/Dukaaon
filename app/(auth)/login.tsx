import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Platform, Image, TouchableOpacity, ScrollView, Animated, Dimensions, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { RoleSelector } from '../../components/forms/RoleSelector';
import { supabase } from '../../services/supabase/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translationService } from '../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Premium Color Palette
const COLORS = {
  primary: '#FF7D00',
  primarySoft: '#FFAB58',
  white: '#FFFFFF',
  background: '#FAFBFC',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

export default function Login() {
  const router = useRouter();
  const { currentLanguage, isLoading: languageLoading } = useLanguage();

  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation values - start fully visible (no entrance animation needed, Stack handles it)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Input section animation - start fully visible (no fade-in effect)
  const inputFadeAnim = useRef(new Animated.Value(1)).current;
  const inputSlideAnim = useRef(new Animated.Value(0)).current;

  // ScrollView ref for keyboard handling
  const scrollViewRef = useRef<ScrollView>(null);

  // Original English text (never changes)
  const originalTexts = {
    title: 'Welcome Back',
    subtitle: 'Sign in to access your account',
    continue: 'Continue',
    loading: 'Loading...',
    termsPolicy: 'By continuing, you agree to our Terms & Privacy Policy'
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

  // Scroll to bottom when keyboard shows
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // Scroll to bottom after a small delay to ensure layout is updated
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // Show loading state while language is being loaded (placed after all hooks)
  if (languageLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <SystemStatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{translations.loading}</Text>
      </View>
    );
  }


  const handleRoleChange = (newRole: string) => {
    console.log('Role changed to:', newRole);
    setRole(newRole);
    setError('');
    setPhone('');
  };

  const validatePhone = () => {
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit phone number (digits only)');
      return false;
    }
    if (phone.startsWith('0')) {
      setError('Phone number should not start with 0');
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
      if (role) {
        await AsyncStorage.setItem('user_role', role);
      }
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

      <SystemStatusBar style="light" />

      {/* Orange Gradient Header */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primarySoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBackground}
      />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/(auth)/language')}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={28} color={COLORS.white} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >

          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
              />
            </View>
            <Text style={styles.headerTitle}>{translations.title}</Text>
            <Text style={styles.headerSubtitle}>{translations.subtitle}</Text>
          </View>

          {/* White Card Section */}
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.formContent}>
              <RoleSelector
                value={role || ''}
                onChange={handleRoleChange}
              />

              {role && (
                <Animated.View style={{
                  opacity: inputFadeAnim,
                  transform: [{ translateY: inputSlideAnim }]
                }}>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    error={error}
                  />

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>{translations.continue}</Text>
                        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                      </>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}

              <Text style={styles.footerText}>
                {translations.termsPolicy}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45, // Top 45% is orange
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 50,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start', // Allow content to flow
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 60 : 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    // Add white background for the logo cutout if the image is transparent
    backgroundColor: 'rgba(255,255,255,0.2)', // Subtle glass effect container
  },
  logo: {
    width: 120,
    height: 60,
    resizeMode: 'cover',
    borderRadius: 24,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    minHeight: height * 0.6, // Ensure card takes up remaining space
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 }, // Shadow moving UP
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  formContent: {
    paddingTop: 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0ED',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDC2',
  },
  errorText: {
    color: '#D32F2F',
    flex: 1,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  footerText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
});