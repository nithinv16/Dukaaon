# Image Optimization Quick Reference

Quick reference for using optimized images in the DukaaOn website.

## Import

```tsx
import { OptimizedImage } from '@/components/ui/OptimizedImage';
```

## Basic Usage

```tsx
<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  fill
  layout="card"
/>
```

## Layout Types

| Layout | Use Case | Sizes |
|--------|----------|-------|
| `card` | Seller cards in grid | Responsive: 100vw → 50vw → 33vw → 25vw |
| `hero` | Full-width hero images | 100vw |
| `gallery` | Product galleries | Responsive: 50vw → 33vw → 25vw |
| `profile` | Seller profile headers | Responsive: 100vw → 50vw → 33vw |

## Common Patterns

### Card Thumbnail
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

### Hero Image (Above Fold)
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

### Product Gallery
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

### Profile Header
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

### With Fallback
```tsx
<OptimizedImage
  src={image}
  alt="Description"
  fill
  layout="card"
  fallback={
    <div className="flex items-center justify-center bg-neutral-light">
      <Building2 className="w-16 h-16 text-gray-300" />
    </div>
  }
/>
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | string | required | Image URL |
| `alt` | string | required | Alt text for accessibility |
| `layout` | 'card' \| 'hero' \| 'gallery' \| 'profile' | 'card' | Responsive sizing preset |
| `enableBlur` | boolean | true | Enable blur placeholder |
| `blurColor` | string | undefined | Custom blur color (hex) |
| `showSkeleton` | boolean | true | Show loading skeleton |
| `fallback` | ReactNode | undefined | Fallback on error |
| `priority` | boolean | false | Preload image (above fold) |
| `quality` | number | 80 | Image quality (1-100) |
| `fill` | boolean | false | Fill parent container |
| `width` | number | undefined | Fixed width |
| `height` | number | undefined | Fixed height |

## Quality Guidelines

- **Hero images**: 90-95
- **Profile images**: 85-90
- **Card thumbnails**: 80-85
- **Gallery images**: 80-85

## Priority Guidelines

- **Above the fold**: `priority={true}`
- **Below the fold**: No priority prop (lazy load)

## Utility Functions

```tsx
import {
  generateBlurDataURL,
  generateColoredBlurDataURL,
  optimizeSupabaseImage,
  getResponsiveSizes,
  getOptimalQuality,
} from '@/lib/imageOptimization';

// Generate blur placeholder
const blur = generateBlurDataURL();

// Generate colored blur
const coloredBlur = generateColoredBlurDataURL('#FF6B35');

// Optimize Supabase URL
const optimized = optimizeSupabaseImage(url, {
  width: 800,
  quality: 80,
  format: 'webp'
});

// Get responsive sizes
const sizes = getResponsiveSizes('card');

// Get optimal quality based on connection
const quality = getOptimalQuality();
```

## CLI Commands

```bash
# Optimize images
npm run optimize:images <input-dir> <output-dir>

# Generate responsive sizes
npm run optimize:images:responsive <input-dir> <output-dir>

# WebP only
node scripts/optimize-images.js <input-dir> <output-dir> --webp-only

# AVIF only
node scripts/optimize-images.js <input-dir> <output-dir> --avif-only
```

## Checklist

- [ ] Use `OptimizedImage` instead of `Image`
- [ ] Provide descriptive `alt` text
- [ ] Choose appropriate `layout` type
- [ ] Set `priority` for above-fold images
- [ ] Use appropriate `quality` setting
- [ ] Add `fallback` for critical images
- [ ] Enable `blur` placeholder
- [ ] Test on different screen sizes
- [ ] Test on slow connections

## Common Issues

**Images not loading?**
- Check domain in `next.config.mjs` remotePatterns
- Verify image URL is accessible

**Blur not showing?**
- Ensure `enableBlur={true}`
- Check if blurDataURL is generated

**Layout shift?**
- Always use `fill` or specify `width` and `height`
- Use `sizes` prop for responsive images

**Slow loading?**
- Reduce quality setting
- Remove `priority` for below-fold images
- Check image format (should be WebP/AVIF)

## Resources

- [Full Documentation](./IMAGE_OPTIMIZATION_GUIDE.md)
- [Next.js Image Docs](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Scripts README](./scripts/README.md)
