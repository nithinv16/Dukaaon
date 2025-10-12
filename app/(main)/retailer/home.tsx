import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import NearbyWholesalers from './NearbyWholesalers';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function RetailerHome() {
  const [showSellers, setShowSellers] = useState(false);
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({
    retailerHome: 'Retailer Home',
    showSellers: 'Show Sellers',
    browseByCategories: 'Browse by Categories'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      console.log('RetailerHome: Current language changed to:', currentLanguage);
      
      if (currentLanguage === 'en') {
        console.log('RetailerHome: Language is English, skipping translation');
        return;
      }
      
      console.log('RetailerHome: Starting translation for language:', currentLanguage);
      console.log('RetailerHome: Translations to translate:', translations);
      
      try {
        const translationPromises = Object.entries(translations).map(async ([key, value]) => {
          console.log(`RetailerHome: Translating "${key}": "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`RetailerHome: Translation result for "${key}":`, translated);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('RetailerHome: All translations completed:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleWholesalerPress = (wholesalerId: string) => {
    router.push(`/retailer/wholesaler/${wholesalerId}`);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.header}>
        {translations.retailerHome}
      </Text>

      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={() => setShowSellers(true)}
          style={styles.button}
        >
          {translations.showSellers}
        </Button>

        <Button 
          mode="contained" 
          onPress={() => router.push('/(main)/retailer/categories')}
          style={styles.button}
        >
          {translations.browseByCategories}
        </Button>
      </View>

      {showSellers && (
        <View style={styles.sellersContainer}>
          <NearbyWholesalers />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    marginVertical: 4,
  },
  sellersContainer: {
    flex: 1,
  },
});
