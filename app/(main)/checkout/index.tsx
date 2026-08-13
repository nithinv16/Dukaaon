import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator, Portal, Modal, Divider, IconButton, Surface } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCartStore } from '../../../store/cart';
import { usePaymentStore } from '../../../store/payment';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { PaymentProcessor } from '../../../components/payment/PaymentProcessor';
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog';

// Premium Color Palette
const COLORS = {
  primary: '#FF7D00', // Vibrant Orange - Brand Color
  primaryLight: '#FFF3E0', // Soft Orange for backgrounds
  primaryDark: '#E65100', // Darker Orange for gradients
  secondary: '#1A1A1A', // Almost Black for significant text
  text: '#333333', // Dark Grey for normal text
  textLight: '#757575', // Medium Grey for secondary text
  white: '#FFFFFF',
  background: '#F8F9FA', // Cool White/Grey for overall background
  cardBg: '#FFFFFF',
  border: '#EEEEEE',
  success: '#4CAF50',
  error: '#FF3B30',
  surface: '#FFFFFF',
};

export default function Checkout() {
  console.log('Rendering Checkout component');
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    subtotal: string; 
    deliveryFee: string; 
    total: string;
    autoPay?: string; // Flag to auto-open Razorpay
    preferredMethod?: string; // Preferred payment method (e.g., 'upi')
  }>();
  const { items, clearCart } = useCartStore();
  const { defaultMethod } = usePaymentStore();
  const user = useAuthStore(state => state.user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null); // Real order ID for online payments (created before Razorpay opens)
  const [pendingMasterOrderId, setPendingMasterOrderId] = useState<string | null>(null); // Real master order ID for multi-seller online payments
  const [showPaymentProcessor, setShowPaymentProcessor] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [hasAutoPaid, setHasAutoPaid] = useState(false); // Track if auto-pay has been triggered

  // Get amounts from route params (passed from cart) or calculate from items
  const subtotal = params.subtotal ? Number(params.subtotal) : items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  const deliveryFee = params.deliveryFee ? Number(params.deliveryFee) : 0;
  const total = params.total ? Number(params.total) : subtotal + deliveryFee;
  
  // Check if autoPay is enabled
  const autoPay = params.autoPay === 'true';
  const preferredMethod = params.preferredMethod || 'upi';

  // Map payment method to allowed values in orders table
  const mapPaymentMethod = (method: string): string => {
    switch (method) {
      case 'cod':
        return 'cash'; // Cash on Delivery
      case 'razorpay':
      case 'card':
      case 'netbanking':
        return 'online'; // All online payment methods
      case 'upi':
        return 'upi';
      default:
        return 'cash'; // Default fallback
    }
  };

  useEffect(() => {
    console.log('Default Method:', defaultMethod);
  }, [defaultMethod]);

  // Auto-trigger payment when autoPay flag is set
  useEffect(() => {
    const autoTriggerPayment = async () => {
      if (autoPay && defaultMethod && defaultMethod.type === 'razorpay' && !pendingOrderId && !pendingMasterOrderId && !hasAutoPaid && !loading && user && items.length > 0) {
        console.log('[Checkout] Auto-triggering Razorpay payment with UPI pre-selected');
        setHasAutoPaid(true);
        handlePayment().catch((err) => {
          console.error('[Checkout] Auto-pay error:', err);
          setError(err.message || 'Failed to auto-start payment');
          setHasAutoPaid(false); // Reset to allow retry
        });
      }
    };

    autoTriggerPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPay, defaultMethod, pendingOrderId, pendingMasterOrderId, hasAutoPaid, loading, user]);

  const handlePayment = async () => {
    if (!defaultMethod || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Handle COD: Create order immediately (payment guaranteed)
      if (defaultMethod.type === 'cod') {
      // 1. Generate unique order ID
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).substr(2, 9)}`;

      // 2. Get unique seller IDs from cart items
      const uniqueSellerIds = [...new Set(items.map(item => item.seller_id).filter(Boolean))];

      if (uniqueSellerIds.length === 0) {
        throw new Error('No seller found in cart items');
      }

      // 3. For orders table, we need a single seller_id
      const primarySellerId = uniqueSellerIds[0];

        // 4. Create order with COD status
        const orderSubtotal = subtotal;
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          seller_id: primarySellerId,
          items: items,
            total_amount: orderSubtotal, // Store subtotal only
            delivery_fee: deliveryFee, // Explicitly include delivery fee
            status: 'placed', // COD orders are immediately placed
            payment_status: 'pending', // COD payment is pending until delivery
          payment_method: mapPaymentMethod(defaultMethod.type),
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 5. Notify all sellers
      if (uniqueSellerIds.length > 0) {
        const { error: notificationError } = await supabase
          .from('seller_notifications')
          .insert(uniqueSellerIds.map(sellerId => ({
            seller_id: sellerId,
            type: 'new_order',
            order_id: order.id,
            message: `New order received: ${orderNumber}`,
            status: 'unread'
          })));

        if (notificationError) {
          console.warn('Error creating seller notifications:', notificationError);
        }
      }

        setOrderId(order.id);
        // Clear cart after successful order creation
        await clearCart();
        setSuccessModalVisible(true);
        return;
      }

      // -----------------------------------------------------------------------
      // Online payments: Create PENDING order FIRST, then open Razorpay sheet.
      // The client NEVER writes payment_status = 'paid'. That is done server-side
      // by verify-razorpay-payment → mark_order_paid after signature verification.
      // -----------------------------------------------------------------------

      const uniqueSellerIds = [...new Set(items.map(item => item.seller_id).filter(Boolean))];

      if (uniqueSellerIds.length === 0) {
        throw new Error('No seller found in cart items');
      }

      if (uniqueSellerIds.length > 1) {
        // Multi-seller: create pending master order via MasterOrderService
        const { splitCartBySeller } = useCartStore.getState();
        const itemsBySeller = splitCartBySeller();

        const deliveryAddress = {
          street: user.business_details?.address || '',
          city: user.business_details?.city || '',
          state: user.business_details?.state || '',
          postal_code: user.business_details?.postal_code || '',
          address: user.business_details?.address || '',
          pincode: user.business_details?.postal_code || '',
          country: 'India',
          latitude: user.latitude ? Number(user.latitude) : 0,
          longitude: user.longitude ? Number(user.longitude) : 0
        };

        let totalAmount = 0;
        const ordersBySeller: Record<string, any> = {};
        const sellerIds = Object.keys(itemsBySeller);
        const firstSellerId = sellerIds[0];

        for (const [seller_id, sellerItems] of Object.entries(itemsBySeller)) {
          const sellerSubtotal = sellerItems.reduce((sum, item) =>
            sum + (Number(item.price) * item.quantity), 0);
          totalAmount += sellerSubtotal;

          const deliveryFeeForThisSeller = seller_id === firstSellerId ? deliveryFee : 0;

          ordersBySeller[seller_id] = {
            user_id: user.id,
            seller_id: seller_id,
            items: sellerItems.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              price: item.price,
              name: item.name,
              unit: item.unit
            })),
            total_amount: sellerSubtotal,
            delivery_fee: deliveryFeeForThisSeller,
            status: 'placed',
            payment_status: 'pending', // NEVER 'paid' — server decides
            payment_method: mapPaymentMethod(defaultMethod?.type || 'razorpay'),
            delivery_address: user.business_details?.shopName
              ? `${user.business_details.shopName}, ${user.business_details?.address || ''}`
              : user.business_details?.address || '',
            order_number: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            payment_initiated_at: new Date().toISOString(),
          };
        }

        const { MasterOrderService } = await import('../../../services/masterOrderService');

        const result = await MasterOrderService.placeCompleteOrder(
          user.id,
          ordersBySeller,
          deliveryAddress,
          totalAmount,
          deliveryFee,
          mapPaymentMethod(defaultMethod?.type || 'razorpay'),
          undefined
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to create order');
        }

        // Set payment_initiated_at on the master order row
        await supabase
          .from('master_orders')
          .update({ payment_initiated_at: new Date().toISOString() })
          .eq('id', result.masterOrderId);

        // Store the real master order ID — we'll use it for verification after Razorpay
        setPendingMasterOrderId(result.masterOrderId!);
        setPendingOrderId(null);
      } else {
        // Single-seller: create pending order directly
        const orderNumber = `ORD-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).substr(2, 9)}`;
        const primarySellerId = uniqueSellerIds[0];

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            user_id: user.id,
            seller_id: primarySellerId,
            items: items,
            total_amount: subtotal,
            delivery_fee: deliveryFee,
            status: 'placed',
            payment_status: 'pending', // NEVER 'paid' — server decides
            payment_method: mapPaymentMethod(defaultMethod?.type || 'razorpay'),
            payment_initiated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Store the real order ID — we'll use it for verification after Razorpay
        // Seller notifications are sent AFTER payment verification succeeds (in handlePaymentSuccess)
        setPendingOrderId(order.id);
        setPendingMasterOrderId(null);
      }

      // Open the Razorpay payment sheet
      setShowPaymentProcessor(true);
    } catch (error: any) {
      console.error('Order processing error:', error);
      setError(error.message || 'Failed to process order');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Called after Razorpay sheet returns a success callback.
   * The client does NOT write paid state. Instead it:
   *   1. Invokes verify-razorpay-payment (which does HMAC check + mark_order_paid)
   *   2. Reads back the order to confirm payment_status === 'paid'
   *   3. On success: clearCart + show success modal
   *   4. On failure: show error, preserve cart for retry
   */
  const handlePaymentSuccess = async (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        throw new Error('User not found');
      }

      // -----------------------------------------------------------------------
      // Step 3: Invoke verify-razorpay-payment with the Razorpay triple
      // The edge function verifies HMAC and calls mark_order_paid if valid.
      // -----------------------------------------------------------------------
      const verifyBody: Record<string, any> = {
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
        amount: total,
      };

      if (pendingMasterOrderId) {
        verifyBody.master_order_id = pendingMasterOrderId;
      } else if (pendingOrderId) {
        verifyBody.order_id = pendingOrderId;
      } else {
        // Shouldn't happen — but handle gracefully
        throw new Error('No pending order found for verification');
      }

      let verifyData: any = null;
      let verifyError: any = null;

      try {
        const response = await supabase.functions.invoke('verify-razorpay-payment', {
          body: verifyBody,
        });
        verifyData = response.data;
        verifyError = response.error;
      } catch (invokeErr: any) {
        // Network error / connectivity loss after callback
        console.error('[Checkout] Verification invoke error:', invokeErr);
        setError('Verification pending — do not pay again. Please retry in a moment.');
        setShowPaymentProcessor(false);
        setLoading(false);
        return;
      }

      // -----------------------------------------------------------------------
      // Step 5: Read back the verified state
      // -----------------------------------------------------------------------
      if (verifyError || !verifyData?.verified) {
        // Verification failed: HMAC mismatch, server error, or mark_order_paid failed.
        // Order stays pending. Cart is preserved for retry.
        const failureMessage = verifyData?.code === 'MARK_ORDER_PAID_FAILED'
          ? 'Payment verified but order update failed — please retry.'
          : 'Payment could not be verified. Your order is pending — do not pay again.';
        console.error('[Checkout] Verification failed:', verifyError || verifyData);
        setError(failureMessage);
        setShowPaymentProcessor(false);
        setLoading(false);
        return;
      }

      // Verification succeeded — re-SELECT the order to confirm payment_status === 'paid'
      let confirmedPaid = false;

      if (pendingMasterOrderId) {
        const { data: masterOrder } = await supabase
          .from('master_orders')
          .select('id, payment_status')
          .eq('id', pendingMasterOrderId)
          .single();

        confirmedPaid = masterOrder?.payment_status === 'paid';
      } else if (pendingOrderId) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, payment_status')
          .eq('id', pendingOrderId)
          .single();

        confirmedPaid = order?.payment_status === 'paid';
      }

      if (!confirmedPaid) {
        // Server said verified but the row isn't paid yet — edge case / race.
        // Treat as pending and allow retry.
        setError('Verification pending — do not pay again. Please retry in a moment.');
        setShowPaymentProcessor(false);
        setLoading(false);
        return;
      }

      // -----------------------------------------------------------------------
      // Success: order confirmed paid by server. Clear cart and show success.
      // -----------------------------------------------------------------------

      // Send seller notifications now that payment is verified
      try {
        const uniqueSellerIds = [...new Set(items.map(item => item.seller_id).filter(Boolean))];
        if (uniqueSellerIds.length > 0 && (pendingOrderId || pendingMasterOrderId)) {
          const { error: notificationError } = await supabase
            .from('seller_notifications')
            .insert(uniqueSellerIds.map(sellerId => ({
              seller_id: sellerId,
              type: 'new_order',
              order_id: pendingOrderId || pendingMasterOrderId,
              message: `New order received — payment verified`,
              status: 'unread'
            })));

          if (notificationError) {
            console.warn('[Checkout] Error creating seller notifications:', notificationError);
          }
        }
      } catch (notifErr) {
        console.warn('[Checkout] Seller notification error (non-fatal):', notifErr);
      }

      await clearCart();
      setOrderId(pendingMasterOrderId || pendingOrderId);
      setPendingOrderId(null);
      setPendingMasterOrderId(null);
      setSuccessModalVisible(true);
      setShowPaymentProcessor(false);
    } catch (error: any) {
      console.error('[Checkout] Payment verification handling error:', error);
      setError(error.message || 'Verification pending — do not pay again. Please retry in a moment.');
      setShowPaymentProcessor(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = async (failureMsg: string) => {
    if (failureMsg.startsWith('CANCELLED: ')) {
      const userFriendlyError = failureMsg.replace('CANCELLED: ', '');
      setError(userFriendlyError);
      setShowPaymentProcessor(false);
      return;
    }

    // Order already exists as pending. Do NOT delete it — verification is idempotent
    // and cleanup will reclaim it after the grace window if truly abandoned.
    setError(failureMsg);
    setShowPaymentProcessor(false);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primaryLight, COLORS.background, COLORS.background]}
        locations={[0, 0.2, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Custom Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (showPaymentProcessor) {
              setShowCancelDialog(true);
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      {loading && !showPaymentProcessor ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Processing your order...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Order Summary */}
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="receipt" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>

          <Surface style={styles.card} elevation={1}>
            {items.map((item, index) => (
              <View key={index}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item?.name || 'Product'}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity} x {'\u20B9'}{item.price}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{'\u20B9'}{(Number(item.price) * item.quantity).toFixed(2)}</Text>
                </View>
                {index < items.length - 1 && <Divider style={styles.itemDivider} />}
              </View>
            ))}

            <Divider style={styles.sectionDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{'\u20B9'}{subtotal.toFixed(2)}</Text>
            </View>
            {deliveryFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>{'\u20B9'}{deliveryFee.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>{'\u20B9'}{total.toFixed(2)}</Text>
            </View>
          </Surface>

          {/* Payment Method */}
          {defaultMethod && (
            <>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="credit-card-check-outline" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Payment Method</Text>
              </View>

              <Surface style={styles.card} elevation={1}>
                <View style={styles.paymentMethodContainer}>
                  <View style={styles.paymentIconContainer}>
                    <MaterialCommunityIcons
                      name={defaultMethod.type === 'cod' ? 'cash-multiple' : 'credit-card'}
                      size={24}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.paymentMethodDetails}>
                    <Text style={styles.paymentMethodTitle}>{defaultMethod.title || 'Payment Method'}</Text>
                    <Text style={styles.paymentMethodSubtitle}>
                      {defaultMethod.type === 'cod' ? 'Pay safely upon delivery' : 'Secure online transaction'}
                    </Text>
                  </View>
                  <Button
                    mode="text"
                    textColor={COLORS.primary}
                    onPress={() => router.push('/(main)/payment/methods')}
                    labelStyle={styles.changeButtonLabel}
                  >
                    Change
                  </Button>
                </View>
              </Surface>
            </>
          )}

          {error && (
            <Surface style={styles.errorCard} elevation={0}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Surface>
          )}

          {/* Spacer for bottom button */}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Fixed Bottom Action Bar */}
      {!loading && !showPaymentProcessor && (
        <Surface style={styles.bottomBar} elevation={4}>
          <View style={styles.bottomBarContent}>
            <View>
              <Text style={styles.bottomTotalLabel}>Total Amount</Text>
              <Text style={styles.bottomTotalValue}>{'\u20B9'}{total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              onPress={handlePayment}
              disabled={loading}
              activeOpacity={0.8}
              style={{ overflow: 'hidden', borderRadius: 28 }}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payButton}
              >
                <Text style={styles.payButtonText}>
                  {defaultMethod?.type === 'cod' ? 'Place Order' : 'Pay Now'}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Surface>
      )}

      {/* Payment Processor Overlay */}
      {showPaymentProcessor && (
        <View style={styles.processorContainer}>
          <Surface style={styles.processorCard} elevation={4}>
            <Text style={styles.processorTitle}>Completing Payment</Text>
            <Text style={styles.processorSubtitle}>Please complete the payment process</Text>
            <Divider style={{ marginVertical: 16 }} />
            <PaymentProcessor
              amount={total}
              orderId={pendingMasterOrderId || pendingOrderId || `TMP-${Date.now()}`}
              paymentMethod={defaultMethod!.type}
              paymentDetails={defaultMethod!.details}
              onSuccess={handlePaymentSuccess}
              onFailure={handlePaymentFailure}
              forceUpi={preferredMethod === 'upi'} // Force UPI when preferred method is UPI
            />
          </Surface>
        </View>
      )}

      <Portal>
        <Modal
          visible={successModalVisible}
          onDismiss={() => {
            setSuccessModalVisible(false);
            router.replace('/(main)/orders');
          }}
          contentContainerStyle={styles.modalContent}
        >
          <View style={styles.successIconWrapper}>
            <MaterialCommunityIcons name="check-bold" size={40} color={COLORS.success} />
          </View>
          <Text variant="headlineSmall" style={styles.modalTitle}>Order Confirmed!</Text>
          <Text style={styles.modalText}>
            Thank you for your purchase. Your order has been placed successfully.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSuccessModalVisible(false);
              router.replace('/(main)/orders');
            }}
            style={styles.modalButton}
            contentStyle={{ height: 48 }}
            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
            buttonColor={COLORS.primary}
          >
            Track Order
          </Button>
        </Modal>
      </Portal>

      <ConfirmationDialog
        visible={showCancelDialog}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment? Your order will remain pending and can be retried."
        confirmText="Yes, Cancel"
        onConfirm={() => {
          setShowCancelDialog(false);
          setShowPaymentProcessor(false);
          setError('Payment cancelled. Your order is pending — you can retry when ready.');
        }}
        onCancel={() => setShowCancelDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 12,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.text,
    fontSize: 16,
    fontFamily: 'System',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  itemDivider: {
    marginVertical: 12,
    backgroundColor: COLORS.border,
  },
  sectionDivider: {
    marginVertical: 12,
    backgroundColor: COLORS.border,
    height: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  paymentMethodSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  changeButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: COLORS.error,
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    paddingBottom: 24, // Add safety padding
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    zIndex: 10,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  bottomTotalLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  bottomTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    minWidth: 160,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  processorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  processorCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 400,
  },
  processorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  processorSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 22,
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    borderRadius: 25,
  },
});