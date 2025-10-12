import { WhatsAppBusinessAPI } from './whatsappBusinessAPI';
import { supabase } from '../supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WhatsAppPreferences {
  whatsapp_notifications: boolean;
  whatsapp_number: string | null;
  whatsapp_opt_in: boolean;
}

export interface WhatsAppMessageOptions {
  fallbackToSMS?: boolean;
  priority?: 'high' | 'normal' | 'low';
  templateName?: string;
  variables?: string[];
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private whatsappAPI: WhatsAppBusinessAPI;
  private isInitialized = false;

  private constructor() {
    this.whatsappAPI = WhatsAppBusinessAPI.getInstance();
  }

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /**
   * Initialize WhatsApp service
   */
  public async initialize(): Promise<void> {
    try {
      await this.whatsappAPI.initialize();
      this.isInitialized = true;
      console.log('WhatsApp Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WhatsApp Service:', error);
      throw error;
    }
  }

  /**
   * Check if user has opted in for WhatsApp notifications
   */
  public async getUserPreferences(phoneNumber: string): Promise<WhatsAppPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('whatsapp_notifications, whatsapp_number, whatsapp_opt_in')
        .eq('phone_number', phoneNumber)
        .single();

      if (error) {
        console.error('Error fetching WhatsApp preferences:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserPreferences:', error);
      return null;
    }
  }

  /**
   * Update user's WhatsApp opt-in status
   */
  public async updateOptInStatus(phoneNumber: string, optIn: boolean): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_whatsapp_opt_in', {
        user_phone: phoneNumber,
        opt_in_status: optIn
      });

      if (error) {
        console.error('Error updating opt-in status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateOptInStatus:', error);
      return false;
    }
  }

  /**
   * Send order notification via WhatsApp
   */
  public async sendOrderNotification(
    phoneNumber: string,
    orderDetails: {
      orderId: string;
      status: string;
      amount: number;
      customerName?: string;
      items?: Array<{ name: string; quantity: number; price: number }>;
    },
    options: WhatsAppMessageOptions = {}
  ): Promise<boolean> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(phoneNumber);
      if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
        console.log('User has not opted in for WhatsApp notifications');
        return false;
      }

      const targetNumber = preferences.whatsapp_number || phoneNumber;
      
      // Try template message first
      if (options.templateName) {
        const result = await this.whatsappAPI.sendTemplateMessage(
          targetNumber,
          options.templateName,
          'en',
          options.variables || []
        );
        if (result) return true;
      }

      // Fallback to formatted text message
      const message = this.formatOrderMessage(orderDetails);
      const result = await this.whatsappAPI.sendTextMessage(targetNumber, message);
      return !!result;

    } catch (error) {
      console.error('Error sending order notification:', error);
      return false;
    }
  }

  /**
   * Send stock alert via WhatsApp
   */
  public async sendStockAlert(
    phoneNumber: string,
    stockDetails: {
      productName: string;
      wholesalerName: string;
      price: number;
      quantity?: number;
      category?: string;
    },
    options: WhatsAppMessageOptions = {}
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(phoneNumber);
      if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
        return false;
      }

      const targetNumber = preferences.whatsapp_number || phoneNumber;
      
      // Try template message
      if (options.templateName) {
        const result = await this.whatsappAPI.sendTemplateMessage(
          targetNumber,
          options.templateName,
          'en',
          options.variables || []
        );
        if (result) return true;
      }

      // Fallback to formatted text
      const message = this.formatStockAlertMessage(stockDetails);
      const result = await this.whatsappAPI.sendTextMessage(targetNumber, message);
      return !!result;

    } catch (error) {
      console.error('Error sending stock alert:', error);
      return false;
    }
  }

  /**
   * Send payment reminder via WhatsApp
   */
  public async sendPaymentReminder(
    phoneNumber: string,
    paymentDetails: {
      orderId: string;
      amount: number;
      dueDate?: string;
      customerName?: string;
    },
    options: WhatsAppMessageOptions = {}
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(phoneNumber);
      if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
        return false;
      }

      const targetNumber = preferences.whatsapp_number || phoneNumber;
      const message = this.formatPaymentReminderMessage(paymentDetails);
      
      const result = await this.whatsappAPI.sendTextMessage(targetNumber, message);
      return !!result;

    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return false;
    }
  }

  /**
   * Send delivery update via WhatsApp
   */
  public async sendDeliveryUpdate(
    phoneNumber: string,
    deliveryDetails: {
      orderId: string;
      status: string;
      trackingUrl?: string;
      estimatedDelivery?: string;
      deliveryPartner?: string;
    },
    options: WhatsAppMessageOptions = {}
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(phoneNumber);
      if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
        return false;
      }

      const targetNumber = preferences.whatsapp_number || phoneNumber;
      const message = this.formatDeliveryUpdateMessage(deliveryDetails);
      
      const result = await this.whatsappAPI.sendTextMessage(targetNumber, message);
      return !!result;

    } catch (error) {
      console.error('Error sending delivery update:', error);
      return false;
    }
  }

  /**
   * Send seller order notification via WhatsApp
   */
  public async sendSellerOrderNotification(
    phoneNumber: string,
    orderDetails: {
      orderNumber: string;
      retailerName: string;
      items: Array<{ name: string; quantity: number }>;
      totalAmount: number;
    },
    options: WhatsAppMessageOptions = {}
  ): Promise<boolean> {
    try {
      // Check user preferences
      const preferences = await this.getUserPreferences(phoneNumber);
      if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
        console.log('Seller has not opted in for WhatsApp notifications');
        return false;
      }

      const targetNumber = preferences.whatsapp_number || phoneNumber;
      
      // Use the specialized seller order alert method
      return await this.whatsappAPI.sendSellerOrderAlert(
        targetNumber,
        orderDetails.orderNumber,
        orderDetails.retailerName,
        orderDetails.items.map(item => ({ ...item, price: 0 })), // Add default price for compatibility
        orderDetails.totalAmount
      );

    } catch (error) {
      console.error('Error sending seller order notification:', error);
      return false;
    }
  }

  /**
   * Send welcome message to new users
   */
  public async sendWelcomeMessage(
    phoneNumber: string,
    userDetails: {
      name: string;
      userType: 'retailer' | 'wholesaler' | 'seller';
    }
  ): Promise<boolean> {
    try {
      // For welcome messages, we might want to send even if not opted in
      // but we should ask for opt-in in the message
      const message = this.formatWelcomeMessage(userDetails);
      const result = await this.whatsappAPI.sendTextMessage(phoneNumber, message);
      return !!result;

    } catch (error) {
      console.error('Error sending welcome message:', error);
      return false;
    }
  }

  /**
   * Get WhatsApp message statistics
   */
  public async getMessageStats(days: number = 30): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_stats', {
        start_date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date().toISOString()
      });

      if (error) {
        console.error('Error fetching WhatsApp stats:', error);
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('Error in getMessageStats:', error);
      return null;
    }
  }

  /**
   * Bulk send messages (for promotions, announcements)
   */
  public async sendBulkMessages(
    recipients: string[],
    message: string,
    options: WhatsAppMessageOptions = {}
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const phoneNumber of recipients) {
      try {
        const preferences = await this.getUserPreferences(phoneNumber);
        if (!preferences?.whatsapp_opt_in || !preferences?.whatsapp_notifications) {
          failed++;
          continue;
        }

        const targetNumber = preferences.whatsapp_number || phoneNumber;
        const result = await this.whatsappAPI.sendTextMessage(targetNumber, message);
        
        if (result) {
          success++;
        } else {
          failed++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error sending message to ${phoneNumber}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // Private helper methods for message formatting
  private formatOrderMessage(orderDetails: any): string {
    const { orderId, status, amount, customerName, items } = orderDetails;
    
    let message = `🛍️ *Order Update - DukaaOn*\n\n`;
    message += `Order ID: *${orderId}*\n`;
    message += `Status: *${status.toUpperCase()}*\n`;
    message += `Amount: *₹${amount.toLocaleString()}*\n`;
    
    if (customerName) {
      message += `Customer: ${customerName}\n`;
    }
    
    if (items && items.length > 0) {
      message += `\n📦 *Items:*\n`;
      items.forEach((item: any) => {
        message += `• ${item.name} (Qty: ${item.quantity}) - ₹${item.price}\n`;
      });
    }
    
    message += `\n🙏 Thank you for choosing DukaaOn!`;
    return message;
  }

  private formatStockAlertMessage(stockDetails: any): string {
    const { productName, wholesalerName, price, quantity, category } = stockDetails;
    
    let message = `🔔 *Stock Alert - DukaaOn*\n\n`;
    message += `📦 *${productName}* is now available!\n\n`;
    message += `🏪 Wholesaler: *${wholesalerName}*\n`;
    message += `💰 Price: *₹${price.toLocaleString()}*\n`;
    
    if (quantity) {
      message += `📊 Available Quantity: ${quantity}\n`;
    }
    
    if (category) {
      message += `🏷️ Category: ${category}\n`;
    }
    
    message += `\n🛒 Order now on DukaaOn app!`;
    return message;
  }

  private formatPaymentReminderMessage(paymentDetails: any): string {
    const { orderId, amount, dueDate, customerName } = paymentDetails;
    
    let message = `💳 *Payment Reminder - DukaaOn*\n\n`;
    
    if (customerName) {
      message += `Hi ${customerName},\n\n`;
    }
    
    message += `Your payment for Order *${orderId}* is pending.\n\n`;
    message += `💰 Amount: *₹${amount.toLocaleString()}*\n`;
    
    if (dueDate) {
      message += `📅 Due Date: ${dueDate}\n`;
    }
    
    message += `\n⚠️ Please complete payment to avoid order cancellation.\n`;
    message += `\n📱 Pay now through DukaaOn app.`;
    return message;
  }

  private formatDeliveryUpdateMessage(deliveryDetails: any): string {
    const { orderId, status, trackingUrl, estimatedDelivery, deliveryPartner } = deliveryDetails;
    
    let message = `🚚 *Delivery Update - DukaaOn*\n\n`;
    message += `Order ID: *${orderId}*\n`;
    message += `Status: *${status.toUpperCase()}*\n`;
    
    if (deliveryPartner) {
      message += `Delivery Partner: ${deliveryPartner}\n`;
    }
    
    if (estimatedDelivery) {
      message += `📅 Estimated Delivery: ${estimatedDelivery}\n`;
    }
    
    if (trackingUrl) {
      message += `\n🔗 Track your order: ${trackingUrl}\n`;
    }
    
    message += `\n📱 Check DukaaOn app for real-time updates.`;
    return message;
  }

  private formatWelcomeMessage(userDetails: any): string {
    const { name, userType } = userDetails;
    
    let message = `🎉 *Welcome to DukaaOn!*\n\n`;
    message += `Hi ${name},\n\n`;
    message += `Your ${userType} account has been successfully verified! 🎊\n\n`;
    
    if (userType === 'retailer') {
      message += `🛍️ Start exploring wholesale products and grow your business with us.\n`;
    } else if (userType === 'wholesaler') {
      message += `🏪 Start listing your products and reach thousands of retailers.\n`;
    } else {
      message += `🚀 Start your journey with DukaaOn today!\n`;
    }
    
    message += `\n📱 Download our app for the best experience.\n`;
    message += `\n💬 Reply 'YES' to receive order updates via WhatsApp.\n`;
    message += `💬 Reply 'NO' to opt out of WhatsApp notifications.`;
    
    return message;
  }

  /**
   * Handle incoming WhatsApp messages (for opt-in/opt-out)
   */
  public async handleIncomingMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      if (normalizedMessage === 'yes' || normalizedMessage === 'y') {
        await this.updateOptInStatus(phoneNumber, true);
        const result = await this.whatsappAPI.sendTextMessage(
          phoneNumber,
          '✅ Great! You will now receive order updates via WhatsApp. You can opt out anytime by replying "NO".'
        );
      } else if (normalizedMessage === 'no' || normalizedMessage === 'n') {
        await this.updateOptInStatus(phoneNumber, false);
        const result = await this.whatsappAPI.sendTextMessage(
          phoneNumber,
          '❌ You have opted out of WhatsApp notifications. You can opt back in anytime by replying "YES".'
        );
      } else if (normalizedMessage === 'stop' || normalizedMessage === 'unsubscribe') {
        await this.updateOptInStatus(phoneNumber, false);
        const result = await this.whatsappAPI.sendTextMessage(
          phoneNumber,
          '🛑 You have been unsubscribed from all WhatsApp notifications. Reply "YES" to subscribe again.'
        );
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  /**
   * Check if WhatsApp service is available
   */
  public isAvailable(): boolean {
    return this.isInitialized && this.whatsappAPI.isConfigured;
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    lastMessageSent?: Date;
    errorRate?: number;
  }> {
    try {
      if (!this.isAvailable()) {
        return { status: 'down' };
      }

      // Check recent message success rate
      const stats = await this.getMessageStats(1); // Last 24 hours
      
      if (!stats) {
        return { status: 'degraded' };
      }

      const errorRate = stats.failed_messages / Math.max(stats.total_messages, 1);
      
      return {
        status: errorRate > 0.1 ? 'degraded' : 'healthy',
        errorRate: errorRate * 100
      };
    } catch (error) {
      console.error('Error checking health status:', error);
      return { status: 'down' };
    }
  }
}

export default WhatsAppService.getInstance();