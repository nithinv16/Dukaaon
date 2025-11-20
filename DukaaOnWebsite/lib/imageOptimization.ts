/**
 * Image Optimization Utilities
 * 
 * Provides utilities for optimizing images including:
 * - Blur placeholder generation
 * - Image URL transformation
 * - Responsive image sizing
 */

/**
 * Generate a blur data URL for image placeholders
 * This creates a tiny base64-encoded image for blur-up effect
 */
export function generateBlurDataURL(width: number = 8, height: number = 8): string {
  // Create a simple gradient blur placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f4f4f4;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Generate a colored blur placeholder based on a color
 */
export function generateColoredBlurDataURL(
  color: string = '#FF6B35',
  width: number = 8,
  height: number = 8
): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}" opacity="0.1" />
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Optimize Supabase image URL with transformations
 * Supabase supports image transformations via URL parameters
 */
export function optimizeSupabaseImage(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'origin';
  } = {}
): string {
  if (!url) return url;
  
  // Check if it's a Supabase URL
  if (!url.includes('supabase.co')) {
    return url;
  }
  
  const { width, height, quality = 80, format = 'webp' } = options;
  
  // Build transformation parameters
  const params = new URLSearchParams();
  
  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  if (quality) params.append('quality', quality.toString());
  if (format !== 'origin') params.append('format', format);
  
  // Add parameters to URL
  const separator = url.includes('?') ? '&' : '?';
  return params.toString() ? `${url}${separator}${params.toString()}` : url;
}

/**
 * Get responsive image sizes string based on layout
 */
export function getResponsiveSizes(layout: 'card' | 'hero' | 'gallery' | 'profile'): string {
  const sizeMap = {
    card: '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
    hero: '100vw',
    gallery: '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
    profile: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
  };
  
  return sizeMap[layout] || '100vw';
}

/**
 * Preload critical images
 * Use this for above-the-fold images
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof window === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = src;
  document.head.appendChild(link);
}

/**
 * Check if image format is supported
 */
export function isWebPSupported(): boolean {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

/**
 * Get optimal image quality based on connection speed
 */
export function getOptimalQuality(): number {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return 80; // Default quality
  }
  
  const connection = (navigator as { connection?: { effectiveType?: string } }).connection;
  const effectiveType = connection?.effectiveType;
  
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return 50;
    case '3g':
      return 70;
    case '4g':
    default:
      return 80;
  }
}

/**
 * Image loading priority helper
 */
export function getImagePriority(position: 'above-fold' | 'below-fold'): boolean {
  return position === 'above-fold';
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(baseUrl: string, widths: number[]): string {
  return widths
    .map((width) => {
      const optimizedUrl = optimizeSupabaseImage(baseUrl, { width });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');
}
