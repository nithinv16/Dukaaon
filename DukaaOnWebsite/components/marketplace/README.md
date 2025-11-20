# Marketplace Components

This directory contains all components related to the marketplace functionality, including location-based seller discovery, filtering, and map visualization.

## Components

### LocationPermissionFlow
Handles the user flow for requesting and managing location permissions.

**Features:**
- Browser geolocation request UI
- Loading states during location detection
- Error handling with retry mechanism
- Manual location input fallback
- Privacy-focused messaging

**Props:**
- `onLocationSelected: () => void` - Callback when location is selected
- `isLoading: boolean` - Loading state indicator
- `error: string | null` - Error message to display
- `onRequestLocation: () => void` - Handler for location request
- `onRetry: () => void` - Handler for retry action

### SellerCard
Displays individual seller information in a card format.

**Features:**
- Business name, type, and location display
- Distance badge showing km from user
- Category tags
- Product images with lazy loading
- Hover animations
- View details and enquire actions

**Props:**
- `seller: Seller` - Seller data object
- `onEnquire: (sellerId: string) => void` - Handler for enquiry action

### SellerGrid
Responsive grid layout for displaying multiple seller cards.

**Features:**
- Responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Loading state
- Empty state handling

**Props:**
- `sellers: Seller[]` - Array of seller data
- `isLoading?: boolean` - Loading state indicator
- `onEnquire: (sellerId: string) => void` - Handler for enquiry action

### MarketplaceFilters
Comprehensive filtering interface for marketplace search.

**Features:**
- Search by business name
- Filter by business type (wholesaler/manufacturer)
- Filter by category
- Radius adjustment slider (10-200km)
- Mobile-responsive with collapsible filters
- Clear filters functionality

**Props:**
- `filters: FilterState` - Current filter state
- `onFilterChange: (filters: FilterState) => void` - Handler for filter changes
- `categories: string[]` - Available categories for filtering
- `showRadiusSlider?: boolean` - Whether to show radius slider

### SellerMap
Interactive map view showing seller locations with clustering.

**Features:**
- Leaflet-based interactive map
- User location marker
- Seller markers with custom icons
- Radius circle visualization
- Marker popups with seller info
- Click to view seller details
- Auto-fit bounds to show all markers

**Props:**
- `sellers: Seller[]` - Array of seller data
- `userLocation: Coordinates` - User's current coordinates
- `onSellerClick: (sellerId: string) => void` - Handler for seller marker click
- `radius: number` - Search radius in kilometers
- `className?: string` - Additional CSS classes

### EmptyState
Displays appropriate empty states and error messages.

**Features:**
- Multiple state types (no-sellers, no-results, error)
- Contextual messaging
- Action buttons (retry, expand radius, clear filters)
- Icon-based visual feedback

**Props:**
- `type: 'no-sellers' | 'no-results' | 'error'` - Type of empty state
- `message?: string` - Custom message to display
- `onRetry?: () => void` - Handler for retry action
- `onExpandRadius?: () => void` - Handler for expanding search radius
- `onClearFilters?: () => void` - Handler for clearing filters

## Usage Example

```tsx
import {
  LocationPermissionFlow,
  SellerGrid,
  MarketplaceFilters,
  SellerMap,
  EmptyState,
  FilterState,
} from '@/components/marketplace';

function MarketplacePage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    businessType: '',
    category: '',
    radius: 100,
  });

  return (
    <div>
      <MarketplaceFilters
        filters={filters}
        onFilterChange={setFilters}
        categories={categories}
      />
      <SellerGrid sellers={sellers} onEnquire={handleEnquire} />
    </div>
  );
}
```

## Integration

These components are designed to work with:
- `useGeolocation` hook for location management
- `useSellerData` hook for fetching seller data
- `/api/sellers` endpoint for backend data
- Leaflet for map functionality

## Styling

All components use the DukaaOn design system with:
- Tailwind CSS utility classes
- Custom color palette (primary-orange, primary-dark, etc.)
- Responsive breakpoints
- Smooth transitions and animations
- Lucide React icons

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Focus indicators
- Screen reader friendly
- Color contrast compliance
