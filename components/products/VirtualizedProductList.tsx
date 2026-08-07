/**
 * VirtualizedProductList - Optimized virtualized product list component
 * 
 * Implements Requirements:
 * - 2.7: Implement virtualized/windowed rendering to only render visible items
 * - 6.1: Render only visible items plus a small buffer (10 items above/below)
 * - 6.3: Use fixed-height items for accurate scroll position calculation
 * - 7.3: Trigger next batch fetch at 80% scroll position
 * - 7.4: Show inline skeleton placeholders during loadMore
 * 
 * This component uses FlatList with optimizations. Can be upgraded to FlashList
 * for even better performance by installing @shopify/flash-list.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  Dimensions,
  ListRenderItem,
  ViewToken,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Product } from '../../services/products/ProductQueryService';
import ProductListSkeleton from './ProductListSkeleton';
import ProductCardSkeleton from '../common/ProductCardSkeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fixed item heights for accurate scroll calculation - Requirements 6.3
const ITEM_HEIGHT_WHOLESALER = 220;
const ITEM_HEIGHT_CATEGORY = 220;

// Buffer configuration - Requirements 6.1
// windowSize of 11 means: 5 screens above + current screen + 5 screens below
// With ~4 items per screen, this gives us ~10 items buffer above/below
const WINDOW_SIZE = 11;
const ITEMS_PER_SCREEN = 4;
const BUFFER_ITEMS = 10;

// Scroll threshold for triggering loadMore - Trigger earlier for seamless experience
const LOAD_MORE_THRESHOLD = 0.5; // 50% scroll = trigger earlier for seamless loading

// Number of skeleton items to show during loadMore - Requirements 7.4
const INLINE_SKELETON_COUNT = 3; // Reduced to match smaller batch size

interface VirtualizedProductListProps {
  /** Products to display */
  products: Product[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether more data is being loaded */
  isLoadingMore?: boolean;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Number of columns */
  numColumns?: number;
  /** Whether this is a wholesaler view */
  isWholesaler?: boolean;
  /** Render function for each product item */
  renderItem: ListRenderItem<Product>;
  /** Called when end of list is reached */
  onEndReached?: () => void;
  /** Called when list is pulled to refresh */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  refreshing?: boolean;
  /** Header component */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Empty state component */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Footer component (e.g., loading indicator) */
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Callback for scroll position changes (percentage 0-1) */
  onScrollPositionChange?: (scrollPercentage: number) => void;
  /** Test ID for testing */
  testID?: string;
}

const VirtualizedProductList: React.FC<VirtualizedProductListProps> = ({
  products,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  numColumns = 3,
  isWholesaler = false,
  renderItem,
  onEndReached,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  onScrollPositionChange,
  testID,
}) => {
  const flatListRef = useRef<FlatList<Product>>(null);
  const lastScrollPercentageRef = useRef<number>(0);

  // Calculate item height based on view type - Requirements 6.3
  const itemHeight = isWholesaler ? ITEM_HEIGHT_WHOLESALER : ITEM_HEIGHT_CATEGORY;

  // Memoized key extractor
  const keyExtractor = useCallback((item: Product, index: number) => {
    return item.id || `product-${index}`;
  }, []);

  /**
   * Get item layout for better scroll performance
   * Requirements 6.3: Use fixed-height items for accurate scroll position calculation
   */
  const getItemLayout = useCallback(
    (_data: ArrayLike<Product> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: itemHeight * Math.floor(index / numColumns),
      index,
    }),
    [itemHeight, numColumns]
  );

  /**
   * Handle end reached with threshold
   * Requirements 7.3: Trigger next batch fetch at 80% scroll position
   */
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && onEndReached) {
      onEndReached();
    }
  }, [isLoadingMore, hasMore, onEndReached]);

  /**
   * Handle scroll events for position tracking
   * Requirements 7.3: Track scroll percentage for prefetch trigger
   * 
   * **Feature: scalable-product-loading, Property 7: Virtualization Render Bounds**
   * **Validates: Requirements 6.1**
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      
      // Calculate scroll percentage
      const scrollableHeight = contentSize.height - layoutMeasurement.height;
      if (scrollableHeight <= 0) return;
      
      const scrollPercentage = contentOffset.y / scrollableHeight;
      
      // Only notify if percentage changed significantly (avoid excessive updates)
      if (Math.abs(scrollPercentage - lastScrollPercentageRef.current) >= 0.05) {
        lastScrollPercentageRef.current = scrollPercentage;
        onScrollPositionChange?.(scrollPercentage);
      }
    },
    [onScrollPositionChange]
  );

  // Viewability config for tracking visible items
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    []
  );

  // Handle viewable items change (can be used for analytics/prefetching)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // Can be used to track which products are viewed
      // or to prefetch images for upcoming items
    },
    []
  );

  /**
   * Render inline skeleton footer during loadMore
   * Requirements 7.4: Show inline skeleton placeholders during loadMore
   */
  const renderFooter = useCallback(() => {
    // If custom footer provided, use it
    if (ListFooterComponent) {
      return ListFooterComponent as React.ReactElement;
    }

    // Show inline skeletons during loadMore
    if (isLoadingMore && hasMore) {
      return (
        <View style={styles.inlineSkeletonContainer} testID="inline-skeleton-footer">
          <View style={styles.inlineSkeletonRow}>
            {Array.from({ length: Math.min(INLINE_SKELETON_COUNT, numColumns) }).map((_, index) => (
              <ProductCardSkeleton 
                key={`loading-skeleton-${index}`} 
                isWholesaler={isWholesaler} 
              />
            ))}
          </View>
        </View>
      );
    }

    return null;
  }, [ListFooterComponent, isLoadingMore, hasMore, numColumns, isWholesaler]);

  // Show minimal skeleton while loading initial data (6 items = 2 rows)
  if (isLoading && products.length === 0) {
    return (
      <ProductListSkeleton
        itemCount={6}  // Match initial batch size for faster perceived loading
        numColumns={numColumns}
        isWholesaler={isWholesaler}
      />
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      testID={testID}
      /**
       * Performance optimizations - Requirements 6.1
       * windowSize controls how many screens worth of content to render
       * WINDOW_SIZE of 11 = 5 screens above + current + 5 below
       * This provides ~10 items buffer above/below visible area
       */
      removeClippedSubviews={true}
      maxToRenderPerBatch={BUFFER_ITEMS}
      updateCellsBatchingPeriod={50}
      windowSize={WINDOW_SIZE}
      initialNumToRender={numColumns * ITEMS_PER_SCREEN}
      getItemLayout={getItemLayout}
      /**
       * Infinite scroll - Requirements 7.3
       * onEndReachedThreshold of 0.2 means trigger when 80% scrolled
       */
      onEndReached={handleEndReached}
      onEndReachedThreshold={LOAD_MORE_THRESHOLD}
      // Scroll tracking for prefetch
      onScroll={handleScroll}
      scrollEventThrottle={100}
      // Pull to refresh
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        ) : undefined
      }
      // Viewability tracking
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      // Components
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={renderFooter}
      // Styling
      contentContainerStyle={styles.contentContainer}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    padding: 8,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  inlineSkeletonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  inlineSkeletonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});

export default VirtualizedProductList;

// Export constants for testing
export const VIRTUALIZATION_CONFIG = {
  WINDOW_SIZE,
  BUFFER_ITEMS,
  LOAD_MORE_THRESHOLD,
  INLINE_SKELETON_COUNT,
  ITEM_HEIGHT_WHOLESALER,
  ITEM_HEIGHT_CATEGORY,
};
