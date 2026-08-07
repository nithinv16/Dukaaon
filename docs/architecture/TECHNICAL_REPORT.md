# DUKAAON - Technical Implementation Report

**Project Name:** Dukaaon  
**Version:** 1.0.0  
**Platform:** React Native (Expo)  
**Package:** com.sixn8.dukaaon  
**Report Date:** January 10, 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database Structure](#database-structure)
5. [Authentication System](#authentication-system)
6. [Application Structure](#application-structure)
7. [Key Features & Workflows](#key-features--workflows)
8. [Services & Integrations](#services--integrations)
9. [AI & Voice Features](#ai--voice-features)
10. [Security & Performance](#security--performance)
11. [Development & Deployment](#development--deployment)

---

## Executive Summary

Dukaaon is a comprehensive B2B e-commerce platform built using React Native (Expo) that connects wholesalers, manufacturers, and retailers. The application provides a complete marketplace solution with advanced features including AI-powered ordering, voice search, real-time inventory management, location-based seller discovery, and integrated payment processing.

### Key Highlights
- Multi-role user system (Retailer, Wholesaler, Manufacturer)
- AI-powered ordering system with AWS Bedrock
- Voice search and speech recognition (Azure AI)
- Real-time location-based seller discovery
- Advanced inventory management
- Automated order splitting and delivery fee calculation
- Push notifications via Firebase
- Multi-language support with real-time translation

---

## Technology Stack

### Core Framework
- **React Native:** 0.76.9
- **Expo SDK:** 52.0.36
- **Expo Router:** 4.0.21
- **TypeScript:** 5.3.3

### Backend & Database
- **Supabase:** 2.49.8 (PostgreSQL database)
  - URL: https://xcpznnkpjgyrpbvpnvit.supabase.co
- **Firebase:** 18.9.0
  - Authentication
  - Cloud Messaging (Push Notifications)
  - Project: dukaaon

### State Management
- **Zustand:** 5.0.5 (Lightweight state management)
- **AsyncStorage:** 1.23.1 (Persistent local storage)

### UI & Components
- **React Native Paper:** 5.0.0 (Material Design)
- **Expo Linear Gradient:** 14.0.2
- **React Native SVG:** 15.8.0
- **React Native Charts:** 6.12.0
- **React Native Maps:** 1.18.0

### AI & ML Services
- **AWS Bedrock:** 3.901.0
  - AI Agent (Claude/GPT models)
  - API Key: BedrockAPIKey-ybep-at-831926593874
- **Azure OpenAI:** GPT-4o deployment
  - Resource: nithinvthomas96-2178-resource
- **Azure AI Services:**
  - Speech Recognition & Synthesis
  - Computer Vision (OCR)
  - Translator
  - Region: eastus2
- **OpenAI SDK:** 5.12.1 (Fallback)
- **Microsoft Cognitive Services Speech SDK:** 1.45.0

### Location Services
- **Expo Location:** 18.0.10
- **Google Maps API:** AIzaSyC1-SdpmUYDZagQhFkmcsgJHd2YrrdlUSM
- **React Native Maps:** 1.18.0

### Media & Files
- **Expo Image Picker:** 16.0.6
- **Expo Image Manipulator:** 13.0.6
- **Expo File System:** 18.0.12
- **Google Cloud Vision:** 5.2.0 (OCR)

### Payment & Commerce
- Cash on Delivery (COD) - Primary
- Payment configuration system (extensible)

### Networking & Communication
- **Axios:** 1.11.0
- **React Native NetInfo:** 11.4.1
- **Firebase Messaging:** 18.9.0

### Development Tools
- **EAS Build:** Expo Application Services
- **Babel:** 7.20.0
- **Jest:** 29.2.1 (Testing)
- **Webpack:** 5.99.9

### Security & Authentication
- **React Native Keychain:** 10.0.0
- **Expo Crypto:** 14.0.2
- **Crypto-JS:** 4.2.0
- **Firebase Auth:** 18.9.0

### Utilities
- **Lodash:** 4.17.21
- **Date-fns:** 3.6.0
- **UUID:** 11.1.0

---

## Architecture Overview

### Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   React Native App (Expo)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │  State Mgmt  │  │   Services   │      │
│  │  (Screens)   │  │   (Zustand)  │  │  (Business)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
├────────────────────────────┼─────────────────────────────────┤
│                            │                                 │
│  ┌─────────────────────────┴────────────────────────────┐   │
│  │              Integration Layer                        │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │   │
│  │  │Supabase│  │Supabase│  │  AWS   │  │ Azure  │    │   │
│  │  │Auth hook  │   DB   │  │Bedrock │  │   AI   │    │   │
│  │  └────────┘  └────────┘  └────────┘  └────────┘    │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │ Firebase│        │Supabase │        │   AWS   │
   │ Services│        │PostgreSQL        │ Bedrock │
   └─────────┘        └─────────┘        └─────────┘
        │                   │                   │
        │                   │                   │
   Push Notif.          Database            AI Agent
```

### Project Structure

```
dukaaon/
├── app/                        # Expo Router app directory
│   ├── (auth)/                # Authentication screens
│   │   ├── index.tsx          # Role selection
│   │   ├── login.tsx          # Phone login
│   │   ├── otp.tsx            # OTP verification
│   │   ├── kyc.tsx            # KYC flow
│   │   └── language.tsx       # Language selection
│   ├── (main)/                # Main app screens
│   │   ├── home/              # Home screen
│   │   ├── cart/              # Shopping cart
│   │   ├── orders/            # Order management
│   │   ├── profile/           # User profile
│   │   ├── wholesaler/        # Wholesaler features
│   │   ├── retailer/          # Retailer features
│   │   ├── products/          # Product management
│   │   ├── payment/           # Payment methods
│   │   └── screens/           # Shared screens
│   ├── _layout.tsx            # Root layout
│   └── index.tsx              # Entry point
│
├── components/                # Reusable components
│   ├── ai/                    # AI chat components
│   ├── auth/                  # Auth components
│   ├── cart/                  # Cart components
│   ├── common/                # Common UI components
│   └── home/                  # Home components
│
├── services/                  # Business logic services
│   ├── auth/                  # Authentication services
│   ├── supabase/              # Supabase client
│   ├── firebase/              # Firebase services
│   ├── aiAgent/               # AI agent services
│   ├── azureAI/               # Azure AI services
│   ├── voice/                 # Voice services
│   ├── orders/                # Order services
│   ├── payment/               # Payment services
│   └── notifications/         # Notification services
│
├── store/                     # Zustand state stores
│   ├── auth.ts                # Auth state
│   ├── cart.ts                # Cart state
│   └── products.ts            # Products state
│
├── types/                     # TypeScript types
│   ├── auth.ts                # Auth types
│   ├── orders.ts              # Order types
│   └── products.ts            # Product types
│
├── supabase/                  # Database migrations
│   ├── migrations/            # SQL migrations
│   ├── functions/             # Edge functions
│   │   └── sms-hook/          # SMS OTP hook
│   └── config.toml            # Supabase config
│
├── config/                    # Configuration files
│   └── awsBedrock.ts          # AWS Bedrock config
│
├── utils/                     # Utility functions
├── hooks/                     # Custom React hooks
├── constants/                 # App constants
├── theme/                     # Theme configuration
└── i18n/                      # Internationalization

```

---

## Database Structure

### Supabase PostgreSQL Schema

#### 1. **profiles** Table
Core user profile table for all user types.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    phone_number TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'retailer',
    status TEXT DEFAULT 'active',
    business_details JSONB DEFAULT '{}',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_address TEXT,
    language TEXT DEFAULT 'en',
    fcm_token TEXT,
    shop_image_url TEXT,
    profile_image_url TEXT,
    kyc_document_urls JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_location ON profiles(latitude, longitude);
```

**Key Fields:**
- `role`: 'retailer' | 'wholesaler' | 'manufacturer' | 'seller'
- `business_details`: JSONB containing shop name, address, owner details
- `latitude/longitude`: GPS coordinates for location-based search
- `fcm_token`: Firebase Cloud Messaging token for push notifications

#### 2. **seller_details** Table
Extended information for wholesalers and manufacturers.

```sql
CREATE TABLE seller_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id),
    seller_type TEXT NOT NULL,
    business_name TEXT,
    owner_name TEXT,
    location_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    gstin TEXT,
    pan_number TEXT,
    bank_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Fields:**
- `seller_type`: 'wholesaler' | 'manufacturer' | 'distributor'
- `gstin`: GST Identification Number
- `bank_details`: JSONB with account information

#### 3. **products** Table
Product catalog managed by sellers.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES profiles(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    category_id UUID,
    category_name TEXT,
    subcategory TEXT,
    brand TEXT,
    keywords TEXT[],
    status TEXT DEFAULT 'available',
    sku VARCHAR(100),
    barcode VARCHAR(100),
    unit_of_measure TEXT DEFAULT 'piece',
    minimum_stock_level INTEGER DEFAULT 0,
    images TEXT[],
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_name);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_keywords ON products USING GIN(keywords);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
```

**Key Fields:**
- `status`: 'available' | 'out_of_stock' | 'discontinued'
- `unit_of_measure`: 'piece' | 'kg' | 'liter' | 'box' etc.
- `keywords`: Array for fuzzy search
- `images`: Array of image URLs from Supabase Storage

#### 4. **customers** Table
Customer information maintained by sellers.

```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES profiles(id),
    retailer_id UUID REFERENCES profiles(id),
    name VARCHAR(255) NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    business_name TEXT,
    address TEXT,
    city TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    gstin TEXT,
    credit_limit DECIMAL(12,2),
    payment_terms TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5. **orders** Table
Individual orders from buyers to sellers.

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    seller_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID REFERENCES customers(id),
    retailer_id UUID REFERENCES profiles(id),
    user_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'draft',
    order_date TIMESTAMPTZ DEFAULT NOW(),
    expected_delivery_date DATE,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'pending',
    delivery_address JSONB DEFAULT '{}',
    delivery_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_retailer_id ON orders(retailer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
```

**Order Statuses:**
- 'draft' → 'confirmed' → 'processing' → 'shipped' → 'delivered' → 'completed'
- 'cancelled' (can happen at any stage)

**Payment Methods:**
- 'cash' (COD - Cash on Delivery)
- 'credit' (Credit terms)
- 'upi' (Future)
- 'online' (Future)

#### 6. **order_items** Table
Line items within orders.

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(12, 2) NOT NULL,
    fulfilled_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. **master_orders** Table
Aggregates multiple orders from different sellers.

```sql
CREATE TABLE master_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id),
    total_amount DECIMAL(12, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'cod',
    vehicle_type TEXT,
    delivery_distance_km DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 8. **cart_items** Table
Shopping cart for users.

```sql
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    product_id UUID NOT NULL REFERENCES products(id),
    seller_id UUID NOT NULL REFERENCES profiles(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);
```

#### 9. **wishlists** Table
User wishlist for future purchases.

```sql
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    product_id UUID NOT NULL REFERENCES products(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);
```

#### 10. **shared_stock** Table
Shared inventory across sellers.

```sql
CREATE TABLE shared_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    seller_id UUID NOT NULL REFERENCES profiles(id),
    shared_quantity INTEGER NOT NULL,
    price DECIMAL(10, 2),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 11. **delivery_orders** Table
Delivery tracking and management.

```sql
CREATE TABLE delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    batch_id UUID REFERENCES delivery_batches(id),
    delivery_partner_id UUID,
    status TEXT DEFAULT 'pending',
    pickup_time TIMESTAMPTZ,
    delivery_time TIMESTAMPTZ,
    tracking_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 12. **notifications** Table
Push notification tracking.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 13. **payment_config** Table
Payment gateway configuration.

```sql
CREATE TABLE payment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    config_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 14. **user_settings** Table
User preferences and settings.

```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id),
    language TEXT DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT true,
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 15. **ai_chat_sessions** Table
AI conversation history.

```sql
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    session_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Functions

#### 1. Profile Creation Functions
```sql
-- Unified profile creation
create_profile_unified(phone_number, user_role, seller_data)

-- Role-specific functions
create_retailer_profile(phone_number)
create_seller_profile(phone_number, seller_data)
```

#### 2. Order Management Functions
```sql
-- Generate unique order numbers
generate_order_number() → 'ORD20250110XXXX'

-- Calculate order totals
calculate_order_totals(order_id)

-- Get order summary
get_order_summary(seller_id, start_date, end_date)
```

#### 3. Product Management Functions
```sql
-- Update product stock
update_product_stock(product_id, quantity_change, operation)

-- Search products
search_products(seller_id, search_term, category, limit)

-- Get low stock products
get_low_stock_products(seller_id)
```

#### 4. Profile Management Functions
```sql
-- Update profile image
update_profile_image_url(user_id, image_url)

-- Get user profile
get_my_profile() → Returns complete profile with seller_details
```

### Row Level Security (RLS) Policies

All tables have RLS enabled with policies:

1. **profiles**: Users can view/update their own profile
2. **seller_details**: Sellers can manage their details
3. **products**: Sellers manage their products; authenticated users can view active products
4. **orders**: Sellers view their orders; buyers view their purchases
5. **cart_items**: Users manage their own cart
6. **wishlists**: Users manage their own wishlist

---

## Authentication System

### Overview
Dukaaon uses a hybrid authentication system combining:
1. **Firebase Authentication** - Phone number authentication
2. **Supabase Auth** - Session management and authorization
3. **AuthKey.io** - SMS OTP delivery service

### Authentication Flow

```
User Journey:
1. Language Selection → 2. Role Selection → 3. Phone Entry → 
4. OTP Verification → 5. KYC Process → 6. Home Screen

Detailed Flow:
┌────────────────────┐
│  User opens app    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────┐
│  Language Selection    │
│  (Hindi, English, etc) │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│   Role Selection       │
│  - Retailer            │
│  - Wholesaler          │
│  - Manufacturer        │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Phone Number Entry    │
│  +91XXXXXXXXXX         │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Send OTP via          │
│  AuthKey.io Hook       │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  User Enters OTP       │
│  (6-digit code)        │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  authhook verifies OTP │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Create Supabase       │
│  Profile (if new)      │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  KYC Document Upload   │
│  (Role-specific)       │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Store Auth State      │
│  (Zustand + Storage)   │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Navigate to Home      │
└────────────────────────┘
```

### OTP System with AuthKey.io

#### Supabase Edge Function: sms-hook

**Location:** `supabase/functions/sms-hook/index.ts`

**Purpose:** Intercepts Supabase auth OTP requests and sends SMS via AuthKey.io

**Configuration:**
- **AuthKey ID:** 904251f34754cedc
- **Template ID:** 24603 (DLT registered)
- **Sender ID:** AUTHKY
- **API Endpoint:** https://api.authkey.io/request

**Message Format:**
```
Use {OTP} as your OTP to access your Dukaaon, 
OTP is confidential and valid for 5 mins 
This sms sent by authkey.io
```

**Function Logic:**
```typescript
1. Receive webhook from Supabase Auth
2. Extract phone number and OTP
3. Clean phone number (remove +91, keep 10 digits)
4. Validate phone format (10 digits)
5. Prepare AuthKey API request
6. Send SMS via AuthKey API
7. Return success/failure response
```

**Environment Variables:**
```env
AUTHKEY=904251f34754cedc
SEND_SMS_HOOK_SECRETS=<webhook_secret>
```

### Session Management

**Auth Store (Zustand):**
```typescript
// store/auth.ts
interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setProfile: (profile: Profile) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

**Profile Loader Service:**
- Progressive loading with caching (5 min TTL)
- Offline support with cache fallback
- Retry logic with exponential backoff
- Network-aware loading strategy

### KYC Process

#### Role-specific KYC Requirements:

**Retailer KYC:**
- Shop photo
- Owner photo
- Business address verification

**Wholesaler KYC:**
- Business registration documents
- GST certificate
- PAN card
- Bank account details
- Warehouse photos

**Manufacturer KYC:**
- Factory registration
- GST certificate
- Product certifications
- Manufacturing license
- Bank details

**KYC Storage:**
- Documents stored in Supabase Storage
- URLs saved in `profiles.kyc_document_urls` (JSONB)
- Status tracked in profile

---

## Application Structure

### Screen Hierarchy

```
App Structure:
├── Splash Screen (index.tsx)
│
├── Authentication Flow (app/(auth)/)
│   ├── Language Selection
│   ├── Role Selection
│   ├── Login (Phone Entry)
│   ├── OTP Verification
│   └── KYC Screens
│       ├── Retailer KYC
│       ├── Wholesaler KYC
│       └── Manufacturer KYC
│
└── Main App (app/(main)/)
    │
    ├── Retailer Journey
    │   ├── Home Dashboard
    │   ├── Browse Categories
    │   ├── Search Products
    │   ├── Nearby Wholesalers
    │   ├── Wholesaler Details
    │   ├── Product Details
    │   ├── Shopping Cart
    │   ├── Checkout
    │   ├── Order History
    │   ├── Order Tracking
    │   ├── Wishlist
    │   └── Profile
    │
    ├── Wholesaler Journey
    │   ├── Dashboard Analytics
    │   ├── Product Management
    │   │   ├── Product List
    │   │   ├── Add Product
    │   │   ├── Edit Product
    │   │   └── Quick Add
    │   ├── Inventory Management
    │   ├── Order Management
    │   │   ├── Incoming Orders
    │   │   └── Order Details
    │   ├── Customer Management
    │   │   ├── Customer List
    │   │   ├── Customer Details
    │   │   ├── Customer Orders
    │   │   └── Customer Analytics
    │   ├── Delivery Management
    │   ├── Chat with Customers
    │   ├── Analytics
    │   └── Settings
    │
    ├── Manufacturer Journey
    │   ├── (Similar to Wholesaler)
    │   └── Distribution Management
    │
    └── Shared Features
        ├── AI Chat Assistant
        ├── Voice Search
        ├── Phone Order
        ├── Notifications
        ├── Payment Methods
        ├── Profile Settings
        └── Help & Support
```

### Navigation Structure

**Expo Router File-based Routing:**

```typescript
// Root Layout (_layout.tsx)
- Splash screen logic
- Auth state checking
- Navigation setup

// Auth Layout ((auth)/_layout.tsx)
- Stack navigation
- Auth screens only

// Main Layout ((main)/_layout.tsx)
- Tab navigation (Retailer)
- Stack navigation (Wholesaler/Manufacturer)
- Role-based screen access
```

### User Role-Based Views

#### Retailer View
- **Home:** Featured products, nearby sellers, categories
- **Search:** Advanced product search with filters
- **Cart:** Multi-seller cart with distance validation
- **Orders:** Order history and tracking
- **Profile:** Business details, KYC status

#### Wholesaler/Manufacturer View
- **Dashboard:** Sales analytics, order metrics
- **Products:** Inventory management, stock levels
- **Orders:** Incoming orders, fulfillment
- **Customers:** Customer database, order history
- **Analytics:** Sales trends, popular products

---

## Key Features & Workflows

### 1. Product Discovery Workflow

```
User Flow: Finding & Adding Products

Retailer Journey:
┌──────────────────────┐
│   Open App           │
└─────────┬────────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐  ┌────────────┐
│Search  │  │ Browse     │
│Products│  │ Categories │
└───┬────┘  └─────┬──────┘
    │             │
    └─────────────┴─────────────┐
                                │
                                ▼
                    ┌─────────────────────┐
                    │  View Products       │
                    │  with Details        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Add to Cart         │
                    │  (Quantity Select)   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Automatic Distance  │
                    │  Validation (3km)    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Cart Updated        │
                    └─────────────────────┘
```

**Search Features:**
- Text search with autocomplete
- Category and subcategory filtering
- Brand filtering
- Price range filtering
- Sort by price/name/popularity
- Voice search integration

**Location-Based Discovery:**
- Find nearby wholesalers (Haversine formula)
- Distance-based sorting
- Configurable radius (default: 50km)
- Map view with seller locations

### 2. Shopping Cart & Order Workflow

```
Cart to Order Flow:

┌─────────────────────┐
│  Add Items to Cart  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  Distance Validation    │
│  (Max 3km between       │
│   sellers)              │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Review Cart            │
│  - Multiple sellers     │
│  - Quantities           │
│  - Subtotals            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Click "Place Order"    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  System Calculates:     │
│  - Distance to sellers  │
│  - Delivery fees        │
│  - Vehicle type         │
│  - Order splitting      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Create Master Order    │
│  - One master order     │
│  - Multiple sub-orders  │
│  - One per seller       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Delivery Fee Logic:    │
│  - Calculate distances  │
│  - Assign to farthest   │
│  - Based on cart value  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Update Stock Levels    │
│  (When confirmed)       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Send Notifications     │
│  - To buyer             │
│  - To all sellers       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Clear Cart             │
│  Order Success Screen   │
└─────────────────────────┘
```

**Delivery Fee Calculation:**
```typescript
// Haversine Distance Formula
function calculateDistance(lat1, lon1, lat2, lon2): km

// Vehicle Selection
if (cartValue < 5000 || items < 10): 2-wheeler
else if (cartValue < 15000 || items < 30): 3-wheeler  
else: 4-wheeler

// Fee Assignment
- Calculate distance to each seller
- Find farthest seller
- Assign delivery fee to that seller's order
- Other sellers: no delivery fee
```

### 3. Wholesaler Order Management

```
Wholesaler Order Processing:

┌─────────────────────────┐
│  New Order Notification │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  View Order Details     │
│  - Customer info        │
│  - Items ordered        │
│  - Delivery address     │
│  - Payment method       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Update Order Status    │
│  - Confirm              │
│  - Processing           │
│  - Shipped              │
│  - Delivered            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Manage Customer        │
│  - Add to customers DB  │
│  - Credit terms         │
│  - Order history        │
└─────────────────────────┘
```

### 4. AI-Powered Ordering Workflow

```
AI Agent Order Flow:

User: "I need 10kg rice and 5L oil"
           │
           ▼
┌─────────────────────────┐
│  AI Agent Processes     │
│  - Extract products     │
│  - Extract quantities   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Search Products        │
│  - Match "rice"         │
│  - Match "oil"          │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Present Options        │
│  with Prices            │
└──────────┬──────────────┘
           │
User confirms: "Yes, add these"
           │
           ▼
┌─────────────────────────┐
│  Add to Cart            │
│  - Validate distance    │
│  - Check stock          │
└──────────┬──────────────┘
           │
User: "Place order"
           │
           ▼
┌─────────────────────────┐
│  Complete Order         │
│  (Same flow as manual)  │
└─────────────────────────┘
```

---

## Services & Integrations

### 1. Supabase Services

**Location:** `services/supabase/`

**Supabase Client Configuration:**
```typescript
// services/supabase/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
```

**Key Services:**
- **Authentication:** Session management with JWT
- **Database:** Real-time PostgreSQL queries
- **Storage:** Image and document uploads
- **Edge Functions:** SMS OTP hook
- **Real-time:** Order status updates

### 2. Firebase Services

**Location:** `services/firebase/`

**Firebase Configuration:**
```typescript
// Firebase initialization
Project ID: dukaaon
App ID: 1:65500862893:android:6a09ec9c33c6d770032924

Features:
- Phone Authentication
- Cloud Messaging (FCM)
- Analytics (future)
```

**Push Notifications:**
- Order status updates
- New order notifications (for sellers)
- Payment confirmations
- Delivery updates
- Marketing messages

**FCM Token Management:**
```typescript
// Stored in profiles.fcm_token
// Updated on app launch
// Used for targeted notifications
```

### 3. AWS Services

#### AWS Bedrock (AI Agent)

**Location:** `services/aiAgent/bedrockAIService.ts`

**Configuration:**
```typescript

Model: Claude/GPT models
```

**AI Functions:**
- `search_products`: Search with natural language
- `view_product_details`: Get product information
- `get_products_by_category`: Browse categories
- `find_nearby_wholesalers`: Location-based search
- `find_nearby_manufacturers`: Find manufacturers
- `list_sellers`: Get all sellers with filters
- `get_seller_products`: Products from specific seller
- `add_to_cart`: Add items to cart
- `get_cart_items`: View cart contents
- `update_cart_quantity`: Modify quantities
- `remove_from_cart`: Remove items
- `clear_cart`: Empty cart
- `place_order`: Complete order with COD
- `get_order_history`: View past orders
- `get_product_recommendations`: Personalized suggestions

**AI Agent Features:**
- Natural language understanding
- Context-aware responses
- Multi-turn conversations
- Order placement
- Product discovery
- Seller finding

### 4. Azure AI Services

#### Speech Services

**Location:** `services/azureAI/`

**Configuration:**
```typescript
```

**Features:**
- **Speech-to-Text:** Voice search, voice ordering
- **Text-to-Speech:** Voice responses from AI
- **Real-time Recognition:** Continuous listening
- **Multi-language:** Support for Hindi, English, Tamil, etc.

#### Computer Vision (OCR)

**Purpose:** Extract text from images (receipts, documents)

**Configuration:**
```typescript

```

#### Translator Service

**Purpose:** Real-time content translation

**Configuration:**
```typescript

Region: eastus2
Languages: Hindi, English, Tamil, Telugu, Marathi, Bengali, etc.
```

### 5. Google Cloud Services

#### Google Maps API

**Configuration:**
```typescript

```

**Features:**
- Seller location display
- Route calculation
- Distance matrix
- Geocoding
- Places API

#### Google Cloud Vision

**Purpose:** Advanced OCR and image analysis

**Library:** `@google-cloud/vision` v5.2.0

### 6. Payment Services

**Location:** `services/payment/`

**Current Implementation:**
- Cash on Delivery (COD) - Primary
- Payment configuration table for future gateways
- Extensible architecture for UPI, cards, etc.

**Payment Config Table:**
```sql
payment_config:
- gateway_name
- is_active
- config_data (JSONB)
```

### 7. Notification Service

**Location:** `services/notifications/`

**Firebase Cloud Messaging Integration:**
```typescript
// Notification types
- ORDER_PLACED
- ORDER_CONFIRMED
- ORDER_SHIPPED
- ORDER_DELIVERED
- NEW_ORDER (for sellers)
- PAYMENT_RECEIVED
- LOW_STOCK
- PROMOTIONAL
```

**Notification Storage:**
- Stored in `notifications` table
- Read/unread status
- Notification history
- Push notification and in-app

### 8. Location Services

**Location:** `services/maps/`

**Expo Location Features:**
```typescript
// Get current location
getCurrentPositionAsync()

// Watch position changes
watchPositionAsync()

// Reverse geocoding
reverseGeocodeAsync()

// Distance calculation (Haversine)
calculateDistance(lat1, lon1, lat2, lon2)
```

**Distance Validation:**
- Maximum 3km between sellers in cart
- Real-time distance checking
- Location permission handling

### 9. Translation Service

**Location:** `services/translationService.ts`

**Multi-provider Strategy:**
```typescript
Primary: Azure Translator
Fallback: AWS Translate
Cache: Local storage for 24 hours
```

**Supported Languages:**
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Marathi (mr)
- Bengali (bn)
- Gujarati (gu)
- Kannada (kn)
- Malayalam (ml)
- Punjabi (pa)

### 10. Storage Service

**Location:** `services/storage/`

**Supabase Storage:**
- Bucket: `profiles`
- Bucket: `products`
- Bucket: `kyc-documents`
- Public URLs generated
- Image optimization
- File size limits

---

## AI & Voice Features

### AI Ordering System

**Complete Feature Parity with Manual Operations**

#### Architecture

```
┌─────────────────────────────────────────────────┐
│             User Interface Layer                 │
│  - Voice Input (Azure Speech)                   │
│  - Text Input (Chat Interface)                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│          AI Processing Layer                     │
│  - AWS Bedrock (Claude/GPT)                     │
│  - Natural Language Understanding               │
│  - Intent Recognition                           │
│  - Context Management                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│         Function Execution Layer                 │
│  - Product Search                               │
│  - Cart Management                              │
│  - Order Placement                              │
│  - Seller Discovery                             │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│            Database Layer                        │
│  - Supabase PostgreSQL                          │
│  - Real-time Updates                            │
└─────────────────────────────────────────────────┘
```

#### AI Functions Available

**15 Functions with Full CRUD Operations:**

1. **search_products** - Search with filters
2. **view_product_details** - Get detailed info
3. **get_products_by_category** - Browse categories
4. **find_nearby_wholesalers** - Location-based
5. **find_nearby_manufacturers** - Location-based
6. **list_sellers** - All sellers with filters
7. **get_seller_products** - Seller's catalog
8. **add_to_cart** - Add items
9. **get_cart_items** - View cart
10. **update_cart_quantity** - Modify quantities
11. **remove_from_cart** - Remove items
12. **clear_cart** - Empty cart
13. **place_order** - Complete order
14. **get_order_history** - Past orders
15. **get_product_recommendations** - Suggestions

#### Example Conversations

**Example 1: Product Search & Purchase**
```
User: "Find me rice products under ₹100"
AI: "I found 12 rice products under ₹100. Here are the top options:
     1. Basmati Rice 5kg - ₹95
     2. Sona Masoori Rice 5kg - ₹85
     Would you like details on any of these?"

User: "Add the Basmati rice to cart"
AI: "Added Basmati Rice 5kg (₹95) to your cart. 
     Your cart total is now ₹95."

User: "Place order"
AI: "Order placed successfully! 
     Order Number: ORD20250110001
     Total: ₹125 (including ₹30 delivery fee)
     Payment: Cash on Delivery
     Expected delivery: 2-3 business days"
```

**Example 2: Seller Discovery**
```
User: "Show me nearby wholesalers"
AI: "I found 8 wholesalers within 20km:
     1. ABC Traders - 2.5km away - ₹₹₹
     2. XYZ Wholesale - 5km away - ₹₹₹₹
     Would you like to see products from any seller?"

User: "Show products from ABC Traders"
AI: "ABC Traders has 45 products available. 
     Popular items:
     - Wheat Flour 25kg - ₹750
     - Rice 25kg - ₹850
     - Sugar 50kg - ₹2100"
```

### Voice Search Implementation

**Nova Sonic Service Integration**

**Location:** `services/voice/novaSonicService.ts`

**Features:**
- Real-time speech recognition
- Multi-language support
- Continuous listening mode
- Voice command processing
- Text-to-speech responses

**Voice Commands:**
- "Search for [product]"
- "Add [quantity] [product] to cart"
- "Show my cart"
- "Place order"
- "Find nearby sellers"
- "Show order history"

**Azure Speech Integration:**
```typescript
// Speech Recognition
- Continuous recognition
- Real-time transcription
- Language detection
- Noise cancellation

// Speech Synthesis
- Natural voice output
- Multiple voices
- Speech rate control
- SSML support
```

### Enhanced Voice Search Component

**Location:** `components/common/EnhancedVoiceSearch.tsx`

**Features:**
- Visual feedback during listening
- Waveform animation
- Real-time transcription display
- Error handling
- Permission management

---

## Security & Performance

### Security Measures

#### 1. Authentication Security
- JWT tokens with expiration
- Secure token storage (Keychain)
- Session management
- Phone number verification
- OTP expiration (5 minutes)

#### 2. Database Security
- Row Level Security (RLS) enabled
- Role-based access control
- User can only access their data
- Secure API endpoints
- SQL injection prevention

#### 3. API Security
- Environment variables for secrets
- HTTPS only communication
- API key rotation
- Rate limiting (future)
- Request validation

#### 4. Data Privacy
- Encrypted storage
- Secure file uploads
- GDPR compliance ready
- Data anonymization
- Privacy policy implementation

### Performance Optimizations

#### 1. Caching Strategy
```typescript
// Profile caching
Cache Duration: 5 minutes
Storage: AsyncStorage
Strategy: Stale-while-revalidate

// Image caching
Library: Expo Image
Strategy: Disk + Memory cache

// Translation caching
Duration: 24 hours
Strategy: LRU cache
```

#### 2. Database Optimizations
- Proper indexing on all tables
- GIN indexes for array fields
- Composite indexes for common queries
- Query optimization with EXPLAIN
- Connection pooling

#### 3. Network Optimizations
- Retry logic with exponential backoff
- Request batching
- Compression enabled
- CDN for static assets (future)
- Lazy loading of images

#### 4. React Native Optimizations
- Memo and useMemo for expensive computations
- useCallback for function references
- FlatList virtualization
- Image optimization before upload
- Code splitting with dynamic imports

#### 5. Build Optimizations
```javascript
// EAS Build Configuration
- ProGuard enabled (minification)
- Resource shrinking
- Separate APKs per architecture
- Code obfuscation
- Asset compression
```

### Monitoring & Analytics

#### 1. Error Tracking
- Error boundaries in React
- Sentry integration (configured)
- Crash reporting
- Error logging service

#### 2. Performance Monitoring
- Profile load times tracked
- API response times logged
- Screen render performance
- Memory usage monitoring

#### 3. User Analytics
- Screen view tracking
- User flow analysis
- Feature usage metrics
- Conversion tracking

---

## Development & Deployment

### Development Environment

#### Prerequisites
```bash
- Node.js 18+ (LTS)
- npm or yarn
- Expo CLI
- EAS CLI
- Android Studio / Xcode
- Supabase CLI (optional)
```

#### Setup Instructions
```bash
# Clone repository
git clone <repository-url>
cd dukaaon

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Build Configuration

#### EAS Build Setup
```json
// eas.json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### Build Commands
```bash
# Development build
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform android

# Production build
eas build --profile production --platform android

# Submit to Play Store
eas submit --platform android
```

### Deployment Process

#### 1. Pre-deployment Checklist
- [ ] Update version in app.config.js
- [ ] Update versionCode for Android
- [ ] Test all critical paths
- [ ] Verify environment variables
- [ ] Database migrations applied
- [ ] API endpoints verified
- [ ] Push notifications tested

#### 2. Database Migrations
```bash
# Apply migrations
supabase db push

# Rollback if needed
supabase db reset

# Create new migration
supabase migration new <name>
```

#### 3. Deployment Steps
```bash
1. Tag release in Git
2. Build production APK/AAB
3. Test build on devices
4. Submit to Play Store
5. Monitor for issues
6. Prepare rollback plan
```

### Testing Strategy

#### Unit Tests
```bash
# Run tests
npm test

# Coverage report
npm test -- --coverage
```

#### Integration Tests
- API endpoint testing
- Database function testing
- Authentication flow testing
- Order placement testing

#### E2E Tests (Planned)
- User registration flow
- Product search and purchase
- Order management
- Payment processing

---

## API Documentation

### Supabase API Endpoints

#### Authentication
```typescript
POST /auth/v1/signup
POST /auth/v1/verify
POST /auth/v1/token
GET /auth/v1/user
```

#### Products
```typescript
GET /rest/v1/products?select=*&seller_id=eq.<id>
GET /rest/v1/products?select=*&category_name=eq.<category>
POST /rest/v1/products
PATCH /rest/v1/products?id=eq.<id>
DELETE /rest/v1/products?id=eq.<id>
```

#### Orders
```typescript
GET /rest/v1/orders?select=*,order_items(*)
POST /rest/v1/orders
PATCH /rest/v1/orders?id=eq.<id>
```

#### Cart
```typescript
GET /rest/v1/cart_items?select=*,products(*)
POST /rest/v1/cart_items
PATCH /rest/v1/cart_items?id=eq.<id>
DELETE /rest/v1/cart_items?id=eq.<id>
```

### Firebase APIs

#### Authentication
```typescript
// Phone auth
firebase.auth().signInWithPhoneNumber(phoneNumber)
confirmationResult.confirm(code)

// Get current user
firebase.auth().currentUser
```

#### Cloud Messaging
```typescript
// Get FCM token
await messaging().getToken()

// Listen for messages
messaging().onMessage(handler)
```

---

## Conclusion

Dukaaon is a comprehensive B2B e-commerce platform with the following key strengths:

### Technical Excellence
- Modern tech stack with React Native & Expo
- Scalable PostgreSQL database with Supabase
- Advanced AI integration (AWS Bedrock)
- Multi-cloud architecture (AWS, Azure, Firebase, Google Cloud)

### Feature Completeness
- Complete product catalog management
- Advanced order processing with auto-splitting
- Location-based seller discovery
- AI-powered ordering system
- Voice search and ordering
- Multi-language support
- Push notifications

### Business Value
- Connects retailers with wholesalers/manufacturers
- Reduces ordering friction with AI
- Optimizes delivery costs automatically
- Provides analytics and insights
- Scalable for growth

### Future Roadmap
1. Payment gateway integration (UPI, cards)
2. Advanced analytics dashboard
3. Machine learning recommendations
4. WhatsApp integration
5. Inventory forecasting
6. Credit management system
7. Loyalty programs
8. B2B marketplace features

---

**Report Compiled By:** Dukaaon Technical Team  
**Report Version:** 1.0  
**Last Updated:** January 10, 2025  

For questions or clarifications, please contact the development team.
