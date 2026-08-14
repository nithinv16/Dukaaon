/**
 * Order notification client — WhatsApp via the `notify-order-whatsapp` edge function.
 *
 * This module used to talk to console.authkey.io directly, using an API key read
 * from `Constants.expoConfig.extra.authkeyApiKey` / `EXPO_PUBLIC_AUTHKEY_API_KEY`
 * with a live key hardcoded as a final fallback. Two problems:
 *
 *   1. The key was inlined into the JS bundle and recoverable from any shipped
 *      APK, so anyone could send WhatsApp messages billed to this account.
 *   2. The client chose the recipient phone number and the message variables.
 *      Even with the key proxied, that would let any authenticated user send
 *      template messages to arbitrary numbers under our sender identity.
 *
 * The edge function therefore takes only an order id, checks the caller owns it
 * under RLS, and derives recipients and content from the database. Nothing here
 * decides who gets messaged.
 */

import { supabase } from '../supabase/supabase';

export interface AuthkeySendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  response?: any;
}

/** Per-seller outcome, so callers can fall back for the ones that failed. */
export interface OrderNotificationResult {
  sent: number;
  failed: number;
  results: Array<{ seller_id: string; success: boolean; error?: string }>;
}

export interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{ name: string; quantity: number; price?: number; unit?: string }>;
  totalAmount: number;
  deliveryAddress?: string;
  paymentMethod?: string;
}

export class AuthkeyWhatsAppService {
  /**
   * Notify every seller on an order.
   *
   * One request per order rather than one per seller: the function fans out
   * server-side, where it already has the seller list.
   */
  async notifyOrderSellers(params: {
    masterOrderId?: string;
    orderId?: string;
  }): Promise<OrderNotificationResult> {
    const { masterOrderId, orderId } = params;

    if (!masterOrderId && !orderId) {
      return { sent: 0, failed: 0, results: [] };
    }

    return this.sendOrderNotification(
      masterOrderId
        ? { master_order_id: masterOrderId, kind: 'new_order' }
        : { order_id: orderId!, kind: 'new_order' }
    );
  }

  /**
   * Tell a seller their order was cancelled by the buyer.
   *
   * Takes only the order id: the function resolves the seller, the order number,
   * the buyer name and the payment status itself. The previous implementation
   * passed the seller's phone number and all five template variables from the
   * device, so a modified client could have sent this template to any number.
   */
  async notifyOrderCancelledByRetailer(orderId: string): Promise<OrderNotificationResult> {
    return this.sendOrderNotification({ order_id: orderId, kind: 'cancelled_by_retailer' });
  }

  private async sendOrderNotification(body: Record<string, string>): Promise<OrderNotificationResult> {
    const { data, error } = await supabase.functions.invoke('notify-order-whatsapp', { body });

    if (error) {
      // Notifications are best-effort and must never fail the action that
      // triggered them.
      console.warn('[WhatsApp] notify-order-whatsapp failed:', error.message);
      return { sent: 0, failed: 0, results: [] };
    }

    return {
      sent: data?.sent ?? 0,
      failed: data?.failed ?? 0,
      results: Array.isArray(data?.results) ? data.results : [],
    };
  }

  /**
   * Retained for compatibility with existing call sites.
   *
   * Always true: there is no client-side credential to check any more, and the
   * function reports its own configuration problems per request.
   */
  isAvailable(): boolean {
    return true;
  }

  /** No-op. Kept so existing `await initialize()` calls keep working. */
  async initialize(): Promise<void> {
    // Nothing to initialise: credentials and template lookup are server-side.
  }
}

export const authkeyWhatsAppService = new AuthkeyWhatsAppService();
export default authkeyWhatsAppService;
