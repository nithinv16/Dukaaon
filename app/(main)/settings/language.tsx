import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Searchbar, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useSettingsStore } from '../../../store/settings';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

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

// Original English text (never changes) - defined outside component to prevent recreation
const ORIGINAL_TEXTS = {
  title: 'Language Settings',
  searchPlaceholder: 'Search languages...',
  languageChanged: 'Language changed successfully!',
  error: 'Error changing language',
  loading: 'Changing language...'
};

export default function LanguageSettings() {
  const router = useRouter();
  const { setLanguage } = useSettingsStore();
  const { currentLanguage, changeLanguage, isLoading } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track current language change request to cancel stale requests
  const languageChangeIdRef = useRef(0);

  // Dynamic translations state
  const [translations, setTranslations] = useState(ORIGINAL_TEXTS);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load translations when language changes - with proper cancellation
  useEffect(() => {
    // Skip translation loading during language change to prevent race conditions
    if (isChangingLanguage) {
      return;
    }

    const currentRequestId = ++languageChangeIdRef.current;

    const loadTranslations = async () => {
      console.log('Loading settings translations for language:', currentLanguage);

      if (currentLanguage === 'en') {
        if (isMountedRef.current && currentRequestId === languageChangeIdRef.current) {
          setTranslations(ORIGINAL_TEXTS);
        }
        return;
      }

      try {
        // Add a timeout to prevent indefinite waits
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Translation timeout')), 10000)
        );

        const translationPromise = (async () => {
          const translationPromises = Object.entries(ORIGINAL_TEXTS).map(async ([key, value]) => {
            const translated = await translationService.translateText(value, currentLanguage);
            return [key, translated.translatedText];
          });
          return Promise.all(translationPromises);
        })();

        const translatedEntries = await Promise.race([translationPromise, timeoutPromise]) as [string, string][];

        // Only update state if this is still the current request and component is mounted
        if (isMountedRef.current && currentRequestId === languageChangeIdRef.current) {
          const newTranslations = Object.fromEntries(translatedEntries) as typeof ORIGINAL_TEXTS;
          console.log('All settings translations loaded:', newTranslations);
          setTranslations(newTranslations);
        }
      } catch (error) {
        console.error('Language settings translation error:', error);
        // Fallback to original text on error
        if (isMountedRef.current && currentRequestId === languageChangeIdRef.current) {
          setTranslations(ORIGINAL_TEXTS);
        }
      }
    };

    loadTranslations();
  }, [currentLanguage, isChangingLanguage]);

  const handleLanguageChange = useCallback(async (selectedLanguage: string) => {
    if (selectedLanguage === currentLanguage) return;

    setIsChangingLanguage(true);
    // Increment request ID to cancel any in-flight translation requests
    languageChangeIdRef.current++;

    try {
      // Change language using context (don't clear cache before - let new translations use cache if available)
      await changeLanguage(selectedLanguage as any);

      // Update settings store
      setLanguage(selectedLanguage as any);

      if (isMountedRef.current) {
        // Show success alert
        Alert.alert(ORIGINAL_TEXTS.languageChanged);
      }
    } catch (error) {
      console.error('Error changing language:', error);
      if (isMountedRef.current) {
        Alert.alert(ORIGINAL_TEXTS.error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsChangingLanguage(false);
      }
    }
  }, [currentLanguage, changeLanguage, setLanguage]);

  // Filter languages based on search query
  const filteredLanguages = LANGUAGES.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Language Settings',
          headerShown: true,
          headerBackTitleVisible: false,
        }}
      />
      <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {translations.title}
      </Text>

      <Searchbar
        placeholder={translations.searchPlaceholder}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
        iconColor="#FF7D00"
        editable={!isChangingLanguage}
      />

      <View style={styles.languages}>
        {filteredLanguages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageButton,
              currentLanguage === lang.code && styles.activeLanguage
            ]}
            onPress={() => handleLanguageChange(lang.code)}
            disabled={isChangingLanguage}
          >
            <Text variant="titleMedium" style={styles.languageText}>
              {lang.name}
            </Text>
            {currentLanguage === lang.code && (
              <Text style={styles.activeIndicator}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {isChangingLanguage && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF7D00" />
          <Text style={styles.loadingText}>{translations.loading}</Text>
        </View>
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  searchbar: {
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    elevation: 0,
  },
  languages: {
    flex: 1,
  },
  languageButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeLanguage: {
    backgroundColor: '#ffe0b2',
    borderColor: '#FF7D00',
    borderWidth: 2,
  },
  languageText: {
    fontWeight: '500',
    flex: 1,
  },
  activeIndicator: {
    color: '#FF7D00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
});

