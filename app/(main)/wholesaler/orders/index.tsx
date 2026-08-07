import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Searchbar, Menu, Portal, Modal, Snackbar, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { Order } from '../../../../types/orders';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered';

// --- Wholesaler Premium Theme ---
// --- Wholesaler Premium Theme (Navy/Teal) ---
const THEME = {
  primary: '#001F3F',    // Navy Blue
  secondary: '#39CCCC',  // Teal
  accent: '#7FDBFF',     // Sky Blue
  success: '#39CCCC',    // Teal used for positive/success
  warning: '#FF851B',    // Orange
  error: '#FF4136',      // Red
  background: 'transparent',
  card: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  divider: '#E0E0E0',
  inputBackground: '#F8F9FA',
};

const StatusBadge = ({ status }: { status: string }) => {
  let color = THEME.primary;
  let icon: any = 'circle-outline';

  switch (status) {
    case 'pending':
      color = THEME.warning;
      icon = 'clock-outline';
      break;
    case 'confirmed':
      color = THEME.secondary;
      icon = 'check-circle-outline';
      break;
    case 'shipped':
      color = '#707EAE';
      icon = 'truck-delivery-outline';
      break;
    case 'delivered':
      color = THEME.success;
      icon = 'check-decagram';
      break;
    case 'cancelled':
      color = THEME.error;
      icon = 'close-circle-outline';
      break;
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.statusText, { color: color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

export default function OrderManagement() {
  const { currentLanguage } = useLanguage();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
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
    // CRITICAL: Don't fetch until we have a valid user ID
    if (!user?.id) {
      console.log('OrderManagement: Waiting for user ID before fetching orders');
      return;
    }

    console.log('OrderManagement: Starting fetch with user ID:', user.id);
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
          filter: `seller_id=eq.${user.id}`,
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

  const fetchOrders = async (statusOverride?: FilterStatus) => {
    try {
      setLoading(true);
      console.log('fetchOrders: Fetching orders for user:', user?.id);
      const currentStatus = statusOverride ?? filterStatus;

      let query = supabase
        .from('orders')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false }); // Sort by latest first

      if (currentStatus !== 'all') {
        query = query.eq('status', currentStatus);
      }

      const { data: ordersData, error } = await query;
      if (error) {
        console.error('fetchOrders: Supabase error:', error);
        throw error;
      }

      console.log('fetchOrders: Fetched', ordersData?.length || 0, 'orders');

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
      // First verify the order exists
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Then update the status
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();

      if (error) throw error;

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

      // Refresh orders
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      setSnackbarMessage('Failed to update order status');
      setSnackbarVisible(true);
    }
  };

  const handleViewDetails = (orderId: string) => {
    router.push(`/wholesaler/orders/details?id=${orderId}`);
  };

  const renderOrder = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderId}>Order #{typeof order?.order_number === 'string' ? order.order_number : ''}</Text>
            <Text style={styles.date}>
              {order?.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.buyerInfoContainer}>
          <View style={styles.buyerIcon}>
            <MaterialCommunityIcons name="storefront-outline" size={20} color={THEME.textSecondary} />
          </View>
          <View style={styles.buyerDetails}>
            <Text style={styles.shopName} numberOfLines={1}>
              {typeof order?.buyer?.business_details?.shopName === 'string' ? order.buyer.business_details.shopName : 'Shop name not available'}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              {(typeof order?.delivery_address === 'string' && order.delivery_address.length > 5)
                ? order.delivery_address
                : (typeof order?.buyer?.business_details?.address === 'string' && order.buyer.business_details.address.length > 0
                  ? order.buyer.business_details.address
                  : 'No address available')}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Items</Text>
            <Text style={styles.detailValue}>{Array.isArray(order?.items) ? order.items.length : 0}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Total Amount</Text>
            <Text style={styles.detailValueHighlight}>₹{typeof order?.total_amount === 'number' ? order.total_amount.toFixed(2) : '0.00'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {order.status === 'pending' ? (
            <>
              <Button
                mode="outlined"
                onPress={() => updateOrderStatus(order.id, 'cancelled')}
                style={styles.rejectButton}
                labelStyle={styles.rejectButtonLabel}
              >
                Reject
              </Button>
              <Button
                mode="contained"
                onPress={() => updateOrderStatus(order.id, 'confirmed')}
                style={styles.acceptButton}
                labelStyle={styles.acceptButtonLabel}
              >
                Accept
              </Button>
            </>
          ) : (
            <Button
              mode="outlined"
              onPress={() => handleViewDetails(order.id)}
              style={styles.viewDetailsButton}
              labelStyle={styles.viewDetailsLabel}
              icon="arrow-right"
              contentStyle={{ flexDirection: 'row-reverse' }}
            >
              View Details
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" backgroundColor="transparent" translucent />

      {/* Light Orange Gradient Background */}
      <LinearGradient
        colors={['#FFF3E0', '#FFFFFF', '#FFF8E1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Gradient Background for Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: THEME.primary, overflow: 'hidden' }}>
        <LinearGradient
          colors={[THEME.primary, '#003366']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle decorative circles */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => router.back()}
          >
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor="#FFFFFF"
              onPress={() => router.back()}
              style={{ margin: 0 }}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={{ width: 40 }} />
        </View>

        <Searchbar
          placeholder="Search orders"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor={THEME.textSecondary}
          placeholderTextColor={THEME.textSecondary}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
          <SegmentedButtons
            value={filterStatus}
            onValueChange={(value) => {
              const newStatus = value as FilterStatus;
              setFilterStatus(newStatus);
              fetchOrders(newStatus);
            }}
            buttons={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
            ]}
            style={styles.segmentedButtons}
            density="small"
            theme={{ colors: { secondaryContainer: THEME.secondary, onSecondaryContainer: '#FFF', outline: THEME.divider } }}
          />
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={THEME.secondary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={THEME.textSecondary} style={{ opacity: 0.5 }} />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptyText}>
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
              colors={[THEME.secondary]}
            />
          }
        />
      )}

      <Portal>
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
                style={styles.statusButtonModal}
                textColor={THEME.primary}
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
          style={{ backgroundColor: THEME.primary }}
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
    backgroundColor: THEME.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    backgroundColor: 'transparent',
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    margin: 0,
  },
  searchBar: {
    marginHorizontal: 16,
    marginVertical: 12,
    elevation: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 0,
    color: THEME.textPrimary,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segmentedButtons: {
    minWidth: 400, // Force scrollable width
    backgroundColor: THEME.card,
  },

  // List
  list: {
    padding: 16,
    paddingTop: 8,
  },
  orderCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#2B3674",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardContent: {
    padding: 16,
  },

  // Order Header
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderIdContainer: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  date: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Buyer Info
  buyerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.card,
    padding: 12,
    borderRadius: 12,
  },
  buyerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buyerDetails: {
    flex: 1,
  },
  shopName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    color: THEME.textSecondary,
  },

  divider: {
    height: 1,
    backgroundColor: THEME.divider,
    marginVertical: 12,
  },

  // Order Details
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {

  },
  detailLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  detailValueHighlight: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.secondary,
  },

  // Actions
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderColor: THEME.error,
    borderWidth: 1.5,
  },
  rejectButtonLabel: {
    color: THEME.error,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: THEME.success,
  },
  acceptButtonLabel: {
    color: '#FFF',
    fontWeight: '600',
  },
  viewDetailsButton: {
    flex: 1,
    borderColor: THEME.divider,
  },
  viewDetailsLabel: {
    color: THEME.textPrimary,
  },

  // Empty State
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginTop: 8,
  },

  // Modal
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  statusButtons: {
    gap: 12,
  },
  statusButtonModal: {
    borderColor: THEME.divider,
  }
});
