import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, Pressable, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Searchbar, Card, Avatar, ActivityIndicator, IconButton, Chip, Button, Snackbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase/supabase';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';
import ProductImage from '../../../components/common/ProductImage';
import CartIcon from '../../../components/CartIcon';
import { useCartStore } from '../../../store/cart';
import { useLocationStore } from '../../../store/location';
import ProductSearchService from '../../../services/productSearchService';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTranslateDynamic } from '../../../utils/translationUtils';
import CartDistanceManager from '../../../components/CartDistanceManager';
import { translationService, SupportedLanguage } from '../../../services/translationService';
import { useLanguageStore } from '../../../store/language';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemStatusBar } from '../../../components/SystemStatusBar';

// Premium Theme Colors
const COLORS = {
  primary: '#FF7D00',
  primaryLight: '#FFA64D',
  primaryDark: '#E56700',
  secondary: '#1E2A3A',
  white: '#FFFFFF',
  offWhite: '#F8F9FA',
  lightGrey: '#F0F2F5',
  grey: '#8E8E93',
  darkGrey: '#4A4A4A',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#007AFF',
  cardBg: '#FFFFFF',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.05)',
};

// Safe router hook with validation
const useSafeRouter = () => {
  let router;

  try {
    router = useRouter();
  } catch (error) {
    console.error('[Search] Error initializing router:', error);
    router = null;
  }

  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Search] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Search] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Search] router.back not available');
      }
    },
    canGoBack: () => {
      if (router && typeof router.canGoBack === 'function') {
        return router.canGoBack();
      }
      return false;
    }
  };

  return safeRouter;
};

const { width } = Dimensions.get('window');
const productCardWidth = (width - 48) / 2;

interface SearchResult {
  type: 'product' | 'seller' | 'manufacturer' | 'category';
  id: string;
  name: string;
  image?: string;
  description?: string;
  path?: string;
  price?: string;
  unit?: string;
  seller_id?: string;
  min_quantity?: number;
  seller_name?: string;
  stock_available?: number;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const { query, results: initialResults, language, intent, autoOrder, quantity: voiceQuantity, source } = useLocalSearchParams() as {
    query?: string;
    results?: string;
    language?: string;
    intent?: string;
    autoOrder?: string;
    quantity?: string;
    source?: string;
  };
  const { translateArrayFields } = useTranslateDynamic();

  // Original texts object for useInstantTranslation
  const originalTexts = {
    searchResults: 'Search Results',
    results: 'results',
    searchPlaceholder: 'Search wholesalers, products...',
    sortBy: 'Sort by',
    relevance: 'Relevance',
    name: 'Name',
    noResultsFor: 'No results found for',
    products: 'Products',
    wholesalers: 'Wholesalers',
    manufacturers: 'Manufacturers',
    categories: 'Categories',
    productName: 'Product Name',
    noDescription: 'No description available',
    seller: 'Seller',
    minOrder: 'Min Order',
    inStock: 'In stock',
    outOfStock: 'Out of stock',
    wholesaler: 'Wholesaler',
    manufacturer: 'Manufacturer',
    addToCart: 'Add to Cart',
    added: 'Added',
    remove: 'Remove',
    lowStock: 'Low stock',
    available: 'Available',
    stock: 'Stock',
    min: 'Min',
    price: 'Price',
    ocrOrder: 'OCR Order',
    scanSearch: 'Scan Search',
    trySearchingFor: 'Try searching for',
    searching: 'Searching...',
  };

  // Use translation hook for UI texts
  const [translations, setTranslations] = useState(originalTexts);

  // Translation function
  const t = (key: keyof typeof originalTexts) => translations[key] || originalTexts[key];

