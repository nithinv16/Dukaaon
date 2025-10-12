// AI Components Index
// Centralized exports for all AI-related components

export { default as AIChatInterface } from './AIChatInterface';
export { default as VoiceOrderingInterface } from './VoiceOrderingInterface';
export { default as AIRecommendations } from './AIRecommendations';

// Re-export types for convenience
export type {
  ChatMessage,
  ChatConversation,
  ChatRequest,
  ChatResponse,
  VoiceOrderRequest,
  VoiceOrderResponse,
  VoiceOrderSession,
  ProductRecommendation,
  RecommendationsData
} from '../types/ai';

// Component props types
export interface AIChatInterfaceProps {
  userId: string;
  initialConversationId?: string;
  onConversationChange?: (conversationId: string) => void;
  onMessageSent?: (message: string) => void;
  style?: any;
  compact?: boolean;
  showHeader?: boolean;
  placeholder?: string;
  maxHeight?: number;
}

export interface VoiceOrderingInterfaceProps {
  userId: string;
  onOrderComplete?: (order: any) => void;
  onError?: (error: string) => void;
  style?: any;
  language?: string;
  voiceId?: string;
  autoStart?: boolean;
}

export interface AIRecommendationsProps {
  userId: string;
  type: 'personalized' | 'similar' | 'trending' | 'category' | 'cart_based';
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
  onProductSelect?: (product: any) => void;
  onAddToCart?: (product: any) => void;
  style?: any;
  showHeader?: boolean;
  compact?: boolean;
}

// Utility functions for AI components
export const aiUtils = {
  // Format conversation title
  formatConversationTitle: (messages: any[], maxLength: number = 50): string => {
    if (!messages || messages.length === 0) return 'New Conversation';
    
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'New Conversation';
    
    const title = firstUserMessage.content.trim();
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  },

  // Generate session ID
  generateSessionId: (): string => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Format timestamp
  formatTimestamp: (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  },

  // Validate audio support
  isAudioSupported: (): boolean => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  // Get supported languages for voice
  getSupportedVoiceLanguages: (): string[] => {
    return [
      'en-US', 'en-GB', 'en-AU', 'en-IN',
      'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN',
      'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR',
      'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA'
    ];
  },

  // Get voice options for language
  getVoiceOptions: (languageCode: string): string[] => {
    const voiceMap: Record<string, string[]> = {
      'en-US': ['Joanna', 'Matthew', 'Amy', 'Brian'],
      'en-GB': ['Amy', 'Brian', 'Emma'],
      'en-AU': ['Nicole', 'Russell'],
      'en-IN': ['Aditi', 'Raveena'],
      'hi-IN': ['Aditi'],
      'ta-IN': ['Aditi'],
      'te-IN': ['Aditi'],
      'kn-IN': ['Aditi'],
      'ml-IN': ['Aditi'],
      'es-ES': ['Conchita', 'Enrique'],
      'fr-FR': ['Celine', 'Mathieu'],
      'de-DE': ['Marlene', 'Hans'],
      'it-IT': ['Carla', 'Giorgio'],
      'pt-BR': ['Vitoria', 'Ricardo'],
      'ja-JP': ['Mizuki', 'Takumi'],
      'ko-KR': ['Seoyeon'],
      'zh-CN': ['Zhiyu'],
      'ar-SA': ['Zeina']
    };
    
    return voiceMap[languageCode] || ['Joanna'];
  },

  // Parse function call from AI response
  parseFunctionCall: (content: string): { name: string; parameters: any } | null => {
    try {
      // Look for function call patterns in the content
      const functionCallRegex = /\[FUNCTION_CALL:(\w+)\](.*?)\[\/FUNCTION_CALL\]/s;
      const match = content.match(functionCallRegex);
      
      if (match) {
        const functionName = match[1];
        const parametersStr = match[2].trim();
        
        try {
          const parameters = JSON.parse(parametersStr);
          return { name: functionName, parameters };
        } catch {
          return { name: functionName, parameters: { query: parametersStr } };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing function call:', error);
      return null;
    }
  },

  // Format price for display
  formatPrice: (price: number, currency: string = '₹'): string => {
    return `${currency}${price.toLocaleString('en-IN')}`;
  },

  // Calculate confidence color
  getConfidenceColor: (confidence: number): string => {
    if (confidence >= 0.8) return '#4caf50'; // Green
    if (confidence >= 0.6) return '#ff9800'; // Orange
    return '#f44336'; // Red
  },

  // Truncate text
  truncateText: (text: string, maxLength: number): string => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  },

  // Debounce function
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Throttle function
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Constants for AI components
export const AI_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 4000,
  MAX_CONVERSATION_TITLE_LENGTH: 50,
  DEFAULT_VOICE_LANGUAGE: 'en-US',
  DEFAULT_VOICE_ID: 'Joanna',
  VOICE_RECORDING_MAX_DURATION: 60000, // 60 seconds
  RECOMMENDATION_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  TYPING_INDICATOR_DELAY: 1000,
  AUTO_SCROLL_DELAY: 100,
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 1000,
  
  // API endpoints
  ENDPOINTS: {
    CHAT: '/api/ai/chat',
    VOICE_SEARCH: '/api/ai/voice/search',
    VOICE_ORDER: '/api/ai/voice/order',
    RECOMMENDATIONS: '/api/ai/recommendations'
  },
  
  // Error messages
  ERRORS: {
    NETWORK: 'Network error. Please check your connection and try again.',
    AUDIO_NOT_SUPPORTED: 'Audio recording is not supported on this device.',
    MICROPHONE_ACCESS: 'Microphone access is required for voice features.',
    PROCESSING_FAILED: 'Failed to process your request. Please try again.',
    INVALID_RESPONSE: 'Received invalid response from server.',
    SESSION_EXPIRED: 'Your session has expired. Please refresh and try again.'
  },
  
  // Success messages
  SUCCESS: {
    MESSAGE_SENT: 'Message sent successfully',
    ORDER_PLACED: 'Order placed successfully',
    PRODUCT_ADDED: 'Product added to cart',
    VOICE_PROCESSED: 'Voice command processed successfully'
  }
};

// Default configurations
export const DEFAULT_AI_CONFIG = {
  chat: {
    maxMessages: 100,
    showTimestamps: true,
    showTypingIndicator: true,
    autoScroll: true,
    placeholder: 'Ask me anything about products, orders, or recommendations...'
  },
  voice: {
    language: 'en-US',
    voiceId: 'Joanna',
    autoStart: false,
    maxRecordingTime: 60000,
    confidenceThreshold: 0.7
  },
  recommendations: {
    limit: 10,
    showConfidence: true,
    showReasoning: true,
    cacheResults: true,
    autoRefresh: false
  }
};

export default {
  AIChatInterface,
  VoiceOrderingInterface,
  AIRecommendations,
  aiUtils,
  AI_CONSTANTS,
  DEFAULT_AI_CONFIG
};