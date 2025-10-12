import { translationService } from '../services/translationService';
import { useLanguage } from '../contexts/LanguageContext';

// Debounce utility for batch processing
const debounceMap = new Map<string, NodeJS.Timeout>();

/**
 * Optimized utility function to translate specific fields in an array of objects using batch processing
 * @param items Array of objects to translate
 * @param fields Array of field names to translate
 * @param targetLanguage Target language (defaults to current language)
 * @returns Promise<Array> Translated array of objects
 */
export const translateArrayFields = async <T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[],
  targetLanguage?: string
): Promise<T[]> => {
  if (!items || items.length === 0) {
    return items;
  }

  // Return immediately if target language is English
  if (targetLanguage === 'en') {
    return items;
  }

  try {
    // Create a copy of the items to avoid mutation
    const translatedItems = [...items];

    // Collect all unique texts to translate
    const textsToTranslate: string[] = [];
    const textIndexMap = new Map<string, { itemIndex: number; field: keyof T }[]>();

    // Build the batch of texts to translate
    for (let i = 0; i < translatedItems.length; i++) {
      const item = translatedItems[i];
      
      for (const field of fields) {
        const value = item[field];
        if (value && typeof value === 'string' && value.trim()) {
          const trimmedValue = value.trim();
          
          if (!textIndexMap.has(trimmedValue)) {
            textIndexMap.set(trimmedValue, []);
            textsToTranslate.push(trimmedValue);
          }
          
          textIndexMap.get(trimmedValue)!.push({ itemIndex: i, field });
        }
      }
    }

    // If no texts to translate, return original items
    if (textsToTranslate.length === 0) {
      return translatedItems;
    }

    // Use batch translation for better performance
    const translationResults = await translationService.translateBatch(
      textsToTranslate,
      targetLanguage as any || 'en'
    );

    // Apply translations back to the items
    translationResults.forEach((result, index) => {
      const originalText = textsToTranslate[index];
      const translatedText = result.translatedText;
      const positions = textIndexMap.get(originalText);

      if (positions) {
        positions.forEach(({ itemIndex, field }) => {
          translatedItems[itemIndex][field] = translatedText;
        });
      }
    });

    return translatedItems;
  } catch (error) {
    console.error('Error in translateArrayFields:', error);
    return items; // Return original items on error
  }
};

/**
 * Hook for dynamic translation utilities
 * @returns Object with translation utility functions
 */
export const useTranslateDynamic = () => {
  return {
    translateArrayFields,
  };
};

export default {
  translateArrayFields,
  useTranslateDynamic,
};