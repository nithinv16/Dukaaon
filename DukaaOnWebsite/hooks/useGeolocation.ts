'use client';

import { useState, useEffect, useCallback } from 'react';
import { Coordinates } from '@/types';
import { getBrowserLocation, getIPBasedLocation } from '@/lib/geolocation';
import { trackUserLocation, trackRegionalUsage } from '@/lib/analytics';

export type GeolocationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseGeolocationReturn {
  coordinates: Coordinates | null;
  status: GeolocationStatus;
  error: string | null;
  requestLocation: () => Promise<void>;
  resetLocation: () => void;
}

const LOCATION_CACHE_KEY = 'dukaaon_user_location';
const LOCATION_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedLocation {
  coordinates: Coordinates;
  timestamp: number;
}

/**
 * Get cached location from localStorage if still valid
 */
function getCachedLocation(): Coordinates | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;

    const data: CachedLocation = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp < LOCATION_CACHE_DURATION) {
      return data.coordinates;
    }

    // Cache expired, remove it
    localStorage.removeItem(LOCATION_CACHE_KEY);
    return null;
  } catch (error) {
    console.error('Error reading cached location:', error);
    return null;
  }
}

/**
 * Save location to localStorage
 */
function cacheLocation(coordinates: Coordinates): void {
  if (typeof window === 'undefined') return;
  
  try {
    const data: CachedLocation = {
      coordinates,
      timestamp: Date.now(),
    };
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching location:', error);
  }
}

/**
 * Clear cached location from localStorage
 */
function clearCachedLocation(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(LOCATION_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing cached location:', error);
  }
}

/**
 * Hook for managing user geolocation with browser API and IP fallback
 * @param autoRequest - Whether to automatically request location on mount
 * @returns Geolocation state and control functions
 */
export function useGeolocation(autoRequest = false): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const requestLocation = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      // Use browser geolocation directly for accurate GPS coordinates
      const coords = await getBrowserLocation();
      setCoordinates(coords);
      setStatus('success');
      
      // Cache the location
      cacheLocation(coords);
      
      // Track location detection
      // Note: In production, you'd reverse geocode to get city/state
      // For now, we'll track with placeholder values
      trackUserLocation('Unknown City', 'Unknown State', 'browser');
      trackRegionalUsage('Unknown Region', 'location_detected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const resetLocation = useCallback(() => {
    setCoordinates(null);
    setStatus('idle');
    setError(null);
    clearCachedLocation();
  }, []);

  // Initialize: Load cached location or auto-request on mount
  useEffect(() => {
    if (isInitialized) return;
    
    const cached = getCachedLocation();
    if (cached) {
      setCoordinates(cached);
      setStatus('success');
      setIsInitialized(true);
    } else if (autoRequest) {
      requestLocation();
      setIsInitialized(true);
    } else {
      setIsInitialized(true);
    }
  }, [isInitialized, autoRequest, requestLocation]);

  return {
    coordinates,
    status,
    error,
    requestLocation,
    resetLocation,
  };
}

/**
 * Hook for browser-only geolocation (no fallback)
 * @returns Geolocation state and control functions
 */
export function useBrowserGeolocation(): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const coords = await getBrowserLocation();
      setCoordinates(coords);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const resetLocation = useCallback(() => {
    setCoordinates(null);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    coordinates,
    status,
    error,
    requestLocation,
    resetLocation,
  };
}

/**
 * Hook for IP-based geolocation only
 * @returns Geolocation state and control functions
 */
export function useIPGeolocation(): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const coords = await getIPBasedLocation();
      setCoordinates(coords);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setStatus('error');
    }
  }, []);

  const resetLocation = useCallback(() => {
    setCoordinates(null);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    coordinates,
    status,
    error,
    requestLocation,
    resetLocation,
  };
}
