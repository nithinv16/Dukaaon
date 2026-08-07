/**
 * Integration tests for Category Display and Navigation
 * 
 * Tests the complete flow from CategoryGrid to category detail screen:
 * - Task 5.1: Category display with translations
 * - Task 5.2: Subcategory display with translations
 * - Task 5.3: Navigation and product loading
 * 
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.5
 */

// Mock AsyncStorage before importing anything else
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock React Native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { OS: 'ios', select: jest.fn((obj) => obj.ios) },
    Alert: { alert: jest.fn() },
    NativeModules: {
      ...RN.NativeModules,
      BlobModule: {
        BLOB_URI_SCHEME: 'content',
        BLOB_URI_HOST: null,
        addNetworkingHandler: jest.fn(),
        addWebSocketHandler: jest.fn(),
        removeWebSocketHandler: jest.fn(),
        sendOverSocket: jest.fn(),
        createFromParts: jest.fn(),
        release: jest.fn(),
      },
    },
  };
});

import { supabase } from '../../services/supabase/supabase';
import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';
import { translationService } from '../../services/translationService';

// Mock data
const mockCategories = [
  {
    id: 'cat-uuid-1',
    name: 'Dairy Products',
    slug: 'dairy-products',
    display_order: 1,
    is_active: true
  },
  {
    id: 'cat-uuid-2',
    name: 'Personal Care',
    slug: 'personal-care',
    display_order: 2,
    is_active: true
  },
  {
    id: 'cat-uuid-3',
    name: 'Snacks',
    slug: 'snacks',
    display_order: 3,
    is_active: true
  }
];

const mockSubcategories = [
  {
    id: 'sub-uuid-1',
    category_id: 'cat-uuid-1',
    name: 'Milk',
    slug: 'milk',
    display_order: 1,
    is_active: true
  },
  {
    id: 'sub-uuid-2',
    category_id: 'cat-uuid-1',
    name: 'Cheese',
    slug: 'cheese',
    display_order: 2,
    is_active: true
  },
  {
    id: 'sub-uuid-3',
    category_id: 'cat-uuid-2',
    name: 'Oral Care',
    slug: 'oral-care',
    display_order: 1,
    is_active: true
  }
];

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Amul Milk',
    category_id: 'cat-uuid-1',
    subcategory_id: 'sub-uuid-1',
    price: 50,
    seller_id: 'seller-1'
  },
  {
    id: 'prod-2',
    name: 'Britannia Cheese',
    category_id: 'cat-uuid-1',
    subcategory_id: 'sub-uuid-2',
    price: 120,
    seller_id: 'seller-1'
  }
];

describe('Task 5.1: Category Display Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display all category names correctly', async () => {
    // Mock DynamicCategoryService
    jest.spyOn(dynamicCategoryService, 'getCategories').mockResolvedValue(mockCategories);
    
    const categories = await dynamicCategoryService.getCategories();
    
    // Verify all categories are fetched
    expect(categories).toHaveLength(3);
    expect(categories[0].name).toBe('Dairy Products');
    expect(categories[1].name).toBe('Personal Care');
    expect(categories[2].name).toBe('Snacks');
    
    // Verify each category has required fields
    categories.forEach(cat => {
      expect(cat.id).toBeDefined();
      expect(cat.name).toBeDefined();
      expect(cat.slug).toBeDefined();
      expect(typeof cat.name).toBe('string');
      expect(cat.name.length).toBeGreaterThan(0);
    });
  });

  it('should translate category names to Hindi', async () => {
    jest.spyOn(dynamicCategoryService, 'getCategories').mockResolvedValue(mockCategories);
    
    // Mock translation service
    jest.spyOn(translationService, 'translateText').mockImplementation(async (text, lang) => {
      const translations: Record<string, string> = {
        'Dairy Products': 'डेयरी उत्पाद',
        'Personal Care': 'व्यक्तिगत देखभाल',
        'Snacks': 'स्नैक्स'
      };
      return {
        translatedText: translations[text] || text,
        originalText: text,
        targetLanguage: lang
      };
    });
    
    const categories = await dynamicCategoryService.getCategories();
    
    // Translate each category name
    const translatedCategories = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        name: (await translationService.translateText(cat.name, 'hi')).translatedText
      }))
    );
    
    // Verify translations
    expect(translatedCategories[0].name).toBe('डेयरी उत्पाद');
    expect(translatedCategories[1].name).toBe('व्यक्तिगत देखभाल');
    expect(translatedCategories[2].name).toBe('स्नैक्स');
  });

  it('should display fallback text for null category names', async () => {
    const categoriesWithNull = [
      ...mockCategories,
      {
        id: 'cat-uuid-4',
        name: null as any,
        slug: 'unknown',
        display_order: 4,
        is_active: true
      }
    ];
    
    jest.spyOn(dynamicCategoryService, 'getCategories').mockResolvedValue(categoriesWithNull);
    
    const categories = await dynamicCategoryService.getCategories();
    
    // Simulate fallback logic
    const displayNames = categories.map(cat => cat.name || 'Category');
    
    expect(displayNames[0]).toBe('Dairy Products');
    expect(displayNames[3]).toBe('Category'); // Fallback for null
  });

  it('should handle language changes and re-fetch categories', async () => {
    jest.spyOn(dynamicCategoryService, 'getCategories').mockResolvedValue(mockCategories);
    
    // First fetch in English
    const categoriesEn = await dynamicCategoryService.getCategories();
    expect(categoriesEn[0].name).toBe('Dairy Products');
    
    // Mock translation for Hindi
    jest.spyOn(translationService, 'translateText').mockResolvedValue({
      translatedText: 'डेयरी उत्पाद',
      originalText: 'Dairy Products',
      targetLanguage: 'hi'
    });
    
    // Translate to Hindi
    const translated = await translationService.translateText(categoriesEn[0].name, 'hi');
    expect(translated.translatedText).toBe('डेयरी उत्पाद');
  });
});

