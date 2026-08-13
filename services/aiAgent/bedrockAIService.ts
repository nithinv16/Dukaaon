// Bedrock AI Service with Claude Sonnet 4.5 - React Native Compatible with Vision Support
import { BEDROCK_CONFIG, AI_AGENT_CONFIG } from '../../config/awsBedrock';
import { supabase } from '../supabase/supabase';
import { useCartStore } from '../../store/cart';
import { enhancedContextService, EnhancedUserContext } from './enhancedContextService';
import { conversationContextManager } from './conversationContextManager';
import { proxyChat, AiProxyError } from '../ai/aiProxyClient';

// Image content for vision-enabled messages
export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string; // base64 encoded image
  };
}

// Text content
export interface TextContent {
  type: 'text';
  text: string;
}

// Combined content type for multimodal messages
export type MessageContent = string | (TextContent | ImageContent)[];

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
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
  order_items?: any[];
  unavailable_items?: string[];
  search_results?: any[];
  search_query?: string;
}

class BedrockAIService {
  private modelId: string;

  constructor() {
    // React Native compatible initialization - no AWS SDK client needed
    this.modelId = BEDROCK_CONFIG.modelId;
  }

  // Main chat completion method - supports text and images
  async chat(
    messages: AIMessage[],
    userId: string,
    conversationId?: string,
    useStreaming: boolean = false,
    appLanguage?: string  // Optional: override profile language with current app language
  ): Promise<AIResponse> {
    try {
      // Get user context
      const context = await this.getUserContext(userId);

      // Override profile language with app language if provided
      // This ensures AI responds in the user's current app language
      if (appLanguage && context.user_profile) {
        context.user_profile.language = appLanguage;
      }

      // Build conversation context with smart summarization for long conversations
      const contextualizedMessages = await conversationContextManager.buildConversationContext(
        conversationId,
        userId,
        messages
      );

      // Prepare messages with system prompt and context
      const systemMessage = this.buildSystemMessage(context);

      // Update conversation context in enhanced context
      if (conversationId && contextualizedMessages.messages.length > 0) {
        const lastUserMessage = contextualizedMessages.messages
          .filter(m => m.role === 'user')
          .slice(-1)[0];

        if (lastUserMessage) {
          // Will update after getting AI response
          context.conversation_context.current_conversation_id = conversationId;
        }
      }

      // Add summary info to system message if summary exists
      let finalSystemContent = typeof systemMessage.content === 'string'
        ? systemMessage.content
        : '';

      if (contextualizedMessages.has_summary && contextualizedMessages.summary_text) {
        finalSystemContent += `\n\n=== CONVERSATION SUMMARY ===
Previous conversation has been summarized. Key points: ${contextualizedMessages.summary_text.substring(0, 200)}...`;
      }

      // Claude format: system is separate, messages don't include system role
      // Format content for multimodal support (text + images)
      const claudeMessages = contextualizedMessages.messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: this.formatMessageContent(msg.content)
      }));

      // Prepare the request payload for Claude model (Anthropic format)
      const payload = {
        anthropic_version: BEDROCK_CONFIG.anthropicVersion || 'bedrock-2023-05-31',
        max_tokens: BEDROCK_CONFIG.maxTokens,
        temperature: BEDROCK_CONFIG.temperature,
        // Note: top_p removed - Claude Sonnet 4.5 doesn't allow both temperature and top_p
        system: finalSystemContent,
        messages: claudeMessages,
        tools: this.getClaudeTools(),
      };

      if (useStreaming) {
        return await this.streamResponse(payload, conversationId);
      } else {
        const response = await this.getSingleResponse(payload, conversationId);

        // Update conversation context after getting response
        if (conversationId && contextualizedMessages.messages.length > 0) {
          const lastUserMessage = contextualizedMessages.messages
            .filter(m => m.role === 'user')
            .slice(-1)[0];

          if (lastUserMessage) {
            const aiResponseMessage: AIMessage = {
              role: 'assistant',
              content: response.content,
              timestamp: new Date(),
              function_calls: response.function_calls
            };

            // Update conversation context asynchronously (don't wait)
            conversationContextManager.updateConversationContext(
              conversationId,
              userId,
              lastUserMessage,
              aiResponseMessage
            ).catch(err => {
              console.error('[BedrockAIService] Error updating conversation context:', err);
            });
          }
        }

        return response;
      }
    } catch (error: any) {
      console.error('Bedrock AI Service Error:', error);
      throw new Error(`AI Service Error: ${error.message}`);
    }
  }

  // Format message content for Claude's multimodal API
  private formatMessageContent(content: MessageContent): any {
    // If content is already an array (multimodal), return as is
    if (Array.isArray(content)) {
      return content;
    }
    // If content is a string, wrap it in text format for Claude
    return content;
  }

  // Process image with product list extraction
  async processProductListImage(
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    userId: string
  ): Promise<AIResponse> {
    // Create a message with the image and instructions
    const imageMessage: AIMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64
          }
        },
        {
          type: 'text',
          text: `Please analyze this product list image and extract all products with their quantities.

For each product found:
1. Extract the product name
2. Extract the quantity if mentioned
3. Note the unit (kg, pieces, packets, etc.) if specified

After extracting the products, I will search for them in nearby seller inventories (within 50km) and provide you with:
- Products found with seller details and prices
- Products not available in any nearby seller's inventory

Please list all products you can see in the image in this format:
- Product Name | Quantity | Unit

If you're unsure about any product or quantity, please indicate that so we can confirm with the user.`
        }
      ],
      timestamp: new Date()
    };

    // Process with the AI
    return await this.chat([imageMessage], userId);
  }

  // Match extracted products to seller inventory within radius
  async matchProductsToInventory(
    extractedProducts: Array<{ name: string; quantity: number; unit?: string }>,
    userId: string,
    radiusKm: number = 50
  ): Promise<{
    found: Array<{
      product: any;
      seller: any;
      distance_km: number;
      extracted_qty: number;
      extracted_unit?: string;
    }>;
    notFound: Array<{ name: string; quantity: number; unit?: string }>;
  }> {
    try {
      // Get user's location
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('latitude, longitude, business_details')
        .eq('id', userId)
        .single();

      const userLat = userProfile?.business_details?.latitude || userProfile?.latitude;
      const userLon = userProfile?.business_details?.longitude || userProfile?.longitude;

      if (!userLat || !userLon) {
        throw new Error('User location not available. Please update your business address.');
      }

      const found: Array<{
        product: any;
        seller: any;
        distance_km: number;
        extracted_qty: number;
        extracted_unit?: string;
      }> = [];
      const notFound: Array<{ name: string; quantity: number; unit?: string }> = [];

      // Search for each product
      for (const extracted of extractedProducts) {
        // Search products with seller info
        const { data: products, error } = await supabase
          .from('products')
          .select(`
            id, name, price, image_url, category, subcategory, brand,
            description, stock_available, unit, min_quantity, seller_id,
            profiles!products_seller_id_fkey (
              id, business_details, latitude, longitude,
              seller_details (
                business_name, seller_type, latitude, longitude
              )
            )
          `)
          .or(`name.ilike.%${extracted.name}%,brand.ilike.%${extracted.name}%`)
          .eq('status', 'active')
          .limit(20);

        if (error || !products || products.length === 0) {
          notFound.push(extracted);
          continue;
        }

        // Find best matching product from nearby sellers
        let bestMatch: any = null;
        let bestDistance = Infinity;

        for (const product of products) {
          const profile = product.profiles;
          if (!profile) continue;

          // Get seller coordinates
          const sellerLat = profile.seller_details?.[0]?.latitude || profile.latitude || profile.business_details?.latitude;
          const sellerLon = profile.seller_details?.[0]?.longitude || profile.longitude || profile.business_details?.longitude;

          if (!sellerLat || !sellerLon) continue;

          // Calculate distance
          const distance = this.calculateDistance(userLat, userLon, sellerLat, sellerLon);

          if (distance <= radiusKm && distance < bestDistance) {
            bestDistance = distance;
            bestMatch = {
              product: {
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                category: product.category,
                subcategory: product.subcategory,
                brand: product.brand,
                stock_available: product.stock_available,
                unit: product.unit,
                min_quantity: product.min_quantity
              },
              seller: {
                id: product.seller_id,
                name: profile.seller_details?.[0]?.business_name || profile.business_details?.shopName || 'Unknown Seller',
                type: profile.seller_details?.[0]?.seller_type || 'wholesaler'
              },
              distance_km: Math.round(distance * 10) / 10,
              extracted_qty: extracted.quantity,
              extracted_unit: extracted.unit
            };
          }
        }

        if (bestMatch) {
          found.push(bestMatch);
        } else {
          notFound.push(extracted);
        }
      }

      return { found, notFound };
    } catch (error: any) {
      console.error('Error matching products to inventory:', error);
      throw error;
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

  /**
   * Invoke Claude through the `ai-chat` edge function.
   *
   * This used to construct a BedrockRuntimeClient in the app with
   * EXPO_PUBLIC_AWS_ACCESS_KEY_ID / EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY. Metro
   * inlines those as string literals, so a long-lived IAM credential valid
   * against the entire AWS account was recoverable from any shipped APK. The
   * credentials now exist only in the edge function's environment.
   *
   * Returns the raw Claude response shape so `parseBedrockResponse` — including
   * its `tool_use` handling — continues to work unchanged. `modelId`,
   * `anthropic_version` and the token ceiling are now decided server-side.
   */
  private async invokeBedrockModel(payload: any): Promise<any> {
    try {
      const result = await proxyChat({
        messages: payload.messages,
        system: payload.system,
        tools: payload.tools,
        maxTokens: payload.max_tokens,
        temperature: payload.temperature,
      });

      // Reassemble the Bedrock/Anthropic response envelope the parser expects.
      return {
        content: result.content,
        stop_reason: result.stopReason,
        usage: {
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
        },
      };
    } catch (error: any) {
      console.error('[Bedrock] AI proxy invocation failed:', error);

      // Surface quota exhaustion distinctly — it is transient and retryable,
      // unlike a malformed request or a provider outage.
      if (error instanceof AiProxyError && error.code === 'RATE_LIMITED') {
        const wait = error.retryAfterSeconds ?? 60;
        throw new Error(
          `AI request limit reached. Please try again in ${wait} second${wait === 1 ? '' : 's'}.`
        );
      }

      throw new Error(`AI Service Error: ${error.message}`);
    }
  }

  // Parse Bedrock response - supports Claude (primary) and OpenAI formats
  private parseBedrockResponse(response: any): AIResponse {
    try {
      // Enhanced logging for debugging
      console.log('Bedrock response structure:', JSON.stringify(response, null, 2));

      // PRIMARY: Handle Claude 3.5 Sonnet response format with content array
      if (response.content && Array.isArray(response.content)) {
        let content = '';
        let functionCalls: AIFunctionCall[] = [];

        for (const item of response.content) {
          if (item.type === 'text') {
            content += item.text;
          } else if (item.type === 'tool_use') {
            console.log('Claude tool call detected:', item.name, item.input);
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
          confidence: 0.95 // Claude tends to have high quality responses
        };
      }

      // FALLBACK: Handle OpenAI response format from AWS Bedrock
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

      // Handle direct response format from Bedrock API (legacy)
      if (response.completion) {
        let content = response.completion;
        content = this.removeReasoningSection(content);

        return {
          content: content,
          function_calls: [],
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

  // Build system message with enhanced context
  private buildSystemMessage(context: EnhancedUserContext): AIMessage {
    let systemContent = AI_AGENT_CONFIG.systemPrompt;

    // Add user profile context
    if (context.user_profile) {
      systemContent += `\n\n=== USER PROFILE ===
- Business: ${context.user_profile.business_name}
- Location: ${context.user_profile.location.city}, ${context.user_profile.location.state}
- Address: ${context.user_profile.location.address}
- Language: ${context.user_profile.language}
- Coordinates: ${context.user_profile.location.latitude}, ${context.user_profile.location.longitude}`;

      // Add language response instruction
      const userLanguage = context.user_profile.language || 'en';
      if (userLanguage !== 'en') {
        const languageNames: Record<string, string> = {
          'hi': 'Hindi (हिंदी)',
          'ml': 'Malayalam (മലയാളം)',
          'ta': 'Tamil (தமிழ்)',
          'te': 'Telugu (తెలుగు)',
          'kn': 'Kannada (ಕన ್ನಡ)',
          'mr': 'Marathi (मराठी)',
          'bn': 'Bengali (বাংলা)'
        };
        const langName = languageNames[userLanguage] || userLanguage;
        systemContent += `\n\n=== IMPORTANT: LANGUAGE INSTRUCTION ===
The user's preferred language is ${langName}. Respond ENTIRELY in ${langName}.

TRANSLATE EVERYTHING including:
- All conversational messages and greetings
- Product names and descriptions
- Category and subcategory names  
- Status updates and confirmations
- Seller/wholesaler names (if translatable)
- All text shown to the user

KEEP THESE IN ORIGINAL FORMAT (do not translate):
- JSON structure keys (type, name, price, quantity, available_items, etc.)
- Numbers and currency symbols (₹)
- Unit abbreviations (kg, L, pcs, g, ml)
- Brand names that are proper nouns (Amul, Britannia, Parle, Tata, etc.)

EXAMPLE CORRECT RESPONSE in ${langName}:
{
  "type": "order_review",
  "message": "[translated message in ${langName}]",
  "available_items": [
    {"name": "[product name in ${langName}]", "unit_price": 250, "quantity": 2, "unit": "kg"}
  ],
  "unavailable_items": ["[item name in ${langName}]"]
}

Write naturally in ${langName} script. Use emojis for visual emphasis: ✅ ❌ 📦 💰 🛒 ⚠️ 📍`;
      }
    }

    // Add current cart context
    if (context.current_cart && context.current_cart.item_count > 0) {
      systemContent += `\n\n=== CURRENT CART ===
- Items: ${context.current_cart.item_count}
- Total: ₹${context.current_cart.total.toFixed(2)}`;

      // Add cart item details (first 3 items)
      const topItems = context.current_cart.items.slice(0, 3);
      if (topItems.length > 0) {
        systemContent += `\n- Top items: ${topItems.map(item =>
          `${item.product?.name || 'Item'} (${item.quantity}x)`
        ).join(', ')}`;
      }
    }

    // Add order history insights
    if (context.order_history && context.order_history.total_orders > 0) {
      systemContent += `\n\n=== ORDER HISTORY INSIGHTS ===
- Total orders: ${context.order_history.total_orders}
- Average order value: ₹${context.order_history.average_order_value.toFixed(2)}
- Ordering frequency: ${context.order_history.ordering_frequency}
- Typical order size: ${context.order_history.typical_order_size.toFixed(1)} items`;

      if (context.order_history.favorite_categories.length > 0) {
        systemContent += `\n- Favorite categories: ${context.order_history.favorite_categories.join(', ')}`;
      }

      if (context.order_history.favorite_brands.length > 0) {
        systemContent += `\n- Favorite brands: ${context.order_history.favorite_brands.join(', ')}`;
      }

      if (context.order_history.preferred_sellers.length > 0) {
        systemContent += `\n- Preferred sellers: ${context.order_history.preferred_sellers.length} sellers`;
      }
    }

    // Add behavioral patterns
    if (context.behavior_patterns) {
      if (context.behavior_patterns.preferred_order_time.length > 0) {
        systemContent += `\n\n=== BEHAVIOR PATTERNS ===
- Preferred order time: ${context.behavior_patterns.preferred_order_time.join(', ')}`;
      }

      if (context.behavior_patterns.preferred_payment_method) {
        systemContent += `\n- Preferred payment method: ${context.behavior_patterns.preferred_payment_method}`;
      }

      if (context.behavior_patterns.repeat_purchase_rate > 0) {
        systemContent += `\n- Repeat purchase rate: ${(context.behavior_patterns.repeat_purchase_rate * 100).toFixed(0)}%`;
      }

      if (context.behavior_patterns.search_patterns.length > 0) {
        systemContent += `\n- Recent search patterns: ${context.behavior_patterns.search_patterns.slice(0, 3).join(', ')}`;
      }
    }

    // Add learned preferences
    if (context.learned_preferences) {
      systemContent += `\n\n=== LEARNED PREFERENCES ===
- Price sensitivity: ${context.learned_preferences.price_sensitivity}
- Quality preference: ${context.learned_preferences.quality_preference}
- Delivery speed preference: ${context.learned_preferences.delivery_speed_preference}
- Bulk buying tendency: ${context.learned_preferences.bulk_buying_tendency ? 'Yes' : 'No'}`;

      // Add top brands if available
      const topBrands = Object.entries(context.learned_preferences.brand_loyalty)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([brand]) => brand);

      if (topBrands.length > 0) {
        systemContent += `\n- Top preferred brands: ${topBrands.join(', ')}`;
      }

      // Add top categories if available
      const topCategories = Object.entries(context.learned_preferences.category_preferences)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([category]) => category);

      if (topCategories.length > 0) {
        systemContent += `\n- Top preferred categories: ${topCategories.join(', ')}`;
      }
    }

    // Add contextual information
    if (context.contextual_info) {
      systemContent += `\n\n=== CURRENT CONTEXT ===
- Time: ${context.contextual_info.current_time} on ${context.contextual_info.day_of_week}
- Season: ${context.contextual_info.season}`;

      if (context.contextual_info.price_drops && context.contextual_info.price_drops.length > 0) {
        systemContent += `\n- Price drops available: ${context.contextual_info.price_drops.length} products`;
      }

      if (context.contextual_info.stockout_alerts && context.contextual_info.stockout_alerts.length > 0) {
        systemContent += `\n- Stock alerts: ${context.contextual_info.stockout_alerts.length} products running low`;
      }

      if (context.contextual_info.new_products_available && context.contextual_info.new_products_available.length > 0) {
        systemContent += `\n- New products available: ${context.contextual_info.new_products_available.length} items`;
      }
    }

    // Add conversation context if available
    if (context.conversation_context && context.conversation_context.conversation_topic) {
      systemContent += `\n\n=== CURRENT CONVERSATION ===
- Topic: ${context.conversation_context.conversation_topic}
- Intent: ${context.conversation_context.user_intent}`;

      if (context.conversation_context.mentioned_products.length > 0) {
        systemContent += `\n- Products mentioned: ${context.conversation_context.mentioned_products.join(', ')}`;
      }

      if (context.conversation_context.mentioned_categories.length > 0) {
        systemContent += `\n- Categories mentioned: ${context.conversation_context.mentioned_categories.join(', ')}`;
      }
    }

    return {
      role: 'system',
      content: systemContent,
      timestamp: new Date()
    };
  }

  // Get enhanced user context using the enhanced context service
  private async getUserContext(userId: string): Promise<EnhancedUserContext> {
    try {
      // Use the enhanced context service for comprehensive context
      const enhancedContext = await enhancedContextService.getUserContext(userId);

      // Log context loading for debugging (optional)
      if (__DEV__) {
        console.log('[BedrockAIService] Enhanced context loaded:', {
          orders: enhancedContext.order_history.total_orders,
          cartItems: enhancedContext.current_cart.item_count,
          preferences: Object.keys(enhancedContext.learned_preferences.brand_loyalty).length
        });
      }

      return enhancedContext;
    } catch (error) {
      console.error('[BedrockAIService] Error getting enhanced user context:', error);

      // Fallback to minimal context if enhanced service fails
      // The enhanced service already handles errors internally, but we add extra safety
      try {
        return await enhancedContextService.getUserContext(userId);
      } catch (fallbackError) {
        console.error('[BedrockAIService] Fallback context also failed:', fallbackError);
        // Return minimal context structure
        return {
          user_profile: {
            id: userId,
            role: 'retailer',
            business_name: 'Unknown',
            location: {
              latitude: 0,
              longitude: 0,
              address: '',
              city: '',
              state: ''
            },
            language: 'en',
            preferences: {}
          },
          current_cart: {
            items: [],
            total: 0,
            item_count: 0
          },
          order_history: {
            recent_orders: [],
            total_orders: 0,
            average_order_value: 0,
            favorite_categories: [],
            favorite_brands: [],
            preferred_sellers: [],
            ordering_frequency: 'occasional',
            typical_order_size: 0,
            seasonal_patterns: {}
          },
          behavior_patterns: {
            preferred_order_time: [],
            preferred_payment_method: 'cod',
            browsing_history: [],
            search_patterns: [],
            abandoned_carts: 0,
            repeat_purchase_rate: 0
          },
          learned_preferences: {
            price_sensitivity: 'medium',
            quality_preference: 'standard',
            brand_loyalty: {},
            category_preferences: {},
            delivery_speed_preference: 'standard',
            bulk_buying_tendency: false
          },
          contextual_info: {
            current_time: new Date().toLocaleTimeString(),
            day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            season: 'Unknown'
          },
          conversation_context: {
            current_conversation_id: '',
            conversation_topic: '',
            mentioned_products: [],
            mentioned_categories: [],
            user_intent: ''
          }
        };
      }
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
              },
              requested_quantity: {
                type: "number",
                description: "Quantity requested by user (from image or text). Used for order preview. If less than product's min_quantity, min_quantity will be used.",
                default: 1
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
          description: "Get ALL products from a category, subcategory, or by searching product names/descriptions. Use this when user asks for a category or type of products like 'vegetables', 'blades', 'shaving products', 'men's grooming', 'groceries', 'snacks', etc. This function DYNAMICALLY checks database categories/subcategories first, and if no match found, searches in product names and descriptions. Can return up to 200 products. Always use this for category/type browsing requests.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Category, subcategory, or product type to search for (case-insensitive). Examples: 'vegetables', 'blades', 'shaving', 'groceries', 'snacks', 'personal care', 'beverages', 'razor'. The function first checks database categories/subcategories, then searches in product names and descriptions if no category match."
              },
              subcategory: {
                type: "string",
                description: "Specific subcategory to filter (optional). Examples: 'Shaving', 'Biscuits', 'Soft Drinks'"
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
                description: "Maximum number of products to return. Default 50, max 200. Use higher values for browsing full category.",
                default: 50
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
          description: "Add a product to the user's shopping cart. IMPORTANT: product_id must be the UUID returned from search_products, NOT the product name. Always search first to get the UUID.",
          parameters: {
            type: "object",
            properties: {
              product_id: {
                type: "string",
                description: "UUID of the product (from search_products results), e.g. '89c401ec-1e47-43ac-9e12-23839b7c742f'. NOT a product name."
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
          description: "Place an order directly with specified items OR use items from cart. Can accept items array directly for quick ordering from image product lists. User ID and location are automatically provided.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                description: "Array of items to order directly (optional - if not provided, uses cart items). Each item needs: product_id (UUID), quantity, unit_price",
                items: {
                  type: "object",
                  properties: {
                    product_id: { type: "string", description: "Product UUID from search_products" },
                    quantity: { type: "number", description: "Quantity to order" },
                    unit_price: { type: "number", description: "Price per unit" }
                  },
                  required: ["product_id", "quantity", "unit_price"]
                }
              },
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

  // Convert tools to Claude format (Anthropic uses different structure)
  private getClaudeTools() {
    const openAITools = this.getAvailableTools();
    // Claude tool format: { name, description, input_schema }
    // OpenAI format: { type: "function", function: { name, description, parameters } }
    return openAITools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }

  // Execute function calls - made public for external access
  // Returns both formatted string and raw results for direct parsing
  async executeFunctionCalls(functionCalls: AIFunctionCall[], userId: string): Promise<string> {
    const { formattedResult } = await this.executeFunctionCallsWithRaw(functionCalls, userId);
    return formattedResult;
  }

  // Execute function calls with raw results - for parsing product data
  async executeFunctionCallsWithRaw(functionCalls: AIFunctionCall[], userId: string): Promise<{ formattedResult: string; rawResults: Record<string, any> }> {
    const results: string[] = [];
    const rawResults: Record<string, any> = {};

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

        // Store raw result for direct access
        rawResults[call.name] = result;

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
        rawResults[call.name] = { error: error.message };
      }
    }

    const combinedResult = results.join('\n\n');
    console.log('Combined function execution results:', combinedResult.substring(0, 500));
    return { formattedResult: combinedResult, rawResults };
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
    const { query, category, subcategory, brand, seller_id, limit = 10, price_range, sort_by, radius_km = 100 } = params;
    let { latitude, longitude } = params;

    console.log(`[searchProducts] Query: "${query}", Radius: ${radius_km}km, Limit: ${limit}`);

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
          console.log(`[searchProducts] User location: ${latitude}, ${longitude}, ${userProfile.location_address}`);
        } else {
          console.log('[searchProducts] No user location found, will search all products');
        }
      } catch (error) {
        console.log('[searchProducts] Could not fetch user location:', error);
      }
    }

    // Use location-based search if location is available
    if (latitude && longitude) {
      try {
        // Import ProductSearchService for location-based search
        const ProductSearchService = (await import('../productSearchService')).default;

        // Progressive radius search: first 20km, then expand to 50km if no results
        const radiusLevels = [20, 50];
        let filteredResults: any[] = [];

        for (const currentRadius of radiusLevels) {
          const searchOptions = {
            query,
            userLatitude: latitude,
            userLongitude: longitude,
            radiusKm: currentRadius,
            limit,
            includeOutOfStock: false
          };

          console.log(`[searchProducts] Searching within ${currentRadius}km radius...`);
          const locationBasedResults = await ProductSearchService.searchProducts(searchOptions);

          // Apply additional filters to location-based results
          filteredResults = locationBasedResults.products || [];

          // Get meaningful search words for relevance filtering
          const stopWords = ['show', 'me', 'find', 'search', 'for', 'get', 'want', 'need', 'buy', 'order'];
          const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
          const searchWords = queryWords.filter((w: string) => !stopWords.includes(w));
          const meaningfulWords = searchWords.length > 0 ? searchWords : queryWords;

          // PRIMARY WORD (usually brand name) MUST match for strict relevance
          const primaryWord = meaningfulWords[0] || query.toLowerCase().split(/\s+/)[0];

          // Filter for strict relevance - primary word MUST be in product name or brand
          if (primaryWord) {
            filteredResults = filteredResults.filter((product: any) => {
              const productName = (product.name || '').toLowerCase();
              const productBrand = (product.brand || '').toLowerCase();
              const productNameAndBrand = `${productName} ${productBrand}`;
              return productNameAndBrand.includes(primaryWord);
            });
          }

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

          // If we found results, stop expanding radius
          if (filteredResults.length > 0) {
            console.log(`[searchProducts] Found ${filteredResults.length} products within ${currentRadius}km`);
            break;
          } else {
            console.log(`[searchProducts] No products found within ${currentRadius}km, expanding search...`);
          }
        }

        // Sort by relevance: products with more matching words come first
        const queryWordsForSort = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);
        filteredResults.sort((a: any, b: any) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();

          // Count how many search words match in each product name
          const aMatches = queryWordsForSort.filter((w: string) => aName.includes(w)).length;
          const bMatches = queryWordsForSort.filter((w: string) => bName.includes(w)).length;

          // Products with full query match come first
          const aFullMatch = aName.includes(query.toLowerCase()) ? 1 : 0;
          const bFullMatch = bName.includes(query.toLowerCase()) ? 1 : 0;

          // Sort by full match first, then by word match count, then by distance
          if (bFullMatch !== aFullMatch) return bFullMatch - aFullMatch;
          if (bMatches !== aMatches) return bMatches - aMatches;
          return (a.distance_km || 0) - (b.distance_km || 0);  // Closer products first
        });

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
    console.log('[searchProducts] Using fallback direct database search...');

    // Intelligent query processing - split into words and create focused search conditions
    const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 1);

    // Remove common words that add noise
    const stopWords = ['show', 'me', 'find', 'search', 'for', 'get', 'want', 'need', 'buy', 'order'];
    const meaningfulWords = queryWords.filter(w => !stopWords.includes(w));

    // Use meaningful words if available, otherwise use all query words
    let searchWords = meaningfulWords.length > 0 ? meaningfulWords : queryWords;

    // FUZZY BRAND MATCHING: Expand common brand variations
    const brandVariations: Record<string, string[]> = {
      'parleg': ['parle', 'parle-g', 'parle g'],
      'parle': ['parle-g', 'parle g', 'parleg'],
      'britannia': ['britania'],
      'goodday': ['good day', 'good-day'],
      'maggi': ['maggie', 'magi'],
      'nestle': ['nestlé'],
      'amul': ['amool'],
    };

    // Expand search words with variations
    const expandedWords: string[] = [...searchWords];
    for (const word of searchWords) {
      if (brandVariations[word]) {
        expandedWords.push(...brandVariations[word]);
      }
    }
    searchWords = [...new Set(expandedWords)]; // Deduplicate

    console.log('[searchProducts] Expanded search words:', searchWords);

    // Build focused search conditions - prioritize name and brand matches
    const searchConditions: string[] = [];

    // Strategy 1: Search for the full query in name/brand only (not description to avoid noise)
    searchConditions.push(`name.ilike.%${query}%`);
    searchConditions.push(`brand.ilike.%${query}%`);

    // Strategy 2: Search for each search word (including variations) in name/brand
    for (const word of searchWords) {
      searchConditions.push(`name.ilike.%${word}%`);
      searchConditions.push(`brand.ilike.%${word}%`);
    }

    // Strategy 3: Search for combinations of adjacent words (for brand-product combos like "parle g")
    if (searchWords.length >= 2) {
      for (let i = 0; i < searchWords.length - 1; i++) {
        const combo = `${searchWords[i]} ${searchWords[i + 1]}`;
        searchConditions.push(`name.ilike.%${combo}%`);
      }
      // Also try with hyphen (e.g., "parle-g")
      for (let i = 0; i < searchWords.length - 1; i++) {
        const combo = `${searchWords[i]}-${searchWords[i + 1]}`;
        searchConditions.push(`name.ilike.%${combo}%`);
      }
    }

    console.log('[searchProducts] Search words:', searchWords, 'Conditions count:', searchConditions.length);

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
      .or(searchConditions.join(','))
      .gt('stock_available', 0)
      .limit(limit * 3);  // Fetch more to filter for relevance

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

    // Relevance filtering - check if ANY of the search words (including variations) match
    // For "parleg" -> searchWords includes ["parleg", "parle", "parle-g", "parle g"]
    console.log('[searchProducts] Filtering with search words:', searchWords);

    const filteredData = (data || []).filter((product: any) => {
      const productName = (product.name || '').toLowerCase();
      const productBrand = (product.brand || '').toLowerCase();
      const productNameAndBrand = `${productName} ${productBrand}`;

      // Check if ANY search word matches the product name or brand
      const hasAnyMatch = searchWords.some((word: string) => productNameAndBrand.includes(word));

      if (!hasAnyMatch) {
        // Only log first few filtered products to avoid spam
        if (filteredData.length < 3) {
          console.log('[searchProducts] Filtering out (no match):', product.name);
        }
        return false;
      }

      return true;
    });

    // Sort by relevance: products with more matching words come first
    const primarySearchWord = searchWords[0] || '';
    filteredData.sort((a: any, b: any) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aBrand = (a.brand || '').toLowerCase();
      const bBrand = (b.brand || '').toLowerCase();

      // Count how many search words match in each product
      const aMatches = searchWords.filter((w: string) => aName.includes(w) || aBrand.includes(w)).length;
      const bMatches = searchWords.filter((w: string) => bName.includes(w) || bBrand.includes(w)).length;

      // Products with full query match come first
      const aFullMatch = aName.includes(query.toLowerCase()) ? 2 :
        aName.includes(primarySearchWord) && aBrand.includes(primarySearchWord) ? 1 : 0;
      const bFullMatch = bName.includes(query.toLowerCase()) ? 2 :
        bName.includes(primarySearchWord) && bBrand.includes(primarySearchWord) ? 1 : 0;

      // Sort by full match first, then by word match count
      if (bFullMatch !== aFullMatch) return bFullMatch - aFullMatch;
      return bMatches - aMatches;
    });

    console.log('[searchProducts] Filtered from', data?.length, 'to', filteredData.length, 'relevant results');

    return filteredData.slice(0, limit);
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
            seller_details (business_name, seller_type)
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

  // Fetch available categories and subcategories from the database
  private async getAvailableCategoriesFromDB(): Promise<{ categories: string[]; subcategories: string[] }> {
    try {
      // Get distinct categories
      const { data: categoryData } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .gt('stock_available', 0);

      // Get distinct subcategories
      const { data: subcategoryData } = await supabase
        .from('products')
        .select('subcategory')
        .not('subcategory', 'is', null)
        .gt('stock_available', 0);

      const categories = [...new Set((categoryData || []).map(d => d.category).filter(Boolean))];
      const subcategories = [...new Set((subcategoryData || []).map(d => d.subcategory).filter(Boolean))];

      console.log('[getAvailableCategoriesFromDB] Found categories:', categories);
      console.log('[getAvailableCategoriesFromDB] Found subcategories:', subcategories);

      return { categories, subcategories };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { categories: [], subcategories: [] };
    }
  }

  // Find matching category/subcategory from database using fuzzy matching
  private findMatchingCategoryOrSubcategory(
    query: string,
    categories: string[],
    subcategories: string[]
  ): { matchedCategory: string | null; matchedSubcategory: string | null; isExactMatch: boolean } {
    const lowerQuery = query.toLowerCase().trim();

    // Check for exact match in categories (case-insensitive)
    for (const cat of categories) {
      if (cat.toLowerCase() === lowerQuery) {
        return { matchedCategory: cat, matchedSubcategory: null, isExactMatch: true };
      }
    }

    // Check for exact match in subcategories (case-insensitive)
    for (const subcat of subcategories) {
      if (subcat.toLowerCase() === lowerQuery) {
        return { matchedCategory: null, matchedSubcategory: subcat, isExactMatch: true };
      }
    }

    // Check for partial match in categories (query is contained in category or vice versa)
    for (const cat of categories) {
      const lowerCat = cat.toLowerCase();
      if (lowerCat.includes(lowerQuery) || lowerQuery.includes(lowerCat)) {
        return { matchedCategory: cat, matchedSubcategory: null, isExactMatch: false };
      }
    }

    // Check for partial match in subcategories
    for (const subcat of subcategories) {
      const lowerSubcat = subcat.toLowerCase();
      if (lowerSubcat.includes(lowerQuery) || lowerQuery.includes(lowerSubcat)) {
        return { matchedCategory: null, matchedSubcategory: subcat, isExactMatch: false };
      }
    }

    // No category/subcategory match found
    return { matchedCategory: null, matchedSubcategory: null, isExactMatch: false };
  }

  // Get products by category with advanced filtering and intelligent matching
  // This function dynamically checks database categories and falls back to name/description search
  private async getProductsByCategory(params: any, userId?: string) {
    const { category, subcategory, brand, price_min, price_max, latitude, longitude, radius_km = 100, sort_by, limit = 50 } = params;

    // Enforce a reasonable max limit (can be increased if needed)
    const effectiveLimit = Math.min(limit, 200);

    console.log('[getProductsByCategory] Searching for category:', category, 'subcategory:', subcategory);

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

      // Step 1: Fetch available categories and subcategories from the database
      const { categories, subcategories } = await this.getAvailableCategoriesFromDB();

      // Step 2: Try to match the search term to a category or subcategory
      const searchTerm = category || '';
      const { matchedCategory, matchedSubcategory, isExactMatch } = this.findMatchingCategoryOrSubcategory(
        searchTerm,
        categories,
        subcategories
      );

      console.log('[getProductsByCategory] Match result:', {
        searchTerm,
        matchedCategory,
        matchedSubcategory,
        isExactMatch,
        providedSubcategory: subcategory
      });

      // Build query
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
        .gt('stock_available', 0);

      // Step 3: Apply filters based on what we found
      if (subcategory) {
        // If explicit subcategory is provided, use it
        queryBuilder = queryBuilder.ilike('subcategory', `%${subcategory}%`);
        if (matchedCategory) {
          queryBuilder = queryBuilder.ilike('category', `%${matchedCategory}%`);
        }
      } else if (matchedCategory) {
        // Exact or partial category match found
        if (isExactMatch) {
          queryBuilder = queryBuilder.ilike('category', matchedCategory);
        } else {
          queryBuilder = queryBuilder.ilike('category', `%${matchedCategory}%`);
        }
      } else if (matchedSubcategory) {
        // Subcategory match found
        if (isExactMatch) {
          queryBuilder = queryBuilder.ilike('subcategory', matchedSubcategory);
        } else {
          queryBuilder = queryBuilder.ilike('subcategory', `%${matchedSubcategory}%`);
        }
      } else {
        // No category/subcategory match - search in name, description, and brand
        // This handles cases like "blades" which might be in product name or description
        console.log('[getProductsByCategory] No category match, searching in name/description for:', searchTerm);
        queryBuilder = queryBuilder.or(
          `name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,subcategory.ilike.%${searchTerm}%`
        );
      }

      if (brand) {
        queryBuilder = queryBuilder.ilike('brand', `%${brand}%`);
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
      } else {
        // Default: sort by name
        queryBuilder = queryBuilder.order('name', { ascending: true });
      }

      // Fetch more than limit to allow for distance filtering
      queryBuilder = queryBuilder.limit(effectiveLimit * 2);

      const { data: products, error } = await queryBuilder;

      if (error) throw error;

      let result = products || [];
      console.log('[getProductsByCategory] Found', result.length, 'products before distance filtering');

      // If user location is available, calculate distances
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

        // Filter by radius
        result = result.filter(product => product.distance_km <= radius_km);

        // Sort by distance if requested, or as secondary sort
        if (sort_by === 'distance' || !sort_by) {
          result = result.sort((a, b) => a.distance_km - b.distance_km);
        }
      }

      // Apply limit after all processing
      const finalResult = result.slice(0, effectiveLimit);

      // Log what we're returning
      const matchInfo = matchedCategory ? `category: ${matchedCategory}` :
        matchedSubcategory ? `subcategory: ${matchedSubcategory}` :
          'name/description search';
      console.log('[getProductsByCategory] Returning', finalResult.length, 'products via', matchInfo);

      return finalResult;
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
    const { items: directItems, delivery_instructions, payment_method = 'cod' } = params;

    try {
      let cartRows: any[] = [];

      // Check if direct items are provided (for image-based ordering)
      if (directItems && Array.isArray(directItems) && directItems.length > 0) {
        console.log('[PlaceOrder] Using direct items:', directItems.length);

        // Get product details for direct items
        const productIds = directItems.map((item: any) => item.product_id);
        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id, name, unit, seller_id')
          .in('id', productIds);

        if (prodError) throw prodError;

        const productMap = new Map(products?.map(p => [p.id, p]) || []);

        // Build cart rows from direct items
        cartRows = directItems.map((item: any) => {
          const product = productMap.get(item.product_id);
          return {
            id: `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            quantity: item.quantity,
            price: item.unit_price,
            product_id: item.product_id,
            seller_id: product?.seller_id || null
          };
        });
      } else {
        // Get cart items from database
        console.log('[PlaceOrder] Using cart items for user:', userId);
        const { data: cartData, error: cartError } = await supabase
          .from('cart_items')
          .select('id, quantity, price, product_id, seller_id')
          .eq('retailer_id', userId);

        if (cartError) throw cartError;
        cartRows = cartData || [];
      }

      if (!cartRows || cartRows.length === 0) {
        throw new Error('No items to order. Please add items to your order.');
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
            unit_price: item.price,
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

      // Use the AI order placement service (matches checkout flow exactly)
      const { placeMultiSellerAIOrder } = await import('../../services/aiOrderPlacement');

      const orderResult = await placeMultiSellerAIOrder(userId, ordersBySeller);

      if (!orderResult.success) {
        const errors = orderResult.orders.filter(o => !o.success).map(o => o.error).join(', ');
        throw new Error(`Failed to place order: ${errors}`);
      }

      const successfulOrders = orderResult.orders.filter(o => o.success);

      // Clear cart after successful order
      await supabase
        .from('cart_items')
        .delete()
        .eq('retailer_id', userId);

      return {
        message: `Order placed successfully! ${successfulOrders.length} order(s) created.`,
        order_ids: successfulOrders.map(o => o.orderId),
        order_numbers: successfulOrders.map(o => o.orderNumber),
        total_amount: totalAmount,
        delivery_fee: deliveryFeeDetails.fee,
        total_with_delivery: totalAmount + deliveryFeeDetails.fee,
        items_count: cartItems.length,
        sellers_count: successfulOrders.length,
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
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
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

  // Save conversation to database using proper schema
  async saveConversation(conversation: AIConversation): Promise<void> {
    try {
      // Get or create conversation using thread_id
      const threadId = conversation.id || `conv_${Date.now()}_${conversation.user_id}`;

      const { data: convData, error: convError } = await supabase.rpc('get_or_create_ai_conversation', {
        p_user_id: conversation.user_id,
        p_thread_id: threadId,
        p_title: 'AI Chat Conversation'
      });

      if (convError) throw convError;
      if (!convData) throw new Error('Failed to get or create conversation');

      const conversationId = convData;

      // Save each message individually
      if (conversation.messages && conversation.messages.length > 0) {
        for (const message of conversation.messages) {
          const contentStr = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);

          const { error: msgError } = await supabase.rpc('save_ai_message', {
            p_conversation_id: conversationId,
            p_role: message.role,
            p_content: contentStr,
            p_function_calls: message.function_calls ? JSON.stringify(message.function_calls) : '[]',
            p_metadata: conversation.context ? JSON.stringify(conversation.context) : '{}'
          });

          if (msgError) {
            console.error('Error saving message:', msgError);
          }
        }
      }

      console.log('[BedrockAIService] Saved conversation:', threadId, 'with', conversation.messages?.length || 0, 'messages');
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  // Save a single message to conversation
  async saveMessage(conversationId: string, userId: string, message: AIMessage): Promise<void> {
    try {
      // Get or create conversation
      const { data: convData, error: convError } = await supabase.rpc('get_or_create_ai_conversation', {
        p_user_id: userId,
        p_thread_id: conversationId,
        p_title: 'AI Chat Conversation'
      });

      if (convError) {
        console.error('[BedrockAIService] Error getting/creating conversation:', convError);
        throw convError;
      }
      if (!convData) {
        console.error('[BedrockAIService] Failed to get or create conversation');
        throw new Error('Failed to get or create conversation');
      }

      const dbConversationId = convData;

      // Save the message
      const contentStr = typeof message.content === 'string'
        ? message.content
        : JSON.stringify(message.content);

      // Format function_calls as JSONB (array or object)
      let functionCallsJson = '[]';
      if (message.function_calls) {
        if (Array.isArray(message.function_calls)) {
          functionCallsJson = JSON.stringify(message.function_calls);
        } else {
          functionCallsJson = JSON.stringify([message.function_calls]);
        }
      }

      // Format metadata (includes search_results, order_items, etc.)
      let metadataJson = '{}';
      if ((message as any).metadata) {
        metadataJson = JSON.stringify((message as any).metadata);
      }

      const { error: msgError } = await supabase.rpc('save_ai_message', {
        p_conversation_id: dbConversationId,
        p_role: message.role,
        p_content: contentStr,
        p_function_calls: functionCallsJson,
        p_metadata: metadataJson
      });

      if (msgError) {
        console.error('[BedrockAIService] Error saving message:', msgError);
      } else {
        console.log('[BedrockAIService] Saved message to conversation:', conversationId, 'role:', message.role);
      }
    } catch (error) {
      console.error('[BedrockAIService] Error saving message:', error);
      // Don't throw - saving is non-critical
    }
  }

  // Get conversation history from database
  async getConversation(conversationId: string, userId?: string): Promise<AIConversation | null> {
    try {
      if (!userId) {
        console.log('[BedrockAIService] No userId provided, cannot load conversation');
        return null;
      }

      // Load conversation messages using the database function
      const { data: messages, error } = await supabase.rpc('get_ai_conversation_history', {
        p_user_id: userId,
        p_thread_id: conversationId,
        p_limit: 100
      });

      if (error) {
        console.log('[BedrockAIService] Conversation not found:', conversationId, error.message);
        return null;
      }

      if (!messages || messages.length === 0) {
        console.log('[BedrockAIService] No messages found for conversation:', conversationId);
        return null;
      }

      // Get conversation metadata
      const { data: convData } = await supabase
        .from('ai_conversations')
        .select('id, user_id, thread_id, title, metadata, created_at, updated_at')
        .eq('thread_id', conversationId)
        .eq('user_id', userId)
        .single();

      // Convert database messages to AIMessage format
      const aiMessages: AIMessage[] = messages.map((msg: any) => {
        let functionCalls = undefined;
        if (msg.function_calls) {
          try {
            // Parse function_calls if it's a string
            const parsed = typeof msg.function_calls === 'string'
              ? JSON.parse(msg.function_calls)
              : msg.function_calls;
            // Ensure it's an array
            functionCalls = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
          } catch (e) {
            console.warn('[BedrockAIService] Error parsing function_calls:', e);
          }
        }

        // Parse metadata (contains search_results, order_items, etc.)
        let metadata = undefined;
        if (msg.metadata) {
          try {
            metadata = typeof msg.metadata === 'string'
              ? JSON.parse(msg.metadata)
              : msg.metadata;
          } catch (e) {
            console.warn('[BedrockAIService] Error parsing metadata:', e);
          }
        }

        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: new Date(msg.created_at),
          function_calls: functionCalls,
          metadata: metadata
        };
      });

      const conversation: AIConversation = {
        id: convData?.id || conversationId,
        user_id: userId,
        messages: aiMessages,
        context: convData?.metadata || {},
        created_at: convData?.created_at ? new Date(convData.created_at) : new Date(),
        updated_at: convData?.updated_at ? new Date(convData.updated_at) : new Date()
      };

      console.log('[BedrockAIService] Loaded conversation:', conversationId, 'with', aiMessages.length, 'messages');
      return conversation;
    } catch (error) {
      console.error('[BedrockAIService] Error getting conversation:', error);
      return null;
    }
  }

  // Get all conversations for a user
  async getUserConversations(userId: string): Promise<{
    id: string;
    thread_id: string;
    title: string;
    last_message?: string;
    message_count: number;
    created_at: Date;
    updated_at: Date;
  }[]> {
    try {
      console.log('[BedrockAIService] Getting conversations for user:', userId);

      // Get all conversations for the user
      const { data: conversations, error } = await supabase
        .from('ai_conversations')
        .select(`
          id,
          thread_id,
          title,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[BedrockAIService] Error fetching conversations:', error);
        return [];
      }

      if (!conversations || conversations.length === 0) {
        console.log('[BedrockAIService] No conversations found for user');
        return [];
      }

      // Get message counts and last message for each conversation
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          // Get message count and last message
          const { data: messages, error: msgError } = await supabase
            .from('ai_messages')
            .select('content, role')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const { count } = await supabase
            .from('ai_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          let lastMessage = '';
          if (messages && messages.length > 0) {
            const content = messages[0].content;
            // Truncate to 50 chars
            lastMessage = content.length > 50 ? content.substring(0, 50) + '...' : content;
          }

          return {
            id: conv.id,
            thread_id: conv.thread_id,
            title: conv.title || 'AI Chat',
            last_message: lastMessage,
            message_count: count || 0,
            created_at: new Date(conv.created_at),
            updated_at: new Date(conv.updated_at)
          };
        })
      );

      console.log('[BedrockAIService] Found', conversationsWithDetails.length, 'conversations for user');
      return conversationsWithDetails;
    } catch (error) {
      console.error('[BedrockAIService] Error getting user conversations:', error);
      return [];
    }
  }

  // =====================================================
  // AI FEEDBACK SYSTEM
  // Collects user feedback on AI responses for improvement
  // =====================================================

  // Save user feedback on an AI response
  async saveFeedback(params: {
    messageId: string;
    conversationId: string;
    userId: string;
    rating: 'positive' | 'negative';
    feedbackText?: string;
    feedbackCategory?: 'wrong_product' | 'irrelevant' | 'helpful' | 'accurate' | 'slow' | 'other';
    responseContent: string;
    userQuery?: string;
    functionCalls?: any[];
    searchResultsCount?: number;
    orderItemsCount?: number;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('save_ai_feedback', {
        p_message_id: params.messageId,
        p_conversation_id: params.conversationId,
        p_user_id: params.userId,
        p_rating: params.rating,
        p_feedback_text: params.feedbackText || null,
        p_feedback_category: params.feedbackCategory || null,
        p_response_content: params.responseContent,
        p_user_query: params.userQuery || null,
        p_function_calls: params.functionCalls ? JSON.stringify(params.functionCalls) : '[]',
        p_search_results_count: params.searchResultsCount || 0,
        p_order_items_count: params.orderItemsCount || 0,
        p_metadata: params.metadata ? JSON.stringify(params.metadata) : '{}'
      });

      if (error) {
        console.error('[BedrockAIService] Error saving feedback:', error);
        return { success: false, error: error.message };
      }

      console.log('[BedrockAIService] Feedback saved:', data, 'rating:', params.rating);
      return { success: true, feedbackId: data };
    } catch (error: any) {
      console.error('[BedrockAIService] Error saving feedback:', error);
      return { success: false, error: error.message };
    }
  }

  // Get feedback summary for a user
  async getFeedbackSummary(userId: string): Promise<{
    totalFeedback: number;
    positiveCount: number;
    negativeCount: number;
    positiveRate: number;
  } | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_feedback_summary', {
        p_user_id: userId
      });

      if (error) {
        console.error('[BedrockAIService] Error getting feedback summary:', error);
        return null;
      }

      if (data && data.length > 0) {
        return {
          totalFeedback: data[0].total_feedback || 0,
          positiveCount: data[0].positive_count || 0,
          negativeCount: data[0].negative_count || 0,
          positiveRate: data[0].positive_rate || 0
        };
      }

      return { totalFeedback: 0, positiveCount: 0, negativeCount: 0, positiveRate: 0 };
    } catch (error) {
      console.error('[BedrockAIService] Error getting feedback summary:', error);
      return null;
    }
  }

  // Check if user has already provided feedback for a message
  async hasFeedback(messageId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ai_feedback')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }
}

export const bedrockAIService = new BedrockAIService();
export default bedrockAIService;
