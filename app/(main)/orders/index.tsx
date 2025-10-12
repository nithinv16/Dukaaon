import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip, Divider, IconButton, Portal, Modal } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { Order, OrderStatus } from '../../../types/orders';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function Orders() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const insets = useSafeAreaInsets();
  const { currentLanguage } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);

  // Original texts for translation
  const originalTexts = {
    myOrders: 'My Orders',
    noOrders: 'No orders found',
    orderNumber: 'Order #',
    totalAmount: 'Total Amount',
    status: 'Status',
    paymentStatus: 'Payment Status',
    orderDate: 'Order Date',
    items: 'Items',
    viewDetails: 'View Details',
    reorder: 'Reorder',
    cancel: 'Cancel',
    pending: 'Pending',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    completed: 'Completed',
    failed: 'Failed',
    outOfStock: 'Out of Stock',
    deliveryFee: 'Delivery Fee',
    total: 'Total',
    confirmCancel: 'Confirm Cancellation',
    cancelOrderMessage: 'Are you sure you want to cancel this order?',
    yes: 'Yes',
    no: 'No'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Translation function
  const getTranslatedText = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time subscription for order updates
    const subscription = supabase
      .channel('orders-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Order updated in list:', payload);
          // Refresh the orders list to show updated data
          fetchOrders();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
     return () => {
       subscription.unsubscribe();
     };
   }, []);

  const fetchOrders = useCallback(async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          master_orders!fk_orders_master_order_id(
            id,
            order_number,
            delivery_batches(
              batch_number
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const generateOrderNumber = useCallback(() => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
  }, []);

  const handleReorder = useCallback(async (order: Order) => {
    try {
      // Create a new order with the same items
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id,
          order_number: generateOrderNumber(),
          items: order.items,
          total_amount: order.total_amount,
          delivery_fee: order.delivery_fee || 0,
          status: 'pending',
          payment_status: 'pending',
          delivery_address: order.delivery_address,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Navigate to the new order
      router.push(`/(main)/orders/${data.id}`);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  }, [user?.id, router, generateOrderNumber]);

  const handleCancelOrder = useCallback(async () => {
    if (!selectedOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          cancellation_reason: 'Cancelled by user'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      
      // Refresh orders list
      fetchOrders();
      setCancelModalVisible(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  }, [selectedOrder, fetchOrders]);

  // Generate consistent color for batch numbers - memoized for performance
  const getBatchColor = useCallback((batchNumber: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    
    // Create a simple hash from batch number
    let hash = 0;
    for (let i = 0; i < batchNumber.length; i++) {
      hash = batchNumber.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use absolute value and modulo to get consistent color index
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  }, []);

  const renderOrderCard = useCallback(({ item: order }: { item: Order }) => {
    // Check if this is a batch order with batch number
    const batchNumber = order.master_orders?.delivery_batches?.[0]?.batch_number;
    const isBatchOrder = !!batchNumber;
    
    return (
      <Card style={styles.card} onPress={() => router.push(`/(main)/orders/${order.id}`)}>
        <Card.Content>
          <View style={styles.orderHeader}>
            <View style={styles.orderTitleContainer}>
              <Text variant="titleMedium">Order #{order.order_number}</Text>
              {isBatchOrder && (
                <Text 
                  variant="bodySmall" 
                  style={[
                    styles.batchNumber,
                    { 
                      backgroundColor: getBatchColor(batchNumber),
                      color: '#fff',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      fontWeight: '600'
                    }
                  ]}
                >
                  Batch: {batchNumber}
                </Text>
              )}
            </View>
            <Chip>{order.status}</Chip>
          </View>

          <Text style={styles.date}>
            {new Date(order.created_at).toLocaleDateString()}
          </Text>

        <Divider style={styles.divider} />

        <View style={styles.itemsList}>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text numberOfLines={1} style={item.outOfStock ? styles.strikethrough : undefined}>
                {item.quantity}x {item?.name || 'Product Name'}
              </Text>
              {item.outOfStock && (
                <Chip 
                  mode="outlined" 
                  textStyle={styles.outOfStockText}
                  style={styles.outOfStockChip}
                  compact
                >
                  Out of Stock
                </Chip>
              )}
            </View>
          ))}
          {order.out_of_stock_items && order.out_of_stock_items.length > 0 && (
            order.out_of_stock_items.map((item, index) => (
              <View key={`oos-${index}`} style={styles.itemRow}>
                <Text numberOfLines={1} style={styles.strikethrough}>
                  {item.quantity}x {item?.name || 'Product Name'}
                </Text>
                <Chip 
                  mode="outlined" 
                  textStyle={styles.outOfStockText}
                  style={styles.outOfStockChip}
                  compact
                >
                  Out of Stock
                </Chip>
              </View>
            ))
          )}
        </View>

        <View style={styles.orderFooter}>
          <OrderPriceBreakdown order={order} />
          
          <View style={styles.actions}>
            {order.status === 'pending' && (
              <Button 
                mode="outlined" 
                onPress={() => {
                  setSelectedOrder(order);
                  setCancelModalVisible(true);
                }}
              >
                Cancel
              </Button>
            )}
            <Button 
              mode="contained"
              onPress={() => handleReorder(order)}
            >
              Reorder
            </Button>
          </View>
        </View>
      </Card.Content>
    </Card>
    );
  }, [router, getBatchColor, handleReorder]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Use light status bar on iOS, dark on Android */}
      <SystemStatusBar style={Platform.OS === 'ios' ? 'dark' : 'light'} />
      
      {/* Custom Header that manually accounts for the notch */}
      <View 
        style={[
          styles.headerContainer, 
          { 
            paddingTop: insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 20 : 10,
            height: (insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 20 : 10) + 56
          }
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{getTranslatedText('myOrders')}</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Main content */}
      <View style={styles.container}>
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchOrders();
              }}
            />
          }
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyText}>No orders found</Text>
            )
          }
          // Performance optimizations
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          getItemLayout={(data, index) => ({
            length: 200, // Approximate height of each order card
            offset: 200 * index,
            index,
          })}
        />

        <Portal>
          <Modal
            visible={cancelModalVisible}
            onDismiss={() => setCancelModalVisible(false)}
            contentContainerStyle={styles.modalContent}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Cancel Order
            </Text>
            <Text style={styles.modalText}>
              Are you sure you want to cancel this order?
            </Text>
            <View style={styles.modalActions}>
              <Button 
                onPress={() => setCancelModalVisible(false)}
                style={styles.modalButton}
              >
                No, Keep It
              </Button>
              <Button 
                mode="contained"
                onPress={handleCancelOrder}
                style={styles.modalButton}
                buttonColor="#ff4444"
              >
                Yes, Cancel
              </Button>
            </View>
          </Modal>
        </Portal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginLeft: 0,
  },
  headerTitle: {
    fontWeight: '600',
    color: '#333',
    fontSize: 18,
    textAlign: 'center',
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 60,
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTitleContainer: {
    flex: 1,
  },
  batchNumber: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  date: {
    color: '#666',
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
  },
  itemsList: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outOfStockChip: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    height: 24,
  },
  outOfStockText: {
    color: '#f44336',
    fontSize: 10,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#999',
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceBreakdown: {
    flex: 1,
    marginRight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceLabel: {
    color: '#666',
  },
  priceDivider: {
    marginVertical: 8,
  },
  totalLabel: {
    fontWeight: '600',
  },
  total: {
    color: '#2196F3',
    fontWeight: '600',
  },
  outOfStockNote: {
    fontSize: 11,
    color: '#f44336',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#666',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    minWidth: 100,
  },
});

