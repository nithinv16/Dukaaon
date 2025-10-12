// Bedrock AI Service with Claude 3.5 Sonnet - React Native Compatible
import { BEDROCK_CONFIG, AI_AGENT_CONFIG } from '../../config/awsBedrock';
import { supabase } from '../supabase/supabase';
import { useCartStore } from '../../store/cart';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  function_calls?: any[];
}

export interface AIConversation {
  id: string;
  user_id: string;
  messages: AIMessage[];
  context: {
    user_profile?: any;
    current_cart?: any;
    recent_orders?: any[];
    preferences?: any;
  };
  created_at: Date;
  updated_at: Date;
}

export interface AIFunctionCall {
  name: string;
  parameters: Record<string, any>;
}

export interface AIResponse {
  content: string;
  function_calls?: AIFunctionCall[];
  thinking?: string;
  confidence?: number;
  conversationId?: string;
  suggestions?: string[];
  timestamp?: string;
}

class BedrockAIService {
  private modelId: string;

  constructor() {
    // React Native compatible initialization - no AWS SDK client needed
    this.modelId = BEDROCK_CONFIG.modelId;
  }

  // Main chat completion method
  async chat(
    messages: AIMessage[],
    userId: string,
    conversationId?: string,
    useStreaming: boolean = false
  ): Promise<AIResponse> {
    try {
      // Get user context
      const context = await this.getUserContext(userId);
      
      // Prepare messages with system prompt and context
      const systemMessage = this.buildSystemMessage(context);
      const formattedMessages = [systemMessage, ...messages];

      // Prepare the request payload for OpenAI model
      const payload = {
        model: BEDROCK_CONFIG.modelId,
        max_tokens: BEDROCK_CONFIG.maxTokens,
        temperature: BEDROCK_CONFIG.temperature,
        top_p: BEDROCK_CONFIG.topP,
        messages: formattedMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        tools: this.getAvailableTools(),
        tool_choice: "auto"
      };

      if (useStreaming) {
        return await this.streamResponse(payload, conversationId);
      } else {
        return await this.getSingleResponse(payload, conversationId);
      }
    } catch (error) {
      console.error('Bedrock AI Service Error:', error);
      throw new Error(`AI Service Error: ${error.message}`);
    }
  }

  // Single response method - AWS Bedrock API implementation
  private async getSingleResponse(payload: any, conversationId?: string): Promise<AIResponse> {
    try {
      const response = await this.invokeBedrockModel(payload);
      return this.parseBedrockResponse(response);
    } catch (error) {
      console.error('Bedrock API Error:', error);
      throw error;
    }
  }

  // Streaming response method - AWS Bedrock API implementation
  private async streamResponse(payload: any, conversationId?: string): Promise<AIResponse> {
    try {
      // For now, use single response as streaming requires more complex implementation
      // TODO: Implement actual streaming with Server-Sent Events
      return await this.getSingleResponse(payload, conversationId);
    } catch (error) {
      console.error('Bedrock Streaming Error:', error);
      throw error;
    }
  }

  // Invoke AWS Bedrock model using direct HTTP API calls (React Native compatible)
  private async invokeBedrockModel(payload: any): Promise<any> {
    const { BEDROCK_CONFIG } = await import('../../config/awsBedrock');
    
    try {
      // Get AWS Bedrock API key from environment variables (React Native compatible)
      // Try multiple methods to access the API key
      let apiKey = process.env.EXPO_PUBLIC_AWS_BEDROCK_API_KEY;
      
      // Fallback to Expo Constants for environment variables
      if (!apiKey) {
        try {
          const Constants = require('expo-constants').default;
          apiKey = Constants.expoConfig?.extra?.awsBedrockApiKey || Constants.manifest?.extra?.awsBedrockApiKey;
        } catch (error) {
          console.log('Constants not available, using process.env only');
        }
      }
      
      if (!apiKey) {
        throw new Error('AWS Bedrock API key not found. Please check EXPO_PUBLIC_AWS_BEDROCK_API_KEY in .env file');
      }

      // AWS Bedrock Runtime endpoint for us-east-1 region
      const bedrockEndpoint = 'https://bedrock-runtime.us-east-1.amazonaws.com';
      const modelId = BEDROCK_CONFIG.modelId;
      
      // Direct AWS Bedrock API call using API key authentication
      const response = await fetch(`${bedrockEndpoint}/model/${modelId}/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Amzn-Bedrock-Accept': '*/*',
          'X-Amzn-Bedrock-Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bedrock API Error:', response.status, errorText);
        throw new Error(`Bedrock API request failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('AWS Bedrock invocation failed:', error);
      throw new Error(`AI Service Error: ${error.message}`);
    }
  }

  // Parse Bedrock response for OpenAI model
  private parseBedrockResponse(response: any): AIResponse {
    try {
      // Enhanced logging for debugging
      console.log('Bedrock response structure:', JSON.stringify(response, null, 2));
      
      // Handle OpenAI response format from AWS Bedrock
      if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        const choice = response.choices[0];
        const message = choice.message;
        
        let content = message.content || '';
        let functionCalls: AIFunctionCall[] = [];
        
        // Remove reasoning section from content if present
        content = this.removeReasoningSection(content);
        
        // Handle tool calls in OpenAI format
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          console.log('Function calls detected:', message.tool_calls.length);
          functionCalls = message.tool_calls.map((toolCall: any) => ({
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments || '{}')
          }));
        }

        return {
          content: content,
          function_calls: functionCalls,
          confidence: 0.9
        };
      }

      // Handle direct response format from Bedrock API
      if (response.completion) {
        let content = response.completion;
        content = this.removeReasoningSection(content);
        
        return {
          content: content,
          function_calls: [],
          confidence: 0.9
        };
      }

      // Handle Claude 3.5 Sonnet response format with content array
      if (response.content && Array.isArray(response.content)) {
        let content = '';
        let functionCalls: AIFunctionCall[] = [];
        
        for (const item of response.content) {
          if (item.type === 'text') {
            content += item.text;
          } else if (item.type === 'tool_use') {
            console.log('Function call detected:', item.name, item.input);
            functionCalls.push({
              name: item.name,
              parameters: item.input
            });
          }
        }
        
        content = this.removeReasoningSection(content);
        
        return {
          content: content.trim(),
          function_calls: functionCalls.length > 0 ? functionCalls : [],
          confidence: 0.9
        };
      }

      // Fallback for different response formats
      let content = response.content || response.text || response.completion || 'I apologize, but I encountered an issue processing your request.';
      content = this.removeReasoningSection(content);
      
