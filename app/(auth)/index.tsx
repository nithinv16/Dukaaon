import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/auth';

export default function AuthIndex() {
  const router = useRouter();
  const session = useAuthStore((state: any) => state.session);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuthFlow = async () => {
      try {
        // Add a small delay to ensure auth store has initialized
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // If user is already authenticated, redirect to main app
        if (session) {
          console.log('User is authenticated, redirecting to main app');
          router.replace('/(main)/home/');
          return;
        }

        // Check if user has completed language selection
        // Use the same storage key as LanguageContext ('app_current_language')
        const selectedLanguage = await AsyncStorage.getItem('app_current_language');
        const hasCompletedLanguageSelection = await AsyncStorage.getItem('hasCompletedLanguageSelection');
        
        console.log('Auth check - Language:', selectedLanguage, 'Completed:', hasCompletedLanguageSelection);

        if (!selectedLanguage || hasCompletedLanguageSelection !== 'true') {
          // First time user or language not selected, go to language selection
          console.log('Redirecting to language selection');
          router.replace('/(auth)/language');
        } else {
          // Language already selected, go to login
          console.log('Language already selected, redirecting to login');
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Error checking auth flow:', error);
        // Fallback to language selection on error
        router.replace('/(auth)/language');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuthFlow();
  }, [session, router]);

  // Show loading while checking auth flow
  if (isChecking) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#FF7D00'
      }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ 
          marginTop: 10, 
          color: '#FFFFFF',
          fontSize: 16
        }}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  // This should not be reached as we redirect in useEffect
  return null;
}