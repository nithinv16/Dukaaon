'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamicImport from 'next/dynamic';
import { PageLayout, ClientMetadata } from '@/components/layout';
import {
  LocationPermissionFlow,
  SellerGrid,
  MarketplaceFilters,
  EmptyState,
  FilterState,
} from '@/components/marketplace';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSellerData } from '@/hooks/useSellerData';
import { Button } from '@/components/ui/Button';
import { trackSellerDiscovery } from '@/lib/analytics';
import { Map, Grid3x3, Loader2 } from 'lucide-react';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

// Lazy load heavy components - import directly to avoid SSR issues
const SellerMap = dynamicImport(
  () => import('@/components/marketplace/SellerMap').then(mod => ({ default: mod.SellerMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] bg-neutral-light rounded-lg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-orange animate-spin" />
      </div>
    )
  }
);

const Modal = dynamicImport(
  () => import('@/components/ui/Modal').then(mod => ({ default: mod.Modal })),
  { ssr: false }
);

const EnquiryForm = dynamicImport(
  () => import('@/components/forms').then(mod => ({ default: mod.EnquiryForm })),
  {
    ssr: false,
    loading: () => (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-medium rounded w-3/4"></div>
          <div className="h-10 bg-neutral-medium rounded"></div>
          <div className="h-10 bg-neutral-medium rounded"></div>
          <div className="h-32 bg-neutral-medium rounded"></div>
        </div>
      </div>
    )
  }
);

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    businessType: '',
    category: '',
    radius: 100,
  });
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);

  const {
    coordinates,
    status: locationStatus,
    error: locationError,
    requestLocation,
    resetLocation,
  } = useGeolocation(true); // Auto-request location on mount (will use cache if available)

  const {
    sellers,
    loading: sellersLoading,
    error: sellersError,
    fetchSellers,
    refetch,
  } = useSellerData();

  // Fetch sellers when coordinates or filters change
  useEffect(() => {
    if (coordinates) {
      fetchSellers(coordinates, {
        radius: filters.radius,
        businessType: filters.businessType 
          ? (filters.businessType as 'wholesaler' | 'manufacturer')
          : undefined,
        category: filters.category || undefined,
      });
    }
  }, [coordinates, filters.radius, filters.businessType, filters.category, fetchSellers]);

  // Track seller discovery when sellers are loaded
  useEffect(() => {
    if (sellers && sellers.length > 0 && coordinates) {
      // Get user's city from the first seller's location (approximation)
      // In a real implementation, you'd reverse geocode the user's coordinates
      const userCity = 'Unknown'; // Placeholder - would need reverse geocoding
      
      trackSellerDiscovery(sellers.length, filters.radius, userCity);
    }
  }, [sellers, filters.radius, coordinates]);

  // Filter sellers based on search
  const filteredSellers = useMemo(() => {
    if (!sellers) return [];
    
    let filtered = sellers;

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((seller) =>
        seller.businessName.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [sellers, filters.search]);

  // Group sellers by business type
  const wholesalers = useMemo(() => {
    return filteredSellers.filter((seller) => seller.businessType === 'wholesaler');
  }, [filteredSellers]);

  const manufacturers = useMemo(() => {
    return filteredSellers.filter((seller) => seller.businessType === 'manufacturer');
  }, [filteredSellers]);

  // Extract unique categories from sellers
  const categories = useMemo(() => {
    if (!sellers) return [];
    const allCategories = sellers.flatMap((s) => s.categories || []);
    return Array.from(new Set(allCategories)).sort();
  }, [sellers]);

  const handleEnquire = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setShowEnquiryModal(true);
  };

  const handleSellerClick = (sellerId: string) => {
    // Navigate to seller profile page
    window.location.href = `/seller/${sellerId}`;
  };

  const handleExpandRadius = () => {
    setFilters((prev) => ({
      ...prev,
      radius: Math.min(prev.radius + 50, 200),
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      businessType: '',
      category: '',
      radius: 100,
    });
  };

  // Show location permission flow if no coordinates
  if (!coordinates) {
    return (
      <PageLayout>
        <ClientMetadata
          title="Marketplace - Find Wholesalers & Manufacturers Near You | DukaaOn"
          description="Discover wholesalers and manufacturers in your area. Connect directly with suppliers, get competitive prices, and grow your retail business with DukaaOn's location-based marketplace."
          canonical="/marketplace"
        />
        <div className="min-h-[calc(100vh-4rem)] bg-neutral-light">
          <LocationPermissionFlow
            onLocationSelected={() => {
              // Location is handled by the hook
            }}
            isLoading={locationStatus === 'loading'}
            error={locationError}
            onRequestLocation={requestLocation}
            onRetry={requestLocation}
          />
        </div>
      </PageLayout>
    );
  }

  const hasActiveFilters =
    filters.search || filters.businessType || filters.category;
  const showNoResults = !sellersLoading && filteredSellers.length === 0;
  const showNoSellers = !sellersLoading && !hasActiveFilters && sellers?.length === 0;
  const showError = sellersError && !sellersLoading;

  return (
    <PageLayout>
      <ClientMetadata
        title="Marketplace - Find Wholesalers & Manufacturers Near You | DukaaOn"
        description="Discover wholesalers and manufacturers in your area. Connect directly with suppliers, get competitive prices, and grow your retail business with DukaaOn's location-based marketplace."
        canonical="/marketplace"
      />
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-light">
        {/* Header */}
        <div className="bg-white border-b border-neutral-medium">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-heading font-bold text-primary-dark mb-2">
                  Marketplace
                </h1>
                <p className="text-primary-gray">
                  {sellersLoading ? (
                    'Loading sellers...'
                  ) : filteredSellers.length > 0 ? (
                    <>
                      Found <span className="font-semibold">{filteredSellers.length}</span>{' '}
                      {filteredSellers.length === 1 ? 'seller' : 'sellers'} within{' '}
                      <span className="font-semibold">{filters.radius}km</span>
                    </>
                  ) : (
                    'Discover wholesalers and manufacturers near you'
                  )}
                </p>
              </div>

              {/* View Toggle */}
              {filteredSellers.length > 0 && (
                <div className="flex items-center space-x-2 bg-neutral-light rounded-lg p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="flex items-center space-x-2"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </Button>
                  <Button
                    variant={viewMode === 'map' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('map')}
                    className="flex items-center space-x-2"
                  >
                    <Map className="w-4 h-4" />
                    <span className="hidden sm:inline">Map</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="mb-6">
            <MarketplaceFilters
              filters={filters}
              onFilterChange={setFilters}
              categories={categories}
              showRadiusSlider={true}
            />
          </div>

          {/* Loading State */}
          {sellersLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-orange animate-spin" />
            </div>
          )}

          {/* Error State */}
          {showError && (
            <EmptyState
              type="error"
              message={sellersError || undefined}
              onRetry={refetch}
            />
          )}

          {/* No Sellers State */}
          {showNoSellers && (
            <EmptyState
              type="no-sellers"
              onExpandRadius={handleExpandRadius}
              onRetry={resetLocation}
            />
          )}

          {/* No Results State */}
          {showNoResults && hasActiveFilters && (
            <EmptyState
              type="no-results"
              onClearFilters={handleClearFilters}
              onExpandRadius={handleExpandRadius}
            />
          )}

          {/* Sellers Display */}
          {!sellersLoading && filteredSellers.length > 0 && (
            <>
              {viewMode === 'grid' ? (
                <div className="space-y-12">
                  {/* Nearby Wholesalers Section */}
                  {wholesalers.length > 0 && (
                    <div>
                      <div className="mb-6">
                        <h2 className="text-2xl font-heading font-bold text-primary-dark mb-2">
                          Nearby Wholesalers
                        </h2>
                        <p className="text-primary-gray">
                          Found <span className="font-semibold">{wholesalers.length}</span>{' '}
                          {wholesalers.length === 1 ? 'wholesaler' : 'wholesalers'} near you
                        </p>
                      </div>
                      <SellerGrid
                        sellers={wholesalers}
                        onEnquire={handleEnquire}
                      />
                    </div>
                  )}

                  {/* Nearby Manufacturers Section */}
                  {manufacturers.length > 0 && (
                    <div>
                      <div className="mb-6">
                        <h2 className="text-2xl font-heading font-bold text-primary-dark mb-2">
                          Nearby Manufacturers
                        </h2>
                        <p className="text-primary-gray">
                          Found <span className="font-semibold">{manufacturers.length}</span>{' '}
                          {manufacturers.length === 1 ? 'manufacturer' : 'manufacturers'} near you
                        </p>
                      </div>
                      <SellerGrid
                        sellers={manufacturers}
                        onEnquire={handleEnquire}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <SellerMap
                  sellers={filteredSellers}
                  userLocation={coordinates}
                  onSellerClick={handleSellerClick}
                  radius={filters.radius}
                  className="h-[600px]"
                />
              )}
            </>
          )}
        </div>

        {/* Enquiry Modal */}
        <Modal
          isOpen={showEnquiryModal}
          onClose={() => setShowEnquiryModal(false)}
          title={selectedSellerId ? `Enquire About ${sellers?.find(s => s.id === selectedSellerId)?.businessName || 'Seller'}` : 'Enquire About Seller'}
          size="lg"
        >
          <EnquiryForm
            sellerId={selectedSellerId || undefined}
            sellerName={sellers?.find(s => s.id === selectedSellerId)?.businessName}
            enquiryType="seller"
            onSuccess={() => {
              // Close modal after showing success message
              setTimeout(() => {
                setShowEnquiryModal(false);
                setSelectedSellerId(null);
              }, 2500);
            }}
            onCancel={() => {
              setShowEnquiryModal(false);
              setSelectedSellerId(null);
            }}
            showCancelButton={true}
          />
        </Modal>
      </div>
    </PageLayout>
  );
}
