import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settings';
import { supabase } from '../services/supabase/supabase';
import { getCurrentUser } from '../services/auth/authService';

// Language types
export type SupportedLanguage = 'en' | 'hi' | 'ml' | 'ta' | 'te' | 'kn' | 'mr' | 'bn';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  localizedName: string;
  speechCode: string;
}

// Translation cache interface
interface TranslationCache {
  [key: string]: {
    [targetLang: string]: {
      text: string;
      timestamp: number;
    };
  };
}

// Context interface
interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  availableLanguages: LanguageInfo[];
  isLoading: boolean;
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
  translate: (text: string, targetLanguage?: SupportedLanguage) => Promise<string>;
  translateText: (text: string) => Promise<string>;
  clearTranslationCache: () => Promise<void>;
}

// Language definitions
const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', localizedName: 'English', speechCode: 'en-US' },
  { code: 'hi', name: 'Hindi', localizedName: 'हिंदी', speechCode: 'hi-IN' },
  { code: 'ml', name: 'Malayalam', localizedName: 'മലയാളം', speechCode: 'ml-IN' },
  { code: 'ta', name: 'Tamil', localizedName: 'தமிழ்', speechCode: 'ta-IN' },
  { code: 'te', name: 'Telugu', localizedName: 'తెలుగు', speechCode: 'te-IN' },
  { code: 'kn', name: 'Kannada', localizedName: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { code: 'mr', name: 'Marathi', localizedName: 'मराठी', speechCode: 'mr-IN' },
  { code: 'bn', name: 'Bengali', localizedName: 'বাংলা', speechCode: 'bn-IN' },
];

// Azure Translator configuration
const AZURE_TRANSLATOR_CONFIG = {
  key: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd',
  region: process.env.EXPO_PUBLIC_AZURE_TRANSLATOR_REGION || 'eastus2',
  endpoint: 'https://api.cognitive.microsofttranslator.com',
};

// Storage keys
const STORAGE_KEYS = {
  CURRENT_LANGUAGE: 'app_current_language',
  TRANSLATION_CACHE: 'app_translation_cache',
  CACHE_TIMESTAMP: 'app_cache_timestamp',
};

