# Design Document: DukaaOn Website Redesign

## Overview

The DukaaOn website will be a modern, full-stack web application built using Next.js, React, TypeScript, and Supabase. The design emphasizes a clean, minimalist aesthetic with sophisticated graphics and smooth animations, inspired by contemporary B2B platforms like Vista Energy. The website serves multiple purposes: showcasing the platform to investors, onboarding retailers/wholesalers/manufacturers, and providing a marketplace for discovering local sellers with location-based filtering.

## Architecture

### Technology Stack

**Frontend:**
- Next.js 14 (App Router) - Server-side rendering and optimal performance
- React 18 - Component-based UI
- TypeScript - Type safety and better developer experience
- Tailwind CSS - Utility-first styling with custom design system
- Framer Motion - Smooth animations and transitions
- React Hook Form - Form handling and validation
- Leaflet/Mapbox - Interactive maps for seller locations

**Backend:**
- Next.js API Routes - Serverless API endpoints
- Supabase - PostgreSQL database (existing from root app)
- Supabase Storage - Image and asset storage (existing from root app)

**Geolocation:**
- Browser Geolocation API - Primary location detection
- IP Geolocation API (fallback) - When browser permission denied
- Haversine formula - Distance calculation between coordinates

**Deployment:**
- Vercel - Hosting and CI/CD
- Supabase Cloud - Database and backend services

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Next.js Frontend (React + TypeScript)        │ │
│  │  - Pages (Home, About, Marketplace, Seller Profile)    │ │
│  │  - Components (Hero, Features, SellerCard, InquiryForm)│ │
│  │  - Hooks (useGeolocation, useSellerData)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  - /api/sellers - Get sellers by location                   │
│  - /api/inquiries - Submit inquiry                          │
│  - /api/contact - Submit contact form                       │
│  - /api/geolocation - IP-based location fallback            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database (Existing from Root App)          │ │
│  │  - sellers table (existing)                            │ │
│  │  - products table (existing)                           │ │
│  │  - enquiry_messages table (NEW - only this)            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storage Buckets                                       │ │
│  │  - seller-images                                       │ │
│  │  - product-images                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Page Structure

The website will follow a multi-page architecture:

1. **Home Page** (`/`)
   - Hero section with animated graphics
   - Value proposition overview
   - Key features showcase
   - Stakeholder benefits
   - Call-to-action sections

2. **About Page** (`/about`)
   - Company story and mission
   - Team information
   - Problem statement and solution
   - Market opportunity

3. **Marketplace Page** (`/marketplace`)
   - Location-based seller listings
   - Filter and search functionality
   - Map view of sellers
   - Category filters

4. **Seller Profile Page** (`/seller/[id]`)
   - Detailed seller information
   - Product gallery
   - Enquire details form
   - Location map

5. **Contact Page** (`/contact`)
   - Contact form
   - Company contact information
   - Office locations

### Key Components

#### 1. Hero Section Component
```typescript
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  animated?: boolean;
}
```

Features:
- Full-viewport height with parallax scrolling
- Animated text reveals
- Floating graphic elements
- Gradient overlays
- Responsive video/image backgrounds

#### 2. Seller Card Component
```typescript
interface SellerCardProps {
  seller: {
    id: string;
    businessName: string;
    businessType: 'wholesaler' | 'manufacturer';
    location: {
      city: string;
      state: string;
      coordinates: { lat: number; lng: number };
    };
    categories: string[];
    thumbnailImage: string;
    distance?: number;
  };
  onEnquire: (sellerId: string) => void;
}
```

Features:
- Hover animations
- Distance badge
- Category tags
- Business type indicator
- Image lazy loading

#### 3. Inquiry Form Component
```typescript
interface InquiryFormProps {
  sellerId: string;
  sellerName: string;
  onSubmit: (data: InquiryData) => Promise<void>;
  onClose: () => void;
}

interface InquiryData {
  visitorName: string;
  email: string;
  phone: string;
  location: string;
  message: string;
  sellerId: string;
}
```

Features:
- Form validation
- Loading states
- Success/error messages
- Modal or slide-in presentation

#### 4. Location Selector Component
```typescript
interface LocationSelectorProps {
  onLocationSelected: (coords: Coordinates) => void;
  onLocationDenied: () => void;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}
```

Features:
- Browser geolocation request
- Manual location input fallback
- City/area autocomplete
- Loading states

#### 5. Seller Map Component
```typescript
interface SellerMapProps {
  sellers: Seller[];
  userLocation: Coordinates;
  onSellerClick: (sellerId: string) => void;
  radius: number; // in kilometers
}
```

Features:
- Interactive map with markers
- Radius circle visualization
- Seller clustering
- Popup on marker click

#### 6. Feature Showcase Component
```typescript
interface FeatureShowcaseProps {
  features: Feature[];
  layout: 'grid' | 'carousel' | 'stacked';
}

interface Feature {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
}
```

Features:
- Animated icons
- Scroll-triggered animations
- Interactive hover states
- Responsive layouts

## Data Models

### Existing Tables (From Root App)
The website will use existing tables from the root app:
- `sellers` - Wholesalers and manufacturers data
- `products` - Product listings
- Other existing tables as needed

