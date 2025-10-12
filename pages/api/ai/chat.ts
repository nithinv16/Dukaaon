// AI Chat API Endpoint
import { NextApiRequest, NextApiResponse } from 'next';
import { bedrockAIService, AIMessage } from '../../../services/aiAgent/bedrockAIService';
import { supabase } from '../../../services/supabase/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface ChatRequest {
  message: string;
  userId: string;
  conversationId?: string;
  useStreaming?: boolean;
  context?: {
    currentPage?: string;
    userLocation?: {
      latitude: number;
      longitude: number;
    };
    cartItems?: any[];
  };
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  function_calls?: any[];
  thinking?: string;
  confidence?: number;
  suggestions?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      response: '',
      conversationId: '',
      error: 'Method not allowed' 
    });
  }

  try {
    const { 
      message, 
      userId, 
      conversationId, 
      useStreaming = false,
      context = {}
    }: ChatRequest = req.body;

    // Validate required fields
    if (!message || !userId) {
      return res.status(400).json({
        response: '',
        conversationId: '',
        error: 'Message and userId are required'
      });
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    let conversation = null;

    if (currentConversationId) {
      conversation = await bedrockAIService.getConversation(currentConversationId);
    }

    if (!conversation) {
      currentConversationId = uuidv4();
      conversation = {
        id: currentConversationId,
        user_id: userId,
        messages: [],
        context: {
          user_profile: null,
          current_cart: [],
          recent_orders: [],
          preferences: {},
          ...context
        },
        created_at: new Date(),
        updated_at: new Date()
      };
    }

    // Add user message to conversation
    const userMessage: AIMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    conversation.messages.push(userMessage);

    // Get AI response
    const aiResponse = await bedrockAIService.chat(
      conversation.messages,
      userId,
      currentConversationId,
      useStreaming
    );

    // Add AI response to conversation
    const assistantMessage: AIMessage = {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
      function_calls: aiResponse.function_calls
    };

    conversation.messages.push(assistantMessage);
    conversation.updated_at = new Date();

    // Save conversation
    await bedrockAIService.saveConversation(conversation);

    // Generate suggestions based on the conversation
    const suggestions = generateSuggestions(aiResponse.content, aiResponse.function_calls);

    // Return response
    return res.status(200).json({
      response: aiResponse.content,
      conversationId: currentConversationId,
      function_calls: aiResponse.function_calls,
      thinking: aiResponse.thinking,
      confidence: aiResponse.confidence,
      suggestions
    });

  } catch (error) {
    console.error('AI Chat API Error:', error);
    
    return res.status(500).json({
      response: '',
      conversationId: '',
      error: error.message || 'Internal server error'
    });
  }
}

// Generate contextual suggestions
function generateSuggestions(response: string, functionCalls?: any[]): string[] {
  const suggestions: string[] = [];

  // If AI mentioned products, suggest related actions
  if (response.toLowerCase().includes('product') || response.toLowerCase().includes('item')) {
    suggestions.push('Show me similar products');
    suggestions.push('Add to cart');
    suggestions.push('Check availability');
  }

  // If AI mentioned cart, suggest cart actions
  if (response.toLowerCase().includes('cart') || functionCalls?.some(fc => fc.name === 'add_to_cart')) {
    suggestions.push('View my cart');
    suggestions.push('Proceed to checkout');
    suggestions.push('Continue shopping');
  }

  // If AI mentioned orders, suggest order actions
  if (response.toLowerCase().includes('order') || functionCalls?.some(fc => fc.name === 'get_order_history')) {
    suggestions.push('Track my orders');
    suggestions.push('Reorder previous items');
    suggestions.push('Order status');
  }

  // If AI mentioned search, suggest search refinements
  if (response.toLowerCase().includes('search') || functionCalls?.some(fc => fc.name === 'search_products')) {
    suggestions.push('Refine search');
    suggestions.push('Filter by category');
    suggestions.push('Sort by price');
  }

  // Default suggestions if none match
  if (suggestions.length === 0) {
    suggestions.push('What can you help me with?');
    suggestions.push('Show me popular products');
    suggestions.push('Help me find something');
  }

  return suggestions.slice(0, 3); // Limit to 3 suggestions
}