/**
 * Authkey.io WhatsApp Service
 * 
 * WhatsApp messaging service using Authkey.io API
 * This is a simpler alternative to Meta's direct WhatsApp Business API
 */

import Constants from 'expo-constants';

// Get API key from Expo config or environment
const getAuthkeyApiKey = (): string => {
    // Try Expo Constants first
    const extraConfig = Constants.expoConfig?.extra;
    if (extraConfig?.authkeyApiKey) {
        return extraConfig.authkeyApiKey;
    }

    // Try process.env (for Node.js scripts)
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AUTHKEY_API_KEY) {
        return process.env.EXPO_PUBLIC_AUTHKEY_API_KEY;
    }

    // Fallback to hardcoded key (for reliability during development)
    return '904251f34754cedc';
};

export interface AuthkeyConfig {
    authkey: string;
    defaultCountryCode: string;
}

export interface AuthkeySendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    response?: any;
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
    private authkey: string;
    private countryCode: string;
    private baseUrl: string = 'https://console.authkey.io/restapi';
    private isInitialized: boolean = false;

    constructor() {
        this.authkey = getAuthkeyApiKey();
        this.countryCode = '91'; // Default to India
        console.log('[AuthkeyWhatsApp] Service created, API key:', this.authkey ? 'configured' : 'missing');
    }

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        if (!this.authkey) {
            console.warn('Authkey.io API key not configured');
            return;
        }

        // Verify the API key by checking balance
        try {
            const balance = await this.getBalance();
            if (balance !== null) {
                this.isInitialized = true;
                console.log(`Authkey.io WhatsApp Service initialized. Balance: ₹${balance}`);
            }
        } catch (error) {
            console.error('Failed to initialize Authkey.io service:', error);
        }
    }

    /**
     * Check if service is available
     */
    isAvailable(): boolean {
        return this.isInitialized && !!this.authkey;
    }

    /**
     * Get account balance
     */
    async getBalance(): Promise<number | null> {
        try {
            const response = await fetch(
                `https://console.authkey.io/restapi/getbalance.php?authkey=${this.authkey}`
            );
            const data = await response.json();

            if (data.success) {
                return data.balance;
            }
            return null;
        } catch (error) {
            console.error('Error fetching Authkey balance:', error);
            return null;
        }
    }

    /**
     * Format phone number
     */
    private formatPhoneNumber(phone: string): string {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // Remove country code if present at start
        if (cleaned.startsWith('91') && cleaned.length > 10) {
            cleaned = cleaned.substring(2);
        }

        return cleaned;
    }

    /**
     * Send WhatsApp message using template
     */
    async sendTemplateMessage(
        phone: string,
        templateId: string,
        variables?: Record<string, string>,
        options?: {
            type?: 'text' | 'media';
            headerData?: string;
            headerFileName?: string;
        }
    ): Promise<AuthkeySendResult> {
        if (!this.isAvailable()) {
            return { success: false, error: 'Authkey.io service not available' };
        }

        try {
            const formattedPhone = this.formatPhoneNumber(phone);

            const payload: any = {
                country_code: this.countryCode,
                mobile: formattedPhone,
                wid: templateId,
                type: options?.type || 'text',
            };

            if (variables) {
                payload.bodyValues = variables;
            }

            if (options?.headerData) {
                payload.headerValues = {
                    headerFileName: options.headerFileName || 'file',
                    headerData: options.headerData,
                };
            }

            console.log('[AuthkeyWhatsApp] Sending to:', formattedPhone);
            console.log('[AuthkeyWhatsApp] Template ID:', templateId);
            console.log('[AuthkeyWhatsApp] Payload:', JSON.stringify(payload, null, 2));

            const response = await fetch(`${this.baseUrl}/requestjson.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.authkey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            console.log('[AuthkeyWhatsApp] Response:', JSON.stringify(data));

            if (data.Message === 'Submitted Successfully' || data.status === 'success') {
                return {
                    success: true,
                    messageId: data.msgid || data.requestId,
                    response: data,
                };
            } else {
                return {
                    success: false,
                    error: data.Message || data.error || 'Unknown error',
                    response: data,
                };
            }
        } catch (error) {
            console.error('Error sending Authkey WhatsApp message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Format items list smartly for WhatsApp
     * Shows all items if 3 or fewer, otherwise shows first 3 + count
     */
    private formatItemsList(items: Array<{ name: string; quantity: number; price?: number; unit?: string }>): string {
        const MAX_ITEMS_TO_SHOW = 3;

        if (items.length === 0) {
            return 'No items';
        }

        const formatItem = (item: { name: string; quantity: number; unit?: string }) => {
            const unit = item.unit ? ` ${item.unit}` : '';
            return `${item.name}${unit} x${item.quantity}`;
        };

        if (items.length <= MAX_ITEMS_TO_SHOW) {
            // Show all items with arrow separator
            return items.map(formatItem).join(' ➤ ');
        } else {
            // Show first 3 items + count of remaining
            const shownItems = items.slice(0, MAX_ITEMS_TO_SHOW).map(formatItem).join(' ➤ ');
            const remainingCount = items.length - MAX_ITEMS_TO_SHOW;
            return `${shownItems} (+${remainingCount} more)`;
        }
    }

    /**
     * Send seller order notification
     * Fetches template ID from database (NEW_ORDER_RECEIVED)
     */
    async sendSellerOrderNotification(
        sellerPhone: string,
        orderData: OrderNotificationData,
        templateId?: string // Optional - will fetch from DB if not provided
    ): Promise<AuthkeySendResult> {
        // Get template ID from database if not provided
        let actualTemplateId = templateId;
        if (!actualTemplateId) {
            try {
                // Dynamic import to avoid circular dependency
                const { getTemplateId } = await import('./WhatsAppTemplates');
                actualTemplateId = await getTemplateId('NEW_ORDER_RECEIVED') || undefined;
            } catch (error) {
                console.warn('[Authkey] Could not fetch template ID from database:', error);
            }
        }

        // Fallback to hardcoded ID if database fetch fails
        if (!actualTemplateId) {
            console.warn('[Authkey] Using fallback template ID');
            actualTemplateId = '24468';
        }

        // Format items list smartly
        const itemsList = this.formatItemsList(orderData.items);

        // Template variables for new_order_received template
        // {#1#} = Order #, {#2#} = Customer, {#3#} = Total, {#4#} = Items
        const variables: Record<string, string> = {
            '1': orderData.orderNumber,
            '2': orderData.customerName,
            '3': `₹${orderData.totalAmount.toLocaleString('en-IN')}`,
            '4': itemsList,
        };

        console.log(`[Authkey] Sending order notification to seller ${sellerPhone}`);
        console.log(`[Authkey] Template ID: ${actualTemplateId}, Order: ${orderData.orderNumber}`);

        return this.sendTemplateMessage(sellerPhone, actualTemplateId, variables);
    }

    /**
     * Send bulk messages (up to 200 recipients)
     */
    async sendBulkMessages(
        recipients: Array<{
            phone: string;
            variables?: Record<string, string>;
        }>,
        templateId: string,
        options?: { type?: 'text' | 'media' }
    ): Promise<AuthkeySendResult> {
        if (!this.isAvailable()) {
            return { success: false, error: 'Authkey.io service not available' };
        }

        if (recipients.length > 200) {
            return { success: false, error: 'Maximum 200 recipients allowed per request' };
        }

        try {
            const payload = {
                version: '2.0',
                country_code: this.countryCode,
                wid: templateId,
                type: options?.type || 'text',
                data: recipients.map(r => ({
                    mobile: this.formatPhoneNumber(r.phone),
                    ...(r.variables ? { bodyValues: r.variables } : {}),
                })),
            };

            const response = await fetch(`${this.baseUrl}/requestjson_v2.0.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.authkey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            return {
                success: data.status === 'success' || data.Message?.includes('Success'),
                response: data,
                error: data.error || data.Message,
            };
        } catch (error) {
            console.error('Error sending bulk WhatsApp messages:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}

// Export singleton instance
export const authkeyWhatsAppService = new AuthkeyWhatsAppService();
export default authkeyWhatsAppService;
