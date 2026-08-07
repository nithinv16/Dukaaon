# Requirements Document

## Introduction

This specification addresses the duplicate category display issue in the CategoryGrid screen where identical categories appear multiple times, each showing products. The system currently fetches categories from the products table using string-based category fields, but there exists a proper normalized `categories` and `subcategories` table in the database that should be used instead. The duplicate issue stems from using the old string-based approach instead of the proper relational database structure.

## Glossary

- **CategoryGrid**: The React Native component that displays product categories in a grid layout
- **Categories Table**: The normalized database table containing unique categories with IDs, slugs, and metadata
- **Subcategories Table**: The normalized database table containing subcategories linked to parent categories
- **Products Table**: The table containing products with both legacy string-based category fields and new category_id/subcategory_id foreign keys
- **DynamicCategoryService**: The service class that manages fetching categories from the normalized tables
- **Supabase**: The backend database service storing product and category data
- **Translation Service**: The service that translates category names to different languages

## Requirements

### Requirement 1

**User Story:** As a retailer browsing categories, I want to see each category only once in the grid, so that I can efficiently navigate to the products I need without confusion.

#### Acceptance Criteria

1. WHEN the CategoryGrid component loads THEN the system SHALL fetch categories from the `categories` table instead of deriving them from the `products` table
2. WHEN the system fetches categories THEN the system SHALL use the DynamicCategoryService to retrieve normalized category data
3. WHEN the system displays categories THEN the system SHALL show each category exactly once using the unique category ID
4. WHEN the system fetches subcategories THEN the system SHALL query the `subcategories` table using the category_id foreign key
5. WHEN the system filters by location THEN the system SHALL join products using category_id to find available categories in the area

### Requirement 2

**User Story:** As a developer maintaining the app, I want the CategoryGrid to use the proper database architecture, so that category management is consistent across the application.

#### Acceptance Criteria

1. WHEN the CategoryGrid fetches categories THEN the system SHALL use the same DynamicCategoryService used by CategoryCarousel
2. WHEN the system queries for products by category THEN the system SHALL use category_id instead of string-based category matching
3. WHEN the system displays category images THEN the system SHALL use the image_url from the categories table
4. WHEN the system orders categories THEN the system SHALL respect the display_order field from the categories table
5. WHEN the system filters inactive categories THEN the system SHALL only show categories where is_active is true

### Requirement 3

**User Story:** As a user, I want categories to maintain consistent naming and images, so that the browsing experience is uniform across the app.

#### Acceptance Criteria

1. WHEN the system displays a category THEN the system SHALL use the canonical name from the categories table
2. WHEN the system displays a category image THEN the system SHALL use the image_url from the categories table with fallback to local images
3. WHEN the system translates category names THEN the system SHALL translate the canonical name from the categories table
4. WHEN the system navigates to a category THEN the system SHALL use the category slug or ID for routing

### Requirement 4

**User Story:** As a user searching for products, I want search results to show unique categories and subcategories, so that I can find what I need without seeing duplicates.

#### Acceptance Criteria

1. WHEN a user searches for categories THEN the system SHALL search the categories table by name
2. WHEN a user searches for subcategories THEN the system SHALL search the subcategories table by name
3. WHEN search results include categories THEN the system SHALL display each category once using its unique ID
4. WHEN search results include products THEN the system SHALL group them by their category_id to show parent categories
