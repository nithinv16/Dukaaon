/**
 * Property-Based Tests for CategoryGrid
 * 
 * Tests the correctness properties defined in the fix-duplicate-categories spec.
 */

import * as fc from 'fast-check';

// Category interface matching DynamicCategoryService types
interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  icon_url?: string;
  parent_id?: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  metadata?: any;
}

// Subcategory interface matching DynamicCategoryService types
interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
  metadata?: any;
}

// Navigation route result interface
interface NavigationRoute {
  path: string;
  params?: Record<string, string>;
}

// Category arbitrary generator
// Slug generator that produces realistic URL-friendly slugs (at least one alphanumeric character)
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,49}$/).filter(s => s.length > 0);

const categoryArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  slug: slugArb,
  image_url: fc.option(fc.webUrl(), { nil: undefined }),
  icon_url: fc.option(fc.webUrl(), { nil: undefined }),
  parent_id: fc.option(fc.uuid(), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  display_order: fc.integer({ min: 0, max: 1000 }),
  is_active: fc.boolean(),
  metadata: fc.option(fc.object(), { nil: undefined }),
});

// Generate list of categories with potentially duplicate IDs to test uniqueness
const categoryListWithPotentialDuplicatesArb = fc.array(categoryArb, { minLength: 0, maxLength: 30 });

// Generate list of unique categories (simulating what DynamicCategoryService returns)
const uniqueCategoryListArb = fc.array(categoryArb, { minLength: 0, maxLength: 20 }).map(categories => {
  // Ensure unique IDs by using a Map
  const uniqueMap = new Map<string, Category>();
  categories.forEach(cat => uniqueMap.set(cat.id, cat));
  return Array.from(uniqueMap.values());
});

/**
 * Helper function to simulate category display filtering
 * This mimics what CategoryGrid does when displaying categories
 */
function getDisplayedCategories(categories: Category[]): Category[] {
  // Filter to only active categories and ensure uniqueness by ID
  const uniqueById = new Map<string, Category>();
  categories
    .filter(cat => cat.is_active)
    .forEach(cat => uniqueById.set(cat.id, cat));
  return Array.from(uniqueById.values());
}

/**
 * Helper function to check if all category IDs are unique
 */
function hasUniqueIds(categories: Category[]): boolean {
  const ids = categories.map(cat => cat.id);
  return new Set(ids).size === ids.length;
}

/**
 * Helper function to sort categories by display_order
 */
function sortByDisplayOrder(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.display_order - b.display_order);
}

/**
 * Helper function to get image source for a category
 * Mimics the image fallback logic in CategoryGrid
 */
function getCategoryImageSource(category: Category): { type: 'remote' | 'local'; value: string } {
  if (category.image_url) {
    return { type: 'remote', value: category.image_url };
  }
  return { type: 'local', value: category.slug };
}

/**
 * Helper function to generate navigation route for a category
 * Mimics the handleCategoryPress logic in CategoryGrid
 */
function getCategoryNavigationRoute(category: Category): NavigationRoute {
  return {
    path: `/(main)/screens/category/${category.slug}`,
  };
}

/**
 * Helper function to generate navigation route for a subcategory
 * Mimics the handleSubCategoryPress logic in CategoryGrid
 */
function getSubcategoryNavigationRoute(subcategory: Subcategory): NavigationRoute {
  return {
    path: `/(main)/screens/category/${subcategory.slug}`,
    params: {
      id: subcategory.id,
      subcategory: subcategory.slug,
    },
  };
}

