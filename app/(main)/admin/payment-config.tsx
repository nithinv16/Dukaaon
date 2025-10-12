import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaymentConfigStore, UpiConfig, BankConfig } from '../../../store/paymentConfig';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function PaymentConfigAdmin() {
  const router = useRouter();
  const { 
    upiConfig, 
    bankConfig, 
    loading, 
    error, 
    fetchUpiConfig, 
    fetchBankConfig, 
    updateUpiConfig, 
    updateBankConfig 
  } = usePaymentConfigStore();

  // Translation setup
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({
    validationError: 'Validation Error',
    upiIdAndMerchantRequired: 'UPI ID and Merchant Name are required.',
    success: 'Success',
    upiConfigUpdated: 'UPI configuration updated successfully!',
    error: 'Error',
    failedToUpdateUpi: 'Failed to update UPI configuration. Please try again.',
    allBankDetailsRequired: 'All bank details are required.',
    bankConfigUpdated: 'Bank configuration updated successfully!',
    failedToUpdateBank: 'Failed to update bank configuration. Please try again.'
  });

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage !== 'en') {
        const translatedTexts = await Promise.all([
          translationService.translateText('Validation Error', currentLanguage),
          translationService.translateText('UPI ID and Merchant Name are required.', currentLanguage),
          translationService.translateText('Success', currentLanguage),
          translationService.translateText('UPI configuration updated successfully!', currentLanguage),
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Failed to update UPI configuration. Please try again.', currentLanguage),
          translationService.translateText('All bank details are required.', currentLanguage),
          translationService.translateText('Bank configuration updated successfully!', currentLanguage),
          translationService.translateText('Failed to update bank configuration. Please try again.', currentLanguage)
        ]);

        setTranslations({
          validationError: translatedTexts[0],
          upiIdAndMerchantRequired: translatedTexts[1],
          success: translatedTexts[2],
          upiConfigUpdated: translatedTexts[3],
          error: translatedTexts[4],
          failedToUpdateUpi: translatedTexts[5],
          allBankDetailsRequired: translatedTexts[6],
          bankConfigUpdated: translatedTexts[7],
          failedToUpdateBank: translatedTexts[8]
        });
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // UPI form state
  const [upiForm, setUpiForm] = useState<UpiConfig>({
    upi_id: '',
    merchant_name: '',
    description: ''
  });

  // Bank form state
  const [bankForm, setBankForm] = useState<BankConfig>({
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    account_holder_name: '',
    description: ''
  });

  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchUpiConfig();
    fetchBankConfig();
  }, []);

  useEffect(() => {
    if (upiConfig) {
      setUpiForm({
        upi_id: upiConfig.upi_id || '',
        merchant_name: upiConfig.merchant_name || '',
        description: upiConfig.description || ''
      });
    }
  }, [upiConfig]);

  useEffect(() => {
    if (bankConfig) {
      setBankForm({
        account_number: bankConfig.account_number || '',
        ifsc_code: bankConfig.ifsc_code || '',
        bank_name: bankConfig.bank_name || '',
        account_holder_name: bankConfig.account_holder_name || '',
        description: bankConfig.description || ''
      });
    }
  }, [bankConfig]);

  const handleUpdateUpiConfig = async () => {
    if (!upiForm.upi_id.trim() || !upiForm.merchant_name.trim()) {
      Alert.alert(translations.validationError, translations.upiIdAndMerchantRequired);
      return;
    }

    try {
      setUpdating(true);
      await updateUpiConfig(upiForm);
      Alert.alert(translations.success, translations.upiConfigUpdated);
    } catch (error) {
      Alert.alert(translations.error, translations.failedToUpdateUpi);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateBankConfig = async () => {
    if (!bankForm.account_number.trim() || !bankForm.ifsc_code.trim() || 
        !bankForm.bank_name.trim() || !bankForm.account_holder_name.trim()) {
      Alert.alert(translations.validationError, translations.allBankDetailsRequired);
      return;
    }

    try {
      setUpdating(true);
      await updateBankConfig(bankForm);
      Alert.alert(translations.success, translations.bankConfigUpdated);
    } catch (error) {
      Alert.alert(translations.error, translations.failedToUpdateBank);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading payment configurations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineMedium" style={styles.title}>
          Payment Configuration
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Manage UPI and bank account details for receiving payments
        </Text>

        {error && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text style={styles.errorText}>{error || 'An error occurred'}</Text>
            </Card.Content>
          </Card>
        )}

        {/* UPI Configuration */}
        <Card style={styles.card}>
          <Card.Title title="UPI Configuration" />
          <Card.Content>
            <TextInput
              label="UPI ID *"
              value={upiForm.upi_id}
              onChangeText={(text) => setUpiForm(prev => ({ ...prev, upi_id: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="example@okaxis"
            />
            
            <TextInput
              label="Merchant Name *"
              value={upiForm.merchant_name}
              onChangeText={(text) => setUpiForm(prev => ({ ...prev, merchant_name: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="Your Business Name"
            />
            
            <TextInput
              label="Description"
              value={upiForm.description}
              onChangeText={(text) => setUpiForm(prev => ({ ...prev, description: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="Optional description"
              multiline
              numberOfLines={2}
            />
            
            <Button
              mode="contained"
              onPress={handleUpdateUpiConfig}
              loading={updating}
              disabled={updating || loading}
              style={styles.button}
            >
              Update UPI Configuration
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Bank Configuration */}
        <Card style={styles.card}>
          <Card.Title title="Bank Account Configuration" />
          <Card.Content>
            <TextInput
              label="Account Number *"
              value={bankForm.account_number}
              onChangeText={(text) => setBankForm(prev => ({ ...prev, account_number: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="1234567890"
              keyboardType="numeric"
            />
            
            <TextInput
              label="IFSC Code *"
              value={bankForm.ifsc_code}
              onChangeText={(text) => setBankForm(prev => ({ ...prev, ifsc_code: text.toUpperCase() }))}
              mode="outlined"
              style={styles.input}
              placeholder="SBIN0001234"
              autoCapitalize="characters"
            />
            
            <TextInput
              label="Bank Name *"
              value={bankForm.bank_name}
              onChangeText={(text) => setBankForm(prev => ({ ...prev, bank_name: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="State Bank of India"
            />
            
            <TextInput
              label="Account Holder Name *"
              value={bankForm.account_holder_name}
              onChangeText={(text) => setBankForm(prev => ({ ...prev, account_holder_name: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="John Doe"
            />
            
            <TextInput
              label="Description"
              value={bankForm.description}
              onChangeText={(text) => setBankForm(prev => ({ ...prev, description: text }))}
              mode="outlined"
              style={styles.input}
              placeholder="Optional description"
              multiline
              numberOfLines={2}
            />
            
            <Button
              mode="contained"
              onPress={handleUpdateBankConfig}
              loading={updating}
              disabled={updating || loading}
              style={styles.button}
            >
              Update Bank Configuration
            </Button>
          </Card.Content>
        </Card>

        {/* Current Configuration Display */}
        <Card style={styles.card}>
          <Card.Title title="Current Active Configuration" />
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>UPI Details:</Text>
            {upiConfig ? (
              <View style={styles.configDisplay}>
                <Text>UPI ID: {upiConfig.upi_id}</Text>
                <Text>Merchant: {upiConfig.merchant_name}</Text>
                {upiConfig.description && <Text>Description: {upiConfig.description}</Text>}
              </View>
            ) : (
              <Text style={styles.noConfig}>No UPI configuration found</Text>
            )}

            <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 16 }]}>Bank Details:</Text>
            {bankConfig ? (
              <View style={styles.configDisplay}>
                <Text>Account: {bankConfig.account_number}</Text>
                <Text>IFSC: {bankConfig.ifsc_code}</Text>
                <Text>Bank: {bankConfig.bank_name}</Text>
                <Text>Holder: {bankConfig.account_holder_name}</Text>
                {bankConfig.description && <Text>Description: {bankConfig.description}</Text>}
              </View>
            ) : (
              <Text style={styles.noConfig}>No bank configuration found</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  card: {
    marginBottom: 16,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#c62828',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  configDisplay: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
  },
  noConfig: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
});