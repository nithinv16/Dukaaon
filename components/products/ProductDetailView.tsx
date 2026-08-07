/**
 * ProductDetailView - Product detail view with variant support
 * 
 * Implements Requirements 3.2, 3.3, 3.4:
 * - Display variant options as selectable chips or dropdown in the product detail screen
 * - Update the displayed price, stock availability, and product image on variant selection
 * - Show the price difference between variants
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  ProductVariant,
  ProductWithVariants,
  getDefaultVariant,
  isVariantInStock,
  createVariantGroups,
  calculatePriceDifference,
} from '../../services/products/VariantService';
import VariantSelector from './VariantSelector';
import { WHOLESALER_COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetailViewProps {
  /** Product data with optional variants */
  product: ProductWithVariants;
  /** Callback when add to cart is pressed */
  onAddToCart?: (product: ProductWithVariants, variant?: ProductVariant, quantity: number) => void;
  /** Callback when back is pressed */
  onBack?: () => void;
}

/**
 * ProductDetailView displays full product details with variant selection
 */
const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  onAddToCart,
  onBack,
}) => {
  // Get default variant if product has variants
  const defaultVariant = useMemo(() => {
    if (product.has_variants && product.variants.length > 0) {
      return getDefaultVariant(product.variants);
    }
    return undefined;
  }, [product.has_variants, product.variants]);

  // Track selected variant and quantity
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    defaultVariant
  );
  const [quantity, setQuantity] = useState(1);

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
    // Reset quantity if new variant has less stock
    if (variant.stock_quantity < quantity) {
      setQuantity(Math.max(1, variant.stock_quantity));
    }
  }, [quantity]);

  // Handle quantity change
  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity(prev => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > displayStock) return displayStock;
      return newQty;
    });
  }, [displayStock]);

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    onAddToCart?.(product, selectedVariant, quantity);
  }, [onAddToCart, product, selectedVariant, quantity]);

  // Format price display
  const formatPrice = (price: number) => `₹${price.toFixed(2)}`;

  // Calculate savings
  const savings = displayMrp && displayMrp > displayPrice 
    ? displayMrp - displayPrice 
    : 0;
  const savingsPercent = displayMrp && displayMrp > displayPrice
    ? Math.round((savings / displayMrp) * 100)
    : 0;

  // Check if we should show variant selector
  const showVariantSelector = product.has_variants && 
    product.variants.length > 0 && 
    variantGroups.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No Image Available</Text>
            </View>
          )}
          
          {/* Out of Stock Badge */}
          {!inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockBadgeText}>Out of Stock</Text>
            </View>
          )}

          {/* Savings Badge */}
          {savingsPercent > 0 && inStock && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>{savingsPercent}% OFF</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          {/* Product Name */}
          <Text style={styles.name}>{product.name}</Text>

          {/* Selected Variant */}
          {selectedVariant && (
            <Text style={styles.selectedVariant}>
              Selected: {selectedVariant.variant_value}
            </Text>
          )}

          {/* Price Section */}
          <View style={styles.priceSection}>
            <Text style={styles.price}>{formatPrice(displayPrice)}</Text>
            {displayMrp && displayMrp > displayPrice && (
              <>
                <Text style={styles.mrp}>{formatPrice(displayMrp)}</Text>
                <Text style={styles.savings}>Save {formatPrice(savings)}</Text>
              </>
            )}
          </View>

          {/* Stock Status */}
          <View style={styles.stockSection}>
            <View style={[styles.stockIndicator, inStock ? styles.stockInStock : styles.stockOutOfStock]} />
            <Text style={[styles.stockText, !inStock && styles.stockTextOutOfStock]}>
              {inStock ? `${displayStock} units available` : 'Currently out of stock'}
            </Text>
          </View>

          {/* Variant Selector */}
          {showVariantSelector && (
            <View style={styles.variantSection}>
              <Text style={styles.sectionTitle}>Select Variant</Text>
              <VariantSelector
                variants={product.variants}
                variantGroups={variantGroups}
                selectedVariant={selectedVariant}
                basePrice={product.price}
                onVariantSelect={handleVariantSelect}
                displayMode="chips"
                showPriceDiff={true}
              />
            </View>
          )}

          {/* All Variants with Prices */}
          {showVariantSelector && (
            <View style={styles.allVariantsSection}>
              <Text style={styles.sectionTitle}>All Options</Text>
              {product.variants.filter(v => v.is_active).map(variant => {
                const priceDiff = calculatePriceDifference(product.price, variant.price);
                const variantInStock = isVariantInStock(variant);
                const isSelected = selectedVariant?.id === variant.id;

                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[
                      styles.variantRow,
                      isSelected && styles.variantRowSelected,
                      !variantInStock && styles.variantRowOutOfStock,
                    ]}
                    onPress={() => handleVariantSelect(variant)}
                    disabled={!variantInStock}
                  >
                    <View style={styles.variantInfo}>
                      <Text style={[
                        styles.variantName,
                        !variantInStock && styles.variantNameOutOfStock,
                      ]}>
                        {variant.variant_value}
                      </Text>
                      {!variantInStock && (
                        <Text style={styles.variantOutOfStockLabel}>Out of Stock</Text>
                      )}
                    </View>
                    <View style={styles.variantPriceInfo}>
                      <Text style={[
                        styles.variantPrice,
                        !variantInStock && styles.variantPriceOutOfStock,
                      ]}>
                        {formatPrice(variant.price)}
                      </Text>
                      {priceDiff.formatted && (
                        <Text style={[
                          styles.variantPriceDiff,
                          priceDiff.difference > 0 ? styles.priceDiffPositive : styles.priceDiffNegative,
                        ]}>
                          {priceDiff.formatted}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Description */}
          {product.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        {/* Quantity Selector */}
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
            onPress={() => handleQuantityChange(-1)}
            disabled={quantity <= 1}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={[styles.quantityButton, quantity >= displayStock && styles.quantityButtonDisabled]}
            onPress={() => handleQuantityChange(1)}
            disabled={quantity >= displayStock || !inStock}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Add to Cart Button */}
        <TouchableOpacity
          style={[styles.addToCartButton, !inStock && styles.addToCartButtonDisabled]}
          onPress={handleAddToCart}
          disabled={!inStock}
        >
          <Text style={styles.addToCartButtonText}>
            {inStock ? `Add to Cart - ${formatPrice(displayPrice * quantity)}` : 'Out of Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.8,
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
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: WHOLESALER_COLORS.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  outOfStockBadgeText: {
    color: WHOLESALER_COLORS.background,
    fontSize: 12,
    fontWeight: '600',
  },
  savingsBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: WHOLESALER_COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  savingsBadgeText: {
    color: WHOLESALER_COLORS.background,
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 8,
  },
  selectedVariant: {
    fontSize: 14,
    color: WHOLESALER_COLORS.primary,
    fontWeight: '500',
    marginBottom: 12,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: WHOLESALER_COLORS.primary,
  },
  mrp: {
    fontSize: 16,
    color: WHOLESALER_COLORS.mediumGrey,
    textDecorationLine: 'line-through',
    marginLeft: 12,
  },
  savings: {
    fontSize: 14,
    color: WHOLESALER_COLORS.success,
    fontWeight: '600',
    marginLeft: 12,
  },
  stockSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stockIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stockInStock: {
    backgroundColor: WHOLESALER_COLORS.success,
  },
  stockOutOfStock: {
    backgroundColor: WHOLESALER_COLORS.error,
  },
  stockText: {
    fontSize: 14,
    color: WHOLESALER_COLORS.success,
  },
  stockTextOutOfStock: {
    color: WHOLESALER_COLORS.error,
  },
  variantSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 12,
  },
  allVariantsSection: {
    marginBottom: 16,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: WHOLESALER_COLORS.surface,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
  },
  variantRowSelected: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    borderColor: WHOLESALER_COLORS.primary,
  },
  variantRowOutOfStock: {
    opacity: 0.6,
  },
  variantInfo: {
    flex: 1,
  },
  variantName: {
    fontSize: 14,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  variantNameOutOfStock: {
    textDecorationLine: 'line-through',
    color: WHOLESALER_COLORS.mediumGrey,
  },
  variantOutOfStockLabel: {
    fontSize: 11,
    color: WHOLESALER_COLORS.error,
    marginTop: 2,
  },
  variantPriceInfo: {
    alignItems: 'flex-end',
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  variantPriceOutOfStock: {
    color: WHOLESALER_COLORS.mediumGrey,
  },
  variantPriceDiff: {
    fontSize: 11,
    marginTop: 2,
  },
  priceDiffPositive: {
    color: WHOLESALER_COLORS.error,
  },
  priceDiffNegative: {
    color: WHOLESALER_COLORS.success,
  },
  descriptionSection: {
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: WHOLESALER_COLORS.darkGrey,
    lineHeight: 22,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: WHOLESALER_COLORS.background,
    borderTopWidth: 1,
    borderTopColor: WHOLESALER_COLORS.lightGrey,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHOLESALER_COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
    marginRight: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: WHOLESALER_COLORS.primary,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
    minWidth: 30,
    textAlign: 'center',
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToCartButtonDisabled: {
    backgroundColor: WHOLESALER_COLORS.lightGrey,
  },
  addToCartButtonText: {
    color: WHOLESALER_COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductDetailView;
