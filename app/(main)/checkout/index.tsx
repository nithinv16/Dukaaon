import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Portal, Modal, Divider } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { useCartStore } from '../../../store/cart';
import { usePaymentStore } from '../../../store/payment';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { PaymentProcessor } from '../../../components/payment/PaymentProcessor';
import { IconButton } from 'react-native-paper';
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog';


export default function Checkout() {
  console.log('Rendering Checkout component');
  const router = useRouter();
  const { items, removeAll } = useCartStore();
  const { defaultMethod } = usePaymentStore();
  const user = useAuthStore(state => state.user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showPaymentProcessor, setShowPaymentProcessor] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const total = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  useEffect(() => {
    console.log('Default Method:', defaultMethod);
  }, [defaultMethod]);

  const handlePayment = async () => {
    if (!defaultMethod || !user) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Generate unique order ID
      const orderNumber = `ORD-${new Date().toISOString().slice(0,10)}-${Math.random().toString(36).substr(2, 9)}`;

      // 2. Create order with initial status
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          items: items,
          total_amount: total + 40,
          status: 'pending',
          payment_status: defaultMethod.type === 'cod' ? 'pending' : 'not_paid',
          payment_method: defaultMethod.type,
          seller_ids: [...new Set(items.map(item => item.seller_id))]
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Notify sellers
      const { error: notificationError } = await supabase
        .from('seller_notifications')
        .insert(order.seller_ids.map(sellerId => ({
          seller_id: sellerId,
          type: 'new_order',
          order_id: order.id,
          message: `New order received: ${orderNumber}`,
          status: 'unread'
        })));

      if (notificationError) throw notificationError;

      // 4. Handle payment based on method
      if (defaultMethod.type === 'cod') {
        // For COD, mark order as confirmed
        const { error: updateError } = await supabase
          .from('orders')
          .update({ 
            status: 'confirmed',
            payment_status: 'pending' 
          })
          .eq('id', order.id);

        if (updateError) throw updateError;

        setOrderId(order.id);
        setSuccessModalVisible(true);
        removeAll();
        return;
      }

      // For other payment methods
      const { error: paymentError } = await supabase
        .from('payment_transactions')
        .insert({
          order_id: order.id,
          amount: total + 40,
          status: 'pending',
          payment_method: defaultMethod.type,
        });

      if (paymentError) throw paymentError;

      setOrderId(order.id);
      setShowPaymentProcessor(true);
    } catch (error) {
      console.error('Order processing error:', error);
      setError('Failed to process order');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setSuccessModalVisible(true);
    removeAll();
  };

  const handlePaymentFailure = (error: string) => {
    setError(error);
    setShowPaymentProcessor(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  console.log('Current payment method:', defaultMethod?.type);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Checkout',
          headerShown: true,
          headerLeft: () => (
            <IconButton 
              icon="arrow-left"
              onPress={() => {
                if (showPaymentProcessor) {
                  setShowCancelDialog(true);
                } else {
                  router.back();
                }
              }}
            />
          ),
        }}
      />

      <ScrollView>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Order Summary</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text>{item?.name || 'Product'}</Text>
                <Text>₹{Number(item.price) * item.quantity}</Text>
              </View>
            ))}
            <Divider style={styles.divider} />
            <View style={styles.totalRow}>
              <Text variant="titleMedium">Total Amount</Text>
              <Text variant="titleMedium">₹{total + 40}</Text>
            </View>
          </Card.Content>
        </Card>

        {defaultMethod && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">Payment Method</Text>
              <View style={styles.paymentMethod}>
                <Text>{defaultMethod?.title || 'Payment Method'}</Text>
                <Button 
                  mode="text"
                  onPress={() => router.push('/(main)/payment/methods')}
                >
                  Change
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {error && (
          <Text style={styles.error}>{error || 'An error occurred'}</Text>
        )}

        {showPaymentProcessor ? (
          <PaymentProcessor
            amount={total + 40}
            orderId={orderId!}
            paymentMethod={defaultMethod!.type}
            paymentDetails={defaultMethod!.details}
            onSuccess={handlePaymentSuccess}
            onFailure={handlePaymentFailure}
          />
        ) : (
          <Button
            mode="contained"
            onPress={handlePayment}
            loading={loading}
            disabled={loading}
            style={styles.payButton}
          >
            {defaultMethod?.type === 'cod' ? 'Place Order' : 'Pay Now'}
          </Button>
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={successModalVisible}
          onDismiss={() => {
            setSuccessModalVisible(false);
            router.replace('/(main)/orders');
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text variant="headlineSmall" style={styles.modalTitle}>
            {defaultMethod?.type === 'cod' ? 'Order Placed Successfully!' : 'Payment Successful!'}
          </Text>
          <Text style={styles.modalText}>
            Your order has been placed successfully. You can track your order status in the orders section.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSuccessModalVisible(false);
              router.replace('/(main)/orders');
            }}
          >
            View Orders
          </Button>
        </Modal>
      </Portal>

      <ConfirmationDialog
        visible={showCancelDialog}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment?"
        confirmText="Yes, Cancel"
        onConfirm={() => {
          setShowCancelDialog(false);
          router.back();
        }}
        onCancel={() => setShowCancelDialog(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  divider: {
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  paymentMethod: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payButton: {
    margin: 16,
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginTop: 8,
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
});