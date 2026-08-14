import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settings';
import { supabase } from '../services/supabase/supabase';
import { getCurrentUser } from '../services/auth/authService';
import { useAuthStore } from '../store/auth';
import { subscribeToAuthChanges } from '../utils/authSync';
import { proxyTranslate } from '../services/ai/aiProxyClient';

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
  isLanguageReady: boolean; // True when language has been loaded from storage
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

// Translation is served by the `ai-translate` edge function. No provider
// endpoint or credential belongs in the client.

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
  // Get initial language from settings store (Zustand loads faster than AsyncStorage)
  const { setLanguage, language: settingsLanguage } = useSettingsStore();

  // Use settings store language as initial value - this is available synchronously!
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(settingsLanguage || 'en');
  const [isLoading, setIsLoading] = useState(false);
  const [isLanguageReady, setIsLanguageReady] = useState(false); // Track when language is loaded
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});

  // Initialize language from storage - runs immediately on mount
  useEffect(() => {
    initializeLanguage();
    loadTranslationCache();
  }, []);

  const initializeLanguage = async () => {
    try {
      // First check if settings store already has a language (loads faster)
      const storeLanguage = useSettingsStore.getState().language;
      if (storeLanguage && storeLanguage !== 'en' && SUPPORTED_LANGUAGES.find(lang => lang.code === storeLanguage)) {
        console.log(`[LanguageContext] Using language from settings store: ${storeLanguage}`);
        setCurrentLanguage(storeLanguage as SupportedLanguage);
      }

      // Then check AsyncStorage for the authoritative value
      const storedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_LANGUAGE);
      console.log(`[LanguageContext] Loaded language from AsyncStorage: ${storedLanguage}`);
      if (storedLanguage && SUPPORTED_LANGUAGES.find(lang => lang.code === storedLanguage)) {
        setCurrentLanguage(storedLanguage as SupportedLanguage);
        setLanguage(storedLanguage as SupportedLanguage);
        console.log(`[LanguageContext] Set currentLanguage to: ${storedLanguage}`);
      } else if (storeLanguage && storeLanguage !== 'en') {
        // AsyncStorage doesn't have it, but settings store does - sync them
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_LANGUAGE, storeLanguage);
        console.log(`[LanguageContext] Synced AsyncStorage with settings store: ${storeLanguage}`);
      }
    } catch (error) {
      console.error('Error loading language from storage:', error);
    } finally {
      // Mark language as ready regardless of success/failure
      setIsLanguageReady(true);
      console.log('[LanguageContext] Language initialization complete');
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

  // Sync language to profiles table when user becomes authenticated
  useEffect(() => {
    const syncLanguageToProfile = async (user: any) => {
      try {
        if (!user?.id) {
          return; // No authenticated user yet
        }

        // Get current language from AsyncStorage (the source of truth)
        const storedLanguage = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_LANGUAGE);
        if (!storedLanguage) {
          return; // No language preference stored
        }

        // Check if profile already has this language (avoid unnecessary updates)
        if (user.language === storedLanguage) {
          return; // Already synced
        }

        // Update language in profiles table
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ language: storedLanguage as SupportedLanguage })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error syncing language to profiles table:', updateError);
        } else {
          console.log(`Language synced to profiles table for user ${user.id}: ${storedLanguage}`);
        }
      } catch (error) {
        console.error('Error in syncLanguageToProfile:', error);
      }
    };

    // Subscribe to auth store changes to detect when user becomes authenticated
    const unsubscribe = subscribeToAuthChanges((user) => {
      if (user?.id) {
        syncLanguageToProfile(user);
      }
    });

    // Also check immediately in case user is already authenticated
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id) {
      syncLanguageToProfile(currentUser);
    }

    return () => {
      unsubscribe();
    };
  }, []); // Run once on mount

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
        // Try to get user ID from auth store first (more reliable)
        const authStoreUser = useAuthStore.getState().user;
        let userId: string | null = null;

        if (authStoreUser?.id) {
          userId = authStoreUser.id;
        } else {
          // Fallback to getCurrentUser if auth store doesn't have user
          const user = await getCurrentUser();
          if (user?.id) {
            userId = user.id;
          }
        }

        if (userId) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ language: language })
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating language in profiles table:', updateError);
            // Don't throw here - we want the language change to succeed locally even if DB update fails
          } else {
            console.log(`Language updated in profiles table for user ${userId}: ${language}`);
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

  /**
   * Translate via the ai-translate edge function (AWS Translate).
   *
   * This was a second, duplicate Azure Translator implementation living inside a
   * provider that wraps the entire app — with the same live subscription key
   * hardcoded as a fallback that services/translationService.ts had. Both are now
   * behind the proxy, so no translation credential exists in the client.
   */
  const translateRemote = async (text: string, targetLanguage: SupportedLanguage): Promise<string> => {
    const [translated] = await proxyTranslate([text], targetLanguage);
    return translated || text;
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
      // Translate via the ai-translate edge function
      const translatedText = await translateRemote(text, target);

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
    isLanguageReady,
    changeLanguage,
    translate,
    translateText,
    clearTranslationCache,
  };

  // Don't render children until language is ready to prevent flash-to-English
  // This ensures components get the correct language on first render
  if (!isLanguageReady) {
    // Return provider with null children to prevent context errors
    // The brief delay (typically <100ms) is better than showing wrong translations
    return (
      <LanguageContext.Provider value={contextValue}>
        {null}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// Default context value for when provider is not yet mounted (during initial render)
const DEFAULT_LANGUAGE_CONTEXT: LanguageContextType = {
  currentLanguage: 'en',
  availableLanguages: SUPPORTED_LANGUAGES,
  isLoading: false,
  isLanguageReady: false,
  changeLanguage: async () => { console.warn('[useLanguage] Provider not ready, changeLanguage ignored'); },
  translate: async (text: string) => text,
  translateText: async (text: string) => text,
  clearTranslationCache: async () => { console.warn('[useLanguage] Provider not ready, clearTranslationCache ignored'); },
};

// Hook to use language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // During initial render, context might not be available yet
    // Return default values instead of crashing to handle race conditions
    console.warn('[useLanguage] Context not available, using default values. This may happen during initial render.');
    return DEFAULT_LANGUAGE_CONTEXT;
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