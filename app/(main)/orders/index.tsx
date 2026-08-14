import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform, TouchableOpacity, Pressable } from 'react-native';
import { Text, Button, Portal, Modal, Surface, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { Order } from '../../../types/orders';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { SystemStatusBar } from '../../../components/SystemStatusBar';

// Premium Theme Constants
const COLORS = {
  primary: '#FF7D00',
  secondary: '#1A1A1A',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#8E8E93',
  border: '#F0F0F0',
  success: '#2E7D32',        // Darker green for better contrast
  danger: '#C62828',          // Darker red for better contrast
  warning: '#E65100',         // Deep orange (matches primary tone)
  info: '#1565C0',            // Darker blue for better contrast
  successBg: '#E8F5E9',       // Light green
  dangerBg: '#FFEBEE',        // Light red
  warningBg: '#FFF3E0',       // Light orange (matches primary)
  infoBg: '#E3F2FD',          // Light blue
  pendingBg: '#FFF3E0',       // Light orange for pending
  pendingText: '#E65100',     // Deep orange for pending text
};

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
    noOrdersSub: 'Looks like you haven\'t placed any orders yet.',
    startShopping: 'Start Shopping',
    orderNumber: 'Order #',
    totalAmount: 'Total Amount',
    status: 'Status',
    items: 'Items',
    reorder: 'Reorder',
    cancel: 'Cancel',
    pending: 'Pending',
    placed: 'Placed',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    completed: 'Completed',
    total: 'Total',
    cancelOrderTitle: 'Cancel Order',
    cancelOrderMessage: 'Are you sure you want to cancel this order?',
    keepOrder: 'No, Keep Order',
    confirmCancel: 'Yes, Cancel Order',
    outOfStock: 'Out of Stock'
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

        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations as any);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Translation function
  const t = (key: keyof typeof originalTexts) => {
    return translations[key] || originalTexts[key] || key;
  };

  useEffect(() => {
    fetchOrders();

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
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Filter out pending orders older than 5 minutes (abandoned/failed payments)
      // This prevents showing orders that were never completed
      const { data: allOrders, error: fetchError } = await supabase
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

      if (fetchError) throw fetchError;

      // Filter out pending orders older than 5 minutes (except COD/cash orders)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const filteredOrders = (allOrders || []).filter(order => {
        const status = order.status?.toLowerCase()?.trim();
        const paymentMethod = order.payment_method?.toLowerCase()?.trim();

        // Orders with 'placed' status are confirmed orders - always show them
        if (status === 'placed') {
          return true;
        }

        // Always show COD/cash/online orders (including null/undefined which defaults to COD)
        if (!paymentMethod || paymentMethod === 'cod' || paymentMethod === 'cash' || paymentMethod === 'online') {
          return true;
        }

        // Show non-pending payment orders (completed payments)
        if (order.payment_status !== 'pending') {
          return true;
        }

        // Show pending online payment orders created within last 5 minutes
        const orderDate = new Date(order.created_at);
        if (orderDate > fiveMinutesAgo) {
          return true;
        }

        // Filter out old pending online payment orders (abandoned/failed payments)
        return false;
      });

      setOrders(filteredOrders);
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

      router.push(`/(main)/orders/${data.id}`);
    } catch (error) {
      console.error('Error reordering:', error);
    }
  }, [user?.id, router, generateOrderNumber]);

  const handleCancelOrder = useCallback(async () => {
    if (!selectedOrder) return;

    try {
      // Update order status
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: 'Cancelled by user'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Send WhatsApp notification to seller
      try {
        // Get seller details
        const { data: orderWithSeller } = await supabase
          .from('orders')
          .select(`
            *,
            seller:profiles!orders_seller_id_fkey(
              id,
              phone_number,
              business_details
            )
          `)
          .eq('id', selectedOrder.id)
          .single();

        if (orderWithSeller?.seller?.phone_number) {
          // The notify-order-whatsapp edge function resolves the seller, order
          // number, buyer name and payment status from the order itself. This
          // previously passed the seller's phone number and all five template
          // variables from the device, which would have let a modified client send
          // this template to any number.
          const { authkeyWhatsAppService } = await import(
            '../../../services/whatsapp/AuthkeyWhatsAppService'
          );

          const result = await authkeyWhatsAppService.notifyOrderCancelledByRetailer(
            selectedOrder.id
          );

          if (result.sent > 0) {
            console.log('[Orders] WhatsApp notification sent to seller about cancellation');
          } else {
            console.warn('[Orders] Failed to send WhatsApp cancellation notification');
          }
        }
      } catch (whatsappError) {
        // Don't fail the cancellation if WhatsApp fails
        console.warn('[Orders] Unexpected error sending WhatsApp:', whatsappError);
      }

      fetchOrders();
      setCancelModalVisible(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  }, [selectedOrder, fetchOrders, user]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      // Completed states - Green
      case 'delivered':
      case 'completed':
        return { bg: '#E8F5E9', text: '#2E7D32' };

      // Error states - Red
      case 'cancelled':
      case 'failed':
      case 'rejected':
        return { bg: '#FFEBEE', text: '#C62828' };

      // In transit / Shipping states - Blue
      case 'shipped':
      case 'in_transit':
      case 'out_for_delivery':
        return { bg: '#E3F2FD', text: '#1565C0' };

      // Processing states - Purple/Indigo
      case 'processing':
      case 'picked_up':
        return { bg: '#EDE7F6', text: '#5E35B1' };

      // Confirmed/Accepted states - Teal
      case 'confirmed':
      case 'accepted':
        return { bg: '#E0F2F1', text: '#00796B' };

      // Pending state - Orange (matches app theme)
      case 'pending':
      default:
        return { bg: '#FFF3E0', text: '#E65100' };
    }
  };

  // Status Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = getStatusColor(status);
    const displayStatus = status === 'confirmed' ? 'placed' : status;
    return (
      <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusText, { color: colors.text }]}>
          {t(displayStatus as any)}
        </Text>
      </View>
    );
  };

  const renderOrderCard = useCallback(({ item: order }: { item: Order }) => {
    const date = new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    // Calculate total items
    const itemCount = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const itemText = itemCount === 1 ? 'item' : 'items';

    // Calculate display total (ensure delivery fee is handled)
    const subtotal = order.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);

    // Handle delivery_fee - check if it's null, undefined, or a valid number
    let deliveryFee = 0;
    if (order.delivery_fee !== null && order.delivery_fee !== undefined) {
      deliveryFee = Number(order.delivery_fee);
      if (isNaN(deliveryFee)) {
        deliveryFee = 0;
      }
    }

    const finalTotal = subtotal + deliveryFee;

    // Debug logging for troubleshooting
    if (deliveryFee === 0 && order.delivery_fee !== null && order.delivery_fee !== undefined) {
      console.log('Orders Screen - Delivery fee issue:', {
        orderId: order.id,
        delivery_fee: order.delivery_fee,
        deliveryFee,
        subtotal,
        finalTotal
      });
    }

    const isPending = order.status === 'pending';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.orderCard,
          pressed && styles.orderCardPressed
        ]}
        onPress={() => router.push(`/(main)/orders/${order.id}`)}
      >
        {/* Header: Order #, Date, Status */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>{t('orderNumber')} {order.order_number}</Text>
            <Text style={styles.orderDate}>{date}</Text>
            {/* Payment Status Banner */}
            {order.payment_method && (
              (order.payment_method === 'cod' || order.payment_method === 'cash') ||
              order.payment_status === 'completed'
            ) && (
                <View style={[
                  styles.paymentBanner,
                  order.payment_method === 'cod' || order.payment_method === 'cash'
                    ? styles.codBanner
                    : styles.paidBanner
                ]}>
                  <Text style={[
                    styles.paymentBannerText,
                    order.payment_method === 'cod' || order.payment_method === 'cash'
                      ? { color: COLORS.warning }
                      : { color: COLORS.success }
                  ]}>
                    {order.payment_method === 'cod' || order.payment_method === 'cash' ? 'COD' : 'Paid'}
                  </Text>
                </View>
              )}
          </View>
          <StatusBadge status={order.status} />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Items Preview (First 2 items) */}
        <View style={styles.itemsContainer}>
          {order.items.slice(0, 2).map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemDot} />
              <Text style={styles.itemName} numberOfLines={1}>
                {item.quantity}x  {item.name}
              </Text>
            </View>
          ))}
          {order.items.length > 2 && (
            <Text style={styles.moreItemsText}>
              + {order.items.length - 2} more items
            </Text>
          )}
        </View>

        {/* Footer: Price & Actions */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.totalLabel}>{t('totalAmount')}</Text>
            <Text style={styles.totalPrice}>₹{finalTotal.toFixed(2)}</Text>
          </View>

          <View style={styles.actionsContainer}>
            {isPending && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedOrder(order);
                  setCancelModalVisible(true);
                }}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.reorderButton}
              onPress={() => handleReorder(order)}
            >
              <MaterialIcons name="refresh" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.reorderButtonText}>{t('reorder')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  }, [router, handleReorder, t]);

  return (
    <View style={styles.mainContainer}>
      <SystemStatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('myOrders')}</Text>
        <View style={styles.placeholderIcon} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchOrders();
              }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="bag-handle-outline" size={64} color={COLORS.textLight} />
              </View>
              <Text style={styles.emptyTitle}>{t('noOrders')}</Text>
              <Text style={styles.emptySub}>{t('noOrdersSub')}</Text>
              <Button
                mode="contained"
                onPress={() => router.push('/(main)/screens/categories')}
                style={styles.shopButton}
                labelStyle={styles.shopButtonText}
              >
                {t('startShopping')}
              </Button>
            </View>
          }
        />
      )}

      {/* Cancel Modal */}
      <Portal>
        <Modal
          visible={cancelModalVisible}
          onDismiss={() => setCancelModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.warningIconContainer}>
              <MaterialIcons name="warning" size={32} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>{t('cancelOrderTitle')}</Text>
            <Text style={styles.modalMessage}>{t('cancelOrderMessage')}</Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setCancelModalVisible(false)}
                style={styles.modalButtonSecondary}
                textColor={COLORS.secondary}
                theme={{ colors: { outline: COLORS.border } }}
              >
                {t('keepOrder')}
              </Button>
              <Button
                mode="contained"
                onPress={handleCancelOrder}
                style={styles.modalButtonPrimary}
                buttonColor={COLORS.danger}
              >
                {t('confirmCancel')}
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  placeholderIcon: {
    width: 40,
  },

  // List Styles
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Order Card Styles
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#FFF', // Subtle highlight
  },
  orderCardPressed: {
    transform: [{ scale: 0.995 }],
    backgroundColor: '#FAFAFA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentBanner: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  codBanner: {
    backgroundColor: '#FFF3E0',
  },
  paidBanner: {
    backgroundColor: '#E8F5E9',
  },
  paymentBannerText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary, // Orange accent
    marginRight: 8,
    opacity: 0.7,
  },
  itemName: {
    fontSize: 14,
    color: '#444',
    flex: 1,
  },
  moreItemsText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 14, // align with text
    marginTop: 2,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reorderButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  reorderButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  shopButton: {
    borderRadius: 25,
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  shopButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Modal Styles
  modalContainer: {
    margin: 20,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  warningIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    borderRadius: 12,
  },
  modalButtonPrimary: {
    flex: 1,
    borderRadius: 12,
  },
});