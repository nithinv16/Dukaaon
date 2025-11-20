'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface LocationPermissionFlowProps {
  onLocationSelected: () => void;
  isLoading: boolean;
  error: string | null;
  onRequestLocation: () => void;
  onRetry: () => void;
}

export function LocationPermissionFlow({
  isLoading,
  error,
  onRequestLocation,
  onRetry,
}: LocationPermissionFlowProps) {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCity, setManualCity] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // For now, we'll use a simple geocoding approach
    // In production, you'd use a geocoding API
    alert('Manual location input will be implemented with geocoding API');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-12 h-12 text-primary-orange animate-spin" />
        <p className="text-lg text-primary-gray">Detecting your location...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Location Access Error
              </h3>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={onRetry} variant="primary" size="sm">
                  Try Again
                </Button>
                <Button
                  onClick={() => setShowManualInput(true)}
                  variant="outline"
                  size="sm"
                >
                  Enter Location Manually
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Modal
          isOpen={showManualInput}
          onClose={() => setShowManualInput(false)}
          title="Enter Your Location"
        >
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-primary-dark mb-2">
                City or Area
              </label>
              <Input
                id="city"
                type="text"
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                placeholder="e.g., Mumbai, Bangalore"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowManualInput(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Find Sellers
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 px-4">
      <div className="bg-white border border-neutral-medium rounded-lg p-8 max-w-md w-full text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-orange/10 rounded-full mb-4">
          <MapPin className="w-8 h-8 text-primary-orange" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-primary-dark mb-3">
          Find Sellers Near You
        </h2>
        <p className="text-primary-gray mb-6">
          We need your location to show wholesalers and manufacturers within 100km of you.
        </p>
        <div className="space-y-3">
          <Button onClick={onRequestLocation} variant="primary" className="w-full">
            <MapPin className="w-5 h-5 mr-2" />
            Allow Location Access
          </Button>
          <Button
            onClick={() => setShowManualInput(true)}
            variant="outline"
            className="w-full"
          >
            Enter Location Manually
          </Button>
        </div>
        <p className="text-xs text-primary-gray mt-4">
          Your location is only used to find nearby sellers and is not stored.
        </p>
      </div>

      <Modal
        isOpen={showManualInput}
        onClose={() => setShowManualInput(false)}
        title="Enter Your Location"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label htmlFor="manual-city" className="block text-sm font-medium text-primary-dark mb-2">
              City or Area
            </label>
            <Input
              id="manual-city"
              type="text"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              placeholder="e.g., Mumbai, Bangalore"
              required
            />
            <p className="text-xs text-primary-gray mt-2">
              Enter your city name to find sellers in your area
            </p>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowManualInput(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Find Sellers
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
