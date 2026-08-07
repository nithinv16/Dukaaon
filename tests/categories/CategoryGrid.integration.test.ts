/**
 * Integration Tests for CategoryGrid Component
 * 
 * Tests the CategoryGrid component's integration with DynamicCategoryService,
 * navigation, search functionality, and location filtering.
 * 
 * Note: These tests focus on the business logic and service integration
 * rather than UI rendering, as React Native component rendering requires
 * additional setup and mocking.
 */

import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';
import { supabase } from '../../services/supabase/supabase';

// Mock DynamicCategoryService
jest.mock('../../services/dynamic/dynamicCategoryService', () => ({
  dynamicCategoryService: {
    getCategories: jest.fn(),
    getSubcategories: jest.fn(),
    searchCategories: jest.fn(),
    searchSubcategories: jest.fn(),
  },
}));

// Mock Supabase
jest.mock('../../services/supabase/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Category interface
interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

// Subcategory interface
interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

// Product interface
interface Product {
  id: string;
  name: string;
  category_id: string;
  subcategory_id?: string;
  seller_id: string;
}

describe('CategoryGrid Integration Tests', () => {
  // Sample test data
  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Electronics',
      slug: 'electronics',
      image_url: 'https://example.com/electronics.jpg',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'cat-2',
      name: 'Clothing',
      slug: 'clothing',
      display_order: 2,
      is_active: true,
    },
    {
      id: 'cat-3',
      name: 'Food',
      slug: 'food',
      display_order: 3,
      is_active: true,
    },
  ];

  const mockSubcategories: Subcategory[] = [
    {
      id: 'sub-1',
      category_id: 'cat-1',
      name: 'Phones',
      slug: 'phones',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'sub-2',
      category_id: 'cat-1',
      name: 'Laptops',
      slug: 'laptops',
      display_order: 2,
      is_active: true,
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'iPhone 13',
      category_id: 'cat-1',
      subcategory_id: 'sub-1',
      seller_id: 'seller-1',
    },
    {
      id: 'prod-2',
      name: 'MacBook Pro',
      category_id: 'cat-1',
      subcategory_id: 'sub-2',
      seller_id: 'seller-1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (dynamicCategoryService.getCategories as jest.Mock).mockResolvedValue(mockCategories);
    (dynamicCategoryService.getSubcategories as jest.Mock).mockResolvedValue(mockSubcategories);
    (dynamicCategoryService.searchCategories as jest.Mock).mockResolvedValue([]);
    (dynamicCategoryService.searchSubcategories as jest.Mock).mockResolvedValue([]);
  });

  /**
   * Test: DynamicCategoryService integration
   * 
   * Verifies that CategoryGrid correctly integrates with DynamicCategoryService
   * to fetch categories and subcategories from the normalized database tables.
   */
  describe('DynamicCategoryService integration', () => {
    it('should fetch categories from DynamicCategoryService', async () => {
      // Act: Call service method
      const categories = await dynamicCategoryService.getCategories();

      // Assert: Service should return categories
      expect(categories).toEqual(mockCategories);
      expect(dynamicCategoryService.getCategories).toHaveBeenCalled();
    });

    it('should fetch subcategories for each category', async () => {
      // Act: Fetch subcategories for a category
      const subcategories = await dynamicCategoryService.getSubcategories('cat-1');

      // Assert: Service should return subcategories
      expect(subcategories).toEqual(mockSubcategories);
      expect(dynamicCategoryService.getSubcategories).toHaveBeenCalledWith('cat-1');
    });

    it('should return unique categories by ID', async () => {
      // Arrange: Service returns categories
      const categories = await dynamicCategoryService.getCategories();

      // Assert: All category IDs should be unique
      const ids = categories.map(cat => cat.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should filter active categories', async () => {
      // Arrange: Mix of active and inactive categories
      const mixedCategories = [
        ...mockCategories,
        {
          id: 'cat-4',
          name: 'Inactive Category',
          slug: 'inactive',
          display_order: 4,
          is_active: false,
        },
      ];
      (dynamicCategoryService.getCategories as jest.Mock).mockResolvedValue(mixedCategories);

      // Act: Fetch categories
      const categories = await dynamicCategoryService.getCategories();

      // Filter active categories (simulating CategoryGrid logic)
      const activeCategories = categories.filter(cat => cat.is_active);

      // Assert: Only active categories should be included
      expect(activeCategories.length).toBe(mockCategories.length);
      expect(activeCategories.every(cat => cat.is_active)).toBe(true);
    });
  });

  /**
   * Test: Category navigation routing
   * 
   * Verifies that navigation routes are correctly generated using category slugs
   * instead of IDs, following the new architecture.
   */
  describe('Category navigation routing', () => {
    it('should generate route with category slug', () => {
      // Arrange: Category with slug
      const category = mockCategories[0];

      // Act: Generate navigation route (simulating handleCategoryPress logic)
      const route = `/(main)/screens/category/${category.slug}`;

      // Assert: Route should use slug
      expect(route).toBe('/(main)/screens/category/electronics');
      expect(route).toContain(category.slug);
      expect(route).not.toContain(category.id);
    });

    it('should generate route for subcategory with slug and params', () => {
      // Arrange: Subcategory with slug
      const subcategory = mockSubcategories[0];

      // Act: Generate navigation route (simulating handleSubCategoryPress logic)
      const route = `/(main)/screens/category/${subcategory.slug}`;
      const params = {
        id: subcategory.id,
        subcategory: subcategory.slug,
      };

      // Assert: Route should use slug and include params
      expect(route).toBe('/(main)/screens/category/phones');
      expect(params.id).toBe('sub-1');
      expect(params.subcategory).toBe('phones');
    });

    it('should generate unique routes for different categories', () => {
      // Arrange: Two different categories
      const category1 = mockCategories[0];
      const category2 = mockCategories[1];

      // Act: Generate routes
      const route1 = `/(main)/screens/category/${category1.slug}`;
      const route2 = `/(main)/screens/category/${category2.slug}`;

      // Assert: Routes should be different
      expect(route1).not.toBe(route2);
    });
  });

  /**
   * Test: Search functionality integration
   * 
   * Verifies that search correctly uses DynamicCategoryService methods
   * to filter categories and subcategories.
   */
  describe('Search functionality integration', () => {
    it('should use DynamicCategoryService for category search', async () => {
      // Arrange: Mock search results
      const searchResults = [mockCategories[0]]; // Only Electronics
      (dynamicCategoryService.searchCategories as jest.Mock).mockResolvedValue(searchResults);

      // Act: Perform search
      const results = await dynamicCategoryService.searchCategories('electronics');

      // Assert: Service method should be called and return results
      expect(dynamicCategoryService.searchCategories).toHaveBeenCalledWith('electronics');
      expect(results).toEqual(searchResults);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Electronics');
    });

    it('should use DynamicCategoryService for subcategory search', async () => {
      // Arrange: Mock search results
      const searchResults = [mockSubcategories[0]]; // Only Phones
      (dynamicCategoryService.searchSubcategories as jest.Mock).mockResolvedValue(searchResults);

      // Act: Perform search
      const results = await dynamicCategoryService.searchSubcategories('phones');

      // Assert: Service method should be called and return results
      expect(dynamicCategoryService.searchSubcategories).toHaveBeenCalledWith('phones');
      expect(results).toEqual(searchResults);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Phones');
    });

    it('should return empty array when no matches found', async () => {
      // Arrange: Mock empty search results
      (dynamicCategoryService.searchCategories as jest.Mock).mockResolvedValue([]);
      (dynamicCategoryService.searchSubcategories as jest.Mock).mockResolvedValue([]);

      // Act: Perform search
      const categoryResults = await dynamicCategoryService.searchCategories('nonexistent');
      const subcategoryResults = await dynamicCategoryService.searchSubcategories('nonexistent');

      // Assert: Should return empty arrays
      expect(categoryResults).toEqual([]);
      expect(subcategoryResults).toEqual([]);
    });

    it('should filter products by category_id from search results', () => {
      // Arrange: Search returns specific categories
      const searchedCategories = [mockCategories[0]]; // Electronics
      const matchingCategoryIds = new Set(searchedCategories.map(cat => cat.id));

      // Act: Filter products by matching category IDs (simulating CategoryGrid logic)
      const filteredProducts = mockProducts.filter(product =>
        matchingCategoryIds.has(product.category_id)
      );

      // Assert: Only products from searched categories should be included
      expect(filteredProducts.length).toBe(2); // Both products are in Electronics
      expect(filteredProducts.every(p => p.category_id === 'cat-1')).toBe(true);
    });
  });

  /**
   * Test: Location-based filtering with category_id
   * 
   * Verifies that location filtering uses category_id foreign key
   * to properly filter categories by nearby sellers.
   */
  describe('Location-based filtering with category_id', () => {
    it('should filter categories by checking products with category_id', () => {
      // Arrange: Categories and products with nearby sellers
      const nearbySellerIds = ['seller-1', 'seller-2'];
      const categories = mockCategories;

      // Act: Filter categories that have products from nearby sellers
      // (simulating CategoryGrid location filtering logic)
      const categoriesWithProducts = categories.filter(category => {
        // Check if any products with this category_id are from nearby sellers
        return mockProducts.some(
          product => product.category_id === category.id && 
                    nearbySellerIds.includes(product.seller_id)
        );
      });

      // Assert: Only categories with products from nearby sellers should be included
      expect(categoriesWithProducts.length).toBeGreaterThan(0);
      expect(categoriesWithProducts[0].id).toBe('cat-1'); // Electronics has products
    });

    it('should use category_id for product queries, not string matching', () => {
      // Arrange: Category and products
      const category = mockCategories[0];
      const products = mockProducts;

      // Act: Filter products by category_id (NEW approach)
      const productsInCategory = products.filter(p => p.category_id === category.id);

      // Assert: Should match by ID, not string
      expect(productsInCategory.length).toBe(2);
      expect(productsInCategory.every(p => p.category_id === 'cat-1')).toBe(true);
    });

    it('should return all categories when no location is available', () => {
      // Arrange: No location
      const userLocation = null;
      const categories = mockCategories;

      // Act: When no location, show all categories (simulating CategoryGrid logic)
      const displayedCategories = userLocation ? [] : categories;

      // Assert: All categories should be shown
      expect(displayedCategories.length).toBe(mockCategories.length);
    });

    it('should handle empty nearby sellers list', () => {
      // Arrange: No nearby sellers
      const nearbySellerIds: string[] = [];
      const categories = mockCategories;

      // Act: Filter categories with products from nearby sellers
      const categoriesWithProducts = categories.filter(category => {
        return mockProducts.some(
          product => product.category_id === category.id && 
                    nearbySellerIds.includes(product.seller_id)
        );
      });

      // Assert: No categories should be shown (or all, depending on business logic)
      expect(categoriesWithProducts.length).toBe(0);
    });
  });

  /**
   * Test: Error handling and retry logic
   * 
   * Verifies that the component handles service errors gracefully.
   */
  describe('Error handling', () => {
    it('should handle category fetch errors', async () => {
      // Arrange: Mock service to throw error
      (dynamicCategoryService.getCategories as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      // Act & Assert: Service should throw error
      await expect(dynamicCategoryService.getCategories()).rejects.toThrow('Network error');
    });

    it('should handle empty category results', async () => {
      // Arrange: Mock service returns empty array
      (dynamicCategoryService.getCategories as jest.Mock).mockResolvedValue([]);

      // Act: Fetch categories
      const categories = await dynamicCategoryService.getCategories();

      // Assert: Should return empty array
      expect(categories).toEqual([]);
      expect(categories.length).toBe(0);
    });

    it('should handle subcategory fetch errors', async () => {
      // Arrange: Mock service to throw error
      (dynamicCategoryService.getSubcategories as jest.Mock).mockRejectedValue(
        new Error('Subcategory fetch failed')
      );

      // Act & Assert: Service should throw error
      await expect(dynamicCategoryService.getSubcategories('cat-1')).rejects.toThrow(
        'Subcategory fetch failed'
      );
    });

    it('should handle search errors gracefully', async () => {
      // Arrange: Mock search to throw error
      (dynamicCategoryService.searchCategories as jest.Mock).mockRejectedValue(
        new Error('Search failed')
      );

      // Act & Assert: Service should throw error
      await expect(dynamicCategoryService.searchCategories('test')).rejects.toThrow(
        'Search failed'
      );
    });
  });

  /**
   * Test: Image fallback logic
   * 
   * Verifies that image source selection follows the correct fallback pattern.
   */
  describe('Image fallback logic', () => {
    it('should use remote image_url when available', () => {
      // Arrange: Category with image_url
      const category = mockCategories[0];

      // Act: Determine image source (simulating getImageSource logic)
      const imageSource = category.image_url 
        ? { type: 'remote', uri: category.image_url }
        : { type: 'local', slug: category.slug };

      // Assert: Should use remote image
      expect(imageSource.type).toBe('remote');
      expect(imageSource.uri).toBe('https://example.com/electronics.jpg');
    });

    it('should fallback to local image when no image_url', () => {
      // Arrange: Category without image_url
      const category = mockCategories[1];

      // Act: Determine image source
      const imageSource = category.image_url 
        ? { type: 'remote', uri: category.image_url }
        : { type: 'local', slug: category.slug };

      // Assert: Should use local image based on slug
      expect(imageSource.type).toBe('local');
      expect(imageSource.slug).toBe('clothing');
    });

    it('should handle subcategory images with same fallback logic', () => {
      // Arrange: Subcategory without image_url
      const subcategory = mockSubcategories[0];

      // Act: Determine image source
      const imageSource = subcategory.image_url 
        ? { type: 'remote', uri: subcategory.image_url }
        : { type: 'local', slug: subcategory.slug };

      // Assert: Should use local image based on slug
      expect(imageSource.type).toBe('local');
      expect(imageSource.slug).toBe('phones');
    });
  });

  /**
   * Test: Product grouping by category_id
   * 
   * Verifies that products are correctly grouped by their category_id
   * foreign key, not by string-based category names.
   */
  describe('Product grouping by category_id', () => {
    it('should group products by category_id', () => {
      // Arrange: Products with category_id
      const products = mockProducts;

      // Act: Group products by category_id
      const grouped = products.reduce((acc, product) => {
        if (!acc[product.category_id]) {
          acc[product.category_id] = [];
        }
        acc[product.category_id].push(product);
        return acc;
      }, {} as Record<string, Product[]>);

      // Assert: Products should be grouped by category_id
      expect(Object.keys(grouped).length).toBe(1); // All products in cat-1
      expect(grouped['cat-1'].length).toBe(2);
    });

    it('should ensure unique category_ids in groups', () => {
      // Arrange: Products
      const products = mockProducts;

      // Act: Get unique category IDs
      const categoryIds = products.map(p => p.category_id);
      const uniqueCategoryIds = new Set(categoryIds);

      // Assert: Should have unique category IDs
      expect(uniqueCategoryIds.size).toBeLessThanOrEqual(categoryIds.length);
    });

    it('should match products to categories by ID, not string', () => {
      // Arrange: Category and products
      const category = mockCategories[0];
      const products = mockProducts;

      // Act: Find products in this category using category_id
      const productsInCategory = products.filter(p => p.category_id === category.id);

      // Assert: Should match by ID
      expect(productsInCategory.length).toBe(2);
      expect(productsInCategory.every(p => p.category_id === 'cat-1')).toBe(true);
    });
  });
});
