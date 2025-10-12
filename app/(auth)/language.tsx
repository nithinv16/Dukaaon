import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Dimensions } from 'react-native';
import { Text, Button, Searchbar, ActivityIndicator } from 'react-native-paper';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { useRouter } from 'expo-router';
import { useLanguage as useLanguageContext } from '../../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase/supabase';
import { translationService } from '../../services/translationService';

// Get screen dimensions for animations
const { width, height } = Dimensions.get('window');

// Language options with their native names
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
];

export default function LanguageSelection() {
  const router = useRouter();
  const { currentLanguage, changeLanguage } = useLanguageContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Original English text (never changes)
  const originalTexts = {
    title: 'Select Your Language',
    searchPlaceholder: 'Search languages...',
    continue: 'Continue',
    loading: 'Loading...'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Hide route group header
  useEffect(() => {
    // Set the header title to empty
    router.setParams({ headerTitle: '' });
  }, []);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      console.log('Loading translations for language:', currentLanguage);
      
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`Translating "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`Translation result: "${translated.translatedText}"`);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Language screen translation error:', error);
        // Fallback to original text on error
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(1))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];
  const translateYAnim = useState(new Animated.Value(0))[0];
  
  // Clear ALL data when this screen loads to ensure a fresh start
  useEffect(() => {
    const clearAllData = async () => {
      try {
        console.log('Completely resetting app data');
        // Sign out of Supabase
        await supabase.auth.signOut();
        
        // Clear ALL AsyncStorage keys for a completely fresh start
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys);
        
        console.log('All app data cleared successfully');
      } catch (error) {
        console.error('Error clearing app data:', error);
      }
    };
    
    clearAllData();
  }, []);
  
  // Animation function
  const animateTransition = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: -50,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleLanguageSelect = async (selectedLanguage: string) => {
    console.log(`Language selected: ${selectedLanguage}`);
    setIsLoading(true);
    
    try {
      // Use LanguageContext to properly save language (this will handle all storage keys)
      const speechCode = selectedLanguage === 'en' ? 'en-US' : `${selectedLanguage}-IN`;
      
      // Wait for language change to complete before navigation
      await changeLanguage(selectedLanguage, speechCode);
      
      // Mark language selection as completed
      await AsyncStorage.setItem('hasCompletedLanguageSelection', 'true');
      
      console.log('Language saved via LanguageContext, navigating to login screen');
      
      // Start transition animation
      animateTransition();
      
      // Give animation time to complete before navigation
      setTimeout(() => {
        // Use replace to avoid duplicate screens in the navigation stack
        router.replace('/(auth)/login');
      }, 600);
    } catch (error) {
      console.error('Error during language selection:', error);
      setIsLoading(false);
      // Show error if needed
    }
  };
  
  // Filter languages based on search query
  const filteredLanguages = LANGUAGES.filter(lang => 
    (lang?.name ?? '').toLowerCase().includes((searchQuery ?? '').toLowerCase())
  );
  
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim }
          ]
        }
      ]}
    >
      <SystemStatusBar style="dark" />
      
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={styles.logo}
        />
        <Text variant="headlineMedium" style={styles.appName}>
          Dukaaon
        </Text>
      </View>
      
      <Text variant="titleLarge" style={styles.title}>
        {translations.title}
      </Text>
      
      <Searchbar
        placeholder={translations.searchPlaceholder}
        onChangeText={setSearchQuery}
        value={searchQuery ?? ''}
          style={styles.searchbar}
          iconColor="#FF7D00"
          disabled={isLoading}
        />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.languages}>
          {filteredLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton, 
                currentLanguage === lang.code && styles.activeLanguage
              ]}
              onPress={() => handleLanguageSelect(lang.code)}
              disabled={isLoading}
            >
              <Text variant="titleMedium" style={styles.languageText}>
                {String(lang?.name ?? 'Language')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF7D00" />
          <Text style={styles.loadingText}>{translations.loading}</Text>
        </View>
      ) : (
        <Button 
          mode="contained"
          onPress={() => handleLanguageSelect(currentLanguage ?? 'en')}
          style={styles.continueButton}
          disabled={isLoading}
        >
          {translations.continue}
        </Button>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logo: {
    width: 200,
    height: 85,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  appName: {
    fontWeight: 'bold',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  searchbar: {
    marginBottom: 20,
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    elevation: 0,
  },
  scrollView: {
    width: '100%',
    marginBottom: 20,
  },
  languages: {
    width: '100%',
    paddingBottom: 20,
  },
  languageButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  activeLanguage: {
    backgroundColor: '#ffe0b2',
    borderColor: '#FF7D00',
    borderWidth: 2,
  },
  languageText: {
    fontWeight: '500',
  },
  continueButton: {
    width: '100%',
    paddingVertical: 6,
    marginVertical: 12,
  },
  loadingContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
});

