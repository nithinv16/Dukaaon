'use client';

import { useEffect, useState } from 'react';
import { Seller } from '@/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { SellerCard } from '@/components/marketplace/SellerCard';
import { Button } from '@/components/ui/Button';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface NearbySellersProps {
  businessType: 'wholesaler' | 'manufacturer';
  title: string;
  description: string;
}

export function NearbySellersSection({
  businessType,
  title,
  description,
}: NearbySellersProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const { coordinates, requestLocation } = useGeolocation();

  useEffect(() => {
    async function fetchNearbySellers() {
      if (!coordinates) return;

      setLoading(true);
      try {
        // Fetch sellers from API
        const params = new URLSearchParams({
          latitude: coordinates.latitude.toString(),
          longitude: coordinates.longitude.toString(),
          businessType: businessType,
          radius: '100',
          limit: '3',
        });

        const response = await fetch(`/api/sellers?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch sellers');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch sellers');
        }

        // Get the first 3 sellers
        const nearbySellers = (data.data.sellers || []).slice(0, 3);
        setSellers(nearbySellers);
      } catch (err) {
        console.error('Error fetching nearby sellers:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchNearbySellers();
  }, [coordinates, businessType]);

  // If no location, show location prompt
  if (!coordinates) {
    return (
      <section className="py-16 bg-neutral-light">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-primary-dark mb-3">
              {title}
            </h2>
            <p className="text-lg text-primary-gray max-w-2xl mx-auto">{description}</p>
          </div>

          <div className="bg-white rounded-lg border border-neutral-medium p-8 text-center max-w-md mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-orange/10 rounded-full mb-4">
              <MapPin className="w-8 h-8 text-primary-orange" />
            </div>
            <h3 className="text-xl font-heading font-semibold text-primary-dark mb-2">
              Enable Location
            </h3>
            <p className="text-primary-gray mb-6">
              Allow location access to discover nearby {businessType}s in your area
            </p>
            <Button onClick={requestLocation} variant="primary" className="w-full">
              <MapPin className="w-5 h-5 mr-2" />
              Enable Location
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // If loading
  if (loading) {
    return (
      <section className="py-16 bg-neutral-light">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-primary-dark mb-3">
              {title}
            </h2>
            <p className="text-lg text-primary-gray max-w-2xl mx-auto">{description}</p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-orange animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  // If no sellers found
  if (sellers.length === 0) {
    return (
      <section className="py-16 bg-neutral-light">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold text-primary-dark mb-3">
              {title}
            </h2>
            <p className="text-lg text-primary-gray max-w-2xl mx-auto">{description}</p>
          </div>
          <div className="bg-white rounded-lg border border-neutral-medium p-8 text-center max-w-md mx-auto">
            <p className="text-primary-gray mb-4">
              No {businessType}s found in your area yet.
            </p>
            <Link href="/marketplace">
              <Button variant="primary">
                Explore Marketplace
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Show sellers
  return (
    <section className="py-16 bg-neutral-light">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-heading font-bold text-primary-dark mb-3">
              {title}
            </h2>
            <p className="text-lg text-primary-gray max-w-2xl">{description}</p>
          </div>
          <Link href="/marketplace" className="mt-4 sm:mt-0">
            <Button variant="outline" size="md">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Sellers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sellers.map((seller) => (
            <SellerCard
              key={seller.id}
              seller={seller}
              onEnquire={() => {
                // Navigate to seller profile
                window.location.href = `/seller/${seller.id}`;
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link href="/marketplace">
            <Button variant="primary" size="lg">
              Discover More {businessType === 'wholesaler' ? 'Wholesalers' : 'Manufacturers'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
