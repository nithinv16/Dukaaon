// Category and Subcategory Image Mappings
// This file contains fixed image URLs for all categories and subcategories

export const CATEGORY_IMAGES: Record<string, string> = {
  // Main Categories
  'groceries': require('../assets/images/categories/groceries.png'),
  'beverages': require('../assets/images/categories/beverages.png'),
  'snacks': require('../assets/images/categories/snacks.png'),
  'household': require('../assets/images/categories/household.png'),
  'personal-care': require('../assets/images/categories/personal-care.png'),
  'stationery': require('../assets/images/categories/more.png'), // Using 'more' as placeholder
  'packaged-foods': require('../assets/images/categories/snacks.png'), // Similar to snacks
  'home-kitchen': require('../assets/images/categories/household.png'), // Similar to household
  'beauty': require('../assets/images/categories/personal-care.png'), // Similar to personal care
  'health-wellness': require('../assets/images/categories/personal-care.png'), // Similar to personal care
  'more': require('../assets/images/categories/more.png'),
  'default': require('../assets/images/categories/more.png')
};

// Dynamic category mapping for seller-uploaded categories
export const DYNAMIC_CATEGORY_MAPPING: Record<string, string> = {
  // Electronics & Technology
  'electronics': 'more',
  'mobile': 'more',
  'computers': 'more',
  'accessories': 'more',
  
  // Clothing & Fashion
  'clothing': 'more',
  'fashion': 'more',
  'apparel': 'more',
  'footwear': 'more',
  
  // Books & Education
  'books': 'stationery',
  'education': 'stationery',
  'learning': 'stationery',
  
  // Health & Medicine
  'medicines': 'personal-care',
  'pharmacy': 'personal-care',
  'medical': 'personal-care',
  'healthcare': 'personal-care',
  
  // Food Categories
  'fruits': 'groceries',
  'vegetables': 'groceries',
  'dairy-products': 'groceries',
  'frozen-foods': 'groceries',
  'fresh-food': 'groceries',
  'organic': 'groceries',
  'meat': 'groceries',
  'seafood': 'groceries',
  'bakery': 'groceries',
  'confectionery': 'snacks',
  
  // Baby & Mother Care
  'baby-products': 'personal-care',
  'mother-care': 'personal-care',
  'infant-care': 'personal-care',
  
  // Cleaning & Hygiene
  'cleaning-supplies': 'household',
  'hygiene-products': 'personal-care',
  'sanitizers': 'personal-care',
  
  // Toys & Games
  'toys': 'more',
  'games': 'more',
  'sports': 'more',
  
  // Home & Garden
  'furniture': 'household',
  'garden': 'household',
  'tools': 'household',
  'hardware': 'household',
  
  // B2B Specific Categories
  'wholesale-groceries': 'groceries',
  'bulk-snacks': 'snacks',
  'commercial-cleaning': 'household',
  'restaurant-supplies': 'household',
  'retail-packaging': 'household',
  'food-service': 'groceries'
};

// Keywords for semantic category matching
const CATEGORY_KEYWORDS = {
  'groceries': [
    'food', 'grain', 'rice', 'wheat', 'dal', 'grocery', 'fresh', 'organic', 'fruit', 'vegetable', 
    'dairy', 'meat', 'fish', 'milk', 'butter', 'cheese', 'yogurt', 'paneer', 'ghee', 'eggs',
    'flour', 'atta', 'masala', 'spice', 'oil', 'pickle', 'sauce', 'condiment', 'honey',
    'pasta', 'vinegar', 'ketchup', 'mayonnaise', 'jam', 'spread', 'canned', 'frozen'
  ],
  'beverages': [
    'drink', 'juice', 'tea', 'coffee', 'water', 'beverage', 'soda', 'cola', 'milk', 'shake',
    'energy', 'syrup', 'coconut', 'health-drink', 'soft-drink'
  ],
  'snacks': [
    'snack', 'chips', 'biscuit', 'chocolate', 'sweet', 'candy', 'cookie', 'cake', 'pastry',
    'namkeen', 'instant', 'noodle', 'cereal', 'breakfast', 'ready-to-eat', 'cracker',
    'popcorn', 'nuts', 'seeds', 'confectionery'
  ],
  'household': [
    'clean', 'detergent', 'soap', 'home', 'kitchen', 'furniture', 'tool', 'hardware', 'garden',
    'toilet-cleaner', 'floor-cleaner', 'dish-wash', 'fabric-softener', 'freshener', 'repellent',
    'tissue', 'toilet-paper', 'aluminum-foil', 'plastic-bag', 'storage', 'container',
    'appliance', 'cookware', 'crockery', 'cutlery', 'glassware', 'disposable'
  ],
  'personal-care': [
    'care', 'beauty', 'hygiene', 'health', 'cosmetic', 'medicine', 'pharmacy', 'medical', 'wellness',
    'shampoo', 'conditioner', 'hair-oil', 'toothpaste', 'toothbrush', 'mouthwash', 'face-wash',
    'moisturizer', 'sunscreen', 'body-wash', 'deodorant', 'perfume', 'sanitary', 'feminine',
    'baby', 'diaper', 'baby-food', 'baby-oil', 'baby-powder', 'baby-wipe', 'formula',
    'makeup', 'lipstick', 'foundation', 'nail-polish', 'vitamin', 'supplement', 'ayurvedic'
  ],
  'stationery': [
    'pen', 'paper', 'book', 'office', 'school', 'education', 'learning', 'study',
    'pencil', 'notebook', 'file', 'folder', 'calculator', 'art', 'supply'
  ]
};

