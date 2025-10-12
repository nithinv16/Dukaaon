import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Chip, Divider, IconButton } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { NotificationService } from '../../../../services/notifications/NotificationService';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  outOfStock?: boolean;
}

interface Order {
  id: string;
  order_number: string;
  user_id: string;
  items: OrderItem[];
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  delivery_address: string;
  created_at: string;
  buyer: {
    id: string;
    business_details: {
      shopName: string;
      address: string;
    };
  };
  out_of_stock_items: OrderItem[];
}

const OrderItem = ({ item, isPending, onMarkOutOfStock }: { 
  item: OrderItem; 
  isPending?: boolean;
  onMarkOutOfStock?: () => void;
}) => (
  <Card style={styles.itemCard}>
    <Card.Content>
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text variant="titleMedium">{item?.name || 'Product'}</Text>
          <Text variant="bodyMedium" style={styles.quantity}>
            Quantity: {item.quantity}
          </Text>
          <Text variant="bodyMedium" style={styles.price}>
            ₹{item.price} per item
          </Text>
          {item.outOfStock && (
            <Chip 
              mode="flat"
              style={[styles.statusChip, { backgroundColor: '#F4433620' }]}
              textStyle={{ color: '#F44336' }}
            >
              Out of Stock
            </Chip>
          )}
        </View>
        <View style={styles.itemActions}>
          <Text variant="titleMedium">
            ₹{item.price * item.quantity}
          </Text>
          {isPending && !item.outOfStock && (
            <IconButton
              icon="close-circle"
              iconColor="#F44336"
              size={20}
              onPress={onMarkOutOfStock}
            />
          )}
        </View>
      </View>
    </Card.Content>
  </Card>
);

export default function OrderDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      console.log('Fetching order with ID:', id);
      
      // First, let's check if we can get the order without joins
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      console.log('Basic order data:', orderData);

      if (orderError) {
        console.error('Error fetching basic order:', orderError);
        throw orderError;
      }

      // Then get the buyer details
      const { data: buyerData, error: buyerError } = await supabase
        .from('profiles')
        .select('id, business_details')
        .eq('id', orderData.user_id)
        .single();

      console.log('Buyer data:', buyerData);

      if (buyerError) {
        console.error('Error fetching buyer:', buyerError);
      }

      // Combine the data
      const completeOrder = {
        ...orderData,
        buyer: buyerData
      };

      console.log('Complete order data:', completeOrder);
      setOrder(completeOrder);
    } catch (error) {
      console.error('Error in fetchOrderDetails:', error);
    } finally {
      setLoading(false);
    }
  };

  const markItemOutOfStock = async (itemIndex: number) => {
    if (!order) return;

    try {
      // Get the item being marked as out of stock
      const itemToMark = order.items[itemIndex];

      // Create new items array with updated outOfStock status
      const updatedItems = order.items.map((item, index) => 
        index === itemIndex ? { ...item, outOfStock: true } : item
      );

      // Add item to out_of_stock_items array
      const outOfStockItems = [
        ...(order.out_of_stock_items || []),
        {
          product_id: itemToMark.product_id,
          name: itemToMark.name,
          quantity: itemToMark.quantity,
          price: itemToMark.price,
          unit: itemToMark.unit
        }
      ];

      // Calculate new total amount excluding out of stock items
      const newTotalAmount = updatedItems.reduce((total, item) => 
        item.outOfStock ? total : total + (item.quantity * item.price), 
        0
      );

      // Update order in database
      const { error } = await supabase
        .from('orders')
        .update({ 
          items: updatedItems,
          total_amount: newTotalAmount,
          out_of_stock_items: outOfStockItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Send notification to customer about out of stock item
      await NotificationService.sendOutOfStockNotification(
        order.id,
        order.order_number,
        itemToMark.name,
        order.user_id
      );

      // Update local state
      setOrder({
        ...order,
        items: updatedItems,
        total_amount: newTotalAmount,
        out_of_stock_items: outOfStockItems
      });
    } catch (error) {
      console.error('Error marking item as out of stock:', error);
    }
  };

  const updateOrderStatus = async (newStatus: Order['status']) => {
    if (!order) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder({
        ...order,
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  if (!order) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.orderHeader}>
              <Text variant="titleMedium">Order #{order.order_number}</Text>
              <Chip 
                mode="flat" 
                style={styles.statusChip}
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Chip>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium">Delivery Address</Text>
              <Text variant="bodyLarge" style={styles.shopName}>
                {order.buyer?.business_details?.shopName || order.buyer?.business_details.shopName || 'Shop name not available'}
              </Text>
              <Text style={styles.address}>{order?.delivery_address || 'Address not available'}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.section}>
              <Text variant="titleMedium">Order Items</Text>
              {order.items.map((item, index) => (
                <OrderItem 
                  key={index} 
                  item={item} 
                  isPending={order.status === 'pending'}
                  onMarkOutOfStock={() => markItemOutOfStock(index)}
                />
              ))}
            </View>

            {order.out_of_stock_items && order.out_of_stock_items.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleMedium">Out of Stock Items</Text>
                {order.out_of_stock_items.map((item, index) => (
                  <OrderItem 
                    key={index} 
                    item={item} 
                    isPending={order.status === 'pending'}
                    onMarkOutOfStock={() => markItemOutOfStock(index)}
                  />
                ))}
              </View>
            )}

            <Divider style={styles.divider} />

            <View style={styles.summary}>
              <View style={[styles.summaryRow, styles.total]}>
                <Text variant="titleMedium">Total Amount</Text>
                <Text variant="titleMedium">₹{order.items
                  .filter(item => !item.outOfStock)
                  .reduce((total, item) => total + (item.quantity * item.price), 0)
                }</Text>
              </View>
              {order.items.some(item => item.outOfStock) && (
                <Text variant="bodySmall" style={styles.outOfStockNote}>
                  Total excludes out of stock items
                </Text>
              )}
            </View>

            <View style={styles.paymentInfo}>
              <Text variant="titleMedium">Payment Information</Text>
              <Text>Payment Method: {order?.payment_method?.toUpperCase() || 'Not specified'}</Text>
              <Text>Payment Status: {order?.payment_status?.charAt(0).toUpperCase() + order?.payment_status?.slice(1) || 'Unknown'}</Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {order.status === 'pending' && (
        <View style={styles.bottomActions}>
          <Button 
            mode="contained" 
            onPress={() => updateOrderStatus('confirmed')}
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            labelStyle={styles.actionButtonLabel}
          >
            Accept
          </Button>
          <Button 
            mode="outlined" 
            onPress={() => updateOrderStatus('cancelled')}
            style={styles.actionButton}
            textColor="#F44336"
          >
            Reject
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    height: 56,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 48, // Match IconButton width for symmetry
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  section: {
    marginVertical: 8,
  },
  shopName: {
    marginTop: 8,
    fontWeight: '500',
  },
  address: {
    marginTop: 4,
    color: '#666',
  },
  divider: {
    marginVertical: 16,
  },
  itemCard: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemActions: {
    alignItems: 'flex-end',
  },
  quantity: {
    color: '#666',
    marginTop: 2,
  },
  price: {
    color: '#666',
    marginTop: 2,
  },
  outOfStockNote: {
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  summary: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  total: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paymentInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonLabel: {
    fontSize: 16,
    paddingVertical: 2,
  },
});