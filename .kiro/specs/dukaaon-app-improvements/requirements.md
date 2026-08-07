# Requirements Document

## Introduction

This specification addresses four critical improvements for the DukaaOn B2B marketplace app:

1. **Profile Loading Fix** - Resolving the persistent issue where the app fails to restore user sessions after being closed for extended periods (hours/days), incorrectly redirecting authenticated users to the language/login screen.

2. **Product Screen Performance Optimization** - Improving the loading speed of products screen, category screens, and wholesaler/manufacturer product listings to render fast even on slow internet connections.

3. **Product Variants System** - Implementing a comprehensive variant system allowing products to have multiple sizes, weights, flavors, and other attributes within a single product card, integrated with existing Supabase tables without breaking current implementations.

4. **Credit/Loan Payment System** - Building a credit facility enabling retailers to pay wholesalers directly with NBFC-backed credit, including KYC verification and UPI autopay mandate setup.

## Glossary

- **DukaaOn**: The B2B marketplace mobile application connecting wholesalers/distributors to retailers
- **Retailer**: A business user who purchases products from wholesalers through the app
- **Wholesaler/Distributor**: A business user who sells products in bulk to retailers
- **Profile**: User account data stored in Supabase containing role, business details, and authentication state
- **Cold Start**: When the app is opened after being completely closed for an extended period
- **Session**: Authentication state maintained by Supabase for logged-in users
- **ProfileLoader**: The service responsible for fetching and caching user profile data
- **Variant**: A specific configuration of a product (e.g., 500ml bottle, chocolate flavor)
- **Parent Product**: The base product that groups all variants together
- **SKU**: Stock Keeping Unit - unique identifier for each product variant
- **Skeleton Loading**: Placeholder UI elements shown while content is loading
- **Optimistic Rendering**: Displaying cached/placeholder content immediately while fetching fresh data
- **NBFC**: Non-Banking Financial Company - partner providing credit facility
- **UPI Autopay**: Automated payment mandate through Unified Payments Interface
- **KYC**: Know Your Customer - identity verification process required for credit facility

## Requirements

### Requirement 1: Profile Loading on Cold Start

**User Story:** As a logged-in user, I want the app to restore my session correctly when I reopen it after hours or days, so that I don't have to log in again.

#### Acceptance Criteria

1. WHEN the app is opened after being closed for any duration (minutes, hours, or days) AND the user was previously authenticated THEN the DukaaOn app SHALL restore the user session and navigate to the appropriate home screen within 5 seconds
2. WHEN the Supabase session token has expired during the app closure period THEN the DukaaOn app SHALL automatically refresh the session token using the stored refresh token before attempting profile fetch
3. WHEN network connectivity is unavailable during cold start AND cached profile data exists THEN the DukaaOn app SHALL use the cached profile to navigate the user to the home screen
4. WHEN the ProfileLoader fails to fetch profile data within the timeout period THEN the DukaaOn app SHALL retry with exponential backoff up to 3 times before falling back to cached data
5. IF the refresh token is invalid or expired THEN the DukaaOn app SHALL clear all cached authentication data and navigate the user to the login screen with a clear message
6. WHEN profile data is successfully loaded from cache during cold start THEN the DukaaOn app SHALL trigger a background refresh to sync the latest profile data from the server
7. WHEN multiple authentication state checks occur simultaneously during cold start THEN the DukaaOn app SHALL coordinate these checks to prevent race conditions that could cause incorrect navigation

### Requirement 2: Product Screen Performance Optimization

**User Story:** As a retailer, I want the products screen, category screens, and wholesaler/manufacturer product listings to load quickly even on slow internet, so that I can browse products without frustrating delays.

#### Acceptance Criteria

