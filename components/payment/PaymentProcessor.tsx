import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import { PaymentMethodType } from '../../types/payment';

import { useAuthStore } from '../../store/auth';
import { useRouter } from 'expo-router';

interface PaymentProcessorProps {
  amount: number;
  orderId: string;
  paymentMethod: PaymentMethodType;
  paymentDetails: {
    upi_id?: string;
    card_last4?: string;
  };
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

export function PaymentProcessor({
  amount,
  orderId,
  paymentMethod,
  paymentDetails,
  onSuccess,
  onFailure,
}: PaymentProcessorProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [retryCount, setRetryCount] = useState(0);
  const user = useAuthStore(state => state.user);
  const router = useRouter();

  const processPayment = async () => {
    try {
      const response = await razorpayService.initializePayment({
        amount,
        orderId,
        paymentMethod,
        userDetails: {
          name: user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
      });

      // Verify payment
      const isVerified = await razorpayService.verifyPayment(
        response.razorpay_payment_id,
        response.razorpay_order_id,
        response.razorpay_signature
      );

      if (isVerified) {
        setStatus('success');
        onSuccess();
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      setStatus('failed');
      onFailure('Payment processing failed');
    }
  };

  return (
    <View style={styles.container}>
      {status === 'processing' && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.text}>Initializing payment...</Text>
          <Text style={styles.subtext}>You'll be redirected to complete the payment</Text>
        </>
      )}

      {status === 'failed' && (
        <>
          <Text style={styles.errorText}>Payment Failed</Text>
          <Text style={styles.errorSubtext}>
            Please try again or choose a different payment method
          </Text>
          <View style={styles.buttonGroup}>
            <Button 
              mode="outlined"
              onPress={() => router.push('/(main)/payment/methods')}
              style={styles.button}
            >
              Change Method
            </Button>
            <Button 
              mode="contained"
              onPress={processPayment}
              style={styles.button}
            >
              Retry
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    minWidth: 140,
  },
}); 