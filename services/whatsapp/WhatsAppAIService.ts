/**
 * WhatsApp AI Service
 * 
 * Integrates with existing BedrockAIService for natural language processing
 * Formats responses for WhatsApp (shorter, no markdown, mobile-friendly)
 */

import { bedrockAIService } from '../aiAgent/bedrockAIService';
import { authkeyWhatsAppService, OrderNotificationData } from './AuthkeyWhatsAppService';
import { TEMPLATE_KEYS, TEMPLATE_IDS, getTemplateId, formatTemplateVariables } from './WhatsAppTemplates';
import { supabase } from '../supabase/supabase';

// WhatsApp-specific system prompt additions
const WHATSAPP_SYSTEM_PROMPT = `
You are DukaaOn's WhatsApp assistant. Keep responses short and mobile-friendly:
- Maximum 300 characters per response when possible
- No markdown formatting (no *, #, -, etc.)
- Use emojis sparingly for visual clarity
- Be direct and helpful
- Support Hindi, Kannada, Tamil, and Telugu
- For orders, provide clear next steps
- For support, be empathetic and provide solutions

Available actions you can take:
- Place orders for the user
- Check order status
- Find products and prices
- Answer questions about sellers
- Handle complaints and create tickets
`;

// Conversation context for multi-turn interactions
interface ConversationContext {
    userId: string;
    phoneNumber: string;
    language: string;
    role: 'retailer' | 'wholesaler' | 'manufacturer';
    lastIntent?: string;
    pendingOrderItems?: any[];
    pendingOrderSeller?: string;
    recentOrders?: any[];
    userLocation?: { lat: number; lng: number };
}

export class WhatsAppAIService {
    private static instance: WhatsAppAIService;

    static getInstance(): WhatsAppAIService {
        if (!this.instance) {
            this.instance = new WhatsAppAIService();
        }
        return this.instance;
    }

    /**
     * Process a WhatsApp message using Bedrock AI
     */
    async processMessage(
        message: string,
        userId: string,
        context: Partial<ConversationContext> = {}
    ): Promise<string> {
        try {
            console.log('[WhatsAppAI] Processing message:', message);
            console.log('[WhatsAppAI] User ID:', userId);
            console.log('[WhatsAppAI] Context:', context);

            // Get user profile for context
            const userProfile = await this.getUserProfile(userId);

            // Build conversation context
            const fullContext: ConversationContext = {
                userId,
                phoneNumber: context.phoneNumber || userProfile?.phone_number || '',
                language: context.language || 'en',
                role: userProfile?.role || 'retailer',
                ...context,
            };

            // Add WhatsApp-specific instructions to the prompt
            const enhancedMessage = this.buildEnhancedPrompt(message, fullContext);

            // Call Bedrock AI using the chat method with proper AIMessage format
            const aiResponse = await bedrockAIService.chat(
                [
                    {
                        role: 'user',
                        content: enhancedMessage,
                        timestamp: new Date(),
                    }
                ],
                userId,
                undefined, // conversationId
                false, // useStreaming
                fullContext.language // appLanguage
            );

            // Format response for WhatsApp
            const formattedResponse = this.formatForWhatsApp(aiResponse.content || '', fullContext.language);

            // Store the interaction
            await this.storeInteraction(message, formattedResponse, fullContext);

            return formattedResponse;
        } catch (error) {
            console.error('[WhatsAppAI] Error processing message:', error);
            return this.getErrorResponse(context.language || 'en');
        }
    }