1. WHEN a user opens the products screen or category screen THEN the DukaaOn app SHALL display skeleton loading placeholders immediately (within 100ms) while fetching data
2. WHEN product data is being fetched THEN the DukaaOn app SHALL load and display cached products first, then update with fresh data in the background
3. WHEN navigating from nearby wholesaler/manufacturer cards to their product listings THEN the DukaaOn app SHALL pre-fetch product data during navigation animation to minimize perceived loading time
4. WHEN loading product images THEN the DukaaOn app SHALL use progressive image loading with low-resolution placeholders that upgrade to full resolution
5. WHEN the network connection is slow (2G/3G) THEN the DukaaOn app SHALL reduce the initial product batch size and implement infinite scroll pagination
6. WHEN product data has been previously loaded THEN the DukaaOn app SHALL cache the data locally and serve from cache on subsequent visits with background refresh
7. WHEN displaying product lists THEN the DukaaOn app SHALL implement virtualized/windowed rendering to only render visible items and reduce memory usage
8. WHEN fetching products by category THEN the DukaaOn app SHALL use optimized database queries with proper indexing and limit the initial fetch to essential fields only

### Requirement 3: Product Variants System

**User Story:** As a retailer, I want to view and select different variants (sizes, weights, flavors) of a product within a single product card, so that I can easily compare options and add the right variant to my cart.

#### Acceptance Criteria

1. WHEN a product has multiple size/weight variants (e.g., Mirinda 220ml, 500ml, 1L, 2L) THEN the DukaaOn app SHALL display all variants within a single product card with a variant selector
2. WHEN a product has multiple flavor/type variants (e.g., Smoodh chocolate, hazelnut, vanilla) THEN the DukaaOn app SHALL display variant options as selectable chips or dropdown in the product detail screen
3. WHEN a user selects a different variant THEN the DukaaOn app SHALL update the displayed price, stock availability, and product image to reflect the selected variant
4. WHEN displaying variant options THEN the DukaaOn app SHALL show the price difference between variants (e.g., "+₹20 for 500ml")
5. WHEN a variant is out of stock THEN the DukaaOn app SHALL visually indicate the unavailability while still showing the variant option with "Out of Stock" label
6. WHEN adding a product with variants to cart THEN the DukaaOn app SHALL record the specific variant SKU and display the variant details in the cart
7. WHEN a seller uploads a product THEN the DukaaOn app SHALL provide an interface to define variant groups (size, flavor, color, etc.) and add multiple variants with individual pricing and stock
8. WHEN displaying products in the products list screen THEN the DukaaOn app SHALL show each flavor variant as a separate product card while grouping size variants within the same card
9. WHEN updating the database schema for variants THEN the DukaaOn app SHALL use additive migrations that do not modify or delete existing columns in the products table
10. WHEN existing products without variants are displayed THEN the DukaaOn app SHALL render them normally without variant selectors, maintaining backward compatibility
11. WHEN the variant system is implemented THEN the DukaaOn app SHALL ensure all existing product queries, cart operations, and order flows continue to work without modification

### Requirement 4: Credit/Loan Payment System

**User Story:** As a retailer, I want to pay my wholesalers using credit provided through the app, so that I can manage my cash flow while maintaining good relationships with suppliers.

#### Acceptance Criteria

1. WHEN a retailer navigates to the loans screen THEN the DukaaOn app SHALL display a "Pay to Wholesaler" section showing available credit limit and list of connected wholesalers
2. WHEN a retailer selects a wholesaler for payment THEN the DukaaOn app SHALL display the payment form with amount input, repayment period options (daily, weekly, monthly), and calculated interest
3. WHEN displaying repayment options THEN the DukaaOn app SHALL show the total repayment amount, interest rate, and EMI/daily payment breakdown for each period option
4. WHEN a retailer attempts to use the credit facility AND KYC is not completed THEN the DukaaOn app SHALL redirect to the KYC verification flow with clear instructions
5. WHEN KYC verification is completed THEN the DukaaOn app SHALL update the retailer's credit eligibility status and display the approved credit limit
6. WHEN a retailer confirms a credit payment THEN the DukaaOn app SHALL initiate UPI autopay mandate setup for the chosen repayment schedule
7. WHEN the UPI autopay mandate is successfully set up THEN the DukaaOn app SHALL process the payment to the wholesaler and create a credit record with repayment schedule
8. WHEN displaying active credits THEN the DukaaOn app SHALL show outstanding balance, next payment date, payment history, and option to prepay
9. IF a retailer's KYC is pending or rejected THEN the DukaaOn app SHALL display the KYC status with specific reasons and steps to complete or resubmit verification
10. WHEN calculating interest rates THEN the DukaaOn app SHALL apply the NBFC partner's rate structure based on repayment period (shorter periods have higher rates)
