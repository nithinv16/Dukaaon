/**
 * Category and Subcategory Translation Utilities
 * 
 * This module provides utilities for translating category and subcategory names
 * with support for predefined mappings and dynamic key generation.
 */

// Predefined category mappings for consistent translations
const CATEGORY_MAPPINGS: Record<string, string> = {
  'Baby Care': 'categories.baby_care',
  'Beauty & Personal Care': 'categories.beauty_personal_care',
  'Beverages': 'categories.beverages',
  'Dairy & Eggs': 'categories.dairy_eggs',
  'Fruits & Vegetables': 'categories.fruits_vegetables',
  'Grains & Cereals': 'categories.grains_cereals',
  'Health & Wellness': 'categories.health_wellness',
  'Household & Cleaning': 'categories.household_cleaning',
  'Meat & Seafood': 'categories.meat_seafood',
  'Packaged Foods': 'categories.packaged_foods',
  'Snacks & Confectionery': 'categories.snacks_confectionery',
  'Spices & Condiments': 'categories.spices_condiments',
};

// Predefined subcategory mappings
const SUBCATEGORY_MAPPINGS: Record<string, string> = {
  'Baby Food': 'subcategories.baby_food',
  'Diapers & Wipes': 'subcategories.diapers_wipes',
  'Baby Care Products': 'subcategories.baby_care_products',
  'Skincare': 'subcategories.skincare',
  'Hair Care': 'subcategories.hair_care',
  'Oral Care': 'subcategories.oral_care',
  'Fragrances': 'subcategories.fragrances',
  'Makeup': 'subcategories.makeup',
  'Tea & Coffee': 'subcategories.tea_coffee',
  'Soft Drinks': 'subcategories.soft_drinks',
  'Juices': 'subcategories.juices',
  'Energy Drinks': 'subcategories.energy_drinks',
  'Water': 'subcategories.water',
  'Milk': 'subcategories.milk',
  'Cheese': 'subcategories.cheese',
  'Yogurt': 'subcategories.yogurt',
  'Eggs': 'subcategories.eggs',
  'Butter': 'subcategories.butter',
};

/**
 * Generates a translation key from text
 * @param text - The text to generate a key for
 * @param isCategory - Whether this is a category (true) or subcategory (false)
 * @returns Generated translation key
 */
export const generateTranslationKey = (text: string, isCategory: boolean = false): string => {
  const prefix = isCategory ? 'categories' : 'subcategories';
  const key = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/&/g, 'and'); // Replace & with 'and'
  return `${prefix}.${key}`;
};

/**
 * Gets the translation key for a category
 * @param categoryName - The category name
 * @returns Translation key
 */
export const getCategoryTranslationKey = (categoryName: string): string => {
  return CATEGORY_MAPPINGS[categoryName] || generateTranslationKey(categoryName, true);
};

/**
 * Gets the translation key for a subcategory
 * @param subcategoryName - The subcategory name
 * @returns Translation key
 */
export const getSubcategoryTranslationKey = (subcategoryName: string): string => {
  return SUBCATEGORY_MAPPINGS[subcategoryName] || generateTranslationKey(subcategoryName, false);
};

/**
 * Translates a category name using a translation function
 * @param categoryName - The category name to translate
 * @param translateFn - The translation function (e.g., t from useTranslation)
 * @returns Translated category name or original if translation not found
 */
export const translateCategoryName = (categoryName: string, translateFn: (key: string) => string): string => {
  const key = getCategoryTranslationKey(categoryName);
  const translated = translateFn(key);
  return translated !== key ? translated : categoryName;
};

/**
 * Translates a subcategory name using a translation function
 * @param subcategoryName - The subcategory name to translate
 * @param translateFn - The translation function (e.g., t from useTranslation)
 * @returns Translated subcategory name or original if translation not found
 */
export const translateSubcategoryName = (subcategoryName: string, translateFn: (key: string) => string): string => {
  const key = getSubcategoryTranslationKey(subcategoryName);
  const translated = translateFn(key);
  return translated !== key ? translated : subcategoryName;
};

/**
 * Translates either a category or subcategory name
 * @param name - The name to translate
 * @param isCategory - Whether this is a category (true) or subcategory (false)
 * @param translateFn - The translation function
 * @returns Translated name or original if translation not found
 */
export const translateCategoryOrSubcategory = (
  name: string, 
  isCategory: boolean, 
  translateFn: (key: string) => string
): string => {
  return isCategory 
    ? translateCategoryName(name, translateFn)
    : translateSubcategoryName(name, translateFn);
};