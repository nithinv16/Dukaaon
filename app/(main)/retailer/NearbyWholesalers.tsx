import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function NearbyWholesalers() {
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({
    nearbySellers: 'Nearby Sellers',
    testSeller: 'Test Seller',
    componentRendering: 'If you can see this, the component is rendering'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translatedTexts = await Promise.all([
          translationService.translateText('Nearby Sellers', currentLanguage),
          translationService.translateText('Test Seller', currentLanguage),
          translationService.translateText('If you can see this, the component is rendering', currentLanguage)
        ]);

        setTranslations({
          nearbySellers: translatedTexts[0].translatedText,
          testSeller: translatedTexts[1].translatedText,
          componentRendering: translatedTexts[2].translatedText
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translations.nearbySellers}</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text>{translations.testSeller}</Text>
          <Text>{translations.componentRendering}</Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    marginVertical: 8,
  },
});
