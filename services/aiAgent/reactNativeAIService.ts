/**
 * React Native Compatible AI Service
 * 
 * This service provides AI functionality using AWS Bedrock (Claude 3.5 Sonnet)
 * with React Native compatibility. It uses the bedrockAIService for actual
 * AI processing while providing a React Native-friendly interface.
 */

import { AIMessage, ProductRecommendation } from '../../types/ai';
import { ProductRecommendation as AIProductRecommendation } from '../../components/ai/AIRecommendations';
import { bedrockAIService, AIResponse } from './bedrockAIService';
import { translationService, SupportedLanguage } from '../translationService';
import { useLanguageStore } from '../../store/language';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RecommendationContext {
  userId?: string;
  productId?: string;
  categoryId?: string;
  limit?: number;
  context?: {
    currentCart?: any[];
    recentOrders?: any[];
    preferences?: string[];
    location?: string;
    budget?: number;
  };
}

export interface ReactNativeAIConfig {
  region?: string;
}

export class ReactNativeAIService {
  private config: ReactNativeAIConfig;

  constructor(config: ReactNativeAIConfig = {}) {
    this.config = {
      region: config.region || 'us-east-1',
      ...config
    };
  }

  /**
   * Send a chat message and get AI response using AWS Bedrock
   * @param messages - The message history
   * @param userId - The user ID
   * @param conversationId - Optional conversation ID
   * @param appLanguage - Optional: current app language to ensure AI responds in the correct language
   */
  async sendMessage(messages: AIMessage[], userId: string, conversationId?: string, appLanguage?: string): Promise<AIResponse> {
    try {
      console.log('ReactNativeAIService: Sending message with userId:', userId, 'language:', appLanguage);

      // Get current app language from store if not provided
      const languageToUse = appLanguage || useLanguageStore.getState().language || 'en';

      // Use bedrockAIService for actual AI processing with app language
      let response = await bedrockAIService.chat(messages, userId, conversationId, false, languageToUse);

      // Execute function calls iteratively until workflow is complete
      let currentMessages = [...messages];
      let allFunctionCalls: any[] = [];
      let finalContent = response.content;
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      // Track order items from search results
      let orderItems: any[] = [];
      let unavailableItems: string[] = [];
      let searchResults: any[] = [];  // Track search results for display
      let lastSearchQuery: string = '';  // Track the last search query

      while (response.function_calls && response.function_calls.length > 0 && iteration < maxIterations) {
        iteration++;
        console.log(`Iteration ${iteration}: Executing`, response.function_calls.length, 'function calls');

        // Execute function calls and get both formatted and raw results
        const { formattedResult: functionResults, rawResults } = await bedrockAIService.executeFunctionCallsWithRaw(
          response.function_calls,
          userId
        );

        console.log('Function results received:', functionResults.substring(0, 200));
        console.log('[ReactNativeAIService] Raw results keys:', Object.keys(rawResults));

        // Parse order items from search_products and get_products_by_category using raw results
        for (const call of response.function_calls) {
          // Handle both search_products and get_products_by_category
          if (call.name === 'search_products' || call.name === 'get_products_by_category') {
            try {
              // Get the search query based on function type
              const searchQuery = call.name === 'search_products'
                ? (call.parameters?.query || call.parameters?.search_term || '')
                : (call.parameters?.category || call.parameters?.subcategory || '');
              const requestedQty = call.parameters?.requested_quantity || call.parameters?.quantity || 1;

              // Track the search query for display purposes
              if (searchQuery) {
                lastSearchQuery = searchQuery;
              }

              // Get raw products directly from rawResults
              const products = rawResults[call.name];
              console.log(`[ReactNativeAIService] Raw ${call.name} result:`,
                Array.isArray(products) ? `${products.length} products` : typeof products);

              if (!products || (Array.isArray(products) && products.length === 0)) {
                // No products found - add to unavailable
                if (searchQuery && !unavailableItems.includes(searchQuery)) {
                  unavailableItems.push(searchQuery);
                }
              } else if (Array.isArray(products)) {
                products.forEach((product: any, idx: number) => {
                  const productId = product.id || product.product_id;
                  const minQty = product.min_quantity || 1;
                  const sellerId = product.seller_id || product.profiles?.id || '';
                  const sellerName = product.profiles?.seller_details?.business_name || product.seller_name || 'Unknown Seller';
                  const distanceKm = product.distance_km || product.profiles?.distance_km || 0;
                  const stockAvailable = product.stock_available || product.stock_quantity || 0;
                  const imageUrl = product.image_url || product.images?.[0] || '';
                  const category = product.category || '';
                  const subcategory = product.subcategory || '';
                  const brand = product.brand || '';

                  // Check if this product is already in search results (deduplication)
                  const isDuplicateSearch = searchResults.some(item =>
                    item.product_id === productId ||
                    (item.name.toLowerCase() === (product.name || '').toLowerCase() && item.seller_id === sellerId)
                  );

                  if (productId && !isDuplicateSearch) {
                    // Only add to searchResults for display in ProductSearchResultsCard
                    // orderItems is reserved for image-based orders and explicit order confirmations
                    const searchResultItem = {
                      id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                      product_id: productId,
                      name: product.name || 'Unknown Product',
                      price: parseFloat(product.price) || 0,
                      unit: product.unit,
                      min_quantity: minQty,
                      stock_available: stockAvailable,
                      seller_name: sellerName,
                      seller_id: sellerId,
                      distance_km: distanceKm,
                      image_url: imageUrl,
                      category: category,
                      subcategory: subcategory,
                      brand: brand
                    };

                    // Add to search results for card display (NOT to orderItems)
                    searchResults.push(searchResultItem);
                  }
                });
                console.log(`[ReactNativeAIService] Parsed from ${call.name}:`,
                  'order items:', orderItems.length, ', Search Results:', searchResults.length);
              }
            } catch (e) {
              console.log('[ReactNativeAIService] Error parsing search results:', e);
            }
          }
        }

        // Sanitize function results to remove large base64 images
        const sanitizeResults = (results: string): string => {
          try {
            // Replace base64 image data with placeholder
            let sanitized = results.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE]');
            // Also remove very long strings (likely encoded data)
            sanitized = sanitized.replace(/"image_url":\s*"[^"]{500,}"/g, '"image_url": "[IMAGE]"');
            // Limit overall length to 15000 characters
            if (sanitized.length > 15000) {
              sanitized = sanitized.substring(0, 15000) + '\n... [Results truncated for brevity]';
            }
            return sanitized;
          } catch (e) {
            return results.substring(0, 15000) + '\n... [Truncated]';
          }
        };

        const sanitizedResults = sanitizeResults(functionResults);

        // Track all function calls
        allFunctionCalls.push(...response.function_calls);

        // Add to conversation - ensure content is never empty
        const assistantContent = response.content && response.content.trim()
          ? response.content
          : `Executing ${response.function_calls.map((f: any) => f.name).join(', ')}...`;

        currentMessages = [
          ...currentMessages,
          {
            role: 'assistant' as const,
            content: assistantContent,
            timestamp: new Date()
          },
          {
            role: 'user' as const,
            content: `[Function Results]\n${sanitizedResults}\n\nBased on these results, please provide a helpful response to the user.`,
            timestamp: new Date()
          }
        ];

        // Get next response
        response = await bedrockAIService.chat(currentMessages, userId, conversationId, false);
        finalContent = response.content;
      }

      // Get user's current language
      const currentLanguage = useLanguageStore.getState().language as SupportedLanguage;

      // Translate response if not English
      let translatedContent = finalContent || "I've completed your request. How else can I help you?";
      let translatedSuggestions = this.generateSuggestions(finalContent, allFunctionCalls);

      if (currentLanguage !== 'en') {
        try {
          // Translate main content
          const contentTranslation = await translationService.translateText(
            translatedContent,
            currentLanguage,
            'en'
          );
          translatedContent = contentTranslation.translatedText;

          // Translate suggestions
          const suggestionTranslations = await translationService.translateBatch(
            translatedSuggestions,
            currentLanguage,
            'en'
          );
          translatedSuggestions = suggestionTranslations.map(t => t.translatedText);
        } catch (error) {
          console.error('Translation error:', error);
          // Continue with English if translation fails
        }
      }

      // Apply smart seller consolidation
      // Goal: Prefer one seller with multiple products to reduce delivery complexity
      const consolidateSellerProducts = (items: any[]): any[] => {
        if (items.length <= 1) return items;

        // Group products by seller
        const sellerProducts: Map<string, any[]> = new Map();
        const sellerDistances: Map<string, number> = new Map();

        items.forEach(item => {
          const sellerId = item.seller_id || item.seller_name || 'unknown';
          if (!sellerProducts.has(sellerId)) {
            sellerProducts.set(sellerId, []);
            sellerDistances.set(sellerId, item.distance_km || 0);
          }
          sellerProducts.get(sellerId)!.push(item);
        });

        // If only one seller, return as-is
        if (sellerProducts.size === 1) return items;

        // Find seller with most products
        let bestSeller = '';
        let maxProducts = 0;
        let bestDistance = Infinity;

        sellerProducts.forEach((products, sellerId) => {
          const distance = sellerDistances.get(sellerId) || 0;
          if (products.length > maxProducts ||
            (products.length === maxProducts && distance < bestDistance)) {
            maxProducts = products.length;
            bestSeller = sellerId;
            bestDistance = distance;
          }
        });

        // Check if best seller has ALL products
        const totalUniqueProducts = new Set(items.map(i => i.name.toLowerCase())).size;
        const bestSellerProducts = sellerProducts.get(bestSeller) || [];

        // If one seller has all products and is within reasonable distance, use them
        if (bestSellerProducts.length === totalUniqueProducts) {
          console.log(`[Seller Consolidation] Using single seller: ${bestSeller} for all ${totalUniqueProducts} products`);
          return bestSellerProducts;
        }

        // Otherwise, for each product type, pick the nearest seller
        // But consolidate to fewer sellers if they are close (within 3km)
        const productByType: Map<string, any[]> = new Map();
        items.forEach(item => {
          const productType = item.name.toLowerCase();
          if (!productByType.has(productType)) {
            productByType.set(productType, []);
          }
          productByType.get(productType)!.push(item);
        });

        const consolidatedItems: any[] = [];
        const selectedSellers = new Set<string>();

        // First pass: pick best (nearest or from already-selected seller)
        productByType.forEach((options, productType) => {
          // Sort by: already selected seller first, then by distance
          options.sort((a, b) => {
            const aSelected = selectedSellers.has(a.seller_id || a.seller_name);
            const bSelected = selectedSellers.has(b.seller_id || b.seller_name);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return (a.distance_km || 0) - (b.distance_km || 0);
          });

          const selected = options[0];
          consolidatedItems.push(selected);
          selectedSellers.add(selected.seller_id || selected.seller_name);
        });

        console.log(`[Seller Consolidation] Consolidated to ${selectedSellers.size} seller(s) for ${consolidatedItems.length} products`);
        return consolidatedItems;
      };

      // Apply consolidation
      const consolidatedOrderItems = consolidateSellerProducts(orderItems);
      console.log('[ReactNativeAIService] Final order items count:', consolidatedOrderItems.length);

      // Return final response
      return {
        content: translatedContent,
        function_calls: allFunctionCalls,
        conversationId: conversationId || this.generateConversationId(),
        suggestions: translatedSuggestions,
        timestamp: new Date().toISOString(),
        order_items: consolidatedOrderItems.length > 0 ? consolidatedOrderItems : undefined,
        unavailable_items: unavailableItems.length > 0 ? unavailableItems : undefined,
        search_results: searchResults.length > 0 ? searchResults : undefined,
        search_query: lastSearchQuery || undefined
      };
    } catch (error) {
      console.error('AI Service Error:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Get product recommendations using AWS Bedrock
   */
  async getRecommendations(
    type: string,
    context: any = {}
  ): Promise<ProductRecommendation[]> {
    try {
      const prompt = this.buildRecommendationPrompt(type, context);
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: 'You are Dai, an intelligent shopping assistant for Dukaaon marketplace. Provide personalized product recommendations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      // Use bedrockAIService for recommendations
      const response = await bedrockAIService.chat(messages, context.userId || 'default-user');

      // If the response includes function calls for recommendations, execute them
      if (response.function_calls) {
        for (const functionCall of response.function_calls) {
          if (functionCall.name === 'get_product_recommendations') {
            const result = await bedrockAIService.executeFunction(functionCall, context.userId || 'default-user');
            if (result.success && result.data) {
              return this.formatRecommendations(result.data);
            }
          }
        }
      }

      // If no function calls, return fallback recommendations
      return this.getFallbackRecommendations();
    } catch (error) {
      console.error('Recommendation Error:', error);
      return this.getFallbackRecommendations();
    }
  }

  /**
   * Format recommendation data into ProductRecommendation array
   */
  private formatRecommendations(data: any): ProductRecommendation[] {
    if (!data || !Array.isArray(data)) return this.getFallbackRecommendations();

    return data.slice(0, 5).map((item: any, index: number) => ({
      id: item.id || `rec_${Date.now()}_${index}`,
      name: item.name || item.title || 'Unknown Product',
      description: item.description || 'No description available',
      price: item.price || 0,
      category: item.category || 'general',
      confidence: 0.9,
      imageUrl: item.image_url || item.imageUrl || 'https://via.placeholder.com/150'
    }));
  }

  /**
   * Helper method to extract product recommendations from function calls
   */
  private extractRecommendationsFromFunctionCalls(functionCalls: any[]): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = [];

    for (const call of functionCalls) {
      if (call.name === 'get_product_recommendations' && call.result?.products) {
        for (const product of call.result.products) {
          recommendations.push({
            id: product.id || `rec_${Date.now()}_${recommendations.length}`,
            name: product.name || product.title || 'Unknown Product',
            description: product.description || 'No description available',
            price: product.price || 0,
            category: product.category || 'general',
            confidence: 0.9,
            imageUrl: product.image_url || product.imageUrl || 'https://via.placeholder.com/150'
          });
        }
      } else if ((call.name === 'search_products' || call.name === 'get_products_by_category') && call.result?.products) {
        for (const product of call.result.products) {
          recommendations.push({
            id: product.id || `search_${Date.now()}_${recommendations.length}`,
            name: product.name || product.title || 'Unknown Product',
            description: product.description || 'No description available',
            price: product.price || 0,
            category: product.category || 'general',
            confidence: 0.8,
            imageUrl: product.image_url || product.imageUrl || 'https://via.placeholder.com/150'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Build recommendation prompt
   */
  private buildRecommendationPrompt(type: string, context: any): string {
    let prompt = `Please recommend products for ${type}.`;

    if (context.budget) {
      prompt += ` Budget: $${context.budget}.`;
    }

    if (context.category) {
      prompt += ` Category: ${context.category}.`;
    }

    if (context.preferences) {
      prompt += ` Preferences: ${context.preferences}.`;
    }

    prompt += ' Please provide 3-5 specific product recommendations with names, brief descriptions, and estimated prices.';

    return prompt;
  }

  /**
   * Parse AI response into product recommendations
   */
  private parseRecommendations(content: string): ProductRecommendation[] {
    // Simple parsing - you can make this more sophisticated
    const recommendations: ProductRecommendation[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    let currentRec: Partial<ProductRecommendation> = {};

    for (const line of lines) {
      if (line.includes('$') && line.match(/\d+/)) {
        // Extract price
        const priceMatch = line.match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) {
          currentRec.price = parseFloat(priceMatch[1]);
        }
      }

      if (line.trim() && !line.startsWith('-') && !line.startsWith('*')) {
        // This might be a product name
        if (!currentRec.name) {
          currentRec.name = line.trim();
        } else if (!currentRec.description) {
          currentRec.description = line.trim();
        }
      }

      // If we have enough info, add to recommendations
      if (currentRec.name && currentRec.description && currentRec.price) {
        recommendations.push({
          id: `rec_${Date.now()}_${recommendations.length}`,
          name: currentRec.name,
          description: currentRec.description,
          price: currentRec.price,
          category: 'general',
          confidence: 0.8,
          imageUrl: 'https://via.placeholder.com/150',
          ...currentRec
        } as ProductRecommendation);

        currentRec = {};
      }
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  /**
   * Generate conversation suggestions based on AI response
   */
  private generateSuggestions(content: string, functionCalls?: any[]): string[] {
    const suggestions: string[] = [];

    // Add context-aware suggestions based on function calls
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'search_products') {
          // Extract product name from search query for ordering suggestions
          const query = call.parameters?.query || '';
          if (query) {
            suggestions.push(`Order ${query}`);
            suggestions.push(`Order ${query} 5kg`);
          }
          suggestions.push("Show similar products");
        } else if (call.name === 'get_products_by_category') {
          // Extract category for browsing suggestions
          const category = call.parameters?.category || '';
          if (category) {
            suggestions.push(`Show more ${category}`);
            suggestions.push(`Filter by brand`);
          }
          suggestions.push("Sort by price");
          suggestions.push("Show nearby sellers");
        } else if (call.name === 'get_product_recommendations') {
          suggestions.push("Show me more products like these");
          suggestions.push("What's the best value option?");
        } else if (call.name === 'add_to_cart') {
          suggestions.push("Place my order");
          suggestions.push("View my cart");
          suggestions.push("Continue shopping");
        } else if (call.name === 'get_cart_items') {
          suggestions.push("Place my order");
          suggestions.push("Clear my cart");
        } else if (call.name === 'place_order') {
          suggestions.push("Track my order");
          suggestions.push("View order history");
        }
      }
    }

    // Parse content for product mentions to generate order suggestions
    if (!suggestions.length && content) {
      const productMatches = content.match(/\b(atta|rice|oil|dal|sugar|salt|flour|wheat|biscuits?|snacks?)\b/gi);
      if (productMatches && productMatches.length > 0) {
        const product = productMatches[0];
        suggestions.push(`Order ${product} 5kg`);
        suggestions.push(`Order ${product} 10kg`);
      }
    }

    // Default shopping-related suggestions
    const defaultSuggestions = [
      "Find nearby wholesalers",
      "Show my cart",
      "View order history",
      "Search for products"
    ];

    // Combine and limit suggestions
    const allSuggestions = [...suggestions, ...defaultSuggestions];
    return allSuggestions.slice(0, 3);
  }

  /**
   * Generate a conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fallback response when AI service fails
   */
  private getFallbackResponse(): AIResponse {
    return {
      content: "I'm sorry, I'm having trouble connecting to the AI service right now. Please try again later.",
      conversationId: this.generateConversationId(),
      suggestions: [
        "Try again",
        "Contact support",
        "Browse products manually"
      ],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fallback recommendations when AI service fails
   */
  private getFallbackRecommendations(): ProductRecommendation[] {
    return [
      {
        id: 'fallback_1',
        name: 'Popular Product 1',
        description: 'A highly rated product that customers love',
        price: 29.99,
        category: 'general',
        confidence: 0.6,
        imageUrl: 'https://via.placeholder.com/150'
      },
      {
        id: 'fallback_2',
        name: 'Best Seller',
        description: 'Our top-selling product this month',
        price: 49.99,
        category: 'general',
        confidence: 0.6,
        imageUrl: 'https://via.placeholder.com/150'
      },
      {
        id: 'fallback_3',
        name: 'Customer Favorite',
        description: 'Highly recommended by our customers',
        price: 39.99,
        category: 'general',
        confidence: 0.6,
        imageUrl: 'https://via.placeholder.com/150'
      }
    ];
  }

  /**
   * Load conversation history from Bedrock service
   */
  async loadConversation(conversationId: string): Promise<AIMessage[]> {
    try {
      const conversation = await bedrockAIService.getConversation(conversationId);
      if (conversation && conversation.messages) {
        return conversation.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.timestamp
        }));
      }
      return [];
    } catch (error) {
      console.error('Error loading conversation:', error);
      return [];
    }
  }

  /**
   * Save conversation through Bedrock service
   */
  async saveConversation(conversationId: string, messages: AIMessage[]): Promise<void> {
    try {
      // The Bedrock service handles conversation persistence automatically
      // This method is kept for compatibility but may not be needed
      console.log('Conversation auto-saved through Bedrock service:', conversationId, messages.length, 'messages');
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }
}

// Export a default instance
export const reactNativeAIService = new ReactNativeAIService();
