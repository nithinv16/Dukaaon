import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Pressable, Image, FlatList, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Text, Card, Searchbar, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';

// Supabase is used for location-based filtering and product queries
import { supabase } from '../../services/supabase/supabase';
import {
  getCategoryImage,
  getSubcategoryImage
} from '../../constants/categoryImages';
// DynamicCategoryService provides access to normalized categories and subcategories tables
import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';
import { useLocationStore } from '../../store/location';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslateDynamic } from '../../utils/translationUtils';
import { useCategoryTranslation } from '../../hooks/useCategoryTranslation';
import { translationService } from '../../services/translationService';

/**
 * Category interface matching DynamicCategoryService types
 * 
 * This interface represents categories from the normalized 'categories' table.
 * Each category has a unique ID (UUID) which eliminates duplicates that occurred
 * when using string-based category names from the products table.
 */
interface Category {
  id: string;              // Unique UUID - prevents duplicates
  name: string;            // Canonical category name
  slug: string;            // URL-friendly identifier for routing
  image_url?: string;      // Remote image URL from database
  icon_url?: string;       // Optional icon
  parent_id?: string;      // For hierarchical categories
  description?: string;    // Category description
  display_order: number;   // Sort order for display
  is_active: boolean;      // Active status filter
  metadata?: any;          // Additional data
}

/**
 * Subcategory interface matching DynamicCategoryService types
 * 
 * Subcategories are linked to parent categories via category_id foreign key.
 * This relational approach replaces the old string-based subcategory field.
 */
interface SubCategory {
  id: string;              // Unique UUID
  category_id: string;     // Foreign key to parent category
  name: string;            // Subcategory name
  slug: string;            // URL-friendly identifier
  image_url?: string;      // Remote image URL
  display_order: number;   // Sort order
  is_active: boolean;      // Active status
  metadata?: any;          // Additional data
}

/**
 * Product interface with both legacy and new category fields
 * 
 * Products contain both:
 * - Legacy string-based fields (category, subcategory) - kept for backward compatibility
 * - New ID-based fields (category_id, subcategory_id) - used for proper relational queries
 * 
 * The new approach uses category_id instead of string matching to eliminate duplicates
 * and ensure consistent category relationships.
 */
interface Product {
  id: string;
  name: string;
  category: string;          // Legacy string field (kept for compatibility)
  subcategory: string;       // Legacy string field (kept for compatibility)
  category_id?: string;      // Foreign key to categories table (NEW - preferred)
  subcategory_id?: string;   // Foreign key to subcategories table (NEW - preferred)
  brand?: string;
  image_url?: string;
}

interface Brand {
  id: string;
  name: string;
  category?: string;
}

export interface CategoryGridHandle {
  toggleSearch: () => void;
}

export interface CategoryGridProps {
  hideHeader?: boolean;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
}

