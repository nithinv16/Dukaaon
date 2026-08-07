import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { MaterialIcons, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { getOrderById } from '../../../services/supabase/supabase';

// Premium Theme Constants
const COLORS = {
  primary: '#FF7D00',
  secondary: '#1A1A1A',
  background: '#F2F2F2',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#8E8E93',
  border: '#E5E5EA',
  success: '#2E7D32',         // Darker green for better contrast
  danger: '#C62828',          // Darker red for better contrast
  warning: '#E65100',         // Deep orange (matches primary tone)
  info: '#1565C0',            // Darker blue for better contrast
  divider: '#D1D1D6',
};

interface Order {
  id: string;
  order_number?: string | number;
  status?: string;
  created_at?: string;
  delivery_address?: string | object;
  payment_method?: string;
  payment_status?: string;
  retailer?: {
    name?: string;
    address?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
  };
  seller?: {
    id?: string;
    name?: string;
    address?: string;
    phone?: string;
  };
  multipleSellers?: boolean;
  allSellers?: Array<{
    id?: string;
    name?: string;
    address?: string;
    phone?: string;
  }>;
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
  const id = typeof (params as any).id === 'string' ? (params as any).id : '';
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) throw new Error('Order ID is required');
      const orderData = await getOrderById(id as string);
      if (!orderData) throw new Error('Order not found');

      // Debug log
      console.log('Order Details Data:', {
        id: orderData.id,
        seller: orderData.seller,
        hasItems: orderData.items?.length,
        delivery_fee: orderData.delivery_fee,
        total_amount: orderData.total_amount
      });

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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      // Completed states - Green
      case 'delivered':
      case 'completed':
        return '#2E7D32';

      // Error states - Red
      case 'cancelled':
      case 'failed':
      case 'rejected':
        return '#C62828';

      // In transit / Shipping states - Blue
      case 'shipped':
      case 'in_transit':
      case 'out_for_delivery':
        return '#1565C0';

      // Processing states - Purple/Indigo
      case 'processing':
      case 'picked_up':
        return '#5E35B1';

      // Confirmed/Accepted states - Teal
      case 'confirmed':
      case 'accepted':
        return '#00796B';

      // Placed state - Orange (matches app theme)
      case 'placed':
        return '#E65100';

      // Pending state - Orange (matches app theme)
      case 'pending':
      default:
        return '#E65100';
    }
  };

  // Helper to safely render text
  const safeRender = (value: any, fallback = 'N/A') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color={COLORS.textLight} />
        <Text style={styles.errorText}>{error || 'Order not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrderDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButtonTextLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(order.status || 'pending');

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />

      {/* Navbar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

        {/* Main Receipt Card */}
        <View style={styles.receiptCard}>

          {/* 1. Header Section: Status & Order Info */}
          <View style={styles.receiptHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.orderNumber}>Order #{safeRender(order.order_number)}</Text>
            <View style={[styles.statusPill, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {order.status === 'confirmed' ? 'Placed' : safeRender(order.status)}
              </Text>
            </View>
            {/* Payment Status Banner */}
            {order.payment_method && (
              (order.payment_method === 'cod' || order.payment_method === 'cash') ||
              (order.payment_status === 'paid' || order.payment_status === 'completed')
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
            <Text style={styles.dateText}>
              {order.created_at ? new Date(order.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              }) : 'N/A'}
            </Text>
          </View>

          {/* Dashed Divider */}
          <View style={styles.dashedDivider}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>

          {/* 2. Seller Details */}
          {order.seller && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>MERCHANT</Text>
              <View style={styles.merchantRow}>
                <View style={styles.merchantIconBox}>
                  <FontAwesome5 name="store" size={14} color="#FFF" />
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName}>{order.seller.name || 'Unknown Seller'}</Text>
                  {order.seller.address && (
                    <Text style={styles.merchantAddress}>{order.seller.address}</Text>
                  )}
                  {order.seller.phone && (
                    <Text style={styles.merchantPhone}>{order.seller.phone}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* 3. Items List */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ITEMS</Text>
            {order.items?.map((item, index) => {
              const quantity = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              const total = quantity * price;

              return (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.quantityBox}>
                    <Text style={styles.quantityText}>{quantity}x</Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{safeRender(item.name)}</Text>
                    <Text style={styles.itemUnit}>{safeRender(item.unit)}</Text>
                  </View>
                  <Text style={styles.itemTotal}>₹{total.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>

          {/* Dashed Divider */}
          <View style={styles.dashedDivider}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>

          {/* 4. Payment Breakdown */}
          <View style={styles.section}>
            <OrderPriceBreakdown order={order} />
          </View>

          {/* 5. Tracking / Extra Info */}
          {order.tracking_number && (
            <View style={styles.trackingContainer}>
              <MaterialCommunityIcons name="truck-fast-outline" size={20} color={COLORS.primary} />
              <Text style={styles.trackingText}>Tracking: {safeRender(order.tracking_number)}</Text>
            </View>
          )}

        </View>

        {/* Footer Text */}
        <Text style={styles.footerNote}>
          Thank you for shopping with DukaaOn!
        </Text>

        <TouchableOpacity style={styles.helpButton}>
          <Text style={styles.helpButtonText}>Need help with this order?</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function OrderPriceBreakdown({ order }: { order: Order }) {
  const subtotal = (order.items || []).reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);

  // Handle delivery_fee - check if it's null, undefined, or a valid number
  let deliveryFee = 0;
  if (order.delivery_fee !== null && order.delivery_fee !== undefined) {
    deliveryFee = Number(order.delivery_fee);
    if (isNaN(deliveryFee)) {
      deliveryFee = 0;
    }
  }

  // Calculate total amount - if order.total_amount exists and is different from subtotal,
  // it might already include delivery fee, so use the larger of the two calculations
  const calculatedTotal = subtotal + deliveryFee;
  const totalAmount = calculatedTotal;

  // Debug logging
  console.log('OrderPriceBreakdown:', {
    subtotal,
    delivery_fee: order.delivery_fee,
    deliveryFee,
    calculatedTotal,
    totalAmount,
    // order_total_amount: order.total_amount
  });

  return (
    <View style={styles.priceContainer}>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Subtotal</Text>
        <Text style={styles.priceValue}>₹{subtotal.toFixed(2)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Delivery Fee</Text>
        <Text style={styles.priceValue}>
          {deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'Free'}
        </Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  backButtonTextLink: {
    marginTop: 16,
  },
  backLinkText: {
    color: COLORS.text,
    textDecorationLine: 'underline',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  // Content
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Receipt Card
  receiptCard: {
    backgroundColor: COLORS.surface,
    width: '100%',
    borderRadius: 16,
    padding: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },

  // Receipt Header
  receiptHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5E6', // Light orange
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  paymentBanner: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'center',
  },
  codBanner: {
    backgroundColor: '#FFF3E0',
  },
  paidBanner: {
    backgroundColor: '#E8F5E9',
  },
  paymentBannerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Divider
  dashedDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
    paddingHorizontal: 16,
    height: 1,
  },
  dash: {
    width: 8,
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 1,
  },

  // Sections
  section: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  // Merchant
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 12,
  },
  merchantIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  merchantAddress: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
    marginBottom: 2,
  },
  merchantPhone: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  quantityBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
    lineHeight: 20,
  },
  itemUnit: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Breakdown
  priceContainer: {
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Tracking
  trackingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F7FDF9',
    borderTopWidth: 1,
    borderTopColor: '#E8F5E9',
  },
  trackingText: {
    marginLeft: 8,
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },

  // Footer
  footerNote: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  helpButton: {
    padding: 12,
  },
  helpButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});