import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.45;

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category: string;
  brand?: string;
  seller_id?: string;
  seller_name?: string;
}

interface ProductCarouselProps {
  title?: string;
  filter?: 'trending' | 'new' | 'personalized' | 'category' | 'all';
  categoryId?: string;
  limit?: number;
  userId?: string;
}

export function ProductCarousel({
  title = 'Featured Products',
  filter = 'all',
  categoryId,
  limit = 10,
  userId,
  autoScroll = true, // Default to true based on user request
}: ProductCarouselProps & { autoScroll?: boolean }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [translatedTitle, setTranslatedTitle] = useState(title);

  // Auto-scroll refs
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollX = React.useRef(0);
  const isAutoScrolling = React.useRef(autoScroll);
  const scrollInterval = React.useRef<NodeJS.Timeout | null>(null);
  const contentWidth = React.useRef(0);

  // Filter out invalid products and create infinite loop data
  // We duplicate the data twice to ensure we always have content to scroll into
  // Only duplicate if we have enough items to scroll
  const displayProducts = React.useMemo(() => {
    if (!products.length) return [];
    if (!autoScroll || products.length < 3) return products;
    return [...products, ...products, ...products]; // Triple buffer for smoother infinite feel
  }, [products, autoScroll]);

  const startAutoScroll = () => {
    if (!autoScroll || !scrollRef.current || products.length < 3) return;

    if (scrollInterval.current) clearInterval(scrollInterval.current);

    scrollInterval.current = setInterval(() => {
      if (!contentWidth.current) return;

      // Move slowly (train effect)
      scrollX.current += 1.5; // Adjust speed here

      // The simplified infinite scroll logic:
      // Real width of one set of products
      const singleSetWidth = contentWidth.current / 3;

      // If we've scrolled past the first set, reset to 0 (seamlessly)
      // Since the second set is identical, the user won't notice the jump
      if (scrollX.current >= singleSetWidth) {
        scrollX.current = 0;
      }

      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: scrollX.current, animated: false });
      }
    }, 50); // 20fps for performance balance
  };

  const stopAutoScroll = () => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  };

  useEffect(() => {
    if (products.length > 0 && autoScroll) {
      // Small delay to allow layout
      setTimeout(startAutoScroll, 1000);
    }
    return () => stopAutoScroll();
  }, [products, autoScroll]);

  // Translate title (non-blocking, cache-first)
  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedTitle(title);
      return;
    }
    // Check cache first for instant display
    const cached = translationService.getCachedTranslationSync(title, currentLanguage);
    if (cached) {
      setTranslatedTitle(cached);
    }
    // Translate in background if not cached
    translationService.translateText(title, currentLanguage)
      .then(result => setTranslatedTitle(result.translatedText))
      .catch(() => { }); // Keep original on error
  }, [title, currentLanguage]);

  // Store original (English) products for re-translation when language changes
  const [originalProducts, setOriginalProducts] = React.useState<Product[]>([]);

  // Fetch products ONCE - do NOT depend on currentLanguage
  useEffect(() => {
    fetchProducts();
  }, [filter, categoryId, userId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let productsData: Product[] = [];

      if (filter === 'personalized' && userId) {
        // Get personalized recommendations
        productsData = await getPersonalizedProducts(userId);
        if (productsData.length === 0) {
          // Fallback to trending if no recommendations
          const { data } = await supabase
            .from('products')
            .select('id, name, price, image_url, category, brand, seller_id, created_at')
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .limit(limit);
          productsData = data || [];
        }
      } else {
        let query = supabase
          .from('products')
          .select('id, name, price, image_url, category, brand, seller_id, created_at')
          .eq('status', 'available');

        // Apply filters
        if (filter === 'trending' || filter === 'new') {
          query = query.order('created_at', { ascending: false });
        } else if (filter === 'category' && categoryId) {
          query = query.eq('category_id', categoryId);
        }

        query = query.limit(limit);
        const { data, error } = await query;

        if (error) {
          console.error('Error fetching products:', error);
          setProducts([]);
          setOriginalProducts([]);
          setLoading(false);
          return;
        }
        productsData = data || [];
      }

      // Store original products for re-translation
      setOriginalProducts(productsData);

      // Show products immediately (in English)
      setProducts(productsData);
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchProducts:', error);
      setProducts([]);
      setOriginalProducts([]);
      setLoading(false);
    }
  };

  // Translate products when language changes (uses already-fetched data)
  useEffect(() => {
    if (originalProducts.length === 0) return;

    if (currentLanguage === 'en') {
      // Reset to English
      setProducts(originalProducts);
      return;
    }

    let isMounted = true;

    const translateProductNames = async () => {
      try {
        const translatedProducts = await translateProducts(originalProducts);
        if (isMounted) {
          setProducts(translatedProducts);
        }
      } catch (error) {
        console.error('Error translating products:', error);
      }
    };

    translateProductNames();

    return () => {
      isMounted = false;
    };
  }, [currentLanguage, originalProducts]);

  const getPersonalizedProducts = async (userId: string): Promise<Product[]> => {
    try {
      // Get user's purchase history
      const { data: purchases, error: purchaseError } = await supabase
        .from('purchase_history')
        .select('product_id, count')
        .eq('retailer_id', userId)
        .order('count', { ascending: false })
        .limit(limit);

      if (purchaseError || !purchases || purchases.length === 0) {
        return [];
      }

      // Get product details for purchased items
      const productIds = purchases.map((p) => p.product_id);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('status', 'available');

      if (productsError || !products) {
        return [];
      }

      return products;
    } catch (error) {
      console.error('Error getting personalized products:', error);
      return [];
    }
  };

  // OPTIMIZATION: Use batch translation (single API call for all products)
  const translateProducts = async (products: any[]): Promise<Product[]> => {
    if (currentLanguage === 'en' || products.length === 0) {
      return products;
    }

    try {
      // Use batch translation for efficiency
      const names = products.map(p => p.name);
      const results = await translationService.translateBatch(names, currentLanguage);

      return products.map((product, i) => ({
        ...product,
        name: results[i]?.translatedText || product.name,
      }));
    } catch (error) {
      console.error('Error in translateProducts:', error);
      return products;
    }
  };

  const handleProductPress = (productId: string) => {
    router.push(`/(main)/screens/product/${productId}`);
  };

  // Show minimal skeleton while loading (title + small indicator)
  // This provides visual feedback without blocking the entire UI
  if (products.length === 0) {
    if (loading) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>
              {translatedTitle}
            </Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF7D00" />
          </View>
        </View>
      );
    }
    return null; // No products and not loading - hide completely
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          {translatedTitle}
        </Text>
        {products.length >= limit && (
          <TouchableOpacity
            onPress={() => router.push('/(main)/screens/categories')}
          >
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onContentSizeChange={(w) => {
          contentWidth.current = w;
        }}
        // Pause scrolling when user touches the list
        onTouchStart={stopAutoScroll}
        // Resume scrolling when user releases (optional, or just stop it)
        onTouchEnd={() => setTimeout(startAutoScroll, 2000)}
        onMomentumScrollEnd={() => setTimeout(startAutoScroll, 2000)}
      >
        {displayProducts.map((product, index) => (
          <TouchableOpacity
            key={`${product.id}-${index}`} // Unique key for duplicates
            onPress={() => handleProductPress(product.id)}
            activeOpacity={0.7}
          >
            <Card style={styles.card}>
              <Image
                source={{
                  uri:
                    product.image_url
                      ? product.image_url
                      : 'https://via.placeholder.com/200x200?text=No+Image',
                }}
                style={styles.productImage}
                resizeMode="cover"
              />
              <Card.Content style={styles.cardContent}>
                <Text
                  variant="bodyMedium"
                  numberOfLines={2}
                  style={styles.productName}
                >
                  {product.name}
                </Text>
                <Text variant="titleMedium" style={styles.productPrice}>
                  ₹{product.price.toFixed(2)}
                </Text>
                {product.brand && (
                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={styles.productBrand}
                  >
                    {product.brand}
                  </Text>
                )}
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    fontSize: 22,
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  seeAll: {
    color: '#FF7D00',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 20, // Space for shadow
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: 10, // Increased spacing
    elevation: 2, // Minimal floating effect
    borderRadius: 20, // Modern large radius
    backgroundColor: '#fff',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 8 }, // Deeper soft shadow
    shadowOpacity: 0.06,
    shadowRadius: 16,
    borderWidth: 0,
  },
  productImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardContent: {
    padding: 12,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  productName: {
    fontWeight: '600',
    marginBottom: 8,
    height: 40,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  productPrice: {
    color: '#FF7D00',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 4,
  },
  productBrand: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

