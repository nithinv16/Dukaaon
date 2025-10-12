import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

const categories = [
  { id: '1', name: 'beverages', image: 'https://example.com/beverages.jpg' },
  { id: '2', name: 'snacks', image: 'https://example.com/snacks.jpg' },
  { id: '3', name: 'groceries', image: 'https://example.com/groceries.jpg' },
  // Add more categories
];

export default function CategoriesScreen() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  
  // Define original texts for translation
  const originalTexts = {
    categories: 'Categories',
    beverages: 'Beverages',
    snacks: 'Snacks',
    groceries: 'Groceries'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  // Translation function
  const getTranslatedText = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={getTranslatedText('categories')} />
      </Appbar.Header>

      <ScrollView>
        <View style={styles.grid}>
          {categories.map((category) => (
            <Card
              key={category.id}
              style={styles.card}
              onPress={() => router.push(`/retailer/categories/${category.name}`)}
            >
              <Card.Cover source={{ uri: category.image }} style={styles.cardImage} />
              <Card.Content>
                <Text variant="titleMedium" style={styles.categoryName}>
                  {getTranslatedText(category.name)}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 40,
    minHeight: 40,
    paddingTop: 0,
    marginTop: -50,
    backgroundColor: '#fff',
    elevation: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 16,
    elevation: 2,
  },
  cardImage: {
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  categoryName: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },
});