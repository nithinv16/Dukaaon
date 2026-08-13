/**
 * AI Order Placement Service
 * Direct order placement for AI-based orders, matching the checkout flow exactly
 */

import { supabase } from './supabase/supabase';

interface OrderItem {
    product_id: string;
    name: string;
    price: string; // Price as string, matching cart store format
    quantity: number;
    unit?: string;
    seller_id: string;
    image_url?: string;
}

interface PlaceOrderParams {
    userId: string;
    items: OrderItem[];
    sellerId: string;
    totalAmount: number;
    deliveryFee?: number;
    paymentMethod?: string;
}

interface PlaceOrderResult {
    success: boolean;
    orderId?: string;
    orderNumber?: string;
    error?: string;
}

/**
 * Generate a unique order number
 */
const generateOrderNumber = (): string => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
};

/**
 * Place an order exactly like the checkout screen does
 * This bypasses any complex order processing and directly inserts into orders table
 */
export const placeAIOrder = async (params: PlaceOrderParams): Promise<PlaceOrderResult> => {
    const { userId, items, sellerId, totalAmount, deliveryFee = 0, paymentMethod = 'cod' } = params;

    try {
        const orderNumber = generateOrderNumber();

        // Insert order exactly like checkout screen (line 45-58 of checkout/index.tsx)
        // Note: total_amount should be subtotal only (delivery_fee is separate)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                order_number: orderNumber,
                user_id: userId,
                seller_id: sellerId, // Required field
                items: items, // Items as JSON array, exactly like cart items
                total_amount: totalAmount, // Store subtotal only (without delivery fee)
                delivery_fee: deliveryFee, // Explicitly include delivery fee
                status: 'pending',
                payment_status: 'pending',
                payment_method: paymentMethod,
                seller_ids: [sellerId]
            })
            .select()
            .single();

        if (orderError) {
            console.error('[placeAIOrder] Error inserting order:', orderError);
            return { success: false, error: orderError.message };
        }

        // Notify sellers (optional, matching checkout behavior)
        try {
            await supabase
                .from('seller_notifications')
                .insert({
                    seller_id: sellerId,
                    type: 'new_order',
                    order_id: order.id,
                    message: `New order received: ${orderNumber}`,
                    status: 'unread'
                });
        } catch (notifError) {
            console.warn('[placeAIOrder] Could not send seller notification:', notifError);
        }

        // For COD, order stays as pending until seller confirms
        // No status update needed - order already has status: 'pending'

        return {
            success: true,
            orderId: order.id,
            orderNumber: orderNumber
        };

    } catch (error) {
        console.error('[placeAIOrder] Unexpected error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
};

/**
 * Place multiple orders for different sellers
 */
export const placeMultiSellerAIOrder = async (
    userId: string,
    ordersBySeller: Record<string, { items: any[]; total_amount: number; delivery_fee?: number }>
): Promise<{ success: boolean; orders: PlaceOrderResult[]; error?: string }> => {
    const results: PlaceOrderResult[] = [];

    for (const [sellerId, orderData] of Object.entries(ordersBySeller)) {
        // Format items exactly like cart items
        const formattedItems: OrderItem[] = orderData.items.map(item => ({
            product_id: item.product_id,
            name: item.name,
            price: String(item.unit_price || item.price), // Ensure price is string
            quantity: item.quantity,
            unit: item.unit || 'unit',
            seller_id: sellerId,
            image_url: item.image_url || ''
        }));

        const result = await placeAIOrder({
            userId,
            items: formattedItems,
            sellerId,
            totalAmount: orderData.total_amount,
            deliveryFee: orderData.delivery_fee || 0,
            paymentMethod: 'cod'
        });

        results.push(result);
    }

    const successfulOrders = results.filter(r => r.success);

    return {
        success: successfulOrders.length > 0,
        orders: results,
        error: successfulOrders.length === 0 ? 'All orders failed' : undefined
    };
};

export default { placeAIOrder, placeMultiSellerAIOrder };
