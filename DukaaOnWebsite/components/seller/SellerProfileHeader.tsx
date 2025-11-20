'use client';

import { Seller } from '@/types';
import { Card } from '@/components/ui/Card';
import { MapPin, Building2, Package } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

interface SellerProfileHeaderProps {
  seller: Seller;
}

export function SellerProfileHeader({ seller }: SellerProfileHeaderProps) {
  const {
    businessName,
    businessType,
    location,
    categories,
    thumbnailImage,
    description,
  } = seller;

  return (
    <Card className="overflow-hidden">
      <div className="md:flex">
        {/* Image Section */}
        <div className="md:w-1/3 relative h-64 md:h-auto bg-neutral-light">
          {thumbnailImage ? (
            <OptimizedImage
              src={thumbnailImage}
              alt={businessName}
              fill
              layout="profile"
              enableBlur
              blurColor="#FF6B35"
              className="object-cover"
              priority
              quality={90}
              fallback={
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-orange/10 to-secondary-blue/10">
                  <Building2 className="w-24 h-24 text-primary-gray/30" />
                </div>
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-orange/10 to-secondary-blue/10">
              <Building2 className="w-24 h-24 text-primary-gray/30" />
            </div>
          )}
          
          {/* Business Type Badge */}
          <div className="absolute top-4 left-4 bg-primary-orange text-white px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wide shadow-lg">
            {businessType}
          </div>
        </div>

        {/* Content Section */}
        <div className="md:w-2/3 p-6 md:p-8 space-y-6">
          {/* Business Name */}
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-dark mb-3">
              {businessName}
            </h1>
            
            {/* Location */}
            <div className="flex items-center text-primary-gray">
              <MapPin className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-lg">
                {location.city}, {location.state}
              </span>
            </div>
          </div>

          {/* Description */}
          {description && (
            <div>
              <h2 className="text-lg font-heading font-semibold text-primary-dark mb-2">
                About
              </h2>
              <p className="text-primary-gray leading-relaxed">
                {description}
              </p>
            </div>
          )}

          {/* Categories */}
          {categories && categories.length > 0 && (
            <div>
              <h2 className="text-lg font-heading font-semibold text-primary-dark mb-3 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Product Categories
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((category, index) => (
                  <span
                    key={index}
                    className="inline-block bg-neutral-light px-4 py-2 rounded-lg text-sm font-medium text-primary-dark border border-neutral-medium hover:border-primary-orange transition-colors"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
