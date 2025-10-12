import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguageStore } from '../store/language';

export const useLanguage = () => {
  const { language, setLanguage } = useLanguageStore();

  useEffect(() => {
    loadStoredLanguage();
  }, []);

  const loadStoredLanguage = async () => {
    try {
      const storedLanguage = await AsyncStorage.getItem('user-language');
      if (storedLanguage) {
        setLanguage(storedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  return { language, setLanguage };
};