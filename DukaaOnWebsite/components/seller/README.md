# Seller Profile Components

This directory contains components for the seller profile page implementation (Task 8).

## Components

### SellerProfileHeader
Displays the main seller information including:
- Business name and type
- Location (city, state)
- Business description
- Product categories
- Thumbnail image

### ProductGallery
Interactive product image gallery with:
- Carousel navigation (4 images per page)
- Lightbox modal for full-size image viewing
- Lazy loading for performance
- Keyboard navigation support
- No prices displayed (as per requirements)

### SellerLocationMap
Interactive map showing:
- Seller location with custom marker
- User location (if available)
- Distance calculation between user and seller
- Dashed line connecting user to seller
- Interactive zoom and pan controls

### EnquireButton
Call-to-action button for enquiries:
- Desktop: Full-width button above content
- Mobile: Fixed button at bottom of screen
- Opens enquiry modal (to be implemented in Task 9)

## Usage

```tsx
import {
  SellerProfileHeader,
  ProductGallery,
  SellerLocationMap,
  EnquireButton,
} from '@/components/seller';

// In your page component
<SellerProfileHeader seller={seller} />
<ProductGallery sellerId={seller.id} />
<SellerLocationMap seller={seller} />
<EnquireButton seller={seller} onEnquire={() => setShowModal(true)} />
```

## Page Route

The seller profile page is accessible at `/seller/[id]` where `[id]` is the seller's UUID.

## Features Implemented

✅ Breadcrumb navigation (Home > Marketplace > Seller Name)
✅ Responsive layout (mobile, tablet, desktop)
✅ Image lazy loading
✅ Interactive map with Leaflet
✅ Distance calculation from user location
✅ Product gallery with lightbox
✅ Fixed mobile CTA button
✅ Loading and error states

## Next Steps

Task 9 will implement the actual enquiry form that opens when the "Enquire Details" button is clicked.
