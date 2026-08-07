/**
 * SellersDataService - Simple sellers data fetching
 * 
 * Simple, direct queries to fetch wholesalers and manufacturers.
 */

import { supabase } from '../supabase/supabase';

export interface Seller {
  id: string;
  user_id: string;
  business_name: string;
  address: any;
  image_url: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  seller_type: 'wholesaler' | 'manufacturer';
  description?: string;
  categories?: string[];
}

export interface SellersFetchOptions {
  userId: string;
  userLocation?: { latitude: number; longitude: number };
  radiusKm?: number;
  sellerType: 'wholesaler' | 'manufacturer';
  useCache?: boolean;
}

export interface SellersFetchResult {
  sellers: Seller[];
  fromCache: boolean;
  error?: string;
}

// Simple in-memory cache
interface CacheEntry {
  data: Seller[];
  timestamp: number;
}

class SellersDataServiceClass {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate distance using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /**
   * Generate cache key with location and radius
   * Different radii get different cache entries for accurate results
   */
  private getCacheKey(sellerType: string, userLocation?: { latitude: number; longitude: number }, radiusKm?: number): string {
    if (userLocation && radiusKm) {
      // Include location and radius in cache key (rounded to 0.1km precision)
      return `${sellerType}_${userLocation.latitude.toFixed(2)}_${userLocation.longitude.toFixed(2)}_${Math.round(radiusKm * 10) / 10}`;
    }
    return `${sellerType}_all`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(entry: CacheEntry | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  /**
   * Fetch sellers - fetches only sellers within specified radius for efficiency
   */
  async fetchNearbySellers(options: SellersFetchOptions): Promise<SellersFetchResult> {
    const { sellerType, userLocation, radiusKm } = options;

    if (userLocation && radiusKm) {
      console.log(`[SellersDataService] Fetching ${sellerType}s within ${radiusKm}km`);
    } else {
      console.log(`[SellersDataService] Fetching ${sellerType}s (no location filter)`);
    }

    // Check cache first - cache key includes location and radius
    const cacheKey = this.getCacheKey(sellerType, userLocation, radiusKm);
    const cached = this.cache.get(cacheKey);
    if (this.isCacheValid(cached)) {
      console.log(`[SellersDataService] Cache hit for ${sellerType}s (${cached!.data.length} items)`);
      return { sellers: cached!.data, fromCache: true };
    }

    const startTime = Date.now();

    try {
      let data: any[] | null = null;
      let error: any = null;

      const rpcFunction = sellerType === 'wholesaler' ? 'get_wholesalers' : 'get_manufacturers';
      
      // Prepare RPC parameters - pass location and radius if available
      const rpcParams: any = {};
      if (userLocation && radiusKm) {
        rpcParams.user_lat = userLocation.latitude;
        rpcParams.user_lng = userLocation.longitude;
        rpcParams.radius_km = radiusKm;
      }
      
      // Try RPC function with location filtering
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcFunction, rpcParams);
      
      if (!rpcError && rpcData) {
        data = rpcData;
      } else {
        // Fallback to direct query
        console.log(`[SellersDataService] RPC not available, using direct query`);
        let query = supabase
          .from('seller_details')
          .select('user_id, business_name, address, image_url, latitude, longitude, description')
          .eq('seller_type', sellerType)
          .not('business_name', 'is', null)
          .not('business_name', 'eq', '');
        
        // Add location filtering if provided
        if (userLocation && radiusKm) {
          const latDelta = radiusKm / 111.0;
          const lngDelta = radiusKm / (111.0 * Math.cos(userLocation.latitude * Math.PI / 180));
          const minLat = userLocation.latitude - latDelta;
          const maxLat = userLocation.latitude + latDelta;
          const minLng = userLocation.longitude - lngDelta;
          const maxLng = userLocation.longitude + lngDelta;
          
          query = query
            .gte('latitude', minLat)
            .lte('latitude', maxLat)
            .gte('longitude', minLng)
            .lte('longitude', maxLng);
        }
        
        const { data: queryData, error: queryError } = await query;
        data = queryData;
        error = queryError;
      }

      if (error) {
        console.error(`[SellersDataService] Query error:`, error);
        return { sellers: [], fromCache: false, error: error.message };
      }

      if (!data || data.length === 0) {
        console.log(`[SellersDataService] No ${sellerType}s found in database`);
        return { sellers: [], fromCache: false };
      }

      // Transform to Seller format
      let sellers: Seller[] = data.map((item: any) => ({
        id: item.user_id,
        user_id: item.user_id,
        business_name: item.business_name || 'Business',
        address: item.address,
        image_url: item.image_url || null,
        latitude: item.latitude,
        longitude: item.longitude,
        distance: item.distance || undefined, // Distance already calculated by RPC if location provided
        seller_type: sellerType,
        description: item.description || null,
      }));

      // If RPC didn't calculate distance (no location params), calculate it client-side
      if (userLocation && radiusKm && (!sellers[0]?.distance)) {
        sellers = sellers
          .map((seller) => ({
            ...seller,
            distance: seller.latitude && seller.longitude
              ? this.calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  seller.latitude,
                  seller.longitude
                )
              : 999999
          }))
          .filter((seller) => seller.distance <= radiusKm)
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      } else if (userLocation && radiusKm) {
        // Distance already calculated by RPC, just ensure it's sorted
        sellers = sellers.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      // Cache results
      this.cache.set(cacheKey, { 
        data: sellers, 
        timestamp: Date.now()
      });

      const fetchTime = Date.now() - startTime;
      console.log(`[SellersDataService] Fetched ${sellers.length} ${sellerType}s in ${fetchTime}ms`);

      return { sellers, fromCache: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SellersDataService] Error:`, errorMessage);

      // Return cached data if available (even if stale)
      if (cached) {
        console.log(`[SellersDataService] Returning stale cache`);
        return { sellers: cached.data, fromCache: true };
      }

      return { sellers: [], fromCache: false, error: errorMessage };
    }
  }

  /**
   * Get cached sellers (searches for any cached entry for this seller type)
   */
  async getCachedSellers(userId: string, sellerType: 'wholesaler' | 'manufacturer'): Promise<SellersFetchResult | null> {
    // Try to find any cache entry for this seller type
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(sellerType) && entry.data.length > 0) {
        return { sellers: entry.data, fromCache: true };
      }
    }
    return null;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(): Promise<void> {
    this.cache.clear();
  }
}

// Export singleton
export const SellersDataService = new SellersDataServiceClass();
export { SellersDataServiceClass };
