// AI System Type Definitions
// Comprehensive type definitions for the AI agent system

// Base AI Message Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  function_call?: {
    name: string;
    parameters: Record<string, any>;
  };
  function_response?: {
    name: string;
    result: any;
    error?: string;
  };
  metadata?: {
    timestamp?: string;
    tokens?: number;
    processing_time?: number;
    confidence?: number;
    [key: string]: any;
  };
  created_at: string;
}

// Conversation Types
export interface ChatConversation {
  id: string;
  user_id: string;
  session_id: string;
  title?: string;
  messages: ChatMessage[];
  metadata?: {
    total_messages?: number;
    last_activity?: string;
    context?: Record<string, any>;
    [key: string]: any;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Request/Response Types
export interface ChatRequest {
  message: string;
  conversationId?: string;
  userId: string;
  context?: {
    location?: string;
    preferences?: string[];
    recent_orders?: any[];
    current_cart?: any[];
    [key: string]: any;
  };
  sessionId?: string;
}

export interface ChatResponse {
  response: string;
  conversationId: string;
  suggestions?: string[];
  function_calls?: Array<{
    name: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
  }>;
  metadata?: {
    tokens_used?: number;
    processing_time?: number;
    confidence?: number;
    model?: string;
    [key: string]: any;
  };
  error?: string;
}

// Voice Service Types
export interface VoiceSearchRequest {
  audioData?: Blob | string;
  text?: string;
  userId: string;
  language?: string;
  context?: {
    location?: string;
    preferences?: string[];
    [key: string]: any;
  };
}

export interface VoiceSearchResult {
  transcript: string;
  confidence: number;
  response: string;
  audioUrl?: string;
  products?: Array<{
    id: string;
    name: string;
    price: number;
    image_url?: string;
    availability: boolean;
  }>;
  suggestions?: string[];
  metadata?: {
    processing_time?: number;
    language_detected?: string;
    voice_id?: string;
    [key: string]: any;
  };
  error?: string;
}

export interface TextToSpeechRequest {
  text: string;
  language?: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
}

export interface TextToSpeechResult {
  audioUrl: string;
  duration?: number;
  format?: string;
  size?: number;
  metadata?: {
    voice_id?: string;
    language?: string;
    processing_time?: number;
    [key: string]: any;
  };
  error?: string;
}

// Voice Ordering Types
export interface VoiceOrderRequest {
  audioData?: Blob | string;
  text?: string;
  userId: string;
  sessionId?: string;
  language?: string;
  context?: {
    current_cart?: any[];
    delivery_address?: string;
    payment_method?: string;
    [key: string]: any;
  };
}

export interface VoiceOrderResponse {
  transcript: string;
  confidence: number;
  response: string;
  audioUrl?: string;
  sessionId: string;
  orderSummary?: {
    items: Array<{
      product_id: string;
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    total_amount: number;
    delivery_fee?: number;
    tax?: number;
    grand_total: number;
  };
  nextAction?: 'confirm' | 'modify' | 'cancel' | 'complete';
  suggestions?: string[];
  metadata?: {
    processing_time?: number;
    language_detected?: string;
    voice_id?: string;
    [key: string]: any;
  };
  error?: string;
}

export interface VoiceOrderSession {
  id: string;
  user_id: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  session_type: 'search' | 'order' | 'chat';
  language_code: string;
  voice_id: string;
  context: Record<string, any>;
  results: Record<string, any>;
  transcript?: string;
  confidence_score?: number;
  processing_time_ms?: number;
  audio_input_url?: string;
  audio_output_url?: string;
  error_details?: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Product Recommendation Types
export interface ProductRecommendation {
  product_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  image_url?: string;
  rating?: number;
  availability: boolean;
  confidence_score: number;
  reason: string;
  tags?: string[];
  discount?: {
    percentage: number;
    original_price: number;
  };
  metadata?: {
    similarity_score?: number;
    popularity_score?: number;
    user_preference_match?: number;
    [key: string]: any;
  };
}

export interface RecommendationRequest {
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
    [key: string]: any;
  };
}

export interface RecommendationsData {
  recommendations: ProductRecommendation[];
  reasoning: string;
  confidence: number;
  type: string;
  metadata: {
    totalFound: number;
    processingTime: number;
    aiModel: string;
    contextUsed: string[];
    [key: string]: any;
  };
  suggestions?: string[];
  error?: string;
}

// AI Function Call Types
export interface AIFunctionCall {
  id: string;
  conversation_id?: string;
  voice_session_id?: string;
  function_name: string;
  parameters: Record<string, any>;
  response?: Record<string, any>;
  execution_time_ms?: number;
  status: 'pending' | 'success' | 'error';
  error_message?: string;
  created_at: string;
}

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required: string[];
  };
  handler: (parameters: Record<string, any>, context?: any) => Promise<any>;
}

// Analytics Types
export interface AIAnalyticsEvent {
  id: string;
  event_type: string;
  user_id?: string;
  session_id?: string;
  event_data: Record<string, any>;
  response_time_ms?: number;
  tokens_used?: number;
  cost_estimate?: number;
  user_agent?: string;
  ip_address?: string;
  location?: Record<string, any>;
  created_at: string;
}

// Configuration Types
export interface AIAgentConfig {
  name: string;
  role: string;
  personality: string;
  capabilities: string[];
  systemPrompt: string;
  model: {
    id: string;
    maxTokens: number;
    temperature: number;
    topP: number;
  };
  functions: AIFunction[];
}

export interface VoiceConfig {
  transcribe: {
    languageCode: string;
    sampleRateHertz: number;
    encoding: string;
    maxAlternatives: number;
    enableAutomaticPunctuation: boolean;
    enableWordTimeOffsets: boolean;
  };
  polly: {
    voiceId: string;
    outputFormat: string;
    sampleRate: string;
    textType: string;
    languageCode: string;
  };
  supportedLanguages: Array<{
    code: string;
    name: string;
    voices: string[];
  }>;
}

export interface BedrockConfig {
  region: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  stopSequences: string[];
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

// Error Types
export interface AIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  context?: {
    userId?: string;
    sessionId?: string;
    functionName?: string;
    [key: string]: any;
  };
}

// Component State Types
export interface ChatInterfaceState {
  conversations: ChatConversation[];
  currentConversationId?: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isTyping: boolean;
  error?: string;
  suggestions: string[];
}

export interface VoiceInterfaceState {
  isListening: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  transcript: string;
  response: string;
  confidence: number;
  session?: VoiceOrderSession;
  error?: string;
  audioUrl?: string;
}

export interface RecommendationsState {
  recommendations: ProductRecommendation[];
  isLoading: boolean;
  error?: string;
  metadata?: {
    totalFound: number;
    processingTime: number;
    confidence: number;
    reasoning: string;
  };
  selectedProduct?: string;
}

// Utility Types
export type AIMessageRole = 'user' | 'assistant' | 'system' | 'function';
export type VoiceSessionStatus = 'active' | 'completed' | 'cancelled' | 'error';
export type VoiceSessionType = 'search' | 'order' | 'chat';
export type RecommendationType = 'personalized' | 'similar' | 'trending' | 'category' | 'cart_based';
export type FunctionCallStatus = 'pending' | 'success' | 'error';

// Event Handler Types
export type OnMessageSent = (message: string, conversationId?: string) => void;
export type OnConversationChange = (conversationId: string) => void;
export type OnVoiceCommand = (transcript: string, confidence: number) => void;
export type OnOrderComplete = (order: any) => void;
export type OnProductSelect = (product: ProductRecommendation) => void;
export type OnAddToCart = (product: ProductRecommendation) => void;
export type OnError = (error: string | AIError) => void;

// Context Types
export interface AIContext {
  userId: string;
  sessionId?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  preferences?: {
    language: string;
    categories: string[];
    priceRange?: {
      min: number;
      max: number;
    };
    brands?: string[];
  };
  currentCart?: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
  recentOrders?: Array<{
    id: string;
    items: any[];
    total: number;
    date: string;
  }>;
  profile?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
}

// Database Schema Types (matching SQL schema)
export interface AIConversationDB {
  id: string;
  user_id: string;
  session_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  is_active: boolean;
}

export interface AIMessageDB {
  id: string;
  conversation_id: string;
  role: AIMessageRole;
  content: string;
  function_call?: Record<string, any>;
  function_response?: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AIVoiceSessionDB {
  id: string;
  user_id: string;
  session_type: VoiceSessionType;
  status: VoiceSessionStatus;
  language_code: string;
  voice_id: string;
  audio_input_url?: string;
  audio_output_url?: string;
  transcript?: string;
  confidence_score?: number;
  processing_time_ms?: number;
  context: Record<string, any>;
  results: Record<string, any>;
  error_details?: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface AIFunctionCallDB {
  id: string;
  conversation_id?: string;
  voice_session_id?: string;
  function_name: string;
  parameters: Record<string, any>;
  response?: Record<string, any>;
  execution_time_ms?: number;
  status: FunctionCallStatus;
  error_message?: string;
  created_at: string;
}

export interface AIRecommendationDB {
  id: string;
  user_id: string;
  recommendation_type: RecommendationType;
  context: Record<string, any>;
  recommendations: Record<string, any>;
  confidence_score?: number;
  reasoning?: string;
  metadata: Record<string, any>;
  generated_at: string;
  expires_at: string;
  view_count: number;
  click_count: number;
  conversion_count: number;
}

export interface AIAnalyticsDB {
  id: string;
  event_type: string;
  user_id?: string;
  session_id?: string;
  event_data: Record<string, any>;
  response_time_ms?: number;
  tokens_used?: number;
  cost_estimate?: number;
  user_agent?: string;
  ip_address?: string;
  location?: Record<string, any>;
  created_at: string;
}

// Export all types as a namespace for easier importing
export namespace AI {
  export type Message = ChatMessage;
  export type Conversation = ChatConversation;
  export type VoiceSession = VoiceOrderSession;
  export type Recommendation = ProductRecommendation;
  export type FunctionCall = AIFunctionCall;
  export type AnalyticsEvent = AIAnalyticsEvent;
  export type Config = AIAgentConfig;
  export type Context = AIContext;
  export type Error = AIError;
}

export default {
  // Re-export all types for convenience
  ChatMessage,
  ChatConversation,
  ChatRequest,
  ChatResponse,
  VoiceSearchRequest,
  VoiceSearchResult,
  VoiceOrderRequest,
  VoiceOrderResponse,
  VoiceOrderSession,
  ProductRecommendation,
  RecommendationsData,
  AIFunctionCall,
  AIFunction,
  AIAnalyticsEvent,
  AIAgentConfig,
  VoiceConfig,
  BedrockConfig,
  AIError,
  AIContext
};