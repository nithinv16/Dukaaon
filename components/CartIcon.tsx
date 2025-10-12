import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useCartStore } from '../store/cart';

export default function CartIcon() {
  const router = useRouter();
  const { items, loading, loadCart, cleanup } = useCartStore();

  useEffect(() => {
    // Load cart when component mounts
    loadCart();
    
    // Cleanup when component unmounts
    return () => {
      cleanup();
    };
  }, []);

  // Get number of unique products in cart
  const productCount = items.length;

  return (
    <View style={styles.container}>
      <IconButton
        icon="cart"
        size={24}
        onPress={() => router.push('/(main)/cart')}
        style={styles.icon}
      />
      {productCount > 0 && !loading && (
        <Badge
          size={16}
          style={styles.badge}
        >
          {productCount}
        </Badge>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 8,
  },
  icon: {
    margin: 0,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4444',
    color: 'white',
    fontSize: 12,
    zIndex: 1,
  },
}); 