import messaging from '@react-native-firebase/messaging';
import { supabase } from '../supabase/supabase';
import { fcmService } from '../firebase/messaging';
import { waitForFirebaseInitialization, checkFirebaseInitialization } from '../firebase/firebase';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WhatsAppService from '../whatsapp/WhatsAppService';

export interface OrderNotification {
  orderId: string;
  status: 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
  customerName: string;
  items: string[];
  totalAmount: number;
}

export interface DeliveryNotification {
  orderId: string;
  deliveryPersonName: string;
  estimatedTime: string;
  trackingUrl?: string;
}

export interface OTPNotification {
  orderId: string;
  otp: string;
  deliveryPersonName: string;
}

export class NotificationService {
  private static whatsappService = WhatsAppService;

  // Initialize the notification service
  static async initialize() {
    try {
      console.log('NotificationService: Initializing...');
      
      // Wait for Firebase to be initialized first
      let firebaseReady = false;
      try {
        console.log('NotificationService: Waiting for Firebase initialization...');
        await waitForFirebaseInitialization();
        
        // Check if Firebase is actually ready after waiting
        firebaseReady = checkFirebaseInitialization();
        if (firebaseReady) {
          console.log('NotificationService: Firebase initialization complete and ready');
        } else {
          console.warn('NotificationService: Firebase initialization completed but Firebase is not ready');
        }
      } catch (firebaseError) {
        console.error('NotificationService: Firebase initialization failed:', firebaseError);
        console.warn('NotificationService: Continuing without Firebase functionality');
        firebaseReady = false;
      }
      
      let fcmInitialized = false;
      let whatsappInitialized = false;
      
      // Only proceed with Firebase-dependent operations if Firebase is ready
      if (firebaseReady) {
        // Check and request notification permissions only if Firebase is ready
        try {
          const { NotificationPermissionService } = await import('../permissions/NotificationPermissionService');
          const permissionResult = await NotificationPermissionService.checkNotificationPermissions();
          
          if (!permissionResult.granted) {
            console.log('NotificationService: Requesting notification permissions...');
            const requestResult = await NotificationPermissionService.requestPermissionsWithRationale();
            
            if (!requestResult.granted) {
              console.warn('NotificationService: Notification permissions not granted, some features may not work');
            }
          }
        } catch (permissionError) {
          console.warn('NotificationService: Permission service not available:', permissionError);
        }
        
        // Initialize FCM service only if Firebase is ready
        try {
          await fcmService.initialize();
          fcmInitialized = true;
          console.log('NotificationService: FCM service initialized successfully');
        } catch (fcmError) {
          console.error('NotificationService: FCM initialization failed:', fcmError);
          console.error('NotificationService: This may be due to Firebase not being properly initialized.');
          console.error('NotificationService: Please check:');
          console.error('1. google-services.json is in the project root');
          console.error('2. app.config.js has correct googleServicesFile path');
          console.error('3. @react-native-firebase/app is properly installed');
          console.warn('NotificationService: Continuing without FCM functionality');
        }
        
        // Setup notification handlers only if FCM is available
        if (fcmInitialized) {
          this.setupForegroundHandler();
          this.setupBackgroundHandler();
          this.setupNotificationOpenedHandler();
        }
      } else {
        console.warn('NotificationService: Skipping Firebase-dependent initialization (Firebase not ready)');
      }
      
      // Initialize WhatsApp service (independent of Firebase)
      try {
        await this.whatsappService.initialize();
        whatsappInitialized = true;
        console.log('NotificationService: WhatsApp service initialized');
      } catch (whatsappError) {
        console.warn('NotificationService: WhatsApp service initialization failed:', whatsappError);
      }
      
      // Log final status
      if (fcmInitialized && whatsappInitialized) {
        console.log('NotificationService: Initialized successfully with FCM and WhatsApp');
      } else if (fcmInitialized) {
        console.log('NotificationService: Initialized with FCM only (WhatsApp unavailable)');
      } else if (whatsappInitialized) {
        console.log('NotificationService: Initialized with WhatsApp only (FCM unavailable)');
      } else {
        console.warn('NotificationService: Initialized with limited functionality (FCM and WhatsApp unavailable)');
      }
    } catch (error) {
      console.error('NotificationService: Initialization failed:', error);
      throw error;
    }
  }

