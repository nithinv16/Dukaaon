import { supabase } from '../supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  content?: string;
  templateName?: string;
  templateParams?: string[];
  mediaUrl?: string;
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
}

interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  error?: string;
}

export class WhatsAppBusinessAPI {
  private static instance: WhatsAppBusinessAPI;
  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  public isConfigured: boolean = false;

  constructor() {
    this.apiUrl = process.env.EXPO_PUBLIC_WHATSAPP_API_URL || '';
    this.accessToken = process.env.EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || '';
    this.isConfigured = !!(this.apiUrl && this.accessToken && this.phoneNumberId);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WhatsAppBusinessAPI {
    if (!WhatsAppBusinessAPI.instance) {
      WhatsAppBusinessAPI.instance = new WhatsAppBusinessAPI();
    }
    return WhatsAppBusinessAPI.instance;
  }

  /**
   * Initialize the WhatsApp Business API
   */
  public async initialize(): Promise<void> {
    // Initialization logic if needed
    console.log('WhatsApp Business API initialized');
  }

  /**
   * Check if WhatsApp Business API is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, message: string): Promise<WhatsAppResponse | null> {
    if (!this.isConfigured) {
      console.warn('WhatsApp Business API not configured');
      return null;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(to),
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await this.makeAPICall(payload);
      await this.logMessage(to, 'text', message, response);
      return response;
    } catch (error) {
      console.error('Error sending WhatsApp text message:', error);
      await this.logMessage(to, 'text', message, null, error as Error);
      return null;
    }
  }

  /**
   * Send a template message (for notifications)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    parameters: string[] = []
  ): Promise<WhatsAppResponse | null> {
    if (!this.isConfigured) {
      console.warn('WhatsApp Business API not configured');
      return null;
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(to),
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: parameters.length > 0 ? [{
            type: 'body',
            parameters: parameters.map(param => ({
              type: 'text',
              text: param
            }))
          }] : []
        }
      };

      const response = await this.makeAPICall(payload);
      await this.logMessage(to, 'template', templateName, response);
      return response;
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error);
      await this.logMessage(to, 'template', templateName, null, error as Error);
      return null;
    }
  }

  /**
   * Send order notification
   */
  async sendOrderNotification(
    orderId: string,
    status: string,
    customerPhone: string,
    customerName?: string,
    totalAmount?: number
  ): Promise<boolean> {
    try {
      // Try template message first (for approved templates)
      const templateResponse = await this.sendTemplateMessage(
        customerPhone,
        'order_update',
        'en',
        [orderId, status, totalAmount?.toString() || '']
      );

      if (templateResponse) {
        return true;
      }

      // Fallback to text message
      const message = this.formatOrderMessage(orderId, status, customerName, totalAmount);
      const textResponse = await this.sendTextMessage(customerPhone, message);
      return !!textResponse;
    } catch (error) {
      console.error('Error sending order notification:', error);
      return false;
    }
  }

  /**
   * Send stock alert to retailer
   */
  async sendStockAlert(
    productName: string,
    retailerPhone: string,
    wholesalerName?: string,
    price?: number
  ): Promise<boolean> {
    try {
      // Try template message first
      const templateResponse = await this.sendTemplateMessage(
        retailerPhone,
        'stock_alert',
        'en',
        [productName, wholesalerName || '', price?.toString() || '']
      );

      if (templateResponse) {
        return true;
      }

      // Fallback to text message
      const message = this.formatStockAlertMessage(productName, wholesalerName, price);
      const textResponse = await this.sendTextMessage(retailerPhone, message);
      return !!textResponse;
    } catch (error) {
      console.error('Error sending stock alert:', error);
      return false;
    }
  }

  /**
   * Send order amount update
   */
  async sendOrderAmountUpdate(
    orderId: string,
    newAmount: number,
    customerPhone: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const message = this.formatOrderAmountUpdateMessage(orderId, newAmount, reason);
      const response = await this.sendTextMessage(customerPhone, message);
      return !!response;
    } catch (error) {
      console.error('Error sending order amount update:', error);
      return false;
    }
  }

  /**
   * Send seller order alert when retailer places order
   */
  async sendSellerOrderAlert(
    sellerPhone: string,
    orderNumber: string,
    retailerName: string,
    items: Array<{ name: string; quantity: number; price: number }>,
    totalAmount: number
  ): Promise<boolean> {
    try {
      // Try template message first (for approved templates)
      const templateResponse = await this.sendTemplateMessage(
        sellerPhone,
        'seller_order_alert',
        'en',
        [orderNumber, retailerName, totalAmount.toString(), items.length.toString()]
      );

      if (templateResponse) {
        return true;
      }

      // Fallback to text message
      const message = this.formatSellerOrderAlertMessage(orderNumber, retailerName, items, totalAmount);
      const textResponse = await this.sendTextMessage(sellerPhone, message);
      return !!textResponse;
    } catch (error) {
      console.error('Error sending seller order alert:', error);
      return false;
    }
  }

