import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.expoPushToken = token;

      // Save token to user's profile in Supabase
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          push_token: token,
          device_type: Platform.OS,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2196F3',
        });
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }

  async sendCustomNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ) {
    try {
      // First, get the user's push token
      const { data: tokenData, error: tokenError } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        throw new Error('User push token not found');
      }

      // Send the notification through Expo's push notification service
      const message = {
        to: tokenData.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      // Save notification to database
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message: body,
          type: data?.type || 'system',
          data,
          read: false,
          created_at: new Date().toISOString(),
        });

      if (notifError) throw notifError;

    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Helper methods for different notification types
  async sendOrderNotification(
    userId: string,
    orderId: string,
    status: string
  ) {
    const title = 'Order Update';
    const body = `Your order #${orderId} is ${status}`;
    await this.sendCustomNotification(userId, title, body, {
      type: 'order',
      orderId,
      status,
    });
  }

  async sendPaymentNotification(
    userId: string,
    paymentId: string,
    status: string
  ) {
    const title = 'Payment Update';
    const body = `Payment #${paymentId} ${status}`;
    await this.sendCustomNotification(userId, title, body, {
      type: 'payment',
      paymentId,
      status,
    });
  }

  async sendPromotionNotification(
    userId: string,
    promotionId: string,
    promotionTitle: string
  ) {
    const title = 'New Promotion';
    const body = promotionTitle;
    await this.sendCustomNotification(userId, title, body, {
      type: 'promotion',
      promotionId,
    });
  }
}

export const pushNotificationService = PushNotificationService.getInstance(); 