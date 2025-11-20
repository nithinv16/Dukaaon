# Image Optimization Guide

This guide explains the image optimization implementation for the DukaaOn website, including best practices and usage examples.

## Overview

The website uses Next.js Image component with additional optimizations to ensure fast loading times and excellent user experience. All images are automatically optimized for:

- **Modern formats**: WebP and AVIF
- **Responsive sizing**: Different sizes for different screen sizes
- **Lazy loading**: Images load as they enter the viewport
- **Blur placeholders**: Smooth loading experience
- **Compression**: Optimal quality/size balance

## Configuration

### Next.js Image Configuration

The `next.config.mjs` file is configured with optimal image settings:

```javascript
images: {
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60,
}
```

### Remote Image Domains

Supabase storage URLs are configured as remote patterns:

```javascript
remotePatterns: [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
]
```

## Components

### OptimizedImage Component

A wrapper around Next.js Image with additional features:

```tsx
import { OptimizedImage } from '@/components/ui/OptimizedImage';

<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  fill
  layout="card"
  enableBlur
  blurColor="#FF6B35"
  quality={85}
/>
```

#### Props

- `layout`: Predefined responsive sizing ('card' | 'hero' | 'gallery' | 'profile')
- `enableBlur`: Enable blur placeholder (default: true)
- `blurColor`: Custom blur color in hex format
- `showSkeleton`: Show loading skeleton (default: true)
- `fallback`: React node to show if image fails to load
- `quality`: Image quality 1-100 (default: 80)

#### Layout Types

**Card Layout** - For seller cards in grid
```tsx
<OptimizedImage
  src={thumbnailImage}
  alt={businessName}
  fill
  layout="card"
  enableBlur
  quality={85}
/>
```
Sizes: `(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw`

**Hero Layout** - For full-width hero images
```tsx
<OptimizedImage
  src={heroImage}
  alt="Hero"
  fill
  layout="hero"
  priority
  quality={90}
/>
```
Sizes: `100vw`

**Gallery Layout** - For product galleries
```tsx
<OptimizedImage
  src={productImage}
  alt={productName}
  fill
  layout="gallery"
  enableBlur
  quality={85}
/>
```
Sizes: `(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw`

**Profile Layout** - For seller profile headers
```tsx
<OptimizedImage
  src={profileImage}
  alt={sellerName}
  fill
  layout="profile"
  priority
  quality={90}
/>
```
Sizes: `(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw`

## Utility Functions

### Image Optimization Utils

Located in `lib/imageOptimization.ts`:

#### generateBlurDataURL()
```typescript
import { generateBlurDataURL } from '@/lib/imageOptimization';

const blurDataURL = generateBlurDataURL(8, 8);
```

Generates a base64-encoded SVG for blur placeholders.

#### generateColoredBlurDataURL()
```typescript
import { generateColoredBlurDataURL } from '@/lib/imageOptimization';

const blurDataURL = generateColoredBlurDataURL('#FF6B35', 8, 8);
```

Generates a colored blur placeholder matching your brand colors.

#### optimizeSupabaseImage()
```typescript
import { optimizeSupabaseImage } from '@/lib/imageOptimization';

const optimizedUrl = optimizeSupabaseImage(imageUrl, {
  width: 800,
  height: 600,
  quality: 80,
  format: 'webp'
});
```

Adds transformation parameters to Supabase image URLs.

#### getResponsiveSizes()
```typescript
import { getResponsiveSizes } from '@/lib/imageOptimization';

const sizes = getResponsiveSizes('card');
```

Returns the appropriate sizes string for different layouts.

#### getOptimalQuality()
```typescript
import { getOptimalQuality } from '@/lib/imageOptimization';

const quality = getOptimalQuality();
```

Returns optimal image quality based on user's connection speed.

## Best Practices

### 1. Use Priority for Above-the-Fold Images

```tsx
<OptimizedImage
  src={heroImage}
  alt="Hero"
  fill
  priority // Preload this image
  layout="hero"
/>
```

### 2. Lazy Load Below-the-Fold Images

```tsx
<OptimizedImage
  src={productImage}
  alt="Product"
  fill
  layout="gallery"
  // No priority prop = lazy loading
/>
```

### 3. Provide Fallbacks

```tsx
<OptimizedImage
  src={sellerImage}
  alt="Seller"
  fill
  fallback={
    <div className="flex items-center justify-center bg-neutral-light">
      <Building2 className="w-16 h-16 text-gray-300" />
    </div>
  }
/>
```

### 4. Use Appropriate Quality Settings

- **Hero images**: 90-95 quality
- **Profile images**: 85-90 quality
- **Card thumbnails**: 80-85 quality
- **Gallery images**: 80-85 quality

### 5. Always Provide Alt Text

```tsx
<OptimizedImage
  src={image}
  alt="Descriptive text for accessibility"
  fill
/>
```

### 6. Use Blur Placeholders

```tsx
<OptimizedImage
  src={image}
  alt="Description"
  fill
  enableBlur
  blurColor="#FF6B35" // Match your brand color
/>
```

## Image Formats

The website automatically serves images in the best format supported by the browser:

1. **AVIF** - Best compression, modern browsers
2. **WebP** - Good compression, wide support
3. **JPEG/PNG** - Fallback for older browsers

Next.js handles format selection automatically.

## Performance Metrics

### Target Metrics

- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

### Optimization Results

With these optimizations:
- Images are 40-60% smaller with WebP
- Images are 50-70% smaller with AVIF
- Blur placeholders reduce perceived load time
- Lazy loading reduces initial page weight

## Troubleshooting

### Images Not Loading

1. Check if the domain is in `remotePatterns` in `next.config.mjs`
2. Verify the image URL is accessible
3. Check browser console for errors

### Blur Placeholder Not Showing

1. Ensure `enableBlur` prop is set to `true`
2. Check if `blurDataURL` is being generated
3. Verify the image has `placeholder="blur"` attribute

### Images Loading Slowly

1. Check image quality settings (reduce if too high)
2. Verify images are being lazy loaded (no `priority` prop)
3. Check network connection speed
4. Ensure images are being served in WebP/AVIF format

### Layout Shift Issues

1. Always specify `width` and `height` or use `fill` prop
2. Use `sizes` prop for responsive images
3. Reserve space for images with CSS

## Migration Guide

### Converting Existing Images

Replace standard `<Image>` components:

**Before:**
```tsx
<Image
  src={image}
  alt="Description"
  fill
  className="object-cover"
/>
```

**After:**
```tsx
<OptimizedImage
  src={image}
  alt="Description"
  fill
  layout="card"
  enableBlur
  className="object-cover"
/>
```

## Testing

### Visual Testing

1. Test on different screen sizes (mobile, tablet, desktop)
2. Test on different connection speeds (3G, 4G, WiFi)
3. Test in different browsers (Chrome, Firefox, Safari, Edge)

### Performance Testing

Use Lighthouse to measure:
```bash
npm run build
npm run start
# Open Chrome DevTools > Lighthouse
```

Target scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

## Resources

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

## Summary

All images in the DukaaOn website are now optimized for:
✅ Modern formats (WebP, AVIF)
✅ Responsive sizing
✅ Lazy loading
✅ Blur placeholders
✅ Optimal compression
✅ Fast loading times
✅ Excellent user experience
