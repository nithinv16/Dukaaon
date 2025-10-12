import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface UseAzureTranslationOptions {
  immediate?: boolean; // Whether to translate immediately on mount
  fallback?: string; // Fallback text if translation fails
}

interface TranslationState {
  translatedText: string;
  isTranslating: boolean;
  error: string | null;
}

/**
 * Comprehensive hook for Azure translation with performance optimization
 * Provides both immediate and on-demand translation capabilities
 */
export const useAzureTranslation = (
  originalText: string,
  options: UseAzureTranslationOptions = {}
) => {
  const { immediate = false, fallback } = options;
  const { currentLanguage, translateText, t } = useLanguage();
  
  const [state, setState] = useState<TranslationState>({
    translatedText: originalText,
    isTranslating: false,
    error: null,
  });

  // Function to perform translation
  const performTranslation = useCallback(async (text: string) => {
    if (!text.trim() || currentLanguage === 'en') {
      setState(prev => ({
        ...prev,
        translatedText: text,
        isTranslating: false,
        error: null,
      }));
      return text;
    }

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const translated = await translateText(text);
      setState(prev => ({
        ...prev,
        translatedText: translated,
        isTranslating: false,
        error: null,
      }));
      return translated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      const fallbackText = fallback || text;
      
      setState(prev => ({
        ...prev,
        translatedText: fallbackText,
        isTranslating: false,
        error: errorMessage,
      }));
      return fallbackText;
    }
  }, [currentLanguage, translateText, fallback]);

  // Effect for immediate translation
  useEffect(() => {
    if (immediate && originalText) {
      performTranslation(originalText);
    } else {
      setState(prev => ({
        ...prev,
        translatedText: originalText,
        isTranslating: false,
        error: null,
      }));
    }
  }, [originalText, immediate, performTranslation]);

  // Effect for language changes
  useEffect(() => {
    if (originalText) {
      performTranslation(originalText);
    }
  }, [currentLanguage, originalText, performTranslation]);

  // Manual translation trigger
  const translateNow = useCallback(() => {
    return performTranslation(originalText);
  }, [originalText, performTranslation]);

  return {
    ...state,
    translateNow,
    currentLanguage,
  };
};

/**
 * Hook for translating multiple texts at once
 * Useful for components with multiple text elements
 */
export const useMultipleTranslations = (
  texts: Record<string, string>,
  options: UseAzureTranslationOptions = {}
) => {
  const { immediate = false } = options;
  const { currentLanguage, translateText } = useLanguage();
  
  // Memoize the texts object to prevent unnecessary re-renders
  const memoizedTexts = useMemo(() => texts, [JSON.stringify(texts)]);
  
  const [translations, setTranslations] = useState<Record<string, string>>(memoizedTexts);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const translateAll = useCallback(async () => {
    if (currentLanguage === 'en') {
      setTranslations(memoizedTexts);
      setIsTranslating(false);
      setErrors({});
      return memoizedTexts;
    }

    setIsTranslating(true);
    setErrors({});

    const translationPromises = Object.entries(memoizedTexts).map(async ([key, text]) => {
      try {
        const translated = await translateText(text);
        return { key, translated, error: null };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        return { key, translated: text, error: errorMessage };
      }
    });

    try {
      const results = await Promise.all(translationPromises);
      const newTranslations: Record<string, string> = {};
      const newErrors: Record<string, string | null> = {};

      results.forEach(({ key, translated, error }) => {
        newTranslations[key] = translated;
        newErrors[key] = error;
      });

      setTranslations(newTranslations);
      setErrors(newErrors);
      setIsTranslating(false);

      return newTranslations;
    } catch (error) {
      console.error('Batch translation error:', error);
      setTranslations(memoizedTexts);
      setIsTranslating(false);
      return memoizedTexts;
    }
  }, [memoizedTexts, currentLanguage, translateText]);

  // Effect for immediate translation
  useEffect(() => {
    if (immediate) {
      translateAll();
    } else {
      setTranslations(memoizedTexts);
      setIsTranslating(false);
      setErrors({});
    }
  }, [immediate, translateAll, memoizedTexts]);

  // Effect for language changes
  useEffect(() => {
    translateAll();
  }, [currentLanguage, translateAll]);

  return {
    translations,
    isTranslating,
    errors,
    translateAll,
    currentLanguage,
  };
};

/**
 * Hook for real-time text translation as user types
 * Includes debouncing to prevent excessive API calls
 */
export const useRealtimeTranslation = (
  text: string,
  debounceMs: number = 500
) => {
  const { currentLanguage, translateText } = useLanguage();
  const [translatedText, setTranslatedText] = useState(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!text.trim() || currentLanguage === 'en') {
      setTranslatedText(text);
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);
    
    const timeoutId = setTimeout(async () => {
      try {
        const translated = await translateText(text);
        setTranslatedText(translated);
      } catch (error) {
        console.error('Realtime translation error:', error);
        setTranslatedText(text);
      } finally {
        setIsTranslating(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [text, currentLanguage, translateText, debounceMs]);

  return {
    translatedText,
    isTranslating,
    currentLanguage,
  };
};

export default useAzureTranslation;