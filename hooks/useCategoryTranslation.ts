/**
 * React Hook for Category and Subcategory Translation
 * 
 * This hook provides easy-to-use functions for translating categories and subcategories
 * in React components using the translation system.
 */

import { useTranslation } from '../contexts/LanguageContext';
import { 
  translateCategoryName, 
  translateSubcategoryName, 
  translateCategoryOrSubcategory as translateUtil 
} from '../utils/categoryTranslation';

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
 * @returns Object with translation functions
 */
export const useCategoryTranslation = (): CategoryTranslationHook => {
  // Create a synchronous translation function similar to other components
  const t = (key: string): string => {
    // Basic translation mappings for categories and subcategories
    const translations: Record<string, string> = {
      // Categories
      'categories.baby_care': 'Baby Care',
      'categories.beauty_personal_care': 'Beauty & Personal Care',
      'categories.beverages': 'Beverages',
      'categories.dairy_eggs': 'Dairy & Eggs',
      'categories.fruits_vegetables': 'Fruits & Vegetables',
      'categories.grains_cereals': 'Grains & Cereals',
      'categories.health_wellness': 'Health & Wellness',
      'categories.household_cleaning': 'Household & Cleaning',
      'categories.meat_seafood': 'Meat & Seafood',
      'categories.packaged_foods': 'Packaged Foods',
      'categories.snacks_confectionery': 'Snacks & Confectionery',
      'categories.spices_condiments': 'Spices & Condiments',
      
      // Subcategories
      'subcategories.baby_food': 'Baby Food',
      'subcategories.diapers_wipes': 'Diapers & Wipes',
      'subcategories.baby_care_products': 'Baby Care Products',
      'subcategories.skincare': 'Skincare',
      'subcategories.hair_care': 'Hair Care',
      'subcategories.oral_care': 'Oral Care',
      'subcategories.fragrances': 'Fragrances',
      'subcategories.makeup': 'Makeup',
      'subcategories.tea_coffee': 'Tea & Coffee',
      'subcategories.soft_drinks': 'Soft Drinks',
      'subcategories.juices': 'Juices',
      'subcategories.energy_drinks': 'Energy Drinks',
      'subcategories.water': 'Water',
      'subcategories.milk': 'Milk',
      'subcategories.cheese': 'Cheese',
      'subcategories.yogurt': 'Yogurt',
      'subcategories.eggs': 'Eggs',
      'subcategories.butter': 'Butter',
    };
    
    return translations[key] || key;
  };

  const translateCategoryOrSubcategory = (name: string, isCategory: boolean): string => {
    return translateUtil(name, isCategory, t);
  };

  const translateCategory = (categoryName: string): string => {
    return translateCategoryName(categoryName, t);
  };

  const translateSubcategory = (subcategoryName: string): string => {
    return translateSubcategoryName(subcategoryName, t);
  };

  const translateMultiple = (items: Array<{ name: string; isCategory: boolean }>): string[] => {
    return items.map(item => translateCategoryOrSubcategory(item.name, item.isCategory));
  };

  return {
    translateCategoryOrSubcategory,
    translateCategory,
    translateSubcategory,
    translateMultiple,
  };
};