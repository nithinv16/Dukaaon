import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface ProductCardSkeletonProps {
  isWholesaler?: boolean;
}

const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ isWholesaler = false }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[
      styles.productCard,
      isWholesaler ? styles.wholesalerProductCard : styles.categoryProductCard
    ]}>
      <View style={styles.productCardInner}>
        {/* Image skeleton */}
        <Animated.View style={[styles.imageSkeleton, { opacity }]} />
        
        <View style={styles.productInfo}>
          {/* Product name skeleton */}
          <View style={styles.nameContainer}>
            <Animated.View style={[styles.nameSkeleton, { opacity }]} />
            <Animated.View style={[styles.nameSkeletonSecond, { opacity }]} />
          </View>
          
          {/* Price skeleton */}
          <View style={styles.priceInfo}>
            <Animated.View style={[styles.priceSkeleton, { opacity }]} />
            <Animated.View style={[styles.unitSkeleton, { opacity }]} />
          </View>
          
          {/* Min quantity skeleton */}
          <Animated.View style={[styles.minQuantitySkeleton, { opacity }]} />
          
          {/* Add button skeleton */}
          <View style={styles.addButtonContainer}>
            <Animated.View style={[styles.addButtonSkeleton, { opacity }]} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 220,
  },
  wholesalerProductCard: {
    width: '46%',
    margin: '2%',
  },
  categoryProductCard: {
    width: '31%',
    margin: '1%',
  },
  productCardInner: {
    overflow: 'hidden',
    flex: 1,
  },
  imageSkeleton: {
    width: '100%',
    height: 80,
    backgroundColor: '#E0E0E0',
  },
  productInfo: {
    padding: 6,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 120,
  },
  nameContainer: {
    height: 44,
    marginBottom: 2,
  },
  nameSkeleton: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 4,
    width: '90%',
  },
  nameSkeletonSecond: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '70%',
  },
  priceInfo: {
    marginBottom: 4,
  },
  priceSkeleton: {
    height: 16,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '60%',
    marginBottom: 2,
  },
  unitSkeleton: {
    height: 9,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '40%',
  },
  minQuantitySkeleton: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '50%',
    alignSelf: 'center',
    marginBottom: 4,
  },
  addButtonContainer: {
    width: '100%',
    marginTop: 4,
    paddingVertical: 2,
    flex: 0,
  },
  addButtonSkeleton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    width: '100%',
    height: 30,
  },
});

export default ProductCardSkeleton;