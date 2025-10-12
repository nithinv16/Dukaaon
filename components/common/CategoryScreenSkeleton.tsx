import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface CategoryScreenSkeletonProps {
  shouldShowWholesalerView?: boolean;
}

const CategoryScreenSkeleton: React.FC<CategoryScreenSkeletonProps> = ({ 
  shouldShowWholesalerView = false 
}) => {
  const SkeletonItem = ({ width: itemWidth, height }: { width: number; height: number }) => (
    <View style={[styles.skeletonItem, { width: itemWidth, height }]}>
      <LinearGradient
        colors={['#f0f0f0', '#e0e0e0', '#f0f0f0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      />
    </View>
  );

  const renderSidebarSkeleton = () => (
    <View style={styles.sidebar}>
      {Array.from({ length: 8 }, (_, i) => (
        <View key={i} style={styles.sidebarItem}>
          <SkeletonItem width={40} height={40} />
          <SkeletonItem width={60} height={12} />
        </View>
      ))}
    </View>
  );

  const renderProductsSkeleton = () => {
    const numColumns = shouldShowWholesalerView ? 2 : 3;
    const productWidth = shouldShowWholesalerView 
      ? (width * 0.75 - 32) / 2 - 8
      : (width * 0.75 - 32) / 3 - 8;
    
    return (
      <View style={styles.productsContainer}>
        {/* Filter bar skeleton */}
        <View style={styles.filterBar}>
          <SkeletonItem width={80} height={32} />
          <SkeletonItem width={60} height={32} />
        </View>
        
        {/* Products grid skeleton */}
        <View style={styles.productsGrid}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={[styles.productCard, { width: productWidth }]}>
              <SkeletonItem width={productWidth} height={80} />
              <View style={styles.productInfo}>
                <SkeletonItem width={productWidth - 12} height={14} />
                <SkeletonItem width={productWidth - 20} height={12} />
                <SkeletonItem width={60} height={16} />
                <SkeletonItem width={productWidth - 12} height={28} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFullWidthSkeleton = () => (
    <View style={styles.fullWidthContainer}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <SkeletonItem width={40} height={40} />
        <SkeletonItem width={120} height={20} />
        <SkeletonItem width={40} height={40} />
      </View>
      
      {/* Filter bar skeleton */}
      <View style={styles.filterBar}>
        <SkeletonItem width={80} height={32} />
        <SkeletonItem width={60} height={32} />
      </View>
      
      {/* Products grid skeleton */}
      <View style={styles.productsGrid}>
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={[styles.productCard, { width: (width - 32) / 2 - 8 }]}>
            <SkeletonItem width={(width - 32) / 2 - 8} height={80} />
            <View style={styles.productInfo}>
              <SkeletonItem width={(width - 32) / 2 - 20} height={14} />
              <SkeletonItem width={(width - 32) / 2 - 28} height={12} />
              <SkeletonItem width={60} height={16} />
              <SkeletonItem width={(width - 32) / 2 - 20} height={28} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {shouldShowWholesalerView ? (
        renderFullWidthSkeleton()
      ) : (
        <View style={styles.content}>
          {renderSidebarSkeleton()}
          {renderProductsSkeleton()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: '25%',
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 10,
  },
  sidebarItem: {
    padding: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  productsContainer: {
    flex: 1,
    width: '75%',
  },
  fullWidthContainer: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  productInfo: {
    padding: 6,
    gap: 4,
  },
  skeletonItem: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  gradient: {
    flex: 1,
  },
});

export default CategoryScreenSkeleton;