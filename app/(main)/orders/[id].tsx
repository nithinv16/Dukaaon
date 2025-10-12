import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Chip, Divider, List, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../../services/supabase/supabase';
import { getOrderById } from '../../../services/SupabaseService';
interface Order {
  id: string;
  order_number?: string | number;
  status?: string;
  created_at?: string;
  delivery_address?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  delivery_fee?: number;
  items?: Array<{
    id?: string | number;
    name?: string;
    quantity?: number;
    price?: number;
    unit?: string;
  }>;
}

export default function OrderDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        throw new Error('Order ID is required');
      }

      // Fetch order details from orders table only
      const orderData = await getOrderById(id as string);

      if (!orderData) {
        throw new Error('Order not found');
      }

      setOrder(orderData);
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Order Details', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge">Loading order details...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerTitle: 'Order Details', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge" style={styles.errorText}>{error || 'An error occurred'}</Text>
          <Button mode="contained" onPress={fetchOrderDetails} style={styles.retryButton}>
            <Text>Retry</Text>
          </Button>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Order Details', headerShown: true }} />
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge">Order not found</Text>
          <Button mode="outlined" onPress={() => router.back()} style={styles.retryButton}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Order Details', headerShown: true }} />
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            {/* Order Header */}
            <View style={styles.header}>
              <Text variant="headlineSmall">Order #{String(order.order_number || 'N/A')}</Text>
              <Chip>{String(order.status || 'pending')}</Chip>
            </View>
            
            <Text style={styles.date}>
              Placed on {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
            </Text>

            <Divider style={styles.divider} />

            {/* Order Items */}
            <OrderItemsSection order={order} />

            <Divider style={styles.divider} />

            {/* Delivery Address */}
            <View style={styles.section}>
              <Text variant="titleMedium">Delivery Address</Text>
              <Text style={styles.address}>{String(order.delivery_address || 'No address provided')}</Text>
            </View>

            {/* Tracking Details */}
            {order.tracking_number && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.section}>
                  <Text variant="titleMedium">Tracking Details</Text>
                  <Text>Tracking Number: {String(order.tracking_number || 'N/A')}</Text>
                  {order.estimated_delivery && (
                    <Text>
                      Estimated Delivery: {new Date(order.estimated_delivery).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </>
            )}
            

            <Divider style={styles.divider} />

            {/* Price Breakdown */}
            <OrderPriceBreakdown order={order} />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

// Order Items Section Component
function OrderItemsSection({ order }: { order: Order }) {
  return (
    <List.Section>
      <List.Subheader>Order Items</List.Subheader>
      {Array.isArray(order.items) && order.items.length > 0 ? (
        order.items.map((item, index) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          const itemTotal = quantity * price;
          
          return (
            <List.Item
              key={item.id || index}
              title={String(item.name || 'Unknown Item')}
              description={`${quantity} ${item.unit || ''} × ₹${price.toFixed(2)}`}
              right={() => (
                <View style={styles.itemRight}>
                  <Text variant="titleMedium">
                    ₹{itemTotal.toFixed(2)}
                  </Text>
                </View>
              )}
            />
          );
        })
      ) : (
        <List.Item
          title="No items found"
          description="This order has no items"
        />
      )}
    </List.Section>
  );
}

// Price Breakdown Component
function OrderPriceBreakdown({ order }: { order: Order }) {
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const subtotal = orderItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return sum + (quantity * price);
  }, 0);
  
  // Get delivery fee from the delivery_fee column
  const deliveryFee = Number(order.delivery_fee) || 0;
  
  // Calculate the correct total amount (subtotal + delivery fee)
  const totalAmount = subtotal + deliveryFee;
  
  return (
    <View style={styles.priceBreakdown}>
      <View style={styles.priceRow}>
        <Text variant="titleMedium" style={styles.priceLabel}>Subtotal</Text>
        <Text variant="titleMedium">₹{subtotal.toFixed(2)}</Text>
      </View>
      
      {deliveryFee > 0 && (
        <View style={styles.priceRow}>
          <Text variant="titleMedium" style={styles.priceLabel}>Delivery Fee</Text>
          <Text variant="titleMedium">₹{deliveryFee.toFixed(2)}</Text>
        </View>
      )}
      
      <Divider style={styles.priceDivider} />
      
      <View style={styles.priceRow}>
        <Text variant="titleLarge" style={styles.totalLabel}>Total Amount</Text>
        <Text variant="headlineSmall" style={styles.totalValue}>
          ₹{totalAmount.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    color: '#666',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    gap: 8,
  },
  address: {
    color: '#666',
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 16,
  },
  

  
  // Item styles
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  // Price breakdown styles
  priceBreakdown: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceLabel: {
    flex: 1,
    color: '#666',
  },
  priceDivider: {
    marginVertical: 8,
    backgroundColor: '#e0e0e0',
  },
  totalLabel: {
    flex: 1,
    fontWeight: 'bold',
  },
  totalValue: {
    fontWeight: 'bold',
    color: '#1976d2',
  },
});