// Function to find semantic category match
const getSemanticCategoryMatch = (categoryId: string): string | null => {
  const lowerCaseId = categoryId.toLowerCase().replace(/[-_]/g, ' ');
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerCaseId.includes(keyword))) {
      return category;
    }
  }
  
  return null;
};

export const SUBCATEGORY_IMAGES: Record<string, string> = {
  // Groceries Subcategories - Staples & Essentials
  'rice-grains': require('../assets/images/products/rice.jpg'),
  'pulses': require('../assets/images/products/default.jpg'),
  'spices': require('../assets/images/products/default.jpg'),
  'oils': require('../assets/images/products/default.jpg'),
  'atta': require('../assets/images/products/wheat.jpg'),
  'dry-fruits': require('../assets/images/products/default.jpg'),
  'sugar-salt': require('../assets/images/products/default.jpg'),
  'flour-grains': require('../assets/images/products/default.jpg'),
  'masalas': require('../assets/images/products/default.jpg'),
  'condiments': require('../assets/images/products/default.jpg'),

  // Dairy & Fresh Products
  'dairy': require('../assets/images/products/default.jpg'),
  'milk': require('../assets/images/products/default.jpg'),
  'butter': require('../assets/images/products/default.jpg'),
  'cheese': require('../assets/images/products/default.jpg'),
  'yogurt': require('../assets/images/products/default.jpg'),
  'paneer': require('../assets/images/products/default.jpg'),
  'cream': require('../assets/images/products/default.jpg'),
  'ghee': require('../assets/images/products/default.jpg'),
  'eggs': require('../assets/images/products/default.jpg'),

  // Beverages Subcategories
  'soft-drinks': require('../assets/images/products/default.jpg'),
  'juices': require('../assets/images/products/default.jpg'),
  'tea': require('../assets/images/products/default.jpg'),
  'coffee': require('../assets/images/products/default.jpg'),
  'health-drinks': require('../assets/images/products/default.jpg'),
  'water': require('../assets/images/products/default.jpg'),
  'syrups': require('../assets/images/products/default.jpg'),
  'energy-drinks': require('../assets/images/products/default.jpg'),
  'milk-drinks': require('../assets/images/products/default.jpg'),
  'coconut-water': require('../assets/images/products/default.jpg'),

  // Snacks & Packaged Foods
  'chips': require('../assets/images/products/default.jpg'),
  'biscuits': require('../assets/images/products/default.jpg'),
  'namkeen': require('../assets/images/products/default.jpg'),
  'chocolates': require('../assets/images/products/default.jpg'),
  'instant-food': require('../assets/images/products/default.jpg'),
  'instant-noodles': require('../assets/images/products/default.jpg'),
  'noodles': require('../assets/images/products/default.jpg'),
  'breakfast-cereals': require('../assets/images/products/default.jpg'),
  'ready-to-eat': require('../assets/images/products/default.jpg'),
  'cookies': require('../assets/images/products/default.jpg'),
  'crackers': require('../assets/images/products/default.jpg'),
  'popcorn': require('../assets/images/products/default.jpg'),
  'nuts-seeds': require('../assets/images/products/default.jpg'),

  // Packaged Foods & Condiments
  'jams-spreads': require('../assets/images/products/default.jpg'),
  'pickles': require('../assets/images/products/default.jpg'),
  'vegetable-pickle': require('../assets/images/products/default.jpg'),
  'sauces': require('../assets/images/products/default.jpg'),
  'canned-food': require('../assets/images/products/default.jpg'),
  'pasta': require('../assets/images/products/default.jpg'),
  'honey': require('../assets/images/products/default.jpg'),
  'vinegar': require('../assets/images/products/default.jpg'),
  'ketchup': require('../assets/images/products/default.jpg'),
  'mayonnaise': require('../assets/images/products/default.jpg'),

  // Household & Cleaning
  'detergents': require('../assets/images/products/default.jpg'),
  'cleaning': require('../assets/images/products/default.jpg'),
  'toilet-cleaner': require('../assets/images/products/default.jpg'),
  'floor-cleaner': require('../assets/images/products/default.jpg'),
  'dish-wash': require('../assets/images/products/default.jpg'),
  'fabric-softener': require('../assets/images/products/default.jpg'),
  'fresheners': require('../assets/images/products/default.jpg'),
  'repellents': require('../assets/images/products/default.jpg'),
  'pooja': require('../assets/images/products/default.jpg'),
  'paper-goods': require('../assets/images/products/default.jpg'),
  'tissues': require('../assets/images/products/default.jpg'),
  'toilet-paper': require('../assets/images/products/default.jpg'),
  'aluminum-foil': require('../assets/images/products/default.jpg'),
  'plastic-bags': require('../assets/images/products/default.jpg'),

  // Personal Care & Hygiene
  'oral-care': require('../assets/images/products/default.jpg'),
  'toothpaste': require('../assets/images/products/default.jpg'),
  'toothbrush': require('../assets/images/products/default.jpg'),
  'mouthwash': require('../assets/images/products/default.jpg'),
  'hair-care': require('../assets/images/products/default.jpg'),
  'shampoo': require('../assets/images/products/default.jpg'),
  'conditioner': require('../assets/images/products/default.jpg'),
  'hair-oil': require('../assets/images/products/default.jpg'),
  'skin-care': require('../assets/images/products/default.jpg'),
  'soap': require('../assets/images/products/default.jpg'),
  'body-wash': require('../assets/images/products/default.jpg'),
  'face-wash': require('../assets/images/products/default.jpg'),
  'moisturizer': require('../assets/images/products/default.jpg'),
  'sunscreen': require('../assets/images/products/default.jpg'),
  'body-care': require('../assets/images/products/default.jpg'),
  'feminine-care': require('../assets/images/products/default.jpg'),
  'sanitary-pads': require('../assets/images/products/default.jpg'),
  'deos-perfumes': require('../assets/images/products/default.jpg'),
  'deodorant': require('../assets/images/products/default.jpg'),
  'perfume': require('../assets/images/products/default.jpg'),

  // Baby Care & Products
  'baby-care': require('../assets/images/products/default.jpg'),
  'baby-foods': require('../assets/images/products/default.jpg'),
  'baby-formula': require('../assets/images/products/default.jpg'),
  'baby-cereal': require('../assets/images/products/default.jpg'),
  'diapers': require('../assets/images/products/default.jpg'),
  'baby-wipes': require('../assets/images/products/default.jpg'),
  'baby-oil': require('../assets/images/products/default.jpg'),
  'baby-powder': require('../assets/images/products/default.jpg'),
  'baby-shampoo': require('../assets/images/products/default.jpg'),
  'baby-soap': require('../assets/images/products/default.jpg'),
  'feeding-bottles': require('../assets/images/products/default.jpg'),

  // Stationery & Office Supplies
  'writing': require('../assets/images/products/default.jpg'),
  'pens': require('../assets/images/products/default.jpg'),
  'pencils': require('../assets/images/products/default.jpg'),
  'notebooks': require('../assets/images/products/default.jpg'),
  'paper': require('../assets/images/products/default.jpg'),
  'school-supplies': require('../assets/images/products/default.jpg'),
  'office-supplies': require('../assets/images/products/default.jpg'),
  'art-supplies': require('../assets/images/products/default.jpg'),
  'files-folders': require('../assets/images/products/default.jpg'),
  'calculators': require('../assets/images/products/default.jpg'),

  // Home & Kitchen
  'storage': require('../assets/images/products/default.jpg'),
  'kitchen-tools': require('../assets/images/products/default.jpg'),
  'disposables': require('../assets/images/products/default.jpg'),
  'plastic-containers': require('../assets/images/products/default.jpg'),
  'appliances': require('../assets/images/products/default.jpg'),
  'cookware': require('../assets/images/products/default.jpg'),
  'crockery': require('../assets/images/products/default.jpg'),
  'cutlery': require('../assets/images/products/default.jpg'),
  'glassware': require('../assets/images/products/default.jpg'),
  'kitchen-accessories': require('../assets/images/products/default.jpg'),

  // Beauty & Cosmetics
  'makeup': require('../assets/images/products/default.jpg'),
  'lipstick': require('../assets/images/products/default.jpg'),
  'foundation': require('../assets/images/products/default.jpg'),
  'nail-polish': require('../assets/images/products/default.jpg'),
  'hair-products': require('../assets/images/products/default.jpg'),
  'hair-styling': require('../assets/images/products/default.jpg'),
  'skin-products': require('../assets/images/products/default.jpg'),
  'face-cream': require('../assets/images/products/default.jpg'),
  'fragrances': require('../assets/images/products/default.jpg'),
  'mens-grooming': require('../assets/images/products/default.jpg'),
  'beauty-tools': require('../assets/images/products/default.jpg'),

  // Health & Wellness
  'health-supplements': require('../assets/images/products/default.jpg'),
  'vitamins': require('../assets/images/products/default.jpg'),
  'ayurvedic': require('../assets/images/products/default.jpg'),
  'protein-supplements': require('../assets/images/products/default.jpg'),
  'medical-supplies': require('../assets/images/products/default.jpg'),
  'first-aid': require('../assets/images/products/default.jpg'),
  'medicines': require('../assets/images/products/default.jpg'),
  'health-monitors': require('../assets/images/products/default.jpg'),

  // Default fallback
  'default': require('../assets/images/products/default.jpg')
};

