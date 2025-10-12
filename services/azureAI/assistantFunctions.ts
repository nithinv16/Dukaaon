/**
 * Azure OpenAI Assistant Function Definitions
 * Defines functions that the AI assistant can call to interact with Supabase database
 */

import { supabase } from '../supabase/supabase';
import { createAIOrder, getAIOrders, updateAIOrderStatus, AIOrderData } from '../aiOrderService';
import crypto from 'crypto';
import { useAuthStore } from '../../store/auth';

// Helper function to get current authenticated user ID
const getCurrentUserId = (): string | null => {
  const authState = useAuthStore.getState();
  return authState.user?.id || authState.session?.user?.id || null;
};

// Helper function to get enhanced user profile for AI
const getCurrentUserProfile = async (): Promise<any> => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('get_ai_user_profile', {
    p_user_id: userId
  });

  if (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile');
  }

  return data;
};

// Helper function to save AI conversation message
const saveAIMessage = async (
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  functionCalls: any[] = [],
  metadata: any = {}
): Promise<string> => {
  const { data, error } = await supabase.rpc('save_ai_message', {
    p_conversation_id: conversationId,
    p_role: role,
    p_content: content,
    p_function_calls: functionCalls,
    p_metadata: metadata
  });

  if (error) {
    console.error('Error saving AI message:', error);
    throw new Error('Failed to save AI message');
  }

  return data;
};

// Helper function to get or create AI conversation
const getOrCreateAIConversation = async (
  threadId: string,
  title: string = 'New Conversation'
): Promise<string> => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.rpc('get_or_create_ai_conversation', {
    p_user_id: userId,
    p_thread_id: threadId,
    p_title: title
  });

  if (error) {
    console.error('Error getting/creating conversation:', error);
    throw new Error('Failed to get or create conversation');
  }

  return data;
};

// Helper function to validate or generate UUID (kept for backward compatibility)
const validateOrGenerateUUID = (id: string): string => {
  // Check if it's already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(id)) {
    return id;
  }
  
  // If it's a simple string like 'user123', generate a deterministic UUID
  // This is a simple approach - in production, you might want to map to actual user UUIDs
  const hash = crypto.createHash('sha256').update(id).digest('hex');
  
  // Convert hash to UUID format (version 4 style)
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16), // Version 4
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20), // Variant bits
    hash.substring(20, 32)
  ].join('-');
  
  return uuid;
};

// Function definitions for Azure OpenAI Assistant
export const ASSISTANT_FUNCTIONS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search for products in the database by name, category, or other criteria",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for product name or description"
          },
          category: {
            type: "string",
            description: "Product category to filter by (optional)"
          },
          limit: {
            type: "number",
            description: "Maximum number of products to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Get detailed information about a specific product by ID",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "The unique identifier of the product"
          }
        },
        required: ["product_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_product_availability",
      description: "Check if products are available and their current stock levels",
      parameters: {
        type: "object",
        properties: {
          product_ids: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Array of product IDs to check availability for"
          }
        },
        required: ["product_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add items to user's cart",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: {
                  type: "string",
                  description: "Product ID"
                },
                quantity: {
                  type: "number",
                  description: "Quantity to add"
                }
              },
              required: ["product_id", "quantity"]
            },
            description: "Array of items to add to cart"
          }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_cart_items",
      description: "Get all items in user's cart",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Create a new order from cart items or specified products",
      parameters: {
        type: "object",
        properties: {
          retailer_id: {
            type: "string",
            description: "The retailer's unique identifier (optional)"
          },
          seller_id: {
            type: "string",
            description: "The seller's unique identifier (optional)"
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: {
                  type: "string",
                  description: "Product ID"
                },
                product_name: {
                  type: "string",
                  description: "Product name"
                },
                quantity: {
                  type: "number",
                  description: "Quantity to order"
                },
                unit_price: {
                  type: "number",
                  description: "Unit price of the product"
                },
                unit: {
                  type: "string",
                  description: "Unit of measurement (optional)"
                }
              },
              required: ["product_id", "product_name", "quantity", "unit_price"]
            },
            description: "Array of items to include in the order"
          },
          total_amount: {
            type: "number",
            description: "Total amount for the order"
          }
        },
        required: ["items", "total_amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_orders",
      description: "Get order history for the current user",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of orders to return (default: 10)",
            default: 10
          },
          status: {
            type: "string",
            description: "Filter by order status (optional)",
            enum: ["draft", "confirmed", "processing", "completed", "cancelled"]
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_profile",
      description: "Get the current user's profile with enhanced details including business information and location",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_seller_details",
      description: "Get seller-specific details for the current user (only works if user is a seller)",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_retailer_details",
      description: "Get retailer-specific details for the current user (only works if user is a retailer)",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_conversation_history",
      description: "Get the conversation history for the current AI chat thread",
      parameters: {
        type: "object",
        properties: {
          thread_id: {
            type: "string",
            description: "The thread ID of the conversation"
          },
          limit: {
            type: "number",
            description: "Maximum number of messages to return (default: 50)",
            default: 50
          }
        },
        required: ["thread_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_user_conversations",
      description: "Get a list of all AI conversations for the current user",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of conversations to return (default: 20)",
            default: 20
          }
        },
        required: []
      }
    }
  }
];

