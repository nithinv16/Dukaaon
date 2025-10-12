import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationService } from '../../services/notifications/NotificationService';
import { useNotification } from '../../providers/NotificationProvider';
import { NotificationPermissionDebug } from '../../components/debug/NotificationPermissionDebug';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

export default function TestNotifications() {
  const { showNotification } = useNotification();
  const { currentLanguage } = useLanguage();
  const [orderId, setOrderId] = useState('ORD-12345');
  const [customerName, setCustomerName] = useState('John Doe');
  const [otp, setOtp] = useState('1234');

  // Translation state
  const [translations, setTranslations] = useState({
    error: 'Error',
    failedToSendOrderNotification: 'Failed to send order notification',
    failedToSendDeliveryNotification: 'Failed to send delivery notification',
    failedToSendOTPNotification: 'Failed to send OTP notification',
    fcmToken: 'FCM Token',
    failedToGetFCMToken: 'Failed to get FCM token'
  });

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        return;
      }

      try {
        const results = await Promise.all([
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Failed to send order notification', currentLanguage),
          translationService.translateText('Failed to send delivery notification', currentLanguage),
          translationService.translateText('Failed to send OTP notification', currentLanguage),
          translationService.translateText('FCM Token', currentLanguage),
          translationService.translateText('Failed to get FCM token', currentLanguage),
        ]);

        setTranslations({
          error: results[0].translatedText,
          failedToSendOrderNotification: results[1].translatedText,
          failedToSendDeliveryNotification: results[2].translatedText,
          failedToSendOTPNotification: results[3].translatedText,
          fcmToken: results[4].translatedText,
          failedToGetFCMToken: results[5].translatedText,
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const testOrderNotification = async () => {
    try {
      await NotificationService.sendOrderNotification({
        orderId,
        status: 'confirmed',
        customerName,
        items: ['Product 1', 'Product 2'],
        totalAmount: 1500,
      });
      
      showNotification({
        title: 'Test Notification',
        message: 'Order notification sent successfully!',
        type: 'success',
      });
    } catch (error) {
      Alert.alert(translations.error, translations.failedToSendOrderNotification);
    }
  };

  const testDeliveryNotification = async () => {
    try {
      await NotificationService.sendDeliveryNotification({
        orderId,
        deliveryPersonName: 'Delivery Agent',
        estimatedTime: '30 minutes',
        trackingUrl: 'https://example.com/track',
      });
      
      showNotification({
        title: 'Test Notification',
        message: 'Delivery notification sent successfully!',
        type: 'success',
      });
    } catch (error) {
      Alert.alert(translations.error, translations.failedToSendDeliveryNotification);
    }
  };

  const testOTPNotification = async () => {
    try {
      await NotificationService.sendOTPNotification({
        orderId,
        otp,
        deliveryPersonName: 'Delivery Agent',
      });
      
      showNotification({
        title: 'Test Notification',
        message: 'OTP notification sent successfully!',
        type: 'success',
      });
    } catch (error) {
      Alert.alert(translations.error, translations.failedToSendOTPNotification);
    }
  };

  const testInAppNotification = () => {
    showNotification({
      title: 'In-App Notification',
      message: 'This is a test in-app notification banner!',
      type: 'info',
      duration: 5000,
    });
  };

  const testSuccessNotification = () => {
    showNotification({
      title: 'Success!',
      message: 'Operation completed successfully',
      type: 'success',
    });
  };

  const testWarningNotification = () => {
    showNotification({
      title: 'Warning',
      message: 'Please check your internet connection',
      type: 'warning',
    });
  };

  const testErrorNotification = () => {
    showNotification({
      title: 'Error',
      message: 'Something went wrong. Please try again.',
      type: 'error',
    });
  };

  const getFCMToken = async () => {
    try {
      const token = await NotificationService.getFCMToken();
      if (token) {
        Alert.alert(translations.fcmToken, token);
      } else {
        Alert.alert(translations.error, translations.failedToGetFCMToken);
      }
    } catch (error) {
      Alert.alert(translations.error, translations.failedToGetFCMToken);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Notification Testing</Text>
        
        <NotificationPermissionDebug />
        
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Test Data</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Order ID:</Text>
            <TextInput
              style={styles.input}
              value={orderId}
              onChangeText={setOrderId}
              placeholder="Enter order ID"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Customer Name:</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>OTP:</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter OTP"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FCM Notifications</Text>
          
          <TouchableOpacity style={styles.button} onPress={testOrderNotification}>
            <Text style={styles.buttonText}>Test Order Notification</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testDeliveryNotification}>
            <Text style={styles.buttonText}>Test Delivery Notification</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testOTPNotification}>
            <Text style={styles.buttonText}>Test OTP Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>In-App Notifications</Text>
          
          <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={testInAppNotification}>
            <Text style={styles.buttonText}>Test Info Notification</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.successButton]} onPress={testSuccessNotification}>
            <Text style={styles.buttonText}>Test Success Notification</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={testWarningNotification}>
            <Text style={styles.buttonText}>Test Warning Notification</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={testErrorNotification}>
            <Text style={styles.buttonText}>Test Error Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Utilities</Text>
          
          <TouchableOpacity style={[styles.button, styles.utilityButton]} onPress={getFCMToken}>
            <Text style={styles.buttonText}>Get FCM Token</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Extra padding to ensure all content is accessible
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 30,
  },
  inputSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  errorButton: {
    backgroundColor: '#F44336',
  },
  utilityButton: {
    backgroundColor: '#9C27B0',
  },
});