  const [searchQuery, setSearchQuery] = useState(query as string);
  const [results, setResults] = useState<SearchResult[]>(() => {
    if (initialResults) {
      try {
        return JSON.parse(initialResults as string);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(!initialResults);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addToCart } = useCartStore();
  const { user } = useAuthStore();
  const { userLocation } = useLocationStore();
  const currentLanguage = useLanguageStore(state => state.language);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [addedToCartIds, setAddedToCartIds] = useState<Record<string, boolean>>({});
  const [isVoiceSearch, setIsVoiceSearch] = useState(!!language);
  const [autoOrderMode, setAutoOrderMode] = useState(autoOrder === 'true');
  const [sortOption, setSortOption] = useState<'name' | 'relevance'>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [showDistanceManager, setShowDistanceManager] = useState(false);
  const [distanceError, setDistanceError] = useState('');

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage as SupportedLanguage);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        setTranslations(Object.fromEntries(translatedEntries) as typeof originalTexts);
      } catch (error) {
        console.error('[Search] Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Remove product from search results
  const removeProduct = (productId: string) => {
    setResults(prev => prev.filter(item => item.id !== productId));
  };

  // Filter and sort results
  const getFilteredAndSortedResults = () => {
    let filteredResults = [...results];
    filteredResults.sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'relevance':
        default:
          if (a.type === 'product' && b.type !== 'product') return -1;
          if (a.type !== 'product' && b.type === 'product') return 1;
          return 0;
      }
    });
    return filteredResults;
  };

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    }
  }, []);

  useEffect(() => {
    if (isVoiceSearch && autoOrderMode && searchQuery && !initialResults) {
      performSearch(searchQuery);
    }
  }, [isVoiceSearch, autoOrderMode, searchQuery]);

  useEffect(() => {
    if (source === 'ocr' && searchQuery && !initialResults) {
      performSearch(searchQuery);
    }
  }, [source, searchQuery]);

  const handleQuantityChange = (productId: string, increment: boolean, minQuantity: number = 1) => {
    setQuantities(prev => {
      const currentQty = prev[productId] || minQuantity;
      return {
        ...prev,
        [productId]: increment ? currentQty + 1 : Math.max(minQuantity, currentQty - 1)
      };
    });
  };

  const handleAddToCart = async (product: SearchResult) => {
    try {
      if (product.type !== 'product') return;

      const quantity = quantities[product.id] || product.min_quantity || 1;

      await addToCart({
        uniqueId: `${product.id}-${Date.now()}`,
        product_id: product.id,
        name: product.name,
        price: product.price || "0",
        quantity,
        image_url: product.image || '',
        unit: product.unit || 'piece',
        seller_id: product.seller_id || ''
      });

      setQuantities(prev => ({
        ...prev,
        [product.id]: product.min_quantity || 1
      }));

      setAddedToCartIds(prev => ({
        ...prev,
        [product.id]: true
      }));

      setSnackbarMessage(`Added ${product.name} to cart`);
      setSnackbarVisible(true);

      setTimeout(() => {
        setAddedToCartIds(prev => ({
          ...prev,
          [product.id]: false
        }));
      }, 2000);
    } catch (error: any) {
      console.error('Error adding to cart:', error);

      if (error.message && error.message.includes('Distance to')) {
        setDistanceError(error.message);
        setShowDistanceManager(true);
      } else {
        setSnackbarMessage("Failed to add item to cart. Please try again.");
        setSnackbarVisible(true);
        setTimeout(() => setSnackbarVisible(false), 4000);
      }
    }
  };

  const performSearch = async (query: string) => {
    if (!query) return;
    setLoading(true);

    try {
      const { distanceFilter } = useLocationStore.getState();
      const isLocationFiltered = userLocation && distanceFilter;

      // Step 1: Translate query to English if user is searching in another language
      let searchQueryInEnglish = query;
      if (currentLanguage !== 'en') {
        try {
          console.log(`[Search] Translating query from ${currentLanguage} to English:`, query);
          const translationResult = await translationService.translateText(query, 'en' as SupportedLanguage);
          searchQueryInEnglish = translationResult.translatedText || query;
          console.log('[Search] Translated query:', searchQueryInEnglish);
        } catch (error) {
          console.error('[Search] Error translating query:', error);
          // Continue with original query if translation fails
        }
      }

      // Step 2: Perform search with both original and translated query
      const searchResults = await ProductSearchService.searchProducts({
        query: searchQueryInEnglish, // Use English query for database search
        language: language as string || 'en-US',
        intent: (intent as 'search' | 'order' | 'navigate') || 'search',
        limit: 50,
        includeOutOfStock: !autoOrderMode,
        userLatitude: userLocation?.latitude,
        userLongitude: userLocation?.longitude,
        radiusKm: isLocationFiltered ? distanceFilter : undefined,
        userLanguage: currentLanguage,
        translatedQuery: currentLanguage !== 'en' ? query : undefined // Pass original query for multilingual matching
      });

      const results: SearchResult[] = [];

      const productIds = searchResults.products.map(p => p.id);
      let sellerDetails: Record<string, any> = {};

      if (productIds.length > 0) {
        try {
          const sellerIds = searchResults.products.map(p => p.seller_id).filter(Boolean);
          const { data: sellers, error: sellerError } = await supabase
            .from('seller_details')
            .select('user_id, business_name, latitude, longitude')
            .in('user_id', sellerIds);

          if (!sellerError && sellers) {
            sellers.forEach(seller => {
              sellerDetails[seller.user_id] = seller;
            });
          }
        } catch (error) {
          console.error('Error fetching seller details:', error);
        }
      }

      searchResults.products.forEach(product => {
        const seller = sellerDetails[product.seller_id || ''];
        results.push({
          type: 'product',
          id: product.id,
          name: product.name,
          description: product.description || `${product.category} - ${product.subcategory}`,
          image: product.image_url,
          price: product.price?.toString() || '0',
          unit: 'piece',
          seller_id: product.seller_id,
          min_quantity: (product as any).min_quantity || 1,
          seller_name: seller?.business_name || 'Unknown Seller',
          stock_available: product.stock_available
        });
      });

      if (results.length < 5 || intent !== 'order') {
        for (const category of PRODUCT_CATEGORIES) {
          if (category.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: 'category',
              id: category.id,
              name: category.name,
              description: `Browse ${category.name}`,
              path: `/(main)/screens/category/${category.id}`
            });
          }

          if (category.subcategories) {
            for (const subcategory of category.subcategories) {
              if (subcategory.name.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  type: 'category',
                  id: subcategory.id,
                  name: subcategory.name,
                  description: `${category.name} > ${subcategory.name}`,
                  path: `/(main)/screens/category/${category.id}?subcategory=${subcategory.id}`
                });
              }
            }
          }
        }
      }

      if (intent !== 'order') {
        try {
          const sanitizedQuery = query
            .replace(/[\n\r\t]/g, ' ')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(word => word.length > 0)
            .join(' & ');

          const { data, error } = await supabase
            .from('seller_details')
            .select(`user_id, business_name, address, image_url, profiles(id, role)`)
            .textSearch('business_name', sanitizedQuery);

          if (!error && data && data.length > 0) {
            data.forEach(seller => {
              // @ts-ignore
              const role = seller.profiles?.role || 'seller';
              results.push({
                type: role as 'seller' | 'manufacturer',
                id: seller.user_id,
                name: seller.business_name,
                image: seller.image_url,
                description: seller.address?.street || 'Wholesaler'
              });
            });
          }
        } catch (err) {
          console.error('Exception in seller_details search:', err);
        }
      }

      if (autoOrderMode && results.length > 0) {
        const productResults = results.filter(r => r.type === 'product');
        if (productResults.length > 0) {
          const firstProduct = productResults[0];
          const orderQuantity = parseInt(voiceQuantity as string) || 1;

          try {
            if (user?.id && firstProduct.seller_id) {
              await ProductSearchService.addToCartViaVoice(user.id, firstProduct.id, orderQuantity);
              setSnackbarMessage(`Added ${orderQuantity} ${firstProduct.name} to cart automatically!`);
              setSnackbarVisible(true);
              setAddedToCartIds(prev => ({ ...prev, [firstProduct.id]: true }));
            }
          } catch (error) {
            setSnackbarMessage('Auto-order failed. Please add manually.');
            setSnackbarVisible(true);
          }
        }
      }

      if (isVoiceSearch && voiceQuantity) {
        const initialQuantities: Record<string, number> = {};
        results.forEach(result => {
          if (result.type === 'product') {
            initialQuantities[result.id] = parseInt(voiceQuantity as string) || 1;
          }
        });
        setQuantities(initialQuantities);
      }

      // Note: Product names should NOT be translated - they are brand names/proper nouns
      // Only translate description and seller_name, not product names
      const translatedResults = await translateArrayFields(results, ['description', 'seller_name']);
      setResults(translatedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'category':
        router.push(result.path || `/(main)/screens/category/${result.id}`);
        break;
      case 'seller':
      case 'manufacturer':
        router.push(`/(main)/screens/category/${result.id}`);
        break;
      case 'product':
        router.push(`/(main)/screens/product/${result.id}`);
        break;
    }
  };

  const renderProductItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'product') return null;

    const quantity = quantities[item.id] || item.min_quantity || 1;
    const isInStock = (item.stock_available || 0) > (item.min_quantity || 1);

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.productCardInner}>
          {/* Product Image with Gradient Overlay */}
          <View style={styles.productImageContainer}>
            <ProductImage
              imageUrl={item.image}
              style={styles.productImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.imageOverlay}
            />
            {/* Stock Badge */}
            <View style={[styles.stockBadge, { backgroundColor: isInStock ? COLORS.success : COLORS.danger }]}>
              <Text style={styles.stockBadgeText}>
                {isInStock ? t('inStock') : t('outOfStock')}
              </Text>
            </View>
            {/* Remove Button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={(e) => {
                e.stopPropagation();
                removeProduct(item.id);
              }}
            >
              <Ionicons name="close-circle" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Product Details */}
          <View style={styles.productDetails}>
            <Text numberOfLines={2} style={styles.productName}>
              {item?.name || t('productName')}
            </Text>

            {/* Seller Badge */}
            <View style={styles.sellerBadge}>
              <Ionicons name="storefront-outline" size={12} color={COLORS.primary} />
              <Text numberOfLines={1} style={styles.sellerNameText}>
                {item.seller_name || t('seller')}
              </Text>
            </View>

            {/* Price Row */}
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>₹{item.price}</Text>
              <Text style={styles.unitText}>/ {item.unit}</Text>
            </View>

            {/* Min Order Info */}
            <View style={styles.minOrderRow}>
              <Text style={styles.minOrderLabel}>{t('min')}: </Text>
              <Text style={styles.minOrderValue}>{item.min_quantity} {item.unit}s</Text>
            </View>

            {/* Quantity & Add to Cart */}
            <View style={styles.actionRow}>
              <View style={styles.quantitySelector}>
                <TouchableOpacity
                  style={styles.quantityBtn}
                  onPress={() => handleQuantityChange(item.id, false, item.min_quantity || 1)}
                >
                  <Ionicons name="remove" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityBtn}
                  onPress={() => handleQuantityChange(item.id, true, item.min_quantity || 1)}
                >
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.addToCartBtn, addedToCartIds[item.id] && styles.addedBtn]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
              >
                <Ionicons
                  name={addedToCartIds[item.id] ? "checkmark-circle" : "cart"}
                  size={18}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSellerItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'seller' && item.type !== 'manufacturer') return null;

    return (
      <TouchableOpacity
        style={styles.sellerCard}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.sellerCardInner}>
          <View style={styles.sellerImageWrapper}>
            <ProductImage
              imageUrl={item.image}
              style={styles.sellerImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.sellerAddress} numberOfLines={1}>{item.description}</Text>
            <View style={[styles.typeBadge, { backgroundColor: item.type === 'seller' ? '#E3F2FD' : '#F3E5F5' }]}>
              <Ionicons
                name={item.type === 'seller' ? 'business' : 'construct'}
                size={12}
                color={item.type === 'seller' ? '#1976D2' : '#7B1FA2'}
              />
              <Text style={[styles.typeBadgeText, { color: item.type === 'seller' ? '#1976D2' : '#7B1FA2' }]}>
                {item.type === 'seller' ? t('wholesaler') : t('manufacturer')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.grey} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'category') return null;

    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => handleResultPress(item)}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.categoryIcon}
        >
          <Ionicons name="folder" size={24} color={COLORS.white} />
        </LinearGradient>
        <View style={styles.categoryDetails}>
          <Text style={styles.categoryName}>{item.name || 'Product'}</Text>
          <Text style={styles.categoryDescription}>{item.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.grey} />
      </TouchableOpacity>
    );
  };

  const filteredAndSortedResults = getFilteredAndSortedResults();
  const groupedResults = filteredAndSortedResults.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const renderResultsSection = () => {
    const hasProducts = groupedResults.product && groupedResults.product.length > 0;
    const hasSellers = groupedResults.seller && groupedResults.seller.length > 0;
    const hasManufacturers = groupedResults.manufacturer && groupedResults.manufacturer.length > 0;
    const hasCategories = groupedResults.category && groupedResults.category.length > 0;

    return (
      <>
        {/* Products Section */}
        {hasProducts && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cube" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{t('products')}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{groupedResults.product?.length}</Text>
              </View>
            </View>
            <View style={styles.productsGrid}>
              {groupedResults.product?.map((item, index) => (
                <View key={`product-${item.id}`} style={styles.productWrapper}>
                  {renderProductItem({ item })}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Wholesalers Section */}
        {hasSellers && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="business" size={20} color={COLORS.info} />
              <Text style={styles.sectionTitle}>{t('wholesalers')}</Text>
              <View style={[styles.sectionBadge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.sectionBadgeText, { color: '#1976D2' }]}>{groupedResults.seller?.length}</Text>
              </View>
            </View>
            {groupedResults.seller?.map((item) => (
              <View key={`seller-${item.id}`}>
                {renderSellerItem({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Manufacturers Section */}
        {hasManufacturers && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct" size={20} color="#7B1FA2" />
              <Text style={styles.sectionTitle}>{t('manufacturers')}</Text>
              <View style={[styles.sectionBadge, { backgroundColor: '#F3E5F5' }]}>
                <Text style={[styles.sectionBadgeText, { color: '#7B1FA2' }]}>{groupedResults.manufacturer?.length}</Text>
              </View>
            </View>
            {groupedResults.manufacturer?.map((item) => (
              <View key={`manufacturer-${item.id}`}>
                {renderSellerItem({ item })}
              </View>
            ))}
          </View>
        )}

        {/* Categories Section */}
        {hasCategories && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="folder" size={20} color={COLORS.success} />
              <Text style={styles.sectionTitle}>{t('categories')}</Text>
              <View style={[styles.sectionBadge, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[styles.sectionBadgeText, { color: COLORS.success }]}>{groupedResults.category?.length}</Text>
              </View>
            </View>
            {groupedResults.category?.map((item) => (
              <View key={`category-${item.id}`}>
                {renderCategoryItem({ item })}
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" />

      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {isVoiceSearch
                ? (autoOrderMode ? t('ocrOrder') : t('scanSearch'))
                : t('searchResults')}
            </Text>
            {results.length > 0 && (
              <Text style={styles.headerSubtitle}>
                {getFilteredAndSortedResults().length} {t('results')}
              </Text>
            )}
          </View>

          <View style={styles.headerActions}>
            {userLocation && useLocationStore.getState().distanceFilter && (
              <View style={styles.distanceTag}>
                <Ionicons name="location" size={14} color={COLORS.white} />
                <Text style={styles.distanceTagText}>
                  {useLocationStore.getState().distanceFilter}km
                </Text>
              </View>
            )}
            <CartIcon />
          </View>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.grey} style={styles.searchIcon} />
          <Searchbar
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => performSearch(searchQuery)}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={COLORS.grey}
            placeholderTextColor={COLORS.grey}
          />
        </View>
      </View>

      {/* Sort Controls */}
      {results.length > 0 && (
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>{t('sortBy')}:</Text>
          <View style={styles.sortChips}>
            <TouchableOpacity
              style={[styles.sortChip, sortOption === 'relevance' && styles.sortChipActive]}
              onPress={() => setSortOption('relevance')}
            >
              <Text style={[styles.sortChipText, sortOption === 'relevance' && styles.sortChipTextActive]}>
                {t('relevance')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, sortOption === 'name' && styles.sortChipActive]}
              onPress={() => setSortOption('name')}
            >
              <Text style={[styles.sortChipText, sortOption === 'name' && styles.sortChipTextActive]}>
                {t('name')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Results Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('searching')}</Text>
          </View>
        ) : results.length > 0 ? (
          renderResultsSection()
        ) : (
          <View style={styles.noResults}>
            <View style={styles.noResultsIcon}>
              <Ionicons name="search-outline" size={64} color={COLORS.lightGrey} />
            </View>
            <Text style={styles.noResultsTitle}>{t('noResultsFor')}</Text>
            <Text style={styles.noResultsQuery}>"{searchQuery}"</Text>
            <Text style={styles.noResultsHint}>{t('trySearchingFor')} products, sellers, or categories</Text>
          </View>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={styles.snackbar}
        action={{
          label: "View Cart",
          textColor: COLORS.primary,
          onPress: () => router.push('/(main)/cart'),
        }}
      >
        {snackbarMessage}
      </Snackbar>

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
    backgroundColor: COLORS.offWhite,
  },
  // Header Styles
  header: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  distanceTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Search Bar Styles
  searchContainer: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  searchInputWrapper: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 1,
  },
  searchBar: {
    backgroundColor: COLORS.lightGrey,
    borderRadius: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  searchInput: {
    fontSize: 15,
    paddingLeft: 36,
  },
  // Sort Bar Styles
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  sortLabel: {
    fontSize: 13,
    color: COLORS.grey,
    marginRight: 12,
  },
  sortChips: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.lightGrey,
  },
  sortChipActive: {
    backgroundColor: COLORS.primary,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.darkGrey,
  },
  sortChipTextActive: {
    color: COLORS.white,
  },
  // Scroll & Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.grey,
  },
  // No Results State
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  noResultsIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  noResultsTitle: {
    fontSize: 16,
    color: COLORS.grey,
  },
  noResultsQuery: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 4,
  },
  noResultsHint: {
    fontSize: 14,
    color: COLORS.grey,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#FFF3E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Product Card Styles
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  productWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  productCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  productCardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  productImageContainer: {
    position: 'relative',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.lightGrey,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  productDetails: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  sellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  sellerNameText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  unitText: {
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 4,
  },
  minOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  minOrderLabel: {
    fontSize: 11,
    color: COLORS.grey,
  },
  minOrderValue: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.darkGrey,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGrey,
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  quantityBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    minWidth: 24,
    textAlign: 'center',
  },
  addToCartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addedBtn: {
    backgroundColor: COLORS.success,
  },
  // Seller Card Styles
  sellerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sellerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  sellerImageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.lightGrey,
  },
  sellerImage: {
    width: '100%',
    height: '100%',
  },
  sellerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  sellerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  sellerAddress: {
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Category Card Styles
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDetails: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  categoryDescription: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 2,
  },
  // Snackbar
  snackbar: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
});