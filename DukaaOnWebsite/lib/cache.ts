/**
 * Cache Configuration Constants
 * Centralized cache durations and strategies for the application
 */

/**
 * Cache durations in seconds
 */
export const CACHE_DURATIONS = {
  // API Routes
  SELLERS_LIST: 300, // 5 minutes
  SELLER_DETAIL: 600, // 10 minutes
  PRODUCTS: 600, // 10 minutes
  GEOLOCATION: 3600, // 1 hour
  
  // Static Assets
  IMMUTABLE: 31536000, // 1 year
  METADATA: 86400, // 1 day
  
  // Error Responses
  NOT_FOUND: 60, // 1 minute
  ERROR: 0, // No cache
} as const;

/**
 * Stale-while-revalidate durations in seconds
 */
export const SWR_DURATIONS = {
  SELLERS_LIST: 600, // 10 minutes
  SELLER_DETAIL: 1800, // 30 minutes
  PRODUCTS: 1800, // 30 minutes
  GEOLOCATION: 7200, // 2 hours
  NOT_FOUND: 120, // 2 minutes
  METADATA: 604800, // 7 days
} as const;

/**
 * Cache control header builders
 */
export const CacheControl = {
  /**
   * No caching - for POST requests, errors, and sensitive data
   */
  noStore: () => ({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }),

  /**
   * Public cache with stale-while-revalidate
   * @param maxAge - Cache duration in seconds
   * @param staleWhileRevalidate - SWR duration in seconds
   */
  public: (maxAge: number, staleWhileRevalidate: number) => ({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'CDN-Cache-Control': `public, s-maxage=${maxAge}`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  }),

  /**
   * Immutable cache for static assets
   */
  immutable: () => ({
    'Cache-Control': `public, max-age=${CACHE_DURATIONS.IMMUTABLE}, immutable`,
  }),

  /**
   * Revalidate on every request
   */
  revalidate: () => ({
    'Cache-Control': 'public, max-age=0, must-revalidate',
  }),

  /**
   * Rate limit response
   * @param retryAfter - Seconds to wait before retrying
   */
  rateLimit: (retryAfter: number = 60) => ({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Retry-After': retryAfter.toString(),
  }),
} as const;

/**
 * Preset cache configurations for common use cases
 */
export const CachePresets = {
  /**
   * Seller list API response
   */
  sellersList: () =>
    CacheControl.public(CACHE_DURATIONS.SELLERS_LIST, SWR_DURATIONS.SELLERS_LIST),

  /**
   * Individual seller detail API response
   */
  sellerDetail: () =>
    CacheControl.public(CACHE_DURATIONS.SELLER_DETAIL, SWR_DURATIONS.SELLER_DETAIL),

  /**
   * Products API response
   */
  products: () =>
    CacheControl.public(CACHE_DURATIONS.PRODUCTS, SWR_DURATIONS.PRODUCTS),

  /**
   * Geolocation API response
   */
  geolocation: () =>
    CacheControl.public(CACHE_DURATIONS.GEOLOCATION, SWR_DURATIONS.GEOLOCATION),

  /**
   * 404 Not Found response
   */
  notFound: () =>
    CacheControl.public(CACHE_DURATIONS.NOT_FOUND, SWR_DURATIONS.NOT_FOUND),

  /**
   * Empty results response
   */
  emptyResults: () =>
    CacheControl.public(120, 240), // 2 minutes cache, 4 minutes stale

  /**
   * Error response (no cache)
   */
  error: () => CacheControl.noStore(),

  /**
   * Static asset
   */
  staticAsset: () => CacheControl.immutable(),

  /**
   * Metadata files (favicon, robots.txt, etc.)
   */
  metadata: () =>
    CacheControl.public(CACHE_DURATIONS.METADATA, SWR_DURATIONS.METADATA),
} as const;

/**
 * Next.js ISR revalidation times (in seconds)
 */
export const REVALIDATE_TIMES = {
  HOME_PAGE: 3600, // 1 hour
  ABOUT_PAGE: 3600, // 1 hour
  CONTACT_PAGE: 3600, // 1 hour
  MARKETPLACE_PAGE: 300, // 5 minutes
  SELLER_PROFILE_PAGE: 600, // 10 minutes
  
  // API Routes
  SELLERS_API: 300, // 5 minutes
  SELLER_DETAIL_API: 600, // 10 minutes
  PRODUCTS_API: 600, // 10 minutes
  GEOLOCATION_API: 3600, // 1 hour
} as const;

/**
 * Helper to create response with cache headers
 */
export function createCachedResponse<T>(
  data: T,
  status: number,
  cacheHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cacheHeaders,
    },
  });
}

/**
 * Type for cache configuration
 */
export type CacheConfig = {
  maxAge: number;
  staleWhileRevalidate?: number;
  revalidate?: number;
};

/**
 * Get cache configuration for a specific resource type
 */
export function getCacheConfig(resourceType: keyof typeof CachePresets): CacheConfig {
  const preset = CachePresets[resourceType];
  const headers = preset();
  
  // Parse Cache-Control header to extract values
  const cacheControl = headers['Cache-Control'];
  const maxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
  const swrMatch = cacheControl.match(/stale-while-revalidate=(\d+)/);
  
  return {
    maxAge: maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0,
    staleWhileRevalidate: swrMatch ? parseInt(swrMatch[1]) : undefined,
  };
}
