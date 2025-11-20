import { NextRequest, NextResponse } from 'next/server';
import { CachePresets, REVALIDATE_TIMES } from '@/lib/cache';

interface GeolocationResponse {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default (this shouldn't happen in production)
  return 'unknown';
}

/**
 * Fetch geolocation data from ip-api.com (free, no API key required)
 * Rate limit: 45 requests per minute
 */
async function getLocationFromIPAPI(ip: string): Promise<GeolocationResponse> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon`,
      {
        headers: {
          'User-Agent': 'DukaaOn-Website/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`IP API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'fail') {
      throw new Error(data.message || 'Failed to get location from IP');
    }

    return {
      latitude: data.lat,
      longitude: data.lon,
      city: data.city,
      state: data.regionName,
      country: data.country,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch location from IP API'
    );
  }
}

/**
 * Fetch geolocation data from ipapi.co (free tier: 1000 requests/day, no API key required)
 * Fallback option if ip-api.com fails
 */
async function getLocationFromIPAPICo(ip: string): Promise<GeolocationResponse> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'DukaaOn-Website/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`IPAPI.co request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.reason || 'Failed to get location from IP');
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      state: data.region,
      country: data.country_name,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch location from IPAPI.co'
    );
  }
}

/**
 * Default location for India (approximate center)
 * Used as last resort fallback
 */
const DEFAULT_INDIA_LOCATION: GeolocationResponse = {
  latitude: 20.5937,
  longitude: 78.9629,
  city: 'India',
  state: 'Central India',
  country: 'India',
};

// Configure route segment for caching
export const dynamic = 'force-dynamic'; // Always run dynamically due to IP-based queries
export const revalidate = REVALIDATE_TIMES.GEOLOCATION_API;

/**
 * GET /api/geolocation
 * Get user's approximate location based on their IP address
 * This is used as a fallback when browser geolocation is denied
 */
export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    // If IP is unknown or localhost, return default India location
    if (
      clientIP === 'unknown' ||
      clientIP === '127.0.0.1' ||
      clientIP === '::1' ||
      clientIP.startsWith('192.168.') ||
      clientIP.startsWith('10.') ||
      clientIP.startsWith('172.')
    ) {
      console.warn('Local or unknown IP detected, returning default India location');
      return NextResponse.json(
        {
          success: true,
          data: DEFAULT_INDIA_LOCATION,
          message: 'Using default location (local IP detected)',
        },
        {
          headers: CachePresets.geolocation(),
        }
      );
    }

    // Try primary geolocation service (ip-api.com)
    try {
      const location = await getLocationFromIPAPI(clientIP);
      return NextResponse.json(
        {
          success: true,
          data: location,
        },
        {
          headers: CachePresets.geolocation(),
        }
      );
    } catch (primaryError) {
      console.warn('Primary geolocation service failed:', primaryError);

      // Try fallback service (ipapi.co)
      try {
        const location = await getLocationFromIPAPICo(clientIP);
        return NextResponse.json(
          {
            success: true,
            data: location,
          },
          {
            headers: CachePresets.geolocation(),
          }
        );
      } catch (fallbackError) {
        console.error('Fallback geolocation service also failed:', fallbackError);

        // Return default India location as last resort
        return NextResponse.json(
          {
            success: true,
            data: DEFAULT_INDIA_LOCATION,
            message: 'Using default location (geolocation services unavailable)',
          },
          {
            headers: CachePresets.geolocation(),
          }
        );
      }
    }
  } catch (error) {
    console.error('Geolocation API error:', error);

    // Even on error, return default location instead of failing
    return NextResponse.json(
      {
        success: true,
        data: DEFAULT_INDIA_LOCATION,
        message: 'Using default location (error occurred)',
      },
      {
        headers: CachePresets.geolocation(),
      }
    );
  }
}
