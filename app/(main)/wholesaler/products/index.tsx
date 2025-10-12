import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, Card, Button, IconButton, Searchbar, FAB, Menu, Divider, Portal, Modal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../../utils/android15EdgeToEdge';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_available: number;
  min_quantity: number;
  image_url: string;
  status: 'active' | 'inactive';
}

export default function ProductManagement() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [translations, setTranslations] = useState({
    products: 'Products',
    searchProducts: 'Search products',
    loading: 'Loading products...',
    noProducts: 'No Products Found',
    noSearchResults: 'No products match your search criteria',
    noProductsMessage: 'You haven\'t added any products yet. Tap the + button to add your first product.',
    edit: 'Edit',
    delete: 'Delete',
    price: 'Price',
    stock: 'Stock',
    status: 'Status',
    deleteProduct: 'Delete Product?',
    deleteConfirmation: 'Are you sure you want to delete this product? This action cannot be undone.',
    cancel: 'Cancel'
  });

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Products', currentLanguage),
          translationService.translateText('Search products', currentLanguage),
          translationService.translateText('Loading products...', currentLanguage),
          translationService.translateText('No Products Found', currentLanguage),
          translationService.translateText('No products match your search criteria', currentLanguage),
          translationService.translateText('You haven\'t added any products yet. Tap the + button to add your first product.', currentLanguage),
          translationService.translateText('Edit', currentLanguage),
          translationService.translateText('Delete', currentLanguage),
          translationService.translateText('Price', currentLanguage),
          translationService.translateText('Stock', currentLanguage),
          translationService.translateText('Status', currentLanguage),
          translationService.translateText('Delete Product?', currentLanguage),
          translationService.translateText('Are you sure you want to delete this product? This action cannot be undone.', currentLanguage),
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
          cancel: results[13].translatedText
        });
      } catch (error) {
        console.error('Translation loading error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      console.log('Fetching products for user:', user?.id);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false });

      console.log('Products query result:', { data: data?.length || 0, error });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Setting products:', data?.length || 0, 'items');
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== selectedProduct.id));
      setDeleteModalVisible(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const openMenu = (event: any, product: Product) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 125, y: pageY });
    setSelectedProduct(product);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
  };

  const updateProductStock = async (productId: string, newQuantity: number) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_available: newQuantity })
        .eq('id', productId);

      if (error) throw error;

      // Update local state to reflect the change
      setProducts(products.map(product => 
        product.id === productId 
          ? { ...product, stock_available: newQuantity } 
          : product
      ));
    } catch (error) {
      console.error('Error updating product stock:', error);
    }
  };

  const renderProduct = ({ item: product }: { item: Product }) => {
    // Ensure image URL is using HTTPS
    const imageUrl = product.image_url ? product.image_url.replace('http://', 'https://') : null;
    
    return (
      <Card style={styles.productCard}>
        <Card.Cover 
          source={imageUrl ? { uri: imageUrl } : require('../../../../assets/images/placeholder.png')} 
          style={styles.productImage} 
        />
        <Card.Content style={styles.cardContent}>
          <View style={styles.productHeader}>
            <View style={styles.productInfo}>
              <Text variant="titleSmall" style={styles.productName}>{product?.name || 'Product Name'}</Text>
              <Text variant="bodySmall" style={styles.category}>{product.category}</Text>
            </View>
            <IconButton
              icon="dots-vertical"
              size={20}
              style={styles.menuButton}
              onPress={(event) => openMenu(event, product)}
            />
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
                leadingIcon="pencil"
              />
              <Menu.Item 
                onPress={() => {
                  setMenuVisible(false);
                  setDeleteModalVisible(true);
                }}
                title={translations.delete}
                leadingIcon="delete"
                titleStyle={{ color: '#F44336' }}
              />
            </Menu>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text variant="labelSmall">{translations.price}</Text>
              <Text variant="titleSmall" style={styles.price}>₹{product.price}</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="labelSmall">{translations.stock}</Text>
              <View style={styles.stockContainer}>
                <IconButton
                  icon="minus"
                  size={14}
                  style={styles.stockButton}
                  onPress={() => updateProductStock(product.id, Math.max(0, product.stock_available - 1))}
                />
                <Text 
                  variant="titleSmall"
                  style={[
                    styles.stock,
                    product.stock_available <= product.min_quantity && styles.lowStock
                  ]}
                >
                  {product.stock_available}
                </Text>
                <IconButton
                  icon="plus"
                  size={14}
                  style={styles.stockButton}
                  onPress={() => updateProductStock(product.id, product.stock_available + 1)}
                />
              </View>
            </View>
            <View style={styles.stat}>
              <Text variant="labelSmall">{translations.status}</Text>
              <Text 
                variant="bodySmall"
                style={[
                  styles.status,
                  product.status === 'active' ? styles.active : styles.inactive
                ]}
              >
                {product.status}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.products}</Text>
        <View style={styles.headerRight} />
      </View>

      <Searchbar
        placeholder={translations.searchProducts}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>{translations.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          renderItem={renderProduct}
          keyExtractor={(item: Product) => item.id}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{translations.noProducts}</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? translations.noSearchResults
                  : translations.noProductsMessage
                }
              </Text>
            </View>
          }
        />
      )}

      <Portal>
        <Modal
          visible={deleteModalVisible}
          onDismiss={() => setDeleteModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleMedium">{translations.deleteProduct}</Text>
          <Text variant="bodyMedium" style={styles.modalText}>
            {translations.deleteConfirmation}
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setDeleteModalVisible(false)}
              style={styles.modalButton}
            >
              {translations.cancel}
            </Button>
            <Button
              mode="contained"
              onPress={handleDeleteProduct}
              style={styles.modalButton}
            >
              {translations.delete}
            </Button>
          </View>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/(main)/wholesaler/products/add')}
      />
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
    paddingTop: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRight: {
    width: 48,
  },
  searchBar: {
    margin: 16,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  list: {
    padding: 4,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  productCard: {
    marginBottom: 8,
    elevation: 2,
    width: '48.5%',
  },
  productImage: {
    height: 100,
  },
  cardContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productInfo: {
    flex: 1,
    marginRight: 4,
  },
  productName: {
    marginRight: 24,
    marginBottom: 2,
    lineHeight: 16,
  },
  category: {
    color: '#666',
    marginTop: 1,
    fontSize: 11,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stat: {
    alignItems: 'center',
  },
  price: {
    color: '#2196F3',
    fontSize: 13,
  },
  stock: {
    color: '#4CAF50',
    fontSize: 13,
  },
  lowStock: {
    color: '#f44336',
  },
  status: {
    textTransform: 'capitalize',
    fontSize: 11,
  },
  active: {
    color: '#4CAF50',
  },
  inactive: {
    color: '#666',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalText: {
    marginTop: 8,
    marginBottom: 16,
    opacity: 0.7,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    minWidth: 100,
  },
  menuContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 4,
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockButton: {
    padding: 2,
    margin: 0,
  },
  menuButton: {
    position: 'absolute',
    right: -8,
    top: -8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
});

