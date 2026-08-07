# Design Document

## Overview

This design refactors the CategoryGrid component to use the normalized `categories` and `subcategories` database tables instead of deriving categories from the `products` table. This eliminates duplicate categories caused by inconsistent string-based category names in the products table and aligns CategoryGrid with the proper database architecture already used by other components like CategoryCarousel.

## Architecture

### Current Architecture (Problem)
```
CategoryGrid
  ↓
  Queries products table directly
  ↓
  Extracts unique category strings (with duplicates due to casing)
  ↓
  Displays categories
```

### New Architecture (Solution)
```
CategoryGrid
  ↓
  Uses DynamicCategoryService
  ↓
  Queries categories table (normalized, unique by ID)
  ↓
  Queries subcategories table (linked by category_id)
  ↓
  Filters by location using category_id joins
  ↓
  Displays categories
```

## Components and Interfaces

### Modified Components

#### CategoryGrid Component
**Location:** `components/home/CategoryGrid.tsx`

**Changes:**
1. Import and use `dynamicCategoryService` instead of direct Supabase queries
2. Replace `fetchCategoriesFromDatabase()` to use `dynamicCategoryService.getCategories()`
3. Replace `fetchSubCategories()` to use `dynamicCategoryService.getSubcategories()`
4. Update location filtering to query products by `category_id` instead of string matching
5. Update search functionality to use category IDs for matching
6. Update navigation to use category slugs or IDs

**New Dependencies:**
```typescript
import { dynamicCategoryService } from '../../services/dynamic/dynamicCategoryService';
```

### Existing Services (No Changes Required)

#### DynamicCategoryService
**Location:** `services/dynamic/dynamicCategoryService.ts`

This service already provides all necessary methods:
- `getCategories()` - Fetch all active categories
- `getSubcategories(categoryId)` - Fetch subcategories for a category
- `searchCategories(query)` - Search categories by name
- `getCategoriesWithProductCount()` - Get categories with product counts

## Data Models

### Category Interface (Already Defined)
```typescript
interface Category {
  id: string;              // UUID from database
  name: string;            // Canonical category name
  slug: string;            // URL-friendly identifier
  image_url?: string;      // Remote image URL
  icon_url?: string;       // Optional icon
  parent_id?: string;      // For hierarchical categories
  description?: string;    // Category description
  display_order: number;   // Sort order
  is_active: boolean;      // Active status
  metadata?: any;          // Additional data
}
```

### Subcategory Interface (Already Defined)
```typescript
interface Subcategory {
  id: string;              // UUID from database
  category_id: string;     // Foreign key to categories
  name: string;            // Subcategory name
  slug: string;            // URL-friendly identifier
  image_url?: string;      // Remote image URL
  display_order: number;   // Sort order
  is_active: boolean;      // Active status
  metadata?: any;          // Additional data
}
```

### Updated CategoryGrid State
```typescript
// Remove isDynamic and fallbackCategory fields (no longer needed)
const [categories, setCategories] = useState<Category[]>([]);
const [subCategories, setSubCategories] = useState<Subcategory[]>([]);
```

## Implementation Details

### 1. Fetch Categories from Normalized Table

**Old Approach:**
```typescript
const { data: productsData, error } = await supabase
  .from('products')
  .select('category')
  .not('category', 'is', null);

const uniqueCategories = Array.from(new Set(
  productsData.map(item => item.category).filter(Boolean)
));
```

**New Approach:**
```typescript
const categories = await dynamicCategoryService.getCategories();
// Categories are already unique by ID, no deduplication needed
```

### 2. Fetch Subcategories with Parent Relationship

**Old Approach:**
```typescript
const { data: productsData } = await supabase
  .from('products')
  .select('subcategory, category')
  .not('subcategory', 'is', null);

const uniqueSubCategories = Array.from(new Set(
  productsData.map(item => item.subcategory).filter(Boolean)
));
```

**New Approach:**
```typescript
// Get all categories first
const categories = await dynamicCategoryService.getCategories();

// Get subcategories for each category
const allSubcategories = [];
for (const category of categories) {
  const subs = await dynamicCategoryService.getSubcategories(category.id);
  allSubcategories.push(...subs);
}
```

### 3. Location-Based Filtering

**Old Approach:**
```typescript
// Filter products by nearby sellers
query = query.in('seller_id', nearbySellerIds);

// Then extract categories from filtered products
const uniqueCategories = Array.from(new Set(
  productsData.map(item => item.category)
));
```

**New Approach:**
```typescript
// Get all categories
const allCategories = await dynamicCategoryService.getCategories();

// For each category, check if there are products from nearby sellers
const categoriesWithProducts = await Promise.all(
  allCategories.map(async (category) => {
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', category.id)
      .in('seller_id', nearbySellerIds);
    
    return count > 0 ? category : null;
  })
);

const filteredCategories = categoriesWithProducts.filter(Boolean);
```

