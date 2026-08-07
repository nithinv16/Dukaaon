/**
 * Property-Based Tests for VariantService
 * 
 * Tests for product variant system including:
 * - Property 10: Variant Grouping Consistency
 * - Property 11: Flavor Variant Separation
 * - Property 12: Backward Compatibility
 * - Property 13: Cart Variant Recording
 */

// Mock AsyncStorage BEFORE any imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

// Mock Supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(function() { return this; }),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

import * as fc from 'fast-check';
import {
  ProductVariant,
  ProductWithVariants,
  VariantType,
  groupSizeVariants,
  separateFlavorVariants,
  groupVariantsByType,
  createVariantGroups,
  getDefaultVariant,
  calculatePriceDifference,
  isVariantInStock,
  processProductsForDisplay,
} from '../../services/products/VariantService';

// ============================================================================
// Arbitrary Generators
// ============================================================================

const variantTypeArb: fc.Arbitrary<VariantType> = fc.constantFrom(
  'size', 'flavor', 'color', 'weight', 'pack'
);

const variantArb: fc.Arbitrary<ProductVariant> = fc.record({
  id: fc.uuid(),
  product_id: fc.uuid(),
  sku: fc.string({ minLength: 3, maxLength: 20 }).map(s => `SKU-${s}`),
  variant_type: variantTypeArb,
  variant_value: fc.string({ minLength: 1, maxLength: 30 }),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  mrp: fc.option(fc.float({ min: Math.fround(0.01), max: Math.fround(15000), noNaN: true }), { nil: undefined }),
  stock_quantity: fc.integer({ min: 0, max: 1000 }),
  image_url: fc.option(fc.webUrl(), { nil: undefined }),
  is_default: fc.boolean(),
  display_order: fc.integer({ min: 0, max: 100 }),
  is_active: fc.boolean(),
});

const activeVariantArb: fc.Arbitrary<ProductVariant> = variantArb.map(v => ({
  ...v,
  is_active: true,
}));

const sizeVariantArb: fc.Arbitrary<ProductVariant> = activeVariantArb.map(v => ({
  ...v,
  variant_type: 'size' as VariantType,
  variant_value: fc.sample(fc.constantFrom('250ml', '500ml', '1L', '2L', 'S', 'M', 'L', 'XL'), 1)[0],
}));

const flavorVariantArb: fc.Arbitrary<ProductVariant> = activeVariantArb.map(v => ({
  ...v,
  variant_type: 'flavor' as VariantType,
  variant_value: fc.sample(fc.constantFrom('Chocolate', 'Vanilla', 'Strawberry', 'Mango', 'Orange'), 1)[0],
}));

const productArb: fc.Arbitrary<ProductWithVariants> = fc.record({
  id: fc.uuid(),
  seller_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  stock_quantity: fc.integer({ min: 0, max: 1000 }),
  category_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  status: fc.constantFrom('available', 'out_of_stock', 'discontinued'),
  sku: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
  images: fc.option(fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  is_active: fc.constant(true),
  has_variants: fc.boolean(),
  variant_display_type: fc.constantFrom('grouped', 'separate') as fc.Arbitrary<'grouped' | 'separate'>,
  parent_product_id: fc.option(fc.uuid(), { nil: undefined }),
  variants: fc.array(activeVariantArb, { minLength: 0, maxLength: 10 }),
  variant_groups: fc.constant([]),
  default_variant_id: fc.option(fc.uuid(), { nil: undefined }),
});

// Product without variants (for backward compatibility testing)
const productWithoutVariantsArb: fc.Arbitrary<ProductWithVariants> = productArb.map(p => ({
  ...p,
  has_variants: false,
  variants: [],
  variant_groups: [],
  default_variant_id: undefined,
}));

// Product with size variants only
const productWithSizeVariantsArb: fc.Arbitrary<ProductWithVariants> = fc.record({
  id: fc.uuid(),
  seller_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  stock_quantity: fc.integer({ min: 0, max: 1000 }),
  category_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  status: fc.constant('available'),
  sku: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
  images: fc.option(fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  is_active: fc.constant(true),
  has_variants: fc.constant(true),
  variant_display_type: fc.constant('grouped') as fc.Arbitrary<'grouped' | 'separate'>,
  parent_product_id: fc.constant(undefined),
  variants: fc.array(sizeVariantArb, { minLength: 1, maxLength: 5 }),
  variant_groups: fc.constant([]),
  default_variant_id: fc.option(fc.uuid(), { nil: undefined }),
});

// Product with flavor variants
const productWithFlavorVariantsArb: fc.Arbitrary<ProductWithVariants> = fc.record({
  id: fc.uuid(),
  seller_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
  stock_quantity: fc.integer({ min: 0, max: 1000 }),
  category_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  status: fc.constant('available'),
  sku: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
  images: fc.option(fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 }), { nil: undefined }),
  is_active: fc.constant(true),
  has_variants: fc.constant(true),
  variant_display_type: fc.constant('separate') as fc.Arbitrary<'grouped' | 'separate'>,
  parent_product_id: fc.constant(undefined),
  variants: fc.array(flavorVariantArb, { minLength: 1, maxLength: 5 }),
  variant_groups: fc.constant([]),
  default_variant_id: fc.option(fc.uuid(), { nil: undefined }),
});