// Cache expiry (7 days)
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Create context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Provider component
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const [isLoading, setIsLoading] = useState(false);
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  
  const { setLanguage } = useSettingsStore();

  // Initialize language from storage
  useEffect(() => {
    initializeLanguage();
    loadTranslationCache();
  }, []);

  const initializeLanguage = async () => {
    try {
      const storedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_LANGUAGE);
      if (storedLanguage && SUPPORTED_LANGUAGES.find(lang => lang.code === storedLanguage)) {
        setCurrentLanguage(storedLanguage as SupportedLanguage);
        setLanguage(storedLanguage as SupportedLanguage);
      }
    } catch (error) {
      console.error('Error loading language from storage:', error);
    }
  };

  const loadTranslationCache = async () => {
    try {
      const [cacheData, cacheTimestamp] = await AsyncStorage.multiGet([
        STORAGE_KEYS.TRANSLATION_CACHE,
        STORAGE_KEYS.CACHE_TIMESTAMP,
      ]);

      const cache = cacheData[1] ? JSON.parse(cacheData[1]) : {};
      const timestamp = cacheTimestamp[1] ? parseInt(cacheTimestamp[1]) : 0;

      // Check if cache is expired
      if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
        await clearTranslationCache();
      } else {
        setTranslationCache(cache);
      }
    } catch (error) {
      console.error('Error loading translation cache:', error);
    }
  };

  const saveTranslationCache = async (cache: TranslationCache) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TRANSLATION_CACHE, JSON.stringify(cache)],
        [STORAGE_KEYS.CACHE_TIMESTAMP, Date.now().toString()],
      ]);
    } catch (error) {
      console.error('Error saving translation cache:', error);
    }
  };

  const clearTranslationCache = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TRANSLATION_CACHE,
        STORAGE_KEYS.CACHE_TIMESTAMP,
      ]);
      setTranslationCache({});
      console.log('Translation cache cleared');
    } catch (error) {
      console.error('Error clearing translation cache:', error);
    }
  }, []);

  const changeLanguage = useCallback(async (language: SupportedLanguage) => {
    if (language === currentLanguage) return;

    setIsLoading(true);
    try {
      // Update state
      setCurrentLanguage(language);
      setLanguage(language);

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_LANGUAGE, language);

      // Update language in profiles table
      try {
        const user = await getCurrentUser();
        if (user && user.id) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ language: language })
            .eq('id', user.id);

          if (updateError) {
            console.error('Error updating language in profiles table:', updateError);
            // Don't throw here - we want the language change to succeed locally even if DB update fails
          } else {
            console.log(`Language updated in profiles table for user ${user.id}: ${language}`);
          }
        } else {
          console.warn('No authenticated user found, skipping database language update');
        }
      } catch (dbError) {
        console.error('Error during database language update:', dbError);
        // Don't throw here - we want the language change to succeed locally even if DB update fails
      }

      console.log(`Language changed to: ${language}`);
    } catch (error) {
      console.error('Error changing language:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentLanguage, setLanguage]);

  const translateWithAzure = async (text: string, targetLanguage: SupportedLanguage): Promise<string> => {
    if (!AZURE_TRANSLATOR_CONFIG.key) {
      throw new Error('Azure Translator key not configured');
    }

    const url = `${AZURE_TRANSLATOR_CONFIG.endpoint}/translate?api-version=3.0&to=${targetLanguage}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_CONFIG.key,
          'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_CONFIG.region,
          'Content-Type': 'application/json',
          'X-ClientTraceId': Math.random().toString(36).substring(2, 15),
        },
        body: JSON.stringify([{ text }]),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure Translation API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url,
          headers: response.headers
        });
        throw new Error(`Translation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result[0]?.translations[0]?.text || text;
    } catch (error) {
      console.error('Azure Translation Error Details:', error);
      throw error;
    }
  };

  const translate = useCallback(async (text: string, targetLanguage?: SupportedLanguage): Promise<string> => {
    const target = targetLanguage || currentLanguage;
    
    // Return original text if target is English or same as source
    if (target === 'en' || !text.trim()) {
      return text;
    }

    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (translationCache[cacheKey]?.[target]) {
      const cached = translationCache[cacheKey][target];
      // Check if cache entry is still valid
      if (Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        return cached.text;
      }
    }

    try {
      // Translate using Azure
      const translatedText = await translateWithAzure(text, target);

      // Update cache
      const newCache = { ...translationCache };
      if (!newCache[cacheKey]) {
        newCache[cacheKey] = {};
      }
      newCache[cacheKey][target] = {
        text: translatedText,
        timestamp: Date.now(),
      };

      setTranslationCache(newCache);
      saveTranslationCache(newCache);

      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      // Log more details about the error for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Return original text on error
      return text;
    }
  }, [currentLanguage, translationCache]);

  // Direct text translation function
  const translateText = useCallback(async (text: string): Promise<string> => {
    return await translate(text, currentLanguage);
  }, [currentLanguage, translate]);

  const contextValue: LanguageContextType = {
    currentLanguage,
    availableLanguages: SUPPORTED_LANGUAGES,
    isLoading,
    changeLanguage,
    translate,
    translateText,
    clearTranslationCache,
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Hook for translation (compatibility with existing code)
export const useTranslation = () => {
  try {
    const context = useContext(LanguageContext);
    if (!context) {
      console.warn('useTranslation: Context not available, returning fallback functions');
      return {
        translate: (text: string) => text,
        translateText: (text: string) => Promise.resolve({ translatedText: text })
      };
    }
    const { translate, translateText } = context;
    return { translate, translateText };
  } catch (error) {
    console.error('useTranslation error:', error);
    return {
      translate: (text: string) => text,
      translateText: (text: string) => Promise.resolve({ translatedText: text })
    };
  }
};

// Export default
export default LanguageProvider;