import { Coordinates } from '@/types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get user's location using browser Geolocation API
 * @returns Promise with coordinates or error
 */
export async function getBrowserLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings to find nearby sellers.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Please check your device location settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true, // Request GPS for accurate location
        timeout: 15000, // Increased timeout for GPS
        maximumAge: 300000, // 5 minutes - use cached position if available
      }
    );
  });
}

/**
 * Get user's location using IP-based geolocation as fallback
 * @returns Promise with coordinates
 */
export async function getIPBasedLocation(): Promise<Coordinates> {
  try {
    const response = await fetch('/api/geolocation');
    
    if (!response.ok) {
      throw new Error('Failed to fetch IP-based location');
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to get location from IP');
    }

    return {
      latitude: data.data.latitude,
      longitude: data.data.longitude,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to get IP-based location'
    );
  }
}

/**
 * Get user's location with fallback strategy
 * Tries browser geolocation first, then falls back to IP-based location
 * @returns Promise with coordinates
 */
export async function getUserLocation(): Promise<Coordinates> {
  try {
    // Try browser geolocation first
    return await getBrowserLocation();
  } catch (browserError) {
    console.warn('Browser geolocation failed, trying IP-based fallback:', browserError);
    
    try {
      // Fall back to IP-based geolocation
      return await getIPBasedLocation();
    } catch (ipError) {
      console.error('IP-based geolocation also failed:', ipError);
      throw new Error('Unable to determine your location. Please enter it manually.');
    }
  }
}
