import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, findNodeHandle, UIManager, Platform } from 'react-native';
import { Badge, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCartStore } from '../../store/cart';
import { useCartAnimation } from '../../contexts/CartAnimationContext';

export default function AnimatedCartIcon() {
  const router = useRouter();
  const { items, loading, loadCart, cleanup } = useCartStore();
  const { cartScale, setCartPosition } = useCartAnimation();
  const containerRef = useRef<View>(null);

  useEffect(() => {
    loadCart();
    return () => cleanup();
  }, []);

  // Measure and report cart icon position
  useEffect(() => {
    const measurePosition = () => {
      if (containerRef.current) {
        containerRef.current.measureInWindow((x, y, width, height) => {
          if (x !== undefined && y !== undefined) {
            // Set position to center of cart icon
            // The flying product image is 80x80, so offset by half (40)
            // to make the product land centered on the cart icon
            setCartPosition({
              x: x + width / 2 - 40,
              y: y + height / 2 - 40,
            });
          }
        });
      }
    };

    // Measure after a short delay to ensure layout is complete
    const timer = setTimeout(measurePosition, 500);

    // Also re-measure when component mounts or updates
    measurePosition();

    return () => clearTimeout(timer);
  }, [setCartPosition]);

  const productCount = items.length;

  return (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        {
          transform: [{ scale: cartScale }],
        },
      ]}
    >
      <IconButton
        icon="cart"
        size={24}
        iconColor="#FF6B00"
        onPress={() => router.push('/(main)/cart')}
        style={styles.icon}
      />
      {productCount > 0 && !loading && (
        <Animated.View
          style={[
            styles.badgeContainer,
            {
              transform: [{ scale: cartScale }],
            },
          ]}
        >
          <Badge size={18} style={styles.badge}>
            {productCount > 99 ? '99+' : productCount}
          </Badge>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 8,
  },
  icon: {
    margin: 0,
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
  },
  badgeContainer: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  badge: {
    backgroundColor: '#FF6B00',
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
});