// Default product image for when sellers don't upload images
export const DEFAULT_PRODUCT_IMAGE = require('../assets/images/products/dummy_product_image.jpg');

// Enhanced helper function to get category image with dynamic support
export const getCategoryImage = (categoryId: string): any => {
  // 1. Try exact match first
  if (CATEGORY_IMAGES[categoryId]) {
    return CATEGORY_IMAGES[categoryId];
  }
  
  // 2. Try dynamic mapping
  if (DYNAMIC_CATEGORY_MAPPING[categoryId]) {
    return CATEGORY_IMAGES[DYNAMIC_CATEGORY_MAPPING[categoryId]];
  }
  
  // 3. Try semantic matching
  const semanticMatch = getSemanticCategoryMatch(categoryId);
  if (semanticMatch && CATEGORY_IMAGES[semanticMatch]) {
    return CATEGORY_IMAGES[semanticMatch];
  }
  
  // 4. Default fallback
  return CATEGORY_IMAGES['more'];
};

// Helper function for dynamic categories with parent category support
export const getCategoryImageDynamic = (categoryId: string, parentCategory?: string): any => {
  // 1. Try exact match first
  if (CATEGORY_IMAGES[categoryId]) {
    return CATEGORY_IMAGES[categoryId];
  }
  
  // 2. Try parent category if provided
  if (parentCategory && CATEGORY_IMAGES[parentCategory]) {
    return CATEGORY_IMAGES[parentCategory];
  }
  
  // 3. Try dynamic mapping
  if (DYNAMIC_CATEGORY_MAPPING[categoryId]) {
    return CATEGORY_IMAGES[DYNAMIC_CATEGORY_MAPPING[categoryId]];
  }
  
  // 4. Try semantic matching
  const semanticMatch = getSemanticCategoryMatch(categoryId);
  if (semanticMatch && CATEGORY_IMAGES[semanticMatch]) {
    return CATEGORY_IMAGES[semanticMatch];
  }
  
  // 5. Default fallback
  return CATEGORY_IMAGES['more'];
};

