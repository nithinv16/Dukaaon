import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Image, Alert, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Text, DataTable, TextInput, Checkbox, Button, IconButton, Searchbar, Chip, SegmentedButtons, Modal, Portal, HelperText, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase, directFetch } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { supabaseConfig, supabaseAuthStorageKey } from '../../../../config/secrets';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Wholesaler Premium Theme (Navy/Teal) ---
const THEME = {
  primary: '#001F3F',    // Navy Blue
  secondary: '#39CCCC',  // Teal
  accent: '#7FDBFF',     // Sky Blue
  background: 'transparent',
  card: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  success: '#39CCCC',    // Teal
  error: '#FF4136',
  warning: '#FF851B',
  divider: '#E0E0E0',
  inputBackground: '#F8F9FA',
};


interface QuickAddProduct {
  id: string;
  brand: string;
  name: string;
  category: string;
  subcategory: string;
  selected: boolean;
  price: string;
  minQty: string;
  unit: string;
  stock?: string;
  image_url?: string;
  quantities?: Array<{
    value: string;
    unit: string;
    selected: boolean;
    price: string;
  }>;
}

const STORAGE_BUCKET = 'product-images';
const ITEMS_PER_PAGE = 50; // Reduced for faster loading

export default function QuickAddProducts() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentLanguage } = useLanguage();

  // State variables
  const [products, setProducts] = useState<QuickAddProduct[]>([]);
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
  const [pageLoading, setPageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'brand' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>(['All']);
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>(['All']);
  const [availableBrands, setAvailableBrands] = useState<string[]>(['All']);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<QuickAddProduct[]>([]);
  // Map to track selected products across pagination (keyed by product ID)
  const [selectedProductsMap, setSelectedProductsMap] = useState<Map<string, QuickAddProduct>>(new Map());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<QuickAddProduct | null>(null);
  const [newProductData, setNewProductData] = useState({
    name: '',
    brand: '',
    category: '',
    subcategory: '',
    price: '',
    minQty: '1',
    unit: 'pieces',
    stock: '0',
    image: null as string | null,
    quantities: [{ value: '1', unit: 'pieces', selected: true, price: '' }]
  });

  const [translations, setTranslations] = useState({
    quickAddProducts: 'Quick Add Products',
    searchPlaceholder: 'Search products, brands, categories...',
    filtersSort: 'Filters & Sort',
    category: 'Category:',
    subcategory: 'Subcategory:',
    brand: 'Brand:',
    sortBy: 'Sort by:',
    clearAllFilters: 'Clear All Filters',
    image: 'Image',
    product: 'Product',
    price: 'Price',
    moq: 'MOQ',
    action: 'Action',
    loadingProducts: 'Loading products...',
    select: 'Select',
    selected: 'Selected',
    cancel: 'Cancel',
    addSelectedProducts: 'Add Selected Products',
    noProductsSelected: 'No Products Selected',
    pleaseSelectProducts: 'Please select products and set prices',
    success: 'Success',
    productsAddedSuccessfully: 'Products added to inventory successfully!',
    error: 'Error',
    failedToAddProducts: 'Failed to add products. Please try again.',
    ok: 'OK',
    productName: 'Product Name',
    unknownBrand: 'Unknown Brand',
    uncategorized: 'Uncategorized',
    general: 'General',
    failedToLoadProducts: 'Failed to load products. Please check your connection and try again.',
    name: 'Name',
    all: 'All',
    setPrice: 'Set Price'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Quick Add Products', currentLanguage),
          translationService.translateText('Search products, brands, categories...', currentLanguage),
          translationService.translateText('Filters & Sort', currentLanguage),
          translationService.translateText('Category:', currentLanguage),
          translationService.translateText('Subcategory:', currentLanguage),
          translationService.translateText('Brand:', currentLanguage),
          translationService.translateText('Sort by:', currentLanguage),
          translationService.translateText('Clear All Filters', currentLanguage),
          translationService.translateText('Image', currentLanguage),
          translationService.translateText('Product', currentLanguage),
          translationService.translateText('Price', currentLanguage),
          translationService.translateText('MOQ', currentLanguage),
          translationService.translateText('Action', currentLanguage),
          translationService.translateText('Loading products...', currentLanguage),
          translationService.translateText('Select', currentLanguage),
          translationService.translateText('Selected', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Add Selected Products', currentLanguage),
          translationService.translateText('No Products Selected', currentLanguage),
          translationService.translateText('Please select products and set prices', currentLanguage),
          translationService.translateText('Success', currentLanguage),
          translationService.translateText('Products added to inventory successfully!', currentLanguage),
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Failed to add products. Please try again.', currentLanguage),
          translationService.translateText('OK', currentLanguage),
          translationService.translateText('Product Name', currentLanguage),
          translationService.translateText('Unknown Brand', currentLanguage),
          translationService.translateText('Uncategorized', currentLanguage),
          translationService.translateText('General', currentLanguage),
          translationService.translateText('Failed to load products. Please check your connection and try again.', currentLanguage),
          translationService.translateText('Name', currentLanguage),
          translationService.translateText('All', currentLanguage),
          translationService.translateText('Set Price', currentLanguage)
        ]);

        setTranslations({
          quickAddProducts: results[0].translatedText,
          searchPlaceholder: results[1].translatedText,
          filtersSort: results[2].translatedText,
          category: results[3].translatedText,
          subcategory: results[4].translatedText,
          brand: results[5].translatedText,
          sortBy: results[6].translatedText,
          clearAllFilters: results[7].translatedText,
          image: results[8].translatedText,
          product: results[9].translatedText,
          price: results[10].translatedText,
          moq: results[11].translatedText,
          action: results[12].translatedText,
          loadingProducts: results[13].translatedText,
          select: results[14].translatedText,
          selected: results[15].translatedText,
          cancel: results[16].translatedText,
          addSelectedProducts: results[17].translatedText,
          noProductsSelected: results[18].translatedText,
          pleaseSelectProducts: results[19].translatedText,
          success: results[20].translatedText,
          productsAddedSuccessfully: results[21].translatedText,
          error: results[22].translatedText,
          failedToAddProducts: results[23].translatedText,
          ok: results[24].translatedText,
          productName: results[25].translatedText,
          unknownBrand: results[26].translatedText,
          uncategorized: results[27].translatedText,
          general: results[28].translatedText,
          failedToLoadProducts: results[29].translatedText,
          name: results[30].translatedText,
          all: results[31].translatedText,
          setPrice: results[32].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Available units for selection
  const availableUnits = ['pieces', 'kg', 'grams', 'liters', 'ml', 'boxes', 'packets', 'bottles', 'cans', 'meters', 'cm', 'dozen', 'carton', 'units'];

  // Function to fetch unique categories from master_products
  const fetchCategories = useCallback(async () => {
    try {
      console.log('fetchCategories: Starting...');
      const { data, error } = await directFetch<{ category: string }>('master_products', {
        select: 'category',
        order: { column: 'category', ascending: true }
      });

      if (error) throw error;

      const uniqueCategories = Array.from(new Set(data?.map(item => item.category).filter(Boolean) || []));
      setAvailableCategories([translations.all, ...uniqueCategories]);
      console.log('fetchCategories: Found', uniqueCategories.length, 'categories');
    } catch (error: any) {
      console.error('fetchCategories: Error:', error?.message);
    }
  }, [translations.all]);

  // Function to fetch unique subcategories from master_products
  const fetchSubcategories = useCallback(async (category?: string) => {
    try {
      console.log('fetchSubcategories: Starting...');
      const eqFilters: Record<string, any> = {};
      if (category && category !== 'All') {
        eqFilters.category = category;
      }

      const { data, error } = await directFetch<{ subcategory: string }>('master_products', {
        select: 'subcategory',
        eq: eqFilters,
        order: { column: 'subcategory', ascending: true }
      });

      if (error) throw error;

      const uniqueSubcategories = Array.from(new Set(data?.map(item => item.subcategory).filter(Boolean) || []));
      setAvailableSubcategories(['All', ...uniqueSubcategories]);
      console.log('fetchSubcategories: Found', uniqueSubcategories.length, 'subcategories');
    } catch (error: any) {
      console.error('fetchSubcategories: Error:', error?.message);
    }
  }, []);

  // Function to fetch unique brands from master_products
  const fetchBrands = useCallback(async () => {
    try {
      console.log('fetchBrands: Starting...');
      const { data, error } = await directFetch<{ brand: string }>('master_products', {
        select: 'brand',
        order: { column: 'brand', ascending: true }
      });

      if (error) throw error;

      const uniqueBrands = Array.from(new Set(data?.map(item => item.brand).filter(Boolean) || []));
      setAvailableBrands(['All', ...uniqueBrands]);
      console.log('fetchBrands: Found', uniqueBrands.length, 'brands');
    } catch (error: any) {
      console.error('fetchBrands: Error:', error?.message);
    }
  }, []);

  // Function to get total count of products for pagination
  const getTotalProductsCount = useCallback(async (searchTerm: string = '') => {
    try {
      console.log('getTotalProductsCount: Starting...');

      // Get access token
      const SUPABASE_AUTH_KEY = supabaseAuthStorageKey;
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('getTotalProductsCount: No access token');
        return { totalCount: 0, pages: 0 };
      }

      // Build URL with filters
      let url = `${supabaseConfig.url}/rest/v1/master_products?select=id`;

      if (searchTerm.trim()) {
        url += `&or=(name.ilike.*${encodeURIComponent(searchTerm)}*,brand.ilike.*${encodeURIComponent(searchTerm)}*,category.ilike.*${encodeURIComponent(searchTerm)}*,subcategory.ilike.*${encodeURIComponent(searchTerm)}*)`;
      }

      if (selectedCategory && selectedCategory !== 'All') {
        url += `&category=eq.${encodeURIComponent(selectedCategory)}`;
      }

      if (selectedSubcategory && selectedSubcategory !== 'All') {
        url += `&subcategory=eq.${encodeURIComponent(selectedSubcategory)}`;
      }

      if (selectedBrand && selectedBrand !== 'All') {
        url += `&brand=eq.${encodeURIComponent(selectedBrand)}`;
      }

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'count=exact'
        }
      });

      // Get count from Content-Range header
      const contentRange = response.headers.get('content-range');
      let totalCount = 0;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          totalCount = parseInt(match[1], 10);
        }
      }

      const pages = Math.ceil(totalCount / ITEMS_PER_PAGE);
      console.log('getTotalProductsCount: Count =', totalCount, 'Pages =', pages);

      setTotalProductsCount(totalCount);
      setTotalPages(pages);

      return { totalCount, pages };
    } catch (error: any) {
      console.error('getTotalProductsCount: Error:', error?.message);
      return { totalCount: 0, pages: 0 };
    }
  }, [selectedCategory, selectedSubcategory, selectedBrand]);

  const fetchMasterProducts = useCallback(async (page: number = 1, searchTerm: string = '') => {
    try {
      setPageLoading(true);
      console.log('fetchMasterProducts: Starting with page', page, 'search:', searchTerm);

      // Get access token
      const SUPABASE_AUTH_KEY = supabaseAuthStorageKey;
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('fetchMasterProducts: No access token');
        setProducts([]);
        return;
      }

      // Calculate offset for the page (page is 1-based)
      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE - 1;

      // Build URL with query parameters
      const sortColumn = sortBy === 'name' ? 'name' : sortBy === 'brand' ? 'brand' : 'category';
      let url = `${supabaseConfig.url}/rest/v1/master_products?select=id,name,category,subcategory,brand,min_qty,image_url&order=${sortColumn}.${sortOrder}`;

      // Add filters
      if (searchTerm.trim()) {
        url += `&or=(name.ilike.*${encodeURIComponent(searchTerm)}*,brand.ilike.*${encodeURIComponent(searchTerm)}*,category.ilike.*${encodeURIComponent(searchTerm)}*,subcategory.ilike.*${encodeURIComponent(searchTerm)}*)`;
      }

      if (selectedCategory && selectedCategory !== 'All') {
        url += `&category=eq.${encodeURIComponent(selectedCategory)}`;
      }

      if (selectedSubcategory && selectedSubcategory !== 'All') {
        url += `&subcategory=eq.${encodeURIComponent(selectedSubcategory)}`;
      }

      if (selectedBrand && selectedBrand !== 'All') {
        url += `&brand=eq.${encodeURIComponent(selectedBrand)}`;
      }

      console.log('fetchMasterProducts: Using direct fetch API...');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Range': `${startIndex}-${endIndex}`
        }
      });

      console.log('fetchMasterProducts: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('fetchMasterProducts: Error:', errorText);
        throw new Error(errorText);
      }

      const fetchedProducts = await response.json();
      console.log('fetchMasterProducts: Got', fetchedProducts?.length, 'products');

      // Transform products with optimized mapping - preserve selection state from selectedProductsMap
      const transformedProducts: QuickAddProduct[] = (fetchedProducts || []).map((product: any) => {
        const existingSelection = selectedProductsMap.get(product.id);
        if (existingSelection) {
          // Preserve the selected product's data
          return existingSelection;
        }
        return {
          id: product.id,
          name: product.name || translations.productName,
          brand: product.brand || translations.unknownBrand,
          image_url: product.image_url,
          category: product.category || translations.uncategorized,
          subcategory: product.subcategory || translations.general,
          selected: false,
          price: '',
          minQty: product.min_qty?.toString() || '1',
          unit: 'pieces',
          stock: '0'
        };
      });

      setProducts(transformedProducts);
      setCurrentPage(page);

      // Get total count for pagination
      await getTotalProductsCount(searchTerm);

    } catch (error: any) {
      console.error('fetchMasterProducts: Error:', error?.message || error);
      Alert.alert(translations.error, translations.failedToLoadProducts);
    } finally {
      setPageLoading(false);
    }
  }, [selectedCategory, selectedSubcategory, selectedBrand, sortBy, sortOrder, getTotalProductsCount, selectedProductsMap, translations]);

  // Function to navigate to a specific page
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && !pageLoading) {
      fetchMasterProducts(page, searchQuery);
    }
  }, [currentPage, totalPages, pageLoading, fetchMasterProducts, searchQuery]);

  // Function to go to next page
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages && !pageLoading) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, pageLoading, goToPage]);

  // Function to go to previous page
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1 && !pageLoading) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, pageLoading, goToPage]);

  const handleProductSelect = useCallback((product: QuickAddProduct) => {
    setSelectedProduct(product);
    // Reset form data with product details
    setNewProductData({
      name: product.name,
      brand: product.brand,
      category: product.category,
      subcategory: product.subcategory,
      price: product.price || '',
      minQty: product.minQty || '1',
      unit: product.unit || 'pieces',
      stock: product.stock || '0',
      image: null,
      quantities: [{ value: '1', unit: 'pieces', selected: true, price: '' }]
    });

    setShowProductModal(true);
  }, []);

  const handleAddSelectedProducts = useCallback(async () => {
    const selectedProducts = products.filter(p => p.selected && p.price);
    if (selectedProducts.length === 0) {
      Alert.alert(translations.noProductsSelected, translations.pleaseSelectProducts);
      return;
    }

    setShowConfirmation(true);
  }, [products]);

  const handleAddProduct = useCallback(() => {
    if (!selectedProduct || !newProductData.price) return;

    const updatedProduct: QuickAddProduct = {
      ...selectedProduct,
      selected: true,
      price: newProductData.price,
      minQty: newProductData.minQty,
      stock: newProductData.stock,
      unit: newProductData.unit
    };

    // Update the product in the products list
    setProducts(prevProducts =>
      prevProducts.map(p =>
        p.id === selectedProduct.id ? updatedProduct : p
      )
    );

    // Also update the selectedProductsMap to persist selection across pagination
    setSelectedProductsMap(prevMap => {
      const newMap = new Map(prevMap);
      newMap.set(selectedProduct.id, updatedProduct);
      return newMap;
    });

    setShowProductModal(false);
    setSelectedProduct(null);

    // Reset form data
    setNewProductData({
      name: '',
      brand: '',
      category: '',
      subcategory: '',
      price: '',
      minQty: '1',
      unit: 'pieces',
      stock: '0',
      image: null,
      quantities: [{ value: '1', unit: 'pieces', selected: true, price: '' }]
    });
  }, [selectedProduct, newProductData]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearFilters = () => {
    setSelectedCategory('All');
    setSelectedSubcategory('All');
    setSelectedBrand('All');
    setSearchQuery('');

    // Reset pagination and fetch all products
    setCurrentPage(1);
    setProducts([]);
    fetchMasterProducts(1, '');
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('All'); // Reset subcategory when category changes
    setCurrentPage(1);
    fetchSubcategories(category); // Fetch subcategories for the selected category
  };

  // Handle subcategory change
  const handleSubcategoryChange = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setCurrentPage(1);
  };

  // Handle brand change
  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    setCurrentPage(1);
  };

  // Handle sort change
  const handleSortChange = (newSortBy: 'name' | 'brand' | 'category') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Since filtering is now done server-side, just return products
  const getFilteredProducts = useMemo(() => {
    return products;
  }, [products]);

  // Effect to handle search with debouncing
  useEffect(() => {
    const query = searchQuery.trim();

    // Reset pagination and fetch new data with search
    setCurrentPage(1);
    setProducts([]);

    // Debounce the actual search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      fetchMasterProducts(1, query);
    }, 150); // Reduced debounce time for faster response

    // Add to search history if it's a meaningful search
    if (query && query.length > 2) {
      setSearchHistory(prev => [query, ...prev.filter(item => item !== query)].slice(0, 5));
    }

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // Removed fetchMasterProducts dependency

  // Memoized categories, subcategories, and brands for better performance
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ['All', ...uniqueCategories.sort()];
  }, [products]);

  const subcategories = useMemo(() => {
    const filtered = selectedCategory === 'All'
      ? products
      : products.filter(p => p.category === selectedCategory);
    const uniqueSubcategories = Array.from(new Set(filtered.map(p => p.subcategory).filter(Boolean)));
    return ['All', ...uniqueSubcategories.sort()];
  }, [products, selectedCategory]);

  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));
    return ['All', ...uniqueBrands.sort()];
  }, [products]);

  // Removed renderPageNumbers function as requested

  // Render pagination controls at bottom
  const renderPaginationControls = useCallback(() => {
    if (totalPages <= 1) return null;

    // Generate page numbers to display
    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;

      if (totalPages <= maxVisiblePages) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page, current page range, and last page
        if (currentPage <= 3) {
          // Show first 4 pages + last page
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          if (totalPages > 5) pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          // Show first page + last 4 pages
          pages.push(1);
          if (totalPages > 5) pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          // Show first page + current range + last page
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      return pages;
    };

    return (
      <View style={styles.paginationContainer}>
        <Button
          mode="outlined"
          onPress={goToPreviousPage}
          disabled={currentPage === 1 || pageLoading}
          style={styles.paginationNavButton}
          labelStyle={styles.paginationNavButtonText}
        >
          ‹
        </Button>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pageNumbersContainer}
          contentContainerStyle={styles.pageNumbersContent}
        >
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <Text key={`ellipsis-${index}`} style={styles.pageEllipsis}>
                  ...
                </Text>
              );
            }

            const isCurrentPage = page === currentPage;
            return (
              <TouchableOpacity
                key={page}
                onPress={() => goToPage(page as number)}
                disabled={pageLoading}
                style={[
                  styles.pageNumberButton,
                  isCurrentPage && styles.pageNumberButtonActive
                ]}
              >
                <Text style={[
                  styles.pageNumberText,
                  isCurrentPage && styles.pageNumberTextActive
                ]}>
                  {page}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Button
          mode="outlined"
          onPress={goToNextPage}
          disabled={currentPage === totalPages || pageLoading}
          style={styles.paginationNavButton}
          labelStyle={styles.paginationNavButtonText}
        >
          ›
        </Button>
      </View>
    );
  }, [currentPage, totalPages, totalProductsCount, pageLoading, goToPreviousPage, goToNextPage, goToPage]);

  useEffect(() => {
    setLoading(true);
    fetchMasterProducts(1).finally(() => setLoading(false));
    fetchCategories();
    fetchSubcategories();
    fetchBrands();
  }, []); // Removed fetchMasterProducts dependency to prevent infinite loops

  // Effect to refetch data when filters change
  useEffect(() => {
    setCurrentPage(1);
    setProducts([]);
    fetchMasterProducts(1, searchQuery);
  }, [selectedCategory, selectedSubcategory, selectedBrand, sortBy, sortOrder]); // Removed fetchMasterProducts and searchQuery to prevent conflicts

  const renderProductItem = useCallback(({ item }: { item: QuickAddProduct }) => (
    <TouchableOpacity
      style={[
        styles.productCard,
        item.selected && styles.productCardSelected
      ]}
      onPress={() => handleProductSelect(item)}
      activeOpacity={0.9}
    >
      <View style={styles.cardMainRow}>
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/60' }}
          style={styles.cardImage}
        />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardName} numberOfLines={2}>{item?.name || translations.productName}</Text>
            {item.selected && <IconButton icon="check-circle" iconColor={THEME.secondary} size={20} style={{ margin: 0 }} />}
          </View>
          <Text style={styles.cardCategory}>{item.category} • {item.subcategory}</Text>
          <Text style={styles.cardBrand}>{item.brand}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerInfo}>
          <Text style={styles.infoLabel}>MOQ: <Text style={styles.infoValue}>{item.minQty}</Text></Text>
          {item.selected && item.price ? (
            <Text style={styles.infoLabel}> |  Price: <Text style={[styles.infoValue, { color: THEME.secondary }]}>₹{item.price}</Text></Text>
          ) : (
            <Text style={styles.infoLabel}> |  Set Price</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleProductSelect(item)}
          style={[
            styles.selectButton,
            item.selected && styles.selectButtonSelected
          ]}
        >
          <Text style={[
            styles.selectButtonText,
            item.selected && styles.selectButtonTextSelected
          ]}>
            {item.selected ? translations.selected : translations.select}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [handleProductSelect, translations]);

  // Function to add all selected products to inventory
  const addSelectedProductsToInventory = useCallback(async () => {
    if (!user?.id) return;

    // Get all selected products from the map (persists across pagination)
    const selectedProductsList = Array.from(selectedProductsMap.values()).filter(p => p.selected && p.price);
    if (selectedProductsList.length === 0) {
      Alert.alert(translations.noProductsSelected, translations.pleaseSelectProducts);
      return;
    }

    try {
      console.log('addSelectedProductsToInventory: Starting with', selectedProductsList.length, 'products');

      // Get access token for direct fetch
      const SUPABASE_AUTH_KEY = supabaseAuthStorageKey;
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        Alert.alert(translations.error, 'Not authenticated. Please login again.');
        return;
      }

      // Prepare products data
      const productsToInsert = selectedProductsList.map(p => ({
        seller_id: user.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        subcategory: p.subcategory,
        price: parseFloat(p.price),
        min_quantity: parseInt(p.minQty) || 1,
        stock_available: parseInt(p.stock || '0') || 0,
        unit: p.unit,
        image_url: p.image_url,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log('addSelectedProductsToInventory: Using direct fetch API...');

      // Use direct fetch API instead of Supabase client
      const response = await fetch(
        `${supabaseConfig.url}/rest/v1/products`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(productsToInsert)
        }
      );

      console.log('addSelectedProductsToInventory: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('addSelectedProductsToInventory: Error:', errorText);
        throw new Error(errorText);
      }

      console.log('addSelectedProductsToInventory: Products added successfully');

      Alert.alert(
        translations.success,
        translations.productsAddedSuccessfully,
        [{ text: translations.ok }]
      );

      setShowConfirmation(false);

      // Reset selected products and clear the selection map
      setSelectedProductsMap(new Map());
      setProducts(prevProducts =>
        prevProducts.map(p => ({
          ...p,
          selected: false,
          price: '',
          stock: '0'
        }))
      );

    } catch (error: any) {
      console.error('addSelectedProductsToInventory: Error:', error?.message || error);
      Alert.alert(
        translations.error,
        translations.failedToAddProducts,
        [{ text: translations.ok }]
      );
    }
  }, [products, user?.id, selectedProductsMap, translations]);

  // Render confirmation modal
  const renderConfirmationModal = () => (
    <Portal>
      <Modal
        visible={showConfirmation}
        onDismiss={() => setShowConfirmation(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle}>Confirm Products</Text>
            <Text style={styles.modalSubtitle}>Review selected products before adding to inventory</Text>
          </View>
          <IconButton
            icon="close"
            size={28}
            onPress={() => setShowConfirmation(false)}
            style={styles.closeButton}
          />
        </View>

        <ScrollView style={styles.modalScroll}>
          {Array.from(selectedProductsMap.values()).filter(p => p.selected && p.price).map((product) => (
            <Card key={product.id} style={styles.confirmationCard}>
              <Card.Content>
                <View style={styles.confirmationRow}>
                  <Image
                    source={{ uri: product.image_url || 'https://via.placeholder.com/40' }}
                    style={styles.confirmationImage}
                  />
                  <View style={styles.confirmationDetails}>
                    <Text style={styles.confirmationName}>{product.name}</Text>
                    <Text style={styles.confirmationCategory}>{product.category} • {product.subcategory}</Text>
                    <Text style={styles.confirmationPrice}>Price: ₹{product.price} • MOQ: {product.minQty} • Stock: {product.stock}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>

        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setShowConfirmation(false)}
            style={styles.cancelButton}
            labelStyle={styles.buttonLabel}
          >
            {translations.cancel}
          </Button>
          <Button
            mode="contained"
            onPress={addSelectedProductsToInventory}
            style={styles.addButton}
            labelStyle={styles.buttonLabel}
            icon="plus"
          >
            {translations.addSelectedProducts}
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" backgroundColor="transparent" translucent />

      {/* Light Orange Gradient Background */}
      <LinearGradient
        colors={['#FFF3E0', '#FFFFFF', '#FFF8E1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Gradient Background for Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: THEME.primary, overflow: 'hidden' }}>
        <LinearGradient
          colors={[THEME.primary, '#003366']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle decorative circles */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => router.back()}
        >
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#FFFFFF"
            onPress={() => router.back()}
            style={{ margin: 0 }}
          />
        </TouchableOpacity>
        <Text variant="titleLarge" style={[styles.headerTitle, { color: '#FFFFFF' }]}>
          {translations.quickAddProducts}
        </Text>

        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={translations.searchPlaceholder}
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      {searchHistory.length > 0 && !searchQuery && (
        <View style={styles.searchHistory}>
          {searchHistory.map((query, index) => (
            <Chip
              key={index}
              onPress={() => setSearchQuery(query)}
              style={styles.historyChip}
            >
              {query}
            </Chip>
          ))}
        </View>
      )}

      {/* Filter and Sort Controls */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={styles.filterToggleButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterToggleText}>{translations.filtersSort}</Text>
          <Text style={styles.filterToggleIcon}>{showFilters ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showFilters && (
          <View style={styles.filtersContent}>
            {/* Category Filter */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{translations.category}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                {availableCategories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterChip,
                      selectedCategory === category && styles.filterChipSelected
                    ]}
                    onPress={() => handleCategoryChange(category)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === category && styles.filterChipTextSelected
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Subcategory Filter */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{translations.subcategory}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                {availableSubcategories.map((subcategory) => (
                  <TouchableOpacity
                    key={subcategory}
                    style={[
                      styles.filterChip,
                      selectedSubcategory === subcategory && styles.filterChipSelected
                    ]}
                    onPress={() => handleSubcategoryChange(subcategory)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedSubcategory === subcategory && styles.filterChipTextSelected
                    ]}>
                      {subcategory}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Brand Filter */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{translations.brand}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                {availableBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    style={[
                      styles.filterChip,
                      selectedBrand === brand && styles.filterChipSelected
                    ]}
                    onPress={() => handleBrandChange(brand)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedBrand === brand && styles.filterChipTextSelected
                    ]}>
                      {brand}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Sort Options */}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{translations.sortBy}</Text>
              <View style={styles.sortContainer}>
                {(['name', 'brand', 'category'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.sortChip,
                      sortBy === option && styles.sortChipSelected
                    ]}
                    onPress={() => handleSortChange(option)}
                  >
                    <Text style={[
                      styles.sortChipText,
                      sortBy === option && styles.sortChipTextSelected
                    ]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                      {sortBy === option && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Clear Filters Button */}
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>{translations.clearAllFilters}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.listContainer}>
        {/* Header Removed for cleaner Card Layout */}

        {loading || pageLoading ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>{translations.loadingProducts}</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={getFilteredProducts}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              style={styles.flatList}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={30}
              initialNumToRender={25}
              windowSize={15}
              getItemLayout={(data, index) => ({
                length: 70,
                offset: 70 * index,
                index,
              })}
            />
            {renderPaginationControls()}
          </>
        )}
      </View>

      {/* Add Selected Products Button */}
      <View style={styles.bottomButtonContainer} pointerEvents="box-none">
        <Button
          mode="contained"
          onPress={handleAddSelectedProducts}
          style={styles.addSelectedButton}
          labelStyle={styles.addSelectedButtonLabel}
          icon="plus"
          disabled={selectedProductsMap.size === 0 || !Array.from(selectedProductsMap.values()).some(p => p.selected && p.price)}
        >
          Add Selected Products
        </Button>
      </View>

      {/* Product Details Modal */}
      <Portal>
        <Modal
          visible={showProductModal}
          onDismiss={() => setShowProductModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedProduct && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>Add Product to Inventory</Text>
                  <Text style={styles.modalSubtitle}>Configure pricing and stock details</Text>
                </View>
                <IconButton
                  icon="close"
                  size={28}
                  onPress={() => setShowProductModal(false)}
                  style={styles.closeButton}
                />
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.productDetails}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>{selectedProduct.name}</Text>
                    <Text style={styles.productInfo}>{selectedProduct.brand} • {selectedProduct.category}</Text>
                    <View style={styles.productBadge}>
                      <Text style={styles.productBadgeText}>New Product</Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Set Your Price *</Text>
                    <View style={styles.inputWithUnit}>
                      <TextInput
                        mode="outlined"
                        value={newProductData.price}
                        onChangeText={(text) => setNewProductData(prev => ({ ...prev, price: text }))}
                        placeholder="0.00"
                        keyboardType="numeric"
                        style={[styles.input, styles.priceInput]}
                        left={<TextInput.Affix text="₹" />}
                      />
                    </View>
                    <Text style={styles.helperText}>Enter the selling price per unit</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Minimum Quantity</Text>
                    <View style={styles.inputWithUnit}>
                      <TextInput
                        mode="outlined"
                        value={newProductData.minQty}
                        onChangeText={(text) => setNewProductData(prev => ({ ...prev, minQty: text }))}
                        placeholder="1"
                        keyboardType="numeric"
                        style={styles.input}
                        right={<TextInput.Affix text={newProductData.unit} />}
                      />
                    </View>
                    <Text style={styles.helperText}>Minimum order quantity for customers</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Initial Stock</Text>
                    <View style={styles.inputWithUnit}>
                      <TextInput
                        mode="outlined"
                        value={newProductData.stock}
                        onChangeText={(text) => setNewProductData(prev => ({ ...prev, stock: text }))}
                        placeholder="0"
                        keyboardType="numeric"
                        style={styles.input}
                        right={<TextInput.Affix text={newProductData.unit} />}
                      />
                    </View>
                    <Text style={styles.helperText}>Current available stock quantity</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Unit</Text>
                    <SegmentedButtons
                      value={newProductData.unit}
                      onValueChange={(value) => setNewProductData(prev => ({ ...prev, unit: value }))}
                      buttons={availableUnits.slice(0, 4).map(unit => ({
                        value: unit,
                        label: unit.charAt(0).toUpperCase() + unit.slice(1)
                      }))}
                      style={styles.segmentedButtons}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScrollView}>
                      {availableUnits.slice(4).map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={[
                            styles.unitChip,
                            newProductData.unit === unit && styles.unitChipSelected
                          ]}
                          onPress={() => setNewProductData(prev => ({ ...prev, unit }))}
                        >
                          <Text style={[
                            styles.unitChipText,
                            newProductData.unit === unit && styles.unitChipTextSelected
                          ]}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={styles.helperText}>Select the unit of measurement</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowProductModal(false)}
                    style={styles.cancelButton}
                    labelStyle={styles.buttonLabel}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleAddProduct}
                    style={styles.addButton}
                    labelStyle={styles.buttonLabel}
                    disabled={!newProductData.price}
                    icon="plus"
                  >
                    Add to Inventory
                  </Button>
                </View>
              </ScrollView>
            </View>
          )}
        </Modal>
      </Portal>

      {/* Confirmation Modal */}
      {renderConfirmationModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.card,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 45, // Just above pagination
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
  },
  addSelectedButton: {
    borderRadius: 12,
    backgroundColor: THEME.secondary,
    elevation: 4,
    shadowColor: THEME.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addSelectedButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 6,
  },
  confirmationCard: {
    marginBottom: 12,
    elevation: 2,
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmationImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  confirmationDetails: {
    flex: 1,
  },
  confirmationName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  confirmationCategory: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  confirmationPrice: {
    fontSize: 12,
    color: THEME.textPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerRight: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 8,
    paddingHorizontal: 16,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: THEME.inputBackground,
    height: 40,
  },
  searchHistory: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  historyChip: {
    margin: 4,
  },
  listContainer: {
    flex: 1,
    backgroundColor: 'transparent', // Changed to transparent to remove white background
    paddingBottom: 80, // Reduced since pagination is absolute positioned
  },
  flatListHeader: {
    flexDirection: 'row',
    backgroundColor: THEME.inputBackground,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  flatList: {
    flex: 1,
  },
  productCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  productCardSelected: {
    borderColor: THEME.secondary,
    backgroundColor: THEME.secondary + '08',
  },
  cardMainRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: 15, // Slightly larger
    fontWeight: '700',
    color: THEME.textPrimary,
    flex: 1,
    marginRight: 8,
    lineHeight: 20,
  },
  cardCategory: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
  },
  cardBrand: {
    fontSize: 11,
    color: THEME.secondary,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.divider,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  infoValue: {
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  actionButton: {
    borderRadius: 20,
    borderColor: THEME.secondary,
    minWidth: 85,
    paddingHorizontal: 8,
  },
  actionButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  selectButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonSelected: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.secondary,
  },
  selectButtonTextSelected: {
    color: '#FFFFFF',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 0, // Align with bottom
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
    height: 38,
    zIndex: 100, // Ensure it's above other elements
  },
  paginationNavButton: {
    minWidth: 32,
    height: 28,
    borderRadius: 6,
  },
  paginationNavButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 0,
    marginHorizontal: 0,
  },
  pageNumbersContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  pageNumbersContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pageNumberButton: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  pageNumberButtonActive: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  pageNumberTextActive: {
    color: THEME.card,
    fontWeight: '600',
  },
  pageEllipsis: {
    fontSize: 12,
    color: THEME.textSecondary,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  // Filter and Sort Styles
  filterContainer: {
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  filterToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: THEME.inputBackground,
  },
  filterToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  filterToggleIcon: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  filtersContent: {
    padding: 12,
    backgroundColor: THEME.card,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterChip: {
    backgroundColor: THEME.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: THEME.divider,
  },
  filterChipSelected: {
    backgroundColor: THEME.secondary,
    borderColor: THEME.secondary,
  },
  filterChipText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: THEME.card,
  },
  sortContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortChip: {
    backgroundColor: THEME.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.divider,
  },
  sortChipSelected: {
    backgroundColor: THEME.success,
    borderColor: THEME.success,
  },
  sortChipText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  sortChipTextSelected: {
    color: THEME.card,
  },
  clearFiltersButton: {
    backgroundColor: THEME.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearFiltersText: {
    color: THEME.card,
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    maxHeight: '90%',
    minHeight: '70%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
    backgroundColor: THEME.inputBackground,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '400',
  },
  closeButton: {
    backgroundColor: THEME.inputBackground,
  },
  modalScroll: {
    flex: 1,
  },
  productDetails: {
    padding: 20,
  },
  productHeader: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: THEME.inputBackground,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: THEME.success,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  productInfo: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  productBadge: {
    backgroundColor: THEME.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  productBadgeText: {
    color: THEME.card,
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  inputWithUnit: {
    marginBottom: 4,
  },
  input: {
    backgroundColor: THEME.card,
    fontSize: 16,
  },
  priceInput: {
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#666',
    borderWidth: 1.5,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
  },
  segmentedButtons: {
    marginBottom: 12,
  },
  unitScrollView: {
    marginBottom: 8,
  },
  unitChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  unitChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  unitChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  unitChipTextSelected: {
    color: '#fff',
  },
});

