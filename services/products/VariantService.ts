/**
 * VariantService - Service for managing product variants
 * 
 * Implements Requirements 3.1, 3.2:
 * - Display all variants within a single product card with a variant selector
 * - Display variant options as selectable chips or dropdown in the product detail screen
 */

import { supabase } from '../supabase/supabase';

// ============================================================================
// Type Definitions
// ============================================================================

export type VariantType = 'size' | 'flavor' | 'color' | 'weight' | 'pack';

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  variant_type: VariantType;
  variant_value: string;
  price: number;
  mrp?: number;
  stock_quantity: number;
  image_url?: string;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VariantGroup {
  type: VariantType;
  display_name: string;
  values: string[];
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category_name?: string;
  status: string;
  sku?: string;
  images?: string[];
  is_active: boolean;
  has_variants?: boolean;
  variant_display_type?: 'grouped' | 'separate';
  parent_product_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  variant_groups: VariantGroup[];
  default_variant_id?: string;
}

export interface CreateVariantInput {
  product_id: string;
  sku: string;
  variant_type: VariantType;
  variant_value: string;
  price: number;
  mrp?: number;
  stock_quantity?: number;
  image_url?: string;
  is_default?: boolean;
  display_order?: number;
}

export interface UpdateVariantInput {
  sku?: string;
  variant_value?: string;
  price?: number;
  mrp?: number;
  stock_quantity?: number;
  image_url?: string;
  is_default?: boolean;
  display_order?: number;
  is_active?: boolean;
}

// ============================================================================
// Variant Grouping Logic
// ============================================================================

/**
 * Groups size/weight variants within a single product card
 * Requirements 3.1: Display all size/weight variants within a single product card
 */
