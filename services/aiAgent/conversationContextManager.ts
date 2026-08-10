/**
 * Conversation Context Manager
 * 
 * Manages conversation context with smart summarization for long conversations.
 * Prevents token limit issues by summarizing old messages while preserving context.
 */

import { supabase } from '../supabase/supabase';
import { AIMessage } from './bedrockAIService';
import { bedrockAIService } from './bedrockAIService';

export interface ConversationSummary {
  id: string;
  conversation_id: string;
  summary_text: string;
  message_range_start: number;
  message_range_end: number;
  created_at: Date;
}

export interface ConversationContext {
  current_conversation_id: string;
  conversation_topic: string;
  mentioned_products: string[];
  mentioned_categories: string[];
  user_intent: string;
  conversation_summary?: string;
}

export interface ContextualizedMessages {
  messages: AIMessage[];
  has_summary: boolean;
  summary_text?: string;
  total_tokens_estimated: number;
}

export class ConversationContextManager {
  // Claude 3.5 Sonnet has ~200k token context window, but we'll be conservative
  private readonly MAX_CONTEXT_TOKENS = 150000; // Leave room for system prompt and response
  private readonly SUMMARY_THRESHOLD = 100000; // Start summarizing at this point
  private readonly RECENT_MESSAGES_COUNT = 15; // Keep last N messages in full
  private readonly TOKENS_PER_MESSAGE_ESTIMATE = 150; // Rough estimate per message

  /**
   * Build conversation context with smart summarization
   */
  async buildConversationContext(
    conversationId: string | undefined,
    userId: string,
    currentMessages: AIMessage[]
  ): Promise<ContextualizedMessages> {
    try {
      // If no conversation ID, just use current messages
      if (!conversationId || conversationId === 'new') {
        const estimatedTokens = this.estimateTokenCount(currentMessages);
        return {
          messages: currentMessages,
          has_summary: false,
          total_tokens_estimated: estimatedTokens
        };
      }

      // Get full conversation history from database
      const fullHistory = await this.getFullConversationHistory(conversationId, userId);
      
      // Combine with current messages
      const allMessages = [...fullHistory, ...currentMessages];
      
      // Estimate token count
      const estimatedTokens = this.estimateTokenCount(allMessages);
      
      // If under threshold, return all messages
      if (estimatedTokens <= this.SUMMARY_THRESHOLD) {
        return {
          messages: allMessages,
          has_summary: false,
          total_tokens_estimated: estimatedTokens
        };
      }

      // Need to summarize - keep recent messages, summarize old ones
      const recentMessages = allMessages.slice(-this.RECENT_MESSAGES_COUNT);
      const oldMessages = allMessages.slice(0, -this.RECENT_MESSAGES_COUNT);

      // Check if we already have a summary for these messages
      const existingSummary = await this.getExistingSummary(conversationId, oldMessages.length);
      
      if (existingSummary) {
        // Use existing summary
        const summaryMessage: AIMessage = {
          role: 'system',
          content: `Previous conversation summary: ${existingSummary.summary_text}`,
          timestamp: existingSummary.created_at
        };

        const summarizedTokens = this.estimateTokenCount([summaryMessage, ...recentMessages]);
        
        return {
          messages: [summaryMessage, ...recentMessages],
          has_summary: true,
          summary_text: existingSummary.summary_text,
          total_tokens_estimated: summarizedTokens
        };
      }

      // Create new summary
      const summary = await this.createSummary(oldMessages, conversationId);
      
      if (summary) {
        const summaryMessage: AIMessage = {
          role: 'system',
          content: `Previous conversation summary: ${summary}`,
          timestamp: new Date()
        };

        const summarizedTokens = this.estimateTokenCount([summaryMessage, ...recentMessages]);
        
        return {
          messages: [summaryMessage, ...recentMessages],
          has_summary: true,
          summary_text: summary,
          total_tokens_estimated: summarizedTokens
        };
      }

      // If summarization fails, just use recent messages
      console.warn('[ConversationContextManager] Summarization failed, using recent messages only');
      return {
        messages: recentMessages,
        has_summary: false,
        total_tokens_estimated: this.estimateTokenCount(recentMessages)
      };

    } catch (error) {
      console.error('[ConversationContextManager] Error building context:', error);
      // Fallback to current messages only
      return {
        messages: currentMessages,
        has_summary: false,
        total_tokens_estimated: this.estimateTokenCount(currentMessages)
      };
    }
  }

