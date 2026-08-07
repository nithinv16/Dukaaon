# Implementation Plan

- [x] 1. Refactor CategoryGrid to use DynamicCategoryService




  - [x] 1.1 Import DynamicCategoryService and update type definitions


    - Add import for `dynamicCategoryService` from `services/dynamic/dynamicCategoryService`
    - Update Category and SubCategory interfaces to match the service's types
    - Remove `isDynamic` and `fallbackCategory` fields from local interfaces
    - _Requirements: 1.2, 2.1_


  - [x] 1.2 Replace fetchCategoriesFromDatabase with service call

    - Replace direct Supabase query with `dynamicCategoryService.getCategories()`
    - Remove manual deduplication logic (service returns unique categories)
    - Remove fallback to default categories (service handles this)
    - Update state setting to use service response directly
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Write property test for unique category display


    - **Property 1: Unique Category Display**
    - **Validates: Requirements 1.3, 4.3**

  - [x] 1.4 Replace fetchSubCategories with service call


    - Get all categories first using `dynamicCategoryService.getCategories()`
    - For each category, fetch subcategories using `dynamicCategoryService.getSubcategories(categoryId)`
    - Flatten the results into a single subcategories array
    - Update state with the combined subcategories
    - _Requirements: 1.4_


  - [x] 1.5 Update location-based filtering logic

    - Fetch all categories from service first
    - For each category, query products table using `category_id` field
    - Filter to only include products from nearby sellers
    - Keep only categories that have products from nearby sellers
    - _Requirements: 1.5, 2.2_


  - [x] 1.6 Write property test for active category filtering

    - **Property 3: Active Category Filtering**
    - **Validates: Requirements 2.5**
- [x] 2. Update image handling and display logic




- [ ] 2. Update image handling and display logic


  - [x] 2.1 Modify image source logic to use database image_url

    - Check if category has `image_url` field from database
    - If image_url exists, use `{ uri: category.image_url }`
    - If no image_url, fallback to `getCategoryImage(category.slug)`
    - Update renderItem function to handle both remote and local images
    - _Requirements: 2.3, 3.2_


  - [x] 2.2 Write property test for image fallback logic

    - **Property 4: Image Fallback Logic**
    - **Validates: Requirements 3.2**

  - [x] 2.3 Update category display to use canonical names


    - Use `category.name` from database directly
    - Remove any manual name formatting or normalization
    - Ensure translation service receives the canonical name
    - _Requirements: 3.1, 3.3_

  - [x] 2.4 Write property test for display order preservation


    - **Property 2: Display Order Preservation**
    - **Validates: Requirements 2.4**

- [x] 3. Update navigation and routing





  - [x] 3.1 Modify handleCategoryPress to use category slug


    - Change parameter from `categoryId: string` to `category: Category`
    - Use `category.slug` for the route parameter
    - Update route to: `/(main)/screens/category/${category.slug}`
    - _Requirements: 3.4_


  - [x] 3.2 Update handleSubCategoryPress to use subcategory slug

    - Change parameter to accept full subcategory object
    - Use `subcategory.slug` for routing
    - Update route construction to use slug
    - _Requirements: 3.4_

  - [x] 3.3 Write property test for category navigation routing


    - **Property 5: Category Navigation Routing**
    - **Validates: Requirements 3.4**


  - [x] 3.4 Update renderItem to pass full category object to handlers

    - Change `onPress={() => handleCategoryPress(item.id)}` to pass full item
    - Update both category and subcategory press handlers
    - _Requirements: 3.4_

- [-] 4. Update search functionality


  - [x] 4.1 Replace category search with service method


    - Use `dynamicCategoryService.searchCategories(query)` for category search
    - Remove manual filtering logic for categories
    - Update filteredCategories state with service results
    - _Requirements: 4.1_


  - [x] 4.2 Implement subcategory search using service

    - Create a method to search subcategories across all categories
    - Use `dynamicCategoryService.getSubcategories()` for each category
    - Filter subcategories by name matching the search query
    - _Requirements: 4.2_


  - [x] 4.3 Update product search to use category_id

    - Modify product filtering to match by `category_id` instead of string category
    - Update the belongsToMatchingCategory logic to compare category IDs
    - Update the belongsToMatchingSubcategory logic to compare subcategory IDs
    - _Requirements: 4.4_

  - [x] 4.4 Write property test for product grouping by category






    - **Property 6: Product Grouping by Category**
    - **Validates: Requirements 4.4**

- [x] 5. Add error handling and loading states




  - [x] 5.1 Add try-catch blocks for service calls


    - Wrap all `dynamicCategoryService` calls in try-catch
    - Log errors with descriptive messages
    - Show user-friendly error alerts when fetches fail
    - _Requirements: 1.1, 1.2_


  - [ ] 5.2 Handle empty category results
    - Check if categories array is empty after fetch
    - Display empty state UI with retry button
    - Provide helpful message to user
    - _Requirements: 1.1_


  - [ ] 5.3 Handle location service unavailable
    - Check if userLocation is null
    - If no location, show all categories without filtering
    - Add UI indicator that location filtering is disabled
    - _Requirements: 1.5_

- [ ] 6. Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.

-

- [x] 7. Clean up and optimize



  - [x] 7.1 Remove unused imports and functions


    - Remove direct Supabase imports if no longer needed
    - Remove `getCategoryImageForDisplay` function if replaced
    - Remove manual deduplication helper functions
    - Clean up unused state variables


  - [x] 7.2 Add code comments for clarity

    - Document why DynamicCategoryService is used
    - Add comments explaining the category_id vs string-based approach
    - Document the image fallback logic

  - [x] 7.3 Write integration tests for CategoryGrid


    - Test that CategoryGrid renders without duplicates
    - Test that clicking categories navigates correctly
    - Test that search filters work properly
    - Test that location filtering works

- [x] 8. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
