import { useState, useCallback, useEffect } from 'react';
import azureFoundryService, { AIMessage, AIResponse } from '../services/azureAI/azureFoundryService';
import { supabase } from '../services/supabase/supabase';
import { useAuthStore } from '../store/auth';

export interface Conversation {
  conversation_id: string;
  thread_id: string;
  title: string;
  status: string;
  last_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface UseAzureAIAgentReturn {
  isInitialized: boolean;
  isProcessing: boolean;
  threadId: string | null;
  lastResponse: string;
  conversationHistory: AIMessage[];
  conversations: Conversation[];
  currentConversation: Conversation | null;
  initializeAgent: () => Promise<void>;
  sendMessage: (message: string) => Promise<AIResponse | null>;
  resetConversation: () => Promise<void>;
  getConversationHistory: () => Promise<AIMessage[]>;
  loadConversation: (threadId: string) => Promise<void>;
  getUserConversations: () => Promise<Conversation[]>;
  createNewConversation: (title?: string) => Promise<void>;
  updateConversationTitle: (threadId: string, title: string) => Promise<void>;
}

export const useAzureAIAgent = (sessionId?: string): UseAzureAIAgentReturn => {
  const { user } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>(
    "Hi! I'm Dai, your AI ordering assistant. You can tell me what products you need, and I'll help you place an order."
  );
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  const initializeAgent = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      const success = await azureFoundryService.initialize();
      
      if (success) {
        setIsInitialized(true);
        console.log('Azure AI Agent initialized successfully');
      } else {
        setLastResponse('Failed to initialize AI assistant. Please try again.');
      }
    } catch (error) {
      console.error('Failed to initialize Azure AI Agent:', error);
      setLastResponse('Failed to initialize AI assistant. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const sendMessage = async (message: string): Promise<AIResponse | null> => {
    if (!isInitialized || !message.trim()) {
      return null;
    }

    try {
      setIsProcessing(true);
      
      // Ensure we have a thread ID
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await azureFoundryService.createThread();
        if (!currentThreadId) {
          throw new Error('Failed to create conversation thread');
        }
        setThreadId(currentThreadId);
      }
      
      const response = await azureFoundryService.sendMessage(message, currentThreadId);
      
      if (response.success) {
        setLastResponse(response.message);
        
        // Get updated conversation history from the service
        const updatedHistory = await azureFoundryService.getConversationHistory(currentThreadId);
        setConversationHistory(updatedHistory);
      } else {
        const errorMessage = response.error || 'Failed to get response from AI assistant';
        setLastResponse(errorMessage);
      }

      return response;
    } catch (error) {
      console.error('Error sending message to Azure AI:', error);
      const errorMessage = 'Sorry, I had trouble processing your request. Please try again.';
      setLastResponse(errorMessage);
      return {
        message: errorMessage,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const resetConversation = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      const newThreadId = await azureFoundryService.resetConversation();
      
      if (newThreadId) {
        setThreadId(newThreadId);
        setConversationHistory([]);
        setLastResponse("Hi! I'm Dai, your AI ordering assistant. You can tell me what products you need, and I'll help you place an order.");
      } else {
        throw new Error('Failed to create new conversation thread');
      }
    } catch (error) {
      console.error('Error resetting conversation:', error);
      setLastResponse('Failed to reset conversation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getConversationHistory = useCallback(async (): Promise<AIMessage[]> => {
    if (!threadId) return [];
    
    try {
      const history = await azureFoundryService.getConversationHistory(threadId);
      
      if (history.length > 0) {
        setConversationHistory(history);
        return history;
      }
      
      return conversationHistory;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return conversationHistory;
    }
  }, [threadId, conversationHistory]);

  const getUserConversations = useCallback(async (): Promise<Conversation[]> => {
    if (!user?.id) return [];
    
    try {
      const { data, error } = await supabase.rpc('get_user_ai_conversations', {
        p_user_id: user.id,
        p_limit: 20
      });
      
      if (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }
      
      const conversationList = data || [];
      setConversations(conversationList);
      return conversationList;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }, [user?.id]);

  const loadConversation = useCallback(async (targetThreadId: string) => {
    try {
      setIsProcessing(true);
      
      // Set the thread ID
      setThreadId(targetThreadId);
      
      // Load conversation history
      const history = await azureFoundryService.getConversationHistory(targetThreadId);
      setConversationHistory(history);
      
      // Set last response from history
      if (history.length > 0) {
        const lastMessage = history[history.length - 1];
        if (lastMessage.role === 'assistant') {
          setLastResponse(lastMessage.content);
        }
      }
      
      // Find and set current conversation
      const conversation = conversations.find(c => c.thread_id === targetThreadId);
      setCurrentConversation(conversation || null);
      
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [conversations]);

  const createNewConversation = useCallback(async (title: string = 'New Conversation') => {
    try {
      setIsProcessing(true);
      
      // Create new thread
      const newThreadId = await azureFoundryService.createThread();
      
      if (newThreadId) {
        setThreadId(newThreadId);
        setConversationHistory([]);
        setLastResponse("Hi! I'm Dai, your AI ordering assistant. You can tell me what products you need, and I'll help you place an order.");
        setCurrentConversation(null);
        
        // Refresh conversations list
        await getUserConversations();
      } else {
        throw new Error('Failed to create new conversation thread');
      }
    } catch (error) {
      console.error('Error creating new conversation:', error);
      setLastResponse('Failed to create new conversation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [getUserConversations]);

  const updateConversationTitle = useCallback(async (targetThreadId: string, title: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('thread_id', targetThreadId);
      
      if (error) {
        console.error('Error updating conversation title:', error);
        return;
      }
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.thread_id === targetThreadId 
            ? { ...conv, title }
            : conv
        )
      );
      
      if (currentConversation?.thread_id === targetThreadId) {
        setCurrentConversation(prev => prev ? { ...prev, title } : null);
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  }, [user?.id, currentConversation]);

  // Auto-initialize on mount and load conversations
  useEffect(() => {
    initializeAgent();
  }, [initializeAgent]);

  // Load user conversations when user is available
  useEffect(() => {
    if (user?.id && isInitialized) {
      getUserConversations();
    }
  }, [user?.id, isInitialized, getUserConversations]);

  return {
    isInitialized,
    isProcessing,
    threadId,
    lastResponse,
    conversationHistory,
    conversations,
    currentConversation,
    initializeAgent,
    sendMessage,
    resetConversation,
    getConversationHistory,
    getUserConversations,
    loadConversation,
    createNewConversation,
    updateConversationTitle,
  };
};

export default useAzureAIAgent;