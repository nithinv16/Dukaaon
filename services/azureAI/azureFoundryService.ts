import { Platform } from 'react-native';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AZURE_AI_CONFIG } from '../../config/azureAI';
import { executeAssistantFunction, saveAIMessage, getOrCreateAIConversation, getCurrentUserId } from './assistantFunctions';
import { supabase } from '../supabase/supabase';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Types for Azure AI Foundry REST API
export interface AzureFoundryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AzureFoundryResponse {
  success: boolean;
  message: string;
  threadId?: string;
  error?: string;
}

export interface AzureFoundryThread {
  id: string;
  created_at: number;
  metadata?: Record<string, any>;
}

export interface AzureFoundryRun {
  id: string;
  thread_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  created_at: number;
  completed_at?: number;
}

class AzureFoundryService {
  private baseUrl: string;
  private apiKey: string;
  private agentId: string;
  private apiVersion: string = '2025-04-01-preview';
  private isInitialized: boolean = false;
  private apiClient: AxiosInstance;
  private conversations: Map<string, AzureFoundryMessage[]> = new Map();
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    // Use Azure OpenAI endpoint instead of Azure AI Projects for API key compatibility
    const azureOpenAIEndpoint = process.env.EXPO_PUBLIC_AZURE_AI_ENDPOINT || '';
    this.baseUrl = azureOpenAIEndpoint;
    this.apiKey = process.env.EXPO_PUBLIC_AZURE_OPENAI_API_KEY || process.env.EXPO_PUBLIC_AZURE_AI_API_KEY || '';
    this.agentId = AZURE_AI_CONFIG.agentId;
    this.tenantId = process.env.EXPO_PUBLIC_AZURE_TENANT_ID || '';
    this.clientId = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID || '';
    this.clientSecret = process.env.EXPO_PUBLIC_AZURE_CLIENT_SECRET || '';

    console.log('Azure AI Foundry Service initialized with:', {
      baseUrl: this.baseUrl,
      agentId: this.agentId,
      hasApiKey: !!this.apiKey,
      hasTenantId: !!this.tenantId,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      apiKeySource: process.env.EXPO_PUBLIC_AZURE_AI_API_KEY ? 'AZURE_AI_API_KEY' : 'AZURE_OPENAI_API_KEY',
      endpointSource: process.env.EXPO_PUBLIC_AZURE_AI_FOUNDRY_ENDPOINT ? 'FOUNDRY_ENDPOINT' : 'CONFIG_ENDPOINT'
    });
    
