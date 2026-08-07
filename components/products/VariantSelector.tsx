/**
 * VariantSelector - Component for selecting product variants
 * 
 * Implements Requirements 3.2, 3.4, 3.5:
 * - Display variant options as selectable chips or dropdown
 * - Show the price difference between variants
 * - Visually indicate unavailability with "Out of Stock" label
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  ProductVariant,
  VariantGroup,
  VariantType,
  calculatePriceDifference,
  isVariantInStock,
} from '../../services/products/VariantService';
import { WHOLESALER_COLORS } from '../../constants/colors';

interface VariantSelectorProps {
  /** Available variants for the product */
  variants: ProductVariant[];
  /** Variant groups for organized display */
  variantGroups: VariantGroup[];
  /** Currently selected variant */
  selectedVariant?: ProductVariant;
  /** Base price for calculating differences */
  basePrice: number;
  /** Callback when a variant is selected */
  onVariantSelect: (variant: ProductVariant) => void;
  /** Display mode: 'chips' for inline, 'compact' for smaller cards */
  displayMode?: 'chips' | 'compact';
  /** Whether to show price differences */
  showPriceDiff?: boolean;
}

/**
 * VariantSelector displays variant options as selectable chips
 * with price differences and stock status
 */
const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  variantGroups,
  selectedVariant,
  basePrice,
  onVariantSelect,
  displayMode = 'chips',
  showPriceDiff = true,
}) => {
  // Group variants by type for organized display
  const getVariantsByType = useCallback((type: VariantType): ProductVariant[] => {
    return variants
      .filter(v => v.variant_type === type && v.is_active)
      .sort((a, b) => a.display_order - b.display_order);
  }, [variants]);

  // Check if a variant is selected
  const isSelected = useCallback((variant: ProductVariant): boolean => {
    return selectedVariant?.id === variant.id;
  }, [selectedVariant]);

  // Render a single variant chip
  const renderVariantChip = (variant: ProductVariant) => {
    const selected = isSelected(variant);
    const inStock = isVariantInStock(variant);
    const priceDiff = calculatePriceDifference(basePrice, variant.price);

    return (
      <TouchableOpacity
        key={variant.id}
        style={[
          styles.chip,
          selected && styles.chipSelected,
          !inStock && styles.chipOutOfStock,
          displayMode === 'compact' && styles.chipCompact,
        ]}
        onPress={() => onVariantSelect(variant)}
        disabled={!inStock}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !inStock }}
        accessibilityLabel={`${variant.variant_value}${!inStock ? ', out of stock' : ''}`}
      >
        <Text
          style={[
            styles.chipText,
            selected && styles.chipTextSelected,
            !inStock && styles.chipTextOutOfStock,
            displayMode === 'compact' && styles.chipTextCompact,
          ]}
          numberOfLines={1}
        >
          {variant.variant_value}
        </Text>
        
        {/* Price difference indicator */}
        {showPriceDiff && priceDiff.formatted && inStock && (
          <Text
            style={[
              styles.priceDiff,
              priceDiff.difference > 0 ? styles.priceDiffPositive : styles.priceDiffNegative,
              displayMode === 'compact' && styles.priceDiffCompact,
            ]}
          >
            {priceDiff.formatted}
          </Text>
        )}

        {/* Out of stock label */}
        {!inStock && (
          <Text style={styles.outOfStockLabel}>Out of Stock</Text>
        )}
      </TouchableOpacity>
    );
  };

  // Render variant group with label
  const renderVariantGroup = (group: VariantGroup) => {
    const groupVariants = getVariantsByType(group.type);
    
    if (groupVariants.length === 0) return null;

    return (
      <View key={group.type} style={styles.groupContainer}>
        <Text style={styles.groupLabel}>{group.display_name}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {groupVariants.map(renderVariantChip)}
        </ScrollView>
      </View>
    );
  };

  // If no variant groups provided, create them from variants
  const effectiveGroups = variantGroups.length > 0
    ? variantGroups
    : createGroupsFromVariants(variants);

  return (
    <View style={styles.container}>
      {effectiveGroups.map(renderVariantGroup)}
    </View>
  );
};

/**
 * Helper to create variant groups from variants list
 */
function createGroupsFromVariants(variants: ProductVariant[]): VariantGroup[] {
  const typeMap = new Map<VariantType, Set<string>>();
  
  for (const variant of variants) {
    if (!variant.is_active) continue;
    
    const values = typeMap.get(variant.variant_type) || new Set();
    values.add(variant.variant_value);
    typeMap.set(variant.variant_type, values);
  }

  const displayNames: Record<VariantType, string> = {
    size: 'Size',
    flavor: 'Flavor',
    color: 'Color',
    weight: 'Weight',
    pack: 'Pack',
  };

  const groups: VariantGroup[] = [];
  for (const [type, values] of typeMap) {
    groups.push({
      type,
      display_name: displayNames[type],
      values: Array.from(values),
    });
  }

  return groups;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: WHOLESALER_COLORS.surface,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipSelected: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    borderColor: WHOLESALER_COLORS.primary,
  },
  chipOutOfStock: {
    backgroundColor: WHOLESALER_COLORS.surface,
    borderColor: WHOLESALER_COLORS.lightGrey,
    opacity: 0.6,
  },
  chipText: {
    fontSize: 14,
    color: WHOLESALER_COLORS.darkGrey,
    fontWeight: '500',
  },
  chipTextCompact: {
    fontSize: 12,
  },
  chipTextSelected: {
    color: WHOLESALER_COLORS.primary,
    fontWeight: '600',
  },
  chipTextOutOfStock: {
    color: WHOLESALER_COLORS.mediumGrey,
    textDecorationLine: 'line-through',
  },
  priceDiff: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  priceDiffCompact: {
    fontSize: 10,
    marginLeft: 4,
  },
  priceDiffPositive: {
    color: WHOLESALER_COLORS.error,
  },
  priceDiffNegative: {
    color: WHOLESALER_COLORS.success,
  },
  outOfStockLabel: {
    fontSize: 10,
    color: WHOLESALER_COLORS.error,
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default VariantSelector;

// Export for testing
export { createGroupsFromVariants };
