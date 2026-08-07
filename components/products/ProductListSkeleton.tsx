/**
 * ProductListSkeleton - Skeleton loading component for product lists
 * 
 * Implements Requirements 2.1:
 * - Display skeleton loading placeholders immediately (within 100ms) while fetching data
 * 
 * This component renders immediately on mount to provide instant visual feedback
 * before any network requests complete.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import ProductCardSkeleton from '../common/ProductCardSkeleton';

const { width } = Dimensions.get('window');

interface ProductListSkeletonProps {
  /** Number of skeleton items to display */
  itemCount?: number;
  /** Number of columns in the grid */
  numColumns?: number;
  /** Whether this is a wholesaler view (affects card sizing) */
  isWholesaler?: boolean;
  /** Callback when skeleton is rendered (for timing verification) */
  onRender?: (timestamp: number) => void;
}

/**
 * ProductListSkeleton renders a grid of skeleton product cards
 * Designed to render within 100ms of mount for immediate visual feedback
 */
const ProductListSkeleton: React.FC<ProductListSkeletonProps> = ({
  itemCount = 12,
  numColumns = 3,
  isWholesaler = false,
  onRender,
}) => {
  const renderTimestamp = useRef<number>(Date.now());

  useEffect(() => {
    // Report render time for performance monitoring
    if (onRender) {
      onRender(renderTimestamp.current);
    }
  }, [onRender]);

  // Calculate effective columns based on view type
  const effectiveColumns = isWholesaler ? 2 : numColumns;

  // Generate skeleton items
  const skeletonItems = Array.from({ length: itemCount }, (_, index) => (
    <ProductCardSkeleton 
      key={`skeleton-${index}`} 
      isWholesaler={isWholesaler} 
    />
  ));

  // Group items into rows for proper grid layout
  const rows: JSX.Element[][] = [];
  for (let i = 0; i < skeletonItems.length; i += effectiveColumns) {
    rows.push(skeletonItems.slice(i, i + effectiveColumns));
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
});

export default ProductListSkeleton;

// Export render timestamp utility for testing
export const getSkeletonRenderTime = (): number => Date.now();
