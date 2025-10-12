import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
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

export default function LanguageSettings() {
  const router = useRouter();
  const { setLanguage } = useSettingsStore();
  const { currentLanguage, availableLanguages, changeLanguage, isLoading, clearTranslationCache } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  
  // Original English text (never changes)
  const originalTexts = {
    title: 'Language Settings',
    searchPlaceholder: 'Search languages...',
    languageChanged: 'Language changed successfully!',
    error: 'Error changing language',
    loading: 'Changing language...'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      console.log('Loading settings translations for language:', currentLanguage);
      
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`Translating settings "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`Settings translation result: "${translated.translatedText}"`);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('All settings translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Language settings translation error:', error);
        // Fallback to original text on error
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleLanguageChange = async (selectedLanguage: string) => {
    if (selectedLanguage === currentLanguage) return;
    
    setIsChangingLanguage(true);
    
    try {
      // Clear translation cache before changing language
      await clearTranslationCache();
      
      // Change language using context
      const speechCode = selectedLanguage === 'en' ? 'en-US' : `${selectedLanguage}-IN`;
      await changeLanguage(selectedLanguage, speechCode);
      
      // Update settings store
      setLanguage(selectedLanguage);
      
      // Show success alert
      Alert.alert(translations.languageChanged);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(translations.error);
    } finally {
      setIsChangingLanguage(false);
    }
  };

  // Filter languages based on search query
  const filteredLanguages = LANGUAGES.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
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
        disabled={isChangingLanguage}
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

