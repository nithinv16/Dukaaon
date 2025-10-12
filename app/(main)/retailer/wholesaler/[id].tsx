import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text, Card, Button, TextInput, Appbar, IconButton, Chip, Searchbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useCartStore } from '../../../../store/cart';
import CartIcon from '../../../../components/CartIcon';
import CartDistanceManager from '../../../../components/CartDistanceManager';
import * as Speech from 'expo-speech';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  min_quantity: number;
  unit: string;
  product_images?: {
    image_url: string;
  }[];
}

interface WholesalerDetails {
  user_id: string;
  business_name: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export default function WholesalerInventory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  const { currentLanguage } = useLanguage();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showDistanceManager, setShowDistanceManager] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [translations, setTranslations] = useState({
    searchProducts: 'Search products',
    all: 'All',
    productName: 'Product Name',
    min: 'Min',
    addToCart: 'ADD +',
    minimumQuantityRequired: 'Minimum Quantity Required',
    pleaseAddAtLeast: 'Please add at least',
    ok: 'OK',
    success: 'Success',
    itemAddedToCart: 'Item added to cart!',
    error: 'Error',
    failedToAddItem: 'Failed to add item to cart. Please try again.',
    failedToLoadProducts: 'Failed to load products'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translatedTexts = await Promise.all([
          translationService.translateText('Search products', currentLanguage),
        translationService.translateText('All', currentLanguage),
        translationService.translateText('Product Name', currentLanguage),
        translationService.translateText('Min', currentLanguage),
        translationService.translateText('ADD +', currentLanguage),
        translationService.translateText('Minimum Quantity Required', currentLanguage),
        translationService.translateText('Please add at least', currentLanguage),
        translationService.translateText('OK', currentLanguage),
        translationService.translateText('Success', currentLanguage),
        translationService.translateText('Item added to cart!', currentLanguage),
        translationService.translateText('Error', currentLanguage),
        translationService.translateText('Failed to add item to cart. Please try again.', currentLanguage),
        translationService.translateText('Failed to load products', currentLanguage)
        ]);

        setTranslations({
          searchProducts: translatedTexts[0].translatedText,
          all: translatedTexts[1].translatedText,
          productName: translatedTexts[2].translatedText,
          min: translatedTexts[3].translatedText,
          addToCart: translatedTexts[4].translatedText,
          minimumQuantityRequired: translatedTexts[5].translatedText,
          pleaseAddAtLeast: translatedTexts[6].translatedText,
          ok: translatedTexts[7].translatedText,
          success: translatedTexts[8].translatedText,
          itemAddedToCart: translatedTexts[9].translatedText,
          error: translatedTexts[10].translatedText,
          failedToAddItem: translatedTexts[11].translatedText,
          failedToLoadProducts: translatedTexts[12].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          image_url,
          category,
          min_quantity,
          unit,
          seller_id
        `)
        .eq('seller_id', id);

      if (error) throw error;

      setProducts(data || []);

      // Initialize quantities
      const initialQuantities: Record<string, number> = {};
      data?.forEach(product => {
        initialQuantities[product.id] = product.min_quantity;
      });
      setQuantities(initialQuantities);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert(translations.error, translations.failedToLoadProducts);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .eq('seller_id', id);

      if (error) throw error;
      
      // Get unique categories using Set
      const uniqueCategories = [...new Set(data.map(item => item.category))];
      setCategories([translations.all, ...uniqueCategories]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      const quantity = quantities[product.id] || 0;
      
      // Check minimum quantity
      if (quantity < product.min_quantity) {
        Alert.alert(
          translations.minimumQuantityRequired,
          `${translations.pleaseAddAtLeast} ${product.min_quantity} ${product.unit}`,
          [{ text: translations.ok }]
        );
        return;
      }

      const cartItem = {
        uniqueId: `${product.id}-${Date.now()}`,
        product_id: product.id,
        name: product.name,
        price: product.price.toString(),
        quantity: quantity,
        image_url: product.image_url,
        unit: product.unit,
        seller_id: id as string
      };

      await addToCart(cartItem);
      Alert.alert(translations.success, translations.itemAddedToCart);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      
      // Check if it's a distance validation error
      if (error.message && error.message.includes('Distance to')) {
        // Show distance constraint manager
        setDistanceError(error.message);
        setShowDistanceManager(true);
      } else {
        Alert.alert(translations.error, translations.failedToAddItem);
      }
    }
  };

  const getFilteredProducts = () => {
    return products
      .filter(product => 
        // Category filter
        (selectedCategory === translations.all || product.category === selectedCategory) &&
        // Search filter
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  const startVoiceSearch = async () => {
    try {
      setIsListening(true);
      
      // Just show a message for now
      await Speech.speak('Voice search is not available in this version', {
        language: 'en',
        pitch: 1,
        rate: 1,
      });

      Alert.alert(
        'Coming Soon',
        'Voice search will be available in a future update',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Voice search error:', error);
    } finally {
      setIsListening(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Products" />
        <CartIcon />
      </Appbar.Header>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={translations.searchProducts}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          right={() => (
            <IconButton
              icon={isListening ? "microphone" : "microphone-outline"}
              size={20}
              onPress={startVoiceSearch}
              loading={isListening}
            />
          )}
        />
      </View>

      <ScrollView horizontal style={styles.filterContainer} showsHorizontalScrollIndicator={false}>
        {categories.map((category) => (
          <Chip
            key={category}
            selected={selectedCategory === category}
            onPress={() => setSelectedCategory(category)}
            style={styles.filterChip}
          >
            {category}
          </Chip>
        ))}
      </ScrollView>

      <ScrollView>
        <View style={styles.grid}>
          {getFilteredProducts().map((product) => (
            <Card key={product.id} style={styles.productCard}>
              <View style={styles.imageContainer}>
                <Card.Cover 
                  source={{ 
                    uri: product.image_url 
                      ? product.image_url
                      : 'https://placehold.co/400.png'
                  }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              </View>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleSmall" style={styles.productName}>
                  {product?.name || translations.productName}
                </Text>
                <Text>₹{product.price}</Text>
                <Text variant="bodySmall">{translations.min}: {product.min_quantity}</Text>
                
                <View style={styles.quantityContainer}>
                  <IconButton 
                    icon="minus" 
                    size={12}
                    style={styles.iconButton}
                    onPress={() => {
                      if (quantities[product.id] > product.min_quantity) {
                        setQuantities({
                          ...quantities,
                          [product.id]: quantities[product.id] - 1
                        });
                      }
                    }}
                  />
                  <TextInput
                    value={quantities[product.id]?.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || product.min_quantity;
                      setQuantities({
                        ...quantities,
                        [product.id]: value
                      });
                    }}
                    keyboardType="number-pad"
                    style={styles.quantityInput}
                    mode="flat"
                    dense
                    contentStyle={{
                      height: 10,
                      textAlign: 'center',
                      paddingHorizontal: 0
                    }}
                  />
                  <IconButton 
                    icon="plus" 
                    size={12}
                    style={styles.iconButton}
                    onPress={() => {
                      setQuantities({
                        ...quantities,
                        [product.id]: quantities[product.id] + 1
                      });
                    }}
                  />
                </View>

                <Button 
                  mode="contained"
                  onPress={() => handleAddToCart(product)}
                  style={styles.addButton}
                  labelStyle={styles.addButtonLabel}
                >
                  {translations.addToCart}
                </Button>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Distance Manager Modal */}
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
    backgroundColor: '#fff',
  },
  header: {
    height: 40,
    minHeight: 40,
    paddingTop: 0,
    marginTop: -50,
    backgroundColor: '#fff',
    elevation: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between',
  },
  productCard: {
    width: '32%',
    marginBottom: 8,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 120,          // Increased from 120
    overflow: 'hidden',
    
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    margin: 0,            // Remove any margin
    padding: 0,           // Remove any padding
  },
  cardContent: {
    padding: 4,
  },
  productName: {
    fontSize: 12,
    lineHeight: 14,
    marginBottom: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  quantityInput: {
    width: 30,
    height: 20,
    marginHorizontal: 0,
    textAlign: 'center',
    fontSize: 10,
    padding: 0,
    minHeight: 20,
    paddingVertical: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    marginTop: 4,
    height: 24,
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  addButtonLabel: {
    marginRight: 12,
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: -0.3,
    marginVertical: 2,
    fontWeight: 'bold',
  },
  iconButton: {
    margin: 0,
    padding: 0,
    width: 16,
    height: 16,
  },
  filterContainer: {
    padding: 8,
    flexGrow: 0,
  },
  filterChip: {
    marginRight: 8,
    marginVertical: 4,
  },
  searchContainer: {
    padding: 8,
    backgroundColor: '#fff',
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    fontSize: 14,
  },
});