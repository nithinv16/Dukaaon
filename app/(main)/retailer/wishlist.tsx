import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, Image, Platform, Dimensions } from 'react-native';
import { Text, IconButton, ActivityIndicator, Surface } from 'react-native-paper';
import { useWishlistStore } from '../../../store/wishlist';
import { useCartStore } from '../../../store/cart';
import { useAuthStore } from '../../../store/auth';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslateDynamic } from '../../../utils/translationUtils';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useCartAnimation } from '../../../contexts/CartAnimationContext';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const SPACING = 12;
const CARD_WIDTH = (width - (SPACING * (COLUMN_COUNT + 1))) / COLUMN_COUNT;

// Premium Colors
const COLORS = {
  primary: '#FF7D00',
  secondary: '#1A1A1A',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#8E8E93',
  border: '#E5E5EA',
  danger: '#FF3B30',
  success: '#34C759',
};

export default function WishlistScreen() {
  const { items, removeFromWishlist, loadWishlist, loading } = useWishlistStore();
  const { addToCart } = useCartStore();
  const router = useRouter();
  const { translateArrayFields } = useTranslateDynamic();
  const { currentLanguage } = useLanguage();
  const { showToast } = useCartAnimation();
  const insets = useSafeAreaInsets();

  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [translatedItems, setTranslatedItems] = useState<any[]>([]);

  useEffect(() => {
    loadWishlist();
    // Initialize quantities
    const initialQuantities: { [key: string]: number } = {};
    items.forEach(item => {
      initialQuantities[item.id] = item.min_quantity || 1;
    });
    setQuantities(initialQuantities);
  }, []);

  // Update quantities and translate items when items change
  useEffect(() => {
    const updateItemsAndQuantities = async () => {
      if (items.length > 0) {
        try {
          const translated = await translateArrayFields(
            items,
            ['name']
          );
          setTranslatedItems(translated);
        } catch (error) {
          console.error('Error translating wishlist items:', error);
          setTranslatedItems(items);
        }
      } else {
        setTranslatedItems([]);
      }

      const updatedQuantities: { [key: string]: number } = { ...quantities };
      items.forEach(item => {
        if (!updatedQuantities[item.id]) {
          updatedQuantities[item.id] = item.min_quantity || 1;
        }
      });
      setQuantities(updatedQuantities);
    };

    updateItemsAndQuantities();
  }, [items, translateArrayFields, currentLanguage]);

  const handleRefresh = useCallback(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleQuantityChange = useCallback((id: string, value: number) => {
    const product = items.find(item => item.id === id);
    if (!product) return;

    const minQuantity = product.min_quantity || 1;
    const newValue = Math.max(minQuantity, value);

    setQuantities(prev => ({
      ...prev,
      [id]: newValue
    }));
  }, [items]);

  const increaseQuantity = useCallback((id: string) => {
    const current = quantities[id] || 1;
    handleQuantityChange(id, current + 1);
  }, [quantities, handleQuantityChange]);

  const decreaseQuantity = useCallback((id: string) => {
    const current = quantities[id] || 1;
    const product = items.find(item => item.id === id);
    const minQuantity = product?.min_quantity || 1;

    if (current > minQuantity) {
      handleQuantityChange(id, current - 1);
    }
  }, [quantities, items, handleQuantityChange]);

  const handleAddToCart = useCallback((product: any) => {
    try {
      if (!product || !product.id) return;

      const quantity = quantities[product.id] || product.min_quantity || 1;

      const cartItem = {
        uniqueId: '',
        product_id: product.id,
        name: product.name || 'Unknown Product',
        price: (product.price || 0).toString(),
        quantity: quantity,
        image_url: typeof product.image_url === 'string' ? product.image_url : '',
        unit: product.unit || 'pc',
        seller_id: product.seller_id || ''
      };

      addToCart(cartItem);
      showToast('Added to cart!', 'success');
    } catch (error) {
      console.error('Error in handleAddToCart:', error);
      showToast('Failed to add to cart', 'error');
    }
  }, [quantities, addToCart, showToast]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const quantity = quantities[item.id] || item.min_quantity || 1;

    return (
      <Surface style={styles.card} elevation={2}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
          <Pressable
            style={styles.deleteButton}
            onPress={() => removeFromWishlist(item.id)}
            android_ripple={{ color: 'rgba(255, 59, 48, 0.1)', borderless: true }}
          >
            <MaterialCommunityIcons name="heart" size={20} color={COLORS.danger} />
          </Pressable>
        </View>

        <View style={styles.cardContent}>
          <Text numberOfLines={1} style={styles.productName}>
            {item.name || 'Product Name'}
          </Text>

          {item.seller_name && (
            <Text numberOfLines={1} style={styles.sellerName}>
              {item.seller_name}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{Number(item.price).toFixed(0)}</Text>
            <Text style={styles.unit}>/{item.unit}</Text>
          </View>

          <View style={styles.controlsContainer}>
            <View style={styles.quantityWrapper}>
              <Pressable
                onPress={() => decreaseQuantity(item.id)}
                style={[styles.qtyBtn, quantity <= (item.min_quantity || 1) && styles.qtyBtnDisabled]}
                disabled={quantity <= (item.min_quantity || 1)}
              >
                <MaterialCommunityIcons name="minus" size={16} color={quantity <= (item.min_quantity || 1) ? COLORS.textLight : COLORS.secondary} />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                onPress={() => increaseQuantity(item.id)}
                style={styles.qtyBtn}
              >
                <MaterialCommunityIcons name="plus" size={16} color={COLORS.secondary} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={styles.addToCartBtn}
            onPress={() => handleAddToCart(item)}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
          >
            <Ionicons name="cart-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.addToCartText}>Add</Text>
          </Pressable>
        </View>
      </Surface>
    );
  }, [quantities, increaseQuantity, decreaseQuantity, removeFromWishlist, handleAddToCart]);

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={COLORS.secondary}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="refresh"
            size={22}
            iconColor={COLORS.secondary}
            onPress={handleRefresh}
            disabled={loading}
          />
          <View style={styles.badgeContainer}>
            <IconButton
              icon="cart-outline"
              size={24}
              iconColor={COLORS.primary}
              onPress={() => router.push('/(main)/cart')}
              style={{ margin: 0 }}
            />
          </View>
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="heart-outline" size={64} color={COLORS.textLight} />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>Explore products and save your favorites here for later.</Text>
          <Pressable
            style={styles.browseButton}
            onPress={() => router.push('/(main)/screens/categories')}
          >
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={translatedItems.length > 0 ? translatedItems : items}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 6,
    backgroundColor: COLORS.surface,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    zIndex: 10,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeContainer: {
    position: 'relative',
    marginRight: 8,
  },

  // List Styles
  listContent: {
    padding: SPACING,
    paddingTop: SPACING * 1.5,
    paddingBottom: 100, // Space for FAB or bottom tabs
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },

  // Card Styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: SPACING,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  imageContainer: {
    height: CARD_WIDTH * 0.75,
    width: '100%',
    backgroundColor: '#FAFAFA',
    position: 'relative',
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFF',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  cardContent: {
    padding: 10,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
    lineHeight: 16,
  },
  sellerName: {
    fontSize: 10,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  unit: {
    fontSize: 10,
    color: COLORS.textLight,
    marginLeft: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 2,
    flex: 1,
    justifyContent: 'space-between',
  },
  qtyBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#FFF',
    elevation: 1,
  },
  qtyBtnDisabled: {
    backgroundColor: '#F9F9F9',
    elevation: 0,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 8,
  },
  addToCartBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 2,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: -50, // Visual balance
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF0E0', // Very light orange
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  browseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});