import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CachePresets, REVALIDATE_TIMES } from '@/lib/cache';

// Configure route segment for caching
export const revalidate = REVALIDATE_TIMES.PRODUCTS_API;

/**
 * GET /api/products
 * Fetch products by seller_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('seller_id');

    if (!sellerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'seller_id parameter is required',
        },
        { 
          status: 400,
          headers: CachePresets.error(),
        }
      );
    }

    // Fetch products for this seller
    const { data, error: dbError } = await supabase
      .from('products')
      .select('id, name, image_url, category, subcategory, brand, description')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch products',
        },
        { 
          status: 500,
          headers: CachePresets.error(),
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: data || [],
      },
      {
        headers: CachePresets.products(),
      }
    );
  } catch (error) {
    console.error('Products API error:', error);
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
