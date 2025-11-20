'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { PageLayout, ClientMetadata, generateLocalBusinessSchema, generateBreadcrumbSchema } from '@/components/layout';
import { Seller } from '@/types';
import { Loader2, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { SellerProfileHeader } from '@/components/seller/SellerProfileHeader';
import { EnquireButton } from '@/components/seller/EnquireButton';
import { trackSellerView } from '@/lib/analytics';

// Lazy load heavy components
const ProductGallery = dynamic(
  () => import('@/components/seller/ProductGallery').then(mod => ({ default: mod.ProductGallery })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-medium rounded w-1/4"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-square bg-neutral-medium rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }
);

const SellerLocationMap = dynamic(
  () => import('@/components/seller/SellerLocationMap').then(mod => ({ default: mod.SellerLocationMap })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-medium rounded w-1/4"></div>
          <div className="h-64 bg-neutral-medium rounded-lg"></div>
        </div>
      </div>
    )
  }
);

const Modal = dynamic(
  () => import('@/components/ui/Modal').then(mod => ({ default: mod.Modal })),
  { ssr: false }
);

const EnquiryForm = dynamic(
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

export default function SellerProfilePage() {
  const params = useParams();
  const sellerId = params.id as string;
  
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);

  useEffect(() => {
    async function fetchSellerDetails() {
      try {
        setLoading(true);
        setError(null);

        // Fetch seller details from API route
        const response = await fetch(`/api/sellers/${sellerId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch seller details');
        }

        const sellerData = result.data;
        setSeller(sellerData);
        
        // Track seller profile view
        trackSellerView(sellerData.id, sellerData.businessName);
      } catch (err) {
        console.error('Error fetching seller:', err);
        setError('Failed to load seller details. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (sellerId) {
      fetchSellerDetails();
    }
  }, [sellerId]);

  if (loading) {
    return (
      <PageLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-orange animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !seller) {
    return (
      <PageLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-heading font-bold text-primary-dark mb-2">
              {error || 'Seller not found'}
            </h2>
            <p className="text-primary-gray mb-6">
              The seller you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center text-primary-orange hover:text-primary-orange/80 font-semibold"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Generate structured data for SEO
  const localBusinessSchema = seller ? generateLocalBusinessSchema({
    name: seller.businessName,
    description: seller.description || `${seller.businessType} in ${seller.location.city}`,
    address: seller.location.city,
    city: seller.location.city,
    state: seller.location.state,
    latitude: seller.location.coordinates.latitude,
    longitude: seller.location.coordinates.longitude,
    categories: seller.categories,
  }) : null;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Marketplace', url: '/marketplace' },
    { name: seller.businessName, url: `/seller/${seller.id}` },
  ]);

  return (
    <PageLayout>
      <ClientMetadata
        title={`${seller.businessName} - ${seller.businessType} in ${seller.location.city} | DukaaOn`}
        description={seller.description || `Connect with ${seller.businessName}, a trusted ${seller.businessType} in ${seller.location.city}, ${seller.location.state}. Browse products and send inquiries through DukaaOn marketplace.`}
        canonical={`/seller/${seller.id}`}
      />
      {/* Structured Data */}
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-light">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-neutral-medium">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <nav className="flex items-center space-x-2 text-sm">
              <Link
                href="/"
                className="text-primary-gray hover:text-primary-orange transition-colors flex items-center"
              >
                <Home className="w-4 h-4" />
              </Link>
              <ChevronRight className="w-4 h-4 text-neutral-medium" />
              <Link
                href="/marketplace"
                className="text-primary-gray hover:text-primary-orange transition-colors"
              >
                Marketplace
              </Link>
              <ChevronRight className="w-4 h-4 text-neutral-medium" />
              <span className="text-primary-dark font-semibold truncate max-w-xs">
                {seller.businessName}
              </span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Seller Header */}
            <SellerProfileHeader seller={seller} />

            {/* Product Gallery */}
            <ProductGallery sellerId={seller.id} />

            {/* Location Map */}
            <SellerLocationMap seller={seller} />

            {/* Enquire Button - Fixed at bottom on mobile */}
            <EnquireButton
              seller={seller}
              onEnquire={() => setShowEnquiryModal(true)}
            />
          </div>
        </div>

        {/* Enquiry Modal */}
        <Modal
          isOpen={showEnquiryModal}
          onClose={() => setShowEnquiryModal(false)}
          title={`Enquire About ${seller.businessName}`}
          size="lg"
        >
          <EnquiryForm
            sellerId={seller.id}
            sellerName={seller.businessName}
            enquiryType="seller"
            onSuccess={() => {
              // Close modal after showing success message
              setTimeout(() => {
                setShowEnquiryModal(false);
              }, 2500);
            }}
            onCancel={() => setShowEnquiryModal(false)}
            showCancelButton={true}
          />
        </Modal>
      </div>
    </PageLayout>
  );
}
