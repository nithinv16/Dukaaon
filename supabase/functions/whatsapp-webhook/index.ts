// Supabase Edge Function: WhatsApp Webhook Handler
// Receives incoming messages from Authkey.io and processes them

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for the webhook
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const authkeyApiKey = Deno.env.get('AUTHKEY_API_KEY') ?? '';

// Seller command patterns
const COMMAND_PATTERNS = {
    CONFIRM: /^(confirm|yes|ok|accept|हाँ|ठीक है|स्वीकार|✅)$/i,
    REJECT: /^(reject|no|cancel|decline|नहीं|रद्द|अस्वीकार|❌)(\s+(.+))?$/i,
    READY: /^(ready|prepared|तैयार|पैक हो गया)$/i,
    DELAY: /^(delay|late|देरी)(\s+(\d+)\s*(min|hour|hr|घंटे|मिनट)?)?$/i,
    OUT_OF_STOCK: /^(out of stock|oos|not available|stock out|उपलब्ध नहीं)(\s+(.+))?$/i,
    TRACK: /^(track|status|where|order status|कहाँ है|स्थिति)(\s+(.+))?$/i,
    REORDER: /^(reorder|repeat|same order|फिर से ऑर्डर)$/i,
    HELP: /^(help|commands|सहायता|मदद|\?)$/i,
    PAY: /^(pay|payment|भुगतान)$/i,
};

// Intent types
type MessageIntent =
    | 'confirm_order'
    | 'reject_order'
    | 'ready_for_pickup'
    | 'delay_delivery'
    | 'out_of_stock'
    | 'track_order'
    | 'reorder'
    | 'help'
    | 'payment'
    | 'ai_query' // For natural language queries
    | 'unknown';

interface ParsedMessage {
    intent: MessageIntent;
    confidence: number;
    orderNumber?: string;
    reason?: string;
    items?: string[];
    delayMinutes?: number;
}

// Parse incoming message to determine intent
function parseMessage(content: string): ParsedMessage {
    const trimmed = content.trim().toLowerCase();

    // Check for confirm
    if (COMMAND_PATTERNS.CONFIRM.test(trimmed)) {
        return { intent: 'confirm_order', confidence: 0.95 };
    }

    // Check for reject
    const rejectMatch = trimmed.match(COMMAND_PATTERNS.REJECT);
    if (rejectMatch) {
        return {
            intent: 'reject_order',
            confidence: 0.95,
            reason: rejectMatch[3] || 'No reason provided'
        };
    }

    // Check for ready
    if (COMMAND_PATTERNS.READY.test(trimmed)) {
        return { intent: 'ready_for_pickup', confidence: 0.95 };
    }

    // Check for delay
    const delayMatch = trimmed.match(COMMAND_PATTERNS.DELAY);
    if (delayMatch) {
        let minutes = 30; // Default 30 minutes
        if (delayMatch[3]) {
            const value = parseInt(delayMatch[3]);
            const unit = delayMatch[4];
            if (unit && (unit.includes('hour') || unit.includes('hr') || unit.includes('घंटे'))) {
                minutes = value * 60;
            } else {
                minutes = value;
            }
        }
        return {
            intent: 'delay_delivery',
            confidence: 0.9,
            delayMinutes: minutes
        };
    }

    // Check for out of stock
    const oosMatch = trimmed.match(COMMAND_PATTERNS.OUT_OF_STOCK);
    if (oosMatch) {
        return {
            intent: 'out_of_stock',
            confidence: 0.9,
            items: oosMatch[3] ? oosMatch[3].split(',').map(s => s.trim()) : []
        };
    }

    // Check for track
    const trackMatch = trimmed.match(COMMAND_PATTERNS.TRACK);
    if (trackMatch) {
        return {
            intent: 'track_order',
            confidence: 0.9,
            orderNumber: trackMatch[3]
        };
    }

    // Check for reorder
    if (COMMAND_PATTERNS.REORDER.test(trimmed)) {
        return { intent: 'reorder', confidence: 0.9 };
    }

    // Check for help
    if (COMMAND_PATTERNS.HELP.test(trimmed)) {
        return { intent: 'help', confidence: 0.95 };
    }

    // Check for payment
    if (COMMAND_PATTERNS.PAY.test(trimmed)) {
        return { intent: 'payment', confidence: 0.9 };
    }

    // If no pattern matches, it's likely a natural language query for AI
    // Check if it looks like a question or order
    if (trimmed.length > 5) {
        return { intent: 'ai_query', confidence: 0.7 };
    }

    return { intent: 'unknown', confidence: 0.5 };
}

