import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, BackHandler, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, IconButton, Appbar, Checkbox, RadioButton } from 'react-native-paper';
import { Modal, Portal } from 'react-native-paper';
import { supabase } from '../../../../services/supabase/supabase';
import { useCartStore } from '../../../../store/cart';
import { useWishlistStore } from '../../../../store/wishlist';
import { useTranslateDynamic } from '../../../../utils/translationUtils';
import { useCategoryTranslation } from '../../../../hooks/useCategoryTranslation';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { PRODUCT_CATEGORIES } from '../../../../constants/categories';
import { useLocationStore } from '../../../../store/location';
import CartDistanceManager from '../../../../components/CartDistanceManager';
import CartIcon from '../../../../components/CartIcon';
import CategoryScreenSkeleton from '../../../../components/common/CategoryScreenSkeleton';
import ProductCardSkeleton from '../../../../components/common/ProductCardSkeleton';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  min_quantity: number;
  unit: string;
  seller_id: string;
  brand?: string;
  incrementUnit?: number;
  image?: any;
  seller_details?: {
    business_name: string;
    seller_type: string;
  };
  profiles?: {
    id: string;
    seller_details: {
      business_name: string;
      seller_type: string;
    };
  };
}

interface Category {
  id: string;
  name: string;
  subcategories?: string[];
  icon?: any;
}

// Match this with the cart store's interface
interface CartItem {
  uniqueId: string;
  product_id: string;
  name: string;
  price: string;
  quantity: number;
  image_url: string;
  unit: string;
  seller_id: string;
}

// Transform PRODUCT_CATEGORIES to match our Category interface
const SIDEBAR_CATEGORIES: Category[] = PRODUCT_CATEGORIES.map(cat => ({
  id: cat.id,
  name: cat.name,
  subcategories: cat.subcategories.map(sub => sub.name)
}));

