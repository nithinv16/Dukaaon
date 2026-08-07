import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Platform, Image, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Searchbar, FAB, Menu, Portal, Modal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { supabaseConfig } from '../../../../config/secrets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../../../store/auth';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../../utils/android15EdgeToEdge';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { VariantService, ProductWithVariants, processProductsForDisplay } from '../../../../services/products/VariantService';

// --- Wholesaler Premium Theme ---
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
  gradient: ['#001F3F', '#003366'],
};

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_available: number;
  min_quantity: number;
  image_url: string;
  status: 'active' | 'inactive';
  has_variants?: boolean;
  variant_display_type?: 'grouped' | 'separate';
  variants?: any[];
  default_variant_id?: string;
}

const PAGE_SIZE = 20;

// --- Stock Status Badge ---
const StockBadge = ({ stock, minStock }: { stock: number; minStock: number }) => {
  let color = THEME.success;
  let label = 'In Stock';
  let icon = 'check-circle';

  if (stock === 0) {
    color = THEME.error;
    label = 'Out of Stock';
    icon = 'close-circle';
  } else if (stock <= minStock) {
    color = THEME.warning;
    label = 'Low Stock';
    icon = 'alert-circle';
  }

  return (
    <View style={[styles.stockBadge, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={12} color={color} />
      <Text style={[styles.stockBadgeText, { color }]}>{label}</Text>
    </View>
  );
};

// --- Premium Product Card ---
const ProductCard = memo(({
  product,
  translations,
  onMenuPress,
  onUpdateStock
}: {
  product: Product;
  translations: any;
  onMenuPress: (event: any, product: Product) => void;
  onUpdateStock: (productId: string, newQuantity: number) => void;
}) => {
  const imageUrl = product.image_url ? product.image_url.replace('http://', 'https://') : null;
  const hasVariants = product.variants && product.variants.length > 0;

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={imageUrl ? { uri: imageUrl } : require('../../../../assets/images/placeholder.png')}
            style={styles.productImage}
            resizeMode="cover"
          />
          {/* Status Overlay */}
          <View style={[
            styles.statusOverlay,
            { backgroundColor: product.status === 'active' ? THEME.success + '20' : THEME.textSecondary + '20' }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: product.status === 'active' ? THEME.success : THEME.textSecondary }
            ]} />
          </View>
          {/* Variant Badge */}
          {hasVariants && (
            <View style={styles.variantBadge}>
              <Text style={styles.variantBadgeText}>{product.variants!.length} variants</Text>
            </View>
          )}
          {/* Menu Button */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={(event) => onMenuPress(event, product)}
          >
            <MaterialCommunityIcons name="dots-vertical" size={18} color={THEME.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={styles.cardContent}>
          <Text style={styles.productName} numberOfLines={2}>{product?.name || 'Product Name'}</Text>
          <Text style={styles.category}>{product.category}</Text>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>₹</Text>
            <Text style={styles.priceValue}>{product.price.toLocaleString()}</Text>
          </View>

          {/* Stock Control */}
          <View style={styles.stockSection}>
            <StockBadge stock={product.stock_available} minStock={product.min_quantity} />
            <View style={styles.stockControl}>
              <TouchableOpacity
                style={styles.stockBtn}
                onPress={() => onUpdateStock(product.id, Math.max(0, product.stock_available - 1))}
              >
                <MaterialCommunityIcons name="minus" size={14} color={THEME.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.stockCount}>{product.stock_available}</Text>
              <TouchableOpacity
                style={styles.stockBtn}
                onPress={() => onUpdateStock(product.id, product.stock_available + 1)}
              >
                <MaterialCommunityIcons name="plus" size={14} color={THEME.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Variants Display */}
          {hasVariants && (
            <View style={styles.variantsContainer}>
              {product.variants!.slice(0, 3).map((variant: any, index: number) => (
                <View key={variant.id || index} style={styles.variantChip}>
                  <Text style={styles.variantChipText}>
                    {variant.variant_value} - ₹{variant.price}
                  </Text>
                </View>
              ))}
              {product.variants!.length > 3 && (
                <Text style={styles.moreVariantsText}>+{product.variants!.length - 3} more</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

export default function ProductManagement() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Refs for pagination
  const pageRef = useRef(0);
  const isLoadingRef = useRef(false);

  const [translations, setTranslations] = useState({
    products: 'Products',
    searchProducts: 'Search products...',
    loading: 'Loading products...',
    noProducts: 'No Products Found',
    noSearchResults: 'No products match your search',
    noProductsMessage: 'Start by adding your first product',
    edit: 'Edit Product',
    delete: 'Delete',
    price: 'Price',
    stock: 'Stock',
    status: 'Status',
    deleteProduct: 'Delete Product?',
    deleteConfirmation: 'This action cannot be undone. Are you sure you want to delete this product?',
    cancel: 'Cancel',
    loadingMore: 'Loading more...',
    totalProducts: 'products'
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset and fetch when search changes
  useEffect(() => {
    console.log('ProductManagement: Starting fetch, user:', user?.id);

    // Reset pagination state before fetching
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    // Use a flag to ensure we fetch with the correct search value
    const fetchWithSearch = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setLoading(true);

      try {
        console.log('ProductManagement: Fetching products with direct fetch API...');

        // Get access token
        const SUPABASE_AUTH_KEY = `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;
        const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
        let accessToken = '';
        if (sessionStr) {
          const sessionData = JSON.parse(sessionStr);
          accessToken = sessionData?.access_token || '';
        }

        if (!accessToken) {
          console.warn('ProductManagement: No access token');
          setProducts([]);
          return;
        }

        // Build URL with query parameters
        // Updated to include variant fields and relation with explicit FK
        let url = `${supabaseConfig.url}/rest/v1/products?select=id,name,category,price,stock_available,min_quantity,image_url,status,has_variants,variant_display_type,variants:product_variants!product_variants_product_id_fkey(*)&seller_id=eq.${user?.id}&order=created_at.desc`;

        // Add search filter
        if (debouncedSearch) {
          url += `&or=(name.ilike.*${encodeURIComponent(debouncedSearch)}*,category.ilike.*${encodeURIComponent(debouncedSearch)}*)`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Range': `0-${PAGE_SIZE - 1}`,
            'Prefer': 'count=exact'
          }
        });

        console.log('ProductManagement: Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ProductManagement: Fetch error:', errorText);
          throw new Error(errorText);
        }

        const data = await response.json();

        // Get count from Content-Range header
        const contentRange = response.headers.get('content-range');
        let count = 0;
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)/);
          if (match) {
            count = parseInt(match[1], 10);
          }
        }

        console.log('ProductManagement: Fetched', data?.length || 0, 'products, total:', count);

        // Flatten products and variants into individual cards
        const flattenedProducts: Product[] = [];
        for (const product of (data || [])) {
          // Always add the main product
          flattenedProducts.push(product);

          // If product has variants, add each variant as a separate card
          if (product.variants && product.variants.length > 0) {
            for (const variant of product.variants) {
              flattenedProducts.push({
                id: `${product.id}-variant-${variant.id}`,
                name: `${product.name} (${variant.variant_value})`,
                category: product.category,
                price: variant.price,
                stock_available: variant.stock_quantity,
                min_quantity: product.min_quantity || 0,
                image_url: variant.image_url || product.image_url,
                status: variant.is_active ? 'active' : 'inactive',
                has_variants: false,
                variants: [],
                // Store variant info for reference
                _isVariant: true,
                _variantId: variant.id,
                _parentProductId: product.id,
                _variantType: variant.variant_type,
                _variantValue: variant.variant_value,
              } as any);
            }
          }
        }

        setProducts(flattenedProducts);
        setHasMore((data || []).length === PAGE_SIZE);
        // Use flattened count to include variants in the total
        setTotalCount(flattenedProducts.length);
        pageRef.current = 1; // Move to page 1 after initial fetch
      } catch (error: any) {
        console.error('ProductManagement: Error fetching products:', error?.message || error);
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    fetchWithSearch();
  }, [debouncedSearch, user?.id]);

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Products', currentLanguage),
          translationService.translateText('Search products...', currentLanguage),
          translationService.translateText('Loading products...', currentLanguage),
          translationService.translateText('No Products Found', currentLanguage),
          translationService.translateText('No products match your search', currentLanguage),
          translationService.translateText('Start by adding your first product', currentLanguage),
          translationService.translateText('Edit Product', currentLanguage),
          translationService.translateText('Delete', currentLanguage),
          translationService.translateText('Price', currentLanguage),
          translationService.translateText('Stock', currentLanguage),
          translationService.translateText('Status', currentLanguage),
          translationService.translateText('Delete Product?', currentLanguage),
          translationService.translateText('This action cannot be undone. Are you sure you want to delete this product?', currentLanguage),
          translationService.translateText('Cancel', currentLanguage)
        ]);

        setTranslations({
          products: results[0].translatedText,
          searchProducts: results[1].translatedText,
          loading: results[2].translatedText,
          noProducts: results[3].translatedText,
          noSearchResults: results[4].translatedText,
          noProductsMessage: results[5].translatedText,
          edit: results[6].translatedText,
          delete: results[7].translatedText,
          price: results[8].translatedText,
          stock: results[9].translatedText,
          status: results[10].translatedText,
          deleteProduct: results[11].translatedText,
          deleteConfirmation: results[12].translatedText,
          cancel: results[13].translatedText,
          loadingMore: 'Loading more...',
          totalProducts: 'products'
        });
      } catch (error) {
        console.error('Translation loading error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchProducts = useCallback(async (isInitial = false) => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;

    if (isInitial) {
      setLoading(true);
      pageRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = pageRef.current * PAGE_SIZE;

      // Build query with server-side filtering
      // Updated to include variant fields and relation with explicit FK
      let query = supabase
        .from('products')
        .select('id, name, category, price, stock_available, min_quantity, image_url, status, has_variants, variant_display_type, variants:product_variants!product_variants_product_id_fkey(*)', { count: 'exact' })
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      // Apply search filter server-side
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const fetchedData = data || [];

      // Flatten products and variants into individual cards
      const flattenedProducts: Product[] = [];
      for (const product of fetchedData) {
        // Always add the main product
        flattenedProducts.push(product as Product);

        // If product has variants, add each variant as a separate card
        if ((product as any).variants && (product as any).variants.length > 0) {
          for (const variant of (product as any).variants) {
            flattenedProducts.push({
              id: `${product.id}-variant-${variant.id}`,
              name: `${product.name} (${variant.variant_value})`,
              category: product.category,
              price: variant.price,
              stock_available: variant.stock_quantity,
              min_quantity: product.min_quantity || 0,
              image_url: variant.image_url || product.image_url,
              status: variant.is_active ? 'active' : 'inactive',
              has_variants: false,
              variants: [],
              // Store variant info for reference
              _isVariant: true,
              _variantId: variant.id,
              _parentProductId: product.id,
              _variantType: variant.variant_type,
              _variantValue: variant.variant_value,
            } as any);
          }
        }
      }

      if (isInitial) {
        setProducts(flattenedProducts);
      } else {
        // Deduplicate when appending to prevent duplicate key errors
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = flattenedProducts.filter(p => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }

      // Check if there are more products to load
      setHasMore(fetchedData.length === PAGE_SIZE);

      // Use flattened count to include variants in the total
      if (isInitial) {
        setTotalCount(flattenedProducts.length);
      } else {
        // For pagination, add to existing count
        setTotalCount(prev => prev + flattenedProducts.length);
      }

      pageRef.current += 1;
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [user?.id, debouncedSearch]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchProducts(true);
  }, [fetchProducts]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchProducts(false);
    }
  }, [loadingMore, hasMore, loading, fetchProducts]);

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      // Check if this is a variant (has _isVariant flag)
      const isVariant = (selectedProduct as any)._isVariant;
      const variantId = (selectedProduct as any)._variantId;
      const parentProductId = (selectedProduct as any)._parentProductId;

      console.log('Delete attempt:', {
        isVariant,
        variantId,
        parentProductId,
        productId: selectedProduct.id,
        userId: user?.id
      });

      if (isVariant && variantId) {
        // Delete from product_variants table
        console.log('Deleting variant:', variantId);
        const { data, error, count } = await supabase
          .from('product_variants')
          .delete()
          .eq('id', variantId)
          .select();

        console.log('Variant delete result:', { data, error, count });
        if (error) throw error;
      } else {
        // Delete from products table - include seller_id for RLS policy
        console.log('Deleting product:', selectedProduct.id, 'for seller:', user?.id);
        const { data, error, count } = await supabase
          .from('products')
          .delete()
          .eq('id', selectedProduct.id)
          .eq('seller_id', user?.id)
          .select();

        console.log('Product delete result:', { data, error, count });
        if (error) throw error;

        if (!data || data.length === 0) {
          console.warn('No rows were deleted - product may not exist or RLS policy blocked deletion');
        }
      }

      // Remove from local state - for variants, also remove the parent if it has no other variants
      setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
      setDeleteModalVisible(false);
      setSelectedProduct(null);
      console.log('Product deleted successfully from local state');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      // Show user-friendly error
      Alert.alert(
        'Delete Failed',
        error?.message || 'Failed to delete product. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const openMenu = useCallback((event: any, product: Product) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 125, y: pageY });
    setSelectedProduct(product);
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const updateProductStock = useCallback(async (productId: string, newQuantity: number) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_available: newQuantity })
        .eq('id', productId);

      if (error) throw error;

      // Update local state to reflect the change
      setProducts(prev => prev.map(product =>
        product.id === productId
          ? { ...product, stock_available: newQuantity }
          : product
      ));
    } catch (error) {
      console.error('Error updating product stock:', error);
    }
  }, []);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      translations={translations}
      onMenuPress={openMenu}
      onUpdateStock={updateProductStock}
    />
  ), [translations, openMenu, updateProductStock]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={THEME.secondary} />
        <Text style={styles.loadingMoreText}>{translations.loadingMore}</Text>
      </View>
    );
  }, [loadingMore, translations.loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <MaterialCommunityIcons name="package-variant" size={48} color={THEME.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>{translations.noProducts}</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? translations.noSearchResults
            : translations.noProductsMessage
          }
        </Text>
        {!searchQuery && (
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(main)/wholesaler/products/add')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Add Product</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loading, translations, searchQuery]);

  const keyExtractor = useCallback((item: Product) => item.id, []);

  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
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

      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>{translations.products}</Text>
          <Text style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>{totalCount} {translations.totalProducts}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={THEME.textSecondary} />
          <Searchbar
            placeholder={translations.searchProducts}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchInput}
            inputStyle={styles.searchInputText}
            placeholderTextColor={THEME.textSecondary}
            iconColor="transparent"
          />
        </View>
      </View>

      {/* Product List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.secondary} />
          <Text style={styles.loadingText}>{translations.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[THEME.secondary]}
              tintColor={THEME.secondary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* Menu Portal */}
      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={closeMenu}
          anchor={menuPosition}
          contentStyle={styles.menuContent}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              router.push(`/(main)/wholesaler/products/edit?id=${selectedProduct?.id}`);
            }}
            title={translations.edit}
            leadingIcon="pencil-outline"
            titleStyle={styles.menuItemTitle}
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setDeleteModalVisible(true);
            }}
            title={translations.delete}
            leadingIcon="delete-outline"
            titleStyle={[styles.menuItemTitle, { color: THEME.error }]}
          />
        </Menu>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={deleteModalVisible}
          onDismiss={() => setDeleteModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <View style={styles.modalIcon}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={THEME.error} />
          </View>
          <Text style={styles.modalTitle}>{translations.deleteProduct}</Text>
          <Text style={styles.modalText}>{translations.deleteConfirmation}</Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setDeleteModalVisible(false)}
            >
              <Text style={styles.modalButtonCancelText}>{translations.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonDelete}
              onPress={handleDeleteProduct}
            >
              <Text style={styles.modalButtonDeleteText}>{translations.delete}</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>

      {/* Premium FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(main)/wholesaler/products/add')}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },

  // Search Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderRadius: 16,
    paddingLeft: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  searchInputText: {
    fontSize: 14,
    color: THEME.textPrimary,
  },

  // List Styles
  list: {
    padding: 12,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },

  // Product Card Styles
  cardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    height: 120,
    backgroundColor: THEME.background,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.card + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
    lineHeight: 18,
    marginBottom: 2,
  },
  category: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 12,
    color: THEME.secondary,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.secondary,
    marginLeft: 2,
  },
  stockSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  stockControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.background,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stockBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockCount: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
    minWidth: 24,
    textAlign: 'center',
  },

  // FAB Styles
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 70,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: THEME.secondary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Menu Styles
  menuContent: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 8,
      },
    }),
  },
  menuItemTitle: {
    fontSize: 14,
    color: THEME.primary,
  },

  // Modal Styles
  modalContent: {
    backgroundColor: THEME.card,
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: THEME.background,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  modalButtonDelete: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: THEME.error,
    alignItems: 'center',
  },
  modalButtonDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    color: THEME.textSecondary,
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },

  // Variant Styles
  variantBadge: {
    position: 'absolute',
    top: 8,
    right: 36,
    backgroundColor: THEME.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  variantBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFF',
  },
  variantsContainer: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  variantChip: {
    backgroundColor: THEME.accent + '30',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.accent,
  },
  variantChipText: {
    fontSize: 9,
    fontWeight: '500',
    color: THEME.primary,
  },
  moreVariantsText: {
    fontSize: 9,
    fontWeight: '500',
    color: THEME.textSecondary,
    alignSelf: 'center',
  },
});
