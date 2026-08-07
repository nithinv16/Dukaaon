# Design Document

## Overview

This design fixes the CategoryGrid component to properly fetch, translate, and display category and subcategory names. The main issue is that the render function uses `translateCategoryOrSubcategory` hook which may return undefined, when the categories are already translated by `translateArrayFields` during fetch.

## Architecture

### Current Flow (Broken)
```
Fetch categories → translateArrayFields → Store in state → Render with translateCategoryOrSubcategory → May return undefined
```

### Fixed Flow
```
Fetch categories → translateArrayFields → Store in state → Render with item.name directly → Shows translated name
```

## Components and Interfaces

### CategoryGrid Component
**Location:** `components/home/CategoryGrid.tsx`

**Changes:**
1. Remove `translateCategoryOrSubcategory` from renderItem
2. Use `item.name` directly (already translated)
3. Add fallback for null/undefined names
4. Ensure navigation uses category ID

## Implementation Details

### 1. Fix Category Name Display

**Current Code (broken):**
```typescript
const renderItem = ({ item }: { item: Category | SubCategory }) => {
  // ...
  return (
    <Text style={styles.name}>
      {translateCategoryOrSubcategory(item.name, isMainCategory) || 'Category'}
    </Text>
  );
};
```

**Fixed Code:**
```typescript
const renderItem = ({ item }: { item: Category | SubCategory }) => {
  // ...
  return (
    <Text style={styles.name}>
      {item.name || 'Category'}
    </Text>
  );
};
```

**Why this works:**
- Categories are already translated by `translateArrayFields` in `fetchCategoriesFromDatabase`
- Subcategories are already translated by `translateArrayFields` in `fetchSubCategories`
- The `translateCategoryOrSubcategory` hook is redundant and may cause issues

### 2. Translation Flow (Already Working)

The translation is already happening correctly in the fetch functions:

```typescript
// In fetchCategoriesFromDatabase
const translatedCategories = await translateArrayFields(
  allCategories,
  ['name'],
  currentLanguage
);
setCategories(translatedCategories);

// In fetchSubCategories
const translatedSubCategories = await translateArrayFields(
  allSubcategories,
  ['name'],
  currentLanguage
);
setSubCategories(translatedSubCategories);
```

### 3. Navigation Fix

**Current Code:**
```typescript
const handleCategoryPress = (category: Category) => {
  router.push(`/(main)/screens/category/${category.slug}`);
};
```

**Fixed Code:**
```typescript
const handleCategoryPress = (category: Category) => {
  router.push(`/(main)/screens/category/${category.id}`);
};
```

**Why use ID instead of slug:**
- Category detail screen already handles UUIDs
- More reliable for product filtering by category_id

## Error Handling

### Null/Undefined Names
```typescript
<Text style={styles.name}>{item.name || 'Category'}</Text>
```

### Translation Failures
The `translateArrayFields` function already handles failures gracefully by returning original text.

## Testing Strategy

### Manual Testing
1. Open CategoryGrid screen
2. Verify all category names display
3. Change language in settings
4. Verify category names update to new language
5. Click on category card
6. Verify products load correctly
7. Repeat for subcategories

### Debug Logging
Add console.log statements to verify:
- Categories fetched count
- Categories after translation
- Item being rendered
- Navigation parameters
