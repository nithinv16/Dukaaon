// Enhanced distance calculation utilities for delivery booking
// Handles both coordinate pairs and Google Maps URLs

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Convert degrees to radians
 * @param deg Degrees
 * @returns Radians
 */
const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

/**
 * Extract coordinates from Google Maps URL
 * Supports various Google Maps URL formats and uses Geocoding API as fallback
 * @param mapsUrl Google Maps URL
 * @returns Promise with coordinates object or null if not found
 */
export const extractCoordinatesFromGoogleMapsUrl = async (mapsUrl: string): Promise<{ lat: number; lng: number } | null> => {
  if (!mapsUrl || typeof mapsUrl !== 'string') {
    return null;
  }

  // Clean the URL and handle encoded characters
  const url = decodeURIComponent(mapsUrl.trim());
  console.log('Extracting coordinates from URL:', url);

  // Enhanced regex patterns to handle more coordinate formats
  const patterns = [
    // Pattern 1: @lat,lng,zoom (most common Google Maps format)
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 2: ll=lat,lng (legacy format)
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 3: q=lat,lng (query format)
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 4: /place/name/@lat,lng (place URLs)
    /\/place\/[^@]*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 5: maps.google.com/?q=lat,lng
    /maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 6: Data parameter coordinates (!3d!4d format)
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    
    // Pattern 7: coordinates in URL parameters (lat/lng)
    /[?&](?:lat|latitude)=(-?\d+(?:\.\d+)?).*[?&](?:lng|longitude|lon)=(-?\d+(?:\.\d+)?)/,
    
    // Pattern 8: coordinates in URL parameters (lng/lat)
    /[?&](?:lng|longitude|lon)=(-?\d+(?:\.\d+)?).*[?&](?:lat|latitude)=(-?\d+(?:\.\d+)?)/,
    
    // Pattern 9: /dir/ URLs with coordinates
    /\/dir\/[^/]*\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 10: Short URLs with coordinates
    /goo\.gl\/maps\/.*[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 11: Plus codes or other coordinate formats
    /[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 12: maps.app.goo.gl URLs
    /maps\.app\.goo\.gl\/.*[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    
    // Pattern 13: Simple lat,lng anywhere in URL (more restrictive)
    /(?:^|[^\d])(-?\d{1,2}(?:\.\d{4,})?),\s*(-?\d{1,3}(?:\.\d{4,})?)/
  ];

  // Try direct URL parsing first
  for (let i = 0; i < patterns.length; i++) {
    const match = url.match(patterns[i]);
    if (match) {
      let lat, lng;
      
      // Handle different pattern arrangements
      if (i === 7) { // Pattern 8: lng comes first
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      } else {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
      
      // Validate extracted coordinates
      if (isValidCoordinate(lat, lng)) {
        console.log(`Coordinates extracted using pattern ${i + 1}:`, { lat, lng });
        return { lat, lng };
      }
    }
  }

  // If direct parsing fails, try Google Maps Geocoding API for shortened URLs
  console.log('Direct parsing failed, trying Geocoding API for shortened URL...');
  return await extractCoordinatesUsingGeocodingAPI(url);
};

/**
 * Extract coordinates using Google Maps Geocoding API
 * Handles shortened URLs and place names
 * @param mapsUrl Google Maps URL or place name
 * @returns Promise with coordinates object or null if not found
 */
export const extractCoordinatesUsingGeocodingAPI = async (mapsUrl: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    // Get API key from environment
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not found. Cannot use Geocoding API.');
      return null;
    }

    // For shortened URLs, we need to resolve them first or extract place info
    let searchQuery = mapsUrl;
    
    // Extract place ID if present
    const placeIdMatch = mapsUrl.match(/place_id=([A-Za-z0-9_-]+)/);
    if (placeIdMatch) {
      // Use Place Details API for place IDs
      const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeIdMatch[1]}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      
      const response = await fetch(placeDetailsUrl);
      const data = await response.json();
      
      if (data.status === 'OK' && data.result?.geometry?.location) {
        const coords = {
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng
        };
        console.log('Coordinates extracted using Place Details API:', coords);
        return coords;
      }
    }
    
    // Extract place name from URL for geocoding
    const placeNameMatch = mapsUrl.match(/\/place\/([^/@]+)/);
    if (placeNameMatch) {
      searchQuery = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
    }
    
    // Use Geocoding API
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}&components=country:IN`;
    
    const response = await fetch(geocodingUrl);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coords = {
        lat: location.lat,
        lng: location.lng
      };
      console.log('Coordinates extracted using Geocoding API:', coords);
      return coords;
    } else {
      console.warn('Geocoding API failed:', data.status, data.error_message);
      return null;
    }
    
  } catch (error) {
    console.error('Error using Geocoding API:', error);
    return null;
  }
};

/**
 * Calculate delivery fee based on distance and vehicle type
 * @param distance Distance in kilometers
 * @param vehicleType Type of vehicle
 * @returns Delivery fee in rupees
 */
export const calculateDeliveryFee = (distance: number, vehicleType: '2wheeler' | '3wheeler' | '4wheeler'): number => {
  const rates = {
    '2wheeler': { base: 20, perKm: 10 },
    '3wheeler': { base: 30, perKm: 15 },
    '4wheeler': { base: 40, perKm: 20 }
  };
  
  const rate = rates[vehicleType];
  if (distance <= 1) {
    return rate.base;
  }
  return rate.base + (Math.ceil(distance - 1) * rate.perKm);
};

/**
 * Calculate distance between retailer location and customer address
 * Handles both coordinate pairs and Google Maps URLs
 * @param retailerLat Retailer latitude
 * @param retailerLng Retailer longitude
 * @param customerAddress Customer address (can be coordinates object or Google Maps URL)
 * @returns Promise with distance in kilometers or 0 if calculation fails
 */
export const calculateDeliveryDistance = async (
  retailerLat: number,
  retailerLng: number,
  customerAddress: { lat: number; lng: number } | string
): Promise<number> => {
  try {
    let customerCoords: { lat: number; lng: number } | null = null;

    // If customerAddress is a string (Google Maps URL), extract coordinates
    if (typeof customerAddress === 'string') {
      customerCoords = await extractCoordinatesFromGoogleMapsUrl(customerAddress);
    } else if (customerAddress && typeof customerAddress === 'object' && 'lat' in customerAddress && 'lng' in customerAddress) {
      // If customerAddress is already coordinates object
      customerCoords = customerAddress;
    }

    if (!customerCoords) {
      console.warn('Could not extract customer coordinates from:', customerAddress);
      return 0;
    }

    // Validate coordinates
    if (!isValidCoordinate(retailerLat, retailerLng) || !isValidCoordinate(customerCoords.lat, customerCoords.lng)) {
      console.warn('Invalid coordinates provided');
      return 0;
    }

    return calculateDistance(retailerLat, retailerLng, customerCoords.lat, customerCoords.lng);
  } catch (error) {
    console.error('Error calculating delivery distance:', error);
    return 0;
  }
};

/**
 * Validate if coordinates are valid
 * @param lat Latitude
 * @param lng Longitude
 * @returns True if coordinates are valid
 */
const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' && 
    typeof lng === 'number' &&
    !isNaN(lat) && 
    !isNaN(lng) &&
    lat >= -90 && 
    lat <= 90 &&
    lng >= -180 && 
    lng <= 180
  );
};

/**
 * Get user's current location
 * Note: This function is for web compatibility. In React Native, use Expo Location directly.
 * @returns Promise with user coordinates or null
 */
export const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    // For React Native, this should not be used directly
    // Use Expo Location in the component instead
    console.warn('getCurrentLocation should not be used in React Native. Use Expo Location directly.');
    resolve(null);
  });
};

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(2)} km`;
};

/**
 * Test function to validate Google Maps URL parsing
 * @param testUrls Array of test URLs
 */
export const testGoogleMapsUrlParsing = (testUrls: string[]) => {
  console.log('Testing Google Maps URL parsing:');
  testUrls.forEach((url, index) => {
    const coords = extractCoordinatesFromGoogleMapsUrl(url);
    console.log(`Test ${index + 1}:`, url);
    console.log('Extracted coordinates:', coords);
    console.log('---');
  });
};

/**
 * Debug function to help troubleshoot coordinate extraction
 * @param mapsUrl Google Maps URL to debug
 * @returns Promise with debug information about the extraction process
 */
export const debugCoordinateExtraction = async (mapsUrl: string) => {
  console.log('=== DEBUG: Coordinate Extraction ===');
  console.log('Original URL:', mapsUrl);
  
  if (!mapsUrl || typeof mapsUrl !== 'string') {
    console.log('❌ Invalid input: URL is null, undefined, or not a string');
    return null;
  }
  
  const cleanUrl = decodeURIComponent(mapsUrl.trim());
  console.log('Cleaned URL:', cleanUrl);
  
  const patterns = [
    { name: '@lat,lng,zoom (most common)', regex: /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'll=lat,lng (legacy)', regex: /ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'q=lat,lng (query)', regex: /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: '/place/@lat,lng', regex: /\/place\/[^@]*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'maps.google.com/?q=', regex: /maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'lat/lng parameters', regex: /[?&](?:lat|latitude)=(-?\d+(?:\.\d+)?).*[?&](?:lng|longitude|lon)=(-?\d+(?:\.\d+)?)/ },
    { name: 'lng/lat parameters', regex: /[?&](?:lng|longitude|lon)=(-?\d+(?:\.\d+)?).*[?&](?:lat|latitude)=(-?\d+(?:\.\d+)?)/ },
    { name: '/dir/ URLs', regex: /\/dir\/[^/]*\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'Short URLs', regex: /goo\.gl\/maps\/.*[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'center parameter', regex: /[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/ },
    { name: 'Data parameters', regex: /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/ },
    { name: 'Simple lat,lng', regex: /(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/ }
  ];
  
  console.log('\n🔍 Testing patterns:');
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = cleanUrl.match(pattern.regex);
    
    if (match) {
      let lat, lng;
      
      if (i === 6) { // lng/lat pattern
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      } else {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
      
      const isValid = isValidCoordinate(lat, lng);
      console.log(`✅ Pattern ${i + 1} (${pattern.name}): Found coordinates`);
      console.log(`   Raw match: [${match[1]}, ${match[2]}]`);
      console.log(`   Parsed: lat=${lat}, lng=${lng}`);
      console.log(`   Valid: ${isValid}`);
      
      if (isValid) {
        console.log('\n🎯 SUCCESS: Valid coordinates extracted!');
        return { lat, lng, pattern: pattern.name };
      }
    } else {
      console.log(`❌ Pattern ${i + 1} (${pattern.name}): No match`);
    }
  }
  
  console.log('\n🔍 Trying Geocoding API as fallback...');
  const geocodingResult = await extractCoordinatesUsingGeocodingAPI(cleanUrl);
  
  if (geocodingResult) {
    console.log('\n🎯 SUCCESS: Coordinates extracted using Geocoding API!');
    console.log('   Coordinates:', geocodingResult);
    return { ...geocodingResult, pattern: 'Geocoding API' };
  }
  
  console.log('\n❌ FAILED: No valid coordinates found in URL');
  return null;
};

// Example usage and test URLs
if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
  // Test URLs for development
  const testUrls = [
    'https://maps.google.com/?q=12.9716,77.5946',
    'https://www.google.com/maps/@12.9716,77.5946,15z',
    'https://www.google.com/maps/place/Bangalore/@12.9716,77.5946,10z',
    'https://maps.google.com/?ll=12.9716,77.5946',
    'https://goo.gl/maps/xyz?q=12.9716,77.5946'
  ];
  
  // Uncomment to test in development
  // testGoogleMapsUrlParsing(testUrls);
}