import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, Image, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Portal, Modal, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { usePaymentStore } from '../../../store/payment';
import { usePaymentConfigStore } from '../../../store/paymentConfig';
import { PaymentMethod } from '../../../types/payment';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../../store/cart';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface UpiApp {
  name: string;
  id: string;
  icon: string;
  packageName: string; // Android package name
  uriScheme: string;   // iOS URI scheme
}

export default function PaymentMethods() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string }>();
  const amount = params.amount ? parseFloat(params.amount) : 0;
  const { paymentMethods, loading, fetchPaymentMethods, removePaymentMethod, setDefaultMethod } = usePaymentStore();
  const { upiConfig, fetchUpiConfig, loading: configLoading } = usePaymentConfigStore();
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod | null>(null);
  const [codEnabled, setCodEnabled] = React.useState(true); // COD is always available
  const user = useAuthStore(state => state.user);

  // Translation setup
  const { currentLanguage } = useLanguage();

  const originalTexts = {
    paymentMethods: 'Payment Methods',
    cashOnDelivery: 'Cash on Delivery',
    payWhenReceive: 'Pay when you receive your order',
    payWithUpiApps: 'Pay with UPI Apps',
    savedCardsUpi: 'Saved Cards & UPI',
    defaultPaymentMethod: 'Default payment method',
    deletePaymentMethod: 'Delete Payment Method',
    deleteConfirmation: 'Are you sure you want to delete this payment method?',
    cancel: 'Cancel',
    delete: 'Delete',
    paymentError: 'Payment Error',
    amountNotSpecified: 'Amount is not specified for the transaction',
    configurationError: 'Configuration Error',
    upiConfigNotAvailable: 'UPI payment configuration is not available. Please try again later.',
    googlePayError: 'Google Pay Error',
    unableToOpenGooglePay: 'Unable to open Google Pay. The app may not be installed correctly.',
    installGooglePay: 'Install Google Pay',
    googlePayNotInstalled: 'Google Pay Not Installed',
    googlePayRequired: 'Google Pay is required to complete this payment. Would you like to install it?',
    installFromAppStore: 'Install from App Store',
    couldNotOpenGooglePay: 'Could not open Google Pay. Would you like to install the app or try another payment method?',
    tryAnotherMethod: 'Try Another Method',
    appNotFound: 'App Not Found',
    appNotInstalled: 'is not installed or could not be opened. Please install it first.',
    ok: 'OK',
    installApp: 'Install App',
    appNotInstalledDevice: 'is not installed on your device. Would you like to download it?',
    install: 'Install',
    couldNotOpenApp: 'Could not open [app.name]. Please make sure the app is installed correctly.',
    error: 'Error',
    failedToOpenPaymentApp: 'Failed to open payment app. Please try again.'
  };

  const [translations, setTranslations] = React.useState(originalTexts);

  const t = (key: keyof typeof originalTexts) => {
    return translations[key] || originalTexts[key];
  };

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage !== 'en') {
        try {
          const translatedTexts = await Promise.all([
            translationService.translateText(originalTexts.paymentMethods, currentLanguage),
            translationService.translateText(originalTexts.cashOnDelivery, currentLanguage),
            translationService.translateText(originalTexts.payWhenReceive, currentLanguage),
            translationService.translateText(originalTexts.payWithUpiApps, currentLanguage),
            translationService.translateText(originalTexts.savedCardsUpi, currentLanguage),
            translationService.translateText(originalTexts.defaultPaymentMethod, currentLanguage),
            translationService.translateText(originalTexts.deletePaymentMethod, currentLanguage),
            translationService.translateText(originalTexts.deleteConfirmation, currentLanguage),
            translationService.translateText(originalTexts.cancel, currentLanguage),
            translationService.translateText(originalTexts.delete, currentLanguage),
            translationService.translateText(originalTexts.paymentError, currentLanguage),
            translationService.translateText(originalTexts.amountNotSpecified, currentLanguage),
            translationService.translateText(originalTexts.configurationError, currentLanguage),
            translationService.translateText(originalTexts.upiConfigNotAvailable, currentLanguage),
            translationService.translateText(originalTexts.googlePayError, currentLanguage),
            translationService.translateText(originalTexts.unableToOpenGooglePay, currentLanguage),
            translationService.translateText(originalTexts.installGooglePay, currentLanguage),
            translationService.translateText(originalTexts.googlePayNotInstalled, currentLanguage),
            translationService.translateText(originalTexts.googlePayRequired, currentLanguage),
            translationService.translateText(originalTexts.installFromAppStore, currentLanguage),
            translationService.translateText(originalTexts.couldNotOpenGooglePay, currentLanguage),
            translationService.translateText(originalTexts.tryAnotherMethod, currentLanguage),
            translationService.translateText(originalTexts.appNotFound, currentLanguage),
            translationService.translateText(originalTexts.appNotInstalled, currentLanguage),
            translationService.translateText(originalTexts.ok, currentLanguage),
            translationService.translateText(originalTexts.installApp, currentLanguage),
            translationService.translateText(originalTexts.appNotInstalledDevice, currentLanguage),
            translationService.translateText(originalTexts.install, currentLanguage),
            translationService.translateText(originalTexts.couldNotOpenApp, currentLanguage),
            translationService.translateText(originalTexts.error, currentLanguage),
            translationService.translateText(originalTexts.failedToOpenPaymentApp, currentLanguage)
          ]);

          setTranslations({
            paymentMethods: translatedTexts[0].translatedText || originalTexts.paymentMethods,
            cashOnDelivery: translatedTexts[1].translatedText || originalTexts.cashOnDelivery,
            payWhenReceive: translatedTexts[2].translatedText || originalTexts.payWhenReceive,
            payWithUpiApps: translatedTexts[3].translatedText || originalTexts.payWithUpiApps,
            savedCardsUpi: translatedTexts[4].translatedText || originalTexts.savedCardsUpi,
            defaultPaymentMethod: translatedTexts[5].translatedText || originalTexts.defaultPaymentMethod,
            deletePaymentMethod: translatedTexts[6].translatedText || originalTexts.deletePaymentMethod,
            deleteConfirmation: translatedTexts[7].translatedText || originalTexts.deleteConfirmation,
            cancel: translatedTexts[8].translatedText || originalTexts.cancel,
            delete: translatedTexts[9].translatedText || originalTexts.delete,
            paymentError: translatedTexts[10].translatedText || originalTexts.paymentError,
            amountNotSpecified: translatedTexts[11].translatedText || originalTexts.amountNotSpecified,
            configurationError: translatedTexts[12].translatedText || originalTexts.configurationError,
            upiConfigNotAvailable: translatedTexts[13].translatedText || originalTexts.upiConfigNotAvailable,
            googlePayError: translatedTexts[14].translatedText || originalTexts.googlePayError,
            unableToOpenGooglePay: translatedTexts[15].translatedText || originalTexts.unableToOpenGooglePay,
            installGooglePay: translatedTexts[16].translatedText || originalTexts.installGooglePay,
            googlePayNotInstalled: translatedTexts[17].translatedText || originalTexts.googlePayNotInstalled,
            googlePayRequired: translatedTexts[18].translatedText || originalTexts.googlePayRequired,
            installFromAppStore: translatedTexts[19].translatedText || originalTexts.installFromAppStore,
            couldNotOpenGooglePay: translatedTexts[20].translatedText || originalTexts.couldNotOpenGooglePay,
            tryAnotherMethod: translatedTexts[21].translatedText || originalTexts.tryAnotherMethod,
            appNotFound: translatedTexts[22].translatedText || originalTexts.appNotFound,
            appNotInstalled: translatedTexts[23].translatedText || originalTexts.appNotInstalled,
            ok: translatedTexts[24].translatedText || originalTexts.ok,
            installApp: translatedTexts[25].translatedText || originalTexts.installApp,
            appNotInstalledDevice: translatedTexts[26].translatedText || originalTexts.appNotInstalledDevice,
            install: translatedTexts[27].translatedText || originalTexts.install,
            couldNotOpenApp: translatedTexts[28].translatedText || originalTexts.couldNotOpenApp,
            error: translatedTexts[29].translatedText || originalTexts.error,
            failedToOpenPaymentApp: translatedTexts[30].translatedText || originalTexts.failedToOpenPaymentApp
          });
        } catch (error) {
          console.error('Translation error:', error);
        }
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // List of UPI apps to support
  const upiApps: UpiApp[] = [
    {
      name: 'Google Pay',
      id: 'gpay',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Pay_Logo_%282020%29.svg/512px-Google_Pay_Logo_%282020%29.svg.png',
      packageName: 'com.google.android.apps.nbu.paisa.user',
      uriScheme: 'googlepay://'
    },
    {
      name: 'PhonePe',
      id: 'phonepe',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Phonepe_logo.svg/2048px-Phonepe_logo.svg.png',
      packageName: 'com.phonepe.app',
      uriScheme: 'phonepe://'
    },
    {
      name: 'Paytm',
      id: 'paytm',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/2560px-Paytm_Logo_%28standalone%29.svg.png',
      packageName: 'net.one97.paytm',
      uriScheme: 'paytmmp://'
    },
    {
      name: 'BHIM UPI',
      id: 'bhim',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/BHIM_logo.svg/1200px-BHIM_logo.svg.png',
      packageName: 'in.org.npci.upiapp',
      uriScheme: 'bhim://'
    }
  ];

  useEffect(() => {
    fetchPaymentMethods();
    fetchUpiConfig();
  }, []);

  const handleMethodSelect = async (method: PaymentMethod | 'cod') => {
    try {
      if (method === 'cod') {
        // Create a COD payment method object
        const codMethod: PaymentMethod = {
          id: 'cod',
          type: 'cod',
          title: 'Cash on Delivery',
          is_default: true,
          details: {}, // Empty details for COD
          user_id: 'system',
          created_at: new Date().toISOString()
        };

        await setDefaultMethod(codMethod);
      } else {
        await setDefaultMethod(method.id);
      }

      // Simply navigate back after selecting
      router.back();
    } catch (error) {
      console.error('Error selecting payment method:', error);
    }
  };

  const handleRazorpaySelect = async () => {
    try {
      // Create a Razorpay payment method object
      const razorpayMethod: PaymentMethod = {
        id: 'razorpay',
        type: 'razorpay',
        title: 'Razorpay - Secure Payment Gateway',
        is_default: true,
        details: {
          gateway: 'razorpay'
        },
        user_id: user?.id || 'system',
        created_at: new Date().toISOString()
      };

      await setDefaultMethod(razorpayMethod);
      router.back();
    } catch (error) {
      console.error('Error selecting Razorpay:', error);
      Alert.alert('Error', 'Failed to select Razorpay payment method');
    }
  };

  const handleDelete = async () => {
    if (selectedMethod) {
      await removePaymentMethod(selectedMethod.id);
      setDeleteModalVisible(false);
      setSelectedMethod(null);
    }
  };

  const handleUpiAppSelect = async (app: UpiApp) => {
    try {
      if (!amount || amount <= 0) {
        Alert.alert(t('paymentError'), t('amountNotSpecified'));
        return;
      }

      // Set Razorpay as payment method
      const razorpayMethod: PaymentMethod = {
        id: 'razorpay',
        type: 'razorpay',
        title: `Razorpay - ${app.name}`,
        is_default: true,
        details: {
          gateway: 'razorpay',
          preferred_upi_app: app.id, // Store preferred app for reference
        },
        user_id: user?.id || 'system',
        created_at: new Date().toISOString()
      };

      await setDefaultMethod(razorpayMethod);

      // Get cart items to calculate amounts
      const { items } = useCartStore.getState();
      const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      // For now, use amount as total (delivery fee should be calculated in checkout)
      // If amount was passed from cart, it should include delivery fee
      const total = amount;
      const deliveryFee = Math.max(0, total - subtotal);

      // Navigate directly to checkout with autoPay flag to open Razorpay immediately with UPI pre-selected
      router.push({
        pathname: '/(main)/checkout',
        params: {
          subtotal: subtotal.toString(),
          deliveryFee: deliveryFee.toString(),
          total: total.toString(),
          autoPay: 'true', // Flag to auto-open Razorpay
          preferredMethod: 'upi', // Pre-select UPI method
        }
      });
    } catch (error) {
      console.error('Error selecting UPI app through Razorpay:', error);
      Alert.alert('Error', 'Failed to select payment method');
    }
  };

  // Legacy function - kept for reference but now routes through Razorpay
  const handleUpiAppSelectLegacy = async (app: UpiApp) => {
    try {
      if (!amount) {
        Alert.alert(t('paymentError'), t('amountNotSpecified'));
        return;
      }

      const merchantId = "merchant" + Math.floor(Math.random() * 10000);
      const transactionId = "txn" + Date.now();

      // Get UPI configuration from Supabase
      if (!upiConfig) {
        Alert.alert(t('configurationError'), t('upiConfigNotAvailable'));
        return;
      }

      const merchantName = upiConfig.merchant_name;
      const upiId = upiConfig.upi_id;

      // Google Pay specific implementation
      if (app.id === 'gpay') {
        const currencyCode = "INR";

        if (Platform.OS === 'android') {
          // For Android, follow the official Google Pay API structure

          // 1. First try the most reliable method - tez:// URI scheme
          try {
            // According to Google Pay docs, the preferred format for tez:// scheme
            const googlePayUrl = `tez://upi/pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=${currencyCode}&tn=${transactionId}&tr=${transactionId}`;
            console.log('Trying Google Pay with primary URI scheme:', googlePayUrl);
            await Linking.openURL(googlePayUrl);
            return;
          } catch (err) {
            console.log('Failed primary Google Pay method, trying alternative...', err);

            // 2. Try the intent URL approach with package name (alternative method)
            try {
              const intentUrl = `intent://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=${currencyCode}&tr=${transactionId}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
              await Linking.openURL(intentUrl);
              return;
            } catch (err2) {
              console.log('Failed intent URL method, trying generic UPI...', err2);

              // 3. Try generic UPI intent as last resort
              try {
                // Standard UPI deep link format that other UPI apps can handle
                const fallbackUrl = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=${currencyCode}&tr=${transactionId}`;
                await Linking.openURL(fallbackUrl);
                return;
              } catch (err3) {
                console.log('All Google Pay methods failed:', err3);

                // Show detailed error with install option
                Alert.alert(
                  t('googlePayError'),
                  t('unableToOpenGooglePay'),
                  [
                    {
                      text: t('cancel'),
                      style: 'cancel'
                    },
                    {
                      text: t('installGooglePay'),
                      onPress: () => {
                        Linking.openURL('market://details?id=com.google.android.apps.nbu.paisa.user').catch(() => {
                          Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user');
                        });
                      }
                    }
                  ]
                );
              }
            }
          }
        } else {
          // iOS handling - Google Pay on iOS follows different patterns

          // First check if Google Pay is installed at all
          try {
            const isGpayInstalled = await Linking.canOpenURL('gpay://');

            if (isGpayInstalled) {
              // 1. Try the official iOS Google Pay scheme for UPI
              // According to docs, gpay:// is the main scheme for iOS
              const iosGpayUrl = `gpay://upi/pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=${currencyCode}&tr=${transactionId}`;
              console.log('Opening Google Pay on iOS with:', iosGpayUrl);
              await Linking.openURL(iosGpayUrl);
              return;
            } else {
              // App is not installed, offer to install
              Alert.alert(
                t('googlePayNotInstalled'),
                t('googlePayRequired'),
                [
                  {
                    text: t('cancel'),
                    style: 'cancel'
                  },
                  {
                    text: t('installFromAppStore'),
                    onPress: () => Linking.openURL('https://apps.apple.com/in/app/google-pay-save-pay-manage/id1193357041')
                  }
                ]
              );
              return;
            }
          } catch (err) {
            console.log('Failed to check or open Google Pay on iOS:', err);

            // Try alternative Google Pay URI schemes as fallback
            try {
              // Try alternative scheme
              const altScheme = `googlepay://upi/pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=${currencyCode}&tr=${transactionId}`;
              await Linking.openURL(altScheme);
              return;
            } catch (err2) {
              console.log('All iOS Google Pay methods failed:', err2);

              // Offer to install or try another payment method
              Alert.alert(
                t('paymentError'),
                t('couldNotOpenGooglePay'),
                [
                  {
                    text: t('tryAnotherMethod'),
                    style: 'cancel'
                  },
                  {
                    text: t('installGooglePay'),
                    onPress: () => Linking.openURL('https://apps.apple.com/in/app/google-pay-save-pay-manage/id1193357041')
                  }
                ]
              );
            }
          }
        }
        return;
      }

      // Handle other UPI apps (PhonePe, Paytm, BHIM)
      if (Platform.OS === 'android') {
        // Try opening the specific app with explicit package
        try {
          const upiParams = `pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
          await Linking.openURL(`${app.packageName}://upi/pay?${upiParams}`);
        } catch (err) {
          console.error(`Failed to open ${app.name} with package scheme:`, err);

          // If app-specific intent fails, try generic UPI intent
          try {
            const genericUrl = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
            await Linking.openURL(genericUrl);
          } catch (err2) {
            console.error('Failed to open generic UPI intent:', err2);
            Alert.alert(
              t('appNotFound'),
              `${app.name} ${t('appNotInstalled')}`,
              [
                {
                  text: t('ok'),
                  style: 'cancel'
                },
                {
                  text: t('installApp'),
                  onPress: () => {
                    Linking.openURL(`market://details?id=${app.packageName}`).catch(() => {
                      // If Google Play can't be opened, open in browser
                      Linking.openURL(`https://play.google.com/store/apps/details?id=${app.packageName}`);
                    });
                  }
                }
              ]
            );
          }
        }
      } else {
        // For iOS, use appropriate payment app URL schemes
        let iosUpiUrl = '';
        let appStoreUrl = '';

        // Construct platform-specific payment URLs with the UPI ID
        switch (app.id) {
          case 'phonepe':
            iosUpiUrl = `phonepe://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
            appStoreUrl = 'https://apps.apple.com/in/app/phonepe-secure-payments-app/id1170055821';
            break;
          case 'paytm':
            iosUpiUrl = `paytmmp://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
            appStoreUrl = 'https://apps.apple.com/in/app/paytm-secure-upi-payments/id473941634';
            break;
          case 'bhim':
            iosUpiUrl = `bhim://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
            appStoreUrl = 'https://apps.apple.com/in/app/bhim-making-india-cashless/id1200315258';
            break;
          default:
            // Fallback to standard UPI URL
            iosUpiUrl = `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tr=${transactionId}`;
            break;
        }

        // Check if app is installed
        try {
          const canOpen = await Linking.canOpenURL(app.uriScheme);

          if (canOpen) {
            // The app is installed, try opening it with the payment URL
            await Linking.openURL(iosUpiUrl);
          } else {
            // App is not installed, show dialog to download it
            Alert.alert(
              t('appNotFound'),
              `${app.name} ${t('appNotInstalledDevice')}`,
              [
                {
                  text: t('cancel'),
                  style: 'cancel'
                },
                {
                  text: t('install'),
                  onPress: () => Linking.openURL(appStoreUrl)
                }
              ]
            );
          }
        } catch (err) {
          console.error(`Failed to open ${app.name}:`, err);
          Alert.alert(
            t('paymentError'),
            t('couldNotOpenApp').replace('[app.name]', app.name)
          );
        }
      }
    } catch (error) {
      console.error('Error opening UPI app:', error);
      Alert.alert(t('error'), t('failedToOpenPaymentApp'));
    }
  };

  const renderPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'upi':
        return 'qrcode';
      case 'card':
        return 'credit-card';
      case 'netbanking':
        return 'bank';
      case 'cod':
        return 'cash';
      case 'razorpay':
        return 'shield-checkmark';
      default:
        return 'help-circle';
    }
  };

  const renderPaymentMethodTitle = (method: PaymentMethod) => {
    switch (method.type) {
      case 'upi':
        return `UPI: ${method.details.upi_id}`;
      case 'card':
        return `**** **** **** ${method.details.card_last4}`;
      case 'netbanking':
        return `${method.details.bank_name} Net Banking`;
      case 'cod':
        return t('cashOnDelivery');
      case 'razorpay':
        return 'Razorpay - Secure Payment Gateway';
      default:
        return method.title;
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <SystemStatusBar style="dark" backgroundColor="#F8F9FA" />

      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('paymentMethods')}</Text>
          <TouchableOpacity onPress={() => router.push('/(main)/payment/add')} style={styles.headerButton}>
            <Ionicons name="add" size={24} color="#FF7D00" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Cash on Delivery Option */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('cashOnDelivery')}</Text>
            <TouchableOpacity
              style={[styles.methodCard, codEnabled && styles.selectedCard]}
              onPress={() => handleMethodSelect('cod')}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="cash-outline" size={24} color="#FF7D00" />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>{t('cashOnDelivery')}</Text>
                <Text style={styles.methodDescription}>{t('payWhenReceive')}</Text>
              </View>
              <View style={styles.radioButton}>
                {codEnabled && <View style={styles.radioButtonSelected} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Razorpay Payment Gateway */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Secure Payment Gateway</Text>
            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => handleRazorpaySelect()}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#3395FF" />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>Razorpay</Text>
                <Text style={styles.methodDescription}>Pay securely with UPI, Cards, Net Banking & more</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* UPI Apps Section - Routes through Razorpay */}
          {amount > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>{t('payWithUpiApps')}</Text>
              <Text style={styles.sectionSubtitle}>
                Select your preferred UPI app. Payment will be processed securely through Razorpay.
              </Text>
              <View style={styles.upiGrid}>
                {upiApps.map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.upiCard}
                    onPress={() => handleUpiAppSelect(app)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.upiIconWrapper}>
                      <Image
                        source={{ uri: app.icon }}
                        style={styles.upiAppIcon}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.upiAppName}>{app.name}</Text>
                    <Text style={styles.upiAppSubtext}>Via Razorpay</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('savedCardsUpi')}</Text>
            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[styles.methodCard, method.is_default && styles.selectedCard]}
                  onPress={() => handleMethodSelect(method)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={
                        method.type === 'upi' ? 'qr-code-outline' :
                          method.type === 'card' ? 'card-outline' : 'business-outline'
                      }
                      size={24}
                      color={method.is_default ? '#FF7D00' : '#666'}
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={[styles.methodTitle, method.is_default && styles.selectedText]}>
                      {renderPaymentMethodTitle(method)}
                    </Text>
                    {method.is_default && (
                      <Text style={styles.defaultBadge}>{t('defaultPaymentMethod')}</Text>
                    )}
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedMethod(method);
                        setDeleteModalVisible(true);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF5252" />
                    </TouchableOpacity>
                    <View style={styles.radioButton}>
                      {method.is_default && <View style={styles.radioButtonSelected} />}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={48} color="#DDD" />
                <Text style={styles.emptyText}>No saved payment methods</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Portal>
        <Modal
          visible={deleteModalVisible}
          onDismiss={() => setDeleteModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning-outline" size={32} color="#FF5252" />
            </View>
            <Text style={styles.modalTitle}>{t('deletePaymentMethod')}</Text>
          </View>

          <Text style={styles.modalText}>
            {t('deleteConfirmation')}
          </Text>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setDeleteModalVisible(false)}
              style={styles.modalCancelButton}
              labelStyle={styles.modalCancelLabel}
            >
              {t('cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleDelete}
              style={styles.modalDeleteButton}
              labelStyle={styles.modalDeleteLabel}
            >
              {t('delete')}
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    marginLeft: 4,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#FF7D00',
    backgroundColor: '#FFF8F0',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  selectedText: {
    color: '#FF7D00',
  },
  methodDescription: {
    fontSize: 13,
    color: '#888',
  },
  defaultBadge: {
    fontSize: 12,
    color: '#FF7D00',
    fontWeight: '500',
    marginTop: 2,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF7D00',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginRight: 4,
  },

  // UPI Apps Grid
  upiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  upiCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  upiIconWrapper: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  upiAppIcon: {
    width: 40,
    height: 40,
  },
  upiAppName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  upiAppSubtext: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderStyle: 'dashed',
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 14,
  },

  // Modal Styles
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    margin: 24,
    borderRadius: 24,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#DDD',
    borderRadius: 12,
  },
  modalCancelLabel: {
    color: '#666',
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#FF5252',
    borderRadius: 12,
  },
  modalDeleteLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