### New Table: Enquiry Messages (Only New Table Needed)
```sql
CREATE TABLE enquiry_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20) NOT NULL,
  visitor_location VARCHAR(255),
  message TEXT NOT NULL,
  enquiry_type VARCHAR(50) DEFAULT 'seller' CHECK (enquiry_type IN ('seller', 'general', 'contact')),
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enquiry_messages_seller_id ON enquiry_messages(seller_id);
CREATE INDEX idx_enquiry_messages_status ON enquiry_messages(status);
CREATE INDEX idx_enquiry_messages_created_at ON enquiry_messages(created_at DESC);
CREATE INDEX idx_enquiry_messages_type ON enquiry_messages(enquiry_type);
```

**Note:** This is the ONLY new table needed. All other data (sellers, products, etc.) already exists in the root app's Supabase database.

## API Endpoints

### GET /api/sellers
Query sellers from existing database based on location and filters.

**Query Parameters:**
- `latitude` (required): User's latitude
- `longitude` (required): User's longitude
- `radius` (optional, default: 100): Search radius in kilometers
- `businessType` (optional): Filter by 'wholesaler' or 'manufacturer'
- `category` (optional): Filter by product category

**Response:**
```typescript
{
  success: boolean;
  data: {
    sellers: Seller[];
    count: number;
  };
  error?: string;
}
```

**Implementation:**
Queries existing sellers table from root app database using distance calculation.

### POST /api/enquiry
Submit an enquiry about a seller or general inquiry.

**Request Body:**
```typescript
{
  sellerId?: string;  // Optional - only for seller enquiries
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorLocation: string;
  message: string;
  enquiryType: 'seller' | 'general' | 'contact';
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: { enquiryId: string };
  error?: string;
}
```

**Implementation:**
Inserts into new `enquiry_messages` table.

### GET /api/geolocation
Fallback IP-based geolocation when browser permission denied.

**Response:**
```typescript
{
  success: boolean;
  data?: {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  };
  error?: string;
}
```

## Design System

### Color Palette
```css
:root {
  /* Primary Colors */
  --primary-orange: #FF6B35;
  --primary-dark: #1A1A1A;
  --primary-gray: #545454;
  
  /* Secondary Colors */
  --secondary-blue: #004E89;
  --secondary-green: #2A9D8F;
  
  /* Neutral Colors */
  --neutral-white: #FFFFFF;
  --neutral-light: #F4F4F4;
  --neutral-medium: #CCCCCC;
  --neutral-dark: #333333;
  
  /* Accent Colors */
  --accent-yellow: #FFB703;
  --accent-red: #E63946;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #FF6B35 0%, #FFB703 100%);
  --gradient-dark: linear-gradient(135deg, #1A1A1A 0%, #545454 100%);
}
```

### Typography
```css
/* Headings */
--font-heading: 'Inter', 'Poppins', sans-serif;
--font-body: 'Inter', 'Open Sans', sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
--text-6xl: 3.75rem;   /* 60px */
```

### Spacing System
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
```

### Animation Principles
- **Duration:** 200-400ms for micro-interactions, 600-800ms for page transitions
- **Easing:** Use cubic-bezier for natural motion
- **Scroll Animations:** Trigger at 20% viewport intersection
- **Hover States:** Subtle scale (1.02-1.05) and shadow changes
- **Loading States:** Skeleton screens and smooth fade-ins

## Error Handling

### Geolocation Errors
1. **Permission Denied:** Show manual location input with city autocomplete
2. **Position Unavailable:** Fall back to IP-based geolocation
3. **Timeout:** Retry once, then fall back to manual input

### API Errors
1. **Network Errors:** Display retry button with error message
2. **Validation Errors:** Show field-specific error messages
3. **Server Errors:** Display generic error with support contact
4. **No Results:** Show helpful message with suggestions to expand radius

### Form Validation
- Real-time validation on blur
- Clear error messages below fields
- Disable submit button until form is valid
- Show success message after submission

## Testing Strategy

### Unit Tests
- Component rendering and props
- Form validation logic
- Distance calculation functions
- Data transformation utilities

### Integration Tests
- API endpoint functionality
- Database queries and filters
- Form submission flows
- Geolocation integration

### E2E Tests
- Complete user journey: landing → marketplace → seller profile → inquiry
- Location permission flows
- Form submissions
- Mobile responsiveness

### Performance Tests
- Lighthouse scores (Performance, Accessibility, SEO)
- Image optimization
- Bundle size analysis
- API response times

### Browser Testing
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- iOS Safari, Android Chrome
- Responsive breakpoints: 320px, 768px, 1024px, 1440px, 1920px

## Accessibility

- WCAG 2.1 Level AA compliance
- Semantic HTML5 elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators
- Alt text for all images
- Color contrast ratios ≥ 4.5:1
- Screen reader testing

## SEO Optimization

- Server-side rendering with Next.js
- Dynamic meta tags per page
- Structured data (JSON-LD) for organization and local business
- Optimized images with next/image
- Sitemap generation
- robots.txt configuration
- Open Graph tags for social sharing
- Canonical URLs

## Performance Optimization

- Image optimization with WebP format
- Lazy loading for images and components
- Code splitting by route
- CDN for static assets
- Database query optimization with indexes
- API response caching
- Compression (Gzip/Brotli)
- Prefetching for critical routes

## Security Considerations

- Input sanitization for all forms
- SQL injection prevention (Supabase parameterized queries)
- XSS protection
- CSRF tokens for forms
- Rate limiting on API endpoints
- HTTPS enforcement
- Environment variable protection
- Content Security Policy headers