  /**
   * Handle webhook for message status updates
   */
  async handleWebhook(webhookData: any): Promise<void> {
    try {
      if (webhookData.entry) {
        for (const entry of webhookData.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value && change.value.statuses) {
                for (const status of change.value.statuses) {
                  await this.updateMessageStatus({
                    id: status.id,
                    status: status.status,
                    timestamp: status.timestamp,
                    error: status.errors?.[0]?.title
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling WhatsApp webhook:', error);
    }
  }

  /**
   * Make API call to WhatsApp Business API
   */
  private async makeAPICall(payload: any): Promise<WhatsAppResponse> {
    const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`WhatsApp API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Format order notification message
   */
  private formatOrderMessage(
    orderId: string,
    status: string,
    customerName?: string,
    totalAmount?: number
  ): string {
    const greeting = customerName ? `Hi ${customerName},` : 'Hi,';
    const statusEmoji = this.getStatusEmoji(status);
    const amountText = totalAmount ? `\nAmount: ₹${totalAmount}` : '';
    
    return `${greeting}\n\n${statusEmoji} Your order has been ${status}!\n\nOrder ID: ${orderId}${amountText}\n\nThank you for choosing DukaaOn!`;
  }

  /**
   * Format stock alert message
   */
  private formatStockAlertMessage(
    productName: string,
    wholesalerName?: string,
    price?: number
  ): string {
    const wholesalerText = wholesalerName ? ` from ${wholesalerName}` : '';
    const priceText = price ? ` at ₹${price}` : '';
    
    return `📦 Stock Alert!\n\n${productName} is now available${wholesalerText}${priceText}.\n\nOrder now on DukaaOn!`;
  }

  /**
   * Format order amount update message
   */
  private formatOrderAmountUpdateMessage(
    orderId: string,
    newAmount: number,
    reason?: string
  ): string {
    const reasonText = reason ? `\nReason: ${reason}` : '';
    
    return `💰 Order Amount Updated\n\nOrder ID: ${orderId}\nNew Amount: ₹${newAmount}${reasonText}\n\nPlease review and confirm.`;
  }

  /**
   * Format seller order alert message
   */
  private formatSellerOrderAlertMessage(
    orderNumber: string,
    retailerName: string,
    items: Array<{ name: string; quantity: number; price: number }>,
    totalAmount: number
  ): string {
    const itemsList = items.map(item => 
      `• ${item.name} (Qty: ${item.quantity})`
    ).join('\n');
    
    return `🛒 *New Order Received - DukaaOn*\n\n📋 Order #${orderNumber}\n👤 Customer: ${retailerName}\n💰 Total: ₹${totalAmount}\n\n📦 *Items:*\n${itemsList}\n\n✅ Please confirm and prepare the order.\n\n📱 Check details in the DukaaOn app.`;
  }

  /**
   * Get emoji for order status
   */
  private getStatusEmoji(status: string): string {
    const emojiMap: { [key: string]: string } = {
      'confirmed': '✅',
      'preparing': '👨‍🍳',
      'ready': '📦',
      'out_for_delivery': '🚚',
      'delivered': '🎉',
      'cancelled': '❌'
    };
    
    return emojiMap[status] || '📋';
  }

  /**
   * Log message to database
   */
  private async logMessage(
    recipient: string,
    type: string,
    content: string,
    response: WhatsAppResponse | null,
    error?: Error
  ): Promise<void> {
    try {
      const logData = {
        recipient_phone: this.formatPhoneNumber(recipient),
        message_type: type,
        content: content,
        status: response ? 'sent' : 'failed',
        whatsapp_message_id: response?.messages?.[0]?.id || null,
        error_message: error?.message || null,
        sent_at: new Date().toISOString()
      };

      await supabase
        .from('whatsapp_messages')
        .insert(logData);
    } catch (logError) {
      console.error('Error logging WhatsApp message:', logError);
    }
  }

  /**
   * Update message status from webhook
   */
  private async updateMessageStatus(status: MessageStatus): Promise<void> {
    try {
      await supabase
        .from('whatsapp_messages')
        .update({
          status: status.status,
          delivered_at: status.status === 'delivered' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : null,
          read_at: status.status === 'read' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : null,
          error_message: status.error || null
        })
        .eq('whatsapp_message_id', status.id);
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }
}

// Export singleton instance
export const whatsappBusinessAPI = new WhatsAppBusinessAPI();