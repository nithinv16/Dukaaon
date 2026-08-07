import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, BackHandler, Pressable, ScrollView, RefreshControl, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, IconButton, Appbar, Checkbox, RadioButton } from 'react-native-paper';
import { Modal, Portal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../../services/supabase/supabase';
import { useCartStore } from '../../../../store/cart';
import { useWishlistStore } from '../../../../store/wishlist';
import { useTranslateDynamic } from '../../../../utils/translationUtils';
import { useCategoryTranslation } from '../../../../hooks/useCategoryTranslation';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { PRODUCT_CATEGORIES } from '../../../../constants/categories';
import { useLocationStore } from '../../../../store/location';
import { useAuthStore } from '../../../../store/auth';
import CartDistanceManager from '../../../../components/CartDistanceManager';
import AnimatedCartIcon from '../../../../components/cart/AnimatedCartIcon';
import CategoryScreenSkeleton from '../../../../components/common/CategoryScreenSkeleton';
import ProductCardSkeleton from '../../../../components/common/ProductCardSkeleton';
import OptimizedProductCard from '../../../../components/products/OptimizedProductCard';
import { useCartAnimation } from '../../../../contexts/CartAnimationContext';
import { useBottomNav } from '../../../../contexts/BottomNavContext';

// ============================================================================
// PREMIUM COLOR PALETTE
// ============================================================================
const COLORS = {
  primary: '#FF7D00',
  primaryLight: '#FFF3E0',
  secondary: '#1A1A1A',
  text: '#333333',
  textLight: '#888888',
  white: '#FFFFFF',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  border: '#E5E7EB',
  success: '#34C759',
  error: '#FF3B30',
};

// ============================================================================
// TYPES
// ============================================================================
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
  category?: string;
  subcategory?: string;
  category_id?: string;
  subcategory_id?: string;
  seller_details?: {
    business_name: string;
    seller_type: string;
  };
  isSkeleton?: boolean;
}

interface Category {
  id: string;
  name: string;
  subcategories?: string[];
  icon?: any;
}

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

// ============================================================================
// MODULE-LEVEL CACHE - Persists across component instances for instant re-navigation
// ============================================================================
interface CacheEntry {
  products: Product[];
  categories: Category[];
  wholesalerName: string | null;
  brands: string[];
  totalCount: number;
  timestamp: number;
}

const dataCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const getCacheKey = (id: string, sellerId?: string) => `${id}-${sellerId || 'none'}`;

const getFromCache = (key: string): CacheEntry | null => {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  dataCache.delete(key);
  return null;
};

const setCache = (key: string, data: CacheEntry) => {
  dataCache.set(key, { ...data, timestamp: Date.now() });
};

// ============================================================================
// CONSTANTS
// ============================================================================
const PRODUCTS_PER_PAGE = 20;
const DEFAULT_IMAGE = require('../../../../assets/images/products/dummy_product_image.jpg');

// Transform PRODUCT_CATEGORIES to match our Category interface
const SIDEBAR_CATEGORIES: Category[] = PRODUCT_CATEGORIES.map(cat => ({
  id: cat.id,
  name: cat.name,
  subcategories: cat.subcategories.map(sub => sub.name)
}));

