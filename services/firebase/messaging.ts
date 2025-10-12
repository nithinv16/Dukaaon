import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/supabase';
import { NotificationPermissionService } from '../permissions/NotificationPermissionService';
import { isFirebaseInitialized, checkFirebaseInitialization, waitForFirebaseInitialization } from './firebase';

export interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: 'order_update' | 'delivery_update' | 'otp' | 'general';
}

class FCMService {
  private isInitialized = false;
  private fcmToken: string | null = null;

  private async waitForFirebase(): Promise<void> {
    await waitForFirebaseInitialization();
    console.log('FCM: Firebase app ready, proceeding with messaging initialization');
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('FCM: Initializing Firebase Cloud Messaging...');
      
      // Wait for Firebase to be ready
      await this.waitForFirebase();
      
      // Request all necessary permissions (Android 13+ and Firebase)
      const permissionResult = await NotificationPermissionService.requestNotificationPermissions();
      
      if (!permissionResult.granted) {
        console.log('FCM: Notification permissions not granted:', permissionResult.error);
        return false;
      }
      
      console.log('FCM: All notification permissions granted');
      
      // Get FCM token
      const token = await messaging().getToken();
      if (token) {
        console.log('FCM: Token obtained:', token.substring(0, 20) + '...');
        this.fcmToken = token;
        
        // Save token to storage and database
        await this.saveFCMToken(token);
      } else {
        console.log('FCM: Failed to get token');
        return false;
      }
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Set up token refresh handler
      this.setupTokenRefreshHandler();
      
      this.isInitialized = true;
      console.log('FCM: Initialization completed successfully');
      return true;
      
    } catch (error) {
      console.error('FCM: Initialization failed:', error);
      return false;
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      this.fcmToken = token;
      
      // Store token locally
      await AsyncStorage.setItem('fcm_token', token);
      
      // Update token in Supabase
      await this.updateTokenInDatabase(token);
      
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('FCM: Error getting token:', error);
      return null;
    }
  }

  private async updateTokenInDatabase(token: string) {
    try {
      const userPhone = await AsyncStorage.getItem('user_phone');
      if (!userPhone) return;

      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('phone_number', userPhone);

      if (error) {
        console.error('FCM: Error updating token in database:', error);
      } else {
        console.log('FCM: Token updated in database');
      }
    } catch (error) {
      console.error('FCM: Error updating token:', error);
    }
  }

  private setupMessageHandlers() {
    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('FCM: Foreground message received:', remoteMessage);
      this.handleForegroundMessage(remoteMessage);
    });

    // Handle background/quit state messages
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('FCM: Notification opened app:', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // Handle app opened from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('FCM: App opened from quit state:', remoteMessage);
          this.handleNotificationPress(remoteMessage);
        }
      });

    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('FCM: Background message received:', remoteMessage);
      this.handleBackgroundMessage(remoteMessage);
    });
  }

  private setupTokenRefreshHandler() {
    messaging().onTokenRefresh((token) => {
      console.log('FCM: Token refreshed:', token);
      this.fcmToken = token;
      AsyncStorage.setItem('fcm_token', token);
      this.updateTokenInDatabase(token);
    });
  }

  private handleForegroundMessage(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    if (notification) {
      // Show in-app notification
      Alert.alert(
        notification.title || 'Notification',
        notification.body || '',
        [
          {
            text: 'OK',
            onPress: () => this.handleNotificationPress(remoteMessage)
          }
        ]
      );
    }

    // Add to notifications store
    this.addToNotificationStore(remoteMessage);
  }

  private handleBackgroundMessage(remoteMessage: any) {
    console.log('FCM: Handling background message:', remoteMessage);
    // Add to notifications store
    this.addToNotificationStore(remoteMessage);
  }

  private handleNotificationPress(remoteMessage: any) {
    const { data } = remoteMessage;
    
    if (data?.type) {
      switch (data.type) {
        case 'order_update':
          // Navigate to order details
          if (data.orderId) {
            // You can use a navigation service here
            console.log('Navigate to order:', data.orderId);
          }
          break;
        case 'delivery_update':
          // Navigate to delivery tracking
          if (data.orderId) {
            console.log('Navigate to delivery tracking:', data.orderId);
          }
          break;
        case 'otp':
          // Handle OTP notification
          console.log('OTP notification:', data.otp);
          break;
        default:
          console.log('General notification pressed');
      }
    }
  }

  private addToNotificationStore(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    if (notification) {
      const notificationItem = {
        id: Date.now().toString(),
        title: notification.title || 'Notification',
        message: notification.body || '',
        type: this.mapNotificationType(data?.type || 'general'),
        data: data || {},
        read: false,
        created_at: new Date().toISOString()
      };

      // Save to database (the store will be updated when components fetch notifications)
      this.saveNotificationToDatabase(notificationItem);
    }
  }

  private mapNotificationType(fcmType: string): 'order' | 'payment' | 'promotion' | 'system' {
    switch (fcmType) {
      case 'order_update':
      case 'delivery_update':
        return 'order';
      case 'payment':
        return 'payment';
      case 'promotion':
        return 'promotion';
      default:
        return 'system';
    }
  }

  private async saveNotificationToDatabase(notification: any) {
    try {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('FCM: No authenticated user, skipping notification save');
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          user_id: user.id
        });

      if (error) {
        console.error('FCM: Error saving notification to database:', error);
      }
    } catch (error) {
      console.error('FCM: Error saving notification:', error);
    }
  }

  // Method to send notification (for testing or admin use)
  async sendNotification(notification: FCMNotification, targetToken?: string) {
    try {
      // This would typically be called from your backend
      // For testing purposes, you can use Firebase Admin SDK from your backend
      console.log('FCM: Sending notification:', notification);
      
      // In a real app, you would call your backend API here
      // Example: await fetch('/api/send-notification', { ... })
      
    } catch (error) {
      console.error('FCM: Error sending notification:', error);
    }
  }

  // Get current FCM token
  async getCurrentToken(): Promise<string | null> {
    try {
      // Ensure service is initialized
      if (!this.isInitialized) {
        console.log('FCM: Service not initialized, initializing now...');
        await this.initialize();
      }
      
      // Check if we have permission
      const hasPermission = await this.isNotificationEnabled();
      if (!hasPermission) {
        console.log('FCM: Notification permission not granted');
        return null;
      }
      
      // If we already have a token, return it
      if (this.fcmToken) {
        return this.fcmToken;
      }
      
      // Try to get token from storage first
      const storedToken = await AsyncStorage.getItem('fcm_token');
      if (storedToken) {
        this.fcmToken = storedToken;
        return storedToken;
      }
      
      // If no stored token, get fresh token
      const token = await messaging().getToken();
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcm_token', token);
        await this.updateTokenInDatabase(token);
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('FCM: Error getting current token:', error);
      return null;
    }
  }

  // Check if notifications are enabled
  async isNotificationEnabled(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
           authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  }

  // Subscribe to topic
  async subscribeToTopic(topic: string) {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`FCM: Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`FCM: Error subscribing to topic ${topic}:`, error);
    }
  }

  // Unsubscribe from topic
  async unsubscribeFromTopic(topic: string) {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`FCM: Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`FCM: Error unsubscribing from topic ${topic}:`, error);
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService();
export default fcmService;