      // Log if no content was found
      if (!content || content.trim() === '') {
        console.warn('No content found in response:', response);
      }
      
      return {
        content: content,
        function_calls: response.function_calls || [],
        confidence: response.confidence || 0.8
      };
    } catch (error) {
      console.error('Error parsing Bedrock response:', error);
      console.error('Raw response:', response);
      return {
        content: 'I apologize, but I encountered an issue processing your request.',
        function_calls: [],
        confidence: 0.5
      };
    }
  }

  // Remove reasoning section from AI response content
  private removeReasoningSection(content: string): string {
    if (!content) return content;
    
    // Remove <reasoning>...</reasoning> tags and their content
    const reasoningRegex = /<reasoning>[\s\S]*?<\/reasoning>/gi;
    content = content.replace(reasoningRegex, '');
    
    // Clean up any extra whitespace or newlines left behind
    content = content.trim();
    
    return content;
  }

  // Build system message with context
  private buildSystemMessage(context: any): AIMessage {
    let systemContent = AI_AGENT_CONFIG.systemPrompt;
    
    if (context.user_profile) {
      systemContent += `\n\nUser Profile:
- Role: ${context.user_profile.role}
- Business: ${context.user_profile.business_details?.shopName || 'Not specified'}
- Language: ${context.user_profile.language || 'en'}
- Location: ${context.user_profile.business_details?.address || 'Not specified'}`;
    }

    if (context.current_cart && context.current_cart.length > 0) {
      systemContent += `\n\nCurrent Cart: ${context.current_cart.length} items`;
    }

    if (context.recent_orders && context.recent_orders.length > 0) {
      systemContent += `\n\nRecent Orders: User has ${context.recent_orders.length} recent orders`;
    }

    return {
      role: 'system',
      content: systemContent,
      timestamp: new Date()
    };
  }

  // Get user context from database
  private async getUserContext(userId: string): Promise<any> {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Get current cart (if exists)
      const { data: cart } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', userId);

      // Get recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        user_profile: profile,
        current_cart: cart || [],
        recent_orders: orders || [],
        preferences: profile?.preferences || {}
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return {};
    }
  }

  // Define available tools/functions
  private getAvailableTools() {
    return [
      {
        type: "function",
        function: {
          name: "search_products",
          description: "Search for products in the database by name, category, or keywords. Use this for general product searches. If location is not provided, user's location will be fetched from their profile for location-based results.",
          parameters: {
            type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for products"
            },
            category: {
              type: "string",
              description: "Product category to filter by"
            },
            subcategory: {
              type: "string",
              description: "Product subcategory to filter by"
            },
            brand: {
              type: "string",
              description: "Brand name to filter by"
            },
            seller_id: {
              type: "string",
              description: "Filter by specific seller ID"
            },
            latitude: {
              type: "number",
              description: "User's latitude for location-based search (optional - will be fetched from profile if not provided)"
            },
            longitude: {
              type: "number",
              description: "User's longitude for location-based search (optional - will be fetched from profile if not provided)"
            },
            radius_km: {
              type: "number",
              description: "Search radius in kilometers for location-based results",
              default: 20
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return",
              default: 10
            },
            price_range: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" }
              }
            },
            sort_by: {
              type: "string",
              description: "Sort order: popularity, price_low_high, price_high_low, name_a_z, name_z_a",
              enum: ["popularity", "price_low_high", "price_high_low", "name_a_z", "name_z_a"]
            }
          },
          required: ["query"]
        }
        }
      },
      {
        type: "function",
        function: {
          name: "view_product_details",
          description: "Get detailed information about a specific product by its ID",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "The ID of the product to view"
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_products_by_category",
          description: "Get all products from a specific category with optional filtering and sorting, including location-based sorting by seller proximity",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Product category name"
              },
              subcategory: {
                type: "string",
                description: "Product subcategory name (optional)"
              },
              brand: {
                type: "string",
                description: "Filter by brand name (optional)"
              },
              price_min: {
                type: "number",
                description: "Minimum price filter (optional)"
              },
              price_max: {
                type: "number",
                description: "Maximum price filter (optional)"
              },
              latitude: {
                type: "number",
                description: "User's latitude for location-based sorting (optional)"
              },
              longitude: {
                type: "number",
                description: "User's longitude for location-based sorting (optional)"
              },
              radius_km: {
                type: "number",
                description: "Search radius in kilometers for nearby sellers",
                default: 100
              },
              sort_by: {
                type: "string",
                description: "Sort order (optional)",
                enum: ["popularity", "price_low_high", "price_high_low", "name_a_z", "name_z_a", "distance"]
              },
              limit: {
                type: "number",
                description: "Maximum number of products",
                default: 20
              }
            },
            required: ["category"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_to_cart",
          description: "Add a product to the user's shopping cart with specified quantity. User ID is automatically provided.",
          parameters: {
            type: "object",
          properties: {
            product_id: {
              type: "string",
              description: "ID of the product to add"
            },
            quantity: {
              type: "number",
              description: "Quantity to add to cart",
              default: 1
            }
          },
          required: ["product_id"]
        }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_from_cart",
          description: "Remove a specific item from the user's cart by cart item ID. User ID is automatically provided.",
          parameters: {
            type: "object",
            properties: {
              cart_item_id: {
                type: "string",
                description: "The unique ID of the cart item to remove"
              }
            },
            required: ["cart_item_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_cart_quantity",
          description: "Update the quantity of an item in the cart. User ID is automatically provided.",
          parameters: {
            type: "object",
            properties: {
              cart_item_id: {
                type: "string",
                description: "The unique ID of the cart item to update"
              },
              quantity: {
                type: "number",
                description: "New quantity for the item"
              }
            },
            required: ["cart_item_id", "quantity"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "clear_cart",
          description: "Clear all items from the user's cart. User ID is automatically provided.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_cart_items",
          description: "Get current items in user's cart. User ID is automatically provided.",
          parameters: {
            type: "object",
            properties: {}
        }
        }
      },
      {
        type: "function",
        function: {
          name: "get_order_history",
          description: "Get user's order history. User ID is automatically provided.",
          parameters: {
            type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of orders to return",
              default: 10
            }
          }
        }
        }
      },
      {
        type: "function",
        function: {
          name: "get_product_recommendations",
          description: "Get personalized product recommendations prioritized by nearby sellers. User ID is automatically provided. If location is not provided, user's location will be fetched from their profile.",
          parameters: {
            type: "object",
          properties: {
            category: {
              type: "string",
              description: "Category to get recommendations for"
            },
            latitude: {
              type: "number",
              description: "User's latitude for location-based recommendations (optional - will be fetched from profile if not provided)"
            },
            longitude: {
              type: "number",
              description: "User's longitude for location-based recommendations (optional - will be fetched from profile if not provided)"
            },
            radius_km: {
              type: "number",
              description: "Search radius in kilometers for nearby sellers",
              default: 50
            },
            limit: {
              type: "number",
              description: "Number of recommendations",
              default: 5
            }
          }
        }
        }
      },
      {
        type: "function",
        function: {
          name: "place_order",
          description: "Place an order with items from the user's cart using Cash on Delivery. The system automatically splits orders by seller and calculates delivery fees. User ID and location are automatically provided.",
          parameters: {
          type: "object",
          properties: {
            delivery_instructions: {
              type: "string",
              description: "Special delivery instructions or notes (optional)"
            },
            payment_method: {
              type: "string",
              description: "Payment method - defaults to cod (Cash on Delivery)",
              default: "cod",
              enum: ["cod"]
            }
          }
        }
        }
      },
      {
        type: "function",
        function: {
          name: "list_sellers",
          description: "List all sellers (wholesalers, manufacturers, retailers) with optional filtering and distance-based sorting",
          parameters: {
            type: "object",
            properties: {
              role: {
                type: "string",
                description: "Filter by seller role (wholesaler, manufacturer, retailer)",
                enum: ["wholesaler", "manufacturer", "retailer"]
              },
              category: {
                type: "string",
                description: "Filter sellers who sell products in this category"
              },
              location: {
                type: "string",
                description: "Filter by location/city"
              },
              latitude: {
                type: "number",
                description: "User's latitude for distance-based sorting (optional)"
              },
              longitude: {
                type: "number",
                description: "User's longitude for distance-based sorting (optional)"
              },
              radius_km: {
                type: "number",
                description: "Search radius in kilometers",
                default: 100
              },
              limit: {
                type: "number",
                description: "Maximum number of sellers to return",
                default: 20
              },
              offset: {
                type: "number",
                description: "Number of sellers to skip (for pagination)",
                default: 0
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_nearby_wholesalers",
          description: "Find nearby wholesalers within a specified radius. If latitude and longitude are not provided, user's location will be fetched from their profile.",
          parameters: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                description: "User's current latitude (optional - will be fetched from profile if not provided)"
              },
              longitude: {
                type: "number", 
                description: "User's current longitude (optional - will be fetched from profile if not provided)"
              },
              radius_km: {
                type: "number",
                description: "Search radius in kilometers",
                default: 50
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 10
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_nearby_manufacturers",
          description: "Find nearby manufacturers within a specified radius. If latitude and longitude are not provided, user's location will be fetched from their profile.",
          parameters: {
            type: "object",
            properties: {
              latitude: {
                type: "number",
                description: "User's current latitude (optional - will be fetched from profile if not provided)"
              },
              longitude: {
                type: "number",
                description: "User's current longitude (optional - will be fetched from profile if not provided)"
              },
              radius_km: {
                type: "number",
                description: "Search radius in kilometers", 
                default: 50
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
                default: 10
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_seller_products",
          description: "Get products from a specific seller/wholesaler/manufacturer with distance information if user location is available",
          parameters: {
            type: "object",
            properties: {
              seller_id: {
                type: "string",
                description: "ID of the seller"
              },
              category: {
                type: "string",
                description: "Filter by product category"
              },
              latitude: {
                type: "number",
                description: "User's latitude for distance calculation (optional)"
              },
              longitude: {
                type: "number",
                description: "User's longitude for distance calculation (optional)"
              },
              limit: {
                type: "number",
                description: "Maximum number of products",
                default: 20
              }
            },
            required: ["seller_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_order_details",
          description: "Get detailed information about a specific order by order ID",
          parameters: {
            type: "object",
            properties: {
              order_id: {
                type: "string",
                description: "The ID of the order to retrieve"
              }
            },
            required: ["order_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "cancel_order",
          description: "Cancel a pending order. Only orders with 'pending' status can be cancelled.",
          parameters: {
            type: "object",
            properties: {
              order_id: {
                type: "string",
                description: "The ID of the order to cancel"
              },
              reason: {
                type: "string",
                description: "Reason for cancellation (optional)"
              }
            },
            required: ["order_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "reorder",
          description: "Create a new order with the same items as a previous order",
          parameters: {
            type: "object",
            properties: {
              order_id: {
                type: "string",
                description: "The ID of the order to duplicate"
              }
            },
            required: ["order_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "track_order",
          description: "Get real-time tracking information for an order",
          parameters: {
            type: "object",
            properties: {
              order_id: {
                type: "string",
                description: "The ID of the order to track"
              }
            },
            required: ["order_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_to_wishlist",
          description: "Add a product to user's wishlist",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "ID of the product to add to wishlist"
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_from_wishlist",
          description: "Remove a product from user's wishlist",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "ID of the product to remove from wishlist"
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_wishlist",
          description: "Get all items in user's wishlist",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "move_wishlist_to_cart",
          description: "Move a product from wishlist to cart with specified quantity",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "ID of the product to move"
              },
              quantity: {
                type: "number",
                description: "Quantity to add to cart",
                default: 1
              }
            },
            required: ["product_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_user_profile",
          description: "Get user's profile information including business details",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_profile",
          description: "Update user profile information",
          parameters: {
            type: "object",
            properties: {
              shop_name: {
                type: "string",
                description: "Shop/business name"
              },
              phone_number: {
                type: "string",
                description: "Contact phone number"
              },
              address: {
                type: "string",
                description: "Business address"
              },
              city: {
                type: "string",
                description: "City"
              },
              state: {
                type: "string",
                description: "State"
              },
              pincode: {
                type: "string",
                description: "Postal code"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_notifications",
          description: "Get user's notifications",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of notifications",
                default: 20
              },
              unread_only: {
                type: "boolean",
                description: "Show only unread notifications",
                default: false
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "mark_notification_read",
          description: "Mark a notification as read",
          parameters: {
            type: "object",
            properties: {
              notification_id: {
                type: "string",
                description: "ID of the notification to mark as read"
              }
            },
            required: ["notification_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "mark_all_notifications_read",
          description: "Mark all notifications as read",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      }
    ];
  }

  // Execute function calls - made public for external access
  async executeFunctionCalls(functionCalls: AIFunctionCall[], userId: string): Promise<string> {
    const results: string[] = [];
    
    for (const call of functionCalls) {
      console.log(`Executing function: ${call.name} with parameters:`, call.parameters);
      
      try {
        let result: any;
        
        switch (call.name) {
          case 'search_products':
            result = await this.searchProducts(call.parameters);
            break;
          case 'add_to_cart':
            result = await this.addToCart(call.parameters, userId);
            break;
          case 'get_cart_items':
            result = await this.getCartItems(userId);
            break;
          case 'get_order_history':
            result = await this.getOrderHistory(userId);
            break;
          case 'get_product_recommendations':
            result = await this.getProductRecommendations(call.parameters, userId);
            break;
          case 'place_order':
            result = await this.placeOrder(call.parameters, userId);
            break;
          case 'list_sellers':
            console.log('Executing list_sellers with params:', call.parameters);
            result = await this.listSellers(call.parameters, userId);
            console.log('list_sellers result:', result);
            break;
          case 'find_nearby_wholesalers':
            result = await this.findNearbyWholesalers(call.parameters, userId);
            break;
          case 'find_nearby_manufacturers':
            result = await this.findNearbyManufacturers(call.parameters, userId);
            break;
          case 'get_seller_products':
            result = await this.getSellerProducts(call.parameters, userId);
            break;
          case 'view_product_details':
            result = await this.viewProductDetails(call.parameters);
            break;
          case 'get_products_by_category':
            result = await this.getProductsByCategory(call.parameters, userId);
            break;
          case 'remove_from_cart':
            result = await this.removeFromCart(call.parameters, userId);
            break;
          case 'update_cart_quantity':
            result = await this.updateCartQuantity(call.parameters, userId);
            break;
          case 'clear_cart':
            result = await this.clearCart(userId);
            break;
          case 'get_order_details':
            result = await this.getOrderDetails(call.parameters, userId);
            break;
          case 'cancel_order':
            result = await this.cancelOrder(call.parameters, userId);
            break;
          case 'reorder':
            result = await this.reorderPreviousOrder(call.parameters, userId);
            break;
          case 'track_order':
            result = await this.trackOrder(call.parameters, userId);
            break;
          case 'add_to_wishlist':
            result = await this.addToWishlist(call.parameters, userId);
            break;
          case 'remove_from_wishlist':
            result = await this.removeFromWishlistFunc(call.parameters, userId);
            break;
          case 'get_wishlist':
            result = await this.getWishlist(userId);
            break;
          case 'move_wishlist_to_cart':
            result = await this.moveWishlistToCart(call.parameters, userId);
            break;
          case 'get_user_profile':
            result = await this.getUserProfile(userId);
            break;
          case 'update_profile':
            result = await this.updateUserProfile(call.parameters, userId);
            break;
          case 'get_notifications':
            result = await this.getNotifications(call.parameters, userId);
            break;
          case 'mark_notification_read':
            result = await this.markNotificationRead(call.parameters, userId);
            break;
          case 'mark_all_notifications_read':
            result = await this.markAllNotificationsRead(userId);
            break;
          default:
            console.warn(`Unknown function: ${call.name}`);
            result = { error: `Unknown function: ${call.name}` };
        }
        
        // Enhanced result logging and error handling
        if (result && result.error) {
          console.error(`Function ${call.name} returned error:`, result.error);
          results.push(`Error in ${call.name}: ${result.error}`);
        } else if (result === null || result === undefined) {
          console.warn(`Function ${call.name} returned null/undefined`);
          results.push(`${call.name}: No data found`);
        } else if (Array.isArray(result) && result.length === 0) {
          console.log(`Function ${call.name} returned empty array`);
          results.push(`${call.name}: No results found`);
        } else {
          console.log(`Function ${call.name} executed successfully, result length:`, 
            Array.isArray(result) ? result.length : typeof result);
          results.push(`${call.name}: ${JSON.stringify(result, null, 2)}`);
        }
        
      } catch (error) {
        console.error(`Error executing function ${call.name}:`, error);
        results.push(`Error in ${call.name}: ${error.message}`);
      }
    }
    
    const combinedResult = results.join('\n\n');
    console.log('Combined function execution results:', combinedResult);
    return combinedResult;
  }

  // Make executeFunction public for external access
  async executeFunction(functionCall: AIFunctionCall, userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const results = await this.executeFunctionCalls([functionCall]);
      const result = results[0];
      
      if (result.error) {
        return { success: false, error: result.error };
      }
      
      return { success: true, data: result.result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Function implementations
  private async searchProducts(params: any) {
    const { query, category, subcategory, brand, seller_id, limit = 10, price_range, sort_by, radius_km = 20 } = params;
    let { latitude, longitude } = params;
    
    // Fetch user location from profiles table if not provided
    if (!latitude || !longitude) {
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', this.userId)
          .single();

        if (!profileError && userProfile) {
          latitude = userProfile.latitude;
          longitude = userProfile.longitude;
          console.log(`Fetched user location from profile: ${latitude}, ${longitude}, ${userProfile.location_address}`);
        }
      } catch (error) {
        console.log('Could not fetch user location from profile:', error);
      }
    }

    // Use location-based search if location is available
    if (latitude && longitude) {
      try {
        // Import ProductSearchService for location-based search
        const ProductSearchService = (await import('../productSearchService')).default;
        
        const searchOptions = {
          query,
          userLatitude: latitude,
          userLongitude: longitude,
          radiusKm: radius_km,
          limit,
          includeOutOfStock: false
        };

        const locationBasedResults = await ProductSearchService.searchProducts(searchOptions);
        
        // Apply additional filters to location-based results
        let filteredResults = locationBasedResults.products || [];
        
        if (category) {
          const genericCategories = ['groceries', 'food', 'items', 'products', 'goods'];
          if (!genericCategories.includes(category.toLowerCase())) {
            filteredResults = filteredResults.filter((product: any) => 
              product.category?.toLowerCase() === category.toLowerCase()
            );
          }
        }
        
        if (subcategory) {
          filteredResults = filteredResults.filter((product: any) => 
            product.subcategory?.toLowerCase() === subcategory.toLowerCase()
          );
        }
        
        if (brand) {
          filteredResults = filteredResults.filter((product: any) => 
            product.brand?.toLowerCase() === brand.toLowerCase()
          );
        }
        
        if (seller_id) {
          filteredResults = filteredResults.filter((product: any) => 
            product.seller_id === seller_id
          );
        }
        
        if (price_range) {
          filteredResults = filteredResults.filter((product: any) => {
            const price = parseFloat(product.price);
            return (!price_range.min || price >= price_range.min) && 
                   (!price_range.max || price <= price_range.max);
          });
        }
        
        // Apply sorting
        if (sort_by === 'price_low_high') {
          filteredResults.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sort_by === 'price_high_low') {
          filteredResults.sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sort_by === 'name_a_z') {
          filteredResults.sort((a: any, b: any) => a.name.localeCompare(b.name));
        } else if (sort_by === 'name_z_a') {
          filteredResults.sort((a: any, b: any) => b.name.localeCompare(a.name));
        }
        
        return filteredResults.slice(0, limit);
        
      } catch (error) {
        console.log('Location-based search failed, falling back to regular search:', error);
        // Fall through to regular search
      }
    }
    
    // Fallback to regular search if location is not available or location-based search fails
    let queryBuilder = supabase
      .from('products')
      .select(`
        id, name, price, image_url, category, subcategory, brand,
        description, stock_available, unit, min_quantity, seller_id,
        profiles!seller_id (
          business_details,
          seller_details (business_name, seller_type)
        )
      `)
      .or(`name.ilike.%${query}%,category.ilike.%${query}%,subcategory.ilike.%${query}%,brand.ilike.%${query}%`)
      .gt('stock_available', 0)
      .limit(limit);

    // Only apply category filter if it's explicitly provided and looks valid
    // Don't use generic terms like "groceries", "food", etc.
    const genericCategories = ['groceries', 'food', 'items', 'products', 'goods'];
    if (category && !genericCategories.includes(category.toLowerCase())) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (subcategory) {
      queryBuilder = queryBuilder.eq('subcategory', subcategory);
    }

    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand);
    }

    if (seller_id) {
      queryBuilder = queryBuilder.eq('seller_id', seller_id);
    }

    if (price_range) {
      if (price_range.min) queryBuilder = queryBuilder.gte('price', price_range.min);
      if (price_range.max) queryBuilder = queryBuilder.lte('price', price_range.max);
    }

    // Apply sorting
    if (sort_by === 'price_low_high') {
      queryBuilder = queryBuilder.order('price', { ascending: true });
    } else if (sort_by === 'price_high_low') {
      queryBuilder = queryBuilder.order('price', { ascending: false });
    } else if (sort_by === 'name_a_z') {
      queryBuilder = queryBuilder.order('name', { ascending: true });
    } else if (sort_by === 'name_z_a') {
      queryBuilder = queryBuilder.order('name', { ascending: false });
    }

    const { data, error } = await queryBuilder;
    
    if (error) throw error;
    return data || [];
  }

  // View detailed product information
  private async viewProductDetails(params: any) {
    const { product_id } = params;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, price, image_url, category, subcategory, brand,
          description, stock_available, unit, min_quantity, seller_id,
          profiles!seller_id (
            id,
            business_details,
            seller_details (business_name, seller_type, business_description, contact_phone, business_address)
          )
        `)
        .eq('id', product_id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error viewing product details:', error);
      return { error: `Failed to get product details: ${error.message}` };
    }
  }

  // Get products by category with advanced filtering
  private async getProductsByCategory(params: any, userId?: string) {
    const { category, subcategory, brand, price_min, price_max, latitude, longitude, radius_km = 100, sort_by, limit = 20 } = params;
    
    try {
      let userLat = latitude;
      let userLng = longitude;
      
      // Fetch user location from profile if not provided but userId is available
      if ((!userLat || !userLng) && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profile?.latitude && profile?.longitude) {
          userLat = profile.latitude;
          userLng = profile.longitude;
        }
      }
      
      let queryBuilder = supabase
        .from('products')
        .select(`
          id, name, price, image_url, category, subcategory, brand,
          description, stock_available, unit, min_quantity, seller_id,
          profiles!seller_id (
            business_details,
            latitude,
            longitude,
            seller_details (business_name, seller_type, latitude, longitude)
          )
        `)
        .eq('category', category)
        .gt('stock_available', 0);

      if (subcategory) {
        queryBuilder = queryBuilder.eq('subcategory', subcategory);
      }

      if (brand) {
        queryBuilder = queryBuilder.eq('brand', brand);
      }

      if (price_min !== undefined) {
        queryBuilder = queryBuilder.gte('price', price_min);
      }

      if (price_max !== undefined) {
        queryBuilder = queryBuilder.lte('price', price_max);
      }

      // Apply non-distance sorting at database level
      if (sort_by === 'price_low_high') {
        queryBuilder = queryBuilder.order('price', { ascending: true });
      } else if (sort_by === 'price_high_low') {
        queryBuilder = queryBuilder.order('price', { ascending: false });
      } else if (sort_by === 'name_a_z') {
        queryBuilder = queryBuilder.order('name', { ascending: true });
      } else if (sort_by === 'name_z_a') {
        queryBuilder = queryBuilder.order('name', { ascending: false });
      }

      const { data: products, error } = await queryBuilder;
      
      if (error) throw error;
      
      let result = products || [];
      
      // If user location is available and distance sorting is requested or no specific sort is requested
      if (userLat && userLng && result.length > 0) {
        // Calculate distances for all products
        result = result.map(product => {
          const sellerProfile = product.profiles;
          // Use seller_details location first, then profile location
          const sellerLat = sellerProfile?.seller_details?.latitude || sellerProfile?.latitude;
          const sellerLng = sellerProfile?.seller_details?.longitude || sellerProfile?.longitude;
          
          if (sellerLat && sellerLng) {
            const distance = this.calculateDistance(
              userLat, userLng,
              sellerLat, sellerLng
            );
            return { ...product, distance_km: distance };
          }
          return { ...product, distance_km: Infinity };
        });
        
        // Filter by radius if location-based
        if (sort_by === 'distance') {
          result = result
            .filter(product => product.distance_km <= radius_km)
            .sort((a, b) => a.distance_km - b.distance_km);
        }
      }
      
      // Apply limit after all processing
      return result.slice(0, limit);
    } catch (error) {
      console.error('Error getting products by category:', error);
      return { error: `Failed to get products: ${error.message}` };
    }
  }

  private async addToCart(params: any, userId: string) {
    const { product_id, quantity = 1 } = params;
    
    try {
      // Get product details first
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, price, image_url, unit, seller_id')
        .eq('id', product_id)
        .single();
      
      if (productError) throw productError;
      if (!product) throw new Error('Product not found');
      
      // Use the cart store's addToCart function
      const cartItem = {
        uniqueId: '', // Will be set by database
        product_id: product.id,
        name: product.name,
        price: product.price.toString(),
        quantity: quantity,
        image_url: product.image_url || '',
        unit: product.unit || '',
        seller_id: product.seller_id
      };
      
      await useCartStore.getState().addToCart(cartItem);
      
      return {
        message: 'Added to cart successfully',
        product: product.name,
        quantity: quantity
      };
    } catch (error) {
      throw new Error(`Failed to add to cart: ${error.message}`);
    }
  }

  private async getCartItems(userId: string) {
    try {
      // Fetch cart items directly from database
      const { data: cartRows, error } = await supabase
        .from('cart_items')
        .select('id, quantity, price, product_id, seller_id')
        .eq('retailer_id', userId);

      if (error) throw error;

      if (!cartRows || cartRows.length === 0) {
        return [];
      }

      // Fetch product details for all cart items
      const productIds = [...new Set(cartRows.map(r => r.product_id).filter(Boolean))];
      let productMap = new Map<string, any>();
      
      if (productIds.length > 0) {
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('id, name, image_url, unit')
          .in('id', productIds);
        
        if (prodErr) throw prodErr;
        productMap = new Map(products.map(p => [p.id, p]));
      }

      // Map to readable format
      return cartRows.map(row => {
        const product = productMap.get(row.product_id);
        return {
          id: row.id,
          product_id: row.product_id,
          name: product?.name || 'Unknown product',
          price: row.price || 0,
          quantity: row.quantity || 1,
          image_url: product?.image_url || '',
          unit: product?.unit || '',
          seller_id: row.seller_id,
          subtotal: (row.price || 0) * (row.quantity || 1)
        };
      });
    } catch (error) {
      throw new Error(`Failed to get cart: ${error.message}`);
    }
  }

  // Remove item from cart
  private async removeFromCart(params: any, userId: string) {
    const { cart_item_id } = params;
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cart_item_id)
        .eq('retailer_id', userId);

      if (error) throw error;

      return {
        message: 'Item removed from cart successfully',
        cart_item_id
      };
    } catch (error) {
      throw new Error(`Failed to remove item from cart: ${error.message}`);
    }
  }

  // Update cart item quantity
  private async updateCartQuantity(params: any, userId: string) {
    const { cart_item_id, quantity } = params;
    
    try {
      if (quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', cart_item_id)
        .eq('retailer_id', userId);

      if (error) throw error;

      return {
        message: 'Cart quantity updated successfully',
        cart_item_id,
        new_quantity: quantity
      };
    } catch (error) {
      throw new Error(`Failed to update cart quantity: ${error.message}`);
    }
  }

  // Clear entire cart
  private async clearCart(userId: string) {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('retailer_id', userId);

      if (error) throw error;

      return {
        message: 'Cart cleared successfully'
      };
    } catch (error) {
      throw new Error(`Failed to clear cart: ${error.message}`);
    }
  }

  private async getOrderHistory(userId: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)  // Changed from user_id param
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  private async getProductRecommendations(params: any, userId: string) {
    const { category, latitude, longitude, radius_km = 50, limit = 5 } = params;
    
    try {
      let userLat = latitude;
      let userLng = longitude;
      
      // Fetch user location from profile if not provided
      if (!userLat || !userLng) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profile?.latitude && profile?.longitude) {
          userLat = profile.latitude;
          userLng = profile.longitude;
        }
      }
      
      // If we have location, prioritize products from nearby sellers
      if (userLat && userLng) {
        // Get products with seller location information
        let queryBuilder = supabase
          .from('products')
          .select(`
            id, name, price, image_url, category, subcategory,
            description, stock_available, seller_id,
            profiles!seller_id (
              latitude, longitude, business_details,
              seller_details (business_name, seller_type)
            )
          `)
          .gt('stock_available', 0);

        if (category) {
          queryBuilder = queryBuilder.eq('category', category);
        }

        const { data: products, error } = await queryBuilder;
        
        if (error) throw error;
        
        if (products && products.length > 0) {
          // Calculate distances and sort by proximity
          const productsWithDistance = products
            .map(product => {
              const sellerProfile = product.profiles;
              if (sellerProfile?.latitude && sellerProfile?.longitude) {
                const distance = this.calculateDistance(
                  userLat, userLng,
                  sellerProfile.latitude, sellerProfile.longitude
                );
                return { ...product, distance_km: distance };
              }
              return { ...product, distance_km: Infinity };
            })
            .filter(product => product.distance_km <= radius_km)
            .sort((a, b) => a.distance_km - b.distance_km)
            .slice(0, limit);
          
          return productsWithDistance;
        }
      }
      
      // Fallback to simple category-based recommendations
      let queryBuilder = supabase
        .from('products')
        .select(`
          id, name, price, image_url, category, subcategory,
          description, stock_available
        `)
        .gt('stock_available', 0)
        .limit(limit);

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting product recommendations:', error);
      return { error: `Failed to get recommendations: ${error.message}` };
    }
  }

  private async placeOrder(params: any, userId: string) {
    const { delivery_instructions, payment_method = 'cod' } = params;
    
    try {
      // Get cart items directly from database
      const { data: cartRows, error: cartError } = await supabase
        .from('cart_items')
        .select('id, quantity, price, product_id, seller_id')
        .eq('retailer_id', userId);

      if (cartError) throw cartError;

      if (!cartRows || cartRows.length === 0) {
        throw new Error('Cart is empty');
      }

      // Get product details
      const productIds = [...new Set(cartRows.map(r => r.product_id).filter(Boolean))];
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name, unit')
        .in('id', productIds);

      if (prodError) throw prodError;

      const productMap = new Map(products.map(p => [p.id, p]));

      // Get user profile for location and address
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude, business_details')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (!userProfile?.latitude || !userProfile?.longitude) {
        throw new Error('User location not available. Please update your profile with location information.');
      }

      // Build cart items with product info
      const cartItems = cartRows.map(row => {
        const product = productMap.get(row.product_id);
        return {
          uniqueId: row.id,
          product_id: row.product_id,
          name: product?.name || 'Unknown product',
          price: (row.price || 0).toString(),
          quantity: row.quantity || 1,
          image_url: '',
          unit: product?.unit || '',
          seller_id: row.seller_id
        };
      });

      // Group items by seller
      const itemsBySeller = cartItems.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<string, typeof cartItems>);

      // Prepare delivery address
      const deliveryAddress = {
        street: userProfile.business_details?.address || '',
        city: userProfile.business_details?.city || '',
        state: userProfile.business_details?.state || '',
        postal_code: userProfile.business_details?.postal_code || '',
        country: 'India',
        latitude: Number(userProfile.latitude),
        longitude: Number(userProfile.longitude)
      };

      // Calculate distance to each seller
      const sellerDistances: Record<string, { distance: number; location: { latitude: number; longitude: number } }> = {};
      
      for (const sellerId of Object.keys(itemsBySeller)) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', sellerId)
          .single();
          
        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          throw new Error(`Unable to get location for seller ${sellerId}`);
        }
        
        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        const distance = this.calculateDistance(
          Number(userProfile.latitude),
          Number(userProfile.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        sellerDistances[sellerId] = { distance, location: sellerLocation };
      }

      // Find farthest seller for delivery fee calculation
      const farthestSeller = Object.entries(sellerDistances).reduce(
        (farthest, [sellerId, data]) => 
          data.distance > farthest.distance ? { sellerId, distance: data.distance } : farthest,
        { sellerId: '', distance: 0 }
      );

      // Calculate total amount and delivery fee
      const totalAmount = cartItems.reduce((sum, item) => 
        sum + (parseFloat(item.price) * item.quantity), 0
      );
      
      const totalItemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
      
      const deliveryFeeDetails = useCartStore.getState().calculateDeliveryFee(
        totalAmount,
        totalItemCount,
        Number(userProfile.latitude),
        Number(userProfile.longitude),
        sellerDistances[farthestSeller.sellerId].location.latitude,
        sellerDistances[farthestSeller.sellerId].location.longitude
      );

      // Generate order number
      const generateOrderNumber = () => {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `ORD${timestamp}${random}`;
      };

      // Prepare orders by seller
      const ordersBySeller: Record<string, any> = {};
      
      for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
        const subtotal = sellerItems.reduce((total, item) => 
          total + (parseFloat(item.price) * item.quantity), 0
        );
        
        // Only farthest seller pays delivery fee
        const deliveryFeeForSeller = sellerId === farthestSeller.sellerId ? deliveryFeeDetails.fee : 0;
        
        ordersBySeller[sellerId] = {
          user_id: userId,
          seller_id: sellerId,
          items: sellerItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            unit: item.unit
          })),
          total_amount: subtotal,
          delivery_fee: deliveryFeeForSeller,
          status: 'pending',
          payment_method: payment_method,
          delivery_address: userProfile.business_details?.shopName 
            ? `${userProfile.business_details.shopName}, ${userProfile.business_details?.address || ''}`
            : userProfile.business_details?.address || '',
          order_number: generateOrderNumber(),
        };
      }

      // Use MasterOrderService to place the complete order
      const { MasterOrderService } = await import('../../services/masterOrderService');
      
      const result = await MasterOrderService.placeCompleteOrder(
        userId,
        ordersBySeller,
        deliveryAddress,
        totalAmount,
        deliveryFeeDetails.fee,
        payment_method,
        delivery_instructions
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to place order');
      }

      // Clear cart after successful order
      await supabase
        .from('cart_items')
        .delete()
        .eq('retailer_id', userId);

      return {
        message: 'Order placed successfully with Cash on Delivery',
        master_order_id: result.masterOrderId,
        total_amount: totalAmount,
        delivery_fee: deliveryFeeDetails.fee,
        total_with_delivery: totalAmount + deliveryFeeDetails.fee,
        items_count: cartItems.length,
        sellers_count: Object.keys(ordersBySeller).length,
        payment_method: 'cod',
        vehicle_type: deliveryFeeDetails.vehicleType,
        delivery_distance_km: deliveryFeeDetails.distance
      };

    } catch (error) {
      throw new Error(`Failed to place order: ${error.message}`);
    }
  }

  // Helper function to calculate distance between two coordinates
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // List all sellers with optional filtering
  private async listSellers(params: any, userId?: string) {
    const { role, category, location, latitude, longitude, radius_km = 100, limit = 20, offset = 0 } = params;
    
    console.log('listSellers called with params:', params);
    
    try {
      let userLat = latitude;
      let userLng = longitude;
      
      // Fetch user location from profile if not provided but userId is available
      if ((!userLat || !userLng) && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profile?.latitude && profile?.longitude) {
          userLat = profile.latitude;
          userLng = profile.longitude;
        }
      }
      
      let queryBuilder = supabase
        .from('profiles')
        .select(`
          id, 
          business_details,
          latitude,
          longitude,
          shop_image_url,
          role,
          status,
          created_at,
          seller_details!user_id (
            id,
            seller_type,
            business_name,
            owner_name,
            address,
            location_address,
            latitude,
            longitude,
            image_url,
            created_at,
            updated_at
          )
        `)
        .eq('status', 'active')
        .eq('role', 'seller');

      // Filter by seller_type if role parameter is provided (map to seller_type)
      if (role) {
        console.log('Filtering by seller_type:', role);
        // Filter by seller_type in the joined seller_details
        queryBuilder = queryBuilder.not('seller_details', 'is', null);
        // Note: Additional filtering by seller_type will be done in post-processing
      } else {
        // Only show profiles that have seller_details
        console.log('Filtering for profiles with seller role and seller_details');
        queryBuilder = queryBuilder.not('seller_details', 'is', null);
      }

      // Filter by location if specified
      if (location) {
        console.log('Filtering by location:', location);
        queryBuilder = queryBuilder.or(
          `business_details->>address.ilike.%${location}%,business_details->>city.ilike.%${location}%`
        );
      }

      console.log('Executing Supabase query...');
      const { data: sellers, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Initial sellers query result:', sellers?.length || 0, 'sellers found');

      // Filter by seller_type if role parameter is provided
      let filteredSellers = sellers || [];
      if (role && filteredSellers.length > 0) {
        console.log('Filtering by seller_type:', role);
        filteredSellers = filteredSellers.filter(seller => 
          seller.seller_details && seller.seller_details.seller_type === role
        );
        console.log('After seller_type filtering:', filteredSellers.length, 'sellers found');
      }

      // If category filter is specified, find sellers who have products in that category
      if (category && filteredSellers && filteredSellers.length > 0) {
        console.log('Filtering by category:', category);
        const sellerIds = filteredSellers.map(seller => seller.id);
        
        const { data: sellersWithCategory, error: categoryError } = await supabase
          .from('products')
          .select('seller_id')
          .in('seller_id', sellerIds)
          .eq('category', category)
          .gt('stock_available', 0);
        
        if (categoryError) {
          console.error('Category filter error:', categoryError);
          throw categoryError;
        }
        
        const validSellerIds = new Set(sellersWithCategory?.map(p => p.seller_id) || []);
        const categoryFilteredSellers = filteredSellers.filter(seller => validSellerIds.has(seller.id));
        console.log('After category filtering:', categoryFilteredSellers.length, 'sellers found');
        return categoryFilteredSellers;
      }

      let result = filteredSellers || [];
      
      // If user location is available, calculate distances and sort by proximity
      if (userLat && userLng && result.length > 0) {
        console.log('Calculating distances and sorting by proximity');
        result = result
          .map(seller => {
            // Use seller_details location first, then profile location
            const sellerLat = seller.seller_details?.latitude || seller.latitude;
            const sellerLng = seller.seller_details?.longitude || seller.longitude;
            
            if (sellerLat && sellerLng) {
              const distance = this.calculateDistance(
                userLat, userLng,
                sellerLat, sellerLng
              );
              return { ...seller, distance_km: distance };
            }
            return { ...seller, distance_km: Infinity };
          })
          .filter(seller => seller.distance_km <= radius_km)
          .sort((a, b) => a.distance_km - b.distance_km);
        
        console.log('After distance filtering and sorting:', result.length, 'sellers within', radius_km, 'km');
      }
      
      // Apply pagination after distance sorting
      const paginatedResult = result.slice(offset, offset + limit);
      
      console.log('Final listSellers result:', paginatedResult.length, 'sellers');
      return paginatedResult;
    } catch (error) {
      console.error('Error in listSellers:', error);
      return { error: `Failed to list sellers: ${error.message}` };
    }
  }

  // Find nearby wholesalers using Supabase function
  private async findNearbyWholesalers(params: any, userId?: string) {
    let { latitude, longitude, radius_km = 50, limit = 10 } = params;
    
    try {
      // If location not provided, fetch from user profile
      if (!latitude || !longitude) {
        if (!userId) {
          throw new Error('Location required. Please provide latitude and longitude or enable location access in your profile.');
        }
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profileError) throw profileError;
        
        if (!profile?.latitude || !profile?.longitude) {
          throw new Error('Location not found in your profile. Please update your profile with location information.');
        }
        
        latitude = profile.latitude;
        longitude = profile.longitude;
      }
      
      const { data, error } = await supabase
        .rpc('find_nearby_wholesalers', {
          radius_km,
          user_lat: latitude,
          user_lng: longitude
        });

      if (error) throw error;
      
      // Limit results if needed
      return data ? data.slice(0, limit) : [];
    } catch (error: any) {
      console.error('Error finding nearby wholesalers:', error);
      return { error: `Failed to find wholesalers: ${error.message}` };
    }
  }

  // Find nearby manufacturers using Supabase function
  private async findNearbyManufacturers(params: any, userId?: string) {
    let { latitude, longitude, radius_km = 50, limit = 10 } = params;
    
    try {
      // If location not provided, fetch from user profile
      if (!latitude || !longitude) {
        if (!userId) {
          throw new Error('Location required. Please provide latitude and longitude or enable location access in your profile.');
        }
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profileError) throw profileError;
        
        if (!profile?.latitude || !profile?.longitude) {
          throw new Error('Location not found in your profile. Please update your profile with location information.');
        }
        
        latitude = profile.latitude;
        longitude = profile.longitude;
      }
      
      const { data, error } = await supabase
        .rpc('find_nearby_manufacturers', {
          radius_km,
          user_lat: latitude,
          user_lng: longitude
        });

      if (error) throw error;
      
      // Limit results if needed
      return data ? data.slice(0, limit) : [];
    } catch (error: any) {
      console.error('Error finding nearby manufacturers:', error);
      return { error: `Failed to find manufacturers: ${error.message}` };
    }
  }

  // Get products from a specific seller
  private async getSellerProducts(params: any, userId?: string) {
    const { seller_id, category, latitude, longitude, limit = 20 } = params;
    
    try {
      let userLat = latitude;
      let userLng = longitude;
      
      // Fetch user location from profile if not provided but userId is available
      if ((!userLat || !userLng) && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('latitude, longitude, location_address')
          .eq('id', userId)
          .single();
        
        if (profile?.latitude && profile?.longitude) {
          userLat = profile.latitude;
          userLng = profile.longitude;
        }
      }
      
      let queryBuilder = supabase
        .from('products')
        .select(`
          id, name, price, image_url, category, subcategory,
          description, stock_available, unit, min_quantity,
          profiles!seller_id (
            business_details,
            latitude,
            longitude,
            seller_details (business_name, latitude, longitude)
          )
        `)
        .eq('seller_id', seller_id)
        .gt('stock_available', 0)
        .limit(limit);

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data: products, error } = await queryBuilder;
      
      if (error) throw error;
      
      // Add distance information if user location is available
      if (userLat && userLng && products && products.length > 0) {
        const productsWithDistance = products.map(product => {
          const sellerProfile = product.profiles;
          // Use seller_details location first, then profile location
          const sellerLat = sellerProfile?.seller_details?.latitude || sellerProfile?.latitude;
          const sellerLng = sellerProfile?.seller_details?.longitude || sellerProfile?.longitude;
          
          if (sellerLat && sellerLng) {
            const distance = this.calculateDistance(
              userLat, userLng,
              sellerLat, sellerLng
            );
            return { ...product, distance_km: distance };
          }
          return product;
        });
        
        return productsWithDistance;
      }
      
      return products || [];
    } catch (error) {
      console.error('Error getting seller products:', error);
      return { error: `Failed to get seller products: ${error.message}` };
    }
  }

  // Save conversation to database
  async saveConversation(conversation: AIConversation): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .upsert({
          id: conversation.id,
          user_id: conversation.user_id,
          messages: conversation.messages,
          context: conversation.context,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  // Get conversation history
  // Get conversation history
  async getConversation(conversationId: string, userId?: string): Promise<AIConversation | null> {
    try {
      // First try to find by thread_id (for text-based IDs like phone-order-xxx)
      let query = supabase
        .from('ai_conversations')
        .select('*')
        .eq('thread_id', conversationId);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      let { data, error } = await query.single();
      
      // If not found by thread_id and conversationId looks like a UUID, try by id
      if (error && conversationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uuidQuery = supabase
          .from('ai_conversations')
          .select('*')
          .eq('id', conversationId);
        
        if (userId) {
          uuidQuery.eq('user_id', userId);
        }
        
        const uuidResult = await uuidQuery.single();
        data = uuidResult.data;
        error = uuidResult.error;
      }

      if (error) {
        console.log('Conversation not found, will create new one:', conversationId);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }
}

export const bedrockAIService = new BedrockAIService();
export default bedrockAIService;
