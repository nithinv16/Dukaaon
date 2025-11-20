import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateDistance } from '@/lib/geolocation';
import { CachePresets, REVALIDATE_TIMES } from '@/lib/cache';

interface SellerQueryParams {
  latitude: number;
  longitude: number;
  radius?: number;
  businessType?: 'wholesaler' | 'manufacturer';
  category?: string;
  page?: number;
  limit?: number;
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): {
  params: SellerQueryParams | null;
  error: string | null;
} {
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');

  if (!latitude || !longitude) {
    return {
      params: null,
      error: 'Missing required parameters: latitude and longitude',
    };
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return {
      params: null,
      error: 'Invalid latitude or longitude values',
    };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      params: null,
      error: 'Latitude must be between -90 and 90, longitude between -180 and 180',
    };
  }

  const radius = searchParams.get('radius');
  const businessType = searchParams.get('businessType');
  const category = searchParams.get('category');
  const page = searchParams.get('page');
  const limit = searchParams.get('limit');

  return {
    params: {
      latitude: lat,
      longitude: lng,
      radius: radius ? Math.min(Math.max(parseFloat(radius), 1), 500) : 100, // Default 100km, max 500km
      businessType: businessType as 'wholesaler' | 'manufacturer' | undefined,
      category: category || undefined,
      page: page ? Math.max(parseInt(page), 1) : 1,
      limit: limit ? Math.min(Math.max(parseInt(limit), 1), 100) : 20, // Default 20, max 100
    },
    error: null,
  };
}

// Configure route segment for caching
export const dynamic = 'force-dynamic'; // Always run dynamically due to location-based queries
export const revalidate = REVALIDATE_TIMES.SELLERS_API;

/**
 * GET /api/sellers
 * Query sellers based on location and filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { params, error } = parseQueryParams(searchParams);

    if (error || !params) {
      return NextResponse.json(
        {
          success: false,
          error: error || 'Invalid parameters',
        },
        { 
          status: 400,
          headers: CachePresets.error(),
        }
      );
    }

    // Build query
    let query = supabase
      .from('seller_details')
      .select(
        `
        id,
        user_id,
        business_name,
        seller_type,
        description,
        location_address,
        address,
        latitude,
        longitude,
        tags,
        image_url
      `
      )
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    // Apply business type filter (using seller_type column)
    if (params.businessType) {
      query = query.eq('seller_type', params.businessType);
    }

    // Apply category filter (using tags column)
    if (params.category) {
      query = query.contains('tags', [params.category]);
    }

    // Execute query
    const { data: sellers, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch sellers',
        },
        { 
          status: 500,
          headers: CachePresets.error(),
        }
      );
    }

    if (!sellers || sellers.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            sellers: [],
            count: 0,
            page: params.page,
            limit: params.limit,
            totalPages: 0,
          },
        },
        {
          headers: CachePresets.emptyResults(),
        }
      );
    }

    // Calculate distances and filter by radius
    const sellersWithDistance = sellers
      .map((seller) => {
        const distance = calculateDistance(
          { latitude: params.latitude, longitude: params.longitude },
          { latitude: seller.latitude, longitude: seller.longitude }
        );

        // Parse tags if it's a JSON string or ensure it's an array
        let categories: string[] = [];
        if (seller.tags) {
          if (typeof seller.tags === 'string') {
            try {
              categories = JSON.parse(seller.tags);
            } catch {
              categories = [];
            }
          } else if (Array.isArray(seller.tags)) {
            categories = seller.tags;
          } else {
            categories = [];
          }
        }

        // Parse address JSONB to extract city and state
        let city = '';
        let state = '';
        if (seller.address) {
          if (typeof seller.address === 'object') {
            city = seller.address.city || '';
            state = seller.address.state || '';
          } else if (typeof seller.address === 'string') {
            try {
              const addressObj = JSON.parse(seller.address);
              city = addressObj.city || '';
              state = addressObj.state || '';
            } catch {
              // If parsing fails, use location_address field as fallback
              city = seller.location_address || '';
            }
          }
        } else if (seller.location_address) {
          // Fallback to location_address field
          city = seller.location_address;
        }

        return {
          id: seller.user_id,
          businessName: seller.business_name,
          businessType: seller.seller_type,
          location: {
            city,
            state,
            coordinates: {
              latitude: seller.latitude,
              longitude: seller.longitude,
            },
          },
          categories,
          thumbnailImage: seller.image_url,
          description: seller.description,
          distance,
        };
      })
      .filter((seller) => seller.distance <= params.radius!)
      .sort((a, b) => a.distance - b.distance);

    // Apply pagination
    const totalCount = sellersWithDistance.length;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSellers = sellersWithDistance.slice(startIndex, endIndex);

    return NextResponse.json(
      {
        success: true,
        data: {
          sellers: paginatedSellers,
          count: paginatedSellers.length,
          totalCount,
          page,
          limit,
          totalPages,
        },
      },
      {
        headers: CachePresets.sellersList(),
      }
    );
  } catch (error) {
    console.error('Sellers API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { 
        status: 500,
        headers: CachePresets.error(),
      }
    );
  }
}
