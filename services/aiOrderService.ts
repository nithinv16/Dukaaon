/**
 * AI Order Service
 * Handles AI-specific order operations and integrations
 */

import { supabase } from './supabase/supabase';

export interface AIOrderData {
  user_id?: string;
  retailer_id?: string;
  seller_id?: string;
  status: 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  total_amount: number;
  items: AIOrderItem[];
  session_id?: string;
  conversation_context?: any;
}

export interface AIOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

export interface AIOrderResponse {
  success: boolean;
  order_id?: string;
  message: string;
  error?: string;
}

/**
 * Create a new AI order
 * @param orderData - Order data from AI agent
 * @returns Promise with order creation result
 */
export const createAIOrder = async (orderData: AIOrderData): Promise<AIOrderResponse> => {
  try {
    // Create the main order with AI flag
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: orderData.user_id,
        retailer_id: orderData.retailer_id,
        seller_id: orderData.seller_id,
        status: orderData.status,
        total_amount: orderData.total_amount,
        is_ai_order: true, // Mark as AI order
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating AI order:', orderError);
      return {
        success: false,
        message: 'Failed to create order',
        error: orderError.message
      };
    }

    // Create order items if order was created successfully
    if (order && orderData.items.length > 0) {
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit: item.unit || 'piece'
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Rollback the order if items creation failed
        await supabase.from('orders').delete().eq('id', order.id);
        return {
          success: false,
          message: 'Failed to create order items',
          error: itemsError.message
        };
      }
    }

    return {
      success: true,
      order_id: order.id,
      message: `AI order created successfully with ${orderData.items.length} items`
    };

  } catch (error) {
    console.error('Unexpected error creating AI order:', error);
    return {
      success: false,
      message: 'Unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get all AI orders for a user
 * @param userId - User ID
 * @param limit - Number of orders to fetch (default: 50)
 * @returns Promise with AI orders
 */
export const getAIOrders = async (userId: string, limit: number = 50) => {
  try {
    const { data: orders, error } = await supabase
      .from('ai_orders_view') // Use the view we created in migration
      .select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          unit
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching AI orders:', error);
      return { success: false, orders: [], error: error.message };
    }

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Unexpected error fetching AI orders:', error);
    return { 
      success: false, 
      orders: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Get order statistics by source (AI vs Manual)
 * @returns Promise with order statistics
 */
export const getOrderStatsBySource = async () => {
  try {
    const { data: stats, error } = await supabase
      .rpc('get_order_stats_by_source');

    if (error) {
      console.error('Error fetching order stats:', error);
      return { success: false, stats: [], error: error.message };
    }

    return { success: true, stats: stats || [] };
  } catch (error) {
    console.error('Unexpected error fetching order stats:', error);
    return { 
      success: false, 
      stats: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Update AI order status
 * @param orderId - Order ID
 * @param status - New status
 * @returns Promise with update result
 */
export const updateAIOrderStatus = async (
  orderId: string, 
  status: 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled'
): Promise<AIOrderResponse> => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .eq('is_ai_order', true) // Ensure we only update AI orders
      .select()
      .single();

    if (error) {
      console.error('Error updating AI order status:', error);
      return {
        success: false,
        message: 'Failed to update order status',
        error: error.message
      };
    }

    return {
      success: true,
      order_id: order.id,
      message: `Order status updated to ${status}`
    };
  } catch (error) {
    console.error('Unexpected error updating AI order:', error);
    return {
      success: false,
      message: 'Unexpected error occurred',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Check if an order was placed via AI
 * @param orderId - Order ID
 * @returns Promise with boolean result
 */
export const isAIOrder = async (orderId: string): Promise<boolean> => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('is_ai_order')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('Error checking if order is AI order:', error);
      return false;
    }

    return order.is_ai_order === true;
  } catch (error) {
    console.error('Unexpected error checking AI order:', error);
    return false;
  }
};

/**
 * Get recent AI order activity for dashboard
 * @param limit - Number of recent orders to fetch
 * @returns Promise with recent AI orders
 */
export const getRecentAIActivity = async (limit: number = 10) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        created_at,
        user_id
      `)
      .eq('is_ai_order', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent AI activity:', error);
      return { success: false, orders: [], error: error.message };
    }

    return { success: true, orders: orders || [] };
  } catch (error) {
    console.error('Unexpected error fetching recent AI activity:', error);
    return { 
      success: false, 
      orders: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export default {
  createAIOrder,
  getAIOrders,
  getOrderStatsBySource,
  updateAIOrderStatus,
  isAIOrder,
  getRecentAIActivity
};