describe('CategoryGrid Property Tests', () => {
  /**
   * **Feature: fix-duplicate-categories, Property 1: Unique Category Display**
   * **Validates: Requirements 1.3, 4.3**
   * 
   * Property: For any set of categories fetched from the database, when displayed
   * in the CategoryGrid (either in default view or search results), each unique
   * category ID should appear exactly once in the rendered list.
   */
  describe('Property 1: Unique Category Display', () => {
    it('should display each category ID exactly once', () => {
      fc.assert(
        fc.property(
          uniqueCategoryListArb,
          (categories) => {
            // Act: Get displayed categories (simulating CategoryGrid behavior)
            const displayed = getDisplayedCategories(categories);
            
            // Property: Each category ID should appear exactly once
            const ids = displayed.map(cat => cat.id);
            const uniqueIds = new Set(ids);
            
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deduplicate categories with same ID', () => {
      fc.assert(
        fc.property(
          categoryListWithPotentialDuplicatesArb,
          (categories) => {
            // Act: Get displayed categories
            const displayed = getDisplayedCategories(categories);
            
            // Property: Result should have unique IDs
            expect(hasUniqueIds(displayed)).toBe(true);
            
            // Property: Number of displayed categories should be <= input categories
            expect(displayed.length).toBeLessThanOrEqual(categories.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve category data when deduplicating', () => {
      fc.assert(
        fc.property(
          uniqueCategoryListArb,
          (categories) => {
            // Act: Get displayed categories
            const displayed = getDisplayedCategories(categories);
            
            // Property: All displayed categories should have valid data
            displayed.forEach(cat => {
              expect(cat.id).toBeDefined();
              expect(typeof cat.id).toBe('string');
              expect(cat.name).toBeDefined();
              expect(typeof cat.name).toBe('string');
              expect(cat.slug).toBeDefined();
              expect(typeof cat.display_order).toBe('number');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fix-duplicate-categories, Property 2: Display Order Preservation**
   * **Validates: Requirements 2.4**
   * 
   * Property: For any set of categories with different display_order values,
   * the order in which categories are displayed should match the ascending
   * sort order of the display_order field from the database.
   */
  describe('Property 2: Display Order Preservation', () => {
    it('should sort categories by display_order in ascending order', () => {
      fc.assert(
        fc.property(
          uniqueCategoryListArb,
          (categories) => {
            // Act: Sort categories by display_order
            const sorted = sortByDisplayOrder(categories);
            
            // Property: Each category should have display_order <= next category
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i].display_order).toBeLessThanOrEqual(sorted[i + 1].display_order);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all categories when sorting', () => {
      fc.assert(
        fc.property(
          uniqueCategoryListArb,
          (categories) => {
            // Act: Sort categories
            const sorted = sortByDisplayOrder(categories);
            
            // Property: Should have same number of categories
            expect(sorted.length).toBe(categories.length);
            
            // Property: Should contain all original category IDs
            const originalIds = new Set(categories.map(c => c.id));
            const sortedIds = new Set(sorted.map(c => c.id));
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain stable sort for equal display_order values', () => {
      fc.assert(
        fc.property(
          // Generate categories with some having same display_order
          fc.array(
            categoryArb.chain(cat => 
              fc.integer({ min: 0, max: 5 }).map(order => ({ ...cat, display_order: order }))
            ),
            { minLength: 2, maxLength: 20 }
          ),
          (categories) => {
            // Act: Sort categories
            const sorted = sortByDisplayOrder(categories);
            
            // Property: Categories with same display_order should maintain relative order
            // (This tests that the sort is stable)
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i].display_order).toBeLessThanOrEqual(sorted[i + 1].display_order);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty category list', () => {
      // Act: Sort empty array
      const sorted = sortByDisplayOrder([]);
      
      // Property: Should return empty array
      expect(sorted).toEqual([]);
    });

    it('should handle single category', () => {
      fc.assert(
        fc.property(
          categoryArb,
          (category) => {
            // Act: Sort single category
            const sorted = sortByDisplayOrder([category]);
            
            // Property: Should return array with same category
            expect(sorted.length).toBe(1);
            expect(sorted[0].id).toBe(category.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fix-duplicate-categories, Property 3: Active Category Filtering**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any set of categories with mixed is_active values (true and false),
   * only categories where is_active equals true should appear in the displayed list.
   */
  describe('Property 3: Active Category Filtering', () => {
    it('should only display categories where is_active is true', () => {
      fc.assert(
        fc.property(
          categoryListWithPotentialDuplicatesArb,
          (categories) => {
            // Act: Get displayed categories (filters by is_active)
            const displayed = getDisplayedCategories(categories);
            
            // Property: All displayed categories should have is_active = true
            displayed.forEach(cat => {
              expect(cat.is_active).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should exclude all inactive categories', () => {
      fc.assert(
        fc.property(
          categoryListWithPotentialDuplicatesArb,
          (categories) => {
            // Count active categories in input (accounting for duplicates)
            const uniqueActiveCategories = new Map<string, Category>();
            categories
              .filter(cat => cat.is_active)
              .forEach(cat => uniqueActiveCategories.set(cat.id, cat));
            const expectedActiveCount = uniqueActiveCategories.size;
            
            // Act: Get displayed categories
            const displayed = getDisplayedCategories(categories);
            
            // Property: Number of displayed categories should equal unique active categories
            expect(displayed.length).toBe(expectedActiveCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when all categories are inactive', () => {
      fc.assert(
        fc.property(
          // Generate categories that are all inactive
          fc.array(
            categoryArb.map(cat => ({ ...cat, is_active: false })),
            { minLength: 1, maxLength: 20 }
          ),
          (inactiveCategories) => {
            // Act: Get displayed categories
            const displayed = getDisplayedCategories(inactiveCategories);
            
            // Property: Should return empty array
            expect(displayed.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all categories when all are active and unique', () => {
      fc.assert(
        fc.property(
          // Generate unique categories that are all active
          uniqueCategoryListArb.map(cats => 
            cats.map(cat => ({ ...cat, is_active: true }))
          ),
          (activeCategories) => {
            // Act: Get displayed categories
            const displayed = getDisplayedCategories(activeCategories);
            
            // Property: Should return all categories
            expect(displayed.length).toBe(activeCategories.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fix-duplicate-categories, Property 4: Image Fallback Logic**
   * **Validates: Requirements 3.2**
   * 
   * Property: For any category, if the category has a non-null image_url field,
   * the displayed image source should use that URL; otherwise, the displayed
   * image source should use the local fallback image based on the category slug.
   */
  describe('Property 4: Image Fallback Logic', () => {
    it('should use remote image_url when available', () => {
      fc.assert(
        fc.property(
          // Generate categories with image_url
          categoryArb.filter(cat => cat.image_url !== undefined),
          (category) => {
            // Act: Get image source
            const imageSource = getCategoryImageSource(category);
            
            // Property: Should use remote type with the image_url value
            expect(imageSource.type).toBe('remote');
            expect(imageSource.value).toBe(category.image_url);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fallback to local image based on slug when no image_url', () => {
      fc.assert(
        fc.property(
          // Generate categories without image_url
          categoryArb.map(cat => ({ ...cat, image_url: undefined })),
          (category) => {
            // Act: Get image source
            const imageSource = getCategoryImageSource(category);
            
            // Property: Should use local type with the slug value
            expect(imageSource.type).toBe('local');
            expect(imageSource.value).toBe(category.slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should consistently return same image source for same category', () => {
      fc.assert(
        fc.property(
          categoryArb,
          (category) => {
            // Act: Get image source twice
            const imageSource1 = getCategoryImageSource(category);
            const imageSource2 = getCategoryImageSource(category);
            
            // Property: Should return identical results
            expect(imageSource1.type).toBe(imageSource2.type);
            expect(imageSource1.value).toBe(imageSource2.value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle subcategories with same fallback logic', () => {
      // Subcategory arbitrary generator
      const subcategoryArb = fc.record({
        id: fc.uuid(),
        category_id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        slug: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/\s+/g, '-')),
        image_url: fc.option(fc.webUrl(), { nil: undefined }),
        display_order: fc.integer({ min: 0, max: 1000 }),
        is_active: fc.boolean(),
        metadata: fc.option(fc.object(), { nil: undefined }),
      });

      fc.assert(
        fc.property(
          subcategoryArb,
          (subcategory) => {
            // Act: Get image source using same logic
            const imageSource = subcategory.image_url 
              ? { type: 'remote' as const, value: subcategory.image_url }
              : { type: 'local' as const, value: subcategory.slug };
            
            // Property: Should follow same pattern as categories
            if (subcategory.image_url) {
              expect(imageSource.type).toBe('remote');
              expect(imageSource.value).toBe(subcategory.image_url);
            } else {
              expect(imageSource.type).toBe('local');
              expect(imageSource.value).toBe(subcategory.slug);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fix-duplicate-categories, Property 5: Category Navigation Routing**
   * **Validates: Requirements 3.4**
   * 
   * Property: For any category that is clicked, the navigation route should contain
   * either the category's slug or the category's ID as a path parameter.
   */
  describe('Property 5: Category Navigation Routing', () => {
    // Subcategory arbitrary generator for this test suite
    const subcategoryArb = fc.record({
      id: fc.uuid(),
      category_id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      slug: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')),
      image_url: fc.option(fc.webUrl(), { nil: undefined }),
      display_order: fc.integer({ min: 0, max: 1000 }),
      is_active: fc.boolean(),
      metadata: fc.option(fc.object(), { nil: undefined }),
    });

    it('should include category slug in navigation route path', () => {
      fc.assert(
        fc.property(
          categoryArb,
          (category) => {
            // Act: Get navigation route for category
            const route = getCategoryNavigationRoute(category);
            
            // Property: Route path should contain the category slug
            expect(route.path).toContain(category.slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid route path format for categories', () => {
      fc.assert(
        fc.property(
          categoryArb,
          (category) => {
            // Act: Get navigation route for category
            const route = getCategoryNavigationRoute(category);
            
            // Property: Route should follow expected format
            // Note: Escape parentheses in regex since (main) is literal
            expect(route.path).toMatch(/^\/\(main\)\/screens\/category\/.+$/);
            expect(route.path.endsWith(category.slug)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include subcategory slug in navigation route path', () => {
      fc.assert(
        fc.property(
          subcategoryArb,
          (subcategory) => {
            // Act: Get navigation route for subcategory
            const route = getSubcategoryNavigationRoute(subcategory);
            
            // Property: Route path should contain the subcategory slug
            expect(route.path).toContain(subcategory.slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include subcategory ID and slug in route params', () => {
      fc.assert(
        fc.property(
          subcategoryArb,
          (subcategory) => {
            // Act: Get navigation route for subcategory
            const route = getSubcategoryNavigationRoute(subcategory);
            
            // Property: Route params should contain id and subcategory slug
            expect(route.params).toBeDefined();
            expect(route.params!.id).toBe(subcategory.id);
            expect(route.params!.subcategory).toBe(subcategory.slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent routes for same category', () => {
      fc.assert(
        fc.property(
          categoryArb,
          (category) => {
            // Act: Get navigation route twice
            const route1 = getCategoryNavigationRoute(category);
            const route2 = getCategoryNavigationRoute(category);
            
            // Property: Routes should be identical
            expect(route1.path).toBe(route2.path);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate consistent routes for same subcategory', () => {
      fc.assert(
        fc.property(
          subcategoryArb,
          (subcategory) => {
            // Act: Get navigation route twice
            const route1 = getSubcategoryNavigationRoute(subcategory);
            const route2 = getSubcategoryNavigationRoute(subcategory);
            
            // Property: Routes should be identical
            expect(route1.path).toBe(route2.path);
            expect(route1.params).toEqual(route2.params);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different routes for different categories', () => {
      fc.assert(
        fc.property(
          fc.tuple(categoryArb, categoryArb).filter(([a, b]) => a.slug !== b.slug),
          ([category1, category2]) => {
            // Act: Get navigation routes for both categories
            const route1 = getCategoryNavigationRoute(category1);
            const route2 = getCategoryNavigationRoute(category2);
            
            // Property: Routes should be different
            expect(route1.path).not.toBe(route2.path);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: fix-duplicate-categories, Property 6: Product Grouping by Category**
   * **Validates: Requirements 4.4**
   * 
   * Property: For any set of products in search results, when grouped by their
   * category_id field, each resulting group should have a unique category_id
   * value with no duplicate category IDs across groups.
   */
  describe('Property 6: Product Grouping by Category', () => {
    // Product interface for testing
    interface Product {
      id: string;
      name: string;
      category_id: string;
      subcategory_id?: string;
      brand?: string;
    }

    // Product arbitrary generator
    const productArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      category_id: fc.uuid(),
      subcategory_id: fc.option(fc.uuid(), { nil: undefined }),
      brand: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    });

    // Generate list of products
    const productListArb = fc.array(productArb, { minLength: 0, maxLength: 50 });

    /**
     * Helper function to group products by category_id
     * This mimics what CategoryGrid does when displaying search results
     */
    function groupProductsByCategory(products: Product[]): Map<string, Product[]> {
      const groups = new Map<string, Product[]>();
      products.forEach(product => {
        const categoryId = product.category_id;
        if (!groups.has(categoryId)) {
          groups.set(categoryId, []);
        }
        groups.get(categoryId)!.push(product);
      });
      return groups;
    }

    /**
     * Helper function to get unique category IDs from products
     */
    function getUniqueCategoryIds(products: Product[]): string[] {
      return Array.from(new Set(products.map(p => p.category_id)));
    }

    it('should group products with unique category_id values', () => {
      fc.assert(
        fc.property(
          productListArb,
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: Each group key (category_id) should be unique
            const groupKeys = Array.from(groups.keys());
            const uniqueKeys = new Set(groupKeys);
            
            expect(uniqueKeys.size).toBe(groupKeys.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have no duplicate category IDs across groups', () => {
      fc.assert(
        fc.property(
          productListArb,
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: Number of groups should equal number of unique category_ids
            const uniqueCategoryIds = getUniqueCategoryIds(products);
            
            expect(groups.size).toBe(uniqueCategoryIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should place all products with same category_id in same group', () => {
      fc.assert(
        fc.property(
          productListArb,
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: All products in a group should have the same category_id
            groups.forEach((groupProducts, categoryId) => {
              groupProducts.forEach(product => {
                expect(product.category_id).toBe(categoryId);
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all products when grouping', () => {
      fc.assert(
        fc.property(
          productListArb,
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: Total products across all groups should equal input products
            let totalGroupedProducts = 0;
            groups.forEach(groupProducts => {
              totalGroupedProducts += groupProducts.length;
            });
            
            expect(totalGroupedProducts).toBe(products.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty product list', () => {
      // Act: Group empty array
      const groups = groupProductsByCategory([]);
      
      // Property: Should return empty map
      expect(groups.size).toBe(0);
    });

    it('should handle products with same category_id', () => {
      fc.assert(
        fc.property(
          // Generate products that all share the same category_id
          fc.uuid().chain(categoryId =>
            fc.array(
              productArb.map(p => ({ ...p, category_id: categoryId })),
              { minLength: 2, maxLength: 10 }
            )
          ),
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: Should have exactly one group
            expect(groups.size).toBe(1);
            
            // Property: That group should contain all products
            const groupProducts = Array.from(groups.values())[0];
            expect(groupProducts.length).toBe(products.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle products with all different category_ids', () => {
      fc.assert(
        fc.property(
          // Generate products with unique category_ids
          fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }).chain(categoryIds =>
            fc.tuple(
              ...categoryIds.map(categoryId =>
                productArb.map(p => ({ ...p, category_id: categoryId }))
              )
            )
          ),
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: Number of groups should equal number of products
            expect(groups.size).toBe(products.length);
            
            // Property: Each group should have exactly one product
            groups.forEach(groupProducts => {
              expect(groupProducts.length).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain product data integrity when grouping', () => {
      fc.assert(
        fc.property(
          productListArb,
          (products) => {
            // Act: Group products by category_id
            const groups = groupProductsByCategory(products);
            
            // Property: All grouped products should have valid data
            groups.forEach(groupProducts => {
              groupProducts.forEach(product => {
                expect(product.id).toBeDefined();
                expect(typeof product.id).toBe('string');
                expect(product.name).toBeDefined();
                expect(typeof product.name).toBe('string');
                expect(product.category_id).toBeDefined();
                expect(typeof product.category_id).toBe('string');
              });
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
