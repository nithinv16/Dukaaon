'use client';

import { useState, useEffect, useCallback } from 'react';
import { Seller, Coordinates } from '@/types';

export interface SellerFilters {
  businessType?: 'wholesaler' | 'manufacturer';
  category?: string;
  radius?: number;
}

export interface UseSellerDataReturn {
  sellers: Seller[];
  loading: boolean;
  error: string | null;
  fetchSellers: (coordinates: Coordinates, filters?: SellerFilters) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching seller data with location-based filtering
 * @param initialCoordinates - Optional initial coordinates to fetch sellers
 * @param initialFilters - Optional initial filters
 * @returns Seller data state and control functions
 */
export function useSellerData(
  initialCoordinates?: Coordinates,
  initialFilters?: SellerFilters
): UseSellerDataReturn {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCoordinates, setLastCoordinates] = useState<Coordinates | undefined>(
    initialCoordinates
  );
  const [lastFilters, setLastFilters] = useState<SellerFilters | undefined>(
    initialFilters
  );

  const fetchSellers = useCallback(
    async (coordinates: Coordinates, filters?: SellerFilters) => {
      setLoading(true);
      setError(null);
      setLastCoordinates(coordinates);
      setLastFilters(filters);

      try {
        const params = new URLSearchParams({
          latitude: coordinates.latitude.toString(),
          longitude: coordinates.longitude.toString(),
        });

        if (filters?.radius) {
          params.append('radius', filters.radius.toString());
        }

        if (filters?.businessType) {
          params.append('businessType', filters.businessType);
        }

        if (filters?.category) {
          params.append('category', filters.category);
        }

        const response = await fetch(`/api/sellers?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch sellers');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch sellers');
        }

        setSellers(data.data.sellers || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch sellers';
        setError(errorMessage);
        setSellers([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    if (lastCoordinates) {
      await fetchSellers(lastCoordinates, lastFilters);
    }
  }, [lastCoordinates, lastFilters, fetchSellers]);

  useEffect(() => {
    if (initialCoordinates) {
      fetchSellers(initialCoordinates, initialFilters);
    }
  }, []); // Only run on mount

  return {
    sellers,
    loading,
    error,
    fetchSellers,
    refetch,
  };
}