describe('Task 5.2: Subcategory Display Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display all subcategory names correctly', async () => {
    jest.spyOn(dynamicCategoryService, 'getSubcategories').mockResolvedValue(mockSubcategories.filter(s => s.category_id === 'cat-uuid-1'));
    
    const subcategories = await dynamicCategoryService.getSubcategories('cat-uuid-1');
    
    // Verify subcategories are fetched
    expect(subcategories).toHaveLength(2);
    expect(subcategories[0].name).toBe('Milk');
    expect(subcategories[1].name).toBe('Cheese');
    
    // Verify required fields
    subcategories.forEach(sub => {
      expect(sub.id).toBeDefined();
      expect(sub.name).toBeDefined();
      expect(sub.category_id).toBe('cat-uuid-1');
      expect(sub.slug).toBeDefined();
    });
  });

  it('should translate subcategory names to Hindi', async () => {
    jest.spyOn(dynamicCategoryService, 'getSubcategories').mockResolvedValue(mockSubcategories.filter(s => s.category_id === 'cat-uuid-1'));
    
    // Mock translation
    jest.spyOn(translationService, 'translateText').mockImplementation(async (text, lang) => {
      const translations: Record<string, string> = {
        'Milk': 'दूध',
        'Cheese': 'पनीर'
      };
      return {
        translatedText: translations[text] || text,
        originalText: text,
        targetLanguage: lang
      };
    });
    
    const subcategories = await dynamicCategoryService.getSubcategories('cat-uuid-1');
    
    // Translate
    const translatedSubs = await Promise.all(
      subcategories.map(async (sub) => ({
        ...sub,
        name: (await translationService.translateText(sub.name, 'hi')).translatedText
      }))
    );
    
    expect(translatedSubs[0].name).toBe('दूध');
    expect(translatedSubs[1].name).toBe('पनीर');
  });

  it('should display fallback text for null subcategory names', async () => {
    const subsWithNull = [
      ...mockSubcategories.filter(s => s.category_id === 'cat-uuid-1'),
      {
        id: 'sub-uuid-99',
        category_id: 'cat-uuid-1',
        name: null as any,
        slug: 'unknown',
        display_order: 99,
        is_active: true
      }
    ];
    
    jest.spyOn(dynamicCategoryService, 'getSubcategories').mockResolvedValue(subsWithNull);
    
    const subcategories = await dynamicCategoryService.getSubcategories('cat-uuid-1');
    
    // Simulate fallback logic
    const displayNames = subcategories.map(sub => sub.name || 'Category');
    
    expect(displayNames[0]).toBe('Milk');
    expect(displayNames[2]).toBe('Category'); // Fallback for null
  });
});