export const CategoryGrid = forwardRef<CategoryGridHandle, CategoryGridProps>((props, ref) => {
  const router = useRouter();
  const { distanceFilter } = useLocationStore();
  const user = useAuthStore(state => state.user);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { currentLanguage } = useLanguage();
  const { translateArrayFields } = useTranslateDynamic();
  const { translateCategoryOrSubcategory } = useCategoryTranslation();

  // Define original texts for translation
  const originalTexts = {
    browseAllCategories: 'Browse All Categories',
    searchPlaceholder: 'Search categories, products, brands...',
    loadingCategories: 'Loading categories...',
    categories: 'Categories',
    allCategories: 'All Categories',
    products: 'Products',
    brands: 'Brands',
    noResults: 'No results for',
    tryDifferentSearch: 'Try a different search term',
    availableItems: 'Available Items',
    errorLoadingCategories: 'Unable to load categories',
    errorLoadingSubcategories: 'Unable to load subcategories',
    errorLoadingProducts: 'Unable to load products',
    errorLoadingBrands: 'Unable to load brands',
    retry: 'Retry',
    noCategoriesAvailable: 'No categories available',
    checkConnectionAndRetry: 'Please check your connection and try again',
    locationUnavailable: 'Location unavailable - showing all categories',
    error: 'Error'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible && searchQuery) {
      setSearchQuery('');
    }
  };

  useImperativeHandle(ref, () => ({
    toggleSearch
  }));

  // Error handling states
  const [error, setError] = useState<string | null>(null);
  const [isLocationUnavailable, setIsLocationUnavailable] = useState(false);

  // Load translations when language changes - OPTIMIZED: Use batch translation
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // OPTIMIZATION: Use batch translation (single API call) instead of individual calls
        const keys = Object.keys(originalTexts);
        const values = Object.values(originalTexts);

        const translatedResults = await translationService.translateBatch(values, currentLanguage);

        const newTranslations: Record<string, string> = {};
        keys.forEach((key, index) => {
          newTranslations[key] = translatedResults[index]?.translatedText || originalTexts[key as keyof typeof originalTexts];
        });

        setTranslations(newTranslations as typeof originalTexts);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);


  // Fetch user location from profiles table
  useEffect(() => {
    const fetchUserLocation = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('latitude, longitude')
          .eq('id', user.id)
          .single();

        if (!error && data && data.latitude && data.longitude) {
          setUserLocation({
            latitude: Number(data.latitude),
            longitude: Number(data.longitude)
          });
        } else {
          console.log('[CategoryGrid] No location found in profiles table');
          setUserLocation(null);
        }
      } catch (error) {
        console.error('[CategoryGrid] Error fetching user location from profiles:', error);
        setUserLocation(null);
      }
    };

    fetchUserLocation();
  }, [user?.id]);

  useEffect(() => {
    fetchCategoriesFromDatabase();
    fetchSubCategories();
    fetchProducts();
    fetchBrands();

    // Language persistence is now handled by LanguageContext
    // No need for manual language resets
  }, [currentLanguage, userLocation, distanceFilter]);

  // Filter data based on search query using DynamicCategoryService
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setFilteredCategories(categories);
        setFilteredSubCategories(subCategories);
        setFilteredProducts([]);
        setFilteredBrands([]);
        return;
      }

      const query = searchQuery.toLowerCase();

      try {
        // Use DynamicCategoryService for category search (Requirements 4.1)
        const searchedCategories = await dynamicCategoryService.searchCategories(query);

        // Use DynamicCategoryService for subcategory search (Requirements 4.2)
        const searchedSubcategories = await dynamicCategoryService.searchSubcategories(query);

        // Get category IDs from search results for product filtering
        const matchingCategoryIds = new Set(searchedCategories.map(cat => cat.id));
        const matchingSubcategoryIds = new Set(searchedSubcategories.map(sub => sub.id));

        /**
         * Filter products using category_id instead of string matching (Requirements 4.4)
         * 
         * CATEGORY_ID APPROACH:
         * - Compare product.category_id with category IDs from search results
         * - This ensures products are grouped by their actual category relationship
         * - Eliminates issues with string matching (case sensitivity, typos, etc.)
         * 
         * OLD STRING-BASED APPROACH (replaced):
         * - product.category.toLowerCase().includes(query)
         * - Prone to duplicates and inconsistencies
         */
        const filteredProds = products.filter(product => {
          const nameMatch = product.name && product.name.toLowerCase().includes(query);
          const brandMatch = product.brand && product.brand.toLowerCase().includes(query);
          // Also check if query matches the first word of product name (extracted brand)
          const extractedBrandMatch = product.name &&
            product.name.toLowerCase().startsWith(query.toLowerCase() + ' ');

          // Check if the product belongs to a category that matches the search using category_id
          const belongsToMatchingCategory = matchingCategoryIds.has((product as any).category_id);

          // Check if the product belongs to a subcategory that matches the search using subcategory_id
          const belongsToMatchingSubcategory = matchingSubcategoryIds.has((product as any).subcategory_id);

          return nameMatch || brandMatch || extractedBrandMatch ||
            belongsToMatchingCategory || belongsToMatchingSubcategory;
        });

        // Filter brands
        const filteredBrandsList = brands.filter(brand =>
          brand.name && brand.name.toLowerCase().includes(query)
        );

        // Translate search results
        const translatedCategories = await translateArrayFields(
          searchedCategories,
          ['name'],
          currentLanguage
        );
        const translatedSubcategories = await translateArrayFields(
          searchedSubcategories,
          ['name'],
          currentLanguage
        );

        setFilteredCategories(translatedCategories);
        setFilteredSubCategories(translatedSubcategories);
        setFilteredProducts(filteredProds);
        setFilteredBrands(filteredBrandsList);
      } catch (error) {
        console.error('Error performing search:', error);
        // Fallback to local filtering if service fails
        const filteredCats = categories.filter(category =>
          category.name && category.name.toLowerCase().includes(query)
        );
        const filteredSubCats = subCategories.filter(subCategory =>
          subCategory.name && subCategory.name.toLowerCase().includes(query)
        );
        setFilteredCategories(filteredCats);
        setFilteredSubCategories(filteredSubCats);
        setFilteredProducts([]);
        setFilteredBrands([]);
      }
    };

    performSearch();
  }, [searchQuery, categories, subCategories, products, brands, currentLanguage, translateArrayFields]);

  // Helper function to get nearby seller IDs
  const getNearbySellerIds = async (): Promise<string[]> => {
    if (!userLocation) return [];

    try {
      const [wholesalersResult, manufacturersResult] = await Promise.all([
        supabase.rpc('find_nearby_wholesalers', {
          user_lat: userLocation.latitude,
          user_lng: userLocation.longitude,
          radius_km: distanceFilter
        }),
        supabase.rpc('find_nearby_manufacturers', {
          user_lat: userLocation.latitude,
          user_lng: userLocation.longitude,
          radius_km: distanceFilter
        })
      ]);

      const nearbySellerIds: string[] = [];

      if (!wholesalersResult.error && wholesalersResult.data) {
        nearbySellerIds.push(...wholesalersResult.data.map((seller: any) => seller.user_id));
      }

      if (!manufacturersResult.error && manufacturersResult.data) {
        nearbySellerIds.push(...manufacturersResult.data.map((seller: any) => seller.user_id));
      }

      return nearbySellerIds;
    } catch (error) {
      console.error('Error fetching nearby sellers:', error);
      return [];
    }
  };

  /**
   * Fetch categories from normalized categories table using DynamicCategoryService
   * 
   * WHY DynamicCategoryService?
   * - Provides access to normalized 'categories' table with unique IDs
   * - Eliminates duplicates caused by inconsistent string-based category names
   * - Includes caching and offline support
   * - Consistent with other components (CategoryCarousel)
   * 
   * CATEGORY_ID vs STRING-BASED APPROACH:
   * Old: Extract unique category strings from products table → duplicates due to casing
   * New: Query categories table by ID → guaranteed unique categories
   */
  const fetchCategoriesFromDatabase = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use DynamicCategoryService to fetch all categories from normalized table
      const allCategories = await dynamicCategoryService.getCategories();

      if (!allCategories || allCategories.length === 0) {
        console.log('CategoryGrid: No categories returned from service');
        setCategories([]);
        setLoading(false);
        return;
      }

      // Debug: Log fetched categories count and sample names (Requirements 1.1)
      console.log(`CategoryGrid: Fetched ${allCategories.length} categories from database`);
      if (allCategories.length > 0) {
        console.log('CategoryGrid: Sample category names:', allCategories.slice(0, 3).map(c => c.name));
      }

      // If user location is available, filter categories by nearby sellers
      if (userLocation) {
        setIsLocationUnavailable(false);
        const nearbySellerIds = await getNearbySellerIds();

        if (nearbySellerIds.length === 0) {
          // No nearby sellers, show all categories
          console.log('CategoryGrid: No nearby sellers found, showing all categories');
          const translatedCategories = await translateArrayFields(
            allCategories,
            ['name'],
            currentLanguage
          );
          // Debug: Log translated category names (Requirements 1.2)
          console.log(`CategoryGrid: Translated ${translatedCategories.length} categories to ${currentLanguage}`);
          if (translatedCategories.length > 0) {
            console.log('CategoryGrid: Sample translated names:', translatedCategories.slice(0, 3).map(c => c.name));
          }
          setCategories(translatedCategories);
          setLoading(false);
          return;
        }

        /**
         * For each category, check if there are products from nearby sellers
         * 
         * LOCATION-BASED FILTERING WITH CATEGORY_ID:
         * - Query products table using category_id foreign key
         * - Filter by seller_id to find nearby sellers
         * - Only show categories that have products available locally
         * 
         * This replaces the old approach of filtering products first, then extracting
         * category strings, which led to duplicates and inconsistencies.
         */
        const categoriesWithProducts = await Promise.all(
          allCategories.map(async (category) => {
            const { count } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('category_id', category.id)  // Use category_id for proper relationship
              .in('seller_id', nearbySellerIds);

            return count && count > 0 ? category : null;
          })
        );

        const filteredCategories = categoriesWithProducts.filter((cat): cat is Category => cat !== null);

        // Use optimized batch translation for better performance
        const translatedCategories = await translateArrayFields(
          filteredCategories,
          ['name'],
          currentLanguage
        );
        // Debug: Log translated category names (Requirements 1.2)
        console.log(`CategoryGrid: Translated ${translatedCategories.length} filtered categories to ${currentLanguage}`);
        if (translatedCategories.length > 0) {
          console.log('CategoryGrid: Sample translated names:', translatedCategories.slice(0, 3).map(c => c.name));
        }
        setCategories(translatedCategories);
      } else {
        // No location available - show all categories without filtering (Requirements 1.5)
        console.log('CategoryGrid: Location unavailable, showing all categories without filtering');
        setIsLocationUnavailable(true);
        const translatedCategories = await translateArrayFields(
          allCategories,
          ['name'],
          currentLanguage
        );
        // Debug: Log translated category names (Requirements 1.2)
        console.log(`CategoryGrid: Translated ${translatedCategories.length} categories (no location) to ${currentLanguage}`);
        if (translatedCategories.length > 0) {
          console.log('CategoryGrid: Sample translated names:', translatedCategories.slice(0, 3).map(c => c.name));
        }
        setCategories(translatedCategories);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CategoryGrid: Error fetching categories:', errorMessage, error);
      setError(translations.errorLoadingCategories);
      Alert.alert(
        translations.error,
        translations.errorLoadingCategories + '. ' + translations.checkConnectionAndRetry
      );
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch subcategories from normalized subcategories table using DynamicCategoryService
   * 
   * WHY DynamicCategoryService?
   * - Provides access to normalized 'subcategories' table with unique IDs
   * - Subcategories are linked to parent categories via category_id foreign key
   * - Eliminates duplicates caused by inconsistent string-based subcategory names
   * 
   * Requirements: 2.1, 2.2, 2.5
   */
  const fetchSubCategories = async () => {
    try {
      // Get all categories first using DynamicCategoryService
      const categoriesData = await dynamicCategoryService.getCategories();

      if (!categoriesData || categoriesData.length === 0) {
        console.log('CategoryGrid: No categories available for subcategory fetch');
        setSubCategories([]);
        return;
      }

      // For each category, fetch subcategories using the service
      const allSubcategories: SubCategory[] = [];
      for (const category of categoriesData) {
        const subs = await dynamicCategoryService.getSubcategories(category.id);
        allSubcategories.push(...subs);
      }

      // Debug: Log fetched subcategories count and sample names (Requirements 2.1)
      console.log(`CategoryGrid: Fetched ${allSubcategories.length} subcategories from database`);
      if (allSubcategories.length > 0) {
        console.log('CategoryGrid: Sample subcategory names:', allSubcategories.slice(0, 5).map(s => s.name));
        console.log('CategoryGrid: Sample subcategory fields:', allSubcategories.slice(0, 2).map(s => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          category_id: s.category_id
        })));
      }

      if (allSubcategories.length === 0) {
        console.log('CategoryGrid: No subcategories found');
        setSubCategories([]);
        return;
      }

      // Use optimized batch translation for subcategories (Requirements 2.2)
      // translateArrayFields translates the 'name' field to currentLanguage
      const translatedSubCategories = await translateArrayFields(
        allSubcategories,
        ['name'],
        currentLanguage
      );

      // Debug: Log translated subcategory names (Requirements 2.2, 2.5)
      console.log(`CategoryGrid: Translated ${translatedSubCategories.length} subcategories to ${currentLanguage}`);
      if (translatedSubCategories.length > 0) {
        console.log('CategoryGrid: Sample translated subcategory names:', translatedSubCategories.slice(0, 5).map(s => s.name));
      }

      setSubCategories(translatedSubCategories);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CategoryGrid: Error fetching subcategories:', errorMessage, error);
      // Don't show alert for subcategories - they're secondary content
      // Just log the error and continue with empty subcategories
      setSubCategories([]);
    }
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('id, name, category, subcategory, category_id, subcategory_id, brand, image_url, seller_id')
        .limit(100); // Limit to avoid too many results

      // If user location is available, filter by distance
      if (userLocation) {
        // Get nearby wholesalers and manufacturers within distance range
        const [wholesalersResult, manufacturersResult] = await Promise.all([
          supabase.rpc('find_nearby_wholesalers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          }),
          supabase.rpc('find_nearby_manufacturers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          })
        ]);

        const nearbySellerIds: string[] = [];

        // Add wholesaler IDs
        if (!wholesalersResult.error && wholesalersResult.data) {
          nearbySellerIds.push(...wholesalersResult.data.map((seller: any) => seller.user_id));
        }

        // Add manufacturer IDs
        if (!manufacturersResult.error && manufacturersResult.data) {
          nearbySellerIds.push(...manufacturersResult.data.map((seller: any) => seller.user_id));
        }

        if (nearbySellerIds.length > 0) {
          query = query.in('seller_id', nearbySellerIds);
        } else {
          // If no nearby sellers found, continue without distance filter
          // This allows users to see products even if no sellers are within the selected radius
          console.log('CategoryGrid: No nearby sellers found within distance filter. Showing all products.');
          // Continue with the query without distance filtering
        }
      }

      const { data: productsData, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch products: ${error.message}`);
      }

      if (productsData) {
        // Use optimized batch translation for products
        const translatedProducts = await translateArrayFields(
          productsData,
          ['name', 'category', 'subcategory', 'brand'],
          currentLanguage
        );
        setProducts(translatedProducts);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CategoryGrid: Error fetching products:', errorMessage, error);
      // Don't show alert for products - they're used for search only
      setProducts([]);
    }
  };

  const fetchBrands = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('name, brand, category')
        .not('name', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch brands: ${error.message}`);
      }

      if (productsData) {
        const brandSet = new Set<string>();

        productsData.forEach(product => {
          // Add existing brand field if available
          if (product.brand && product.brand.trim()) {
            brandSet.add(product.brand.trim());
          }

          // Extract brand from product name (first word)
          if (product.name && product.name.trim()) {
            const words = product.name.trim().split(' ');
            if (words.length > 0) {
              const potentialBrand = words[0];
              // Only add if it looks like a brand (not too short, not a common word)
              if (potentialBrand.length > 2 &&
                !['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'New', 'Old', 'Big', 'Small'].includes(potentialBrand)) {
                brandSet.add(potentialBrand);
              }
            }
          }
        });

        // Convert to array and create brand objects
        const uniqueBrands = Array.from(brandSet).map(brandName => {
          // Find a product with this brand to get its category
          const product = productsData.find(p =>
            p.brand === brandName ||
            (p.name && p.name.startsWith(brandName + ' '))
          );
          return {
            id: brandName,
            name: brandName,
            category: product?.category
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        console.log('CategoryGrid: Extracted brands:', uniqueBrands.length);

        // Use optimized batch translation for brands
        const translatedBrands = await translateArrayFields(
          uniqueBrands,
          ['name'],
          currentLanguage
        );
        setBrands(translatedBrands);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('CategoryGrid: Error fetching brands:', errorMessage, error);
      // Don't show alert for brands - they're used for search only
      setBrands([]);
    }
  };

  const handleCategoryPress = (category: Category) => {
    /**
     * NAVIGATION FIX: Use category.id (UUID) instead of slug
     * 
     * Requirements 3.1, 3.3:
     * - Navigate with category UUID for reliable product filtering
     * - The category detail screen will detect this is a category UUID
     *   and query products using category_id field
     * 
     * The category.id is a UUID from the normalized categories table,
     * which ensures consistent product filtering without string matching issues.
     */
    console.log('CategoryGrid: Navigating to category:', {
      id: category.id,
      name: category.name,
      slug: category.slug
    });

    // Pass category ID and type=category to help detail screen identify this is a category
    const categoryParams = new URLSearchParams({
      type: 'category',
      name: category.name
    });
    router.push(`/(main)/screens/category/${category.id}?${categoryParams.toString()}`);
  };

  const handleSubCategoryPress = (subcategory: SubCategory) => {
    /**
     * NAVIGATION FIX: Use subcategory.id (UUID) and category_id for proper filtering
     * 
     * Requirements 3.2, 3.4:
     * - Navigate with subcategory UUID in path
     * - Pass category_id as query parameter for parent category context
     * - The category detail screen will filter products by subcategory_id
     * 
     * The subcategory.id is a UUID from the normalized subcategories table,
     * and category_id links to the parent category for proper hierarchy.
     */
    console.log('CategoryGrid: Navigating to subcategory:', {
      id: subcategory.id,
      name: subcategory.name,
      slug: subcategory.slug,
      category_id: subcategory.category_id
    });

    // Pass subcategory ID with type=subcategory and parent category_id
    const subCategoryParams = new URLSearchParams({
      type: 'subcategory',
      name: subcategory.name,
      category_id: subcategory.category_id
    });
    router.push(`/(main)/screens/category/${subcategory.id}?${subCategoryParams.toString()}`);
  };

  const handleProductPress = (productId: string) => {
    router.push(`/(main)/products/${productId}`);
  };

  const handleBrandPress = (brandName: string) => {
    const brandParams = new URLSearchParams({
      id: brandName,
      brand: brandName,
      type: 'brand' // Add type to distinguish brand filtering
    });
    router.push(`/screens/category/${brandName}?${brandParams.toString()}`);
  };

  /**
   * Get image source for a category or subcategory
   * 
   * IMAGE FALLBACK LOGIC:
   * 1. First, try to use image_url from database (remote image)
   * 2. If no image_url, fallback to local images based on slug
   * 3. For subcategories, try subcategory-specific image, then default
   * 
   * This approach ensures:
   * - Dynamic images from database are used when available
   * - Graceful fallback to local assets prevents broken images
   * - Consistent image display across the app
   */
  const getImageSource = (item: Category | SubCategory, isCategory: boolean) => {
    // Check if item has image_url from database (preferred)
    if (item.image_url) {
      return { uri: item.image_url };
    }

    // Fallback to local images based on slug
    if (isCategory) {
      return getCategoryImage(item.slug);
    } else {
      return getSubcategoryImage(item.slug) || getCategoryImage('default');
    }
  };

  /**
   * Render a category or subcategory item in the grid
   * 
   * This function handles both categories and subcategories uniformly:
   * - Categories: fetched and translated in fetchCategoriesFromDatabase
   * - Subcategories: fetched and translated in fetchSubCategories
   * 
   * Both use translateArrayFields to translate the 'name' field before storing in state,
   * so we can use item.name directly without additional translation.
   * 
   * Requirements: 1.3, 1.4, 2.3, 2.4
   */
  const renderItem = ({ item }: { item: Category | SubCategory }) => {
    // Determine if this is a main category by checking for category_id field
    const isMainCategory = !('category_id' in item);
    const imageSource = getImageSource(item, isMainCategory);

    return (
      <Pressable
        style={styles.item}
        onPress={() =>
          isMainCategory
            ? handleCategoryPress(item as Category)
            : handleSubCategoryPress(item as SubCategory)
        }
      >
        <View style={styles.premiumCard}>
          <View style={styles.imageContainer}>
            <Image
              source={imageSource}
              style={styles.premiumImage}
              resizeMode="cover"
              defaultSource={require('../../assets/images/products/dummy_product_image.jpg')}
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.premiumName} numberOfLines={2}>
              {item.name || 'Category'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    return (
      <Pressable
        style={styles.item}
        onPress={() => handleProductPress(item.id)}
      >
        <View style={styles.premiumCard}>
          <View style={styles.imageContainer}>
            <Image
              source={item.image_url ? { uri: item.image_url } : require('../../assets/images/products/dummy_product_image.jpg')}
              style={styles.premiumImage}
              resizeMode="cover"
              defaultSource={require('../../assets/images/products/dummy_product_image.jpg')}
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.premiumName} numberOfLines={1}>{item.name || 'Product'}</Text>
            <Text style={styles.categoryText} numberOfLines={1}>
              {translateCategoryOrSubcategory(item.category, true) || 'Category'}
            </Text>
            {item.brand && (
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText} numberOfLines={1}>{item.brand}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderBrand = ({ item }: { item: Brand }) => {
    return (
      <Pressable
        style={styles.item}
        onPress={() => handleBrandPress(item.name)}
      >
        <View style={styles.premiumCard}>
          <View style={[styles.imageContainer, { backgroundColor: '#FFF' }]}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandInitial}>{item.name ? item.name.charAt(0).toUpperCase() : 'B'}</Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.premiumName} numberOfLines={1}>{item.name || 'Brand'}</Text>
            {item.category && (
              <Text style={styles.categoryText} numberOfLines={1}>
                {translateCategoryOrSubcategory(item.category, true)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // Handle retry for error state
  const handleRetry = () => {
    setError(null);
    fetchCategoriesFromDatabase();
    fetchSubCategories();
    fetchProducts();
    fetchBrands();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>{translations.loadingCategories}</Text>
      </View>
    );
  }

  // Error state with retry button (Requirements 1.1, 1.2)
  if (error && categories.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateTitle}>{translations.errorLoadingCategories}</Text>
        <Text style={styles.emptyStateSubtext}>{translations.checkConnectionAndRetry}</Text>
        <Pressable style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>{translations.retry}</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state with retry button (Requirements 1.1)
  if (!loading && categories.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <Text style={styles.emptyStateTitle}>{translations.noCategoriesAvailable}</Text>
        <Text style={styles.emptyStateSubtext}>{translations.checkConnectionAndRetry}</Text>
        <Pressable style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>{translations.retry}</Text>
        </Pressable>
      </View>
    );
  }



  return (
    <View style={styles.container}>
      {/* Header with Categories title and Search toggle */}
      {!props.hideHeader && (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{translations.categories}</Text>
          <FAB
            icon={isSearchVisible ? "close" : "magnify"}
            style={styles.headerFab}
            onPress={toggleSearch}
            size="small"
          />
        </View>
      )}

      {/* Conditional Search Bar */}
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder={translations.searchPlaceholder}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            autoFocus={true}
          />
        </View>
      )}

      {/* Location unavailable indicator (Requirements 1.5) */}
      {isLocationUnavailable && (
        <View style={styles.locationWarningContainer}>
          <Text style={styles.locationWarningText}>{translations.locationUnavailable}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={props.onScroll}
        scrollEventThrottle={props.scrollEventThrottle}
      >
        {searchQuery.trim() ? (
          // Search Results
          <>
            {/* Categories Results */}
            {filteredCategories.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.categories}</Text>
                <FlatList
                  data={filteredCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Subcategories Results */}
            {filteredSubCategories.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.allCategories}</Text>
                <FlatList
                  data={filteredSubCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Products Results */}
            {filteredProducts.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.products}</Text>
                <FlatList
                  data={filteredProducts}
                  renderItem={renderProduct}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Brands Results */}
            {filteredBrands.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.brands}</Text>
                <FlatList
                  data={filteredBrands}
                  renderItem={renderBrand}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* No Results */}
            {filteredCategories.length === 0 &&
              filteredSubCategories.length === 0 &&
              filteredProducts.length === 0 &&
              filteredBrands.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>{translations.noResults} "{searchQuery}"</Text>
                  <Text style={styles.noResultsSubtext}>{translations.tryDifferentSearch}</Text>
                </View>
              )}
          </>
        ) : (
          // Default View
          <>
            {/* Categories Section */}
            <View style={styles.categoriesSection}>
              <FlatList
                key="categories-3-cols"
                data={categories}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={3}
                contentContainerStyle={styles.categoriesGrid}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                nestedScrollEnabled={true}
              />
            </View>

            {/* Available Items Section */}
            {subCategories.length > 0 && (
              <View style={styles.subCategoriesSection}>
                <Text style={styles.sectionTitle}>{translations.availableItems}</Text>
                <FlatList
                  key="subcategories-3-cols"
                  data={subCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.subCategoriesGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerFab: {
    backgroundColor: '#FF7D00',
    margin: 0,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    height: 48,
  },
  searchInput: {
    fontSize: 14,
    textAlign: 'left',
    paddingHorizontal: 8,
    color: '#333',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    lineHeight: 20,
    minHeight: 48,
  },
  voiceSearchButton: {
    flex: 1,
    marginRight: 5,
  },

  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80, // Reduced padding - nav hides when scrolling so less space needed
    flexGrow: 1,
  },
  categoriesSection: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  categoriesGrid: {
    paddingBottom: 16,
  },
  subCategoriesSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  subCategoriesGrid: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    marginLeft: 12,
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  searchSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  searchGrid: {
    paddingBottom: 16,
  },
  item: {
    flex: 1 / 3,
    padding: 6,
  },
  subItem: {
    flex: 1 / 3,
    padding: 6,
  },

  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: 130,
    margin: 2, // Space for shadow
  },
  imageContainer: {
    height: 85,
    width: '100%',
    backgroundColor: '#F9FAFB', // Very light cool gray
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  premiumImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
  },
  premiumName: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    lineHeight: 14,
  },
  categoryText: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  brandBadge: {
    marginTop: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  brandBadgeText: {
    fontSize: 9,
    color: '#FF7D00',
    fontWeight: '700',
    textAlign: 'center',
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF3E0', // Lighter orange
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  brandInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF7D00', // Brand orange
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Add bottom padding for loading state too
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF7D00',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationWarningContainer: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  locationWarningText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
  },
});