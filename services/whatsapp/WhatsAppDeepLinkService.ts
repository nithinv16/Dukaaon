/**
 * WhatsApp Deep Link Service
 * 
 * A simple alternative to WhatsApp Business API that opens WhatsApp with a pre-filled message.
 * This can be used as a fallback when the Business API is not configured.
 */

import { Linking, Platform } from 'react-native';

export interface OrderDetails {
    orderNumber: string;
    retailerName: string;
    retailerPhone?: string;
    items: Array<{ name: string; quantity: number; price?: number; unit?: string }>;
    totalAmount: number;
    deliveryAddress?: string;
    paymentMethod?: string;
}

export class WhatsAppDeepLinkService {
    /**
     * Format phone number for WhatsApp URL
     */
    private static formatPhoneNumber(phone: string): string {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // Add country code if not present (assuming India +91)
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }

        return cleaned;
    }

    /**
     * Format order message for seller
     */
    static formatSellerOrderMessage(orderDetails: OrderDetails): string {
        const itemsList = orderDetails.items.map(item => {
            const priceText = item.price ? ` - ₹${item.price}` : '';
            const unitText = item.unit ? `/${item.unit}` : '';
            return `• ${item.name} (Qty: ${item.quantity}${unitText})${priceText}`;
        }).join('\n');

        let message = `🛒 *New Order Received - DukaaOn*\n\n`;
        message += `📋 Order #${orderDetails.orderNumber}\n`;
        message += `👤 Customer: *${orderDetails.retailerName}*\n`;

        if (orderDetails.retailerPhone) {
            message += `📞 Phone: ${orderDetails.retailerPhone}\n`;
        }

        message += `💰 Total Amount: *₹${orderDetails.totalAmount.toLocaleString('en-IN')}*\n`;

        if (orderDetails.paymentMethod) {
            message += `💳 Payment: ${orderDetails.paymentMethod.toUpperCase()}\n`;
        }

        message += `\n📦 *Order Items:*\n${itemsList}\n`;

        if (orderDetails.deliveryAddress) {
            message += `\n📍 *Delivery Address:*\n${orderDetails.deliveryAddress}\n`;
        }

        message += `\n✅ Please confirm and prepare this order.\n`;
        message += `\n📱 View details in the DukaaOn Seller App`;

        return message;
    }

    /**
     * Open WhatsApp with pre-filled message to seller
     */
    static async sendToSeller(
        sellerPhone: string,
        orderDetails: OrderDetails
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const formattedPhone = this.formatPhoneNumber(sellerPhone);
            const message = this.formatSellerOrderMessage(orderDetails);
            const encodedMessage = encodeURIComponent(message);

            // Use WhatsApp URL scheme
            const whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedMessage}`;
            const webUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

            // Check if WhatsApp is installed
            const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

            if (canOpenWhatsApp) {
                await Linking.openURL(whatsappUrl);
                return { success: true };
            } else {
                // Fallback to web URL
                await Linking.openURL(webUrl);
                return { success: true };
            }
        } catch (error) {
            console.error('Error opening WhatsApp:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to open WhatsApp'
            };
        }
    }

    /**
     * Generate WhatsApp share URL (for web or external use)
     */
    static generateShareUrl(
        sellerPhone: string,
        orderDetails: OrderDetails
    ): string {
        const formattedPhone = this.formatPhoneNumber(sellerPhone);
        const message = this.formatSellerOrderMessage(orderDetails);
        const encodedMessage = encodeURIComponent(message);

        return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    }

    /**
     * Check if WhatsApp is available on device
     */
    static async isWhatsAppAvailable(): Promise<boolean> {
        try {
            return await Linking.canOpenURL('whatsapp://send');
        } catch {
            return false;
        }
    }
}

export default WhatsAppDeepLinkService;
