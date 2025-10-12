import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

interface RoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  console.log('RoleSelector rendered with value:', value);
  
  const { currentLanguage } = useLanguage();
  
  // Original English text (never changes)
  const originalTexts = {
    retailer: 'Retailer',
    seller: 'Seller'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('RoleSelector translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Memoize the button labels to prevent infinite re-renders
  const buttons = useMemo(() => [
    { 
      value: 'retailer', 
      label: translations.retailer,
      style: value === 'retailer' ? styles.selectedButton : undefined
    },
    { 
      value: 'seller', 
      label: translations.seller,
      style: value === 'seller' ? styles.selectedButton : undefined
    },
  ], [value, translations]);

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={value}
        onValueChange={onChange}
        buttons={buttons}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  selectedButton: {
    backgroundColor: '#2196F3',
  },
});