// Category name mappings for URL-friendly IDs
const CATEGORY_MAPPINGS: Record<string, string> = {
  'dairy-products': 'Dairy Products',
  'personal-care': 'Personal Care',
  'snacks': 'Snacks',
  'beverages': 'Beverages',
  'baby-care': 'Baby Care',
  'home-care': 'Household Care',
  'household-care': 'Household Care',
  'household': 'Household Care',
  'food-beverages': 'Food & Beverages',
  'food-&-beverages': 'Food & Beverages',
  'snacks-packaged-foods': 'Snacks & Packaged Foods',
  'snacks-&-packaged-foods': 'Snacks & Packaged Foods',
  'regional-pickles': 'Regional Pickles',
  'regional-spices': 'Regional Spices',
  'health-beauty': 'Health & Beauty',
  'health-and-beauty': 'Health & Beauty',
  'health-wellness': 'Health & Beauty',
  'beauty': 'Health & Beauty',
  'health': 'Health & Beauty',
  'energy-drinks': 'Energy Drinks',
  'oral-care': 'Oral Care'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const getCategoryNameFromId = (categoryId: string): string => {
  if (CATEGORY_MAPPINGS[categoryId]) {
    return CATEGORY_MAPPINGS[categoryId];
  }

  for (const category of PRODUCT_CATEGORIES) {
    if (category.id === categoryId) return category.name;
    for (const sub of category.subcategories) {
      if (sub.id === categoryId) return sub.name;
    }
  }

  return categoryId;
};

const extractBrands = (products: Product[]): string[] => {
  const brands = new Set<string>();
  const skipWords = new Set(['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'New', 'Old', 'Big', 'Small']);

  products.forEach(p => {
    if (p.brand?.trim()) brands.add(p.brand.trim());
    const firstWord = p.name?.split(' ')[0];
    if (firstWord?.length > 2 && !skipWords.has(firstWord)) brands.add(firstWord);
  });

  return Array.from(brands).sort();
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CategoryProducts() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    subcategory?: string;
    type?: string;
    name?: string;
    category_id?: string;
  }>();
  const { id, subcategory, type, name: paramName, category_id: parentCategoryId } = params;

  const { translateArrayFields } = useTranslateDynamic();
  const { translateCategoryOrSubcategory } = useCategoryTranslation();
  const { distanceFilter } = useLocationStore();
  const user = useAuthStore(state => state.user);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { currentLanguage } = useLanguage();
  const { addToCart, items: cartItems, updateQuantity, removeItem } = useCartStore();
  const { addToWishlist, removeFromWishlist, isInWishlist, loadWishlist } = useWishlistStore();
  const { addFlyingProduct, showToast } = useCartAnimation();
  const { hide: hideBottomNav, show: showBottomNav } = useBottomNav();

  // Helper to get cart quantity for a product
  const getCartQuantity = useCallback((productId: string): number => {
    const cartItem = cartItems.find(item => item.product_id === productId);
    return cartItem ? cartItem.quantity : 0;
  }, [cartItems]);

  // Handler to update cart quantity
  const handleUpdateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      // Remove from cart
      removeItem(productId);
      // Use cached translation for toast message
      const removedText = translationService.getCachedTranslationSync('Removed from cart', currentLanguage as any) || 'Removed from cart';
      showToast(removedText, 'success');
    } else {
      // Update quantity
      updateQuantity(productId, quantity);
    }
  }, [removeItem, updateQuantity, showToast, currentLanguage]);

  // Refs for preventing duplicate operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialLoadDoneRef = useRef(false);
  const isLoadingRef = useRef(false);
  const categoriesLoadedRef = useRef(false);

  // Navigation type detection
  const isCategoryId = type === 'category';
  const isSubcategoryId = type === 'subcategory';
  const isBrandFilter = type === 'brand';
  const isWholesalerId = !type && id && id.includes('-') && id !== 'personal-care' && id !== 'more' && id.length > 10;
  const shouldShowWholesalerView = isWholesalerId || id === 'more' || id === 'personal-care';

  // ============================================================================
  // TRANSLATION TEXTS
  // ============================================================================
  const originalTexts = {
    filter: 'Filter',
    sort: 'Sort',
    brand: 'Brand',
    brands: 'Brands',
    allBrands: 'All Brands',
    clearFilters: 'Clear',
    apply: 'Apply',
    cancel: 'Cancel',
    sortBy: 'Sort By',
    popularity: 'Popularity',
    priceLowToHigh: 'Price: Low to High',
    priceHighToLow: 'Price: High to Low',
    nameAZ: 'Name: A to Z',
    nameZA: 'Name: Z to A',
    products: 'Products',
    noProducts: 'No products found',
    tryDifferentFilter: 'Try adjusting your filters',
    loading: 'Loading...',
    addToCart: 'Add to Cart',
    addedToCart: 'Item added to cart!',
    failedToAdd: 'Failed to add item.',
    removedFromCart: 'Removed from cart',
    minQty: 'Min',
    inStock: 'in stock',
    perUnit: 'per',
    searchProducts: 'Search products...',
    allCategories: 'All Categories',
    selectBrand: 'Select Brand',
    priceRange: 'Price Range',
    distance: 'Distance',
    km: 'km',
    pullToRefresh: 'Pull to refresh',
  };

  const [translations, setTranslations] = useState(originalTexts);

  // ============================================================================
  // STATE - Consolidated for fewer re-renders
  // ============================================================================
  const [dataState, setDataState] = useState({
    products: [] as Product[],
    categories: SIDEBAR_CATEGORIES,
    wholesalerName: null as string | null,
    brands: [] as string[],
    totalCount: 0,
  });

  const [uiState, setUiState] = useState({
    loading: true,
    isLoadingMore: false,
    isRefreshing: false,
    hasMoreProducts: true,
    currentPage: 0,
  });

  const [filterState, setFilterState] = useState({
    selectedCategory: 'all',
    selectedSubcategory: null as string | null,
    selectedBrands: [] as string[],
    sortBy: 'popularity',
    searchQuery: '',
    priceRange: [0, 5000] as [number, number],
    categoryClickCount: 0, // Used to force reload on category re-click
  });

  const [modalState, setModalState] = useState({
    filterVisible: false,
    sortVisible: false,
    brandVisible: false,
    distanceVisible: false,
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [distanceError, setDistanceError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // ============================================================================
  // SCROLL-BASED AUTO-HIDE/SHOW
  // ============================================================================
  const scrollY = useRef(0);
  const previousScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const filterBarTranslateY = useRef(new Animated.Value(0)).current;
  const filterBarOpacity = useRef(new Animated.Value(1)).current;
  const contentPaddingTop = useRef(new Animated.Value(110)).current;
  const isHeaderHiddenRef = useRef(false); // Track animation state to prevent redundant calls
  const lastAnimationTime = useRef(0);
  const navigation = useNavigation();

  const hideFilterBar = useCallback(() => {
    // Skip if already hidden
    if (isHeaderHiddenRef.current) return;
    isHeaderHiddenRef.current = true;

    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: -70,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(filterBarTranslateY, {
        toValue: -80,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(filterBarOpacity, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(contentPaddingTop, {
        toValue: 0,
        duration: 80,
        useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [headerTranslateY, headerOpacity, filterBarTranslateY, filterBarOpacity, contentPaddingTop]);

  const showFilterBar = useCallback(() => {
    // Skip if already shown
    if (!isHeaderHiddenRef.current) return;
    isHeaderHiddenRef.current = false;

    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(filterBarTranslateY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(filterBarOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(contentPaddingTop, {
        toValue: 110,
        duration: 120,
        useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [headerTranslateY, headerOpacity, filterBarTranslateY, filterBarOpacity, contentPaddingTop]);

  const handleScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - previousScrollY.current;
    const now = Date.now();

    // Throttle animation triggers to max once per 100ms
    if (now - lastAnimationTime.current < 100) {
      scrollY.current = currentScrollY;
      return;
    }

    // Only trigger if scrolled more than 10px to avoid jitter
    if (Math.abs(scrollDifference) > 10) {
      if (scrollDifference > 0 && currentScrollY > 50) {
        // Scrolling DOWN - Hide header, filter bar and bottom navigation
        // Floating buttons (like Call To Order) remain visible
        if (!isHeaderHiddenRef.current) {
          hideFilterBar();
          hideBottomNav();
          lastAnimationTime.current = now;
        }
      } else if (scrollDifference < 0) {
        // Scrolling UP - Show header, filter bar and bottom navigation
        if (isHeaderHiddenRef.current) {
          showFilterBar();
          showBottomNav();
          lastAnimationTime.current = now;
        }
      }
      previousScrollY.current = currentScrollY;
    }

    scrollY.current = currentScrollY;
  }, [hideFilterBar, showFilterBar, hideBottomNav, showBottomNav]);

  // ============================================================================
  // DERIVED VALUES
  // ============================================================================
  const categoryName = useMemo(() => {
    if (paramName) return paramName;
    if (isWholesalerId) return dataState.wholesalerName || 'Wholesaler Products';
    if (!id) return 'Products';
    if (id === 'more') return 'All Products';
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  }, [paramName, isWholesalerId, dataState.wholesalerName, id]);

  // Memoized filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = [...dataState.products];

    // Apply brand filter
    if (filterState.selectedBrands.length > 0) {
      result = result.filter(p =>
        filterState.selectedBrands.some(b =>
          p.brand?.toLowerCase().includes(b.toLowerCase()) ||
          p.name?.toLowerCase().startsWith(b.toLowerCase())
        )
      );
    }

    // Apply price range filter
    result = result.filter(p =>
      p.price >= filterState.priceRange[0] && p.price <= filterState.priceRange[1]
    );

    // Apply search filter
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.subcategory?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    switch (filterState.sortBy) {
      case 'price_low_high':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_high_low':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name_a_z':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name_z_a':
        result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
    }

    return result;
  }, [dataState.products, filterState.selectedBrands, filterState.priceRange, filterState.searchQuery, filterState.sortBy]);

  // ============================================================================
  // OPTIMIZED DATA FETCHING - Single entry point
  // ============================================================================
  const loadData = useCallback(async (page = 0, isRefresh = false) => {
    if (isLoadingRef.current && !isRefresh) return;
    isLoadingRef.current = true;

    // Cancel any in-flight requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const cacheKey = getCacheKey(id || '', isWholesalerId ? id : undefined);

    // Try cache first for instant display (only for initial load)
    if (page === 0 && !isRefresh) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setDataState({
          products: cached.products,
          categories: cached.categories,
          wholesalerName: cached.wholesalerName,
          brands: cached.brands,
          totalCount: cached.totalCount,
        });
        setUiState(prev => ({
          ...prev,
          loading: false,
          hasMoreProducts: cached.totalCount > PRODUCTS_PER_PAGE,
        }));
        isLoadingRef.current = false;
        initialLoadDoneRef.current = true;
        categoriesLoadedRef.current = true; // Categories already loaded from cache
        return;
      }
    }

    const isInitialLoad = page === 0;

    if (isInitialLoad) {
      setUiState(prev => ({ ...prev, loading: true }));
    } else {
      setUiState(prev => ({ ...prev, isLoadingMore: true }));
    }

    try {
      const startTime = Date.now();

      // ========== PARALLEL FETCH ALL DATA ==========
      const fetchPromises: Promise<any>[] = [];

      // 1. Fetch wholesaler name if needed (only for wholesaler view)
      let wholesalerNamePromise: Promise<string | null> = Promise.resolve(null);
      if (isWholesalerId && isInitialLoad) {
        wholesalerNamePromise = supabase
          .from('seller_details')
          .select('business_name')
          .eq('user_id', id)
          .single()
          .then(({ data }) => data?.business_name || null);
      }

      // 1b. Fetch category name if we have category UUID but no paramName
      let categoryName: string | null = paramName || null;
      if (isCategoryId && id && !categoryName && isInitialLoad) {
        try {
          const { data } = await supabase
            .from('categories')
            .select('name')
            .eq('id', id)
            .single();
          categoryName = data?.name || null;
        } catch {
          // Category not found in categories table, will try category_id as fallback
          categoryName = null;
        }
      }

      // 2. Build and execute product query
      let query = supabase
        .from('products')
        .select('id, name, price, image_url, min_quantity, unit, category, subcategory, brand, seller_id', { count: 'exact' });

      // Apply seller filter for wholesaler view
      if (isWholesalerId) {
        query = query.eq('seller_id', id);
      } else if (shouldShowWholesalerView && !isWholesalerId) {
        // For 'more' or 'personal-care', get all wholesaler products
        const { data: wholesalers } = await supabase
          .from('seller_details')
          .select('user_id')
          .eq('seller_type', 'wholesaler');

        if (wholesalers?.length) {
          query = query.in('seller_id', wholesalers.map(w => w.user_id));
          if (id === 'personal-care') {
            query = query.eq('category', 'personal-care');
          }
        }
      } else if (isCategoryId && id) {
        // For category UUIDs, prefer using category_id for exact matching
        // Also try matching by category name for backwards compatibility
        console.log('[CategoryProducts] Filtering by category:', {
          id,
          categoryName,
          type: 'category'
        });

        // Use category_id first since it's more reliable
        // If categoryName is available, also try matching by name using OR
        if (categoryName) {
          // Escape the category name for use in filter string
          const escapedName = categoryName.replace(/"/g, '\\"');
          query = query.or(`category_id.eq.${id},category.eq."${escapedName}"`);
        } else {
          query = query.eq('category_id', id);
        }
      } else if (isSubcategoryId && id) {
        query = query.eq('subcategory_id', id);
        if (parentCategoryId) {
          query = query.eq('category_id', parentCategoryId);
        }
      } else if (id && id !== 'all' && id !== 'more') {
        const catName = getCategoryNameFromId(id);
        const catData = PRODUCT_CATEGORIES.find(c => c.id === id || c.name === catName);

        if (catData?.subcategories?.length) {
          const subNames = catData.subcategories.map(s => s.name);
          const filters = [
            `category.eq.${catName}`,
            `subcategory.in.(${subNames.map(s => `"${s}"`).join(',')})`
          ];
          query = query.or(filters.join(','));
        } else {
          query = query.eq('category', catName);
        }
      }

      // Apply selected category/subcategory filter
      if (filterState.selectedSubcategory) {
        query = query.eq('subcategory', filterState.selectedSubcategory);
      } else if (filterState.selectedCategory && filterState.selectedCategory !== 'all') {
        // Look up category from dataState.categories first (for dynamically built categories)
        const categoryFromState = dataState.categories.find(c => c.id === filterState.selectedCategory);
        const catName = categoryFromState?.name || getCategoryNameFromId(filterState.selectedCategory);

        // If category has subcategories, include products from all subcategories
        if (categoryFromState?.subcategories?.length) {
          // Filter: category = catName OR subcategory in (subcategories)
          const subcatList = categoryFromState.subcategories.map(s => `"${s}"`).join(',');
          query = query.or(`category.eq.${catName},subcategory.in.(${subcatList})`);
        } else {
          query = query.eq('category', catName);
        }
      }

      // Apply distance filter (only if not viewing a specific wholesaler's inventory)
      // Filter products to only show those from sellers within the distanceFilter radius
      if (userLocation && !isWholesalerId) {
        try {
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
            // Filter query to only include products from nearby sellers
            query = query.in('seller_id', nearbySellerIds);
          } else {
            // If no nearby sellers found, continue without distance filter
            // This allows users to see products even if no sellers are within the selected radius
            console.log('[CategoryProducts] No nearby sellers found within', distanceFilter, 'km. Showing all products.');
            // Continue with the query without distance filtering
          }
        } catch (error) {
          console.error('[CategoryProducts] Error fetching nearby sellers:', error);
          // Continue without distance filter if there's an error
        }
      }

      // Pagination
      const start = page * PRODUCTS_PER_PAGE;
      const end = start + PRODUCTS_PER_PAGE - 1;
      query = query.order('name').range(start, end);

      // Execute queries in parallel
      const [productsResult, wholesalerName] = await Promise.all([
        query,
        wholesalerNamePromise,
      ]);

      if (productsResult.error) throw productsResult.error;

      const { data: products, count: totalCount } = productsResult;

      console.log('[CategoryProducts] Products fetched:', {
        count: products?.length || 0,
        totalCount,
        sampleProducts: products?.slice(0, 2).map(p => ({ id: p.id, name: p.name, category: p.category }))
      });

      // Fetch seller details for all unique seller IDs (if not wholesaler view)
      let sellerDetailsMap: Record<string, { business_name: string; seller_type: string }> = {};
      if (!isWholesalerId && products && products.length > 0) {
        const uniqueSellerIds = [...new Set(products.map(p => p.seller_id).filter(Boolean))];
        if (uniqueSellerIds.length > 0) {
          try {
            const { data: sellers } = await supabase
              .from('seller_details')
              .select('user_id, business_name, seller_type')
              .in('user_id', uniqueSellerIds);

            if (sellers) {
              sellers.forEach(seller => {
                sellerDetailsMap[seller.user_id] = {
                  business_name: seller.business_name || 'Unknown Seller',
                  seller_type: seller.seller_type || 'wholesaler'
                };
              });
            }
          } catch (error) {
            console.error('Error fetching seller details:', error);
          }
        }
      }

      // Transform products
      const transformedProducts: Product[] = (products || []).map(p => {
        // For wholesaler view, use the fetched wholesaler name (or cached value from previous load)
        // For category view, use seller details from map
        const effectiveWholesalerName = wholesalerName || dataState.wholesalerName;
        const sellerInfo = isWholesalerId
          ? { business_name: effectiveWholesalerName || 'Unknown Seller', seller_type: 'wholesaler' }
          : (sellerDetailsMap[p.seller_id] || { business_name: 'Unknown Seller', seller_type: 'wholesaler' });

        return {
          ...p,
          seller_details: sellerInfo,
          image_url: p.image_url || DEFAULT_IMAGE,
        };
      });

      // Translate if not English (in background for non-blocking UI)
      // Note: Product names should NOT be translated - they are brand names/proper nouns
      let finalProducts = transformedProducts;
      if (currentLanguage !== 'en' && transformedProducts.length > 0) {
        try {
          // Only translate brand field, not product names
          finalProducts = await translateArrayFields(transformedProducts, ['brand'], currentLanguage);
        } catch {
          // Translation failed, use original
        }
      }

      // Extract brands from current products
      const brands = extractBrands(finalProducts);

      // Build categories from ALL products on initial load or after refresh
      // Categories need to be rebuilt when categoriesLoadedRef is false (fresh load or refresh)
      const shouldBuildCategories = shouldShowWholesalerView && isInitialLoad && !categoriesLoadedRef.current && isWholesalerId;

      let categories: Category[] = SIDEBAR_CATEGORIES; // Default categories

      if (shouldBuildCategories && products?.length) {
        // Fetch ALL products (without category filter) to build complete category list
        const { data: allProducts } = await supabase
          .from('products')
          .select('category, subcategory')
          .eq('seller_id', id);

        if (allProducts?.length) {
          const catMap = new Map<string, Set<string>>();
          allProducts.forEach(p => {
            if (p.category) {
              const normalizedCat = p.category.trim();
              if (!catMap.has(normalizedCat)) catMap.set(normalizedCat, new Set());
              if (p.subcategory) catMap.get(normalizedCat)!.add(p.subcategory.trim());
            }
          });

          const structuredCats: Category[] = [{ id: 'all', name: 'All Products' }];
          const usedIds = new Set<string>(['all']);

          catMap.forEach((subs, catName) => {
            let catId = catName.toLowerCase().replace(/\s+/g, '-');
            let uniqueId = catId;
            let counter = 1;
            while (usedIds.has(uniqueId)) {
              uniqueId = `${catId}-${counter}`;
              counter++;
            }
            usedIds.add(uniqueId);

            structuredCats.push({
              id: uniqueId,
              name: catName,
              subcategories: Array.from(subs)
            });
          });
          categories = structuredCats;
        }
      }

      // Update state
      if (isInitialLoad) {
        setDataState(prev => ({
          products: finalProducts,
          // Only update categories if we built new ones, otherwise keep existing
          categories: shouldBuildCategories && categories.length > 1 ? categories : prev.categories,
          wholesalerName: wholesalerName || prev.wholesalerName,
          brands,
          totalCount: totalCount || 0,
        }));

        // Only cache on true first load (not category filter changes)
        if (shouldBuildCategories) {
          categoriesLoadedRef.current = true; // Mark categories as loaded
          setCache(cacheKey, {
            products: finalProducts,
            categories,
            wholesalerName,
            brands,
            totalCount: totalCount || 0,
            timestamp: Date.now(),
          });
        }
      } else {
        setDataState(prev => ({
          ...prev,
          products: [...prev.products, ...finalProducts],
        }));
      }

      setUiState(prev => ({
        ...prev,
        loading: false,
        isLoadingMore: false,
        currentPage: page,
        hasMoreProducts: (totalCount || 0) > (page + 1) * PRODUCTS_PER_PAGE,
      }));

      if (__DEV__) {
        console.log(`[CategoryProducts] Loaded ${finalProducts.length} products in ${Date.now() - startTime}ms`);
      }

    } catch (error) {
      if (__DEV__) console.error('[CategoryProducts] Error:', error);
      setUiState(prev => ({
        ...prev,
        loading: false,
        isLoadingMore: false,
        hasMoreProducts: false,
      }));
    } finally {
      isLoadingRef.current = false;
      initialLoadDoneRef.current = true;
    }
  }, [id, paramName, isWholesalerId, shouldShowWholesalerView, isCategoryId, isSubcategoryId, parentCategoryId, currentLanguage, filterState.selectedCategory, filterState.selectedSubcategory, dataState.categories, translateArrayFields, userLocation, distanceFilter]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Use batch translation for efficiency
        const keys = Object.keys(originalTexts);
        const values = Object.values(originalTexts);

        const translatedResults = await translationService.translateBatch(values, currentLanguage);

        const newTranslations: Record<string, string> = {};
        keys.forEach((key, index) => {
          newTranslations[key] = translatedResults[index]?.translatedText || originalTexts[key as keyof typeof originalTexts];
        });

        setTranslations(newTranslations as typeof originalTexts);
      } catch (error) {
        console.error('[CategoryProducts] Error loading translations:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Initial load
  useEffect(() => {
    // Reset categories loaded flag when navigating to a new screen
    categoriesLoadedRef.current = false;
    initialLoadDoneRef.current = false;

    loadData(0, false);

    // Load wishlist in background (non-blocking)
    setTimeout(() => loadWishlist(), 500);

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [id, type]);

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
          console.log('[CategoryProducts] No location found in profiles table');
          setUserLocation(null);
        }
      } catch (error) {
        console.error('[CategoryProducts] Error fetching user location from profiles:', error);
        setUserLocation(null);
      }
    };

    fetchUserLocation();
  }, [user?.id]);

  // Reload when category selection changes or category is clicked again
  useEffect(() => {
    if (initialLoadDoneRef.current) {
      loadData(0, true);
    }
  }, [filterState.selectedCategory, filterState.selectedSubcategory, filterState.categoryClickCount, loadData]);

  // Reload when distance filter changes (user adjusts the distance slider)
  useEffect(() => {
    if (initialLoadDoneRef.current && userLocation) {
      loadData(0, true);
    }
  }, [distanceFilter, userLocation, loadData]);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const handler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (modalState.filterVisible) {
          setModalState(prev => ({ ...prev, filterVisible: false }));
          return true;
        }
        if (modalState.sortVisible) {
          setModalState(prev => ({ ...prev, sortVisible: false }));
          return true;
        }
        if (modalState.brandVisible) {
          setModalState(prev => ({ ...prev, brandVisible: false }));
          return true;
        }
        router.back();
        return true;
      });
      return () => handler.remove();
    }, [modalState, router])
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleQuantityChange = useCallback((productId: string, increment: boolean, incrementUnit: number, minQty: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(minQty, (prev[productId] || minQty) + (increment ? incrementUnit : -incrementUnit))
    }));
  }, []);

  const handleAddToCart = useCallback((product: Product, startX?: number, startY?: number) => {
    const quantity = quantities[product.id] || product.min_quantity;

    // INSTANT FEEDBACK: Trigger animation and toast immediately
    if (startX !== undefined && startY !== undefined) {
      addFlyingProduct({
        id: `${product.id}-${Date.now()}`,
        imageUrl: typeof product.image_url === 'string' ? product.image_url : '',
        startX,
        startY,
      });
    }
    showToast('Item added to cart!', 'success');

    // BACKGROUND SYNC: Add to cart without blocking UI
    addToCart({
      uniqueId: '',
      product_id: product.id,
      name: product.name,
      price: product.price.toString(),
      image_url: typeof product.image_url === 'string' ? product.image_url : '',
      unit: product.unit,
      quantity,
      seller_id: product.seller_id
    }).catch((error: any) => {
      // Handle errors in background - show error toast if add failed
      if (error.message?.includes('Distance to')) {
        setDistanceError(error.message);
        setModalState(prev => ({ ...prev, distanceVisible: true }));
      } else {
        showToast('Failed to add item to cart.', 'error');
      }
    });
  }, [quantities, addToCart, addFlyingProduct, showToast]);

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/(main)/screens/product/${productId}`);
  }, [router]);

  const handleSearch = useCallback((text: string) => {
    setFilterState(prev => ({ ...prev, searchQuery: text }));
    if (!text) setIsSearching(false);
  }, []);

  const loadMoreProducts = useCallback(() => {
    if (!uiState.isLoadingMore && uiState.hasMoreProducts && !uiState.loading) {
      loadData(uiState.currentPage + 1, false);
    }
  }, [uiState.isLoadingMore, uiState.hasMoreProducts, uiState.loading, uiState.currentPage, loadData]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setUiState(prev => ({ ...prev, isRefreshing: true }));

    // Clear cache for this screen to force fresh data from database
    const cacheKey = getCacheKey(id || '', isWholesalerId ? id : undefined);
    dataCache.delete(cacheKey);

    // Reset flags to allow rebuilding categories but keep current selection
    categoriesLoadedRef.current = false;
    initialLoadDoneRef.current = false;

    // Reset pagination but keep current filters (category, subcategory, etc.)
    setUiState(prev => ({
      ...prev,
      currentPage: 0,
      hasMoreProducts: true,
    }));

    // Clear current products to show loading state, but keep categories
    setDataState(prev => ({
      ...prev,
      products: [],
      totalCount: 0,
    }));

    // Reload data from database with current filter selection
    await loadData(0, true);

    // Also refresh wishlist in background
    loadWishlist();

    setUiState(prev => ({ ...prev, isRefreshing: false }));
  }, [id, isWholesalerId, loadData, loadWishlist]);

  const toggleCategoryExpansion = useCallback((categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }, []);

  const toggleBrandFilter = useCallback((brand: string) => {
    setFilterState(prev => ({
      ...prev,
      selectedBrands: prev.selectedBrands.includes(brand)
        ? prev.selectedBrands.filter(b => b !== brand)
        : [...prev.selectedBrands, brand]
    }));
  }, []);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  const renderCategoryItem = useCallback(({ item }: { item: Category }) => {
    const isExpanded = expandedCategories[item.id] || false;
    const isSelected = filterState.selectedCategory === item.id && !filterState.selectedSubcategory;

    return (
      <View>
        <Pressable
          style={[styles.categoryItem, isSelected && styles.selectedCategoryItem]}
          onPress={() => {
            // Always update filter and increment click count to force reload
            setFilterState(prev => ({
              ...prev,
              selectedCategory: item.id,
              selectedSubcategory: null,
              categoryClickCount: prev.categoryClickCount + 1
            }));
            if (item.subcategories?.length) toggleCategoryExpansion(item.id);
          }}
        >
          <View style={styles.categoryContent}>
            {item.icon && <Image source={item.icon} style={styles.categoryIcon} />}
            <Text style={[styles.categoryText, isSelected && styles.selectedCategoryText]} numberOfLines={2}>
              {translateCategoryOrSubcategory(item.name, true)}
            </Text>
            {item.subcategories?.length ? (
              <IconButton
                icon={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                onPress={() => toggleCategoryExpansion(item.id)}
                style={styles.expandButton}
              />
            ) : null}
          </View>
        </Pressable>

        {isExpanded && item.subcategories?.length ? (
          <View style={styles.subcategoriesContainer}>
            {item.subcategories.map((subcat, index) => (
              <Pressable
                key={`${item.id}-${subcat}-${index}`}
                style={[
                  styles.subcategoryItem,
                  filterState.selectedSubcategory === subcat && styles.selectedSubcategoryItem
                ]}
                onPress={() => {
                  // Always update and increment click count to force reload
                  setFilterState(prev => ({
                    ...prev,
                    selectedCategory: item.id,
                    selectedSubcategory: subcat,
                    categoryClickCount: prev.categoryClickCount + 1
                  }));
                }}
              >
                <Text
                  style={[
                    styles.subcategoryText,
                    filterState.selectedSubcategory === subcat && styles.selectedSubcategoryText
                  ]}
                  numberOfLines={1}
                >
                  {translateCategoryOrSubcategory(subcat, false)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }, [expandedCategories, filterState.selectedCategory, filterState.selectedSubcategory, toggleCategoryExpansion, translateCategoryOrSubcategory]);

  const renderProductItem = useCallback(({ item }: { item: Product }) => {
    if (item.isSkeleton) {
      return <ProductCardSkeleton style={shouldShowWholesalerView ? styles.wholesalerProductCard : styles.categoryProductCard} />;
    }

    return (
      <OptimizedProductCard
        product={item}
        initialQuantity={quantities[item.id]}
        inWishlist={isInWishlist(item.id)}
        isWholesalerView={shouldShowWholesalerView}
        onPress={handleProductPress}
        onAddToCart={(product, startX, startY) => {
          // Use the quantity from product (set by OptimizedProductCard internally)
          const qty = (product as any).quantity || product.min_quantity;

          // Instant feedback
          if (startX !== undefined && startY !== undefined) {
            addFlyingProduct({
              id: `${product.id}-${Date.now()}`,
              imageUrl: typeof product.image_url === 'string' ? product.image_url : '',
              startX,
              startY,
            });
          }
          showToast(translations.addedToCart, 'success');

          // Background sync
          addToCart({
            uniqueId: '',
            product_id: product.id,
            name: product.name,
            price: product.price.toString(),
            image_url: typeof product.image_url === 'string' ? product.image_url : '',
            unit: product.unit,
            quantity: qty,
            seller_id: product.seller_id
          }).catch((error: any) => {
            if (error.message?.includes('Distance to')) {
              setDistanceError(error.message);
              setModalState(prev => ({ ...prev, distanceVisible: true }));
            } else {
              showToast(translations.failedToAdd, 'error');
            }
          });
        }}
        onWishlistToggle={(productId, add) => {
          if (add) {
            const product = dataState.products.find(p => p.id === productId);
            if (product) addToWishlist(product);
          } else {
            removeFromWishlist(productId);
          }
        }}
        onSellerPress={(sellerId) => router.push(`/(main)/screens/category/${sellerId}`)}
        cartQuantity={getCartQuantity(item.id)}
        onUpdateCartQuantity={handleUpdateCartQuantity}
      />
    );
  }, [shouldShowWholesalerView, isInWishlist, handleProductPress, addToCart, addFlyingProduct, showToast, addToWishlist, removeFromWishlist, router, dataState.products, quantities, getCartQuantity, handleUpdateCartQuantity, translations]);

  // Prepare FlatList data with skeletons
  const listData = useMemo(() => {
    if (uiState.isLoadingMore) {
      const skeletonCount = shouldShowWholesalerView ? 4 : 6;
      return [...filteredProducts, ...Array.from({ length: skeletonCount }, (_, i) => ({ id: `skeleton-${i}`, isSkeleton: true } as Product))];
    }
    return filteredProducts;
  }, [filteredProducts, uiState.isLoadingMore, shouldShowWholesalerView]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  if (uiState.loading && dataState.products.length === 0) {
    return <CategoryScreenSkeleton showSidebar={shouldShowWholesalerView} />;
  }

  return (
    <LinearGradient
      colors={['#FFF8F0', '#FFFFFF', '#F5F7FA', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.25, 0.75, 1]}
      style={styles.container}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }]
        }}
      >
        <Appbar.Header mode="small" style={styles.header} theme={{ colors: { surface: 'transparent' } }}>
          <LinearGradient
            colors={['#FFFFFF', '#FFF8F0', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            locations={[0, 0.5, 1]}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Appbar.BackAction onPress={() => router.back()} />
              {isSearching ? (
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder={translations.searchProducts}
                    value={filterState.searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                  />
                  {filterState.searchQuery ? (
                    <IconButton icon="close" size={20} onPress={() => handleSearch('')} />
                  ) : null}
                </View>
              ) : (
                <>
                  <Appbar.Content title={translateCategoryOrSubcategory(categoryName, true)} />
                  <Appbar.Action icon="magnify" onPress={() => setIsSearching(true)} />
                </>
              )}
              <AnimatedCartIcon />
            </View>
          </LinearGradient>
        </Appbar.Header>
      </Animated.View>

      <Animated.View
        style={[
          styles.filterRowContainer,
          {
            position: 'absolute',
            top: 60, // Below header
            left: 0,
            right: 0,
            zIndex: 999,
            opacity: filterBarOpacity,
            transform: [{ translateY: filterBarTranslateY }]
          }
        ]}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FFF8F0', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.5, 1]}
          style={styles.filterRow}
        >
          <Pressable style={styles.filterButton} onPress={() => setModalState(prev => ({ ...prev, filterVisible: true }))}>
            <IconButton icon="filter-variant" size={16} />
            <Text style={styles.filterButtonText}>{translations.filter}</Text>
          </Pressable>

          <Pressable style={styles.filterButton} onPress={() => setModalState(prev => ({ ...prev, sortVisible: true }))}>
            <IconButton icon="sort" size={16} />
            <Text style={styles.filterButtonText}>{translations.sort}</Text>
          </Pressable>

          <Pressable style={styles.filterButton} onPress={() => setModalState(prev => ({ ...prev, brandVisible: true }))}>
            <Text style={styles.filterButtonText}>{translations.brand}</Text>
            <IconButton icon="chevron-down" size={16} />
          </Pressable>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.content, { paddingTop: contentPaddingTop }]}>
        {/* Only show sidebar when seller has products - hide default categories for empty seller views */}
        {shouldShowWholesalerView && dataState.products.length > 0 && (
          <LinearGradient
            colors={['#FFF8F0', '#FFFFFF', '#F5F7FA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            locations={[0, 0.5, 1]}
            style={styles.sidebar}
          >
            <FlatList
              data={dataState.categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sidebarContent}
            />
          </LinearGradient>
        )}

        <View style={[styles.productsContainer, (!shouldShowWholesalerView || dataState.products.length === 0) && { width: '100%' }]}>
          <FlatList
            key={shouldShowWholesalerView ? 'wholesaler-2-cols' : 'category-3-cols'}
            data={listData}
            renderItem={renderProductItem}
            keyExtractor={(item, index) => item.isSkeleton ? `skeleton-${index}` : `${item.id}-${index}`}
            numColumns={shouldShowWholesalerView ? 2 : 3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            onEndReached={loadMoreProducts}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={6}
            windowSize={5}
            initialNumToRender={6}
            updateCellsBatchingPeriod={50}
            refreshControl={
              <RefreshControl
                refreshing={uiState.isRefreshing}
                onRefresh={handleRefresh}
                colors={['#FF6B00']}
                tintColor="#FF6B00"
                title={translations.pullToRefresh}
                titleColor="#666"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Image
                  source={require('../../../../assets/icons/no_results.png')}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyText}>
                  {isSearching ? translations.noProducts : translations.noProducts}
                </Text>
                <Text style={styles.emptySubtext}>
                  {isSearching
                    ? `${translations.noProducts} "${filterState.searchQuery}"`
                    : translations.tryDifferentFilter}
                </Text>
              </View>
            }
          />
        </View>
      </Animated.View>

      {/* Filter Modal */}
      <Portal>
        <Modal
          visible={modalState.filterVisible}
          onDismiss={() => setModalState(prev => ({ ...prev, filterVisible: false }))}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{translations.filter}</Text>
            <IconButton icon="close" size={20} onPress={() => setModalState(prev => ({ ...prev, filterVisible: false }))} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.filterSectionTitle}>{translations.priceRange}</Text>
            <View style={styles.priceRangeContainer}>
              <Text>₹{filterState.priceRange[0]} - ₹{filterState.priceRange[1]}</Text>
            </View>

            <Text style={styles.filterSectionTitle}>{translations.brands}</Text>
            {dataState.brands.map(brand => (
              <Checkbox.Item
                key={brand}
                label={brand}
                status={filterState.selectedBrands.includes(brand) ? 'checked' : 'unchecked'}
                onPress={() => toggleBrandFilter(brand)}
              />
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button mode="contained" onPress={() => setModalState(prev => ({ ...prev, filterVisible: false }))} style={styles.footerButton}>
              {translations.apply}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Sort Modal */}
      <Portal>
        <Modal
          visible={modalState.sortVisible}
          onDismiss={() => setModalState(prev => ({ ...prev, sortVisible: false }))}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{translations.sortBy}</Text>
            <IconButton icon="close" size={20} onPress={() => setModalState(prev => ({ ...prev, sortVisible: false }))} />
          </View>

          <View style={styles.modalContent}>
            <RadioButton.Group
              onValueChange={value => {
                setFilterState(prev => ({ ...prev, sortBy: value }));
                setModalState(prev => ({ ...prev, sortVisible: false }));
              }}
              value={filterState.sortBy}
            >
              <RadioButton.Item label={translations.popularity} value="popularity" />
              <RadioButton.Item label={translations.priceLowToHigh} value="price_low_high" />
              <RadioButton.Item label={translations.priceHighToLow} value="price_high_low" />
              <RadioButton.Item label={translations.nameAZ} value="name_a_z" />
              <RadioButton.Item label={translations.nameZA} value="name_z_a" />
            </RadioButton.Group>
          </View>
        </Modal>
      </Portal>

      {/* Brand Modal */}
      <Portal>
        <Modal
          visible={modalState.brandVisible}
          onDismiss={() => setModalState(prev => ({ ...prev, brandVisible: false }))}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{translations.selectBrand}</Text>
            <IconButton icon="close" size={20} onPress={() => setModalState(prev => ({ ...prev, brandVisible: false }))} />
          </View>

          <ScrollView style={styles.modalContent}>
            {dataState.brands.map(brand => (
              <Checkbox.Item
                key={brand}
                label={brand}
                status={filterState.selectedBrands.includes(brand) ? 'checked' : 'unchecked'}
                onPress={() => toggleBrandFilter(brand)}
              />
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button mode="outlined" onPress={() => setFilterState(prev => ({ ...prev, selectedBrands: [] }))} style={styles.footerButton}>
              {translations.clearFilters}
            </Button>
            <Button mode="contained" onPress={() => setModalState(prev => ({ ...prev, brandVisible: false }))} style={styles.footerButton}>
              {translations.apply}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Distance Manager Modal */}
      <CartDistanceManager
        visible={modalState.distanceVisible}
        onDismiss={() => setModalState(prev => ({ ...prev, distanceVisible: false }))}
        errorMessage={distanceError}
      />
    </LinearGradient>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
    elevation: 0,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    overflow: 'hidden',
  },
  headerGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  // ============================================================================
  // FILTER BAR - Premium Pills Design
  // ============================================================================
  filterRowContainer: {
    overflow: 'hidden',
    zIndex: 10,
    elevation: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 32,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 3,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: '25%',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  sidebarContent: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  categoryItem: {
    padding: 10,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  selectedCategoryItem: {
    backgroundColor: '#fff',
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
  expandButton: {
    margin: 0,
    padding: 0,
  },
  subcategoriesContainer: {
    backgroundColor: '#fff',
    paddingLeft: 15,
  },
  subcategoryItem: {
    padding: 8,
    paddingLeft: 15,
  },
  selectedSubcategoryItem: {
    backgroundColor: '#FFF3E0',
  },
  subcategoryText: {
    fontSize: 11,
    color: '#666',
  },
  selectedSubcategoryText: {
    color: '#FF7D00',
    fontWeight: '600',
  },
  productsContainer: {
    flex: 1,
    width: '75%',
    backgroundColor: 'transparent',
  },
  productsList: {
    padding: 4,
    paddingBottom: 100,
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
    flex: 1,
    padding: 8,
  },
  imageContainer: {
    height: 90,
    width: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  wishlistIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    margin: 0,
  },
  productInfo: {
    flex: 1,
    paddingTop: 6,
  },
  nameContainer: {
    minHeight: 36,
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    lineHeight: 16,
  },
  sellerName: {
    fontSize: 10,
    color: '#FF7D00',
    marginTop: 2,
  },
  priceInfo: {
    marginVertical: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  minQuantity: {
    fontSize: 10,
    color: '#666',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 15,
    paddingHorizontal: 4,
  },
  quantityButton: {
    margin: 0,
    width: 24,
    height: 24,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  addButtonContainer: {
    marginTop: 'auto',
  },
  addButton: {
    backgroundColor: '#FF7D00',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  footerButton: {
    minWidth: 100,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  priceRangeContainer: {
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#f44336',
    textAlign: 'center',
  },
});
