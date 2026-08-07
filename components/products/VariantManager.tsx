/**
 * VariantManager - Component for sellers to manage product variants
 * 
 * Implements Requirements 3.7:
 * - Provide an interface to define variant groups (size, flavor, color, etc.)
 * - Support adding multiple variants with individual pricing and stock
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ProductVariant,
  VariantType,
  CreateVariantInput,
} from '../../services/products/VariantService';
import { WHOLESALER_COLORS } from '../../constants/colors';

interface VariantManagerProps {
  /** Product ID to add variants to */
  productId: string;
  /** Existing variants (for editing) */
  existingVariants?: ProductVariant[];
  /** Callback when variants are saved */
  onSave: (variants: CreateVariantInput[]) => Promise<void>;
  /** Callback when cancelled */
  onCancel: () => void;
}

interface VariantDraft {
  id: string; // Temporary ID for UI
  variant_type: VariantType;
  variant_value: string;
  price: string;
  mrp: string;
  stock_quantity: string;
  sku: string;
  is_default: boolean;
}

const VARIANT_TYPES: { value: VariantType; label: string }[] = [
  { value: 'size', label: 'Size' },
  { value: 'weight', label: 'Weight' },
  { value: 'flavor', label: 'Flavor' },
  { value: 'color', label: 'Color' },
  { value: 'pack', label: 'Pack' },
];

/**
 * VariantManager allows sellers to create and manage product variants
 */
