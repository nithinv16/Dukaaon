import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, Animated, Platform } from 'react-native';
import { Text, IconButton, Surface, ActivityIndicator } from 'react-native-paper';
import azureFoundryService, { AIMessage, AIResponse } from '../../services/azureAI/azureFoundryService';

interface AzureAIAgentProps {
  sessionId: string;
  currentOrder?: any;
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
  isListening?: boolean;
  transcript?: string;
}

// Using AIMessage from the service
type ConversationMessage = AIMessage;

export const AzureAIAgent: React.FC<AzureAIAgentProps> = ({
  sessionId,
  currentOrder,
  onResponse,
  onError,
  isListening = false,
  transcript = ''
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [lastResponse, setLastResponse] = useState<string>(
    "Hi! I'm Dai, your AI ordering assistant. You can tell me what products you need, and I'll help you place an order."
  );
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);
  
  // Animation for processing indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeAgent();
  }, []);

  useEffect(() => {
    if (isProcessing) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isProcessing]);

  const initializeAgent = async () => {
    try {
      setIsProcessing(true);
      
      const success = await azureFoundryService.initialize();
      
      if (success) {
        const newThreadId = await azureFoundryService.createThread();
        if (newThreadId) {
          setThreadId(newThreadId);
          setIsInitialized(true);
          console.log('Azure AI Foundry agent initialized successfully');
        } else {
          throw new Error('Failed to create conversation thread');
        }
      } else {
        throw new Error('Failed to initialize Azure AI Foundry service');
      }
    } catch (error) {
      console.error('Failed to initialize Azure AI Agent:', error);
      const errorMessage = 'Failed to initialize AI assistant. Please try again.';
      setLastResponse(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const sendMessage = async (message: string): Promise<AIResponse | null> => {
    if (!isInitialized || !threadId || !message.trim()) {
      return null;
    }

    try {
      setIsProcessing(true);
      
      // Add user message to conversation history
      const userMessage: AIMessage = {
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      setConversationHistory(prev => [...prev, userMessage]);

      const response = await azureFoundryService.sendMessage(message, threadId);
      
      if (response.success) {
        setLastResponse(response.message);
        onResponse?.(response.message);
        
        // Add assistant message to conversation history
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: response.message,
          timestamp: new Date()
        };
        setConversationHistory(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = response.error || 'Failed to get response from AI assistant';
        setLastResponse(errorMessage);
        onError?.(errorMessage);
      }

      return response;
    } catch (error) {
      console.error('Error sending message to Azure AI:', error);
      const errorMessage = 'Sorry, I had trouble processing your request. Please try again.';
      setLastResponse(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const resetConversation = async () => {
    try {
      setIsProcessing(true);
      
      const newThreadId = await azureFoundryService.resetConversation();
      
      if (newThreadId) {
        setThreadId(newThreadId);
        setConversationHistory([]);
        setLastResponse("Hi! I'm Dai, your AI ordering assistant. You can tell me what products you need, and I'll help you place an order.");
        onResponse?.("Conversation reset. How can I help you today?");
        console.log('Conversation reset successfully');
      } else {
        throw new Error('Failed to create new conversation thread');
      }
    } catch (error) {
      console.error('Error resetting conversation:', error);
      const errorMessage = 'Failed to reset conversation. Please try again.';
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const getConversationHistory = async (): Promise<AIMessage[]> => {
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
  };

  const renderStatus = () => {
    if (!isInitialized) {
      return (
        <Surface style={styles.statusContainer} elevation={1}>
          <ActivityIndicator size="small" color="#667eea" />
          <Text style={styles.statusText}>Initializing AI Assistant...</Text>
        </Surface>
      );
    }

    if (isProcessing) {
      return (
        <Surface style={styles.statusContainer} elevation={1}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <IconButton icon="chat" size={24} iconColor="#667eea" />
          </Animated.View>
          <Text style={styles.statusText}>Processing...</Text>
        </Surface>
      );
    }

    if (isListening) {
      return (
        <Surface style={styles.statusContainer} elevation={1}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <IconButton icon="microphone" size={24} iconColor="#e74c3c" />
          </Animated.View>
          <Text style={styles.statusText}>Listening...</Text>
          {transcript && (
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          )}
        </Surface>
      );
    }

    return (
      <Surface style={styles.statusContainer} elevation={1}>
        <IconButton icon="chat" size={24} iconColor="#667eea" />
        <Text style={styles.statusText}>AI Assistant Ready</Text>
      </Surface>
    );
  };

  return (
    <View style={styles.container}>
      {renderStatus()}
      
      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <IconButton
          icon="refresh"
          size={20}
          iconColor="#667eea"
          onPress={resetConversation}
          disabled={isProcessing || !isInitialized}
          style={styles.actionButton}
        />
        <IconButton
          icon="history"
          size={20}
          iconColor="#667eea"
          onPress={getConversationHistory}
          disabled={isProcessing || !isInitialized}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
};

interface UseAzureAIAgentReturn {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  createThread: () => Promise<string>;
  sendMessage: (message: string, threadId?: string) => Promise<AIConversationResponse | null>;
  getHistory: (threadId: string) => Promise<any[]>;
  resetConversation: () => Promise<string>;
}

export const useAzureAIAgent = (sessionId: string, currentOrder?: any): UseAzureAIAgentReturn => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const success = await azureFoundryService.initialize();
      setIsReady(success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to initialize Azure AI agent:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const createThread = async (): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);
      const threadId = await azureFoundryService.createThread();
      if (!threadId) {
        throw new Error('Failed to create thread');
      }
      return threadId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to create thread:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (message: string, threadId?: string): Promise<AIConversationResponse | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const context: ConversationContext = {
        sessionId,
        cart: currentOrder
      };
      
      const response = await azureFoundryService.sendMessage(message, threadId || 'default');
      return {
        success: response.success,
        message: response.message,
        threadId: threadId || 'default'
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to send message:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getHistory = async (threadId: string): Promise<any[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const history = await azureFoundryService.getConversationHistory(threadId);
      return history;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to get conversation history:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = async (): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);
      const newThreadId = await azureFoundryService.resetConversation();
      if (!newThreadId) {
        throw new Error('Failed to reset conversation');
      }
      return newThreadId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to reset conversation:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isReady,
    isLoading,
    error,
    initialize,
    createThread,
    sendMessage,
    getHistory,
    resetConversation
  };
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  transcriptText: {
    marginLeft: 8,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#7f8c8d',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    marginLeft: 4,
  },
});

export default AzureAIAgent;