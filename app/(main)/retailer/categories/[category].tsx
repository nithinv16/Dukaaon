import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable, Image } from 'react-native';
import { Card, Text, Appbar, Chip, Button, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../services/supabase/supabase';
import { useCartStore } from '../../../../store/cart';
import CartIcon from '../../../../components/CartIcon';
import { useWishlistStore } from '../../../../store/wishlist';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  min_quantity: number;
  unit: string;
  seller_id: string;
  category: string;
  subcategory: string;
  profiles: {
    id: string;
    seller_details: {
      business_name: string;
      seller_type: 'wholesaler' | 'manufacturer';
    }[];
  };
  seller_details?: {
    business_name: string;
    seller_type: 'wholesaler' | 'manufacturer';
  };
}

export default function CategoryProducts() {
  const { category, subcategory } = useLocalSearchParams();
  const router = useRouter();
  const addToCart = useCartStore(state => state.addToCart);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wholesaler' | 'manufacturer'>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const { addToWishlist, removeFromWishlist, isInWishlist, loadWishlist } = useWishlistStore();
  
  // Direct text strings instead of translations
  const getTranslatedText = (key: string) => {
    const texts: Record<string, string> = {
      'All': 'All',
      'Wholesalers': 'Wholesalers', 
      'Manufacturers': 'Manufacturers',
      'No products found in this category': 'No products found in this category',
      'Product Name': 'Product Name',
      'Min': 'Min',
      'Seller': 'Seller',
      'Unknown': 'Unknown',
      'ADD +': 'ADD +',
      'Related Products': 'Related Products'
    };
    return texts[key] || key;
  };

  useEffect(() => {
    console.log('Fetching products with:', { category, subcategory });
    fetchProducts();
    loadWishlist();
  }, [category, subcategory]);

  const fetchProducts = async () => {
    try {
      // First fetch products
      let query = supabase
        .from('products')
        .select('*');

      if (subcategory) {
        query = query.eq('subcategory', subcategory);
      } else if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { data: productsData, error: productsError } = await query;
      if (productsError) throw productsError;

      if (!productsData?.length) {
        setProducts([]);
        return;
      }

      // Then fetch seller details
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_details')
        .select(`
          business_name,
          seller_type,
          user_id
        `)
        .in('user_id', productsData.map(p => p.seller_id));

      if (sellerError) throw sellerError;

      // Combine the data
      const transformedProducts = productsData.map(product => ({
        ...product,
        seller_details: sellerData?.find(s => s.user_id === product.seller_id) || {
          business_name: 'Unknown',
          seller_type: 'wholesaler'
        }
      }));

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    const quantity = quantities[product.id] || product.min_quantity;
    
    if (quantity < product.min_quantity) {
      alert(`Minimum quantity required is ${product.min_quantity} ${product.unit}`);
      return;
    }

    addToCart({
      uniqueId: product.id,
      product_id: product.id,
      name: product.name,
      price: product.price.toString(),
      quantity: quantity,
      image: product.image_url,
      seller_id: product.seller_id,
      unit: product.unit
    });
  };

  const handleQuantityChange = (productId: string, value: number | string, minQuantity: number) => {
    const newQty = typeof value === 'string' ? parseInt(value) || minQuantity : value;
    setQuantities(prev => ({
      ...prev,
      [productId]: newQty
    }));
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRelatedProducts = (product: Product) => {
    return products.filter(p => 
      (p.category === product.category || p.subcategory === product.subcategory) 
      && p.id !== product.id
    ).slice(0, 3);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  const headerTitle = subcategory || category;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} style={styles.backButton} />
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>
        <CartIcon />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip 
            selected={filter === 'all'} 
            onPress={() => setFilter('all')}
            style={styles.filterChip}
          >
            {getTranslatedText('All')}
          </Chip>
          <Chip 
            selected={filter === 'wholesaler'} 
            onPress={() => setFilter('wholesaler')}
            style={styles.filterChip}
          >
            {getTranslatedText('Wholesalers')}
          </Chip>
          <Chip 
            selected={filter === 'manufacturer'} 
            onPress={() => setFilter('manufacturer')}
            style={styles.filterChip}
          >
            {getTranslatedText('Manufacturers')}
          </Chip>
        </ScrollView>
      </View>

      <ScrollView>
        <View style={styles.grid}>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text>{getTranslatedText('No products found in this category')}</Text>
            </View>
          ) : (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                style={styles.productCard}
              >
                <View style={styles.wishlistButton}>
                  <IconButton
                    icon={isInWishlist(product.id) ? "heart" : "heart-outline"}
                    size={20}
                    onPress={() => {
                      isInWishlist(product.id) 
                        ? removeFromWishlist(product.id)
                        : addToWishlist(product);
                    }}
                    iconColor={isInWishlist(product.id) ? "#f44336" : "#666"}
                  />
                </View>
                <Card.Cover source={{ uri: product.image_url }} style={styles.productImage} />
                <Card.Content>
                  <Text variant="titleSmall">{product?.name || getTranslatedText('Product Name')}</Text>
                  <Text style={styles.price}>₹{product.price}</Text>
                  <Text variant="bodySmall" style={styles.minQuantity}>{getTranslatedText('Min')} {product.min_quantity}</Text>
                  <Text variant="bodySmall" style={styles.sellerName}>
                    {getTranslatedText('Seller')}: {product.seller_details?.business_name || getTranslatedText('Unknown')}
                  </Text>
                  
                  <View style={styles.quantityControl}>
                    <IconButton
                      icon="minus"
                      size={16}
                      mode="outlined"
                      onPress={() => handleQuantityChange(product.id, (quantities[product.id] || product.min_quantity) - 1, product.min_quantity)}
                      style={styles.quantityButton}
                    />
                    <TextInput
                      style={styles.quantityInput}
                      value={String(quantities[product.id] || product.min_quantity)}
                      onChangeText={(text) => handleQuantityChange(product.id, text, product.min_quantity)}
                      keyboardType="numeric"
                    />
                    <IconButton
                      icon="plus"
                      size={16}
                      mode="outlined"
                      onPress={() => handleQuantityChange(product.id, (quantities[product.id] || product.min_quantity) + 1, product.min_quantity)}
                      style={styles.quantityButton}
                    />
                  </View>

                  <Button 
                    mode="contained"
                    onPress={() => handleAddToCart(product)}
                    style={styles.addButton}
                    labelStyle={styles.addButtonLabel}
                  >
                    {getTranslatedText('ADD +')}
                  </Button>
                </Card.Content>

                <View style={styles.relatedProducts}>
                  <Text style={styles.relatedTitle}>{getTranslatedText('Related Products')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {getRelatedProducts(product).map(relatedProduct => (
                      <Pressable 
                        key={relatedProduct.id}
                        onPress={() => handleAddToCart(relatedProduct)}
                        style={styles.relatedItem}
                      >
                        <Image 
                          source={{ uri: relatedProduct.image_url }} 
                          style={styles.relatedImage}
                        />
                        <Text style={styles.relatedName} numberOfLines={1}>
                          {relatedProduct?.name || getTranslatedText('Product Name')}
                        </Text>
                        <Text style={styles.relatedPrice}>
                          ₹{relatedProduct.price}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
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
  filterContainer: {
    padding: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  grid: {
    padding: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  productCard: {
    width: '32%',
    elevation: 2,
  },
  productImage: {
    height: 80,
  },
  price: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
    marginVertical: 1,
  },
  sellerName: {
    fontSize: 10,
    marginBottom: 2,
    color: '#666',
  },
  addButton: {
    marginTop: 2,
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
    paddingVertical: 0,
  },
  addButtonLabel: {
    fontSize: 10,
    letterSpacing: 0,
    lineHeight: 10,
    textAlignVertical: 'center',
    marginVertical: 0,
  },
  emptyState: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginLeft: 4,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  quantityButton: {
    margin: 0,
    width: 16,
    height: 16,
  },
  quantityInput: {
    textAlign: 'center',
    width: 28,
    height: 20,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 0,
    fontSize: 10,
  },
  minQuantity: {
    fontSize: 10,
    marginBottom: 2,
    color: '#666',
  },
  searchContainer: {
    padding: 8,
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
  },
  wishlistButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
  },
  relatedProducts: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  relatedTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  relatedItem: {
    width: 80,
    marginRight: 8,
  },
  relatedImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  relatedName: {
    fontSize: 10,
    marginTop: 4,
  },
  relatedPrice: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2196F3',
  },
});