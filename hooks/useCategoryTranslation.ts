/**
 * React Hook for Category and Subcategory Translation
 * 
 * This hook provides easy-to-use functions for translating categories and subcategories
 * in React components using the translation system.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translationService } from '../services/translationService';

export interface CategoryTranslationHook {
  /**
   * Translates a category or subcategory name
   * @param name - The name to translate
   * @param isCategory - Whether this is a category (true) or subcategory (false)
   * @returns Translated name or original if translation not found
   */
  translateCategoryOrSubcategory: (name: string, isCategory: boolean) => string;

  /**
   * Translates a category name
   * @param categoryName - The category name to translate
   * @returns Translated category name or original if translation not found
   */
  translateCategory: (categoryName: string) => string;

  /**
   * Translates a subcategory name
   * @param subcategoryName - The subcategory name to translate
   * @returns Translated subcategory name or original if translation not found
   */
  translateSubcategory: (subcategoryName: string) => string;

  /**
   * Translates multiple category/subcategory names
   * @param items - Array of objects with name and isCategory properties
   * @returns Array of translated names
   */
  translateMultiple: (items: Array<{ name: string; isCategory: boolean }>) => string[];
}

/**
 * Hook for translating categories and subcategories
 * Uses translationService for proper multilingual support
 * @returns Object with translation functions
 */
export const useCategoryTranslation = (): CategoryTranslationHook => {
  const { currentLanguage } = useLanguage();
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});
  const pendingTranslations = useRef<Set<string>>(new Set());

  // Clear cache when language changes
  useEffect(() => {
    setTranslationCache({});
    pendingTranslations.current.clear();
  }, [currentLanguage]);

  // Get cached translation synchronously - DOES NOT update state during render
  const getTranslation = useCallback((name: string): string => {
    // Return original for English  
    if (currentLanguage === 'en' || !name) {
      return name;
    }

    // Check local cache first
    const cacheKey = `${name}__${currentLanguage}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    // Check translationService cache synchronously
    const cachedTranslation = translationService.getCachedTranslationSync(name, currentLanguage);
    if (cachedTranslation) {
      // Schedule cache update for after render (using setTimeout to avoid setState during render)
      if (!pendingTranslations.current.has(cacheKey)) {
        pendingTranslations.current.add(cacheKey);
        setTimeout(() => {
          setTranslationCache(prev => ({ ...prev, [cacheKey]: cachedTranslation }));
          pendingTranslations.current.delete(cacheKey);
        }, 0);
      }
      return cachedTranslation;
    }

    // Trigger background translation (non-blocking, after render)
    if (!pendingTranslations.current.has(cacheKey)) {
      pendingTranslations.current.add(cacheKey);
      setTimeout(() => {
        translationService.translateText(name, currentLanguage)
          .then(result => {
            if (result?.translatedText) {
              setTranslationCache(prev => ({ ...prev, [cacheKey]: result.translatedText }));
            }
            pendingTranslations.current.delete(cacheKey);
          })
          .catch(() => {
            pendingTranslations.current.delete(cacheKey);
          });
      }, 0);
    }

    // Return original while translation loads
    return name;
  }, [currentLanguage, translationCache]);

  const translateCategoryOrSubcategory = useCallback((name: string, _isCategory: boolean): string => {
    return getTranslation(name);
  }, [getTranslation]);

  const translateCategory = useCallback((categoryName: string): string => {
    return getTranslation(categoryName);
  }, [getTranslation]);

  const translateSubcategory = useCallback((subcategoryName: string): string => {
    return getTranslation(subcategoryName);
  }, [getTranslation]);

  const translateMultiple = useCallback((items: Array<{ name: string; isCategory: boolean }>): string[] => {
    return items.map(item => translateCategoryOrSubcategory(item.name, item.isCategory));
  }, [translateCategoryOrSubcategory]);

  return {
    translateCategoryOrSubcategory,
    translateCategory,
    translateSubcategory,
    translateMultiple,
  };
};