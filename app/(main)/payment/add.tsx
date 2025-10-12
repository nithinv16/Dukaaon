import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, IconButton, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { usePaymentStore } from '../../../store/payment';
import { PaymentMethodType } from '../../../types/payment';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function AddPaymentMethodScreen() {
  const [paymentType, setPaymentType] = useState<PaymentMethodType>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const addPaymentMethod = usePaymentStore(state => state.addPaymentMethod);
  const storeLoading = usePaymentStore(state => state.loading);
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();

  // Original English text (never changes)
  const originalTexts = {
    success: 'Success',
    paymentMethodAddedSuccessfully: 'Payment method added successfully'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }
      
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Payment add translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleSave = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (!user) {
        throw new Error('You must be logged in to add a payment method');
      }
      
      // Generate a default title based on payment type
      const title = paymentType === 'upi' 
        ? `UPI - ${upiId}` 
        : `Card - ${cardNumber.slice(-4)}`;

      // Validate based on payment type
      if (paymentType === 'upi') {
        if (!upiId) {
          throw new Error('Please enter a valid UPI ID');
        }
        if (!upiId.includes('@')) {
          throw new Error('UPI ID must include @ symbol');
        }
      } else if (paymentType === 'card') {
        if (!cardNumber || cardNumber.length < 16) {
          throw new Error('Please enter a valid card number');
        }
        if (!expiry || !expiry.includes('/')) {
          throw new Error('Please enter a valid expiry date (MM/YY)');
        }
        if (!cvv || cvv.length < 3) {
          throw new Error('Please enter a valid CVV');
        }
        if (!nameOnCard) {
          throw new Error('Please enter the name on card');
        }
      }

      const details = paymentType === 'upi' 
        ? { upi_id: upiId }
        : { 
            card_number: cardNumber.replace(/\s+/g, ''),
            expiry,
            cvv,
            name_on_card: nameOnCard,
            card_last4: cardNumber.slice(-4),
            card_brand: getCardBrand(cardNumber)
          };

      await addPaymentMethod({
        type: paymentType,
        title,
        is_default: isDefault,
        details
      });

      setLoading(false);
      Alert.alert(translations.success, translations.paymentMethodAddedSuccessfully);
      router.back();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to add payment method');
      console.error('Error saving payment method:', err);
    }
  };

  // Function to determine card brand based on first digits
  const getCardBrand = (number: string) => {
    const cleanedNumber = number.replace(/\s+/g, '');
    
    if (/^4/.test(cleanedNumber)) return 'Visa';
    if (/^5[1-5]/.test(cleanedNumber)) return 'Mastercard';
    if (/^3[47]/.test(cleanedNumber)) return 'American Express';
    if (/^6(?:011|5)/.test(cleanedNumber)) return 'Discover';
    
    return 'Unknown';
  };

  const formatCardNumber = (text: string) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add space after every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    // Limit to 19 characters (16 digits + 3 spaces)
    return formatted.substring(0, 19);
  };

  const formatExpiry = (text: string) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    // Insert slash after first 2 digits
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <SystemStatusBar style="dark" backgroundColor="#fff" />
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left" 
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.headerTitle}>Add Payment Method</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollContent}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.form}
          >
            <SegmentedButtons
              value={paymentType}
              onValueChange={setPaymentType as (value: string) => void}
              buttons={[
                { value: 'upi', label: 'UPI' },
                { value: 'card', label: 'Card' }
              ]}
              style={styles.segmentButtons}
            />
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error || 'An error occurred'}</Text>
              </View>
            )}

            {paymentType === 'upi' ? (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>UPI ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username@bank"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Card Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                </View>
                
                <View style={styles.row}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Expiry (MM/YY)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/YY"
                      value={expiry}
                      onChangeText={(text) => setExpiry(formatExpiry(text))}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                  
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.label}>CVV</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="000"
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Name on Card</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="FULL NAME"
                    value={nameOnCard}
                    onChangeText={setNameOnCard}
                    autoCapitalize="characters"
                  />
                </View>
              </>
            )}
            
            {/* Default switch - can be implemented as a checkbox or switch */}
            <View style={styles.defaultContainer}>
              <Text style={styles.defaultText}>Make this my default payment method</Text>
              <Button
                mode={isDefault ? "contained" : "outlined"}
                onPress={() => setIsDefault(!isDefault)}
                style={styles.defaultButton}
              >
                {isDefault ? "Default" : "Set as Default"}
              </Button>
            </View>
            
            <Button 
              mode="contained" 
              onPress={handleSave}
              style={styles.saveButton}
              loading={loading || storeLoading}
              disabled={loading || storeLoading}
            >
              Save Payment Method
            </Button>
          </KeyboardAvoidingView>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  segmentButtons: {
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#ffeded',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  defaultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  defaultText: {
    fontSize: 16,
    flex: 1,
  },
  defaultButton: {
    borderRadius: 20,
  },
  saveButton: {
    marginTop: 20,
    paddingVertical: 5,
    borderRadius: 5,
  },
});