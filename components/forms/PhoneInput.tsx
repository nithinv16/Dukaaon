import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const { currentLanguage } = useLanguage();
  
  // Original English text (never changes)
  const originalTexts = {
    phoneNumber: 'Phone Number'
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
        console.error('PhoneInput translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);
  
  const handleChange = (text: string) => {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) {
      onChange(cleaned);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        label={translations.phoneNumber}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={10}
        left={<TextInput.Affix text="+91" />}
        error={!!error}
      />
      {error && <HelperText type="error">{String(error ?? '')}</HelperText>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
});