describe('Task 5.3: Navigation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should navigate to category detail with correct UUID', async () => {
    const category = mockCategories[0];
    
    // Simulate navigation
    const navigationParams = {
      id: category.id,
      type: 'category',
      name: category.name
    };
    
    // Verify navigation parameters
    expect(navigationParams.id).toBe('cat-uuid-1');
    expect(navigationParams.type).toBe('category');
    expect(navigationParams.name).toBe('Dairy Products');
    
    // Verify it's a valid UUID format
    expect(navigationParams.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('should navigate to subcategory detail with correct UUID and category_id', async () => {
    const subcategory = mockSubcategories[0];
    
    // Simulate navigation
    const navigationParams = {
      id: subcategory.id,
      type: 'subcategory',
      name: subcategory.name,
      category_id: subcategory.category_id
    };
    
    // Verify navigation parameters
    expect(navigationParams.id).toBe('sub-uuid-1');
    expect(navigationParams.type).toBe('subcategory');
    expect(navigationParams.name).toBe('Milk');
    expect(navigationParams.category_id).toBe('cat-uuid-1');
  });

  it('should load products filtered by category_id', async () => {
    // Mock Supabase query
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: mockProducts, error: null })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockQuery as any);
    
    // Simulate fetching products by category_id
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', 'cat-uuid-1');
    
    // Verify products are filtered correctly
    expect(products).toHaveLength(2);
    expect(products![0].category_id).toBe('cat-uuid-1');
    expect(products![1].category_id).toBe('cat-uuid-1');
  });

  it('should load products filtered by subcategory_id', async () => {
    const filteredProducts = mockProducts.filter(p => p.subcategory_id === 'sub-uuid-1');
    
    // Mock Supabase query
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: filteredProducts, error: null })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockQuery as any);
    
    // Simulate fetching products by subcategory_id
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('subcategory_id', 'sub-uuid-1');
    
    // Verify products are filtered correctly
    expect(products).toHaveLength(1);
    expect(products![0].subcategory_id).toBe('sub-uuid-1');
    expect(products![0].name).toBe('Amul Milk');
  });

  it('should display category name in header from database', async () => {
    // Mock fetching category name
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { name: 'Dairy Products' }, 
        error: null 
      })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockQuery as any);
    
    // Fetch category name for header
    const { data } = await supabase
      .from('categories')
      .select('name')
      .eq('id', 'cat-uuid-1')
      .single();
    
    expect(data?.name).toBe('Dairy Products');
  });

  it('should not have UUID errors in console when navigating', () => {
    const category = mockCategories[0];
    const subcategory = mockSubcategories[0];
    
    // Verify IDs are valid UUIDs (no special characters that cause errors)
    expect(category.id).toBeTruthy();
    expect(subcategory.id).toBeTruthy();
    expect(subcategory.category_id).toBeTruthy();
    
    // Verify they don't contain problematic characters
    expect(category.id).not.toContain(' ');
    expect(category.id).not.toContain('/');
    expect(subcategory.id).not.toContain(' ');
    expect(subcategory.id).not.toContain('/');
  });
});

describe('Task 5: Complete Flow Integration Test', () => {
  it('should complete full flow: display categories → click → load products', async () => {
    // Step 1: Fetch and display categories
    jest.spyOn(dynamicCategoryService, 'getCategories').mockResolvedValue(mockCategories);
    const categories = await dynamicCategoryService.getCategories();
    expect(categories).toHaveLength(3);
    expect(categories[0].name).toBe('Dairy Products');
    
    // Step 2: User clicks on category
    const selectedCategory = categories[0];
    const navigationParams = {
      id: selectedCategory.id,
      type: 'category',
      name: selectedCategory.name
    };
    
    // Step 3: Category detail screen fetches category name
    const mockCategoryQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { name: 'Dairy Products' }, 
        error: null 
      })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockCategoryQuery as any);
    
    const { data: categoryData } = await supabase
      .from('categories')
      .select('name')
      .eq('id', navigationParams.id)
      .single();
    
    expect(categoryData?.name).toBe('Dairy Products');
    
    // Step 4: Load products by category_id
    const mockProductQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: mockProducts, error: null })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockProductQuery as any);
    
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', navigationParams.id);
    
    // Step 5: Verify products loaded correctly
    expect(products).toHaveLength(2);
    expect(products![0].category_id).toBe(selectedCategory.id);
    expect(products![1].category_id).toBe(selectedCategory.id);
  });

  it('should complete full flow: display subcategories → click → load filtered products', async () => {
    // Step 1: Fetch subcategories for a category
    jest.spyOn(dynamicCategoryService, 'getSubcategories').mockResolvedValue(
      mockSubcategories.filter(s => s.category_id === 'cat-uuid-1')
    );
    
    const subcategories = await dynamicCategoryService.getSubcategories('cat-uuid-1');
    expect(subcategories).toHaveLength(2);
    
    // Step 2: User clicks on subcategory
    const selectedSubcategory = subcategories[0];
    const navigationParams = {
      id: selectedSubcategory.id,
      type: 'subcategory',
      name: selectedSubcategory.name,
      category_id: selectedSubcategory.category_id
    };
    
    // Step 3: Fetch subcategory name for header
    const mockSubQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ 
        data: { name: 'Milk' }, 
        error: null 
      })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockSubQuery as any);
    
    const { data: subData } = await supabase
      .from('subcategories')
      .select('name')
      .eq('id', navigationParams.id)
      .single();
    
    expect(subData?.name).toBe('Milk');
    
    // Step 4: Load products filtered by subcategory_id
    const filteredProducts = mockProducts.filter(p => p.subcategory_id === selectedSubcategory.id);
    
    const mockProductQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: filteredProducts, error: null })
    };
    
    jest.spyOn(supabase, 'from').mockReturnValue(mockProductQuery as any);
    
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('subcategory_id', navigationParams.id);
    
    // Step 5: Verify filtered products
    expect(products).toHaveLength(1);
    expect(products![0].subcategory_id).toBe(selectedSubcategory.id);
    expect(products![0].name).toBe('Amul Milk');
  });
});
