'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import {
  generateBlurDataURL,
  generateColoredBlurDataURL,
  getResponsiveSizes,
  optimizeSupabaseImage,
} from '@/lib/imageOptimization';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder' | 'blurDataURL'> {
  /**
   * Layout type for automatic responsive sizing
   */
  layout?: 'card' | 'hero' | 'gallery' | 'profile';
  
  /**
   * Enable blur placeholder
   */
  enableBlur?: boolean;
  
  /**
   * Custom blur color (hex)
   */
  blurColor?: string;
  
  /**
   * Show loading skeleton
   */
  showSkeleton?: boolean;
  
  /**
   * Fallback component when image fails to load
   */
  fallback?: React.ReactNode;
}

/**
 * Optimized Image Component
 * 
 * Wraps Next.js Image with additional optimizations:
 * - Automatic blur placeholders
 * - Responsive sizing based on layout
 * - Loading states
 * - Error handling with fallback
 * - Supabase image optimization
 */
export function OptimizedImage({
  src,
  alt,
  layout = 'card',
  enableBlur = true,
  blurColor,
  showSkeleton = true,
  fallback,
  sizes,
  priority = false,
  quality = 80,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate blur placeholder
  const blurDataURL = enableBlur
    ? blurColor
      ? generateColoredBlurDataURL(blurColor)
      : generateBlurDataURL()
    : undefined;

  // Get responsive sizes if not provided
  const imageSizes = sizes || getResponsiveSizes(layout);

  // Optimize Supabase images
  const optimizedSrc = typeof src === 'string' 
    ? optimizeSupabaseImage(src, { quality: typeof quality === 'number' ? quality : parseInt(quality) })
    : src;

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
  };

  // Handle image error
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Show fallback if error occurred
  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading skeleton */}
      {showSkeleton && isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-light via-neutral-medium/50 to-neutral-light animate-pulse" />
      )}

      {/* Optimized Image */}
      <Image
        src={optimizedSrc}
        alt={alt}
        sizes={imageSizes}
        priority={priority}
        quality={quality}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        {...(enableBlur && blurDataURL && {
          placeholder: 'blur',
          blurDataURL,
        })}
        {...props}
      />
    </div>
  );
}
