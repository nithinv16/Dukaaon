# Requirements Document

## Introduction

This specification addresses issues in the CategoryGrid screen where category and subcategory names are not displaying correctly. The system needs to fetch categories and subcategories from the normalized database tables and display them with proper translation support, similar to how other screens in the app handle translations.

## Glossary

- **CategoryGrid**: The React Native component that displays product categories in a grid layout on the home screen
- **DynamicCategoryService**: The service class that manages fetching categories from the normalized database tables
- **translateArrayFields**: The utility function that translates array of objects' specified fields to the current language
- **Categories Table**: Normalized database table with unique category records (id, name, slug, etc.)
- **Subcategories Table**: Normalized database table with subcategory records linked to categories via category_id

## Requirements

### Requirement 1

**User Story:** As a retailer browsing the app, I want to see all category names displayed clearly on each card in my selected language, so that I can navigate to the products I need.

#### Acceptance Criteria

1. WHEN the CategoryGrid component loads THEN the system SHALL fetch all categories from the categories table using DynamicCategoryService
2. WHEN categories are fetched THEN the system SHALL translate category names using translateArrayFields with the current language
3. WHEN the CategoryGrid renders a category card THEN the system SHALL display the translated category name
4. WHEN a category name is null or undefined THEN the system SHALL display a fallback text "Category"
5. WHEN the user's language changes THEN the system SHALL re-fetch and re-translate all categories

### Requirement 2

**User Story:** As a retailer browsing the app, I want to see all subcategory names displayed clearly on each card in my selected language, so that I can find specific products within a category.

#### Acceptance Criteria

1. WHEN the CategoryGrid component loads THEN the system SHALL fetch all subcategories from the subcategories table using DynamicCategoryService
2. WHEN subcategories are fetched THEN the system SHALL translate subcategory names using translateArrayFields with the current language
3. WHEN the CategoryGrid renders a subcategory card THEN the system SHALL display the translated subcategory name
4. WHEN a subcategory name is null or undefined THEN the system SHALL display a fallback text "Category"
5. WHEN the user's language changes THEN the system SHALL re-fetch and re-translate all subcategories

### Requirement 3

**User Story:** As a retailer, I want to click on a category or subcategory card and see the products in that category, so that I can browse and purchase items.

#### Acceptance Criteria

1. WHEN a user clicks on a category card THEN the system SHALL navigate to the category detail screen with the category UUID
2. WHEN a user clicks on a subcategory card THEN the system SHALL navigate to the category detail screen with subcategory UUID
3. WHEN the category detail screen receives a category UUID THEN the system SHALL query products using the category_id field
4. WHEN the category detail screen receives a subcategory UUID THEN the system SHALL filter products by subcategory_id
5. WHEN the category detail screen loads THEN the system SHALL display the category name in the header