    // Initialize axios client
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dukaaon-AI-Agent/1.0'
      },
      timeout: 30000 // 30 seconds timeout
    });
  }

  /**
   * Get Microsoft Entra ID access token
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Get new token from Microsoft Entra ID
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const tokenData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://cognitiveservices.azure.com/.default'
      });

      const response = await axios.post<TokenResponse>(tokenUrl, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Set expiry to 5 minutes before actual expiry for safety
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
        
        // Update axios client headers
        this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        
        return this.accessToken;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Initialize the Azure Foundry service
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.baseUrl || !this.agentId) {
        console.error('Azure AI Foundry configuration missing');
        return false;
      }

      if (!this.apiKey) {
        console.error('No API key available');
        return false;
      }

      // Use Azure OpenAI API key authentication
      this.apiClient.defaults.headers.common['api-key'] = this.apiKey;

      // Test connection by creating a thread with API version
      const response = await this.apiClient.post(`/openai/threads?api-version=${this.apiVersion}`, {
        metadata: { test: 'connection' }
      });
      
      if (response.status === 200) {
        this.isInitialized = true;
        console.log('Azure AI Foundry service initialized successfully');
        return true;
      } else {
        console.error('Failed to initialize Azure AI Foundry service:', response.status);
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to initialize Azure AI Foundry service:', error.response?.status, error.response?.data);
      } else {
        console.error('Failed to initialize Azure AI Foundry service:', error);
      }
      return false;
    }
  }

  /**
   * Create a new conversation thread
   */
  async createThread(): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Create a thread using Azure OpenAI Assistants API
      const response = await this.apiClient.post(`/openai/threads?api-version=${this.apiVersion}`, {
        metadata: { created_at: new Date().toISOString() }
      });
      
      if (response.data && response.data.id) {
        const threadId = response.data.id;
        console.log('Thread created:', threadId);
        return threadId;
      } else {
        console.error('Failed to create thread: No thread ID returned');
        return null;
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      return null;
    }
  }

  /**
   * Send a message to the agent and get response
   */
  async sendMessage(
    message: string, 
    threadId: string, 
    context?: Record<string, any>
  ): Promise<AzureFoundryResponse> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Step 1: Add user message to the thread
      const messageResponse = await this.apiClient.post(`/openai/threads/${threadId}/messages?api-version=${this.apiVersion}`, {
        role: 'user',
        content: message
      });

      if (!messageResponse.data) {
        throw new Error('Failed to add message to thread');
      }

      // Step 2: Create a run to process the message
      const runResponse = await this.apiClient.post(`/openai/threads/${threadId}/runs?api-version=${this.apiVersion}`, {
        assistant_id: this.agentId
      });

      if (!runResponse.data || !runResponse.data.id) {
        throw new Error('Failed to create run');
      }

      const runId = runResponse.data.id;

      // Step 3: Poll for run completion
      let runStatus = 'queued';
      let attempts = 0;
      const maxAttempts = AZURE_AI_CONFIG.maxPollingAttempts;
      const pollingInterval = AZURE_AI_CONFIG.pollingInterval;
      let runData = null;

      while (runStatus === 'queued' || runStatus === 'in_progress' || runStatus === 'requires_action') {
        if (attempts >= maxAttempts) {
          throw new Error('Run timed out');
        }

        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        
        const statusResponse = await this.apiClient.get(`/openai/threads/${threadId}/runs/${runId}?api-version=${this.apiVersion}`);
        runStatus = statusResponse.data.status;
        runData = statusResponse.data;
        attempts++;

        // Handle function calls
        if (runStatus === 'requires_action' && runData.required_action?.type === 'submit_tool_outputs') {
          const toolCalls = runData.required_action.submit_tool_outputs.tool_calls;
          const toolOutputs = [];

          for (const toolCall of toolCalls) {
            try {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);
              
              console.log(`Executing function: ${functionName} with args:`, functionArgs);
              
              const result = await executeAssistantFunction(functionName, functionArgs);
              
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(result)
              });
            } catch (error) {
              console.error(`Error executing function ${toolCall.function.name}:`, error);
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
              });
            }
          }

          // Submit tool outputs
          await this.apiClient.post(
            `/openai/threads/${threadId}/runs/${runId}/submit_tool_outputs?api-version=${this.apiVersion}`,
            { tool_outputs: toolOutputs }
          );
          
          // Reset status to continue polling
          runStatus = 'in_progress';
        }
      }

      if (runStatus === 'completed') {
        // Step 4: Get the assistant's response
        const messagesResponse = await this.apiClient.get(`/openai/threads/${threadId}/messages?api-version=${this.apiVersion}`);
        
        if (messagesResponse.data && messagesResponse.data.data && messagesResponse.data.data.length > 0) {
          // Get the latest assistant message
          const latestMessage = messagesResponse.data.data.find((msg: any) => msg.role === 'assistant');
          
          if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
            const assistantResponse = latestMessage.content[0].text.value;
            
            // Update local conversation history
            let conversationHistory = this.conversations.get(threadId) || [];
            conversationHistory.push(
              {
                role: 'user',
                content: message,
                timestamp: new Date()
              },
              {
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date()
              }
            );
            this.conversations.set(threadId, conversationHistory);
            
            // Save to database if user is authenticated
            try {
              const userId = getCurrentUserId();
              if (userId) {
                const conversationId = await getOrCreateAIConversation(threadId, 'AI Chat');
                
                // Save user message
                await saveAIMessage(conversationId, 'user', message);
                
                // Save assistant response with function calls if any
                const functionCalls = runData.required_action?.submit_tool_outputs?.tool_calls || [];
                await saveAIMessage(
                  conversationId, 
                  'assistant', 
                  assistantResponse, 
                  functionCalls,
                  { runId, threadId }
                );
              }
            } catch (dbError) {
              console.warn('Failed to save conversation to database:', dbError);
              // Continue without failing the main operation
            }
            
            return {
              success: true,
              message: assistantResponse,
              threadId: threadId
            };
          }
        }
        
        return {
          success: false,
          message: 'No response received from assistant',
          error: 'Empty response from API'
        };
      } else {
        return {
          success: false,
          message: 'Failed to process message',
          error: `Run failed with status: ${runStatus}`
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error sending message to Azure AI Foundry:', error.response?.status, error.response?.data);
        return {
          success: false,
          message: 'An error occurred while processing your message',
          error: `Failed to send message: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`
        };
      } else {
        console.error('Error sending message:', error);
        return {
          success: false,
          message: 'An error occurred while processing your message',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  }



  /**
   * Get conversation history from a thread
   */
  async getConversationHistory(threadId: string): Promise<AzureFoundryMessage[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Try to get from database first if user is authenticated
      try {
        const userId = getCurrentUserId();
        if (userId) {
          const { data, error } = await supabase.rpc('get_ai_conversation_history', {
            p_user_id: userId,
            p_thread_id: threadId,
            p_limit: 50
          });
          
          if (!error && data && data.length > 0) {
            const messages = data.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at)
            }));
            
            // Update local cache
            this.conversations.set(threadId, messages);
            console.log('Getting conversation history for thread:', threadId, 'Found', messages.length, 'messages (from database)');
            return messages;
          }
        }
      } catch (dbError) {
        console.warn('Failed to fetch from database, trying API:', dbError);
      }

      // Try to get from Azure OpenAI Assistants API
      try {
        const response = await this.apiClient.get(`/openai/threads/${threadId}/messages?api-version=${this.apiVersion}`);
        
        if (response.data && response.data.data) {
          const messages = response.data.data.map((msg: any) => ({
            role: msg.role,
            content: msg.content[0]?.text?.value || msg.content,
            timestamp: new Date(msg.created_at * 1000)
          })).reverse(); // Reverse to get chronological order
          
          // Update local cache
          this.conversations.set(threadId, messages);
          console.log('Getting conversation history for thread:', threadId, 'Found', messages.length, 'messages (from API)');
          return messages;
        }
      } catch (apiError) {
        console.warn('Failed to fetch from API, using local cache:', apiError);
      }

      // Fallback to local conversation history
      const history = this.conversations.get(threadId) || [];
      console.log('Getting conversation history for thread:', threadId, 'Found', history.length, 'messages (from cache)');
      return history;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Reset conversation by creating a new thread
   */
  async resetConversation(): Promise<string | null> {
    const newThreadId = await this.createThread();
    if (newThreadId) {
      // Clear any existing conversation history for the new thread
      this.conversations.set(newThreadId, []);
    }
    return newThreadId;
  }



  /**
   * Check if service is ready
   */
  get isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get agent information
   */
  async getAgentInfo(): Promise<any> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // For chat completions API, return basic agent info
      return {
        id: this.agentId,
        name: 'Dai',
        description: 'AI assistant for Dukaaon agricultural marketplace',
        model: this.agentId
      };
    } catch (error) {
      console.error('Error getting agent info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const azureFoundryService = new AzureFoundryService();
export default azureFoundryService;

// Export types
export type { AzureFoundryMessage as AIMessage, AzureFoundryResponse as AIResponse };