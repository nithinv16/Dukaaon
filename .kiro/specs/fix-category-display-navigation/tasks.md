# Implementation Plan

- [x] 1. Fix category name display in CategoryGrid
  - [x] 1.1 Verify categories are being fetched correctly
    - Check that DynamicCategoryService.getCategories() returns data
    - Add console.log to show fetched categories count and names
    - Verify categories have id, name, and slug fields
    - _Requirements: 1.1_

  - [x] 1.2 Verify translation is applied to categories
    - Confirm translateArrayFields is called after fetching categories
    - Confirm 'name' field is included in translation fields array
    - Confirm currentLanguage is passed correctly
    - Add console.log to show translated category names
    - _Requirements: 1.2, 1.5_

  - [x] 1.3 Fix renderItem to display translated names correctly
    - Remove translateCategoryOrSubcategory hook call (causes issues)
    - Use item.name directly (already translated by translateArrayFields)
    - Add fallback: `{item.name || 'Category'}`
    - _Requirements: 1.3, 1.4_

- [x] 2. Fix subcategory name display in CategoryGrid
  - [x] 2.1 Verify subcategories are being fetched correctly
    - Check that DynamicCategoryService.getSubcategories() returns data for each category
    - Add console.log to show fetched subcategories count and names
    - Verify subcategories have id, name, slug, and category_id fields
    - _Requirements: 2.1_

  - [x] 2.2 Verify translation is applied to subcategories
    - Confirm translateArrayFields is called after fetching subcategories
    - Confirm 'name' field is included in translation fields array
    - Confirm currentLanguage is passed correctly
    - Add console.log to show translated subcategory names
    - _Requirements: 2.2, 2.5_

  - [x] 2.3 Ensure renderItem handles subcategories correctly
    - Subcategories should also use item.name directly
    - Same fallback logic as categories
    - _Requirements: 2.3, 2.4_

- [x] 3. Fix navigation when clicking category/subcategory cards
  - [x] 3.1 Update handleCategoryPress to use category ID (UUID)
    - Change from `/(main)/screens/category/${category.slug}` to `/(main)/screens/category/${category.id}`
    - The category.id is a UUID that the detail screen can use for queries
    - Add console.log to show navigation parameters
    - _Requirements: 3.1, 3.3_

  - [x] 3.2 Update handleSubCategoryPress to pass proper parameters
    - Navigate with category_id (UUID) in path
    - Pass subcategory_id as query parameter
    - Change from slug-based to ID-based navigation
    - Add console.log to show navigation parameters
    - _Requirements: 3.2, 3.4_

- [x] 4. Fix category detail screen to handle category IDs
  - [x] 4.1 Update category detail screen to detect category ID vs seller ID
    - Check if the ID parameter is a valid UUID
    - If it's a category UUID, fetch products by category_id
    - If it's a seller UUID, fetch products by seller_id (existing behavior)
    - _Requirements: 3.3_

  - [x] 4.2 Fetch category name for header display
    - When category ID is detected, query categories table to get the name
    - Display the category name in the screen header
    - _Requirements: 3.5_

  - [x] 4.3 Update product query to filter by category_id
    - When category ID is passed, use `.eq('category_id', id)` in the query
    - When subcategory_id is passed, also filter by subcategory_id
    - _Requirements: 3.3, 3.4_

- [x] 5. Test the complete flow
  - [x] 5.1 Test category display
    - Verify all category names are visible
    - Test with different languages (English, Hindi, etc.)
    - Verify fallback text shows for null names

  - [x] 5.2 Test subcategory display
    - Verify all subcategory names are visible
    - Test with different languages
    - Verify fallback text shows for null names

  - [x] 5.3 Test navigation
    - Click on category card and verify products load
    - Click on subcategory card and verify filtered products load
    - Verify category name shows in header of detail screen
    - Verify no UUID errors in console