    /**
     * Handle specific order actions via WhatsApp
     */
    async handleOrderAction(
        action: 'confirm' | 'reject' | 'ready' | 'delay' | 'cancel',
        orderId: string,
        userId: string,
        additionalData?: any
    ): Promise<{ success: boolean; message: string }> {
        try {
            const { data: order, error } = await supabase
                .from('orders')
                .select('*, profiles!orders_user_id_fkey(phone_number, business_details)')
                .eq('id', orderId)
                .single();

            if (error || !order) {
                return { success: false, message: 'Order not found' };
            }

            let updateData: any = {};
            let notifyCustomer = true;
            let templateId = '';
            let templateVariables: Record<string, string> = {};

            switch (action) {
                case 'confirm':
                    updateData = { status: 'confirmed', confirmed_at: new Date().toISOString() };
                    templateId = TEMPLATE_IDS.ORDER_CONFIRMED;
                    templateVariables = {
                        '1': order.profiles?.business_details?.shopName || 'Customer',
                        '2': order.order_number,
                        '3': 'Seller', // TODO: Get seller name
                        '4': '30-60 minutes',
                    };
                    break;

                case 'reject':
                    updateData = {
                        status: 'rejected',
                        rejected_at: new Date().toISOString(),
                        rejection_reason: additionalData?.reason || 'Order could not be fulfilled'
                    };
                    templateId = TEMPLATE_IDS.ORDER_REJECTED;
                    break;

                case 'ready':
                    updateData = { status: 'ready_for_pickup', ready_at: new Date().toISOString() };
                    templateId = TEMPLATE_IDS.ORDER_READY_FOR_PICKUP;
                    break;

                case 'delay':
                    const newEta = new Date();
                    newEta.setMinutes(newEta.getMinutes() + (additionalData?.minutes || 30));
                    updateData = { estimated_delivery: newEta.toISOString() };
                    templateId = TEMPLATE_IDS.DELIVERY_DELAYED;
                    break;

                case 'cancel':
                    updateData = { status: 'cancelled', cancelled_at: new Date().toISOString() };
                    templateId = TEMPLATE_IDS.ORDER_CANCELLED_BY_SELLER;
                    break;
            }

            // Update order
            const { error: updateError } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId);

            if (updateError) {
                return { success: false, message: 'Failed to update order' };
            }

            // Notify customer if template is available
            if (notifyCustomer && templateId && order.profiles?.phone_number) {
                try {
                    await authkeyWhatsAppService.sendTemplateMessage(
                        order.profiles.phone_number,
                        templateId,
                        templateVariables
                    );
                } catch (notifyError) {
                    console.warn('[WhatsAppAI] Failed to notify customer:', notifyError);
                }
            }

            const actionMessages: Record<string, string> = {
                confirm: `Order #${order.order_number} confirmed! Customer notified.`,
                reject: `Order #${order.order_number} rejected. Customer notified.`,
                ready: `Order #${order.order_number} marked as ready for pickup.`,
                delay: `Order #${order.order_number} delivery time updated.`,
                cancel: `Order #${order.order_number} cancelled.`,
            };

            return { success: true, message: actionMessages[action] };
        } catch (error) {
            console.error('[WhatsAppAI] Error handling order action:', error);
            return { success: false, message: 'An error occurred' };
        }
    }

    /**
     * Place an order via WhatsApp AI
     */
    async placeOrderViaWhatsApp(
        userId: string,
        items: Array<{ productId: string; quantity: number }>,
        sellerId: string
    ): Promise<{ success: boolean; orderId?: string; message: string }> {
        try {
            // Get product details
            const productIds = items.map(i => i.productId);
            const { data: products } = await supabase
                .from('products')
                .select('id, name, price, unit, seller_id')
                .in('id', productIds);

            if (!products || products.length === 0) {
                return { success: false, message: 'Products not found' };
            }

            // Build order items
            const orderItems = items.map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                    product_id: item.productId,
                    name: product?.name || 'Unknown Product',
                    price: product?.price || 0,
                    quantity: item.quantity,
                    unit: product?.unit || 'pcs',
                };
            });

            const totalAmount = orderItems.reduce(
                (sum, item) => sum + (item.price * item.quantity),
                0
            );

            // Create order
            const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

            const { data: newOrder, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    seller_id: sellerId,
                    order_number: orderNumber,
                    items: orderItems,
                    total_amount: totalAmount,
                    status: 'pending',
                    payment_method: 'cod',
                    created_via: 'whatsapp',
                })
                .select()
                .single();

            if (orderError || !newOrder) {
                return { success: false, message: 'Failed to create order' };
            }

            // Get seller phone and notify
            const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('phone_number, business_details')
                .eq('id', sellerId)
                .single();

            if (sellerProfile?.phone_number) {
                const itemsList = orderItems.map(i => `${i.name} x${i.quantity}`).join(', ');

                await authkeyWhatsAppService.sendSellerOrderNotification(
                    sellerProfile.phone_number,
                    {
                        orderNumber: orderNumber,
                        customerName: 'Customer', // TODO: Get customer name
                        items: orderItems,
                        totalAmount: totalAmount,
                    }
                );
            }

            return {
                success: true,
                orderId: newOrder.id,
                message: `Order #${orderNumber} placed!\n\nItems: ${orderItems.map(i => `${i.name} x${i.quantity}`).join(', ')}\nTotal: ₹${totalAmount}\n\nWe'll notify you when confirmed!`,
            };
        } catch (error) {
            console.error('[WhatsAppAI] Error placing order:', error);
            return { success: false, message: 'Failed to place order. Please try again.' };
        }
    }

    /**
     * Send reorder reminder to user
     */
    async sendReorderReminder(
        userId: string,
        phoneNumber: string,
        lastOrderItems: string[],
        daysSinceOrder: number
    ): Promise<boolean> {
        try {
            const templateId = await getTemplateId('REORDER_REMINDER');
            if (!templateId) {
                console.warn('[WhatsAppAI] Reorder reminder template not configured');
                return false;
            }

            await authkeyWhatsAppService.sendTemplateMessage(
                phoneNumber,
                templateId,
                {
                    '1': lastOrderItems.slice(0, 3).join(', '),
                    '2': daysSinceOrder.toString(),
                    '3': 'Reply REORDER to repeat your last order',
                    '4': '', // Quick order link placeholder
                }
            );

            return true;
        } catch (error) {
            console.error('[WhatsAppAI] Error sending reorder reminder:', error);
            return false;
        }
    }

    // Private helper methods

    private async getUserProfile(userId: string): Promise<any> {
        const { data } = await supabase
            .from('profiles')
            .select('id, phone_number, role, business_details, latitude, longitude')
            .eq('id', userId)
            .single();
        return data;
    }

    private buildEnhancedPrompt(message: string, context: ConversationContext): string {
        let enhancedPrompt = `[WhatsApp Message from ${context.role}]\n`;
        enhancedPrompt += `Language: ${context.language}\n`;

        if (context.pendingOrderItems) {
            enhancedPrompt += `Pending order items: ${JSON.stringify(context.pendingOrderItems)}\n`;
        }

        enhancedPrompt += `\nUser message: ${message}\n\n`;
        enhancedPrompt += WHATSAPP_SYSTEM_PROMPT;

        return enhancedPrompt;
    }

    private formatForWhatsApp(response: string, language: string): string {
        // Remove markdown formatting
        let formatted = response
            .replace(/\*\*/g, '') // Remove bold **text**
            .replace(/\*/g, '')   // Remove italic *text*
            .replace(/#{1,6}\s?/g, '') // Remove headers
            .replace(/`/g, '')    // Remove code backticks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace [text](url) with just text
            .replace(/-{3,}/g, '') // Remove horizontal rules
            .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines

        // Truncate if too long for WhatsApp
        if (formatted.length > 1000) {
            formatted = formatted.substring(0, 997) + '...';
        }

        return formatted.trim();
    }

    private async storeInteraction(
        userMessage: string,
        aiResponse: string,
        context: ConversationContext
    ): Promise<void> {
        try {
            await supabase
                .from('whatsapp_messages')
                .insert({
                    phone_number: context.phoneNumber,
                    direction: 'inbound',
                    message_type: 'ai_response',
                    content: userMessage,
                    related_user_id: context.userId,
                    ai_response: aiResponse,
                    language: context.language,
                    status: 'processed',
                    processed_at: new Date().toISOString(),
                });
        } catch (error) {
            console.error('[WhatsAppAI] Error storing interaction:', error);
        }
    }

    private getErrorResponse(language: string): string {
        const errorMessages: Record<string, string> = {
            en: 'Sorry, I could not process your request. Please try again or type HELP for commands.',
            hi: 'क्षमा करें, मैं आपका अनुरोध संसाधित नहीं कर सका। कृपया पुनः प्रयास करें या HELP टाइप करें।',
            kn: 'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
            ta: 'மன்னிக்கவும், உங்கள் கோரிக்கையை செயலாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
            te: 'క్షమించండి, మీ అభ్యర్థనను ప్రాసెస్ చేయలేకపోయాను. మళ్ళీ ప్రయత్నించండి.',
        };
        return errorMessages[language] || errorMessages.en;
    }
}

// Export singleton instance
export const whatsAppAIService = WhatsAppAIService.getInstance();
export default whatsAppAIService;
