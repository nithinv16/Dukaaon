import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, Dimensions } from 'react-native';
import { useCartAnimation } from '../../contexts/CartAnimationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FlyingProductProps {
  id: string;
  imageUrl: string;
  startX: number;
  startY: number;
}

export default function FlyingProduct({ id, imageUrl, startX, startY }: FlyingProductProps) {
  const { cartPosition, removeFlyingProduct, triggerCartBounce } = useCartAnimation();

  // Offset starting position by half of image size (40) to center on tap point
  const adjustedStartX = startX - 40;
  const adjustedStartY = startY - 40;

  const animatedX = useRef(new Animated.Value(adjustedStartX)).current;
  const animatedY = useRef(new Animated.Value(adjustedStartY)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;
  const animatedRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Calculate trajectory - arc path to cart
    // cartPosition is already offset to center the flying product on cart icon
    const endX = cartPosition.x;
    const endY = cartPosition.y;
    const duration = 600;

    // Start all animations together
    Animated.parallel([
      // X movement
      Animated.timing(animatedX, {
        toValue: endX,
        duration,
        useNativeDriver: true,
      }),
      // Y movement with slight arc (bezier-like effect)
      Animated.sequence([
        Animated.timing(animatedY, {
          toValue: adjustedStartY - 80, // Go up first
          duration: duration * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(animatedY, {
          toValue: endY,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]),
      // Scale down as it approaches cart
      Animated.timing(animatedScale, {
        toValue: 0.2,
        duration,
        useNativeDriver: true,
      }),
      // Slight rotation for dynamic feel
      Animated.timing(animatedRotate, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      // Fade out at the end
      Animated.sequence([
        Animated.delay(duration * 0.7),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: duration * 0.3,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Trigger cart bounce when product arrives
      triggerCartBounce();
      // Remove this flying product
      removeFlyingProduct(id);
    });
  }, []);

  const rotateInterpolation = animatedRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: animatedX },
            { translateY: animatedY },
            { scale: animatedScale },
            { rotate: rotateInterpolation },
          ],
          opacity: animatedOpacity,
        },
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUrl || 'https://via.placeholder.com/80' }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 9999,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});