// Helper function to get subcategory image
export const getSubcategoryImage = (subcategoryId: string): any => {
  return SUBCATEGORY_IMAGES[subcategoryId] || SUBCATEGORY_IMAGES['default'];
};

// Helper function to get product image with fallback
export const getProductImage = (imageUrl?: string | null): any => {
  if (imageUrl && imageUrl.trim() !== '') {
    return { uri: imageUrl };
  }
  return DEFAULT_PRODUCT_IMAGE;
};

// Helper function to get product image URL with fallback
export const getProductImageUrl = (imageUrl?: string | null): string => {
  if (imageUrl && imageUrl.trim() !== '') {
    return imageUrl;
  }
  // Return a placeholder URL for remote usage
  return 'https://via.placeholder.com/300x300/f0f0f0/999999?text=No+Image';
};

// Helper function to check if a category is dynamically supported
export const isDynamicCategory = (categoryId: string): boolean => {
  return !CATEGORY_IMAGES[categoryId] && (
    DYNAMIC_CATEGORY_MAPPING[categoryId] !== undefined ||
    getSemanticCategoryMatch(categoryId) !== null
  );
};

// Helper function to get the fallback category for a dynamic category
export const getDynamicCategoryFallback = (categoryId: string): string => {
  if (DYNAMIC_CATEGORY_MAPPING[categoryId]) {
    return DYNAMIC_CATEGORY_MAPPING[categoryId];
  }
  
  const semanticMatch = getSemanticCategoryMatch(categoryId);
  if (semanticMatch) {
    return semanticMatch;
  }
  
  return 'more';
};

// Helper function to add new dynamic category mapping (for admin use)
export const addDynamicCategoryMapping = (categoryId: string, fallbackCategory: string): void => {
  if (CATEGORY_IMAGES[fallbackCategory]) {
    DYNAMIC_CATEGORY_MAPPING[categoryId] = fallbackCategory;
  }
};