import { supabase } from '../supabase/supabase';
import WhatsAppService from './WhatsAppService';

export interface WhatsAppWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            expiration_timestamp?: string;
            origin: {
              type: string;
            };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppWebhookHandler {
  private static whatsappService = WhatsAppService;

  /**
   * Handle incoming WhatsApp webhook events
   */
  static async handleWebhook(event: WhatsAppWebhookEvent): Promise<void> {
    try {
      console.log('WhatsApp Webhook: Processing event:', JSON.stringify(event, null, 2));

      if (event.object !== 'whatsapp_business_account') {
        console.log('WhatsApp Webhook: Ignoring non-WhatsApp event');
        return;
      }

      for (const entry of event.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.handleMessageEvents(change.value);
          }
        }
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Handle message events (incoming messages and status updates)
   */
  private static async handleMessageEvents(value: any): Promise<void> {
    try {
      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          await this.handleIncomingMessage(message);
        }
      }

      // Handle message status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          await this.handleMessageStatus(status);
        }
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Error handling message events:', error);
    }
  }

  /**
   * Handle incoming messages from users
   */
  private static async handleIncomingMessage(message: any): Promise<void> {
    try {
      console.log('WhatsApp Webhook: Processing incoming message:', message);

      const phoneNumber = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;
      const messageType = message.type;

      let messageText = '';
      if (message.text) {
        messageText = message.text.body;
      }

      // Log the incoming message
      await this.logWebhookEvent({
        event_type: 'message_received',
        whatsapp_message_id: messageId,
        phone_number: phoneNumber,
        status: null,
        timestamp_received: parseInt(timestamp),
        raw_data: message,
        processed: false
      });

      // Handle opt-in/opt-out messages
      if (messageText && messageType === 'text') {
        await this.whatsappService.handleIncomingMessage(phoneNumber, messageText);
      }

      // Mark as processed
      await this.markWebhookEventProcessed(messageId);

    } catch (error) {
      console.error('WhatsApp Webhook: Error handling incoming message:', error);
    }
  }

  /**
   * Handle message status updates (sent, delivered, read, failed)
   */
  private static async handleMessageStatus(status: any): Promise<void> {
    try {
      console.log('WhatsApp Webhook: Processing message status:', status);

      const messageId = status.id;
      const statusValue = status.status;
      const timestamp = status.timestamp;
      const recipientId = status.recipient_id;

      // Log the status update
      await this.logWebhookEvent({
        event_type: 'message_status',
        whatsapp_message_id: messageId,
        phone_number: recipientId,
        status: statusValue,
        timestamp_received: parseInt(timestamp),
        raw_data: status,
        processed: false
      });

      // Update message status in database
      await this.updateMessageStatus(messageId, statusValue);

      // Mark as processed
      await this.markWebhookEventProcessed(messageId);

    } catch (error) {
      console.error('WhatsApp Webhook: Error handling message status:', error);
    }
  }

  /**
   * Log webhook event to database
   */
  private static async logWebhookEvent(eventData: {
    event_type: string;
    whatsapp_message_id: string;
    phone_number: string;
    status: string | null;
    timestamp_received: number;
    raw_data: any;
    processed: boolean;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_webhook_events')
        .insert(eventData);

      if (error) {
        console.error('WhatsApp Webhook: Error logging event:', error);
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Database error logging event:', error);
    }
  }

  /**
   * Update message status in database
   */
  private static async updateMessageStatus(messageId: string, status: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_whatsapp_message_status', {
        whatsapp_msg_id: messageId,
        new_status: status
      });

      if (error) {
        console.error('WhatsApp Webhook: Error updating message status:', error);
      } else {
        console.log(`WhatsApp Webhook: Updated message ${messageId} status to ${status}`);
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Database error updating status:', error);
    }
  }

  /**
   * Mark webhook event as processed
   */
  private static async markWebhookEventProcessed(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_webhook_events')
        .update({ processed: true })
        .eq('whatsapp_message_id', messageId);

      if (error) {
        console.error('WhatsApp Webhook: Error marking event as processed:', error);
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Database error marking processed:', error);
    }
  }

  /**
   * Verify webhook signature (for security)
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error('WhatsApp Webhook: Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook verification challenge
   */
  static handleVerificationChallenge(mode: string, token: string, challenge: string, verifyToken: string): string | null {
    try {
      if (mode === 'subscribe' && token === verifyToken) {
        console.log('WhatsApp Webhook: Verification successful');
        return challenge;
      } else {
        console.error('WhatsApp Webhook: Verification failed');
        return null;
      }
    } catch (error) {
      console.error('WhatsApp Webhook: Error handling verification:', error);
      return null;
    }
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(days: number = 7): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const { data, error } = await supabase
        .from('whatsapp_webhook_events')
        .select('event_type, status, processed, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        console.error('WhatsApp Webhook: Error fetching stats:', error);
        return null;
      }

      const stats = {
        total_events: data.length,
        processed_events: data.filter(e => e.processed).length,
        pending_events: data.filter(e => !e.processed).length,
        message_received: data.filter(e => e.event_type === 'message_received').length,
        message_status: data.filter(e => e.event_type === 'message_status').length,
        status_breakdown: {
          sent: data.filter(e => e.status === 'sent').length,
          delivered: data.filter(e => e.status === 'delivered').length,
          read: data.filter(e => e.status === 'read').length,
          failed: data.filter(e => e.status === 'failed').length
        }
      };

      return stats;
    } catch (error) {
      console.error('WhatsApp Webhook: Error calculating stats:', error);
      return null;
    }
  }

  /**
   * Retry failed webhook events
   */
  static async retryFailedEvents(maxRetries: number = 3): Promise<{ success: number; failed: number }> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_webhook_events')
        .select('*')
        .eq('processed', false)
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Events older than 5 minutes
        .limit(50);

      if (error) {
        console.error('WhatsApp Webhook: Error fetching failed events:', error);
        return { success: 0, failed: 0 };
      }

      let success = 0;
      let failed = 0;

      for (const event of data) {
        try {
          if (event.event_type === 'message_status') {
            await this.updateMessageStatus(event.whatsapp_message_id, event.status);
          } else if (event.event_type === 'message_received') {
            // Re-process incoming message if needed
            if (event.raw_data?.text?.body) {
              await this.whatsappService.handleIncomingMessage(
                event.phone_number,
                event.raw_data.text.body
              );
            }
          }

          await this.markWebhookEventProcessed(event.whatsapp_message_id);
          success++;
        } catch (retryError) {
          console.error(`WhatsApp Webhook: Retry failed for event ${event.id}:`, retryError);
          failed++;
        }
      }

      console.log(`WhatsApp Webhook: Retry completed - Success: ${success}, Failed: ${failed}`);
      return { success, failed };
    } catch (error) {
      console.error('WhatsApp Webhook: Error retrying failed events:', error);
      return { success: 0, failed: 0 };
    }
  }
}

export default WhatsAppWebhookHandler;