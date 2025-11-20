'use client';

import { Button } from '@/components/ui/Button';
import { MapPin, Search, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-sellers' | 'no-results' | 'error';
  message?: string;
  onRetry?: () => void;
  onExpandRadius?: () => void;
  onClearFilters?: () => void;
}

export function EmptyState({
  type,
  message,
  onRetry,
  onExpandRadius,
  onClearFilters,
}: EmptyStateProps) {
  if (type === 'no-sellers') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-neutral-light rounded-full p-6 mb-6">
          <MapPin className="w-16 h-16 text-primary-gray" />
        </div>
        <h3 className="text-2xl font-heading font-bold text-primary-dark mb-3">
          No Sellers Found Nearby
        </h3>
        <p className="text-primary-gray text-center max-w-md mb-6">
          {message ||
            "We couldn't find any wholesalers or manufacturers within your selected radius. Try expanding your search area."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {onExpandRadius && (
            <Button onClick={onExpandRadius} variant="primary">
              Expand Search Radius
            </Button>
          )}
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              Try Different Location
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-neutral-light rounded-full p-6 mb-6">
          <Search className="w-16 h-16 text-primary-gray" />
        </div>
        <h3 className="text-2xl font-heading font-bold text-primary-dark mb-3">
          No Results Found
        </h3>
        <p className="text-primary-gray text-center max-w-md mb-6">
          {message ||
            "We couldn't find any sellers matching your filters. Try adjusting your search criteria."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {onClearFilters && (
            <Button onClick={onClearFilters} variant="primary">
              Clear All Filters
            </Button>
          )}
          {onExpandRadius && (
            <Button onClick={onExpandRadius} variant="outline">
              Expand Search Radius
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-red-50 rounded-full p-6 mb-6">
          <AlertCircle className="w-16 h-16 text-red-600" />
        </div>
        <h3 className="text-2xl font-heading font-bold text-primary-dark mb-3">
          Something Went Wrong
        </h3>
        <p className="text-primary-gray text-center max-w-md mb-6">
          {message ||
            "We encountered an error while loading sellers. Please try again."}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="primary">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return null;
}
