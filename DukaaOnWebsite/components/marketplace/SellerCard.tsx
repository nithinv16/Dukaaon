'use client';

import { Seller } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MapPin, Package, Building2, Navigation } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import Link from 'next/link';

interface SellerCardProps {
  seller: Seller;
  onEnquire: (sellerId: string) => void;
}

export function SellerCard({ seller, onEnquire }: SellerCardProps) {
  const {
    id,
    businessName,
    businessType,
    location,
    categories,
    thumbnailImage,
    description,
    distance,
  } = seller;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      {/* Image Section */}
      <div className="relative h-48 bg-neutral-light overflow-hidden">
        {thumbnailImage ? (
          <OptimizedImage
            src={thumbnailImage}
            alt={businessName}
            fill
            layout="card"
            enableBlur
            blurColor="#FF6B35"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            quality={85}
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-orange/10 to-secondary-blue/10">
                <Building2 className="w-16 h-16 text-primary-gray/30" />
              </div>
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-orange/10 to-secondary-blue/10">
            <Building2 className="w-16 h-16 text-primary-gray/30" />
          </div>
        )}
        
        {/* Distance Badge */}
        {distance !== undefined && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md flex items-center space-x-1">
            <Navigation className="w-4 h-4 text-primary-orange" />
            <span className="text-sm font-semibold text-primary-dark">
              {distance.toFixed(1)} km
            </span>
          </div>
        )}

        {/* Business Type Badge */}
        <div className="absolute top-3 left-3 bg-primary-orange text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
          {businessType}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Business Name */}
        <div>
          <h3 className="text-xl font-heading font-bold text-primary-dark mb-1 line-clamp-1">
            {businessName}
          </h3>
          <div className="flex items-center text-sm text-primary-gray">
            <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">
              {location.city}, {location.state}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-primary-gray line-clamp-2">
            {description}
          </p>
        )}

        {/* Categories */}
        {categories && categories.length > 0 && (
          <div className="flex items-start space-x-2">
            <Package className="w-4 h-4 text-primary-gray flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 3).map((category, index) => (
                <span
                  key={index}
                  className="inline-block bg-neutral-light px-2 py-1 rounded text-xs text-primary-dark"
                >
                  {category}
                </span>
              ))}
              {categories.length > 3 && (
                <span className="inline-block bg-neutral-light px-2 py-1 rounded text-xs text-primary-gray">
                  +{categories.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-2">
          <Link href={`/seller/${id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => onEnquire(id)}
            size="sm"
            className="flex-1"
          >
            Enquire
          </Button>
        </div>
      </div>
    </Card>
  );
}
