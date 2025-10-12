import { useCallback, useMemo, useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import { translationService, TranslationResult, SupportedLanguage } from '../services/translationService';

// Translation hook interface
export interface UseTranslationReturn {
  // Current language
  currentLanguage: SupportedLanguage;
  availableLanguages: Array<{
    code: SupportedLanguage;
    name: string;
    localizedName: string;
    speechCode: string;
  }>;
  
  // Language management
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
  isLoading: boolean;
  
  // Translation functions
  translate: (text: string, targetLanguage?: SupportedLanguage) => Promise<string>;
  translateBatch: (texts: string[], targetLanguage?: SupportedLanguage) => Promise<TranslationResult[]>;
  
  // Utility functions
  t: (key: string) => string;
  detectLanguage: (text: string) => Promise<{ language: string; confidence: number }>;
  clearCache: () => Promise<void>;
  
  // Cache management
  getCacheStats: () => { totalEntries: number; totalTranslations: number; cacheSize: string };
}

/**
 * Main translation hook that provides access to translation functions and language management
 */
export const useTranslation = () => {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  
  return context;
};

/**
 * Hook for simple text translation
 * Automatically translates text to current language
 */
export const useAutoTranslate = (text: string): string => {
  const { translate, currentLanguage } = useTranslation();
  const [translatedText, setTranslatedText] = React.useState(text);

  React.useEffect(() => {
    if (currentLanguage === 'en' || !text.trim()) {
      setTranslatedText(text);
      return;
    }

    let isCancelled = false;

    const translateText = async () => {
      try {
        const result = await translate(text);
        if (!isCancelled) {
          setTranslatedText(result);
        }
      } catch (error) {
        console.error('Auto-translation error:', error);
        if (!isCancelled) {
          setTranslatedText(text);
        }
      }
    };

    translateText();

    return () => {
      isCancelled = true;
    };
  }, [text, currentLanguage, translate]);

  return translatedText;
};

/**
 * Hook for translating multiple texts
 */
export const useBatchTranslation = (texts: string[]) => {
  const { translateBatch, currentLanguage } = useTranslation();
  const [translatedTexts, setTranslatedTexts] = React.useState<string[]>(texts);
  const [isTranslating, setIsTranslating] = React.useState(false);

  React.useEffect(() => {
    if (currentLanguage === 'en' || texts.length === 0) {
      setTranslatedTexts(texts);
      return;
    }

    let isCancelled = false;
    setIsTranslating(true);

    const translateTexts = async () => {
      try {
        const results = await translateBatch(texts);
        if (!isCancelled) {
          setTranslatedTexts(results.map(r => r.translatedText));
        }
      } catch (error) {
        console.error('Batch translation error:', error);
        if (!isCancelled) {
          setTranslatedTexts(texts);
        }
      } finally {
        if (!isCancelled) {
          setIsTranslating(false);
        }
      }
    };

    translateTexts();

    return () => {
      isCancelled = true;
      setIsTranslating(false);
    };
  }, [texts, currentLanguage, translateBatch]);

  return { translatedTexts, isTranslating };
};

// Import React for hooks
import React from 'react';

export default useTranslation;