// Function implementations
export const assistantFunctionHandlers = {
  search_products: async (params: { query: string; category?: string; limit?: number }) => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .ilike('name', `%${params.query}%`)
        .limit(params.limit || 10);

      if (params.category) {
        query = query.eq('category', params.category);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, products: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  get_product_details: async (params: { product_id: string }) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.product_id)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, product: data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  check_product_availability: async (params: { product_ids: string[] }) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, price')
        .in('id', params.product_ids);

      if (error) {
        return { success: false, error: error.message };
      }

      const availability = data?.map(product => ({
        product_id: product.id,
        name: product.name,
        available: product.stock_quantity > 0,
        stock_quantity: product.stock_quantity,
        price: product.price
      })) || [];

      return { success: true, availability };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  add_to_cart: async (params: { items: Array<{ product_id: string; quantity: number }>; user_id?: string }) => {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        return {
          success: false,
          error: 'User not authenticated',
          message: 'Please log in to add items to cart'
        };
      }
      
      // Only use the items parameter, ignore any user_id parameter as we get it from auth
      const cartItems = params.items.map(item => ({
        user_id: currentUserId,
        product_id: item.product_id,
        quantity: item.quantity,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('cart_items')
        .upsert(cartItems, { onConflict: 'user_id,product_id' })
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, cart_items: data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  get_cart_items: async (params: {} = {}) => {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        return {
          success: false,
          error: 'User not authenticated',
          message: 'Please log in to view cart items'
        };
      }
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (
            id,
            name,
            price,
            stock_quantity,
            unit
          )
        `)
        .eq('user_id', currentUserId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, cart_items: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  create_order: async (params: {
    retailer_id?: string;
    seller_id?: string;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      unit?: string;
    }>;
    total_amount: number;
  }) => {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        return {
          success: false,
          error: 'User not authenticated',
          message: 'Please log in to create an order'
        };
      }
      
      const orderData: AIOrderData = {
        user_id: currentUserId,
        retailer_id: params.retailer_id,
        seller_id: params.seller_id,
        status: 'confirmed',
        total_amount: params.total_amount,
        items: params.items
      };

      const result = await createAIOrder(orderData);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  get_user_orders: async (params: { limit?: number; status?: string } = {}) => {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        return {
          success: false,
          error: 'User not authenticated',
          message: 'Please log in to view your orders'
        };
      }
      
      let query = supabase
        .from('orders')
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
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(params.limit || 10);

      if (params.status) {
        query = query.eq('status', params.status);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, orders: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  update_order_status: async (params: { order_id: string; status: string }) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: params.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.order_id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, order: data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

// Get current user profile with enhanced details
const get_user_profile = async (): Promise<any> => {
  try {
    const profile = await getCurrentUserProfile();
    return {
      success: true,
      profile,
      message: 'User profile retrieved successfully'
    };
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    return {
      success: false,
      error: error.message || 'Failed to get user profile'
    };
  }
};

// Get seller details for the current user (if they are a seller)
const get_seller_details = async (): Promise<any> => {
  try {
    const profile = await getCurrentUserProfile();
    
    if (profile.role !== 'seller') {
      return {
        success: false,
        error: 'Current user is not a seller'
      };
    }

    return {
      success: true,
      seller_details: profile.seller_details,
      business_details: profile.business_details,
      location: profile.location,
      message: 'Seller details retrieved successfully'
    };
  } catch (error: any) {
    console.error('Error getting seller details:', error);
    return {
      success: false,
      error: error.message || 'Failed to get seller details'
    };
  }
};

// Get retailer details for the current user (if they are a retailer)
const get_retailer_details = async (): Promise<any> => {
  try {
    const profile = await getCurrentUserProfile();
    
    if (profile.role !== 'retailer') {
      return {
        success: false,
        error: 'Current user is not a retailer'
      };
    }

    return {
      success: true,
      retailer_details: profile.retailer_details,
      business_details: profile.business_details,
      location: profile.location,
      message: 'Retailer details retrieved successfully'
    };
  } catch (error: any) {
    console.error('Error getting retailer details:', error);
    return {
      success: false,
      error: error.message || 'Failed to get retailer details'
    };
  }
};

// Get conversation history for the current thread
const get_conversation_history = async (params: { thread_id: string; limit?: number }): Promise<any> => {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const { data, error } = await supabase.rpc('get_ai_conversation_history', {
      p_user_id: userId,
      p_thread_id: params.thread_id,
      p_limit: params.limit || 50
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      messages: data,
      message: 'Conversation history retrieved successfully'
    };
  } catch (error: any) {
    console.error('Error getting conversation history:', error);
    return {
      success: false,
      error: error.message || 'Failed to get conversation history'
    };
  }
};

// Get list of user's AI conversations
const get_user_conversations = async (params: { limit?: number } = {}): Promise<any> => {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const { data, error } = await supabase.rpc('get_user_ai_conversations', {
      p_user_id: userId,
      p_limit: params.limit || 20
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      conversations: data,
      message: 'User conversations retrieved successfully'
    };
  } catch (error: any) {
    console.error('Error getting user conversations:', error);
    return {
      success: false,
      error: error.message || 'Failed to get user conversations'
    };
  }
};

// Export all assistant functions
export const assistantFunctions = {
  add_to_cart: assistantFunctionHandlers.add_to_cart,
  get_cart_items: assistantFunctionHandlers.get_cart_items,
  create_order: assistantFunctionHandlers.create_order,
  get_user_orders: assistantFunctionHandlers.get_user_orders,
  update_order_status: assistantFunctionHandlers.update_order_status,
  search_products: assistantFunctionHandlers.search_products,
  get_product_details: assistantFunctionHandlers.get_product_details,
  check_product_availability: assistantFunctionHandlers.check_product_availability,
  get_user_profile,
  get_seller_details,
  get_retailer_details,
  get_conversation_history,
  get_user_conversations,
};

// Export helper functions for use in other parts of the application
export {
  getCurrentUserId,
  getCurrentUserProfile,
  saveAIMessage,
  getOrCreateAIConversation,
};

// Helper function to execute assistant function calls
export const executeAssistantFunction = async (functionName: string, parameters: any) => {
  const handler = assistantFunctionHandlers[functionName as keyof typeof assistantFunctionHandlers];
  
  if (!handler) {
    return { success: false, error: `Function '${functionName}' not found` };
  }

  try {
    return await handler(parameters);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};