// Order price breakdown component - optimized with React.memo
const OrderPriceBreakdown = React.memo(({ order }: { order: Order }) => {
  // Memoize expensive calculations
  const { hasOutOfStockItems, subtotal, deliveryFee, totalAmount } = useMemo(() => {
    const hasOutOfStock = order.items.some(item => item.outOfStock) || 
      (order.out_of_stock_items && order.out_of_stock_items.length > 0);
    
    // Calculate subtotal from order items
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const calculatedSubtotal = orderItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return sum + (quantity * price);
    }, 0);
    
    // Get delivery fee from the delivery_fee column
    const calculatedDeliveryFee = Number(order.delivery_fee) || 0;
    
    // Calculate the correct total amount (subtotal + delivery fee)
    const calculatedTotalAmount = calculatedSubtotal + calculatedDeliveryFee;
    
    return {
      hasOutOfStockItems: hasOutOfStock,
      subtotal: calculatedSubtotal,
      deliveryFee: calculatedDeliveryFee,
      totalAmount: calculatedTotalAmount
    };
  }, [order.items, order.out_of_stock_items, order.delivery_fee]);
  
  if (deliveryFee > 0) {
    return (
      <View style={styles.priceBreakdown}>
        <View style={styles.priceRow}>
          <Text variant="bodyMedium" style={styles.priceLabel}>Subtotal:</Text>
          <Text variant="bodyMedium">₹{subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text variant="bodyMedium" style={styles.priceLabel}>Delivery Fee:</Text>
          <Text variant="bodyMedium">₹{deliveryFee.toFixed(2)}</Text>
        </View>
        <Divider style={styles.priceDivider} />
        <View style={styles.priceRow}>
          <Text variant="titleMedium" style={styles.totalLabel}>Total:</Text>
          <Text variant="titleMedium" style={styles.total}>₹{totalAmount.toFixed(2)}</Text>
        </View>
        {hasOutOfStockItems && (
          <Text style={styles.outOfStockNote}>
            * Total excludes out-of-stock items
          </Text>
        )}
      </View>
    );
  } else {
    return (
      <View style={styles.priceBreakdown}>
        <Text variant="titleMedium" style={styles.total}>
          ₹{subtotal.toFixed(2)}
        </Text>
        {hasOutOfStockItems && (
          <Text style={styles.outOfStockNote}>
            * Total excludes out-of-stock items
          </Text>
        )}
      </View>
    );
  }
});