const VariantManager: React.FC<VariantManagerProps> = ({
  productId,
  existingVariants = [],
  onSave,
  onCancel,
}) => {
  // Initialize variants from existing or empty
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (existingVariants.length > 0) {
      return existingVariants.map(v => ({
        id: v.id,
        variant_type: v.variant_type,
        variant_value: v.variant_value,
        price: v.price.toString(),
        mrp: v.mrp?.toString() || '',
        stock_quantity: v.stock_quantity.toString(),
        sku: v.sku,
        is_default: v.is_default,
      }));
    }
    return [];
  });

  const [selectedType, setSelectedType] = useState<VariantType>('size');
  const [saving, setSaving] = useState(false);

  // Generate a temporary ID
  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add a new variant
  const handleAddVariant = useCallback(() => {
    const newVariant: VariantDraft = {
      id: generateTempId(),
      variant_type: selectedType,
      variant_value: '',
      price: '',
      mrp: '',
      stock_quantity: '0',
      sku: '',
      is_default: variants.length === 0, // First variant is default
    };
    setVariants(prev => [...prev, newVariant]);
  }, [selectedType, variants.length]);

  // Update a variant field
  const handleUpdateVariant = useCallback((id: string, field: keyof VariantDraft, value: string | boolean) => {
    setVariants(prev => prev.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  }, []);

  // Remove a variant
  const handleRemoveVariant = useCallback((id: string) => {
    setVariants(prev => {
      const filtered = prev.filter(v => v.id !== id);
      // If we removed the default, make the first one default
      if (filtered.length > 0 && !filtered.some(v => v.is_default)) {
        filtered[0].is_default = true;
      }
      return filtered;
    });
  }, []);

  // Set a variant as default
  const handleSetDefault = useCallback((id: string) => {
    setVariants(prev => prev.map(v => ({
      ...v,
      is_default: v.id === id,
    })));
  }, []);

  // Validate variants
  const validateVariants = (): string | null => {
    if (variants.length === 0) {
      return 'Please add at least one variant';
    }

    for (const variant of variants) {
      if (!variant.variant_value.trim()) {
        return 'All variants must have a value';
      }
      if (!variant.price || parseFloat(variant.price) <= 0) {
        return 'All variants must have a valid price';
      }
      if (!variant.sku.trim()) {
        return 'All variants must have a SKU';
      }
    }

    // Check for duplicate SKUs
    const skus = variants.map(v => v.sku.trim().toLowerCase());
    const uniqueSkus = new Set(skus);
    if (skus.length !== uniqueSkus.size) {
      return 'Each variant must have a unique SKU';
    }

    // Check for duplicate type+value combinations
    const typeValues = variants.map(v => `${v.variant_type}:${v.variant_value.trim().toLowerCase()}`);
    const uniqueTypeValues = new Set(typeValues);
    if (typeValues.length !== uniqueTypeValues.size) {
      return 'Each variant type and value combination must be unique';
    }

    return null;
  };

  // Save variants
  const handleSave = async () => {
    const error = validateVariants();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    setSaving(true);
    try {
      const variantInputs: CreateVariantInput[] = variants.map((v, index) => ({
        product_id: productId,
        sku: v.sku.trim(),
        variant_type: v.variant_type,
        variant_value: v.variant_value.trim(),
        price: parseFloat(v.price),
        mrp: v.mrp ? parseFloat(v.mrp) : undefined,
        stock_quantity: parseInt(v.stock_quantity) || 0,
        is_default: v.is_default,
        display_order: index,
      }));

      await onSave(variantInputs);
    } catch (err) {
      console.error('Error saving variants:', err);
      Alert.alert('Error', 'Failed to save variants. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Render variant type selector
  const renderTypeSelector = () => (
    <View style={styles.typeSelector}>
      <Text style={styles.sectionLabel}>Variant Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.typeChips}>
          {VARIANT_TYPES.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeChip,
                selectedType === type.value && styles.typeChipSelected,
              ]}
              onPress={() => setSelectedType(type.value)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === type.value && styles.typeChipTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // Render a single variant form
  const renderVariantForm = (variant: VariantDraft, index: number) => (
    <View key={variant.id} style={styles.variantCard}>
      <View style={styles.variantHeader}>
        <Text style={styles.variantTitle}>
          {VARIANT_TYPES.find(t => t.value === variant.variant_type)?.label} Variant #{index + 1}
        </Text>
        <View style={styles.variantActions}>
          {!variant.is_default && (
            <TouchableOpacity
              style={styles.defaultButton}
              onPress={() => handleSetDefault(variant.id)}
            >
              <Text style={styles.defaultButtonText}>Set Default</Text>
            </TouchableOpacity>
          )}
          {variant.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveVariant(variant.id)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Value *</Text>
          <TextInput
            style={styles.input}
            value={variant.variant_value}
            onChangeText={(text) => handleUpdateVariant(variant.id, 'variant_value', text)}
            placeholder={variant.variant_type === 'size' ? 'e.g., 500ml' : 'e.g., Chocolate'}
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>SKU *</Text>
          <TextInput
            style={styles.input}
            value={variant.sku}
            onChangeText={(text) => handleUpdateVariant(variant.id, 'sku', text)}
            placeholder="e.g., PROD-500ML"
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Price (₹) *</Text>
          <TextInput
            style={styles.input}
            value={variant.price}
            onChangeText={(text) => handleUpdateVariant(variant.id, 'price', text)}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>MRP (₹)</Text>
          <TextInput
            style={styles.input}
            value={variant.mrp}
            onChangeText={(text) => handleUpdateVariant(variant.id, 'mrp', text)}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>Stock</Text>
          <TextInput
            style={styles.input}
            value={variant.stock_quantity}
            onChangeText={(text) => handleUpdateVariant(variant.id, 'stock_quantity', text)}
            placeholder="0"
            keyboardType="number-pad"
          />
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Variants</Text>
        <Text style={styles.subtitle}>
          Add different sizes, flavors, or other variations of your product
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTypeSelector()}

        <TouchableOpacity style={styles.addButton} onPress={handleAddVariant}>
          <Text style={styles.addButtonText}>+ Add {VARIANT_TYPES.find(t => t.value === selectedType)?.label} Variant</Text>
        </TouchableOpacity>

        {variants.length > 0 && (
          <View style={styles.variantsList}>
            <Text style={styles.sectionLabel}>
              Variants ({variants.length})
            </Text>
            {variants.map((variant, index) => renderVariantForm(variant, index))}
          </View>
        )}

        {variants.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No variants added yet. Select a variant type and click "Add Variant" to get started.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || variants.length === 0}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Variants'}
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: WHOLESALER_COLORS.lightGrey,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  typeSelector: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
    marginBottom: 8,
  },
  typeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: WHOLESALER_COLORS.surface,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
    marginRight: 8,
  },
  typeChipSelected: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    borderColor: WHOLESALER_COLORS.primary,
  },
  typeChipText: {
    fontSize: 14,
    color: WHOLESALER_COLORS.darkGrey,
  },
  typeChipTextSelected: {
    color: WHOLESALER_COLORS.primary,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.primary,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: WHOLESALER_COLORS.primary,
  },
  variantsList: {
    marginTop: 8,
  },
  variantCard: {
    backgroundColor: WHOLESALER_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  variantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: WHOLESALER_COLORS.primaryLight,
  },
  defaultButtonText: {
    fontSize: 12,
    color: WHOLESALER_COLORS.primary,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: WHOLESALER_COLORS.success,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: WHOLESALER_COLORS.background,
    fontWeight: '600',
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeButtonText: {
    fontSize: 12,
    color: WHOLESALER_COLORS.error,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: WHOLESALER_COLORS.mediumGrey,
    marginBottom: 4,
  },
  input: {
    backgroundColor: WHOLESALER_COLORS.background,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: WHOLESALER_COLORS.darkGrey,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: WHOLESALER_COLORS.mediumGrey,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: WHOLESALER_COLORS.lightGrey,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: WHOLESALER_COLORS.surface,
    borderWidth: 1,
    borderColor: WHOLESALER_COLORS.lightGrey,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: WHOLESALER_COLORS.primary,
  },
  saveButtonDisabled: {
    backgroundColor: WHOLESALER_COLORS.lightGrey,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHOLESALER_COLORS.background,
  },
});

export default VariantManager;