  // Handle foreground notifications
  private static setupForegroundHandler() {
    try {
      // Check if Firebase is initialized before setting up handlers
      if (!checkFirebaseInitialization()) {
        console.error('NotificationService: Error setting up foreground handler: Firebase not initialized');
        return;
      }

      messaging().onMessage(async (remoteMessage) => {
        console.log('Foreground notification received:', remoteMessage);
        
        // Save to store and database
        await this.saveNotification(remoteMessage);
        
        // Show in-app alert for foreground notifications
        if (remoteMessage.notification) {
          Alert.alert(
            remoteMessage.notification.title || 'Notification',
            remoteMessage.notification.body || '',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Handle notification press if needed
                  if (remoteMessage.data) {
                    this.handleNotificationPress(remoteMessage.data);
                  }
                },
              },
            ]
          );
        }
      });
    } catch (error) {
      console.error('NotificationService: Error setting up foreground handler:', error);
    }
  }

  // Handle background notifications
  private static setupBackgroundHandler() {
    try {
      // Check if Firebase is initialized before setting up handlers
      if (!checkFirebaseInitialization()) {
        console.error('NotificationService: Error setting up background handler: Firebase not initialized');
        return;
      }

      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        console.log('Background notification received:', remoteMessage);
        await this.saveNotification(remoteMessage);
      });
    } catch (error) {
      console.error('NotificationService: Error setting up background handler:', error);
    }
  }

  // Handle notification opened from quit state
  private static setupNotificationOpenedHandler() {
    try {
      // Check if Firebase is initialized before setting up handlers
      if (!checkFirebaseInitialization()) {
        console.error('NotificationService: Error setting up notification opened handler: Firebase not initialized');
        return;
      }

      messaging().onNotificationOpenedApp((remoteMessage) => {
        console.log('Notification opened app:', remoteMessage);
        if (remoteMessage.data) {
          this.handleNotificationPress(remoteMessage.data);
        }
      });

      // Check if app was opened from a notification when it was quit
      messaging().getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from notification (quit state):', remoteMessage);
          if (remoteMessage.data) {
            this.handleNotificationPress(remoteMessage.data);
          }
        }
      }).catch((error) => {
        console.error('NotificationService: Error getting initial notification:', error);
      });
    } catch (error) {
      console.error('NotificationService: Error setting up notification opened handler:', error);
    }
  }

  // Handle notification press
  private static handleNotificationPress(data: any) {
    console.log('NotificationService: Handling notification press:', data);
    // Add navigation logic based on notification type
    // Example: navigate to order details, delivery tracking, etc.
  }

  // Save notification to local storage and database
  private static async saveNotification(notification: any) {
    try {
      // Save to local storage for offline access
      const existingNotifications = await AsyncStorage.getItem('notifications');
      const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
      
      const newNotification = {
        id: Date.now().toString(),
        title: notification.notification?.title || '',
        body: notification.notification?.body || '',
        data: notification.data || {},
        timestamp: new Date().toISOString(),
        read: false
      };
      
      notifications.unshift(newNotification);
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      
      console.log('NotificationService: Notification saved locally');
    } catch (error) {
      console.error('NotificationService: Error saving notification:', error);
    }
  }

  // Subscribe to user-specific topics
  static async subscribeToUserTopics(userId: string, userType: 'retailer' | 'wholesaler' | 'seller') {
    try {
      // Check if Firebase is initialized before subscribing to topics
      if (!checkFirebaseInitialization()) {
        console.error('NotificationService: Cannot subscribe to topics - Firebase not initialized');
        return;
      }

      await messaging().subscribeToTopic(`user_${userId}`);
      await messaging().subscribeToTopic(`${userType}_notifications`);
      console.log(`NotificationService: Subscribed to topics for ${userType} ${userId}`);
    } catch (error) {
      console.error('NotificationService: Error subscribing to topics:', error);
    }
  }

  // Unsubscribe from topics
  static async unsubscribeFromTopics(userId: string, userType: 'retailer' | 'wholesaler' | 'seller') {
    try {
      // Check if Firebase is initialized before unsubscribing from topics
      if (!checkFirebaseInitialization()) {
        console.error('NotificationService: Cannot unsubscribe from topics - Firebase not initialized');
        return;
      }

      await messaging().unsubscribeFromTopic(`user_${userId}`);
      await messaging().unsubscribeFromTopic(`${userType}_notifications`);
      console.log(`NotificationService: Unsubscribed from topics for ${userType} ${userId}`);
    } catch (error) {
      console.error('NotificationService: Error unsubscribing from topics:', error);
    }
  }

  // Send order notification
  static async sendOrderNotification(notification: OrderNotification, phoneNumber?: string) {
    try {
      const title = this.getOrderNotificationTitle(notification.status);
      const body = this.getOrderNotificationBody(notification);
      
      const fcmNotification = {
        title,
        body,
        data: {
          type: 'order',
          orderId: notification.orderId,
          status: notification.status,
        },
      };
      
      console.log('NotificationService: Sending order notification:', fcmNotification);
      
      // Send WhatsApp notification if phone number provided
      if (phoneNumber && this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendOrderNotification(phoneNumber, {
            orderId: notification.orderId,
            status: notification.status,
            amount: notification.totalAmount,
            customerName: notification.customerName,
            items: notification.items.map(item => ({ name: item, quantity: 1, price: 0 }))
          }, {
            templateName: 'order_update',
            variables: [notification.orderId, notification.status, notification.totalAmount.toString()]
          });
          console.log('NotificationService: WhatsApp notification sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp notification failed:', whatsappError);
        }
      }
      
      // Show in-app alert for immediate notifications
      Alert.alert(
        title,
        body,
        [
          {
            text: 'OK',
            onPress: () => {
              this.handleNotificationPress(fcmNotification.data);
            },
          },
        ]
      );
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'order',
        data: fcmNotification.data,
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending order notification:', error);
    }
  }

  // Send delivery notification
  static async sendDeliveryNotification(notification: DeliveryNotification, phoneNumber?: string) {
    try {
      const title = 'Delivery Update';
      const body = `Your order #${notification.orderId} is out for delivery by ${notification.deliveryPersonName}. Estimated delivery: ${notification.estimatedTime}`;
      
      const fcmNotification = {
        title,
        body,
        data: {
          type: 'delivery',
          orderId: notification.orderId,
          deliveryPersonName: notification.deliveryPersonName,
          estimatedTime: notification.estimatedTime,
          trackingUrl: notification.trackingUrl,
        },
      };
      
      console.log('NotificationService: Sending delivery notification:', fcmNotification);
      
      // Send WhatsApp notification if phone number provided
      if (phoneNumber && this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendDeliveryUpdate(phoneNumber, {
            orderId: notification.orderId,
            status: 'out_for_delivery',
            estimatedDelivery: notification.estimatedTime,
            deliveryPartner: notification.deliveryPersonName,
            trackingUrl: notification.trackingUrl
          }, {
            templateName: 'delivery_update',
            variables: [notification.orderId, notification.estimatedTime, notification.trackingUrl || '']
          });
          console.log('NotificationService: WhatsApp delivery notification sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp delivery notification failed:', whatsappError);
        }
      }
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'delivery',
        data: fcmNotification.data,
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending delivery notification:', error);
    }
  }

  // Send OTP notification
  static async sendOTPNotification(notification: OTPNotification) {
    try {
      const title = 'Delivery OTP';
      const body = `Your delivery OTP for order #${notification.orderId} is: ${notification.otp}. Share this with ${notification.deliveryPersonName}.`;
      
      const fcmNotification = {
        title,
        body,
        data: {
          type: 'otp',
          orderId: notification.orderId,
          otp: notification.otp,
          deliveryPersonName: notification.deliveryPersonName,
        },
      };
      
      console.log('NotificationService: Sending OTP notification:', fcmNotification);
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'otp',
        data: fcmNotification.data,
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending OTP notification:', error);
    }
  }

  // Send out of stock notification
  static async sendOutOfStockNotification(orderId: string, orderNumber: string, itemName: string, userId: string, phoneNumber?: string) {
    try {
      const title = 'Item Out of Stock';
      const body = `Unfortunately, "${itemName}" in your order #${orderNumber} is currently out of stock. Your total has been updated accordingly.`;
      
      const fcmNotification = {
        title,
        body,
        data: {
          type: 'out_of_stock',
          orderId: orderId,
          orderNumber: orderNumber,
          itemName: itemName,
        },
      };
      
      console.log('NotificationService: Sending out of stock notification:', fcmNotification);
      
      // Send WhatsApp notification if phone number provided
      if (phoneNumber && this.whatsappService.isAvailable()) {
        try {
          const whatsappMessage = `🚫 *Stock Update - DukaaOn*\n\nUnfortunately, "${itemName}" in your order #${orderNumber} is currently out of stock.\n\nYour order total has been updated accordingly. We apologize for the inconvenience.\n\n📱 Check your updated order in the DukaaOn app.`;
          await this.whatsappService.sendTextMessage(phoneNumber, whatsappMessage);
          console.log('NotificationService: WhatsApp out-of-stock notification sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp out-of-stock notification failed:', whatsappError);
        }
      }
      
      // Show in-app alert for immediate notifications
      Alert.alert(
        title,
        body,
        [
          {
            text: 'View Order',
            onPress: () => {
              this.handleNotificationPress(fcmNotification.data);
            },
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      
      // Save to database with user_id for targeted notifications
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'out_of_stock',
        data: { ...fcmNotification.data, user_id: userId },
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending out of stock notification:', error);
    }
  }

  // Save notification to database
  private static async saveNotificationToDatabase(notification: {
    title: string;
    message: string;
    type: string;
    data: any;
  }) {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          created_at: new Date().toISOString(),
          read: false,
        });
      
      if (error) {
        console.error('NotificationService: Error saving to database:', error);
      } else {
        console.log('NotificationService: Notification saved to database');
      }
    } catch (error) {
      console.error('NotificationService: Database save error:', error);
    }
  }

  // Update order status
  static async updateOrderStatus(orderId: string, status: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      
      if (error) {
        console.error('NotificationService: Error updating order status:', error);
      } else {
        console.log(`NotificationService: Order ${orderId} status updated to ${status}`);
      }
    } catch (error) {
      console.error('NotificationService: Order status update error:', error);
    }
  }

  // Get user notification settings
  static async getUserNotificationSettings(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('NotificationService: Error fetching notification settings:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('NotificationService: Notification settings fetch error:', error);
      return null;
    }
  }

  // Update user notification settings
  static async updateUserNotificationSettings(userId: string, settings: any) {
    try {
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        console.error('NotificationService: Error updating notification settings:', error);
      } else {
        console.log('NotificationService: Notification settings updated');
      }
    } catch (error) {
      console.error('NotificationService: Notification settings update error:', error);
    }
  }

  // Send stock alert notification
  static async sendStockAlertNotification(
    phoneNumber: string,
    stockDetails: {
      productName: string;
      wholesalerName: string;
      price: number;
      quantity?: number;
      category?: string;
    }
  ) {
    try {
      const title = 'Stock Alert';
      const body = `${stockDetails.productName} is now available from ${stockDetails.wholesalerName} at ₹${stockDetails.price}`;
      
      // Send WhatsApp notification
      if (this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendStockAlert(phoneNumber, stockDetails, {
            templateName: 'stock_alert',
            variables: [stockDetails.productName, stockDetails.wholesalerName, stockDetails.price.toString()]
          });
          console.log('NotificationService: WhatsApp stock alert sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp stock alert failed:', whatsappError);
        }
      }
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'stock_alert',
        data: { ...stockDetails, type: 'stock_alert' },
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending stock alert:', error);
    }
  }

  // Send payment reminder notification
  static async sendPaymentReminderNotification(
    phoneNumber: string,
    paymentDetails: {
      orderId: string;
      amount: number;
      dueDate?: string;
      customerName?: string;
    }
  ) {
    try {
      const title = 'Payment Reminder';
      const body = `Payment reminder for order ${paymentDetails.orderId}. Amount: ₹${paymentDetails.amount}`;
      
      // Send WhatsApp notification
      if (this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendPaymentReminder(phoneNumber, paymentDetails, {
            templateName: 'payment_reminder',
            variables: [paymentDetails.orderId, paymentDetails.amount.toString()]
          });
          console.log('NotificationService: WhatsApp payment reminder sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp payment reminder failed:', whatsappError);
        }
      }
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'payment_reminder',
        data: { ...paymentDetails, type: 'payment_reminder' },
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending payment reminder:', error);
    }
  }

  // Send welcome message to new users
  static async sendWelcomeNotification(
    phoneNumber: string,
    userDetails: {
      name: string;
      userType: 'retailer' | 'wholesaler' | 'seller';
    }
  ) {
    try {
      const title = 'Welcome to DukaaOn';
      const body = `Welcome ${userDetails.name}! Your ${userDetails.userType} account has been verified.`;
      
      // Send WhatsApp welcome message
      if (this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendWelcomeMessage(phoneNumber, userDetails);
          console.log('NotificationService: WhatsApp welcome message sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp welcome message failed:', whatsappError);
        }
      }
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'welcome',
        data: { ...userDetails, type: 'welcome' },
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending welcome notification:', error);
    }
  }

  // Send seller order notification when retailer places order
  static async sendSellerOrderNotification(
    phoneNumber: string,
    orderDetails: {
      orderId: string;
      orderNumber: string;
      retailerName: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      totalAmount: number;
      deliveryAddress: string;
      paymentMethod?: string;
    }
  ) {
    try {
      const title = 'New Order Received';
      const itemsList = orderDetails.items.map(item => 
        `${item.name} (Qty: ${item.quantity})`
      ).join(', ');
      const body = `New order #${orderDetails.orderNumber} from ${orderDetails.retailerName}. Items: ${itemsList}. Total: ₹${orderDetails.totalAmount}`;
      
      const fcmNotification = {
        title,
        body,
        data: {
          type: 'seller_order',
          orderId: orderDetails.orderId,
          orderNumber: orderDetails.orderNumber,
          retailerName: orderDetails.retailerName,
        },
      };
      
      console.log('NotificationService: Sending seller order notification:', fcmNotification);
      
      // Send WhatsApp notification
      if (this.whatsappService.isAvailable()) {
        try {
          await this.whatsappService.sendSellerOrderNotification(phoneNumber, {
            orderNumber: orderDetails.orderNumber,
            retailerName: orderDetails.retailerName,
            items: orderDetails.items.map(item => ({ name: item.name, quantity: item.quantity })),
            totalAmount: orderDetails.totalAmount
          });
          console.log('NotificationService: WhatsApp seller order notification sent successfully');
        } catch (whatsappError) {
          console.warn('NotificationService: WhatsApp seller order notification failed:', whatsappError);
        }
      }
      
      // Show in-app alert for immediate notifications
      Alert.alert(
        title,
        body,
        [
          {
            text: 'View Order',
            onPress: () => {
              this.handleNotificationPress(fcmNotification.data);
            },
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      
      // Save to database
      await this.saveNotificationToDatabase({
        title,
        message: body,
        type: 'seller_order',
        data: fcmNotification.data,
      });
      
    } catch (error) {
      console.error('NotificationService: Error sending seller order notification:', error);
    }
  }

  // Update WhatsApp opt-in status
  static async updateWhatsAppOptIn(phoneNumber: string, optIn: boolean): Promise<boolean> {
    try {
      if (this.whatsappService.isAvailable()) {
        return await this.whatsappService.updateOptInStatus(phoneNumber, optIn);
      }
      return false;
    } catch (error) {
      console.error('NotificationService: Error updating WhatsApp opt-in:', error);
      return false;
    }
  }

  // Get WhatsApp preferences
  static async getWhatsAppPreferences(phoneNumber: string) {
    try {
      if (this.whatsappService.isAvailable()) {
        return await this.whatsappService.getUserPreferences(phoneNumber);
      }
      return null;
    } catch (error) {
      console.error('NotificationService: Error getting WhatsApp preferences:', error);
      return null;
    }
  }

  // Get notification service health status
  static async getServiceHealthStatus() {
    try {
      const fcmStatus = await this.getFCMToken() ? 'healthy' : 'down';
      const whatsappStatus = this.whatsappService.isAvailable() 
        ? await this.whatsappService.getHealthStatus()
        : { status: 'down' };
      
      return {
        fcm: { status: fcmStatus },
        whatsapp: whatsappStatus,
        overall: fcmStatus === 'healthy' || whatsappStatus.status === 'healthy' ? 'healthy' : 'down'
      };
    } catch (error) {
      console.error('NotificationService: Error getting service health:', error);
      return {
        fcm: { status: 'down' },
        whatsapp: { status: 'down' },
        overall: 'down'
      };
    }
  }

  // Get FCM token
  static async getFCMToken(): Promise<string | null> {
    try {
      console.log('NotificationService: Getting FCM token...');
      const token = await fcmService.getCurrentToken();
      
      if (token) {
        console.log('NotificationService: FCM token retrieved successfully');
        return token;
      } else {
        console.log('NotificationService: No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('NotificationService: Error getting FCM token:', error);
      return null;
    }
  }

  // Helper methods for notification titles and bodies
  private static getOrderNotificationTitle(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'Order Confirmed';
      case 'preparing':
        return 'Order Being Prepared';
      case 'ready':
        return 'Order Ready';
      case 'out_for_delivery':
        return 'Order Out for Delivery';
      case 'delivered':
        return 'Order Delivered';
      case 'cancelled':
        return 'Order Cancelled';
      default:
        return 'Order Update';
    }
  }

  private static getOrderNotificationBody(notification: OrderNotification): string {
    const { orderId, status, customerName, items, totalAmount } = notification;
    
    switch (status) {
      case 'confirmed':
        return `Order #${orderId} for ${customerName} has been confirmed. Total: ₹${totalAmount}`;
      case 'preparing':
        return `Order #${orderId} is being prepared. Items: ${items.join(', ')}`;
      case 'ready':
        return `Order #${orderId} is ready for pickup/delivery.`;
      case 'out_for_delivery':
        return `Order #${orderId} is out for delivery to ${customerName}.`;
      case 'delivered':
        return `Order #${orderId} has been successfully delivered to ${customerName}.`;
      case 'cancelled':
        return `Order #${orderId} has been cancelled.`;
      default:
        return `Order #${orderId} status updated.`;
    }
  }
}