export default function CategoryProducts() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; subcategory?: string }>();
  const { id, subcategory } = params;
  const { translateArrayFields } = useTranslateDynamic();
  const { translateCategoryOrSubcategory } = useCategoryTranslation();
  const { userLocation, distanceFilter } = useLocationStore();
  const { currentLanguage } = useLanguage();

  // Translation state
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // Original texts that need translation
  const originalTexts = [
    'Wholesaler Products',
    'All Products',
    'Product Name',
    'Unknown Seller',
    'No results found',
    'No products found',
    'Try different filters or categories',
    'Popularity',
    'Price: Low to High',
    'Price: High to Low',
    'Newest First',
    'Sort by',
    'Filter',
    'Apply',
    'Clear',
    'Min Qty',
    'Add to Cart',
    'Loading...',
    'Search products...',
    'Back',
    'Brand',
    'Price Range',
    'Categories',
    'Subcategories',
    'Reset Filters',
    'We couldn\'t find any matches for',
    'Suggestions:',
    'Check the spelling',
    'Try more general keywords',
    'Try different keywords',
    'Name: A to Z',
    'Name: Z to A'
  ];

  // Translation function
  const t = (text: string) => {
    return translations[text] || text;
  };

  // Load translations when language changes - optimized for faster loading
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        // If English, use original texts immediately
        const englishTranslations: Record<string, string> = {};
        originalTexts.forEach(text => {
          englishTranslations[text] = text;
        });
        setTranslations(englishTranslations);
        return;
      }

      // Set fallback translations immediately to prevent blank screen
      const fallbackTranslations: Record<string, string> = {};
      originalTexts.forEach(text => {
        fallbackTranslations[text] = text;
      });
      setTranslations(fallbackTranslations);

      // Load actual translations in background without blocking UI
      setTimeout(async () => {
        try {
          const translatedTexts: Record<string, string> = {};
          
          // Translate all texts
          for (const text of originalTexts) {
            const translated = await translationService.translateText(text, currentLanguage);
            translatedTexts[text] = translated.translatedText;
          }
          
          setTranslations(translatedTexts);
        } catch (error) {
          console.error('Translation error:', error);
          // Keep fallback translations
        }
      }, 100); // Small delay to allow UI to render first
    };

    loadTranslations();
  }, [currentLanguage]);

  // Simplified category translation function using the new hook
  const getCategoryTranslation = (categoryKey: string) => {
    // First try as category, then as subcategory
    const categoryTranslation = translateCategoryOrSubcategory(categoryKey, true);
    if (categoryTranslation !== categoryKey) {
      return categoryTranslation;
    }
    
    // Try as subcategory
    return translateCategoryOrSubcategory(categoryKey, false);
  };

  // Function to convert URL parameter ID to actual database category name
  const getCategoryNameFromId = (categoryId: string) => {
    // Handle special mappings for URL-friendly IDs to database category names
    const categoryMappings: Record<string, string> = {
      'dairy-products': 'Dairy Products',
      'personal-care': 'Personal Care',
      'snacks': 'Snacks',
      'beverages': 'Beverages',
      'baby-care': 'Baby Care',
      'home-care': 'Household Care', // Fixed: map to correct category name
      'household-care': 'Household Care',
      'household': 'Household Care',
      'food-beverages': 'Food & Beverages',
      'food-&-beverages': 'Food & Beverages',
      'snacks-packaged-foods': 'Snacks & Packaged Foods',
      'snacks-&-packaged-foods': 'Snacks & Packaged Foods',
      'regional-pickles': 'Regional Pickles',
      'regional-spices': 'Regional Spices',
      'health-beauty': 'Health & Beauty',
      'health-and-beauty': 'Health & Beauty', // Added: handle hyphenated version
      'health-wellness': 'Health & Beauty', // Legacy mapping
      'beauty': 'Health & Beauty',
      'health': 'Health & Beauty',
      // Subcategory mappings
      'energy-drinks': 'Energy Drinks',
      'oral-care': 'Oral Care'
    };
    
    // Check direct mapping first
    if (categoryMappings[categoryId]) {
      return categoryMappings[categoryId];
    }
    
    // For other categories, try to find in PRODUCT_CATEGORIES
    for (const category of PRODUCT_CATEGORIES) {
      if (category.id === categoryId) {
        return category.name;
      }
      // Check subcategories
      for (const subcategory of category.subcategories) {
        if (subcategory.id === categoryId) {
          return subcategory.name;
        }
      }
    }
    
    // If not found, return the ID as is (fallback)
    return categoryId;
  };
  const [wholesalerName, setWholesalerName] = useState<string | null>(null);
  // Check if id is a valid UUID (wholesaler ID) vs a category name
  const isWholesalerId = id && id.includes('-') && id !== 'personal-care' && id !== 'more' && id.length > 10;
  // Treat "more" and "personal-care" as wholesaler views to show all wholesaler products
  const shouldShowWholesalerView = isWholesalerId || id === 'more' || id === 'personal-care';
  
  // Get the category name from the mapping or use the ID directly
  const getCategoryName = () => {
    if (isWholesalerId) {
      return wholesalerName || t("Wholesaler Products");
    }
    
    if (!id) return "Products";
    
    // Special handling for "more" category - show as "All Products"
    if (id === 'more') {
      return "All Products";
    }
    
    // Return the original ID formatted without translation
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  };
  
  const categoryName = getCategoryName();
  
  const { addToCart, items } = useCartStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Optimized state initialization - set loading to false initially for faster render
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(SIDEBAR_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [brands, setBrands] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Lazy loading states
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const PRODUCTS_PER_PAGE = 20;
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [showDistanceManager, setShowDistanceManager] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const { addToWishlist, removeFromWishlist, isInWishlist, loadWishlist } = useWishlistStore();

  // Add caching for nearby sellers to improve performance
  const [nearbySellerIds, setNearbySellerIds] = useState<string[]>([]);
  const [nearbySellersCacheTime, setNearbySellersCacheTime] = useState<number>(0);
  const [isLoadingNearbyData, setIsLoadingNearbyData] = useState(false);
  const [nearbyDataError, setNearbyDataError] = useState<string | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Translation setup for alert messages
  const alertTexts = {
    itemAddedToCart: "Item added to cart!",
    failedToAddItem: "Failed to add item to cart. Please try again."
  };
  
  const [alertTranslations, setAlertTranslations] = useState(alertTexts);

  useEffect(() => {
    const loadAlertTranslations = async () => {
      if (currentLanguage === 'en') {
        setAlertTranslations(alertTexts);
        return;
      }

      try {
        const translationResults = await Promise.all([
          translationService.translateText(alertTexts.itemAddedToCart, currentLanguage),
          translationService.translateText(alertTexts.failedToAddItem, currentLanguage)
        ]);
        
        setAlertTranslations({
          itemAddedToCart: translationResults[0].translatedText,
          failedToAddItem: translationResults[1].translatedText
        });
      } catch (error) {
        console.error('Translation error:', error);
        setAlertTranslations(alertTexts);
      }
    };

    loadAlertTranslations();
  }, [currentLanguage]);

  // Function to get nearby seller IDs with caching
  const getNearbySellerIds = async (userLocation: {latitude: number, longitude: number}, radius: number): Promise<string[]> => {
    const now = Date.now();
    
    // Check if we have cached data that's still valid
    if (nearbySellerIds.length > 0 && (now - nearbySellersCacheTime) < CACHE_DURATION) {
      console.log('Using cached nearby seller IDs:', nearbySellerIds.length, 'sellers');
      return nearbySellerIds;
    }

    console.log('Fetching fresh nearby seller data...');
    setIsLoadingNearbyData(true);
    setNearbyDataError(null);
    
    try {
      // Fetch nearby wholesalers and manufacturers in parallel
      const [wholesalersResult, manufacturersResult] = await Promise.all([
        supabase.rpc('find_nearby_wholesalers', {
          user_lat: userLocation.latitude,
          user_lng: userLocation.longitude,
          radius_km: radius
        }),
        supabase.rpc('find_nearby_manufacturers', {
          user_lat: userLocation.latitude,
          user_lng: userLocation.longitude,
          radius_km: radius
        })
      ]);

      // Check for errors in the RPC calls
      if (wholesalersResult.error) {
        console.error('Error fetching nearby wholesalers:', wholesalersResult.error);
        throw new Error('Failed to fetch nearby wholesalers');
      }
      
      if (manufacturersResult.error) {
        console.error('Error fetching nearby manufacturers:', manufacturersResult.error);
        throw new Error('Failed to fetch nearby manufacturers');
      }

      const sellerIds: string[] = [];
      
      // Add wholesaler IDs
      if (wholesalersResult.data) {
        sellerIds.push(...wholesalersResult.data.map((seller: any) => seller.user_id));
      }
      
      // Add manufacturer IDs
      if (manufacturersResult.data) {
        sellerIds.push(...manufacturersResult.data.map((seller: any) => seller.user_id));
      }

      // Cache the results
      setNearbySellerIds(sellerIds);
      setNearbySellersCacheTime(now);
      setIsLoadingNearbyData(false);
      
      console.log('Cached', sellerIds.length, 'nearby seller IDs');
      return sellerIds;
    } catch (error) {
      console.error('Error fetching nearby sellers:', error);
      setNearbyDataError(error instanceof Error ? error.message : 'Failed to fetch nearby sellers');
      setIsLoadingNearbyData(false);
      // Return cached data if available, otherwise empty array
      return nearbySellerIds.length > 0 ? nearbySellerIds : [];
    }
  };

  // Optimized useEffect - load wishlist data in background without blocking
  useEffect(() => {
    // Load wishlist in background to avoid blocking initial render
    setTimeout(() => {
      loadWishlist();
    }, 50);
  }, []);

  // Optimized useEffect - fetch categories with immediate UI feedback
  useEffect(() => {
    // Set loading state immediately for better UX
    setIsCategoryLoading(true);
    
    if (shouldShowWholesalerView) {
      // Only fetch categories on initial load
      if (!categories.length || categories[0].id === SIDEBAR_CATEGORIES[0].id) {
        fetchWholesalerCategories().finally(() => setIsCategoryLoading(false));
      } else {
        setIsCategoryLoading(false);
      }
      if (isWholesalerId) {
        fetchWholesalerName();
      }
    } else {
      // For regular category views, fetch and structure categories from database
      fetchStructuredCategories().finally(() => setIsCategoryLoading(false));
    }
  }, [id, shouldShowWholesalerView]);

  // Optimized useEffect - fetch products with better loading states
  useEffect(() => {
    // Reset pagination states when category changes
    setCurrentPage(0);
    setHasMoreProducts(true);
    setProducts([]);
    setTotalProductCount(0);
    
    // Set initial loading state only when needed
    if (products.length === 0) {
      setLoading(true);
    }
    
    // Set the initial selected category based on the route params
    if (shouldShowWholesalerView) {
      // For wholesaler views, we'll set it in fetchWholesalerCategories
    } else if (id) {
      console.log('Setting initial category from route param:', id);
      
      // Check if the ID is actually a subcategory
      let isSubcategory = false;
      let parentCategoryId = null;
      let subcategoryName = null;
      
      // Look through PRODUCT_CATEGORIES to find if this ID is a subcategory
      for (const category of PRODUCT_CATEGORIES) {
        for (const sub of category.subcategories) {
          if (sub.id === id) {
            isSubcategory = true;
            parentCategoryId = category.id;
            subcategoryName = sub.name;
            break;
          }
        }
        if (isSubcategory) break;
      }
      
      if (isSubcategory && parentCategoryId && subcategoryName) {
        console.log('Detected subcategory ID:', id, 'Parent category:', parentCategoryId, 'Subcategory name:', subcategoryName);
        setSelectedCategory(parentCategoryId);
        setSelectedSubcategory(subcategoryName);
        // Expand the parent category to show subcategories
        setExpandedCategories(prev => ({ ...prev, [parentCategoryId]: true }));
      } else {
        // It's a main category
        setSelectedCategory(id);
        
        if (subcategory) {
          console.log('Setting initial subcategory from route param:', subcategory);
          setSelectedSubcategory(subcategory);
        }
      }
    }
    
    // Initial products fetch with timeout to prevent blocking
    setTimeout(() => {
      fetchProducts(0, true);
    }, 10);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate useEffect for fetching products that depends on selectedCategory
  useEffect(() => {
    // Skip the initial fetch as it's handled by the mount effect
    // But allow fetches when category/subcategory changes from sidebar clicks
    if (loading && !isCategoryLoading) return;
    
    console.log("Fetching products with selected category:", selectedCategory, "subcategory:", selectedSubcategory);
    
    // Reset pagination when category/subcategory changes
    setCurrentPage(0);
    setHasMoreProducts(true);
    setProducts([]);
    setTotalProductCount(0);
    
    fetchProducts(0, true);
  }, [id, subcategory, shouldShowWholesalerView, selectedCategory, selectedSubcategory]);

  // Add automatic refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('CategoryProducts screen focused - refreshing data');
      
      // Reset loading state
      setLoading(true);
      
      // Refresh categories and products
      if (shouldShowWholesalerView) {
        fetchWholesalerCategories().then(() => {
          // Reset pagination and fetch first page
          setCurrentPage(0);
          setHasMoreProducts(true);
          setProducts([]);
          setTotalProductCount(0);
          fetchProducts(0, true);
        });
        if (isWholesalerId) {
          fetchWholesalerName();
        }
      } else {
        fetchStructuredCategories().then(() => {
          // Reset pagination and fetch first page
          setCurrentPage(0);
          setHasMoreProducts(true);
          setProducts([]);
          setTotalProductCount(0);
          fetchProducts(0, true);
        });
      }
    }, [id, shouldShowWholesalerView, isWholesalerId])
  );

  // Handle hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Check if any modal is open and close it first
        if (filterModalVisible) {
          setFilterModalVisible(false);
          return true;
        }
        if (sortModalVisible) {
          setSortModalVisible(false);
          return true;
        }
        if (brandModalVisible) {
          setBrandModalVisible(false);
          return true;
        }
        
        // If no modals are open, navigate back
        router.back();
        return true; // Prevent default behavior
      });

      return () => backHandler.remove();
    }, [router, filterModalVisible, sortModalVisible, brandModalVisible])
  );

  // New function to fetch wholesaler name
  const fetchWholesalerName = async () => {
    try {
      // Additional safety check to prevent UUID errors
      if (!isWholesalerId || !id || id === 'more' || id === 'personal-care') {
        console.log('Skipping fetchWholesalerName for non-wholesaler ID:', id);
        return;
      }
      
      console.log('Fetching wholesaler name for ID:', id);
      
      // First try to get from seller_details table
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_details')
        .select('business_name, user_id')
        .eq('user_id', id)
        .single();

      if (sellerData && sellerData.business_name) {
        console.log('Found wholesaler business name from seller_details:', sellerData.business_name);
        setWholesalerName(sellerData.business_name);
        return;
      }
      
      if (sellerError) {
        console.log('No data found in seller_details, trying profiles table');
      }

      // Fallback to profiles table if seller_details doesn't have the data
      const { data, error } = await supabase
        .from('profiles')
        .select('business_details')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching wholesaler profile:', error);
        return;
      }

      console.log('Fetched wholesaler data from profiles:', data);

      if (data && data.business_details) {
        // Get shop name from business_details
        const shopName = data.business_details.shopName || 
                         data.business_details.shop_name || 
                         data.business_details.businessName || 
                         data.business_details.business_name;
                         
        console.log('Found wholesaler shop name from business_details:', shopName);
        
        if (shopName) {
          setWholesalerName(shopName);
        } else {
          console.warn('No shop name found in business_details:', data.business_details);
        }
      } else {
        console.warn('No business_details found in profile data:', data);
      }
    } catch (error) {
      console.error('Exception in fetchWholesalerName:', error);
    }
  };

  // Enhanced function to fetch structured categories from wholesaler's products
  const fetchWholesalerCategories = async () => {
    try {
      console.log('Fetching categories for wholesaler with ID:', id);
      
      let query = supabase
        .from('products')
        .select('category, subcategory');
      
      if (isWholesalerId) {
        // For specific wholesaler, get their categories
        query = query.eq('seller_id', id);
      } else {
        // For 'more' and 'personal-care', get categories from all wholesalers
        const { data: wholesalers } = await supabase
          .from('seller_details')
          .select('user_id')
          .eq('seller_type', 'wholesaler');
        
        if (wholesalers && wholesalers.length > 0) {
          const wholesalerIds = wholesalers.map(w => w.user_id);
          query = query.in('seller_id', wholesalerIds);
          
          // If it's personal-care category, only get personal care categories
          if (id === 'personal-care') {
            query = query.eq('category', 'personal-care');
          }
        }
      }
      
      const { data, error } = await query;
        
      if (error) {
        console.error('Error fetching wholesaler categories:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Create a structured category hierarchy
        const categoryMap = new Map<string, Set<string>>();
        
        // Group subcategories by category
        data.forEach(product => {
          if (product.category) {
            if (!categoryMap.has(product.category)) {
              categoryMap.set(product.category, new Set());
            }
            if (product.subcategory) {
              categoryMap.get(product.category)!.add(product.subcategory);
            }
          }
        });
        
        // Convert to structured categories, matching with predefined categories when possible
        const structuredCategories: Category[] = [];
        
        // First, add categories that match our predefined structure
        PRODUCT_CATEGORIES.forEach(predefinedCat => {
          if (categoryMap.has(predefinedCat.name) || categoryMap.has(predefinedCat.id)) {
            const categoryKey = categoryMap.has(predefinedCat.name) ? predefinedCat.name : predefinedCat.id;
            const availableSubcategories = Array.from(categoryMap.get(categoryKey) || []);
            
            // Filter predefined subcategories to only show those that exist in products
            const matchingSubcategories = predefinedCat.subcategories
              .filter(sub => availableSubcategories.includes(sub.name))
              .map(sub => sub.name);
            
            // Add any additional subcategories not in predefined list
            const additionalSubcategories = availableSubcategories
              .filter(sub => !predefinedCat.subcategories.some(predSub => predSub.name === sub));
            
            const allSubcategories = [...matchingSubcategories, ...additionalSubcategories];
            
            if (allSubcategories.length > 0) {
              structuredCategories.push({
                id: predefinedCat.id,
                name: predefinedCat.name,
                subcategories: allSubcategories
              });
            }
            
            categoryMap.delete(categoryKey);
          }
        });
        
        // Add any remaining categories that don't match predefined structure
        categoryMap.forEach((subcategories, categoryName) => {
          if (subcategories.size > 0) {
            const generatedId = categoryName.toLowerCase().replace(/\s+/g, '-');
            
            // Check if this ID already exists in structuredCategories to prevent duplicates
            const existingCategory = structuredCategories.find(cat => cat.id === generatedId);
            if (!existingCategory) {
              structuredCategories.push({
                id: generatedId,
                name: categoryName,
                subcategories: Array.from(subcategories)
              });
            }
          }
        });
        
        console.log('Structured wholesaler categories:', structuredCategories);
        
        if (structuredCategories.length > 0) {
          // Add "All Products" option at the beginning
          const categoriesWithAll = [
            { id: 'all', name: "All Products" },
            ...structuredCategories
          ];
          
          // Translate category names
          console.log('🔄 Translating categories with currentLanguage:', currentLanguage);
        const translatedCategories = await translateArrayFields(
          categoriesWithAll,
          ['name'],
          currentLanguage
        );
        console.log('✅ Category translation completed for', translatedCategories.length, 'categories');
          
          setCategories(translatedCategories);
          setSelectedCategory('all');
        } else {
          const defaultCategories = [{ id: 'all', name: "All Products" }];
          const translatedDefaultCategories = await translateArrayFields(
            defaultCategories,
            ['name'],
            currentLanguage
          );
          setCategories(translatedDefaultCategories);
          setSelectedCategory('all');
        }
      } else {
        // No categories found, set a default
        const defaultCategories = [{ id: 'all', name: "All Products" }];
        const translatedDefaultCategories = await translateArrayFields(
          defaultCategories,
          ['name'],
          currentLanguage
        );
        setCategories(translatedDefaultCategories);
        setSelectedCategory('all');
      }
    } catch (error) {
      console.error('Exception in fetchWholesalerCategories:', error);
      const errorCategories = [{ id: 'all', name: "All Products" }];
      const translatedErrorCategories = await translateArrayFields(
        errorCategories,
        ['name'],
        currentLanguage
      );
      setCategories(translatedErrorCategories);
    }
  };

  // New function to fetch structured categories for regular category views
  const fetchStructuredCategories = async () => {
    try {
      console.log('Fetching structured categories for category:', id);
      
      // Get all products for this category to understand available subcategories
      const { data, error } = await supabase
        .from('products')
        .select('category, subcategory')
        .eq('category', id);
        
      if (error) {
        console.error('Error fetching category structure:', error);
        
        // Translate SIDEBAR_CATEGORIES before setting
        const translatedSidebarCategories = await translateArrayFields(
          SIDEBAR_CATEGORIES,
          ['name'],
          currentLanguage
        );
        
        setCategories(translatedSidebarCategories);
        return;
      }
      
      if (data && data.length > 0) {
        // Get unique subcategories for this category
        const availableSubcategories = Array.from(
          new Set(data.map(product => product.subcategory).filter(Boolean))
        );
        
        // Find the matching predefined category
        const predefinedCategory = PRODUCT_CATEGORIES.find(
          cat => cat.id === id || cat.name.toLowerCase() === id.toLowerCase()
        );
        
        if (predefinedCategory && availableSubcategories.length > 0) {
          // Filter predefined subcategories to only show those that exist in products
          const matchingSubcategories = predefinedCategory.subcategories
            .filter(sub => availableSubcategories.includes(sub.name))
            .map(sub => sub.name);
          
          // Add any additional subcategories not in predefined list
          const additionalSubcategories = availableSubcategories
            .filter(sub => !predefinedCategory.subcategories.some(predSub => predSub.name === sub));
          
          const allSubcategories = [...matchingSubcategories, ...additionalSubcategories];
          
          // Create structured category with "All" option
          const structuredCategories = [
            { id: 'all', name: "All Products" },
            ...allSubcategories.map(sub => ({
              id: sub.toLowerCase().replace(/\s+/g, '-'),
              name: sub
            }))
          ];
          
          // Translate category names
          console.log('🔄 [fetchStructuredCategories] Translating structured categories with currentLanguage:', currentLanguage);
        const translatedStructuredCategories = await translateArrayFields(
          structuredCategories,
          ['name'],
          currentLanguage
        );
        console.log('✅ [fetchStructuredCategories] Translation completed for', translatedStructuredCategories.length, 'structured categories');
          
          setCategories(translatedStructuredCategories);
          setSelectedCategory('all');
        } else {
          // Fallback to showing available subcategories as categories
          const subcategoryCategories = [
            { id: 'all', name: "All Products" },
            ...availableSubcategories.map(sub => ({
              id: sub.toLowerCase().replace(/\s+/g, '-'),
              name: sub
            }))
          ];
          
          // Translate subcategory names
          const translatedSubcategoryCategories = await translateArrayFields(
            subcategoryCategories,
            ['name'],
            currentLanguage
          );
          
          setCategories(translatedSubcategoryCategories);
          setSelectedCategory('all');
        }
      } else {
        // No products found, use predefined structure
        const predefinedCategory = PRODUCT_CATEGORIES.find(
          cat => cat.id === id || cat.name.toLowerCase() === id.toLowerCase()
        );
        
        if (predefinedCategory) {
          const structuredCategories = [
            { id: 'all', name: 'All Products' },
            ...predefinedCategory.subcategories.map(sub => ({
              id: sub.id,
              name: sub.name
            }))
          ];
          
          // Translate the structured categories
          const translatedStructuredCategories = await translateArrayFields(
            structuredCategories,
            ['name'],
            currentLanguage
          );
          
          setCategories(translatedStructuredCategories);
          setSelectedCategory('all');
        } else {
          const defaultCategories = [{ id: 'all', name: 'All Products' }];
          
          // Translate the default categories
          const translatedDefaultCategories = await translateArrayFields(
            defaultCategories,
            ['name'],
            currentLanguage
          );
          
          setCategories(translatedDefaultCategories);
          setSelectedCategory('all');
        }
      }
    } catch (error) {
      console.error('Exception in fetchStructuredCategories:', error);
      
      // Translate SIDEBAR_CATEGORIES before setting
      const translatedSidebarCategories = await translateArrayFields(
        SIDEBAR_CATEGORIES,
        ['name'],
        currentLanguage
      );
      
      setCategories(translatedSidebarCategories);
    }
  };

  const handleQuantityChange = (productId: string, increment: boolean, incrementUnit: number, minQuantity: number) => {
    setQuantities(prev => {
      const currentQty = prev[productId] || minQuantity;
      const newQty = increment ? currentQty + incrementUnit : currentQty - incrementUnit;
      return {
        ...prev,
        [productId]: Math.max(minQuantity, newQty)
      };
    });
  };

  const handleAddToCart = async (product: Product) => {
    try {
      const quantity = quantities[product.id] || product.min_quantity;
      const cartItem: CartItem = {
        uniqueId: '', // Will be set by the server
        product_id: product.id,
      name: product.name,
      price: product.price.toString(),
        image_url: typeof product.image_url === 'string' ? product.image_url : '',
      unit: product.unit,
      quantity: quantity,
      seller_id: product.seller_id
      };
      
      console.log('Adding to cart:', cartItem);
      await addToCart(cartItem);
      // Show success message or UI feedback here
      alert(alertTranslations.itemAddedToCart);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      
      // Check if it's a distance validation error
      if (error.message && error.message.includes('Distance to')) {
        // Show distance constraint manager
        setDistanceError(error.message);
        setShowDistanceManager(true);
      } else {
        // Show generic error message
        alert(alertTranslations.failedToAddItem);
      }
    }
  };

  // Extract unique brands from products
  const extractBrandsFromProducts = (products: Product[]) => {
    const uniqueBrands = new Set<string>();
    
    products.forEach(product => {
      // Add existing brand field if available
      if (product.brand && product.brand.trim()) {
        uniqueBrands.add(product.brand.trim());
      }
      
      // Extract brand from product name (first word)
      if (product.name && product.name.trim()) {
        const words = product.name.trim().split(' ');
        if (words.length > 0) {
          const potentialBrand = words[0];
          // Only add if it looks like a brand (not too short, not a common word)
          if (potentialBrand.length > 2 && 
              !['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'New', 'Old', 'Big', 'Small'].includes(potentialBrand)) {
            uniqueBrands.add(potentialBrand);
          }
        }
      }
    });
    
    const brandsArray = Array.from(uniqueBrands).sort();
    console.log('Extracted brands from products:', brandsArray);
    setBrands(brandsArray);
  };

  const fetchProducts = async (page: number = 0, isInitialLoad: boolean = false) => {
    try {
      console.log("Starting fetchProducts with category:", selectedCategory, "subcategory:", selectedSubcategory, "page:", page);
      
      if (isInitialLoad) {
        setIsCategoryLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          min_quantity,
          unit,
          category,
          subcategory,
          brand,
          seller_id,
          profiles:seller_id (
            seller_details (
              business_name,
              seller_type
            )
          )
        `, { count: 'exact' });

      // Declare cachedNearbySellerIds at function level to avoid scope issues
      let cachedNearbySellerIds = [];

      // Apply distance filtering if user location is available
      if (userLocation && distanceFilter) {
        // Ensure distanceFilter is a number (fix for array serialization issue)
        const safeDistanceFilter = Array.isArray(distanceFilter) ? distanceFilter[0] : distanceFilter;
        const numericDistanceFilter = typeof safeDistanceFilter === 'number' ? safeDistanceFilter : parseFloat(safeDistanceFilter) || 20;
        
        console.log('Applying distance filter:', numericDistanceFilter, 'km from user location:', userLocation);
        console.log('Original distanceFilter type:', typeof distanceFilter, 'value:', distanceFilter);
        
        // Use cached nearby seller IDs
        cachedNearbySellerIds = await getNearbySellerIds(userLocation, numericDistanceFilter);

        if (cachedNearbySellerIds.length > 0) {
          console.log('Found', cachedNearbySellerIds.length, 'nearby sellers within', distanceFilter, 'km (cached)');
          query = query.in('seller_id', cachedNearbySellerIds);
        } else {
          console.log('No nearby sellers found within', distanceFilter, 'km, showing empty results');
          // If no nearby sellers found, return empty array
          if (isInitialLoad) {
            setProducts([]);
            setAllProducts([]);
            setBrands([]);
            setTotalProductCount(0);
            setHasMoreProducts(false);
          }
          setLoading(false);
          setIsCategoryLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      // Check if we're coming from wholesaler profile (id is a UUID)
      if (shouldShowWholesalerView) {
        if (isWholesalerId) {
          // If id is a wholesaler id, we want products from that seller
          console.log('Fetching products from wholesaler with id:', id);
          query = query.eq('seller_id', id);
        } else {
          // For "more", show all wholesaler products
          // For "personal-care", show only personal care products from wholesalers
          console.log('Fetching wholesaler products for category:', id);
          const { data: wholesalers } = await supabase
            .from('seller_details')
            .select('user_id')
            .eq('seller_type', 'wholesaler');
          
          if (wholesalers && wholesalers.length > 0) {
            const wholesalerIds = wholesalers.map(w => w.user_id);
            query = query.in('seller_id', wholesalerIds);
            
            // If it's personal-care category, filter by personal care products
            if (id === 'personal-care') {
              query = query.eq('category', 'personal-care');
            }
          }
        }
        
        // Filter by selected subcategory if available
        if (selectedSubcategory) {
          console.log('Filtering by subcategory:', selectedSubcategory);
          query = query.eq('subcategory', selectedSubcategory);
        } 
        // Otherwise filter by selected category if not 'all' or 'All Products'
        else if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'All Products' && selectedCategory !== 'more') {
          const categoryName = getCategoryNameFromId(selectedCategory);
          console.log('Filtering by category:', selectedCategory, 'converted to name:', categoryName);
          
          // First, try to find the category in PRODUCT_CATEGORIES
          let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === selectedCategory || cat.name === categoryName);
          
          // If not found in predefined categories, check in the dynamic categories state
          if (!categoryData) {
            categoryData = categories.find(cat => cat.id === selectedCategory || cat.name === categoryName);
          }
          
          if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
            // Filter by subcategories instead of parent category
            // Handle both object format (from PRODUCT_CATEGORIES) and string format (from SIDEBAR_CATEGORIES)
            const subcategoryNames = categoryData.subcategories.map(sub => 
              typeof sub === 'string' ? sub : sub.name
            );
            console.log('Filtering by subcategories:', subcategoryNames);
            query = query.in('subcategory', subcategoryNames);
          } else {
            // Fallback to original category filtering if no subcategories found
            query = query.eq('category', categoryName);
          }
        } else {
          console.log('Showing all products (no category filter)');
        }
      } else if (subcategory && subcategory !== 'all') {
        // If subcategory is specified, filter by subcategory
        console.log('Filtering by subcategory from URL params:', subcategory);
        query = query.eq('subcategory', subcategory);
      } else if (selectedSubcategory) {
        // If selected subcategory but no URL subcategory
        console.log('Filtering by selected subcategory:', selectedSubcategory);
        query = query.eq('subcategory', selectedSubcategory);
      } else if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'All Products') {
        // If selected category is available, use it for filtering
        const categoryName = getCategoryNameFromId(selectedCategory);
        console.log('=== SELECTED CATEGORY FILTERING ===');
        console.log('Selected category:', selectedCategory, 'converted to name:', categoryName);
        
        // First, try to find the category in PRODUCT_CATEGORIES
        let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === selectedCategory || cat.name === categoryName);
        console.log('Found in PRODUCT_CATEGORIES:', categoryData ? 'YES' : 'NO');
        
        // If not found in predefined categories, check in the dynamic categories state
        if (!categoryData) {
          categoryData = categories.find(cat => cat.id === selectedCategory || cat.name === categoryName);
          console.log('Found in dynamic categories:', categoryData ? 'YES' : 'NO');
        }
        
        if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
          // Filter by both category and subcategories to include all products under this category
          const subcategoryNames = categoryData.subcategories;
          console.log('Filtering by category and subcategories:', categoryName, subcategoryNames);
          // Use OR filter to include products that match either the main category OR any of its subcategories
          // Also include products where category matches any of the subcategory names
          const categoryFilters = [
            `category.eq.${categoryName}`,
            `subcategory.in.(${subcategoryNames.map(sub => `"${sub}"`).join(',')})`,
            ...subcategoryNames.map(sub => `category.eq.${sub}`)
          ];
          console.log('Category filters array:', categoryFilters);
          console.log('Final OR query:', categoryFilters.join(','));
          query = query.or(categoryFilters.join(','));
        } else {
          // Fallback to original category filtering if no subcategories found
          console.log('No subcategories found, filtering by category name only:', categoryName);
          query = query.eq('category', categoryName);
        }
      } else if (id && id !== 'all' && id !== 'All Products' && id !== 'more') {
        // For main categories, convert URL parameter to actual database category name
        // Skip filtering for 'all', 'All Products', and 'more' categories
        const categoryName = getCategoryNameFromId(id);
        console.log('=== MAIN CATEGORY FILTERING ===');
        console.log('Main category id:', id, 'converted to name:', categoryName);
        
        // First, try to find the category in PRODUCT_CATEGORIES
        let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === id || cat.name === categoryName);
        console.log('Found in PRODUCT_CATEGORIES:', categoryData ? 'YES' : 'NO');
        
        // If not found in predefined categories, check in the dynamic categories state
        if (!categoryData) {
          categoryData = categories.find(cat => cat.id === id || cat.name === categoryName);
          console.log('Found in dynamic categories:', categoryData ? 'YES' : 'NO');
        }
        
        if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
          // Filter by both category and subcategories to include all products under this category
          // Handle both object format (from PRODUCT_CATEGORIES) and string format (from SIDEBAR_CATEGORIES)
          const subcategoryNames = categoryData.subcategories.map(sub => 
            typeof sub === 'string' ? sub : sub.name
          );
          console.log('Filtering by category and subcategories:', categoryName, subcategoryNames);
          // Use OR filter to include products that match either the main category OR any of its subcategories
          // Also include products where category matches any of the subcategory names
          const categoryFilters = [
            `category.eq.${categoryName}`,
            `subcategory.in.(${subcategoryNames.map(sub => `"${sub}"`).join(',')})`,
            ...subcategoryNames.map(sub => `category.eq.${sub}`)
          ];
          console.log('Category filters array:', categoryFilters);
          console.log('Final OR query:', categoryFilters.join(','));
          query = query.or(categoryFilters.join(','));
        } else {
          // Fallback to original category filtering if no subcategories found
          console.log('No subcategories found, filtering by category name only:', categoryName);
          query = query.eq('category', categoryName);
        }
      } else {
        // For 'all', 'more' category, don't add any category filter - show all products
        console.log('Showing all products (no category filter)');
      }

      // Create a separate query for counting to avoid query reuse issues
      let countQuery = supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Apply the same filters to count query as the main query
      // Re-apply all the filters that were applied to the main query
      if (distanceFilter && distanceFilter !== 'all') {
        if (cachedNearbySellerIds && cachedNearbySellerIds.length > 0) {
          countQuery = countQuery.in('seller_id', cachedNearbySellerIds);
        } else {
          // No nearby sellers, return empty
          if (isInitialLoad) {
            setProducts([]);
            setAllProducts([]);
            setBrands([]);
            setTotalProductCount(0);
            setHasMoreProducts(false);
          }
          setLoading(false);
          setIsCategoryLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }

      if (shouldShowWholesalerView) {
        if (isWholesalerId) {
          countQuery = countQuery.eq('seller_id', id);
        } else {
          const { data: wholesalers } = await supabase
            .from('seller_details')
            .select('user_id')
            .eq('seller_type', 'wholesaler');
          
          if (wholesalers && wholesalers.length > 0) {
            const wholesalerIds = wholesalers.map(w => w.user_id);
            countQuery = countQuery.in('seller_id', wholesalerIds);
            
            if (id === 'personal-care') {
              countQuery = countQuery.eq('category', 'personal-care');
            }
          }
        }
        
        if (selectedSubcategory) {
          countQuery = countQuery.eq('subcategory', selectedSubcategory);
        } else if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'All Products' && selectedCategory !== 'more') {
          const categoryName = getCategoryNameFromId(selectedCategory);
          let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === selectedCategory || cat.name === categoryName);
          
          if (!categoryData) {
            categoryData = categories.find(cat => cat.id === selectedCategory || cat.name === categoryName);
          }
          
          if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
            // Filter by both category and subcategories to include all products under this category
            const subcategoryNames = categoryData.subcategories;
            // Also include products where category matches any of the subcategory names
            const categoryFilters = [
              `category.eq.${categoryName}`,
              `subcategory.in.(${subcategoryNames.map(sub => `"${sub}"`).join(',')})`,
              ...subcategoryNames.map(sub => `category.eq.${sub}`)
            ];
            countQuery = countQuery.or(categoryFilters.join(','));
          } else {
            countQuery = countQuery.eq('category', categoryName);
          }
        }
      } else if (subcategory && subcategory !== 'all') {
        countQuery = countQuery.eq('subcategory', subcategory);
      } else if (selectedSubcategory) {
        countQuery = countQuery.eq('subcategory', selectedSubcategory);
      } else if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'All Products') {
        const categoryName = getCategoryNameFromId(selectedCategory);
        let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === selectedCategory || cat.name === categoryName);
        
        if (!categoryData) {
          categoryData = categories.find(cat => cat.id === selectedCategory || cat.name === categoryName);
        }
        
        if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
            // Filter by both category and subcategories to include all products under this category
            const subcategoryNames = categoryData.subcategories;
            // Also include products where category matches any of the subcategory names
            const categoryFilters = [
              `category.eq.${categoryName}`,
              `subcategory.in.(${subcategoryNames.map(sub => `"${sub}"`).join(',')})`,
              ...subcategoryNames.map(sub => `category.eq.${sub}`)
            ];
            countQuery = countQuery.or(categoryFilters.join(','));
          } else {
            countQuery = countQuery.eq('category', categoryName);
          }
      } else if (id && id !== 'all' && id !== 'All Products' && id !== 'more') {
        const categoryName = getCategoryNameFromId(id);
        let categoryData = PRODUCT_CATEGORIES.find(cat => cat.id === id || cat.name === categoryName);
        
        if (!categoryData) {
          categoryData = categories.find(cat => cat.id === id || cat.name === categoryName);
        }
        
        if (categoryData && categoryData.subcategories && categoryData.subcategories.length > 0) {
          // Filter by both category and subcategories to include all products under this category
          const subcategoryNames = categoryData.subcategories;
          // Also include products where category matches any of the subcategory names
          const categoryFilters = [
            `category.eq.${categoryName}`,
            `subcategory.in.(${subcategoryNames.map(sub => `"${sub}"`).join(',')})`,
            ...subcategoryNames.map(sub => `category.eq.${sub}`)
          ];
          countQuery = countQuery.or(categoryFilters.join(','));
        } else {
          countQuery = countQuery.eq('category', categoryName);
        }
      }

      const { count: totalCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error getting count:', countError);
        if (isInitialLoad) {
          setProducts([]);
          setBrands([]);
          setTotalProductCount(0);
          setHasMoreProducts(false);
        }
        return;
      }

      // Check if the requested page is valid
      const startIndex = page * PRODUCTS_PER_PAGE;
      const validPage = totalCount > 0 ? Math.min(page, Math.floor((totalCount - 1) / PRODUCTS_PER_PAGE)) : 0;
      const validStartIndex = validPage * PRODUCTS_PER_PAGE;
      const endIndex = validStartIndex + PRODUCTS_PER_PAGE - 1;
      
      // Only add pagination if we have results and valid pagination
      if (totalCount > 0) {
        query = query.range(validStartIndex, endIndex);
      }

      console.log('Query params:', { id, subcategory, isWholesalerId, shouldShowWholesalerView, selectedCategory, selectedSubcategory, page: validPage, startIndex: validStartIndex, endIndex, totalCount });
      const { data, error } = await query;

      if (error) {
        console.error('Error in Supabase query:', error);
        if (isInitialLoad) {
          setProducts([]);
          setBrands([]);
          setTotalProductCount(0);
          setHasMoreProducts(false);
        }
        return;
      }

      console.log('=== QUERY RESULTS ===');
      console.log('Fetched products count:', data?.length || 0, 'Total count:', totalCount);
      
      // Log first few products for debugging
      if (data && data.length > 0) {
        console.log('First 3 products:');
        data.slice(0, 3).forEach((product, index) => {
          console.log(`Product ${index + 1}:`, {
            name: product.name,
            category: product.category,
            subcategory: product.subcategory,
            seller_id: product.seller_id
          });
        });
      } else {
        console.log('No products found with current filters');
      }

      // Set total count on initial load
      if (isInitialLoad && totalCount !== null) {
        setTotalProductCount(totalCount);
        setHasMoreProducts(totalCount > PRODUCTS_PER_PAGE);
        // Store all products for search functionality on initial load
        setAllProducts(data || []);
      } else if (totalCount !== null) {
        setHasMoreProducts((validPage + 1) * PRODUCTS_PER_PAGE < totalCount);
      }

      if (data && data.length > 0) {
        // Debug: Log the first product to understand the data structure
        console.log('🔍 DEBUG: First product data structure:', JSON.stringify(data[0], null, 2));
        
        const transformedProducts = data.map(product => {
          // Correctly access seller_details from the nested profiles structure
          const profilesData = product.profiles as any;
          console.log('🔍 DEBUG: profilesData for product', product.id, ':', JSON.stringify(profilesData, null, 2));
          
          let sellerDetails = {
            business_name: 'Unknown Seller',
            seller_type: 'wholesaler'
          };

          // Handle the nested structure: profiles.seller_details
          if (profilesData && profilesData.seller_details) {
            const sellerDetailsData = profilesData.seller_details;
            console.log('🔍 DEBUG: sellerDetailsData:', JSON.stringify(sellerDetailsData, null, 2));
            sellerDetails = {
              business_name: sellerDetailsData.business_name || 'Unknown Seller',
              seller_type: sellerDetailsData.seller_type || 'wholesaler'
            };
          } else {
            console.log('🔍 DEBUG: No seller_details found in profiles for product', product.id);
          }
          
          return {
            ...product,
            seller_details: sellerDetails,
            // Add default image if image_url is null
            image_url: product.image_url || require('../../../../assets/images/products/dummy_product_image.jpg')
          };
        });
        
        console.log('Transformed products count:', transformedProducts.length);
        
        // Translate product names, brands, and seller business names
        console.log('🔄 Translating products with currentLanguage:', currentLanguage);
        const translatedProducts = await translateArrayFields(
          transformedProducts,
          ['name', 'brand', 'seller_details.business_name'],
          currentLanguage
        );
        console.log('✅ Translation completed for', translatedProducts.length, 'products');
        
        if (isInitialLoad) {
          setProducts(translatedProducts);
          setCurrentPage(0);
          // Extract unique brands from the translated products on initial load
          extractBrandsFromProducts(translatedProducts);
        } else {
          setProducts(prevProducts => [...prevProducts, ...translatedProducts]);
          setCurrentPage(page);
        }
      } else {
        console.log('No products found for page:', page);
        if (isInitialLoad) {
          setProducts([]);
          setBrands([]);
          setTotalProductCount(0);
          setAllProducts([]);
        }
        setHasMoreProducts(false);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      if (isInitialLoad) {
        setProducts([]);
        setBrands([]);
        setTotalProductCount(0);
        setAllProducts([]);
      }
      setHasMoreProducts(false);
    } finally {
      setLoading(false);
      setIsCategoryLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load more products function for infinite scroll
  const loadMoreProducts = useCallback(() => {
    if (!isLoadingMore && hasMoreProducts && !isCategoryLoading) {
      console.log('Loading more products, current page:', currentPage);
      fetchProducts(currentPage + 1, false);
    }
  }, [isLoadingMore, hasMoreProducts, isCategoryLoading, currentPage]);

  // Render skeleton loader for loading more products
  const renderSkeletonLoader = () => {
    if (!isLoadingMore) return null;
    
    const skeletonCount = shouldShowWholesalerView ? 4 : 6; // Show 4 skeletons for wholesaler view, 6 for category view
    const skeletons = Array.from({ length: skeletonCount }, (_, index) => (
      <ProductCardSkeleton 
        key={`skeleton-${index}`} 
        style={shouldShowWholesalerView ? styles.wholesalerProductCard : styles.categoryProductCard}
      />
    ));
    
    return <>{skeletons}</>;
  };

  const renderCategoryItem = ({ item }: { item: Category }) => {
    const isExpanded = expandedCategories[item.id] || false;
    const isSelected = selectedCategory === item.id && !selectedSubcategory;
    
    // Use original category name without translation
    const categoryName = item.name;
    
    return (
      <View>
        <Pressable 
          style={[
            styles.categoryItem,
            isSelected && styles.selectedCategoryItem
          ]}
          onPress={() => {
            console.log("Category selected:", item.name, item.id);
            // Only update if it's a different category
            if (selectedCategory !== item.id || selectedSubcategory !== null) {
              setIsCategoryLoading(true);
              setSelectedCategory(item.id);
              setSelectedSubcategory(null);
            }
            // If the category has subcategories, toggle expansion
            if (item.subcategories && item.subcategories.length > 0) {
              toggleCategoryExpansion(item.id);
            }
          }}
        >
          <View style={styles.categoryContent}>
            {item.icon && <Image source={item.icon} style={styles.categoryIcon} />}
            <Text 
              style={[
                styles.categoryText,
                isSelected && styles.selectedCategoryText
              ]}
              numberOfLines={2}
            >
              {categoryName}
            </Text>
            {item.subcategories && item.subcategories.length > 0 && (
              <IconButton 
                icon={isExpanded ? "chevron-up" : "chevron-down"} 
                size={16}
                onPress={() => toggleCategoryExpansion(item.id)}
                style={styles.expandButton}
              />
            )}
          </View>
        </Pressable>
        
        {/* Render subcategories if this category is expanded */}
        {isExpanded && item.subcategories && item.subcategories.length > 0 && (
          <View style={styles.subcategoriesContainer}>
            {item.subcategories.map((subcat, index) => (
              <Pressable
                key={`${item.id}-${subcat}-${index}`}
                style={[
                  styles.subcategoryItem,
                  selectedSubcategory === subcat && styles.selectedSubcategoryItem
                ]}
                onPress={() => {
                  console.log("Subcategory selected:", subcat, "under", item.id);
                  // Only update if it's a different subcategory
                  if (selectedCategory !== item.id || selectedSubcategory !== subcat) {
                    setIsCategoryLoading(true);
                    setSelectedCategory(item.id);
                    setSelectedSubcategory(subcat);
                  }
                }}
              >
                <Text 
                  style={[
                    styles.subcategoryText,
                    selectedSubcategory === subcat && styles.selectedSubcategoryText
                  ]}
                  numberOfLines={1}
                >
                  {translateCategoryOrSubcategory(subcat, false)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const currentQuantity = quantities[item.id] || item.min_quantity;
    const incrementAmount = item.incrementUnit || 1; // Default to 1 if not provided
    const inWishlist = isInWishlist(item.id);
    
    const handleWishlistToggle = () => {
      if (inWishlist) {
        removeFromWishlist(item.id);
      } else {
        addToWishlist(item);
      }
    };
    
    return (
      <View style={[
        styles.productCard, 
        shouldShowWholesalerView ? styles.wholesalerProductCard : styles.categoryProductCard
      ]}>
        <View style={styles.productCardInner}>
          <View style={styles.imageContainer}>
            <Image 
              source={
                typeof item.image_url === 'string' 
                  ? { uri: item.image_url }
                  : item.image_url
              } 
              style={styles.productImage} 
            />
            <IconButton
              icon={inWishlist ? "heart" : "heart-outline"}
              iconColor={inWishlist ? "#FF0000" : "#666"}
              size={20}
              style={styles.wishlistIcon}
              onPress={handleWishlistToggle}
            />
          </View>
          <View style={styles.productInfo}>
          {/* Product name section */}
          <View style={styles.nameContainer}>
            <Text variant="bodyMedium" numberOfLines={2} style={styles.productName}>
              {item?.name || 'Product Name'}
            </Text>
            <Text style={styles.sellerName} numberOfLines={1}>
              {item.seller_details?.business_name || 'Unknown Seller'}
            </Text>
          </View>
          
          {/* Price section */}
          <View style={styles.priceInfo}>
            <Text style={styles.price}>₹{item.price}</Text>
          </View>

          {/* Quantity controls section - moved below price */}
          <View style={styles.quantitySection}>
            {item.min_quantity > 1 && (
              <Text style={styles.minQuantity}>Min: {item.min_quantity}</Text>
            )}
            <View style={styles.quantityControls}>
              <IconButton 
                icon="minus" 
                size={18}
                style={styles.quantityButton}
                iconColor="#FF7D00"
                disabled={currentQuantity <= item.min_quantity}
                onPress={() => handleQuantityChange(item.id, false, incrementAmount, item.min_quantity)}
              />
              <Text style={styles.quantityText}>{currentQuantity}</Text>
              <IconButton 
                icon="plus" 
                size={18}
                style={styles.quantityButton}
                iconColor="#FF7D00"
                onPress={() => handleQuantityChange(item.id, true, incrementAmount, item.min_quantity)}
              />
            </View>
          </View>

          {/* Add button in dedicated bottom space */}
          <TouchableOpacity 
            style={styles.addButtonContainer}
            onPress={() => handleAddToCart(item)}
            activeOpacity={0.8}
          >
            <View style={styles.addButton}>
              <Text style={styles.buttonLabel}>
                {t("Add to Cart")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    );
  };

  // Toggle category expansion
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Improve the search function to provide a better ecommerce experience
  const performSearch = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return;
    }
    
    setLoading(true);
    try {
      console.log('Performing enhanced search with term:', searchTerm);
      
      // Format search term for better matching
      const formattedTerm = searchTerm.trim().toLowerCase();
      
      // Create a more comprehensive query to search products
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          min_quantity,
          unit,
          category,
          subcategory,
          seller_id,
          profiles:seller_id (
            seller_details (
              business_name,
              seller_type
            )
          )
        `)
        // Use more comprehensive search patterns with OR conditions
        .or(
          `name.ilike.%${formattedTerm}%,` +
          `category.ilike.%${formattedTerm}%,` +
          `subcategory.ilike.%${formattedTerm}%,` +
          `unit.ilike.%${formattedTerm}%`
        );
      
      // If on a wholesaler page, restrict to this wholesaler's products
      if (shouldShowWholesalerView) {
        if (isWholesalerId) {
          query = query.eq('seller_id', id);
        } else {
          // For "more", search all wholesaler products
          // For "personal-care", search only personal care products from wholesalers
          const { data: wholesalers } = await supabase
            .from('seller_details')
            .select('user_id')
            .eq('seller_type', 'wholesaler');
          
          if (wholesalers && wholesalers.length > 0) {
            const wholesalerIds = wholesalers.map(w => w.user_id);
            query = query.in('seller_id', wholesalerIds);
            
            // If it's personal-care category, filter by personal care products
            if (id === 'personal-care') {
              query = query.eq('category', 'personal-care');
            }
          }
        }
      }
      
      // Execute the search query
      const { data, error } = await query;
      
      if (error) {
        console.error('Search error:', error);
        setAllProducts([]);
        return;
      }
      
      if (data && data.length > 0) {
        console.log(`Search found ${data.length} results for "${searchTerm}"`);
        
        // Transform and enhance the product data for display
        const transformedProducts = data.map(product => {
          // Access seller_details through profiles - Supabase returns profiles as an array
          const profilesArray = product.profiles as any;
          const profileObj = Array.isArray(profilesArray) && profilesArray.length > 0 
            ? profilesArray[0] 
            : profilesArray;
          
          const sellerDetailsArray = profileObj?.seller_details;
          const sellerDetailsObj = Array.isArray(sellerDetailsArray) && sellerDetailsArray.length > 0 
            ? sellerDetailsArray[0] 
            : sellerDetailsArray;
          
          const sellerDetails = sellerDetailsObj && typeof sellerDetailsObj === 'object' ? 
            {
              business_name: sellerDetailsObj.business_name || 'Unknown Seller',
              seller_type: sellerDetailsObj.seller_type || 'wholesaler'
            } : {
              business_name: 'Unknown Seller',
              seller_type: 'wholesaler'
            };
          
          const { profiles, ...productWithoutProfiles } = product;
          return {
            ...productWithoutProfiles,
            seller_details: sellerDetails,
            image_url: product.image_url || require('../../../../assets/images/products/dummy_product_image.jpg')
          };
        });
        
        // Sort results by relevance - exact matches first, then partial matches
        const sortedByRelevance = transformedProducts.sort((a, b) => {
          // Check for exact name matches first (highest priority)
          const aExactMatch = a.name.toLowerCase() === formattedTerm;
          const bExactMatch = b.name.toLowerCase() === formattedTerm;
          
          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;
          
          // Then check for starts with matches (medium priority)
          const aStartsWith = a.name.toLowerCase().startsWith(formattedTerm);
          const bStartsWith = b.name.toLowerCase().startsWith(formattedTerm);
          
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // Then check for general contains matches (lower priority)
          // This is already handled by the database query, so equal priority
          
          return 0;
        });
        
        console.log('Setting sorted search results:', sortedByRelevance.length);
        setAllProducts(sortedByRelevance);
      } else {
        console.log(`No search results for "${searchTerm}"`);
        
        // Try a more lenient search if no results were found
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            image_url,
            min_quantity,
            unit,
            category,
            subcategory,
            seller_id,
            profiles:seller_id (
              seller_details (
                business_name,
                seller_type
              )
            )
          `)
          // Search for each word in the search term separately
          .or(
            formattedTerm.split(' ')
              .filter(word => word.length > 2) // Only use words with 3+ characters
              .map(word => `name.ilike.%${word}%`)
              .join(',')
          );
        
        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          console.log(`Fallback search found ${fallbackData.length} results`);
          
          const transformedFallback = fallbackData.map(product => {
            // Access seller_details through profiles - Supabase returns profiles as an array
            const profilesArray = product.profiles as any;
            const profileObj = Array.isArray(profilesArray) && profilesArray.length > 0 
              ? profilesArray[0] 
              : profilesArray;
            
            const sellerDetailsArray = profileObj?.seller_details;
            const sellerDetailsObj = Array.isArray(sellerDetailsArray) && sellerDetailsArray.length > 0 
              ? sellerDetailsArray[0] 
              : sellerDetailsArray;
            
            const sellerDetails = sellerDetailsObj && typeof sellerDetailsObj === 'object' ? 
              {
                business_name: sellerDetailsObj.business_name || 'Unknown Seller',
                seller_type: sellerDetailsObj.seller_type || 'wholesaler'
              } : {
                business_name: 'Unknown Seller',
                seller_type: 'wholesaler'
              };
            
            const { profiles, ...productWithoutProfiles } = product;
            return {
              ...productWithoutProfiles,
              seller_details: sellerDetails,
              image_url: product.image_url || require('../../../../assets/images/products/dummy_product_image.jpg')
            };
          });
          
          setAllProducts(transformedFallback);
        } else {
          setAllProducts([]);
        }
      }
    } catch (error) {
      console.error('Error in search:', error);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Update handleSearch function to fix the timeout issue
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Clear existing timeout if any
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout
    const newTimeout = setTimeout(() => {
      if (query.trim().length > 0) {
        setIsSearching(true);
        performSearch(query);
      } else {
        setIsSearching(false);
        // If search is cleared, reset to normal view
        fetchProducts(0, true);
      }
    }, 300); // 300ms debounce
    
    setSearchTimeout(newTimeout);
  };

  // Simplify the getFilteredAndSortedProducts function
  const getFilteredAndSortedProducts = () => {
    // Choose source products based on whether we're searching or browsing
    let filtered = isSearching ? [...allProducts] : [...products];
    
    console.log(`Search active: ${isSearching}, Using: ${isSearching ? 'search results' : 'category products'}, Count: ${filtered.length}`);
    
    if (filtered.length === 0) {
      // Early return if no products
      return [];
    }
    
    // If we're in search mode, already have filtered products from the API
    // So we only need to apply sorting
    if (!isSearching) {
      // When not searching, apply category/subcategory filtering
    if (selectedSubcategory) {
      // @ts-ignore - TypeScript issue with subcategory
      filtered = filtered.filter(product => product.subcategory === selectedSubcategory);
    } else if (selectedCategory !== 'all' && selectedCategory !== 'All Products') {
      // Convert selectedCategory ID to proper category name for comparison
      const categoryName = getCategoryNameFromId(selectedCategory);
      // @ts-ignore - TypeScript issue with category
      filtered = filtered.filter(product => product.category === categoryName);
    }
      
      // Apply brand filter
      if (selectedBrands.length > 0) {
        filtered = filtered.filter(product => {
          // Check if product brand matches selected brands
          const brandMatch = product.brand && selectedBrands.includes(product.brand);
          
          // Check if first word of product name matches selected brands
          const extractedBrandMatch = product.name && 
            product.name.trim().split(' ').length > 0 &&
            selectedBrands.includes(product.name.trim().split(' ')[0]);
          
          return brandMatch || extractedBrandMatch;
        });
      }
      
      // Apply price range filter
      filtered = filtered.filter(product => 
        product.price >= priceRange[0] && product.price <= priceRange[1]
      );
    }
    
    // Apply sorting to all results, whether from search or category browsing
    if (sortBy === 'price_low_high') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_high_low') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name_a_z') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name_z_a') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    }
    
    return filtered;
  };

  // Toggle filter for brands
  const toggleFilter = (item: string) => {
    setSelectedBrands(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };



  // Show full screen skeleton while initial data is loading
  if (isCategoryLoading || (loading && products.length === 0)) {
    return <CategoryScreenSkeleton shouldShowWholesalerView={shouldShowWholesalerView} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        {isSearching ? (
          <View style={styles.searchContainer}>
            <IconButton 
              icon="arrow-left" 
              size={20} 
              onPress={() => {
                setIsSearching(false);
                setSearchQuery('');
              }} 
              style={styles.searchBackButton}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQuery ? (
              <IconButton 
                icon="close" 
                size={20} 
                onPress={() => handleSearch('')} 
              />
            ) : null}
        </View>
        ) : (
          <>
            <Appbar.Content title={translateCategoryOrSubcategory(categoryName, true)} />
            <Appbar.Action 
              icon="magnify" 
              onPress={() => setIsSearching(true)} 
            />
          </>
        )}
        <CartIcon />
      </Appbar.Header>

      <View style={styles.filterRow}>
        <Pressable 
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
        >
          <IconButton icon="filter-variant" size={16} />
          <Text style={styles.filterButtonText}>{t("Filter")}</Text>
        </Pressable>

        <Pressable 
          style={styles.filterButton}
          onPress={() => setSortModalVisible(true)}
        >
          <IconButton icon="sort" size={16} />
          <Text style={styles.filterButtonText}>Sort</Text>
        </Pressable>

        <Pressable 
          style={styles.filterButton}
          onPress={() => setBrandModalVisible(true)}
        >
          <Text style={styles.filterButtonText}>{t("Brand")}</Text>
          <IconButton icon="chevron-down" size={16} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Left sidebar with categories - Only show for wholesaler views */}
        {shouldShowWholesalerView && (
          <View style={styles.sidebar}>
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarContent}
            />
          </View>
        )}

        {/* Right side with products - Full width when no sidebar */}
        <View style={[
            styles.productsContainer,
            !shouldShowWholesalerView && { width: '100%' }
          ]}>
          {isCategoryLoading || isLoadingNearbyData ? (
            <View style={styles.categoryLoadingContainer}>
              <ActivityIndicator size="large" color="#FF7D00" />
              <Text style={styles.loadingText}>
                {isLoadingNearbyData ? 'Finding nearby sellers...' : 'Loading products...'}
              </Text>
              {nearbyDataError && (
                <Text style={styles.errorText}>{nearbyDataError}</Text>
              )}
            </View>
          ) : (
            <FlatList
              data={[...getFilteredAndSortedProducts(), ...(isLoadingMore ? Array.from({ length: shouldShowWholesalerView ? 4 : 6 }, (_, i) => ({ id: `skeleton-${i}`, isSkeleton: true })) : [])]}
              renderItem={({ item }) => {
                if (item.isSkeleton) {
                  return (
                    <ProductCardSkeleton 
                      style={shouldShowWholesalerView ? styles.wholesalerProductCard : styles.categoryProductCard}
                    />
                  );
                }
                return renderProductItem({ item });
              }}
              keyExtractor={item => item.id}
              numColumns={shouldShowWholesalerView ? 2 : 3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productsList}
              onEndReached={loadMoreProducts}
              onEndReachedThreshold={0.1}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Image 
                    source={require('../../../../assets/icons/no_results.png')} 
                    style={styles.emptyIcon}
                    defaultSource={require('../../../../assets/icons/no_results.png')}
                  />
                  <Text style={styles.emptyText}>
                    {isSearching ? t("No results found") : t("No products found")}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {isSearching 
                      ? `We couldn't find any matches for "${searchQuery}"`
                      : t("Try different filters or categories")}
                  </Text>
                  {isSearching && (
                    <View style={styles.searchSuggestions}>
                      <Text style={styles.suggestionTitle}>Suggestions:</Text>
                      <Text style={styles.suggestion}>• Check the spelling</Text>
                      <Text style={styles.suggestion}>• Try more general keywords</Text>
                      <Text style={styles.suggestion}>• Try different keywords</Text>
                    </View>
                  )}
                </View>
              }
            />
          )}
        </View>
      </View>

      {/* Filters Modal */}
      <Portal>
        <Modal
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('Filters')}</Text>
            <IconButton 
              icon="close" 
              size={20} 
              onPress={() => setFilterModalVisible(false)} 
            />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.filterSectionTitle}>Price Range</Text>
            <View style={styles.priceRangeContainer}>
              <Text>₹{priceRange[0]} - ₹{priceRange[1]}</Text>
              {/* Simple price range UI - you'd add a slider component here */}
            </View>
            
            <Text style={styles.filterSectionTitle}>Brands</Text>
            {brands.map(brand => (
              <Checkbox.Item
                key={brand}
                label={brand}
                status={selectedBrands.includes(brand) ? 'checked' : 'unchecked'}
                onPress={() => toggleFilter(brand)}
              />
            ))}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Button 
              mode="contained" 
              onPress={() => setFilterModalVisible(false)}
              style={styles.footerButton}
            >
              Apply
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Sort Modal */}
      <Portal>
        <Modal
          visible={sortModalVisible}
          onDismiss={() => setSortModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sort By</Text>
            <IconButton 
              icon="close" 
              size={20} 
              onPress={() => setSortModalVisible(false)}
            />
          </View>
          
          <View style={styles.modalContent}>
            <RadioButton.Group
              onValueChange={value => {
                setSortBy(value);
                setSortModalVisible(false);
              }}
              value={sortBy}
            >
              <RadioButton.Item label={t("Popularity")} value="popularity" />
              <RadioButton.Item label="Price: Low to High" value="price_low_high" />
                <RadioButton.Item label="Price: High to Low" value="price_high_low" />
              <RadioButton.Item label="Name: A to Z" value="name_a_z" />
              <RadioButton.Item label="Name: Z to A" value="name_z_a" />
            </RadioButton.Group>
          </View>
        </Modal>
      </Portal>

      {/* Brand Modal */}
      <Portal>
        <Modal
          visible={brandModalVisible}
          onDismiss={() => setBrandModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Brand</Text>
            <IconButton 
              icon="close" 
              size={20} 
              onPress={() => setBrandModalVisible(false)}
            />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {brands.map(brand => (
              <Checkbox.Item
                key={brand}
                label={brand}
                status={selectedBrands.includes(brand) ? 'checked' : 'unchecked'}
                onPress={() => toggleFilter(brand)}
              />
            ))}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <Button 
              mode="outlined" 
              onPress={() => setSelectedBrands([])}
              style={styles.footerButton}
            >
              Clear
            </Button>
            <Button 
              mode="contained" 
              onPress={() => setBrandModalVisible(false)}
              style={styles.footerButton}
            >
              Apply
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Distance Manager Modal */}
      <CartDistanceManager
        visible={showDistanceManager}
        onDismiss={() => setShowDistanceManager(false)}
        errorMessage={distanceError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: '25%',
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  sidebarContent: {
    paddingVertical: 10,
    paddingBottom: 100, // Extra bottom padding to ensure last categories are visible above bottom navigation
  },
  categoryItem: {
    padding: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  selectedCategoryItem: {
    backgroundColor: '#fff',
    borderLeftWidth: 3,
    borderLeftColor: '#FF7D00',
  },
  categoryContent: {
    alignItems: 'center',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  selectedCategoryText: {
    fontWeight: 'bold',
    color: '#FF7D00',
  },
  productsContainer: {
    flex: 1,
    width: '75%',
  },
  fullWidthContainer: {
    width: '100%', 
  },
  productsList: {
    padding: 4,
    paddingBottom: 100, // Extra bottom padding to ensure last products are visible above bottom navigation
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 260,
  },
  wholesalerProductCard: {
    width: '46%',
    margin: '2%',
  },
  categoryProductCard: {
    width: '31%',
    margin: '1%',
  },
  productCardInner: {
    overflow: 'hidden',
    flex: 1,
  },
  productImage: {
    width: '100%',
    height: 80,
    resizeMode: 'contain',
    backgroundColor: '#F5F5F5',
  },
  productInfo: {
    padding: 6,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 160,
  },
  nameContainer: {
    height: 44,
    marginBottom: 2,
  },
  productName: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  priceInfo: {
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  unit: {
    fontSize: 9,
    color: '#666',
  },
  minQuantity: {
    fontSize: 10,
    color: '#FF7D00',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  quantitySection: {
    alignItems: 'center',
    marginBottom: 6,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    margin: 0,
    padding: 0,
    width: 26,
    height: 26,
    backgroundColor: '#F5F5F5',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  addButtonContainer: {
    width: '100%',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    flex: 0,
  },
  addButton: {
    backgroundColor: '#FF7D00',
    borderRadius: 4,
    width: '100%',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0,
    textAlign: 'center',
    lineHeight: 14,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    paddingHorizontal: 5,
  },
  filterButtonText: {
    fontSize: 14,
  },
  expandButton: {
    margin: 0,
    padding: 0,
    width: 16,
    height: 16,
  },
  subcategoriesContainer: {
    paddingLeft: 12,
    backgroundColor: '#F5F5F5',
  },
  subcategoryItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  selectedSubcategoryItem: {
    backgroundColor: '#fff',
    borderLeftWidth: 2,
    borderLeftColor: '#FF7D00',
  },
  subcategoryText: {
    fontSize: 11,
    color: '#666',
  },
  selectedSubcategoryText: {
    fontWeight: 'bold',
    color: '#FF7D00',
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
    textAlign: 'center',
  },
  searchSuggestions: {
    alignSelf: 'stretch',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
  },
  suggestion: {
    fontSize: 14,
    color: '#777',
    marginBottom: 5,
  },
  resetButton: {
    marginTop: 15,
    paddingHorizontal: 15,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#37474F',
  },
  modalContent: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    color: '#37474F',
  },
  priceRangeContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  searchBackButton: {
    marginRight: -5,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  categoryLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF4444',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sellerName: {
    fontSize: 9,
    color: '#666',
    marginTop: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
    margin: 4,
  },
});
