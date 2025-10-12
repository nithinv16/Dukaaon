import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Searchbar, Menu, Portal, Modal, Snackbar, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { Order } from '../../../../types/orders';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered';

export default function OrderManagement() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [translations, setTranslations] = useState({
    viewDetails: 'View Details',
    updateStatus: 'Update Status',
    updateOrderStatus: 'Update Order Status',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  });

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('View Details', currentLanguage),
          translationService.translateText('Update Status', currentLanguage),
          translationService.translateText('Update Order Status', currentLanguage),
          translationService.translateText('Confirmed', currentLanguage),
          translationService.translateText('Shipped', currentLanguage),
          translationService.translateText('Delivered', currentLanguage),
          translationService.translateText('Cancelled', currentLanguage)
        ]);
        
        setTranslations({
          viewDetails: results[0].translatedText,
          updateStatus: results[1].translatedText,
          updateOrderStatus: results[2].translatedText,
          confirmed: results[3].translatedText,
          shipped: results[4].translatedText,
          delivered: results[5].translatedText,
          cancelled: results[6].translatedText
        });
      } catch (error) {
        console.error('Translation loading error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchOrders();

    // Update the subscription to handle empty results
    const subscription = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        {
          event: '*',  // Listen to all changes
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('Subscription payload:', payload);
          
          // Handle different types of changes
          switch (payload.eventType) {
            case 'INSERT':
              setOrders(current => [payload.new as Order, ...current]);
              setSnackbarMessage('New order received');
              setSnackbarVisible(true);
              break;
            case 'UPDATE':
              setOrders(current => 
                current.map(order => 
                  order.id === payload.new.id 
                    ? { ...order, ...payload.new }
                    : order
                )
              );
              break;
            default:
              // Refresh orders for other changes
              fetchOrders();
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false }); // Sort by latest first

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: ordersData, error } = await query;
      if (error) throw error;

      // Fetch buyer details for each order separately
      if (ordersData && ordersData.length > 0) {
        const ordersWithBuyers = await Promise.all(
          ordersData.map(async (order) => {
            try {
              const { data: buyerData, error: buyerError } = await supabase
                .from('profiles')
                .select('id, business_details')
                .eq('id', order.user_id)
                .single();

              if (buyerError) {
                console.log('Could not fetch buyer for order:', order.id);
              }

              return {
                ...order,
                buyer: buyerData || null
              };
            } catch (err) {
              console.log('Error fetching buyer:', err);
              return {
                ...order,
                buyer: null
              };
            }
          })
        );

        setOrders(ordersWithBuyers);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      console.log('Updating order:', orderId, 'to status:', newStatus);

      // First verify the order exists
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
        throw orderError;
      }

      console.log('Current order data:', orderData);

      // Then update the status
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();  // Add this to get the updated record

      console.log('Update response:', { data, error });

      if (error) {
        console.error('Error updating order:', error);
        throw error;
      }

      // Update local state
      setOrders(currentOrders => 
        currentOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus }
            : order
        )
      );

      // Show success message
      setSnackbarMessage(newStatus === 'confirmed' ? 'Order accepted successfully' : 'Order rejected successfully');
      setSnackbarVisible(true);

      // Refresh orders to ensure we have latest data
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      setSnackbarMessage('Failed to update order status');
      setSnackbarVisible(true);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed': return '#4CAF50';
      case 'shipped': return '#2196F3';
      case 'delivered': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#FFC107';
    }
  };

  const handleViewDetails = (orderId: string) => {
    router.push(`/wholesaler/orders/details?id=${orderId}`);
  };

  const renderOrder = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Card.Content>
        <View style={styles.orderHeader}>
          <View>
            <Text variant="titleMedium">Order #{order.order_number}</Text>
            <Text variant="bodySmall" style={styles.date}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Chip 
            mode="flat"
            style={{ backgroundColor: getStatusColor(order.status) + '20' }}
            textStyle={{ color: getStatusColor(order.status) }}
          >
            {order.status}
          </Chip>
        </View>

        <View style={styles.buyerInfo}>
          <Text variant="titleSmall" style={styles.shopName}>
            {order.buyer?.business_details?.shopName || 'Shop name not available'}
          </Text>
          <Text variant="bodySmall" style={styles.address}>
            {order.delivery_address}
          </Text>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detail}>
            <Text variant="labelSmall">Items</Text>
            <Text variant="titleMedium">{order?.items?.length || 0}</Text>
          </View>
          <View style={styles.detail}>
            <Text variant="labelSmall">Total</Text>
            <Text variant="titleMedium" style={styles.amount}>₹{order?.total_amount || 0}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {order.status === 'pending' && (
            <>
              <Button 
                mode="contained" 
                onPress={() => updateOrderStatus(order.id, 'confirmed')}
                style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              >
                Accept
              </Button>
              <Button 
                mode="outlined" 
                onPress={() => updateOrderStatus(order.id, 'cancelled')}
                style={styles.actionButton}
                textColor="#F44336"
              >
                Reject
              </Button>
            </>
          )}
          <Button 
            mode="text" 
            onPress={() => handleViewDetails(order.id)}
            style={[
              styles.actionButton,
              order.status !== 'pending' && styles.soloButton
            ]}
          >
              View Details
            </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">Orders</Text>
        <View style={styles.headerRight} />
      </View>

      <Searchbar
        placeholder="Search orders"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <SegmentedButtons
        value={filterStatus}
        onValueChange={(value) => {
          setFilterStatus(value as FilterStatus);
          fetchOrders();
        }}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
        ]}
      />

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContent}>
          <Text variant="titleMedium">No orders found</Text>
          <Text variant="bodySmall" style={styles.emptyText}>
            New orders will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders.filter(order => 
            order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.delivery_address.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}

      <Portal>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={{ x: 0, y: 0 }}
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              const orderDetailsParams = new URLSearchParams({ id: selectedOrder?.id || '' });
              router.push(`/(main)/wholesaler/orders/details?${orderDetailsParams.toString()}`);
            }}
            title={translations.viewDetails}
            leadingIcon="eye"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setStatusModalVisible(true);
            }}
            title={translations.updateStatus}
            leadingIcon="pencil"
          />
        </Menu>

        <Modal
          visible={statusModalVisible}
          onDismiss={() => setStatusModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {translations.updateOrderStatus}
          </Text>
          <View style={styles.statusButtons}>
            {['confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
              <Button
                key={status}
                mode="outlined"
                onPress={() => updateOrderStatus(selectedOrder?.id || '', status as Order['status'])}
                style={[
                  styles.statusButton,
                  { borderColor: getStatusColor(status as Order['status']) }
                ]}
                textColor={getStatusColor(status as Order['status'])}
              >
                {translations[status as keyof typeof translations]}
              </Button>
            ))}
          </View>
        </Modal>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
        >
          {snackbarMessage}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRight: {
    width: 48,
  },
  searchBar: {
    margin: 16,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  list: {
    padding: 16,
  },
  orderCard: {
    marginBottom: 16,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  date: {
    color: '#666',
    marginTop: 4,
  },
  buyerInfo: {
    marginTop: 8,
  },
  shopName: {
    fontWeight: '500',
    marginBottom: 2,
  },
  address: {
    color: '#666',
    marginTop: 4,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detail: {
    alignItems: 'center',
  },
  amount: {
    color: '#2196F3',
  },
  statusSection: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  statusButtons: {
    gap: 8,
  },
  statusButton: {
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  soloButton: {
    flex: 0,  // Don't expand when it's the only button
    alignSelf: 'flex-end',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    marginTop: 8,
  },
});
