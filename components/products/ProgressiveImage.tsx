/**
 * ProgressiveImage - Progressive image loading component
 * 
 * Implements Requirements 2.4:
 * - Use progressive image loading with low-resolution placeholders
 * - Upgrade to full resolution progressively
 * 
 * This component shows a low-quality placeholder while the full image loads,
 * then smoothly transitions to the full-resolution image.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Image,
  ImageProps,
  StyleSheet,
  Animated,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
} from 'react-native';

interface ProgressiveImageProps extends Omit<ImageProps, 'source'> {
  /** Full resolution image source */
  source: ImageSourcePropType;
  /** Low resolution placeholder source (optional) */
  thumbnailSource?: ImageSourcePropType;
  /** Placeholder color while loading */
  placeholderColor?: string;
  /** Animation duration for fade transition (ms) */
  fadeDuration?: number;
  /** Style for the image */
  style?: StyleProp<ImageStyle>;
  /** Callback when full image loads */
  onLoadEnd?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  source,
  thumbnailSource,
  placeholderColor = '#E0E0E0',
  fadeDuration = 300,
  style,
  onLoadEnd,
  onError,
  ...imageProps
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  const fullImageOpacity = useRef(new Animated.Value(0)).current;

  // Handle full image load complete
  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    
    // Fade out thumbnail, fade in full image
    Animated.parallel([
      Animated.timing(thumbnailOpacity, {
        toValue: 0,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
      Animated.timing(fullImageOpacity, {
        toValue: 1,
        duration: fadeDuration,
        useNativeDriver: true,
      }),
    ]).start();

    onLoadEnd?.();
  }, [fadeDuration, thumbnailOpacity, fullImageOpacity, onLoadEnd]);

  // Handle image load error
  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  // Generate low-quality placeholder URL if not provided
  const getPlaceholderSource = useCallback((): ImageSourcePropType | null => {
    if (thumbnailSource) {
      return thumbnailSource;
    }

    // If source is a URI, try to generate a low-quality version
    if (typeof source === 'object' && 'uri' in source && source.uri) {
      const uri = source.uri;
      
      // For Supabase storage URLs, we can add transformation parameters
      if (uri.includes('supabase')) {
        // Add quality and resize parameters for Supabase
        const separator = uri.includes('?') ? '&' : '?';
        return {
          uri: `${uri}${separator}width=50&quality=20`,
        };
      }
      
      // For other URLs, return null (will use placeholder color)
      return null;
    }

    return null;
  }, [source, thumbnailSource]);

  const placeholderSource = getPlaceholderSource();

  return (
    <View style={[styles.container, style]}>
      {/* Placeholder background */}
      <View style={[styles.placeholder, { backgroundColor: placeholderColor }]} />

      {/* Low-resolution thumbnail */}
      {placeholderSource && (
        <Animated.Image
          {...imageProps}
          source={placeholderSource}
          style={[styles.image, style, { opacity: thumbnailOpacity }]}
          blurRadius={2}
        />
      )}

      {/* Full resolution image */}
      {!hasError && (
        <Animated.Image
          {...imageProps}
          source={source}
          style={[styles.image, style, { opacity: fullImageOpacity }]}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />
      )}

      {/* Error state */}
      {hasError && (
        <View style={[styles.errorContainer, style]}>
          <View style={styles.errorIcon} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#BDBDBD',
  },
});

export default ProgressiveImage;
