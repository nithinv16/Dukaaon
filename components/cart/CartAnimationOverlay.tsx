import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useCartAnimation } from '../../contexts/CartAnimationContext';
import FlyingProduct from './FlyingProduct';
import CartToast from './CartToast';

export default function CartAnimationOverlay() {
  const { flyingProducts } = useCartAnimation();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Flying products */}
      {flyingProducts.map(product => (
        <FlyingProduct
          key={product.id}
          id={product.id}
          imageUrl={product.imageUrl}
          startX={product.startX}
          startY={product.startY}
        />
      ))}
      
      {/* Toast notification */}
      <CartToast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 9998,
  },
});














