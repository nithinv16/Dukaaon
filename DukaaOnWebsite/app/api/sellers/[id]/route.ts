import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CachePresets, REVALIDATE_TIMES } from '@/lib/cache';

// Configure route segment for caching
export const revalidate = REVALIDATE_TIMES.SELLER_DETAIL_API;

/**
 * GET /api/sellers/[id]
 * Fetch seller details by user_id
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sellerId = params.id;

    if (!sellerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Seller ID is required',
        },
        { 
          status: 400,
          headers: CachePresets.error(),
        }
      );
    }

    // Fetch seller details from seller_details table
    const { data, error: dbError } = await supabase
      .from('seller_details')
      .select('*')
      .eq('user_id', sellerId)
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Seller not found',
        },
        { 
          status: 404,
          headers: CachePresets.notFound(),
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Seller not found',
        },
        { 
          status: 404,
          headers: CachePresets.notFound(),
        }
      );
    }

    // Parse address JSONB to extract city and state
    let city = '';
    let state = '';
    if (data.address) {
      if (typeof data.address === 'object') {
        city = data.address.city || '';
        state = data.address.state || '';
      } else if (typeof data.address === 'string') {
        try {
          const addressObj = JSON.parse(data.address);
          city = addressObj.city || '';
          state = addressObj.state || '';
        } catch {
          city = data.location_address || '';
        }
      }
    } else if (data.location_address) {
      city = data.location_address;
    }

    // Parse tags if it's a JSON string or ensure it's an array
    let categories: string[] = [];
    if (data.tags) {
      if (typeof data.tags === 'string') {
        try {
          categories = JSON.parse(data.tags);
        } catch {
          categories = [];
        }
      } else if (Array.isArray(data.tags)) {
        categories = data.tags;
      }
    }

    // Transform the data to match the expected format
    const seller = {
      id: data.user_id,
      businessName: data.business_name || 'Unknown Business',
      businessType: data.seller_type || 'wholesaler',
      location: {
        city,
        state,
        coordinates: {
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
        },
      },
      categories,
      thumbnailImage: data.image_url,
      description: data.description,
    };

    return NextResponse.json(
      {
        success: true,
        data: seller,
      },
      {
        headers: CachePresets.sellerDetail(),
      }
    );
  } catch (error) {
    console.error('Seller API error:', error);
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