// Get help message
function getHelpMessage(language: string = 'en'): string {
    if (language === 'hi') {
        return `🤖 *DukaaOn सहायता*

*विक्रेता कमांड:*
• CONFIRM - ऑर्डर स्वीकार करें
• REJECT [कारण] - ऑर्डर अस्वीकार करें
• READY - ऑर्डर तैयार
• DELAY [समय] - देरी की सूचना

*खरीदार कमांड:*
• TRACK - ऑर्डर स्थिति देखें
• REORDER - पिछला ऑर्डर दोहराएं
• PAY - भुगतान विकल्प

या कोई भी सवाल पूछें!`;
    }

    return `🤖 *DukaaOn Help*

*Seller Commands:*
• CONFIRM - Accept order
• REJECT [reason] - Decline order
• READY - Order is ready
• DELAY [time] - Notify delay

*Buyer Commands:*
• TRACK - Check order status
• REORDER - Repeat last order
• PAY - Payment options

Or ask any question in natural language!`;
}

// Main handler
serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse incoming webhook payload
        const payload = await req.json();
        console.log('Received webhook:', JSON.stringify(payload));

        // Extract message details from Authkey webhook format
        // Note: Adjust these field names based on actual Authkey webhook format
        const phoneNumber = payload.mobile || payload.from || payload.phone;
        const messageContent = payload.message || payload.text || payload.content || '';
        const messageId = payload.msgid || payload.message_id;
        const timestamp = payload.timestamp || new Date().toISOString();

        if (!phoneNumber || !messageContent) {
            console.error('Missing required fields:', { phoneNumber, messageContent });
            return new Response(
                JSON.stringify({ error: 'Missing phone number or message content' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Look up user by phone number
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('id, role, business_details, phone_number')
            .eq('phone_number', phoneNumber)
            .single();

        // Parse the message intent
        const parsedMessage = parseMessage(messageContent);
        console.log('Parsed message:', parsedMessage);

        // Store the incoming message
        const { data: storedMessage, error: storeError } = await supabase
            .from('whatsapp_messages')
            .insert({
                phone_number: phoneNumber,
                direction: 'inbound',
                message_type: 'text',
                content: messageContent,
                related_user_id: userProfile?.id,
                ai_intent: parsedMessage.intent,
                ai_confidence: parsedMessage.confidence,
                language: detectLanguage(messageContent),
                status: 'pending',
                authkey_message_id: messageId,
            })
            .select()
            .single();

        if (storeError) {
            console.error('Error storing message:', storeError);
        }

        // Get conversation context
        const { data: conversation } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

        // Process based on intent
        let responseMessage = '';
        let shouldUseAI = false;

        switch (parsedMessage.intent) {
            case 'confirm_order':
                responseMessage = await handleOrderConfirmation(
                    supabase,
                    phoneNumber,
                    userProfile,
                    conversation
                );
                break;

            case 'reject_order':
                responseMessage = await handleOrderRejection(
                    supabase,
                    phoneNumber,
                    userProfile,
                    parsedMessage.reason || 'No reason provided',
                    conversation
                );
                break;

            case 'ready_for_pickup':
                responseMessage = await handleOrderReady(
                    supabase,
                    phoneNumber,
                    userProfile,
                    conversation
                );
                break;

            case 'delay_delivery':
                responseMessage = await handleDeliveryDelay(
                    supabase,
                    phoneNumber,
                    userProfile,
                    parsedMessage.delayMinutes || 30,
                    conversation
                );
                break;

            case 'out_of_stock':
                responseMessage = await handleOutOfStock(
                    supabase,
                    phoneNumber,
                    userProfile,
                    parsedMessage.items || [],
                    conversation
                );
                break;

            case 'track_order':
                responseMessage = await handleTrackOrder(
                    supabase,
                    phoneNumber,
                    userProfile,
                    parsedMessage.orderNumber
                );
                break;

            case 'help':
                responseMessage = getHelpMessage(detectLanguage(messageContent));
                break;

            case 'ai_query':
                shouldUseAI = true;
                // AI processing will be handled separately
                responseMessage = 'Processing your request...';
                break;

            default:
                responseMessage = getHelpMessage(detectLanguage(messageContent));
        }

        // If AI processing is needed, call the AI endpoint
        if (shouldUseAI && userProfile) {
            try {
                const aiResponse = await processWithAI(
                    messageContent,
                    userProfile.id,
                    conversation?.context || {}
                );
                responseMessage = aiResponse;
            } catch (aiError) {
                console.error('AI processing error:', aiError);
                responseMessage = 'Sorry, I could not process your request. Please try again or type HELP for available commands.';
            }
        }

        // Send response via Authkey
        if (responseMessage) {
            await sendWhatsAppResponse(phoneNumber, responseMessage);

            // Store outbound message
            await supabase
                .from('whatsapp_messages')
                .insert({
                    phone_number: phoneNumber,
                    direction: 'outbound',
                    message_type: parsedMessage.intent === 'ai_query' ? 'ai_response' : 'text',
                    content: responseMessage,
                    related_user_id: userProfile?.id,
                    parent_message_id: storedMessage?.id,
                    status: 'sent',
                });
        }

        // Update message status to processed
        if (storedMessage) {
            await supabase
                .from('whatsapp_messages')
                .update({
                    status: 'processed',
                    processed_at: new Date().toISOString(),
                    ai_response: responseMessage,
                })
                .eq('id', storedMessage.id);
        }

        return new Response(
            JSON.stringify({
                success: true,
                intent: parsedMessage.intent,
                response_sent: !!responseMessage
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// Helper function to detect language
function detectLanguage(text: string): string {
    // Simple detection based on character ranges
    const hindiPattern = /[\u0900-\u097F]/;
    const kannadaPattern = /[\u0C80-\u0CFF]/;
    const tamilPattern = /[\u0B80-\u0BFF]/;
    const teluguPattern = /[\u0C00-\u0C7F]/;

    if (hindiPattern.test(text)) return 'hi';
    if (kannadaPattern.test(text)) return 'kn';
    if (tamilPattern.test(text)) return 'ta';
    if (teluguPattern.test(text)) return 'te';

    return 'en';
}

// Handler functions for different intents
async function handleOrderConfirmation(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    conversation: any
): Promise<string> {
    // Find pending order for this seller
    const { data: pendingOrder } = await supabase
        .from('orders')
        .select('id, order_number, user_id, total_amount, items')
        .eq('seller_id', userProfile?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!pendingOrder) {
        return '❌ No pending orders found to confirm. If you have a specific order number, please share it.';
    }

    // Update order status
    const { error: updateError } = await supabase
        .from('orders')
        .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString()
        })
        .eq('id', pendingOrder.id);

    if (updateError) {
        console.error('Error confirming order:', updateError);
        return '❌ Could not confirm order. Please try again or use the app.';
    }

    // Store the response action
    await supabase
        .from('whatsapp_order_responses')
        .insert({
            order_id: pendingOrder.id,
            seller_id: userProfile.id,
            phone_number: phoneNumber,
            action: 'confirm',
            processed: true,
            processed_at: new Date().toISOString()
        });

    // TODO: Send notification to retailer

    return `✅ Order #${pendingOrder.order_number} confirmed!\n\nThe customer will be notified. Please prepare the order for delivery.`;
}

async function handleOrderRejection(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    reason: string,
    conversation: any
): Promise<string> {
    const { data: pendingOrder } = await supabase
        .from('orders')
        .select('id, order_number, user_id')
        .eq('seller_id', userProfile?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!pendingOrder) {
        return '❌ No pending orders found to reject.';
    }

    const { error: updateError } = await supabase
        .from('orders')
        .update({
            status: 'rejected',
            rejection_reason: reason,
            rejected_at: new Date().toISOString()
        })
        .eq('id', pendingOrder.id);

    if (updateError) {
        return '❌ Could not reject order. Please try again.';
    }

    await supabase
        .from('whatsapp_order_responses')
        .insert({
            order_id: pendingOrder.id,
            seller_id: userProfile.id,
            phone_number: phoneNumber,
            action: 'reject',
            reason: reason,
            processed: true,
            processed_at: new Date().toISOString()
        });

    return `❌ Order #${pendingOrder.order_number} rejected.\nReason: ${reason}\n\nThe customer will be notified.`;
}

async function handleOrderReady(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    conversation: any
): Promise<string> {
    const { data: confirmedOrder } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('seller_id', userProfile?.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!confirmedOrder) {
        return '❌ No confirmed orders found to mark as ready.';
    }

    await supabase
        .from('orders')
        .update({
            status: 'ready_for_pickup',
            ready_at: new Date().toISOString()
        })
        .eq('id', confirmedOrder.id);

    await supabase
        .from('whatsapp_order_responses')
        .insert({
            order_id: confirmedOrder.id,
            seller_id: userProfile.id,
            phone_number: phoneNumber,
            action: 'ready',
            processed: true,
            processed_at: new Date().toISOString()
        });

    return `📦 Order #${confirmedOrder.order_number} marked as ready for pickup!\n\nDelivery partner will be assigned soon.`;
}

async function handleDeliveryDelay(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    delayMinutes: number,
    conversation: any
): Promise<string> {
    const { data: activeOrder } = await supabase
        .from('orders')
        .select('id, order_number, estimated_delivery')
        .eq('seller_id', userProfile?.id)
        .in('status', ['confirmed', 'ready_for_pickup', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!activeOrder) {
        return '❌ No active orders found to update.';
    }

    const newEta = new Date();
    newEta.setMinutes(newEta.getMinutes() + delayMinutes);

    await supabase
        .from('orders')
        .update({
            estimated_delivery: newEta.toISOString()
        })
        .eq('id', activeOrder.id);

    await supabase
        .from('whatsapp_order_responses')
        .insert({
            order_id: activeOrder.id,
            seller_id: userProfile.id,
            phone_number: phoneNumber,
            action: 'delay',
            new_eta: newEta.toISOString(),
            processed: true,
            processed_at: new Date().toISOString()
        });

    const etaStr = newEta.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `⏰ Order #${activeOrder.order_number} delivery delayed.\n\nNew ETA: ${etaStr}\n\nThe customer will be notified.`;
}

async function handleOutOfStock(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    items: string[],
    conversation: any
): Promise<string> {
    const { data: pendingOrder } = await supabase
        .from('orders')
        .select('id, order_number, items')
        .eq('seller_id', userProfile?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!pendingOrder) {
        return '❌ No pending orders found.';
    }

    await supabase
        .from('whatsapp_order_responses')
        .insert({
            order_id: pendingOrder.id,
            seller_id: userProfile.id,
            phone_number: phoneNumber,
            action: 'out_of_stock',
            items_affected: items,
            processed: false // Needs review
        });

    if (items.length === 0) {
        return `⚠️ Please specify which items are out of stock.\n\nExample: "out of stock Rice 25kg, Sugar 10kg"`;
    }

    return `📝 Noted: ${items.join(', ')} marked as out of stock for Order #${pendingOrder.order_number}.\n\nWe'll notify the customer about available alternatives.`;
}

async function handleTrackOrder(
    supabase: any,
    phoneNumber: string,
    userProfile: any,
    orderNumber?: string
): Promise<string> {
    let query = supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at, estimated_delivery')
        .eq('user_id', userProfile?.id)
        .order('created_at', { ascending: false });

    if (orderNumber) {
        query = query.eq('order_number', orderNumber);
    }

    const { data: orders } = await query.limit(3);

    if (!orders || orders.length === 0) {
        return '📦 No recent orders found.\n\nPlace an order through the DukaaOn app or simply tell me what you need!';
    }

    const statusEmojis: Record<string, string> = {
        pending: '⏳',
        confirmed: '✅',
        ready_for_pickup: '📦',
        in_transit: '🚚',
        delivered: '✔️',
        cancelled: '❌',
        rejected: '❌',
    };

    const orderLines = orders.map((o: any) => {
        const emoji = statusEmojis[o.status] || '📋';
        return `${emoji} #${o.order_number}\nStatus: ${o.status.replace(/_/g, ' ')}\nAmount: ₹${o.total_amount}`;
    });

    return `📦 *Your Recent Orders*\n\n${orderLines.join('\n\n')}`;
}

// Send response via Authkey
async function sendWhatsAppResponse(phoneNumber: string, message: string): Promise<void> {
    try {
        const response = await fetch('https://console.authkey.io/restapi/requestjson.php', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authkeyApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                country_code: '91',
                mobile: phoneNumber.replace(/^\+?91/, ''),
                message: message,
                type: 'text',
            }),
        });

        const result = await response.json();
        console.log('Authkey response:', result);
    } catch (error) {
        console.error('Error sending WhatsApp response:', error);
    }
}

// Process message with AI (placeholder - will integrate with Bedrock)
async function processWithAI(
    message: string,
    userId: string,
    context: any
): Promise<string> {
    // TODO: Integrate with existing BedrockAIService
    // For now, return a placeholder response
    return `I understand you're asking about: "${message}"\n\nThis feature is coming soon! For now, please use the DukaaOn app or type HELP for available commands.`;
}
