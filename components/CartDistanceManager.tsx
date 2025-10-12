import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, Divider, List, IconButton } from 'react-native-paper';
import { useCartStore } from '../store/cart';
import { useRouter } from 'expo-router';

interface CartDistanceManagerProps {
  visible: boolean;
  onDismiss: () => void;
  errorMessage: string;
}

export const CartDistanceManager: React.FC<CartDistanceManagerProps> = ({
  visible,
  onDismiss,
  errorMessage
}) => {
  const { items, removeItem, clearCart, splitCartBySeller } = useCartStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCompleteCurrentOrder = () => {
    onDismiss();
    router.push('/(main)/cart');
  };

  const handleClearCart = async () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearCart();
              onDismiss();
            } catch (error) {
              console.error('Error clearing cart:', error);
              Alert.alert('Error', 'Failed to clear cart. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRemoveDistantSellers = async () => {
    // This would require more complex logic to identify which sellers are distant
    // For now, we'll show the cart and let users manually remove items
    onDismiss();
    router.push('/(main)/cart');
  };

  const sellerGroups = splitCartBySeller();
  const sellerCount = Object.keys(sellerGroups).length;

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Card style={styles.card}>
        <Card.Title 
          title="Distance Constraint" 
          subtitle="Sellers are too far apart for delivery"
          left={(props) => <IconButton {...props} icon="map-marker-distance" />}
        />
        
        <Card.Content>
          <Text style={styles.errorText}>{errorMessage || 'An error occurred'}</Text>
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Current Cart Summary:</Text>
          <Text style={styles.cartInfo}>
            • {items.length} items from {sellerCount} seller{sellerCount !== 1 ? 's' : ''}
          </Text>
          
          {Object.entries(sellerGroups).map(([sellerId, sellerItems]) => (
            <View key={sellerId} style={styles.sellerGroup}>
              <Text style={styles.sellerName}>
                Seller: {sellerItems[0]?.seller_id || 'Unknown'}
              </Text>
              <Text style={styles.itemCount}>
                {sellerItems.length} item{sellerItems.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>What would you like to do?</Text>
        </Card.Content>
        
        <Card.Actions style={styles.actions}>
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={handleCompleteCurrentOrder}
              style={styles.button}
              icon="cart-check"
            >
              Complete Current Order
            </Button>
            
            <Button 
              mode="outlined" 
              onPress={handleRemoveDistantSellers}
              style={styles.button}
              icon="map-marker-remove"
            >
              Manage Cart Items
            </Button>
            
            <Button 
              mode="text" 
              onPress={handleClearCart}
              style={styles.button}
              icon="cart-remove"
              loading={loading}
              disabled={loading}
            >
              Clear All Items
            </Button>
            
            <Button 
              mode="text" 
              onPress={onDismiss}
              style={styles.button}
            >
              Cancel
            </Button>
          </View>
        </Card.Actions>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 16,
    lineHeight: 20,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
  },
  cartInfo: {
    marginBottom: 12,
    color: '#666',
  },
  sellerGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginBottom: 4,
  },
  sellerName: {
    flex: 1,
    fontSize: 14,
  },
  itemCount: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    padding: 16,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    marginBottom: 8,
  },
});

export default CartDistanceManager;