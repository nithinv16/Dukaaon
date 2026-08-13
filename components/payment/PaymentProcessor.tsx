import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import { PaymentMethodType } from '../../types/payment';

import { useAuthStore } from '../../store/auth';
import { useRouter } from 'expo-router';
import { razorpayService } from '../../services/payment/razorpayService';

interface PaymentProcessorProps {
  amount: number;
  orderId: string;
  paymentMethod: PaymentMethodType;
  paymentDetails: {
    upi_id?: string;
    card_last4?: string;
    preferred_upi_app?: string; // Preferred UPI app ID
  };
  onSuccess: (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure: (error: string) => void;
  forceUpi?: boolean; // If true, pre-select UPI method to show UPI apps directly
}

export function PaymentProcessor({
  amount,
  orderId,
  paymentMethod,
  paymentDetails,
  onSuccess,
  onFailure,
  forceUpi = false,
}: PaymentProcessorProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const user = useAuthStore(state => state.user);
  const router = useRouter();

  // Auto-trigger payment when component mounts
  useEffect(() => {
    if (status === 'processing') {
      processPayment();
    }
  }, []);

  const processPayment = async () => {
    try {
      // For Razorpay, use the Razorpay service
      // For other payment methods (upi, card, netbanking), also route through Razorpay
      // since Razorpay supports all these payment methods
      const actualPaymentMethod = paymentMethod === 'razorpay' 
        ? 'upi' // Default to UPI for Razorpay, user can choose in Razorpay UI
        : paymentMethod;

      // Format phone number for Razorpay (requires +91 prefix)
      // User's phone_number is stored without prefix, so add +91 if missing
      let formattedContact = '';
      if (user?.phone_number) {
        const phone = user.phone_number.trim();
        // If phone doesn't start with +91, add it
        if (phone.startsWith('+91')) {
          formattedContact = phone;
        } else if (phone.startsWith('91') && phone.length === 12) {
          // If it starts with 91 but no +, add +
          formattedContact = '+' + phone;
        } else if (phone.length === 10) {
          // If it's a 10-digit number, add +91 prefix
          formattedContact = '+91' + phone;
        } else {
          // Use as-is if it's already formatted or doesn't match expected patterns
          formattedContact = phone.startsWith('+') ? phone : '+91' + phone;
        }
      }

      // CRITICAL: Razorpay requires contact (mobile number) for UPI payments
      // If contact is missing, Razorpay will prompt user to enter it manually
      if (!formattedContact) {
        console.warn('[PaymentProcessor] Warning: No phone number found for user. Razorpay will prompt for mobile number.');
      }

      const response = await razorpayService.initializePayment({
        amount,
        orderId,
        paymentMethod: actualPaymentMethod,
        userDetails: {
          // Get name from business_details.ownerName or business_details.shopName, or use empty string
          name: user?.business_details?.ownerName || 
                user?.business_details?.shopName || 
                '',
          email: user?.email || '',
          contact: formattedContact, // Use formatted phone number with +91 prefix
        },
        forceUpi: forceUpi || paymentDetails.preferred_upi_app !== undefined, // Force UPI if explicitly requested or preferred app is set
      });

      // Payment completed — hand the callback triple to onSuccess for server-side verification
      setStatus('success');
      setTimeout(() => {
        onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      }, 1500);
    } catch (error: any) {
      console.error('Payment processing error:', error);
      
      // Extract user-friendly error message
      let errorMsg = 'Payment processing failed';
      
      if (error?.message) {
        errorMsg = error.message;
      } else if (error?.error?.description) {
        errorMsg = error.error.description;
      } else if (error?.description) {
        // Try to parse JSON string if description is a JSON string
        try {
          const parsedDesc = JSON.parse(error.description);
          if (parsedDesc.error?.description) {
            errorMsg = parsedDesc.error.description;
          }
        } catch {
          errorMsg = error.description;
        }
      }
      
      // Handle payment cancellation gracefully (not a real error)
      // Cancellation should not update database - user can retry
      const isCancelled = errorMsg.toLowerCase().includes('cancelled') || 
                         errorMsg.toLowerCase().includes('cancel') ||
                         error?.code === 'PAYMENT_CANCELLED' ||
                         error?.error?.reason === 'payment_cancelled';
      
      if (isCancelled) {
        errorMsg = 'Payment was cancelled. You can try again when ready.';
        setErrorMessage(errorMsg);
        setStatus('failed');
        // For cancellation, pass a special flag so we don't update database
        onFailure('CANCELLED: ' + errorMsg);
        return;
      }
      
      setErrorMessage(errorMsg);
      setStatus('failed');
      onFailure(errorMsg);
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

      {status === 'success' && (
        <>
          <Text style={styles.successText}>Payment Completed</Text>
          <Text style={styles.successSubtext}>
            Verifying your payment...
          </Text>
          <ActivityIndicator size="small" style={{ marginTop: 16 }} />
        </>
      )}

      {status === 'failed' && (
        <>
          <Text style={styles.errorText}>Payment Failed</Text>
          <Text style={styles.errorSubtext}>
            {errorMessage || 'Please try again or choose a different payment method'}
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
              onPress={() => {
                setStatus('processing');
                setErrorMessage('');
                processPayment();
              }}
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
  successText: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtext: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
  },
}); 