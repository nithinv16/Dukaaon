# Caching Strategy Documentation

## Overview

This document outlines the comprehensive caching strategy implemented for the DukaaOn website to optimize performance, reduce server load, and improve user experience.

## Caching Principles

### 1. Stale-While-Revalidate (SWR)
The primary caching strategy uses the `stale-while-revalidate` pattern, which:
- Serves cached content immediately (fast response)
- Revalidates in the background
- Updates cache for next request
- Provides optimal balance between freshness and performance

### 2. Cache Layers
- **Browser Cache**: Client-side caching for static assets
- **CDN Cache**: Edge caching via Vercel CDN
- **Server Cache**: Next.js ISR (Incremental Static Regeneration)

## API Route Caching

### GET /api/sellers
**Purpose**: Location-based seller listings

**Caching Strategy**:
```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

**Details**:
- Cache Duration: 5 minutes (300 seconds)
- Stale Duration: 10 minutes (600 seconds)
- Revalidation: Every 5 minutes via Next.js `revalidate: 300`
- Rationale: Seller data changes infrequently, but location-based queries are dynamic

**Special Cases**:
- Empty results: Cached for 2 minutes
- Errors: Not cached (`no-store`)
- Invalid parameters: Not cached

### GET /api/sellers/[id]
**Purpose**: Individual seller details

**Caching Strategy**:
```
Cache-Control: public, s-maxage=600, stale-while-revalidate=1800
```

**Details**:
- Cache Duration: 10 minutes (600 seconds)
- Stale Duration: 30 minutes (1800 seconds)
- Revalidation: Every 10 minutes via Next.js `revalidate: 600`
- Rationale: Seller profiles change rarely, can be cached longer

**Special Cases**:
- 404 responses: Cached for 1 minute
- Errors: Not cached

### GET /api/products
**Purpose**: Products by seller

**Caching Strategy**:
```
Cache-Control: public, s-maxage=600, stale-while-revalidate=1800
```

**Details**:
- Cache Duration: 10 minutes (600 seconds)
- Stale Duration: 30 minutes (1800 seconds)
- Revalidation: Every 10 minutes via Next.js `revalidate: 600`
- Rationale: Product catalogs are relatively stable

### GET /api/geolocation
**Purpose**: IP-based location fallback

**Caching Strategy**:
```
Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200
```

**Details**:
- Cache Duration: 1 hour (3600 seconds)
- Stale Duration: 2 hours (7200 seconds)
- Revalidation: Every hour via Next.js `revalidate: 3600`
- Rationale: IP geolocation rarely changes, can be cached aggressively

### POST /api/enquiry
**Purpose**: Form submissions

**Caching Strategy**:
```
Cache-Control: no-store, no-cache, must-revalidate
```

**Details**:
- No caching for POST requests
- Each submission must be processed
- Rate limiting applied (5 requests per minute per IP)

## Static Asset Caching

### Next.js Build Assets
**Path**: `/_next/static/*`

**Caching Strategy**:
```
Cache-Control: public, max-age=31536000, immutable
```

**Details**:
- Cache Duration: 1 year (31536000 seconds)
- Immutable: Content never changes (versioned URLs)
- Includes: JavaScript bundles, CSS files, chunks

### Optimized Images
**Path**: `/_next/image/*`

**Caching Strategy**:
```
Cache-Control: public, max-age=31536000, immutable
```

**Details**:
- Cache Duration: 1 year
- Next.js Image Optimization with WebP/AVIF
- Responsive image variants cached separately

### Public Assets
**Paths**: `/images/*`, `/fonts/*`, `/static/*`

**Caching Strategy**:
```
Cache-Control: public, max-age=31536000, immutable
```

**Details**:
- Cache Duration: 1 year
- Includes: Images, fonts, icons, static files
- Use versioned filenames for cache busting

### Metadata Files
**Files**: `favicon.ico`, `robots.txt`, `site.webmanifest`

**Caching Strategy**:
```
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

**Details**:
- Cache Duration: 1 day (86400 seconds)
- Stale Duration: 7 days (604800 seconds)
- Balance between freshness and performance

### HTML Pages
**Path**: All page routes

**Caching Strategy**:
```
Cache-Control: public, max-age=0, must-revalidate
```

**Details**:
- Always revalidate with server
- Ensures fresh content on navigation
- ISR handles page-level caching

## Next.js ISR Configuration

### Page-Level Revalidation

```typescript
// app/marketplace/page.tsx
export const revalidate = 300; // 5 minutes

// app/seller/[id]/page.tsx
export const revalidate = 600; // 10 minutes

// app/page.tsx (home)
export const revalidate = 3600; // 1 hour
```

### Dynamic Routes
- Marketplace: Revalidate every 5 minutes
- Seller profiles: Revalidate every 10 minutes
- Static pages: Revalidate every hour

## CDN Configuration

### Vercel-Specific Headers

```
CDN-Cache-Control: public, s-maxage=<duration>
Vercel-CDN-Cache-Control: public, s-maxage=<duration>, stale-while-revalidate=<duration>
```

**Purpose**:
- Control edge caching behavior
- Separate from browser cache directives
- Optimize for global distribution

## Cache Invalidation

### Manual Invalidation
When data changes significantly:
1. Deploy new version (clears all caches)
2. Use Vercel's cache purge API
3. Update revalidation timestamps

### Automatic Invalidation
- ISR automatically revalidates based on `revalidate` settings
- Stale-while-revalidate ensures background updates
- On-demand revalidation via API routes (future enhancement)

## Performance Metrics

### Expected Improvements
- **First Load**: 20-30% faster with CDN caching
- **Subsequent Loads**: 50-70% faster with browser caching
- **API Response Time**: 80-90% faster with stale-while-revalidate
- **Server Load**: 60-70% reduction with effective caching

### Monitoring
Monitor these metrics:
- Cache hit ratio (target: >80%)
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- API response times

## Best Practices

### 1. Cache Keys
- Include relevant query parameters in cache keys
- Location-based queries use lat/lng in cache key
- Filter parameters affect cache key

### 2. Cache Busting
- Use versioned URLs for static assets
- Next.js automatically versions build assets
- Manual versioning for custom assets

### 3. Error Handling
- Never cache error responses
- Use `no-store` for 5xx errors
- Short cache for 4xx errors (1 minute)

### 4. Security
- No caching for authenticated requests
- No caching for POST/PUT/DELETE requests
- Rate limiting independent of caching

## Testing Caching

### Verify Cache Headers
```bash
# Check API response headers
curl -I https://dukaaon.com/api/sellers?latitude=12.9716&longitude=77.5946

# Check static asset headers
curl -I https://dukaaon.com/_next/static/chunks/main.js
```

### Browser DevTools
1. Open Network tab
2. Check "Disable cache" to test without cache
3. Look for "from disk cache" or "from memory cache"
4. Verify Cache-Control headers

### Lighthouse
Run Lighthouse audit to verify:
- "Serve static assets with efficient cache policy"
- Performance score impact

## Future Enhancements

### 1. Redis Cache Layer
- Add Redis for server-side caching
- Cache database query results
- Reduce database load

### 2. On-Demand Revalidation
- API endpoint to trigger cache invalidation
- Webhook from Supabase on data changes
- Real-time cache updates

### 3. Service Worker
- Offline support with service worker
- Cache-first strategy for static assets
- Network-first for dynamic content

### 4. GraphQL with DataLoader
- Batch and cache database queries
- Reduce N+1 query problems
- Optimize data fetching

## Troubleshooting

### Cache Not Working
1. Check Cache-Control headers in response
2. Verify Vercel deployment settings
3. Check for cache-busting query parameters
4. Ensure no conflicting headers

### Stale Data
1. Reduce revalidation time
2. Implement on-demand revalidation
3. Check ISR configuration
4. Verify database updates

### Performance Issues
1. Monitor cache hit ratio
2. Check CDN edge locations
3. Verify image optimization
4. Review bundle sizes

## References

- [Next.js Caching Documentation](https://nextjs.org/docs/app/building-your-application/caching)
- [HTTP Caching MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Vercel Edge Network](https://vercel.com/docs/edge-network/overview)
- [Stale-While-Revalidate RFC](https://tools.ietf.org/html/rfc5861)
