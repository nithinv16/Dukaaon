import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Chip, Divider, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { supabase } from '../../../../services/supabase/supabase';
import { NotificationService } from '../../../../services/notifications/NotificationService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
  delivery_fee?: number;
}

// --- Helper Components ---

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
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[styles.statusText, { color: color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

const OrderItem = ({ item, isPending, onMarkOutOfStock }: {
  item: OrderItem;
  isPending?: boolean;
  onMarkOutOfStock?: () => void;
}) => {
  const getPrice = () => {
    const rawPrice = (item as any)?.price ?? (item as any)?.unit_price ?? 0;
    if (typeof rawPrice === 'number') return rawPrice;
    if (typeof rawPrice === 'string') return parseFloat(rawPrice) || 0;
    return 0;
  };

  const getQuantity = () => {
    if (typeof item?.quantity === 'number') return item.quantity;
    if (typeof item?.quantity === 'string') return parseInt(item.quantity) || 0;
    return 0;
  };

  const price = getPrice();
  const quantity = getQuantity();

  return (
    <View style={[styles.itemRow, item.outOfStock && styles.itemOutOfStock]}>
      <View style={[styles.itemIcon, { backgroundColor: item.outOfStock ? '#FFEEEE' : '#F4F7FE' }]}>
        <MaterialCommunityIcons
          name={item.outOfStock ? "close" : "package-variant-closed"}
          size={20}
          color={item.outOfStock ? THEME.error : THEME.secondary}
        />
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {typeof item?.name === 'string' ? item.name : (item as any)?.product_name || 'Product'}
        </Text>
        <View style={styles.itemMetaRow}>
          <Text style={styles.itemPrice}>₹{price.toFixed(2)}</Text>
          <Text style={styles.itemQuantity}>× {quantity}</Text>
        </View>
      </View>

      <View style={styles.itemTotalContainer}>
        <Text style={[styles.itemTotal, item.outOfStock && { textDecorationLine: 'line-through', opacity: 0.5 }]}>
          ₹{(price * quantity).toFixed(2)}
        </Text>
        {item.outOfStock && <Text style={styles.outOfStockLabel}>Out of Stock</Text>}
      </View>

      {isPending && !item.outOfStock && (
        <IconButton
          icon="cart-off"
          iconColor={THEME.error}
          size={20}
          onPress={onMarkOutOfStock}
          style={styles.removeButton}
        />
      )}
    </View>
  );
};

export default function OrderDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      // First, let's check if we can get the order without joins
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      // Then get the buyer details
      const { data: buyerData, error: buyerError } = await supabase
        .from('profiles')
        .select('id, business_details')
        .eq('id', orderData.user_id)
        .single();

      if (buyerError) console.error('Error fetching buyer:', buyerError);

      // Combine the data
      setOrder({ ...orderData, buyer: buyerData });
    } catch (error) {
      console.error('Error in fetchOrderDetails:', error);
    } finally {
      setLoading(false);
    }
  };

  const markItemOutOfStock = async (itemIndex: number) => {
    if (!order) return;

    try {
      const itemToMark = order.items[itemIndex];
      const updatedItems = order.items.map((item, index) =>
        index === itemIndex ? { ...item, outOfStock: true } : item
      );

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

      const newSubtotal = updatedItems.reduce((total, item) =>
        item.outOfStock ? total : total + (item.quantity * item.price),
        0
      );

      const newTotalAmount = newSubtotal + (order.delivery_fee || 0);

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

      await NotificationService.sendOutOfStockNotification(
        order.id,
        order.order_number,
        itemToMark.name,
        order.user_id
      );

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

      setOrder({ ...order, status: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={THEME.secondary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Order not found</Text>
      </View>
    );
  }

  const getSubtotal = () => order.items
    .filter(item => !item.outOfStock)
    .reduce((total, item) => total + (item.quantity * item.price), 0);

  const getDeliveryFee = () => typeof order.delivery_fee === 'number' ? order.delivery_fee : 0;

  const getTotal = () => getSubtotal() + getDeliveryFee();

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

      {/* Header */}
      <View style={styles.header}>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order #{order.order_number}</Text>
          <Text style={styles.headerTime}>
            {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Placeholder for potential actions like print/share */}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Status Section */}
        <View style={styles.statusSection}>
          <StatusBadge status={order.status} />
          <View style={{ flex: 1 }} />
          <Text style={styles.paymentStatus}>
            Payment: {typeof order?.payment_status === 'string' ? order.payment_status.toUpperCase() : 'UNKNOWN'}
          </Text>
        </View>

        {/* Buyer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="storefront-outline" size={20} color={THEME.textSecondary} />
            <Text style={styles.cardTitle}>Buyer Details</Text>
          </View>
          <View style={styles.buyerContent}>
            <Text style={styles.buyerName}>
              {typeof order.buyer?.business_details?.shopName === 'string'
                ? order.buyer.business_details.shopName
                : 'Retailer'}
            </Text>
            <View style={styles.addressRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={THEME.textSecondary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {(typeof order?.delivery_address === 'string' && order.delivery_address.length > 5)
                  ? order.delivery_address
                  : (typeof order?.buyer?.business_details?.address === 'string' && order.buyer.business_details.address.length > 0
                    ? order.buyer.business_details.address
                    : 'No address available')}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="basket-outline" size={20} color={THEME.textSecondary} />
            <Text style={styles.cardTitle}>Items ({order.items?.length || 0})</Text>
          </View>

          <View style={styles.itemsList}>
            {order.items.map((item, index) => (
              <React.Fragment key={index}>
                <OrderItem
                  item={item}
                  isPending={order.status === 'pending'}
                  onMarkOutOfStock={() => markItemOutOfStock(index)}
                />
                {index < order.items.length - 1 && <Divider style={styles.itemDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Out of Stock Section */}
        {order.out_of_stock_items && order.out_of_stock_items.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="close-circle-outline" size={20} color={THEME.error} />
              <Text style={[styles.cardTitle, { color: THEME.error }]}>Out of Stock Items</Text>
            </View>
            <View style={styles.itemsList}>
              {order.out_of_stock_items.map((item, index) => (
                <View key={'oos-' + index} style={[styles.itemRow, { opacity: 0.6 }]}>
                  <Text style={[styles.itemName, { textDecorationLine: 'line-through' }]}>
                    {typeof item?.name === 'string' ? item.name : 'Product'}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Chip style={{ backgroundColor: '#FEE' }} textStyle={{ color: THEME.error, fontSize: 10 }}>Removed</Chip>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Financial Summary */}
        <View style={styles.card}>
          <View style={[styles.summaryRow, { marginTop: 0 }]}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{getSubtotal().toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₹{getDeliveryFee().toFixed(2)}</Text>
          </View>
          <Divider style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{getTotal().toFixed(2)}</Text>
          </View>
        </View>

        {/* Bottom Space for FAB/Actions */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Floating Action Bar */}
      {order.status === 'pending' && (
        <View style={styles.actionBar}>
          <Button
            mode="outlined"
            onPress={() => updateOrderStatus('cancelled')}
            style={[styles.actionBtn, styles.rejectBtn]}
            contentStyle={{ height: 50 }}
            labelStyle={{ color: THEME.error, fontWeight: '700', fontSize: 16 }}
          >
            Reject
          </Button>
          <Button
            mode="contained"
            onPress={() => updateOrderStatus('confirmed')}
            style={[styles.actionBtn, styles.acceptBtn]}
            contentStyle={{ height: 50 }}
            labelStyle={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}
          >
            Accept Order
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    margin: 0,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Status Section
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentStatus: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '600',
  },

  // Cards
  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2, // Low elevation for minimalist feel
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textPrimary,
  },

  // Buyer Info
  buyerContent: {
    paddingLeft: 4,
  },
  buyerName: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 16,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },

  // Order Items
  itemsList: {

  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemOutOfStock: {
    opacity: 0.8,
  },
  itemDivider: {
    backgroundColor: THEME.inputBackground,
    height: 1,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemPrice: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  itemQuantity: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '600',
    backgroundColor: THEME.inputBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemTotalContainer: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.primary,
  },
  outOfStockLabel: {
    fontSize: 10,
    color: THEME.error,
    fontWeight: '600',
    marginTop: 2,
  },
  removeButton: {
    margin: 0,
    marginRight: -12,
  },

  // Financial Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  summaryDivider: {
    backgroundColor: THEME.divider,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.secondary,
  },

  // Actions Bar
  actionBar: {
    position: 'absolute',
    bottom: 90, // Lifted above Bottom Navigation
    left: 16,
    right: 16,
    backgroundColor: THEME.card,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 24,
    gap: 16,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
  },
  rejectBtn: {
    borderColor: THEME.error,
    borderWidth: 2,
  },
  acceptBtn: {
  }
});