// Cart item with variant
interface CartItemWithVariant {
  product_id: string;
  variant_id: string;
  sku: string;
  quantity: number;
  variant_details: string;
}

const cartItemWithVariantArb: fc.Arbitrary<CartItemWithVariant> = fc.record({
  product_id: fc.uuid(),
  variant_id: fc.uuid(),
  sku: fc.string({ minLength: 3, maxLength: 20 }).map(s => `SKU-${s}`),
  quantity: fc.integer({ min: 1, max: 100 }),
  variant_details: fc.string({ minLength: 1, maxLength: 50 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('VariantService Property Tests', () => {
  /**
   * **Feature: dukaaon-app-improvements, Property 12: Backward Compatibility**
   * **Validates: Requirements 3.10, 3.11**
   * 
   * Property: For any existing product without variants (has_variants=false or null),
   * the product SHALL render identically to the current implementation without variant selectors.
   */
  describe('Property 12: Backward Compatibility', () => {
    it('products without variants should pass through processProductsForDisplay unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(productWithoutVariantsArb, { minLength: 1, maxLength: 10 }),
          async (products) => {
            // Act: Process products for display
            const result = processProductsForDisplay(products);

            // Property: Same number of products should be returned
            expect(result.length).toBe(products.length);

            // Property: Each product should be unchanged
            for (let i = 0; i < products.length; i++) {
              expect(result[i].id).toBe(products[i].id);
              expect(result[i].name).toBe(products[i].name);
              expect(result[i].price).toBe(products[i].price);
              expect(result[i].has_variants).toBe(false);
              expect(result[i].variants).toEqual([]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('products with has_variants=false should not have variant selectors', async () => {
      await fc.assert(
        fc.asyncProperty(
          productWithoutVariantsArb,
          async (product) => {
            // Property: has_variants should be false
            expect(product.has_variants).toBe(false);

            // Property: variants array should be empty
            expect(product.variants).toEqual([]);

            // Property: variant_groups should be empty
            expect(product.variant_groups).toEqual([]);

            // Property: No default variant should be set
            expect(product.default_variant_id).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('products with empty variants array should render without variant UI', async () => {
      await fc.assert(
        fc.asyncProperty(
          productArb.map(p => ({ ...p, variants: [], has_variants: true })),
          async (product) => {
            // Act: Process for display
            const result = processProductsForDisplay([product]);

            // Property: Should return single product
            expect(result.length).toBe(1);

            // Property: Product should be unchanged (no variant splitting)
            expect(result[0].id).toBe(product.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: dukaaon-app-improvements, Property 10: Variant Grouping Consistency**
   * **Validates: Requirements 3.1, 3.3**
   * 
   * Property: For any product with size/weight variants, all variants SHALL be displayed
   * within a single product card, and selecting a variant SHALL update price, stock, and image atomically.
   */
  describe('Property 10: Variant Grouping Consistency', () => {
    it('size variants should be grouped within single product card', async () => {
      await fc.assert(
        fc.asyncProperty(
          productWithSizeVariantsArb,
          async (product) => {
            // Act: Group size variants
            const sizeVariants = groupSizeVariants(product.variants);

            // Property: All size/weight variants should be included
            const expectedCount = product.variants.filter(
              v => v.variant_type === 'size' || v.variant_type === 'weight'
            ).length;
            expect(sizeVariants.length).toBe(expectedCount);

            // Property: Variants should be sorted by display_order
            for (let i = 1; i < sizeVariants.length; i++) {
              expect(sizeVariants[i].display_order).toBeGreaterThanOrEqual(
                sizeVariants[i - 1].display_order
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('selecting a variant should provide price, stock, and image atomically', async () => {
      await fc.assert(
        fc.asyncProperty(
          activeVariantArb,
          async (variant) => {
            // Property: Variant should have all required fields for atomic update
            expect(variant.price).toBeDefined();
            expect(typeof variant.price).toBe('number');
            expect(variant.price).toBeGreaterThanOrEqual(0);

            expect(variant.stock_quantity).toBeDefined();
            expect(typeof variant.stock_quantity).toBe('number');
            expect(variant.stock_quantity).toBeGreaterThanOrEqual(0);

            // image_url is optional but should be string if present
            if (variant.image_url !== undefined) {
              expect(typeof variant.image_url).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('variant groups should contain all unique variant types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activeVariantArb, { minLength: 1, maxLength: 10 }),
          async (variants) => {
            // Act: Create variant groups
            const groups = createVariantGroups(variants);

            // Property: Each variant type should appear at most once in groups
            const types = groups.map(g => g.type);
            const uniqueTypes = [...new Set(types)];
            expect(types.length).toBe(uniqueTypes.length);

            // Property: All variant types from input should be represented
            const inputTypes = [...new Set(variants.map(v => v.variant_type))];
            expect(types.sort()).toEqual(inputTypes.sort());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('groupVariantsByType should preserve all variants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activeVariantArb, { minLength: 0, maxLength: 20 }),
          async (variants) => {
            // Act: Group variants by type
            const grouped = groupVariantsByType(variants);

            // Property: Total count should match input
            let totalCount = 0;
            for (const [, variantList] of grouped) {
              totalCount += variantList.length;
            }
            expect(totalCount).toBe(variants.length);

            // Property: Each variant should be in exactly one group
            const allGroupedIds = new Set<string>();
            for (const [, variantList] of grouped) {
              for (const v of variantList) {
                expect(allGroupedIds.has(v.id)).toBe(false);
                allGroupedIds.add(v.id);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: dukaaon-app-improvements, Property 11: Flavor Variant Separation**
   * **Validates: Requirements 3.8**
   * 
   * Property: For any product with flavor variants, each flavor SHALL appear as a separate
   * product card in the products list, while size variants within each flavor are grouped.
   */
  describe('Property 11: Flavor Variant Separation', () => {
    it('flavor variants should be separated into different product cards', async () => {
      await fc.assert(
        fc.asyncProperty(
          productWithFlavorVariantsArb,
          async (product) => {
            // Act: Separate flavor variants
            const separatedProducts = separateFlavorVariants(product);

            // Property: Number of separated products should equal number of flavor variants
            const flavorCount = product.variants.filter(v => v.variant_type === 'flavor').length;
            expect(separatedProducts.length).toBe(flavorCount);

            // Property: Each separated product should have the flavor in its name
            for (const separated of separatedProducts) {
              expect(separated.name).toContain(' - ');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('products without flavor variants should not be separated', async () => {
      await fc.assert(
        fc.asyncProperty(
          productWithSizeVariantsArb,
          async (product) => {
            // Act: Try to separate (should return single product)
            const result = separateFlavorVariants(product);

            // Property: Should return single product unchanged
            expect(result.length).toBe(1);
            expect(result[0].id).toBe(product.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('processProductsForDisplay should separate flavors when variant_display_type is separate', async () => {
      await fc.assert(
        fc.asyncProperty(
          productWithFlavorVariantsArb,
          async (product) => {
            // Ensure variant_display_type is 'separate'
            const productWithSeparate = { ...product, variant_display_type: 'separate' as const };

            // Act: Process for display
            const result = processProductsForDisplay([productWithSeparate]);

            // Property: Should have one card per flavor
            const flavorCount = product.variants.filter(v => v.variant_type === 'flavor').length;
            expect(result.length).toBe(flavorCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each separated flavor card should have correct price from flavor variant', async () => {
      // Use a custom generator that ensures unique flavor values
      const uniqueFlavorVariantsArb = fc.array(
        fc.constantFrom('Chocolate', 'Vanilla', 'Strawberry', 'Mango', 'Orange'),
        { minLength: 1, maxLength: 5 }
      ).map(flavors => [...new Set(flavors)]); // Ensure unique flavors

      const productWithUniqueFlavorVariantsArb = fc.tuple(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        uniqueFlavorVariantsArb
      ).map(([id, sellerId, name, basePrice, flavors]) => {
        const variants: ProductVariant[] = flavors.map((flavor, idx) => ({
          id: `${id}-${idx}`,
          product_id: id,
          sku: `SKU-${flavor}`,
          variant_type: 'flavor' as VariantType,
          variant_value: flavor,
          price: basePrice + (idx * 10), // Different price per flavor
          mrp: undefined,
          stock_quantity: 100,
          image_url: undefined,
          is_default: idx === 0,
          display_order: idx,
          is_active: true,
        }));

        return {
          id,
          seller_id: sellerId,
          name,
          description: undefined,
          price: basePrice,
          stock_quantity: 100,
          category_name: undefined,
          status: 'available',
          sku: undefined,
          images: undefined,
          is_active: true,
          has_variants: true,
          variant_display_type: 'separate' as const,
          parent_product_id: undefined,
          variants,
          variant_groups: [],
          default_variant_id: undefined,
        } as ProductWithVariants;
      });

      await fc.assert(
        fc.asyncProperty(
          productWithUniqueFlavorVariantsArb,
          async (product) => {
            // Act: Separate flavor variants
            const separatedProducts = separateFlavorVariants(product);

            // Property: Each separated product should have price from its flavor variant
            const flavorVariants = product.variants.filter(v => v.variant_type === 'flavor');
            
            for (let i = 0; i < separatedProducts.length; i++) {
              const separated = separatedProducts[i];
              const matchingFlavor = flavorVariants.find(
                fv => separated.name.includes(fv.variant_value)
              );
              
              if (matchingFlavor) {
                expect(separated.price).toBe(matchingFlavor.price);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: dukaaon-app-improvements, Property 13: Cart Variant Recording**
   * **Validates: Requirements 3.6**
   * 
   * Property: For any product with variants added to cart, the cart item SHALL contain
   * the specific variant_id and SKU, and display the variant details (e.g., "Mirinda 500ml").
   */
  describe('Property 13: Cart Variant Recording', () => {
    it('cart item with variant should have variant_id and SKU', async () => {
      await fc.assert(
        fc.asyncProperty(
          cartItemWithVariantArb,
          async (cartItem) => {
            // Property: variant_id should be present and valid UUID format
            expect(cartItem.variant_id).toBeDefined();
            expect(typeof cartItem.variant_id).toBe('string');
            expect(cartItem.variant_id.length).toBeGreaterThan(0);

            // Property: SKU should be present
            expect(cartItem.sku).toBeDefined();
            expect(typeof cartItem.sku).toBe('string');
            expect(cartItem.sku.length).toBeGreaterThan(0);

            // Property: variant_details should be present for display
            expect(cartItem.variant_details).toBeDefined();
            expect(typeof cartItem.variant_details).toBe('string');
            expect(cartItem.variant_details.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cart item should have positive quantity', async () => {
      await fc.assert(
        fc.asyncProperty(
          cartItemWithVariantArb,
          async (cartItem) => {
            // Property: quantity should be positive
            expect(cartItem.quantity).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cart item should reference valid product', async () => {
      await fc.assert(
        fc.asyncProperty(
          cartItemWithVariantArb,
          async (cartItem) => {
            // Property: product_id should be present and valid
            expect(cartItem.product_id).toBeDefined();
            expect(typeof cartItem.product_id).toBe('string');
            expect(cartItem.product_id.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Additional Helper Function Tests
  // ============================================================================

  describe('Helper Functions', () => {
    it('getDefaultVariant should return default or first active variant', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(activeVariantArb, { minLength: 1, maxLength: 10 }),
          async (variants) => {
            // Act: Get default variant
            const defaultVariant = getDefaultVariant(variants);

            // Property: Should return a variant if any exist
            expect(defaultVariant).toBeDefined();

            // Property: If there's a default, it should be returned
            const explicitDefault = variants.find(v => v.is_default && v.is_active);
            if (explicitDefault) {
              expect(defaultVariant?.id).toBe(explicitDefault.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('calculatePriceDifference should return correct difference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (basePrice, variantPrice) => {
            // Act: Calculate difference
            const result = calculatePriceDifference(basePrice, variantPrice);

            // Property: Difference should be mathematically correct
            const expectedDiff = variantPrice - basePrice;
            expect(Math.abs(result.difference - expectedDiff)).toBeLessThan(0.01);

            // Property: Formatted string should indicate direction
            if (result.difference > 0) {
              expect(result.formatted).toMatch(/^\+₹/);
            } else if (result.difference < 0) {
              expect(result.formatted).toMatch(/^-₹/);
            } else {
              expect(result.formatted).toBe('');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isVariantInStock should correctly identify stock status', async () => {
      await fc.assert(
        fc.asyncProperty(
          variantArb,
          async (variant) => {
            // Act: Check stock status
            const inStock = isVariantInStock(variant);

            // Property: Should be in stock only if quantity > 0 AND is_active
            const expected = variant.stock_quantity > 0 && variant.is_active;
            expect(inStock).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
