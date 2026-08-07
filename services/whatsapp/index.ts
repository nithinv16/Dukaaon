/**
 * WhatsApp Services Index
 * 
 * Exports all WhatsApp-related services for easy importing
 */

// Main Authkey WhatsApp Service
export {
    authkeyWhatsAppService,
    AuthkeyWhatsAppService,
    type AuthkeyConfig,
    type AuthkeySendResult,
    type OrderNotificationData,
} from './AuthkeyWhatsAppService';

// Template configurations (Database-driven!)
export {
    TEMPLATE_KEYS,
    TEMPLATE_IDS,
    loadTemplateConfigs,
    getTemplateConfig,
    getTemplateId,
    isTemplateAvailable,
    getTemplatesForEvent,
    getTemplatesByCategory,
    canSendTemplate,
    recordTemplateSend,
    updateTemplateId,
    formatTemplateVariables,
    type TemplateKey,
    type TemplateCategory,
    type TemplateConfig,
} from './WhatsAppTemplates';

// AI-powered WhatsApp Service
export {
    whatsAppAIService,
    WhatsAppAIService,
} from './WhatsAppAIService';

// ============================================================================
// High-level notification functions
// ============================================================================

import { authkeyWhatsAppService } from './AuthkeyWhatsAppService';
import {
    getTemplateId,
    formatTemplateVariables,
    canSendTemplate,
    recordTemplateSend,
    TEMPLATE_KEYS
} from './WhatsAppTemplates';

/**
 * Send a notification using database-configured template
 * This is the recommended way to send WhatsApp notifications
 */
export async function sendTemplateNotification(
    templateKey: string,
    phoneNumber: string,
    data: Record<string, any>,
    options?: {
        userId?: string;
        orderId?: string;
        language?: string;
        skipRateLimit?: boolean;
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check rate limit
        if (!options?.skipRateLimit) {
            const canSend = await canSendTemplate(phoneNumber, templateKey);
            if (!canSend) {
                return { success: false, error: 'Rate limit exceeded' };
            }
        }

        // Auto-initialize service if needed
        if (!authkeyWhatsAppService.isAvailable()) {
            console.log('[WhatsApp] Auto-initializing service...');
            await authkeyWhatsAppService.initialize();
        }

        // Get template ID from database
        const templateId = await getTemplateId(templateKey);
        if (!templateId) {
            console.warn(`[WhatsApp] Template ${templateKey} not configured in database`);
            return { success: false, error: 'Template not configured' };
        }

        // Format variables
        const variables = await formatTemplateVariables(templateKey, data);
        if (!variables) {
            return { success: false, error: 'Failed to format variables' };
        }

        // Send via Authkey
        const result = await authkeyWhatsAppService.sendTemplateMessage(
            phoneNumber,
            templateId,
            variables
        );

        // Record the send
        await recordTemplateSend(
            templateKey,
            phoneNumber,
            options?.userId,
            options?.orderId,
            variables,
            options?.language || 'en',
            result
        );

        return result;
    } catch (error: any) {
        console.error(`[WhatsApp] Error sending ${templateKey}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Convenience function: Send order confirmed notification
 */
export async function sendOrderConfirmedNotification(
    phoneNumber: string,
    data: {
        customerName: string;
        orderNumber: string;
        sellerName: string;
        eta: string;
    },
    options?: { userId?: string; orderId?: string }
): Promise<boolean> {
    const result = await sendTemplateNotification(
        TEMPLATE_KEYS.ORDER_CONFIRMED,
        phoneNumber,
        data,
        options
    );
    return result.success;
}

/**
 * Convenience function: Send payment reminder notification
 */
export async function sendPaymentReminderNotification(
    phoneNumber: string,
    data: {
        customerName: string;
        amount: number;
        dueDate: string;
        daysLeft: number;
    },
    options?: { userId?: string; orderId?: string }
): Promise<boolean> {
    const result = await sendTemplateNotification(
        TEMPLATE_KEYS.PAYMENT_REMINDER,
        phoneNumber,
        data,
        options
    );
    return result.success;
}

/**
 * Convenience function: Send delivery update notification
 */
export async function sendDeliveryUpdateNotification(
    phoneNumber: string,
    status: 'assigned' | 'started' | 'arriving' | 'completed' | 'delayed',
    data: {
        orderNumber: string;
        driverName?: string;
        driverPhone?: string;
        eta?: string;
        minutesAway?: number;
        reason?: string;
    },
    options?: { userId?: string; orderId?: string }
): Promise<boolean> {
    const templateMap: Record<string, string> = {
        assigned: TEMPLATE_KEYS.DELIVERY_ASSIGNED,
        started: TEMPLATE_KEYS.DELIVERY_STARTED,
        arriving: TEMPLATE_KEYS.DELIVERY_ARRIVING,
        completed: TEMPLATE_KEYS.DELIVERY_COMPLETED,
        delayed: TEMPLATE_KEYS.DELIVERY_DELAYED,
    };

    const templateKey = templateMap[status];
    if (!templateKey) {
        console.warn(`[WhatsApp] Unknown delivery status: ${status}`);
        return false;
    }

    const result = await sendTemplateNotification(templateKey, phoneNumber, data, options);
    return result.success;
}

/**
 * Convenience function: Send reorder reminder
 */
export async function sendReorderReminder(
    phoneNumber: string,
    data: {
        productList: string[] | string;
        lastOrderDate: string;
        daysSinceOrder?: number;
    },
    options?: { userId?: string }
): Promise<boolean> {
    const result = await sendTemplateNotification(
        TEMPLATE_KEYS.REORDER_REMINDER,
        phoneNumber,
        {
            ...data,
            productList: Array.isArray(data.productList)
                ? data.productList.slice(0, 3).join(', ')
                : data.productList,
            message: 'Reply REORDER to repeat your last order',
            link: ''
        },
        options
    );
    return result.success;
}
