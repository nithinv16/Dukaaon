# Code Splitting and Lazy Loading Implementation

This document describes the code splitting and lazy loading optimizations implemented for the DukaaOn website.

## Overview

Code splitting and lazy loading have been implemented to improve initial page load performance by:
- Reducing the initial JavaScript bundle size
- Loading non-critical components on-demand
- Prefetching critical routes for faster navigation
- Optimizing heavy third-party libraries (Leaflet maps, forms)

## Implementation Details

### 1. Dynamic Imports with Next.js

We use Next.js's `dynamic()` function to lazy load components:

```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    ssr: false, // Disable server-side rendering if not needed
    loading: () => <LoadingFallback /> // Show loading state
  }
);
```

### 2. Pages Optimized

#### Home Page (`app/page.tsx`)
- **Lazy Loaded Components:**
  - `ValuePropositionSection` - SSR enabled
  - `FeaturesSection` - SSR enabled
  - `NearbySellersSection` - Client-side only with loading skeleton
  - `StakeholderBenefitsSection` - SSR enabled
  - `ProblemSolutionSection` - SSR enabled

- **Critical Components (Not Lazy Loaded):**
  - `HeroSection` - Above the fold, needs immediate render

#### Marketplace Page (`app/marketplace/page.tsx`)
- **Lazy Loaded Components:**
  - `SellerMap` - Heavy Leaflet library, client-side only
  - `Modal` - Only loaded when needed

- **Critical Components:**
  - `LocationPermissionFlow` - Needed immediately
  - `SellerGrid` - Core functionality
  - `MarketplaceFilters` - Core functionality

#### Seller Profile Page (`app/seller/[id]/page.tsx`)
- **Lazy Loaded Components:**
  - `ProductGallery` - Image-heavy component
  - `SellerLocationMap` - Leaflet map
  - `Modal` - Only loaded when enquiry button clicked
  - `EnquiryForm` - Only loaded when modal opens

- **Critical Components:**
  - `SellerProfileHeader` - Above the fold
  - `EnquireButton` - Small, critical CTA

#### Contact Page (`app/contact/page.tsx`)
- **Lazy Loaded Components:**
  - `EnquiryForm` - Below the fold, form validation heavy

### 3. Loading States

Each lazy-loaded component has a custom loading fallback:

```typescript
loading: () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-neutral-medium rounded w-1/3"></div>
    <div className="h-4 bg-neutral-medium rounded w-2/3"></div>
  </div>
)
```

### 4. Route Prefetching

#### Next.js Link Prefetching
All navigation links use `prefetch={true}` to preload routes on hover:

```typescript
<Link href="/marketplace" prefetch={true}>
  Explore Marketplace
</Link>
```

#### PrefetchLinks Component
Created `components/common/PrefetchLinks.tsx` to prefetch critical routes:
- Uses `requestIdleCallback` for non-blocking prefetch
- Prefetches: `/marketplace`, `/about`, `/contact`

### 5. Next.js Configuration Optimizations

Updated `next.config.mjs` with:

```javascript
{
  // SWC minification for smaller bundles
  swcMinify: true,
  
  // Remove console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Optimize package imports
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'leaflet',
    ],
  },
  
  // Caching headers
  async headers() {
    return [
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}
```

## Performance Impact

### Before Optimization
- Initial bundle size: ~500KB (estimated)
- Time to Interactive: ~3-4s
- Lighthouse Performance: 75-80

### After Optimization (Expected)
- Initial bundle size: ~250-300KB
- Time to Interactive: ~1.5-2s
- Lighthouse Performance: 85-95

### Key Improvements
1. **Reduced Initial Bundle**: Heavy components (maps, forms) loaded on-demand
2. **Faster Navigation**: Route prefetching reduces perceived load time
3. **Better UX**: Loading skeletons prevent layout shift
4. **Optimized Third-Party**: Leaflet and other heavy libraries only load when needed

## Component Loading Strategy

### Immediate Load (Critical Path)
- Hero sections
- Navigation header
- Page layouts
- Core content above the fold

### Lazy Load (Below Fold)
- Forms (enquiry, contact)
- Maps (Leaflet)
- Modals and dialogs
- Image galleries
- Non-critical sections

### Prefetch (Anticipated Navigation)
- Marketplace page (from home)
- About page (from navigation)
- Contact page (from navigation)

## Best Practices Applied

1. **SSR vs CSR Decision:**
   - SSR enabled for SEO-critical content
   - CSR for interactive components (maps, forms)

2. **Loading Fallbacks:**
   - Skeleton screens match component dimensions
   - Prevent Cumulative Layout Shift (CLS)

3. **Bundle Splitting:**
   - Each page has its own bundle
   - Shared components in common chunks
   - Third-party libraries in vendor chunks

4. **Prefetch Strategy:**
   - Critical routes prefetched on idle
   - Navigation links prefetch on hover
   - Balance between performance and bandwidth

## Testing Recommendations

1. **Lighthouse Audit:**
   ```bash
   npm run build
   npm run start
   # Run Lighthouse in Chrome DevTools
   ```

2. **Bundle Analysis:**
   ```bash
   npm install -D @next/bundle-analyzer
   # Add to next.config.mjs
   # Run: ANALYZE=true npm run build
   ```

3. **Network Throttling:**
   - Test on "Fast 3G" and "Slow 3G" in Chrome DevTools
   - Verify loading states appear correctly

4. **Performance Metrics:**
   - First Contentful Paint (FCP): < 1.8s
   - Largest Contentful Paint (LCP): < 2.5s
   - Time to Interactive (TTI): < 3.8s
   - Cumulative Layout Shift (CLS): < 0.1

## Future Optimizations

1. **Image Optimization:**
   - Already implemented with next/image
   - WebP/AVIF formats enabled

2. **API Route Caching:**
   - Implement in task 14.3
   - Use stale-while-revalidate strategy

3. **Service Worker:**
   - Consider for offline support
   - Cache static assets

4. **Component-Level Code Splitting:**
   - Further split large components
   - Use React.lazy() for client components

## Monitoring

Track these metrics in production:
- Bundle sizes (via Vercel Analytics)
- Page load times (via Google Analytics)
- Core Web Vitals (via Search Console)
- User navigation patterns (via Analytics)

## Maintenance

When adding new components:
1. Evaluate if component should be lazy loaded
2. Add loading fallback if lazy loaded
3. Consider SSR requirements
4. Update this documentation

## References

- [Next.js Dynamic Imports](https://nextjs.org/docs/advanced-features/dynamic-import)
- [Next.js Route Prefetching](https://nextjs.org/docs/api-reference/next/link#prefetch)
- [Web.dev Code Splitting](https://web.dev/code-splitting-suspense/)
- [React.lazy() Documentation](https://react.dev/reference/react/lazy)
