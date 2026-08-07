/**
 * ProductCard - Product card component with variant support
 * 
 * Implements Requirements 3.1, 3.3, 3.5:
 * - Display all variants within a single product card with a variant selector
 * - Update the displayed price, stock availability, and product image on variant selection
 * - Visually indicate unavailability with "Out of Stock" label
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import {
  ProductVariant,
  ProductWithVariants,
  getDefaultVariant,
  isVariantInStock,
  createVariantGroups,
} from '../../services/products/VariantService';
import VariantSelector from './VariantSelector';
import { WHOLESALER_COLORS } from '../../constants/colors';

interface ProductCardProps {
  /** Product data with optional variants */
  product: ProductWithVariants;
  /** Whether this is a wholesaler view */
  isWholesaler?: boolean;
  /** Callback when product is pressed */
  onPress?: (product: ProductWithVariants, selectedVariant?: ProductVariant) => void;
  /** Callback when add to cart is pressed */
  onAddToCart?: (product: ProductWithVariants, variant?: ProductVariant, quantity?: number) => void;
}

/**
 * ProductCard displays a product with optional variant selection
 */
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWholesaler = false,
  onPress,
  onAddToCart,
}) => {
  // Get default variant if product has variants
  const defaultVariant = useMemo(() => {
    if (product.has_variants && product.variants.length > 0) {
      return getDefaultVariant(product.variants);
    }
    return undefined;
  }, [product.has_variants, product.variants]);

  // Track selected variant
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    defaultVariant
  );

  // Calculate current display values based on selected variant
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayMrp = selectedVariant?.mrp ?? undefined;
  const displayStock = selectedVariant?.stock_quantity ?? product.stock_quantity;
  const displayImage = selectedVariant?.image_url ?? product.images?.[0];
  const inStock = selectedVariant 
    ? isVariantInStock(selectedVariant) 
    : product.stock_quantity > 0;

  // Create variant groups for display
  const variantGroups = useMemo(() => {
    if (!product.has_variants || product.variants.length === 0) {
      return [];
    }
    return product.variant_groups.length > 0 
      ? product.variant_groups 
      : createVariantGroups(product.variants);
  }, [product.has_variants, product.variants, product.variant_groups]);

  // Handle variant selection
  const handleVariantSelect = useCallback((variant: ProductVariant) => {
    setSelectedVariant(variant);
  }, []);

  // Handle card press
  const handlePress = useCallback(() => {
    onPress?.(product, selectedVariant);
  }, [onPress, product, selectedVariant]);

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    onAddToCart?.(product, selectedVariant, 1);
  }, [onAddToCart, product, selectedVariant]);

  // Format price display
  const formatPrice = (price: number) => `₹${price.toFixed(2)}`;

  // Check if we should show variant selector
  const showVariantSelector = product.has_variants && 
    product.variants.length > 0 && 
    variantGroups.length > 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isWholesaler ? styles.wholesalerCard : styles.categoryCard,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}${selectedVariant ? `, ${selectedVariant.variant_value}` : ''}, ${formatPrice(displayPrice)}`}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No Image</Text>
          </View>
        )}
        
        {/* Out of Stock Overlay */}
        {!inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        {/* Product Name */}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Selected Variant Label */}
        {selectedVariant && (
          <Text style={styles.variantLabel}>
            {selectedVariant.variant_value}
          </Text>
        )}

        {/* Price Section */}
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice(displayPrice)}</Text>
          {displayMrp && displayMrp > displayPrice && (
            <Text style={styles.mrp}>{formatPrice(displayMrp)}</Text>
          )}
        </View>

        {/* Stock Info */}
        <Text style={[styles.stockInfo, !inStock && styles.stockInfoOutOfStock]}>
          {inStock ? `${displayStock} in stock` : 'Out of Stock'}
        </Text>

        {/* Variant Selector (compact mode for card) */}
        {showVariantSelector && (
          <VariantSelector
            variants={product.variants}
            variantGroups={variantGroups}
            selectedVariant={selectedVariant}
            basePrice={product.price}
            onVariantSelect={handleVariantSelect}
            displayMode="compact"
            showPriceDiff={false}
          />
        )}

        {/* Add to Cart Button */}
        <TouchableOpacity
          style={[styles.addButton, !inStock && styles.addButtonDisabled]}
          onPress={handleAddToCart}
          disabled={!inStock}
          accessibilityRole="button"
          accessibilityLabel={inStock ? 'Add to cart' : 'Out of stock'}
        >
          <Text style={[styles.addButtonText, !inStock && styles.addButtonTextDisabled]}>
            {inStock ? 'Add' : 'Out of Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: WHOLESALER_COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
    overflow: 'hidden',
  },
  wholesalerCard: {
    width: '46%',
    margin: '2%',
  },
  categoryCard: {
    width: '31%',
    margin: '1%',
  },
  imageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: WHOLESALER_COLORS.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: WHOLESALER_COLORS.background,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: WHOLESALER_COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  infoContainer: {
    padding: 8,
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 4,
    lineHeight: 18,
  },
  variantLabel: {
    fontSize: 11,
    color: WHOLESALER_COLORS.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: WHOLESALER_COLORS.primary,
  },
  mrp: {
    fontSize: 11,
    color: WHOLESALER_COLORS.mediumGrey,
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  stockInfo: {
    fontSize: 10,
    color: WHOLESALER_COLORS.success,
    marginBottom: 4,
  },
  stockInfoOutOfStock: {
    color: WHOLESALER_COLORS.error,
  },
  addButton: {
    backgroundColor: WHOLESALER_COLORS.primary,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 'auto',
  },
  addButtonDisabled: {
    backgroundColor: WHOLESALER_COLORS.lightGrey,
  },
  addButtonText: {
    color: WHOLESALER_COLORS.background,
    fontSize: 12,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: WHOLESALER_COLORS.mediumGrey,
  },
});

export default ProductCard;
