import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function WholesalerSettings() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const { clearAuth } = useAuthStore();

  const [translations, setTranslations] = useState({
    wholesalerSettings: 'Wholesaler Settings',
    confirmLogout: 'Confirm Logout',
    logoutConfirmation: 'Are you sure you want to log out?',
    cancel: 'Cancel',
    logout: 'Logout',
    error: 'Error',
    failedToLogout: 'Failed to logout. Please try again.'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Wholesaler Settings', currentLanguage),
          translationService.translateText('Confirm Logout', currentLanguage),
          translationService.translateText('Are you sure you want to log out?', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Logout', currentLanguage),
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Failed to logout. Please try again.', currentLanguage)
        ]);

        setTranslations({
          wholesalerSettings: results[0].translatedText,
          confirmLogout: results[1].translatedText,
          logoutConfirmation: results[2].translatedText,
          cancel: results[3].translatedText,
          logout: results[4].translatedText,
          error: results[5].translatedText,
          failedToLogout: results[6].translatedText
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleLogout = async () => {
    Alert.alert(
      translations.confirmLogout,
      translations.logoutConfirmation,
      [
        { text: translations.cancel, style: 'cancel' },
        { 
          text: translations.logout, 
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage auth data first
              await AsyncStorage.multiRemove([
                'auth_verified',
                'user_phone',
                'user_role',
                'user_id',
                'profile_id',
                'verificationId'
              ]);
              
              // Sign out from Supabase
              await supabase.auth.signOut();
              
              // Clear auth state in the store
              clearAuth();
              
              // Navigate to language selection with replace to prevent back navigation
              router.replace('/(auth)/language');
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert(translations.error, translations.failedToLogout);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        {translations.wholesalerSettings}
      </Text>
      
      <Button 
        mode="contained" 
        onPress={handleLogout}
        style={styles.logoutButton}
        buttonColor="#ff4444"
      >
        {translations.logout}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 30,
    textAlign: 'center',
  },
  logoutButton: {
    marginTop: 20,
  },
});