export function groupSizeVariants(variants: ProductVariant[]): ProductVariant[] {
  return variants
    .filter(v => v.variant_type === 'size' || v.variant_type === 'weight')
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Separates flavor variants into different cards
 * Requirements 3.8: Show each flavor variant as a separate product card
 */
export function separateFlavorVariants(
  product: ProductWithVariants
): ProductWithVariants[] {
  const flavorVariants = product.variants.filter(v => v.variant_type === 'flavor');

  if (flavorVariants.length === 0) {
    return [product];
  }

  // Create a separate product card for each flavor
  return flavorVariants.map(flavorVariant => {
    // Get size variants for this flavor (if any)
    const sizeVariants = product.variants.filter(
      v => (v.variant_type === 'size' || v.variant_type === 'weight') &&
        v.variant_value !== flavorVariant.variant_value
    );

    return {
      ...product,
      name: `${product.name} - ${flavorVariant.variant_value}`,
      price: flavorVariant.price,
      stock_quantity: flavorVariant.stock_quantity,
      images: flavorVariant.image_url ? [flavorVariant.image_url] : product.images,
      variants: sizeVariants,
      variant_groups: product.variant_groups.filter(g => g.type !== 'flavor'),
      default_variant_id: flavorVariant.id,
    };
  });
}

/**
 * Groups variants by type for display
 */
export function groupVariantsByType(variants: ProductVariant[]): Map<VariantType, ProductVariant[]> {
  const grouped = new Map<VariantType, ProductVariant[]>();

  for (const variant of variants) {
    const existing = grouped.get(variant.variant_type) || [];
    existing.push(variant);
    grouped.set(variant.variant_type, existing);
  }

  // Sort each group by display_order
  for (const [type, variantList] of grouped) {
    grouped.set(type, variantList.sort((a, b) => a.display_order - b.display_order));
  }

  return grouped;
}

/**
 * Creates variant groups from variants list
 */
export function createVariantGroups(variants: ProductVariant[]): VariantGroup[] {
  const grouped = groupVariantsByType(variants);
  const groups: VariantGroup[] = [];

  const displayNames: Record<VariantType, string> = {
    size: 'Size',
    flavor: 'Flavor',
    color: 'Color',
    weight: 'Weight',
    pack: 'Pack',
  };

  for (const [type, variantList] of grouped) {
    groups.push({
      type,
      display_name: displayNames[type],
      values: variantList.map(v => v.variant_value),
    });
  }

  return groups;
}

/**
 * Gets the default variant for a product
 */
export function getDefaultVariant(variants: ProductVariant[]): ProductVariant | undefined {
  return variants.find(v => v.is_default && v.is_active) ||
    variants.find(v => v.is_active);
}

/**
 * Calculates price difference between variants
 * Requirements 3.4: Show the price difference between variants
 */
export function calculatePriceDifference(
  basePrice: number,
  variantPrice: number
): { difference: number; formatted: string } {
  const difference = variantPrice - basePrice;
  const formatted = difference > 0
    ? `+₹${difference.toFixed(2)}`
    : difference < 0
      ? `-₹${Math.abs(difference).toFixed(2)}`
      : '';

  return { difference, formatted };
}

/**
 * Checks if a variant is in stock
 * Requirements 3.5: Visually indicate unavailability with "Out of Stock" label
 */
export function isVariantInStock(variant: ProductVariant): boolean {
  return variant.stock_quantity > 0 && variant.is_active;
}

/**
 * Processes products for display, handling variant grouping
 * Requirements 3.8: Show each flavor variant as separate card, group size variants
 */
export function processProductsForDisplay(
  products: ProductWithVariants[]
): ProductWithVariants[] {
  const result: ProductWithVariants[] = [];

  for (const product of products) {
    if (!product.has_variants || product.variants.length === 0) {
      // No variants - display as-is (backward compatibility)
      result.push(product);
      continue;
    }

    const hasFlavorVariants = product.variants.some(v => v.variant_type === 'flavor');

    if (hasFlavorVariants && product.variant_display_type === 'separate') {
      // Separate flavor variants into different cards
      result.push(...separateFlavorVariants(product));
    } else {
      // Group all variants within single card
      result.push(product);
    }
  }

  return result;
}

// ============================================================================
// VariantService Class
// ============================================================================

class VariantServiceClass {
  /**
   * Get all variants for a product
   */
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('variant_type')
      .order('display_order');

    if (error) {
      console.error('[VariantService] Error fetching variants:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a single variant by ID
   */
  async getVariant(variantId: string): Promise<ProductVariant | null> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[VariantService] Error fetching variant:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get variant by SKU
   */
  async getVariantBySku(sku: string): Promise<ProductVariant | null> {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[VariantService] Error fetching variant by SKU:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new variant
   */
  async createVariant(input: CreateVariantInput): Promise<ProductVariant> {
    const { data, error } = await supabase
      .from('product_variants')
      .insert({
        product_id: input.product_id,
        sku: input.sku,
        variant_type: input.variant_type,
        variant_value: input.variant_value,
        price: input.price,
        mrp: input.mrp,
        stock_quantity: input.stock_quantity || 0,
        image_url: input.image_url,
        is_default: input.is_default || false,
        display_order: input.display_order || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[VariantService] Error creating variant:', error);
      throw error;
    }

    // Update product to indicate it has variants
    await this.updateProductHasVariants(input.product_id, true);

    return data;
  }

  /**
   * Create multiple variants at once
   */
  async createVariants(inputs: CreateVariantInput[]): Promise<ProductVariant[]> {
    if (inputs.length === 0) return [];

    const { data, error } = await supabase
      .from('product_variants')
      .insert(
        inputs.map(input => ({
          product_id: input.product_id,
          sku: input.sku,
          variant_type: input.variant_type,
          variant_value: input.variant_value,
          price: input.price,
          mrp: input.mrp,
          stock_quantity: input.stock_quantity || 0,
          image_url: input.image_url,
          is_default: input.is_default || false,
          display_order: input.display_order || 0,
          is_active: true,
        }))
      )
      .select();

    if (error) {
      console.error('[VariantService] Error creating variants:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('[VariantService] Variants insert returned no data - potential RLS issue');
      throw new Error('Failed to create variants: system permission denied');
    }

    // Update product to indicate it has variants
    const productIds = [...new Set(inputs.map(i => i.product_id))];
    for (const productId of productIds) {
      await this.updateProductHasVariants(productId, true);
    }

    return data || [];
  }

  /**
   * Update a variant
   */
  async updateVariant(variantId: string, input: UpdateVariantInput): Promise<ProductVariant> {
    const { data, error } = await supabase
      .from('product_variants')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', variantId)
      .select()
      .single();

    if (error) {
      console.error('[VariantService] Error updating variant:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a variant (soft delete)
   */
  async deleteVariant(variantId: string): Promise<void> {
    const variant = await this.getVariant(variantId);
    if (!variant) return;

    const { error } = await supabase
      .from('product_variants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', variantId);

    if (error) {
      console.error('[VariantService] Error deleting variant:', error);
      throw error;
    }

    // Check if product still has active variants
    const remainingVariants = await this.getProductVariants(variant.product_id);
    if (remainingVariants.length === 0) {
      await this.updateProductHasVariants(variant.product_id, false);
    }
  }

  /**
   * Update variant stock
   */
  async updateVariantStock(
    variantId: string,
    quantityChange: number,
    operation: 'add' | 'subtract' = 'subtract'
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_variant_stock', {
      p_variant_id: variantId,
      p_quantity_change: quantityChange,
      p_operation: operation,
    });

    if (error) {
      console.error('[VariantService] Error updating variant stock:', error);
      throw error;
    }

    return data;
  }

  /**
   * Set default variant for a product
   */
  async setDefaultVariant(productId: string, variantId: string): Promise<void> {
    // First, unset all defaults for this product
    await supabase
      .from('product_variants')
      .update({ is_default: false })
      .eq('product_id', productId);

    // Then set the new default
    const { error } = await supabase
      .from('product_variants')
      .update({ is_default: true })
      .eq('id', variantId);

    if (error) {
      console.error('[VariantService] Error setting default variant:', error);
      throw error;
    }
  }

  /**
   * Get product with all its variants
   */
  async getProductWithVariants(productId: string): Promise<ProductWithVariants | null> {
    // Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) {
      if (productError.code === 'PGRST116') {
        return null;
      }
      console.error('[VariantService] Error fetching product:', productError);
      throw productError;
    }

    // Get variants
    const variants = await this.getProductVariants(productId);
    const variantGroups = createVariantGroups(variants);
    const defaultVariant = getDefaultVariant(variants);

    return {
      ...product,
      variants,
      variant_groups: variantGroups,
      default_variant_id: defaultVariant?.id,
    };
  }

  /**
   * Update product's has_variants flag
   */
  private async updateProductHasVariants(productId: string, hasVariants: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ has_variants: hasVariants })
      .eq('id', productId);

    if (error) {
      console.error('[VariantService] Error updating product has_variants:', error);
    }
  }
}

// Export singleton instance
export const VariantService = new VariantServiceClass();

// Export class for testing
export { VariantServiceClass };
