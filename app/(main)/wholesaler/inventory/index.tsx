import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
import { Card, Searchbar, FAB, IconButton, Menu, Divider, Button, SegmentedButtons, Portal, Modal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../../store/auth';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import ProductImage from '../../../../components/common/ProductImage';
import SupabaseService from '../../../../services/SupabaseService';
import { supabase } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';


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

export default function InventoryManagement() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState('');

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
    productName: 'Product Name'
  });

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
          inventory: results[0].translatedText,
          searchProducts: results[1].translatedText,
          all: results[2].translatedText,
          lowStock: results[3].translatedText,
          outOfStock: results[4].translatedText,
          currentStock: results[5].translatedText,
          status: results[6].translatedText,
          inStock: results[7].translatedText,
          adjustStock: results[8].translatedText,
          editProduct: results[9].translatedText,
          currentStockLabel: results[10].translatedText,
          minimum: results[11].translatedText,
          enterQuantity: results[12].translatedText,
          useHint: results[13].translatedText,
          cancel: results[14].translatedText,
          update: results[15].translatedText,
          productName: results[16].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, stock_available, min_quantity, unit, status, image_url')
        .eq('seller_id', user?.id)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

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

  const getFilteredProducts = () => {
    let filtered = products;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    switch (filterStatus) {
      case 'low':
        filtered = filtered.filter(product => 
          product.stock_available > 0 && product.stock_available <= product.min_quantity
        );
        break;
      case 'out':
        filtered = filtered.filter(product => product.stock_available === 0);
        break;
    }

    return filtered;
  };

  const getStockStatus = (product: Product) => {
    if (product.stock_available === 0) return { label: translations.outOfStock, color: '#f44336' };
    if (product.stock_available <= product.min_quantity) return { label: translations.lowStock, color: '#ff9800' };
    return { label: translations.inStock, color: '#4CAF50' };
  };

  const renderProduct = ({ item: product }: { item: Product }) => {
    const stockStatus = getStockStatus(product);

    return (
      <Card style={styles.productCard}>
        <Card.Content>
          <View style={styles.productHeader}>
            <ProductImage
              imageUrl={product.image_url}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productInfo}>
              <Text variant="titleMedium">{product?.name || translations.productName}</Text>
              <Text variant="bodySmall" style={styles.category}>
                {product.category}
              </Text>
            </View>
            <IconButton
              icon="dots-vertical"
              onPress={() => {
                setSelectedProduct(product);
                setMenuVisible(true);
              }}
            />
          </View>

          <View style={styles.stockInfo}>
            <View style={styles.stockDetails}>
              <Text variant="bodyMedium">{translations.currentStock}</Text>
              <Text variant="titleMedium">
                {product.stock_available} {product.unit}
              </Text>
            </View>
            <View style={styles.stockDetails}>
              <Text variant="bodyMedium">{translations.status}</Text>
              <Text style={{ color: stockStatus.color }}>
                {stockStatus.label}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.inventory}</Text>
        <IconButton 
          icon="plus"
          onPress={() => router.push('/(main)/wholesaler/products/add')}
        />
      </View>

      <View style={styles.filters}>
        <Searchbar
          placeholder={translations.searchProducts}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <SegmentedButtons
          value={filterStatus}
          onValueChange={value => setFilterStatus(value as FilterStatus)}
          buttons={[
            { value: 'all', label: translations.all },
            { value: 'low', label: translations.lowStock },
            { value: 'out', label: translations.outOfStock },
          ]}
        />
      </View>

      <FlatList
        data={getFilteredProducts()}
        renderItem={renderProduct}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      />

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
          />
        </Menu>

        <Modal
          visible={stockModalVisible}
          onDismiss={() => setStockModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {translations.adjustStock}
          </Text>
          <View style={styles.stockDetails}>
            <Text variant="bodyMedium">{translations.currentStockLabel}</Text>
            <Text variant="titleMedium" style={styles.currentStock}>
              {selectedProduct?.stock_available} {selectedProduct?.unit}
            </Text>
            <Text variant="bodySmall" style={styles.minStock}>
              ({translations.minimum} {selectedProduct?.min_quantity} {selectedProduct?.unit})
            </Text>
          </View>
          <Searchbar
            placeholder={translations.enterQuantity}
            value={stockAdjustment}
            onChangeText={setStockAdjustment}
            keyboardType="number-pad"
            style={styles.stockInput}
          />
          <Text variant="bodySmall" style={styles.hint}>
            {translations.useHint}
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setStockModalVisible(false)}
              style={styles.modalButton}
            >
              {translations.cancel}
            </Button>
            <Button
              mode="contained"
              onPress={updateStock}
              style={styles.modalButton}
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filters: {
    padding: 16,
    gap: 16,
  },
  searchBar: {
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  list: {
    padding: 16,
  },
  productCard: {
    marginBottom: 16,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  category: {
    color: '#666',
    marginTop: 4,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stockDetails: {
    alignItems: 'center',
    marginBottom: 16,
  },
  currentStock: {
    color: '#2196F3',
    marginTop: 4,
  },
  minStock: {
    color: '#666',
    marginTop: 4,
  },
  stockInput: {
    marginTop: 8,
    marginBottom: 8,
  },
  hint: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    minWidth: 100,
  },
});

