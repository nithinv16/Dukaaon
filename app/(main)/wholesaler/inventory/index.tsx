import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { Card, Searchbar, FAB, IconButton, Menu, Divider, Button, SegmentedButtons, Portal, Modal, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../../store/auth';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import ProductImage from '../../../../components/common/ProductImage';
import { supabase } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';

interface Product {
  id: string;
  name: string;
  category: string;
  stock_available: number;
  min_quantity: number;
  unit: string;
  status: 'active' | 'inactive';
  image_url: string;
}

type FilterStatus = 'all' | 'low' | 'out';

const PAGE_SIZE = 20;
const ITEM_HEIGHT = 180;

// Premium Wholesaler Theme
const THEME = {
  primary: '#001F3F',    // Navy Blue
  secondary: '#39CCCC',  // Teal
  accent: '#7FDBFF',     // Sky Blue
  background: 'transparent',
  surface: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  success: '#39CCCC',    // Teal
  warning: '#FF851B',    // Orange
  error: '#FF4136',
  border: '#E0E0E0',
};

// Memoized Product Card Component
const ProductCard = memo(({
  product,
  translations,
  onMenuPress
}: {
  product: Product;
  translations: any;
  onMenuPress: (product: Product) => void;
}) => {
  const getStockStatus = (p: Product) => {
    if (p.stock_available === 0) return { label: translations.outOfStock, color: THEME.error, bg: '#FFEAEA' };
    if (p.stock_available <= p.min_quantity) return { label: translations.lowStock, color: THEME.warning, bg: '#FFF4E5' };
    return { label: translations.inStock, color: THEME.success, bg: '#E0F2F1' };
  };

  const stockStatus = getStockStatus(product);

  return (
    <Card style={styles.productCard}>
      <Card.Content style={{ padding: 12 }}>
        <View style={styles.productHeader}>
          <ProductImage
            imageUrl={product.image_url}
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{product?.name || translations.productName}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          </View>
          <IconButton
            icon="dots-vertical"
            size={20}
            onPress={() => onMenuPress(product)}
            style={{ margin: 0 }}
          />
        </View>

        <Divider style={{ marginVertical: 12, backgroundColor: '#F0F0F0' }} />

        <View style={styles.stockInfo}>
          <View style={styles.stockDetails}>
            <Text style={styles.stockLabel}>{translations.currentStock}</Text>
            <Text style={styles.stockValue}>
              {product.stock_available} <Text style={{ fontSize: 12, color: THEME.textSecondary }}>{product.unit}</Text>
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: stockStatus.bg }]}>
            <Text style={[styles.statusText, { color: stockStatus.color }]}>
              {stockStatus.label}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

export default function InventoryManagement() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState('');

  const pageRef = useRef(0);
  const isLoadingRef = useRef(false);

  const [translations, setTranslations] = useState({
    inventory: 'Inventory',
    searchProducts: 'Search products',
    all: 'All',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    currentStock: 'Current Stock',
    status: 'Status',
    inStock: 'In Stock',
    adjustStock: 'Adjust Stock',
    editProduct: 'Edit Product',
    currentStockLabel: 'Current Stock:',
    minimum: 'Minimum:',
    enterQuantity: 'Enter quantity (+/-)',
    useHint: 'Use + or - to increase or decrease stock',
    cancel: 'Cancel',
    update: 'Update',
    productName: 'Product Name',
    noProducts: 'No products found',
    loadingMore: 'Loading more...'
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // CRITICAL: Don't fetch until we have a valid user ID
    if (!user?.id) {
      console.log('InventoryManagement: Waiting for user ID before fetching inventory');
      return;
    }

    console.log('InventoryManagement: Starting fetch with user ID:', user.id);
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchInventory(true);
  }, [debouncedSearch, filterStatus, user?.id]);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translatedTexts = await Promise.all([
          translationService.translateText('Inventory', currentLanguage),
          translationService.translateText('Search products', currentLanguage),
          translationService.translateText('All', currentLanguage),
          translationService.translateText('Low Stock', currentLanguage),
          translationService.translateText('Out of Stock', currentLanguage),
          translationService.translateText('Current Stock', currentLanguage),
          translationService.translateText('Status', currentLanguage),
          translationService.translateText('In Stock', currentLanguage),
          translationService.translateText('Adjust Stock', currentLanguage),
          translationService.translateText('Edit Product', currentLanguage),
          translationService.translateText('Current Stock:', currentLanguage),
          translationService.translateText('Minimum:', currentLanguage),
          translationService.translateText('Enter quantity (+/-)', currentLanguage),
          translationService.translateText('Use + or - to increase or decrease stock', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Update', currentLanguage),
          translationService.translateText('Product Name', currentLanguage)
        ]);
        setTranslations({
          inventory: translatedTexts[0].translatedText,
          searchProducts: translatedTexts[1].translatedText,
          all: translatedTexts[2].translatedText,
          lowStock: translatedTexts[3].translatedText,
          outOfStock: translatedTexts[4].translatedText,
          currentStock: translatedTexts[5].translatedText,
          status: translatedTexts[6].translatedText,
          inStock: translatedTexts[7].translatedText,
          adjustStock: translatedTexts[8].translatedText,
          editProduct: translatedTexts[9].translatedText,
          currentStockLabel: translatedTexts[10].translatedText,
          minimum: translatedTexts[11].translatedText,
          enterQuantity: translatedTexts[12].translatedText,
          useHint: translatedTexts[13].translatedText,
          cancel: translatedTexts[14].translatedText,
          update: translatedTexts[15].translatedText,
          productName: translatedTexts[16].translatedText,
          noProducts: 'No products found',
          loadingMore: 'Loading more...'
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };
    loadTranslations();
  }, [currentLanguage]);

  const fetchInventory = useCallback(async (isInitial = false) => {
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
      let query = supabase
        .from('products')
        .select('id, name, category, stock_available, min_quantity, unit, status, image_url', { count: 'exact' })
        .eq('seller_id', user?.id)
        .order('name')
        .range(offset, offset + PAGE_SIZE - 1);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%`);
      }

      if (filterStatus === 'low') {
        query = query.gt('stock_available', 0);
      } else if (filterStatus === 'out') {
        query = query.eq('stock_available', 0);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (filterStatus === 'low') {
        filteredData = filteredData.filter(p => p.stock_available <= p.min_quantity);
      }

      if (isInitial) {
        setProducts(filteredData);
      } else {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newProducts = filteredData.filter(p => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }

      setHasMore(filteredData.length === PAGE_SIZE);
      pageRef.current += 1;
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [user?.id, debouncedSearch, filterStatus]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchInventory(true);
  }, [fetchInventory]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchInventory(false);
    }
  }, [loadingMore, hasMore, loading, fetchInventory]);

  const updateStock = async () => {
    if (!selectedProduct || !stockAdjustment) return;
    const newQuantity = Number(selectedProduct.stock_available) + Number(stockAdjustment);
    if (newQuantity < 0) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          stock_available: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      setProducts(products.map(product =>
        product.id === selectedProduct.id
          ? { ...product, stock_available: newQuantity }
          : product
      ));
      setStockModalVisible(false);
      setSelectedProduct(null);
      setStockAdjustment('');
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const handleMenuPress = useCallback((product: Product) => {
    setSelectedProduct(product);
    setMenuVisible(true);
  }, []);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      translations={translations}
      onMenuPress={handleMenuPress}
    />
  ), [translations, handleMenuPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={THEME.secondary} />
        <Text style={styles.loadingText}>{translations.loadingMore}</Text>
      </View>
    );
  }, [loadingMore, translations.loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{translations.noProducts}</Text>
      </View>
    );
  }, [loading, translations.noProducts]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: Product) => item.id, []);

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
        <IconButton
          icon="arrow-left"
          iconColor="#fff"
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>{translations.inventory}</Text>
        <IconButton
          icon="plus"
          iconColor={THEME.secondary}
          containerColor="rgba(255,255,255,0.1)"
          onPress={() => router.push('/(main)/wholesaler/products/add')}
        />
      </View>

      <View style={styles.filters}>
        <Searchbar
          placeholder={translations.searchProducts}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={{ color: THEME.textPrimary }}
          iconColor={THEME.textSecondary}
        />

        <SegmentedButtons
          value={filterStatus}
          onValueChange={value => setFilterStatus(value as FilterStatus)}
          buttons={[
            { value: 'all', label: translations.all },
            { value: 'low', label: translations.lowStock },
            { value: 'out', label: translations.outOfStock },
          ]}
          theme={{ colors: { secondaryContainer: THEME.secondary + '20', onSecondaryContainer: THEME.secondary } }}
          style={{ marginTop: 8 }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.secondary} />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
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
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          getItemLayout={getItemLayout}
        />
      )}

      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={{ x: 0, y: 0 }}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setStockModalVisible(true);
            }}
            title={translations.adjustStock}
            leadingIcon="package-variant"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              router.push({
                pathname: '/(main)/wholesaler/products/edit',
                params: { id: selectedProduct?.id }
              });
            }}
            title={translations.editProduct}
            leadingIcon="pencil"
            titleStyle={{ color: THEME.secondary }}
          />
        </Menu>

        <Modal
          visible={stockModalVisible}
          onDismiss={() => setStockModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {translations.adjustStock}
          </Text>
          <View style={styles.stockDetailsModal}>
            <Text style={styles.stockLabel}>{translations.currentStockLabel}</Text>
            <Text style={[styles.currentStock, { color: THEME.primary }]}>
              {selectedProduct?.stock_available} {selectedProduct?.unit}
            </Text>
            <Text style={styles.minStock}>
              ({translations.minimum} {selectedProduct?.min_quantity} {selectedProduct?.unit})
            </Text>
          </View>
          <Searchbar
            placeholder={translations.enterQuantity}
            value={stockAdjustment}
            onChangeText={setStockAdjustment}
            keyboardType="number-pad"
            style={[styles.stockInput, { backgroundColor: '#F8F9FA' }]}
            elevation={0}
          />
          <Text style={styles.hint}>
            {translations.useHint}
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setStockModalVisible(false)}
              style={styles.modalButton}
              textColor={THEME.textSecondary}
            >
              {translations.cancel}
            </Button>
            <Button
              mode="contained"
              onPress={updateStock}
              style={styles.modalButton}
              buttonColor={THEME.secondary}
            >
              {translations.update}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  filters: {
    padding: 16,
    gap: 12,
  },
  searchBar: {
    elevation: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  list: {
    padding: 16,
    flexGrow: 1,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
    marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F4F7FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    color: '#8F9BBA',
    fontSize: 11,
    fontWeight: '600',
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockDetails: {
    alignItems: 'flex-start',
  },
  stockLabel: {
    fontSize: 11,
    color: '#8F9BBA',
    fontWeight: '500',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.primary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stockDetailsModal: {
    alignItems: 'center',
    marginBottom: 20,
  },
  currentStock: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
  },
  minStock: {
    color: '#8F9BBA',
    marginTop: 4,
    fontSize: 12,
  },
  stockInput: {
    marginBottom: 8,
    borderRadius: 12,
  },
  hint: {
    color: '#A3AED0',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 12,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: '#A3AED0',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#A3AED0',
    fontSize: 16,
    fontWeight: '500',
  },
});

