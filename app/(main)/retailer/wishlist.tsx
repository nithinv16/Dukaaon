import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Text, Card, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { useWishlistStore } from '../../../store/wishlist';
import { useCartStore } from '../../../store/cart';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function WishlistScreen() {
  const { items, removeFromWishlist, loadWishlist, loading } = useWishlistStore();
  const { addToCart } = useCartStore();
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const [translations, setTranslations] = useState({
    myWishlist: 'My Wishlist',
    yourWishlistIsEmpty: 'Your wishlist is empty',
    browseProducts: 'Browse Products',
    productName: 'Product Name',
    min: 'Min',
    unknownProduct: 'Unknown Product'
  });

  useEffect(() => {
    console.log('WishlistScreen mounted, loading wishlist');
    loadWishlist();
    
    // Initialize quantities with min_quantity for each product
    const initialQuantities: {[key: string]: number} = {};
    items.forEach(item => {
      initialQuantities[item.id] = item.min_quantity || 1;
    });
    setQuantities(initialQuantities);
  }, []);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
       try {
         const translatedTexts = await Promise.all([
           translationService.translateText('My Wishlist', currentLanguage),
           translationService.translateText('Your wishlist is empty', currentLanguage),
           translationService.translateText('Browse Products', currentLanguage),
           translationService.translateText('Product Name', currentLanguage),
           translationService.translateText('Min', currentLanguage),
           translationService.translateText('Unknown Product', currentLanguage)
         ]);

         setTranslations({
           myWishlist: translatedTexts[0].translatedText,
           yourWishlistIsEmpty: translatedTexts[1].translatedText,
           browseProducts: translatedTexts[2].translatedText,
           productName: translatedTexts[3].translatedText,
           min: translatedTexts[4].translatedText,
           unknownProduct: translatedTexts[5].translatedText
         });
       } catch (error) {
         console.error('Translation error:', error);
       }
     };

    loadTranslations();
  }, [currentLanguage]);
  
  // Update quantities when items change
  useEffect(() => {
    const updatedQuantities: {[key: string]: number} = {...quantities};
    items.forEach(item => {
      if (!updatedQuantities[item.id]) {
        updatedQuantities[item.id] = item.min_quantity || 1;
      }
    });
    setQuantities(updatedQuantities);
  }, [items]);

  const handleRefresh = () => {
    console.log('Manually refreshing wishlist');
    loadWishlist();
  };

  const handleQuantityChange = (id: string, value: number) => {
    const product = items.find(item => item.id === id);
    if (!product) return;
    
    const minQuantity = product.min_quantity || 1;
    const newValue = Math.max(minQuantity, value);
    
    setQuantities({
      ...quantities,
      [id]: newValue
    });
  };

  const increaseQuantity = (id: string) => {
    const current = quantities[id] || 1;
    handleQuantityChange(id, current + 1);
  };

  const decreaseQuantity = (id: string) => {
    const current = quantities[id] || 1;
    const product = items.find(item => item.id === id);
    const minQuantity = product?.min_quantity || 1;
    
    if (current > minQuantity) {
      handleQuantityChange(id, current - 1);
    }
  };

  const handleAddToCart = (product: any) => {
    try {
      if (!product || !product.id) {
        console.error('Invalid product:', product);
        return;
      }

      const quantity = quantities[product.id] || product.min_quantity || 1;
      
      // Prepare cart item with all required fields and default values
      const cartItem = {
        uniqueId: '',
        product_id: product.id,
        name: product.name || translations.unknownProduct,
        price: (product.price || 0).toString(),
        quantity: quantity,
        image_url: typeof product.image_url === 'string' ? product.image_url : '',
        unit: product.unit || 'pc',
        seller_id: product.seller_id || ''
      };
      
      console.log('Adding to cart with complete data:', cartItem);
      addToCart(cartItem);
      
      // Use a non-blocking toast or snackbar instead of alert in a real app
      console.log('Product added to cart successfully');
    } catch (error) {
      console.error('Error in handleAddToCart:', error);
    }
  };

  console.log('Rendering wishlist with items:', items);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>{translations.myWishlist}</Text>
        <View style={styles.headerActions}>
          <IconButton 
            icon="cart-outline" 
            size={24}
            onPress={() => router.push('/(main)/cart')}
          />
          <IconButton 
            icon="refresh" 
            size={24}
            onPress={handleRefresh}
            disabled={loading}
          />
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <ScrollView>
          {items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{translations.yourWishlistIsEmpty}</Text>
              <Button 
                mode="contained" 
                onPress={() => router.push('/(main)/home')}
                style={styles.browseButton}
              >
                {translations.browseProducts}
              </Button>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map(product => (
                <Card key={product.id} style={styles.productCard}>
                  <View style={styles.cardInner}>
                    <Card.Cover 
                      source={{ uri: product.image_url }} 
                      style={styles.productImage}
                    />
                    <Card.Content style={styles.cardContent}>
                      <Text numberOfLines={2} style={styles.productName}>{product?.name || translations.productName}</Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.price}>₹{product.price}</Text>
                        <Text style={styles.minQuantity}>{translations.min}: {product.min_quantity} {product.unit}</Text>
                      </View>
                    </Card.Content>
                    
                    <View style={styles.quantityContainer}>
                      <IconButton
                        icon="minus"
                        size={16}
                        style={styles.quantityButton}
                        onPress={() => decreaseQuantity(product.id)}
                        disabled={(quantities[product.id] || product.min_quantity) <= product.min_quantity}
                      />
                      <TextInput
                        value={String(quantities[product.id] || product.min_quantity || 1)}
                        onChangeText={(text) => {
                          const value = parseInt(text);
                          if (!isNaN(value)) {
                            handleQuantityChange(product.id, value);
                          }
                        }}
                        keyboardType="numeric"
                        style={styles.quantityInput}
                      />
                      <IconButton
                        icon="plus"
                        size={16}
                        style={styles.quantityButton}
                        onPress={() => increaseQuantity(product.id)}
                      />
                    </View>
                    
                    <Card.Actions style={styles.actions}>
                      <IconButton 
                        icon="delete-outline" 
                        size={16}
                        style={styles.actionButton}
                        onPress={() => removeFromWishlist(product.id)}
                      />
                      <IconButton 
                        icon="cart-plus" 
                        size={16}
                        style={styles.actionButton}
                        onPress={() => handleAddToCart(product)}
                      />
                    </Card.Actions>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
    justifyContent: 'space-between',
  },
  productCard: {
    width: '32%',
    marginBottom: 8,
    elevation: 2,
  },
  cardInner: {
    overflow: 'hidden',
    height: 230,
    display: 'flex',
    flexDirection: 'column',
  },
  productImage: {
    height: 90,
    backgroundColor: '#f5f5f5',
  },
  cardContent: {
    padding: 6,
    flex: 1,
    justifyContent: 'space-between',
  },
  priceContainer: {
    marginTop: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 4,
  },
  quantityButton: {
    margin: 0,
    width: 20,
    height: 20,
  },
  quantityInput: {
    textAlign: 'center',
    width: 30,
    height: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 0,
    fontSize: 12,
  },
  actions: {
    padding: 0,
    margin: 0,
    justifyContent: 'space-around',
  },
  actionButton: {
    margin: 0,
  },
  productName: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
    height: 32,
    overflow: 'hidden',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  minQuantity: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseButton: {
    marginTop: 16,
  },
});