### 4. Search Implementation

**Old Approach:**
```typescript
const filteredCats = categories.filter(category =>
  category.name && category.name.toLowerCase().includes(query)
);
```

**New Approach:**
```typescript
// Use service's search method
const searchResults = await dynamicCategoryService.searchCategories(query);
setFilteredCategories(searchResults);
```

### 5. Navigation Updates

**Old Approach:**
```typescript
const handleCategoryPress = (categoryId: string) => {
  router.push(`/(main)/screens/category/${categoryId}`);
};
```

**New Approach:**
```typescript
const handleCategoryPress = (category: Category) => {
  // Use slug for cleaner URLs
  router.push(`/(main)/screens/category/${category.slug}`);
};
```

### 6. Image Handling

**Old Approach:**
```typescript
const image = await getCategoryImageForDisplay(categoryName, categoryName, null);
```

**New Approach:**
```typescript
// Use image_url from database, fallback to local images
const imageSource = category.image_url 
  ? { uri: category.image_url }
  : getCategoryImage(category.slug);
```

## Error Handling

### Database Query Failures
```typescript
try {
  const categories = await dynamicCategoryService.getCategories();
  setCategories(categories);
} catch (error) {
  console.error('Error fetching categories:', error);
  // Service returns cached data automatically
  // Show user-friendly error message
  Alert.alert('Error', 'Unable to load categories. Please try again.');
}
```

### Empty Results
```typescript
if (categories.length === 0) {
  // Show empty state
  return (
    <View style={styles.emptyState}>
      <Text>No categories available</Text>
      <Button onPress={() => fetchCategories(true)}>Retry</Button>
    </View>
  );
}
```

### Location Service Unavailable
```typescript
if (!userLocation) {
  // Show all categories without location filtering
  const allCategories = await dynamicCategoryService.getCategories();
  setCategories(allCategories);
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unique Category Display
*For any* set of categories fetched from the database, when displayed in the CategoryGrid (either in default view or search results), each unique category ID should appear exactly once in the rendered list.
**Validates: Requirements 1.3, 4.3**

### Property 2: Display Order Preservation
*For any* set of categories with different display_order values, the order in which categories are displayed should match the ascending sort order of the display_order field from the database.
**Validates: Requirements 2.4**

### Property 3: Active Category Filtering
*For any* set of categories with mixed is_active values (true and false), only categories where is_active equals true should appear in the displayed list.
**Validates: Requirements 2.5**

### Property 4: Image Fallback Logic
*For any* category, if the category has a non-null image_url field, the displayed image source should use that URL; otherwise, the displayed image source should use the local fallback image based on the category slug.
**Validates: Requirements 3.2**

### Property 5: Category Navigation Routing
*For any* category that is clicked, the navigation route should contain either the category's slug or the category's ID as a path parameter.
**Validates: Requirements 3.4**

### Property 6: Product Grouping by Category
*For any* set of products in search results, when grouped by their category_id field, each resulting group should have a unique category_id value with no duplicate category IDs across groups.
**Validates: Requirements 4.4**

## Testing Strategy

### Unit Tests
1. Test category fetching from DynamicCategoryService
2. Test subcategory fetching with valid category IDs
3. Test location filtering logic
4. Test search functionality with various queries
5. Test image URL handling (remote vs local)
6. Test navigation with category slugs

### Integration Tests
1. Test CategoryGrid renders categories from database
2. Test clicking a category navigates to correct route
3. Test search filters categories correctly
4. Test location filter shows only nearby categories
5. Test translation works with database category names

### Manual Testing Checklist
1. Verify no duplicate categories appear in the grid
2. Verify each category shows correct product count
3. Verify category images load correctly
4. Verify search returns unique results
5. Verify location filtering works
6. Verify navigation to category detail works
7. Verify translations display correctly

## Migration Considerations

### Database State
- The `categories` and `subcategories` tables must be populated
- Products should have `category_id` and `subcategory_id` fields populated
- If migration hasn't been run, use `dynamicCategoryService.migrateOldCategories()`

### Backward Compatibility
- Keep old string-based `category` and `subcategory` fields in products table for now
- Category detail screens may need updates to handle category IDs/slugs
- Search functionality in other components may need similar updates

### Performance
- DynamicCategoryService includes caching (10-minute cache duration)
- AsyncStorage used for offline access
- Consider adding loading states for better UX

## Rollout Plan

1. **Phase 1:** Update CategoryGrid to use DynamicCategoryService
2. **Phase 2:** Test thoroughly in development
3. **Phase 3:** Run database migration if not already done
4. **Phase 4:** Deploy to staging and verify no duplicates
5. **Phase 5:** Monitor production for any issues
6. **Phase 6:** Update other components using string-based categories

## Success Metrics

- Zero duplicate categories displayed in CategoryGrid
- Category load time < 500ms (with caching)
- Search results return in < 300ms
- No increase in error rates
- Consistent category display across all screens
