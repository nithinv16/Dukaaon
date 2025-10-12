import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Image, Alert, FlatList, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { Text, DataTable, TextInput, Checkbox, Button, IconButton, Searchbar, Chip, SegmentedButtons, Modal, Portal, HelperText, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';


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
  const [loading, setLoading] = useState(true);
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
          clearFilters: results[7].translatedText,
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
          selectProductsMessage: results[19].translatedText,
          success: results[20].translatedText,
          productsAddedSuccess: results[21].translatedText,
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
      const { data, error } = await supabase
        .from('master_products')
        .select('category')
        .not('category', 'is', null)
        .order('category');
      
      if (error) throw error;
      
      const uniqueCategories = Array.from(new Set(data?.map(item => item.category).filter(Boolean) || []));
      setAvailableCategories([translations.all, ...uniqueCategories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  // Function to fetch unique subcategories from master_products
  const fetchSubcategories = useCallback(async (category?: string) => {
    try {
      let query = supabase
        .from('master_products')
        .select('subcategory')
        .not('subcategory', 'is', null)
        .order('subcategory');
      
      if (category && category !== 'All') {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const uniqueSubcategories = Array.from(new Set(data?.map(item => item.subcategory).filter(Boolean) || []));
      setAvailableSubcategories(['All', ...uniqueSubcategories]);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  }, []);

  // Function to fetch unique brands from master_products
  const fetchBrands = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('master_products')
        .select('brand')
        .not('brand', 'is', null)
        .order('brand');
      
      if (error) throw error;
      
      const uniqueBrands = Array.from(new Set(data?.map(item => item.brand).filter(Boolean) || []));
      setAvailableBrands(['All', ...uniqueBrands]);
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  }, []);

  // Function to get total count of products for pagination
  const getTotalProductsCount = useCallback(async (searchTerm: string = '') => {
    try {
      let query = supabase
        .from('master_products')
        .select('*', { count: 'exact', head: true });

      // Add search filter if search term exists
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,subcategory.ilike.%${searchTerm}%`);
      }

      // Apply category filter if exists
      if (selectedCategory && selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      // Apply subcategory filter if exists
      if (selectedSubcategory && selectedSubcategory !== 'All') {
        query = query.eq('subcategory', selectedSubcategory);
      }

      // Apply brand filter if exists
      if (selectedBrand && selectedBrand !== 'All') {
        query = query.eq('brand', selectedBrand);
      }

      const { count, error } = await query;

      if (error) throw error;

      const totalCount = count || 0;
      const pages = Math.ceil(totalCount / ITEMS_PER_PAGE);
      
      setTotalProductsCount(totalCount);
      setTotalPages(pages);
      
      return { totalCount, pages };
    } catch (error) {
      console.error('Error getting total products count:', error);
      return { totalCount: 0, pages: 0 };
    }
  }, [selectedCategory, selectedSubcategory, selectedBrand]);

  const fetchMasterProducts = useCallback(async (page: number = 1, searchTerm: string = '') => {
    try {
      setPageLoading(true);
      
      // Calculate offset for the page (page is 1-based)
      const startIndex = (page - 1) * ITEMS_PER_PAGE;
      
      // Build query with search functionality
      let query = supabase
        .from('master_products')
        .select(`
          id,
          name,
          category,
          subcategory,
          brand,
          min_qty,
          image_url
        `)
        .range(startIndex, startIndex + ITEMS_PER_PAGE - 1);

      // Apply sorting
      const sortColumn = sortBy === 'name' ? 'name' : sortBy === 'brand' ? 'brand' : 'category';
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Add search filter if search term exists
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,subcategory.ilike.%${searchTerm}%`);
      }

      // Apply category filter if exists
      if (selectedCategory && selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      // Apply subcategory filter if exists
      if (selectedSubcategory && selectedSubcategory !== 'All') {
        query = query.eq('subcategory', selectedSubcategory);
      }

      // Apply brand filter if exists
      if (selectedBrand && selectedBrand !== 'All') {
        query = query.eq('brand', selectedBrand);
      }

      const { data: fetchedProducts, error } = await query;

      if (error) {
        throw error;
      }

      // Transform products with optimized mapping
      const transformedProducts: QuickAddProduct[] = (fetchedProducts || []).map(product => ({
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
      }));

      setProducts(transformedProducts);
      setCurrentPage(page);
      
      // Get total count for pagination
      await getTotalProductsCount(searchTerm);
      
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert(translations.error, translations.failedToLoadProducts);
    } finally {
      setPageLoading(false);
    }
  }, [selectedCategory, selectedSubcategory, selectedBrand, getTotalProductsCount]);

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

    // Update the product in the products list
    setProducts(prevProducts => 
      prevProducts.map(p => 
        p.id === selectedProduct.id ? {
          ...p,
          selected: true,
          price: newProductData.price,
          minQty: newProductData.minQty,
          stock: newProductData.stock,
          unit: newProductData.unit
        } : p
      )
    );
    
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
    <View style={[styles.productItem, item.selected && styles.selectedProductItem]}>
      <View style={styles.productItemRow}>
        <View style={styles.imageColumn}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/35' }}
            style={styles.productIcon}
          />
        </View>
        
        <View style={styles.productColumn}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>{item?.name || translations.productName}</Text>
            <Text style={styles.categoryText}>{item.category} • {item.subcategory}</Text>
            <Text style={styles.brandText}>{item.brand}</Text>
          </View>
        </View>
        
        <View style={styles.priceColumn}>
          <Text style={styles.priceText}>{translations.setPrice}</Text>
        </View>
        
        <View style={styles.moqColumn}>
          <Text style={styles.moqText}>MOQ: {item.minQty}</Text>
        </View>
        
        <View style={styles.selectColumn}>
          <Button
            mode={item.selected ? "contained" : "outlined"}
            onPress={() => handleProductSelect(item)}
            style={styles.selectButton}
            labelStyle={styles.selectButtonText}
          >
            {translations.select}
          </Button>
        </View>
      </View>
    </View>
  ), [handleProductSelect]);

  // Function to add all selected products to inventory
  const addSelectedProductsToInventory = useCallback(async () => {
    if (!user?.id) return;
    
    const selectedProductsList = products.filter(p => p.selected && p.price);
    if (selectedProductsList.length === 0) {
      Alert.alert(translations.noProductsSelected, translations.pleaseSelectProducts);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .insert(selectedProductsList.map(p => ({
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
        })));

      if (error) throw error;

      Alert.alert(
        translations.success,
        translations.productsAddedSuccessfully,
        [{ text: translations.ok }]
      );
      
      setShowConfirmation(false);
      
      // Reset selected products
      setProducts(prevProducts => 
        prevProducts.map(p => ({
          ...p,
          selected: false,
          price: '',
          stock: '0'
        }))
      );
      
    } catch (error) {
      console.error('Error adding products:', error);
      Alert.alert(
        translations.error,
        translations.failedToAddProducts,
        [{ text: translations.ok }]
      );
    }
  }, [products, user?.id]);
  
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
          {products.filter(p => p.selected && p.price).map((product) => (
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
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>
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
        <View style={styles.flatListHeader}>
          <Text style={[styles.headerText, { flex: 0.12 }]}>{translations.image}</Text>
          <Text style={[styles.headerText, { flex: 0.35 }]}>{translations.product}</Text>
          <Text style={[styles.headerText, { flex: 0.18 }]}>{translations.price}</Text>
          <Text style={[styles.headerText, { flex: 0.15 }]}>{translations.moq}</Text>
          <Text style={[styles.headerText, { flex: 0.2 }]}>{translations.action}</Text>
        </View>

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
      <View style={styles.bottomButtonContainer}>
        <Button
          mode="contained"
          onPress={handleAddSelectedProducts}
          style={styles.addSelectedButton}
          labelStyle={styles.addSelectedButtonLabel}
          icon="plus"
          disabled={!products.some(p => p.selected && p.price)}
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
    backgroundColor: '#fff',
  },
  bottomButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  addSelectedButton: {
    height: 48,
    justifyContent: 'center',
  },
  addSelectedButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
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
    color: '#666',
    marginBottom: 2,
  },
  confirmationPrice: {
    fontSize: 12,
    color: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#fff',
  },
  flatListHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  flatList: {
    flex: 1,
  },
  productItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  productItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 45,
  },
  imageColumn: {
    flex: 0.12,
    justifyContent: 'center',
  },
  productColumn: {
    flex: 0.35,
    paddingVertical: 6,
  },
  priceColumn: {
    flex: 0.18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moqColumn: {
    flex: 0.15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectColumn: {
    flex: 0.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productIcon: {
    width: 35,
    height: 35,
    borderRadius: 4,
  },
  productInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
  brandText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  priceText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  moqText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  selectButton: {
     minWidth: 70,
     height: 30,
     paddingHorizontal: 0,
     paddingVertical: 0,
   },
   selectButtonText: {
     fontSize: 10,
     fontWeight: '600',
     paddingVertical: 0,
     paddingHorizontal: 0,
     marginVertical: 0,
     marginHorizontal: 0,
   },
  selectedProductItem: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: 50,
  },
  paginationNavButton: {
    minWidth: 36,
    height: 32,
    borderRadius: 6,
  },
  paginationNavButtonText: {
    fontSize: 18,
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
    minWidth: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  pageNumberButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  pageNumberTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  pageEllipsis: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  // Filter and Sort Styles
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  filterToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterToggleIcon: {
    fontSize: 14,
    color: '#666',
  },
  filtersContent: {
    padding: 12,
    backgroundColor: '#fff',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  sortContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sortChipSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  sortChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sortChipTextSelected: {
    color: '#fff',
  },
  clearFiltersButton: {
    backgroundColor: '#ff5722',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearFiltersText: {
    color: '#fff',
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
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  productInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  productBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  productBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWithUnit: {
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    fontSize: 16,
  },
  priceInput: {
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
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