  /**
   * Get full conversation history from database
   */
  private async getFullConversationHistory(
    conversationId: string,
    userId: string
  ): Promise<AIMessage[]> {
    try {
      // Get conversation to verify ownership
      const { data: conversation, error: convError } = await supabase
        .from('ai_conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conversation) {
        console.warn('[ConversationContextManager] Conversation not found:', conversationId);
        return [];
      }

      // Get all messages for this conversation
      const { data: messages, error: msgError } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('[ConversationContextManager] Error fetching messages:', msgError);
        return [];
      }

      if (!messages || messages.length === 0) {
        return [];
      }

      // Convert database messages to AIMessage format
      return messages.map(msg => {
        let content: string | any = msg.content;
        
        // Try to parse content if it's JSON
        try {
          if (typeof msg.content === 'string' && msg.content.startsWith('[')) {
            content = JSON.parse(msg.content);
          }
        } catch (e) {
          // Keep as string if parsing fails
        }

        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: content,
          timestamp: new Date(msg.created_at),
          function_calls: msg.function_calls ? 
            (typeof msg.function_calls === 'string' ? JSON.parse(msg.function_calls) : msg.function_calls) 
            : undefined
        };
      });
    } catch (error) {
      console.error('[ConversationContextManager] Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Estimate token count for messages
   * Rough estimation: ~4 tokens per word, ~150 tokens per message average
   */
  private estimateTokenCount(messages: AIMessage[]): number {
    let totalTokens = 0;

    for (const msg of messages) {
      let contentLength = 0;

      if (typeof msg.content === 'string') {
        contentLength = msg.content.length;
      } else if (Array.isArray(msg.content)) {
        // Multimodal content - estimate based on text parts
        contentLength = msg.content
          .filter(item => item.type === 'text')
          .reduce((sum, item: any) => sum + (item.text?.length || 0), 0);
      }

      // Rough estimate: 1 token ≈ 4 characters
      const messageTokens = Math.ceil(contentLength / 4) + 50; // +50 for message structure
      totalTokens += messageTokens;
    }

    return totalTokens;
  }

  /**
   * Create a summary of old messages using AI
   */
  private async createSummary(
    messages: AIMessage[],
    conversationId: string
  ): Promise<string | null> {
    try {
      if (messages.length === 0) {
        return null;
      }

      // Format messages for summarization
      const conversationText = messages
        .map((msg, index) => {
          const content = typeof msg.content === 'string' 
            ? msg.content 
            : JSON.stringify(msg.content);
          return `${msg.role}: ${content}`;
        })
        .join('\n\n');

      // Create summarization prompt
      const summaryPrompt = `Summarize this conversation history concisely, preserving:
- User's main intents and goals
- Products mentioned (with quantities if specified)
- Categories or types of products discussed
- Decisions made (orders placed, items added to cart, etc.)
- Important preferences or requirements mentioned
- Any unresolved questions or pending actions

Keep the summary concise (under 500 words) but comprehensive enough to maintain context.

Conversation:
${conversationText}`;

      // Use AI to generate summary
      const summaryMessages: AIMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise conversation summaries.',
          timestamp: new Date()
        },
        {
          role: 'user',
          content: summaryPrompt,
          timestamp: new Date()
        }
      ];

      // Call bedrock service to generate summary
      // We'll use a simplified call without full context to avoid recursion
      const response = await this.generateSummaryWithAI(summaryMessages);

      if (response && response.trim().length > 0) {
        // Save summary to database
        await this.saveSummary(conversationId, response, 0, messages.length - 1);
        return response;
      }

      return null;
    } catch (error) {
      console.error('[ConversationContextManager] Error creating summary:', error);
      return null;
    }
  }

  /**
   * Generate summary using AI (simplified call)
   */
  private async generateSummaryWithAI(messages: AIMessage[]): Promise<string | null> {
    try {
      // Use bedrock service directly with minimal context
      const { BEDROCK_CONFIG, AWS_CONFIG } = await import('../../config/awsBedrock');
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

      const accessKeyId = AWS_CONFIG.credentials.accessKeyId || process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
      const secretAccessKey = AWS_CONFIG.credentials.secretAccessKey || process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';
      const region = AWS_CONFIG.region || process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';

      const bedrockClient = new BedrockRuntimeClient({
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });

      const claudeMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }));

      const systemPrompt = messages.find(msg => msg.role === 'system')?.content || 
        'You are a helpful assistant that creates concise conversation summaries.';

      const payload = {
        anthropic_version: BEDROCK_CONFIG.anthropicVersion || 'bedrock-2023-05-31',
        max_tokens: 2000, // Summary should be concise
        temperature: 0.3, // Lower temperature for more consistent summaries
        system: systemPrompt,
        messages: claudeMessages,
      };

      const command = new InvokeModelCommand({
        modelId: BEDROCK_CONFIG.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.content && Array.isArray(responseBody.content)) {
        const textContent = responseBody.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('');

        return textContent.trim();
      }

      return null;
    } catch (error) {
      console.error('[ConversationContextManager] Error generating summary with AI:', error);
      // Fallback: Create a simple summary
      return this.createSimpleSummary(messages);
    }
  }

  /**
   * Create a simple summary without AI (fallback)
   */
  private createSimpleSummary(messages: AIMessage[]): string {
    const products: string[] = [];
    const categories: string[] = [];
    const intents: string[] = [];

    messages.forEach(msg => {
      if (msg.role === 'user') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        // Extract products (simple pattern matching)
        const productMatches = content.match(/\b(rice|atta|oil|milk|sugar|flour|spices|vegetables|fruits)\b/gi);
        if (productMatches) {
          products.push(...productMatches.map(p => p.toLowerCase()));
        }

        // Extract intents
        if (content.toLowerCase().includes('order') || content.toLowerCase().includes('need')) {
          intents.push('ordering');
        }
        if (content.toLowerCase().includes('search') || content.toLowerCase().includes('find')) {
          intents.push('searching');
        }
      }
    });

    const uniqueProducts = [...new Set(products)];
    const uniqueIntents = [...new Set(intents)];

    let summary = `Previous conversation involved ${messages.length} messages. `;
    
    if (uniqueIntents.length > 0) {
      summary += `User was ${uniqueIntents.join(' and ')}. `;
    }
    
    if (uniqueProducts.length > 0) {
      summary += `Products discussed: ${uniqueProducts.slice(0, 5).join(', ')}.`;
    }

    return summary;
  }

  /**
   * Get existing summary from database
   */
  private async getExistingSummary(
    conversationId: string,
    messageCount: number
  ): Promise<ConversationSummary | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('message_range_end', messageCount)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        conversation_id: data.conversation_id,
        summary_text: data.summary_text,
        message_range_start: data.message_range_start,
        message_range_end: data.message_range_end,
        created_at: new Date(data.created_at)
      };
    } catch (error) {
      console.error('[ConversationContextManager] Error getting existing summary:', error);
      return null;
    }
  }

  /**
   * Save summary to database
   */
  private async saveSummary(
    conversationId: string,
    summaryText: string,
    rangeStart: number,
    rangeEnd: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('conversation_summaries')
        .insert({
          conversation_id: conversationId,
          summary_text: summaryText,
          message_range_start: rangeStart,
          message_range_end: rangeEnd
        });

      if (error) {
        console.error('[ConversationContextManager] Error saving summary:', error);
      }
    } catch (error) {
      console.error('[ConversationContextManager] Error saving summary:', error);
    }
  }

  /**
   * Update conversation context with current interaction
   */
  async updateConversationContext(
    conversationId: string,
    userId: string,
    newMessage: AIMessage,
    aiResponse: AIMessage
  ): Promise<ConversationContext> {
    try {
      // Extract key information from conversation
      const mentionedProducts = this.extractProducts(newMessage, aiResponse);
      const mentionedCategories = this.extractCategories(newMessage, aiResponse);
      const userIntent = this.detectIntent(newMessage);
      const conversationTopic = this.detectTopic(newMessage, aiResponse);

      const context: ConversationContext = {
        current_conversation_id: conversationId,
        conversation_topic: conversationTopic,
        mentioned_products: mentionedProducts,
        mentioned_categories: mentionedCategories,
        user_intent: userIntent
      };

      // Update conversation metadata
      await supabase
        .from('ai_conversations')
        .update({
          metadata: {
            context: context,
            last_updated: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
        .eq('user_id', userId);

      return context;
    } catch (error) {
      console.error('[ConversationContextManager] Error updating conversation context:', error);
      return {
        current_conversation_id: conversationId,
        conversation_topic: '',
        mentioned_products: [],
        mentioned_categories: [],
        user_intent: ''
      };
    }
  }

  /**
   * Extract product names from messages
   */
  private extractProducts(userMessage: AIMessage, aiMessage: AIMessage): string[] {
    const products: string[] = [];
    const content = typeof userMessage.content === 'string' 
      ? userMessage.content 
      : JSON.stringify(userMessage.content);
    
    // Simple pattern matching for common products
    const productKeywords = [
      'rice', 'atta', 'wheat', 'flour', 'oil', 'cooking oil', 'milk', 'sugar',
      'salt', 'spices', 'turmeric', 'chilli', 'pepper', 'vegetables', 'fruits',
      'onion', 'potato', 'tomato', 'biscuits', 'snacks', 'beverages', 'tea', 'coffee'
    ];

    productKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        products.push(keyword);
      }
    });

    return [...new Set(products)];
  }

  /**
   * Extract categories from messages
   */
  private extractCategories(userMessage: AIMessage, aiMessage: AIMessage): string[] {
    const categories: string[] = [];
    const content = typeof userMessage.content === 'string' 
      ? userMessage.content 
      : JSON.stringify(userMessage.content);
    
    const categoryKeywords = [
      'groceries', 'vegetables', 'fruits', 'snacks', 'beverages',
      'personal care', 'household', 'dairy', 'staples', 'spices'
    ];

    categoryKeywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        categories.push(keyword);
      }
    });

    return [...new Set(categories)];
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: AIMessage): string {
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('order') || lowerContent.includes('buy') || lowerContent.includes('purchase')) {
      return 'ordering';
    }
    if (lowerContent.includes('search') || lowerContent.includes('find') || lowerContent.includes('show')) {
      return 'searching';
    }
    if (lowerContent.includes('cart') || lowerContent.includes('basket')) {
      return 'cart_management';
    }
    if (lowerContent.includes('price') || lowerContent.includes('cost')) {
      return 'pricing_inquiry';
    }
    if (lowerContent.includes('delivery') || lowerContent.includes('shipping')) {
      return 'delivery_inquiry';
    }
    if (lowerContent.includes('help') || lowerContent.includes('how') || lowerContent.includes('what')) {
      return 'help_request';
    }

    return 'general';
  }

  /**
   * Detect conversation topic
   */
  private detectTopic(userMessage: AIMessage, aiMessage: AIMessage): string {
    const userContent = typeof userMessage.content === 'string' 
      ? userMessage.content 
      : JSON.stringify(userMessage.content);
    
    // Extract first meaningful phrase (first 50 chars)
    const topic = userContent.substring(0, 50).trim();
    return topic.length > 0 ? topic : 'General conversation';
  }
}

// Export singleton instance
export const conversationContextManager = new ConversationContextManager();

