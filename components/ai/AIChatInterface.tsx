import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Chip, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  function_calls?: any[];
  suggestions?: string[];
}

interface AIChatInterfaceProps {
  userId: string;
  conversationId?: string;
  onNewConversation?: (conversationId: string) => void;
  onMessageSent?: (message: Message) => void;
  style?: any;
  placeholder?: string;
  showVoiceButton?: boolean;
  compact?: boolean;
}

const AIChatInterface: React.FC<AIChatInterfaceProps> = ({
  userId,
  conversationId,
  onNewConversation,
  onMessageSent,
  style,
  placeholder = "Ask Dai anything about products...",
  showVoiceButton = true,
  compact = false
}) => {
  const { currentLanguage } = useLanguage();
  
  // Original texts for translation
  const originalTexts = {
    askDaiAnything: 'Ask Dai anything about products...',
    searchForRice: 'Search for rice',
    showMeVegetables: 'Show me vegetables',
    whatAreTodaysDeals: 'What are today\'s deals?',
    showMeMoreProducts: 'Show me more products like this',
    whatAreBestDeals: 'What are the best deals today?',
    addThisToCart: 'Add this to cart',
    findSimilarProducts: 'Find similar products',
    chatWithDai: 'Chat with Dai',
    daiAiAssistant: 'Dai - AI Assistant',
    helloImDai: 'Hello! I\'m Dai',
    daiDescription: 'I can help you find products, place orders, and answer questions about Dukaaon marketplace.',
    daiIsThinking: 'Dai is thinking...',
    errorMessage: 'Sorry, I encountered an error. Please try again.',
    errorTitle: 'Error',
    errorDescription: 'Failed to send message. Please try again.'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        console.log('[AIChatInterface] Loading translations for language:', currentLanguage);
        
        if (currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock sharing screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`[AIChatInterface] Translating "${key}": "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`[AIChatInterface] Translation result for "${key}":`, translated);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('[AIChatInterface] All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('[AIChatInterface] Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Create a synchronous translation function for UI text
  const t = (key: string) => {
    return translations[key] || originalTexts[key] || key;
  };

  // Initialize suggestions when translations are loaded
  useEffect(() => {
    if (suggestions.length === 0) {
      setSuggestions([
        t('searchForRice'),
        t('showMeVegetables'),
        t('whatAreTodaysDeals')
      ]);
    }
  }, [translations]);

  // Translate existing AI messages when language changes
  useEffect(() => {
    const translateExistingMessages = async () => {
      if (messages.length === 0) return;
      
      const translatedMessages = await Promise.all(
        messages.map(async (message) => {
          if (message.role === 'assistant') {
            // Translate AI message content
            const translatedContent = await translateAIContent(message.content);
            
            // Translate suggestions if they exist
            let translatedSuggestions = message.suggestions;
            if (message.suggestions && message.suggestions.length > 0) {
              translatedSuggestions = await translateSuggestions(message.suggestions);
            }
            
            return {
              ...message,
              content: translatedContent,
              suggestions: translatedSuggestions
            };
          }
          return message; // Keep user messages unchanged
        })
      );
      
      setMessages(translatedMessages);
    };

    // Only translate if we have messages and language is not English
    if (messages.length > 0 && currentLanguage !== 'en') {
      translateExistingMessages();
    }
  }, [currentLanguage]);

  useEffect(() => {
    if (conversationId) {
      loadConversationHistory(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadConversationHistory = async (convId: string) => {
    try {
      setIsLoading(true);
      // Import the AI service dynamically
      const { bedrockAIService } = await import('../../services/aiAgent/bedrockAIService');
      
      // Load conversation history using the service directly
      const conversation = await bedrockAIService.getConversation(convId, userId);
      
      if (conversation && conversation.messages) {
        setMessages(conversation.messages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      Alert.alert('Error', 'Failed to load conversation history');
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = (content: string, functionCalls?: any[]): string[] => {
    const defaultSuggestions = [
      t('searchForRice'),
      t('showMeVegetables'),
      t('whatAreTodaysDeals')
    ];

    // Generate contextual suggestions based on AI response
    if (functionCalls && functionCalls.length > 0) {
      const contextualSuggestions = [];
      for (const call of functionCalls) {
        if (call.name === 'search_products') {
          contextualSuggestions.push(t('showMeMoreProducts'));
          contextualSuggestions.push(t('whatAreBestDeals'));
        } else if (call.name === 'get_product_details') {
          contextualSuggestions.push(t('addThisToCart'));
          contextualSuggestions.push(t('findSimilarProducts'));
        }
      }
      return contextualSuggestions.length > 0 ? contextualSuggestions : defaultSuggestions;
    }

    return defaultSuggestions;
  };

  // Add translation function for AI responses and suggestions
  const translateAIContent = async (content: string): Promise<string> => {
    if (currentLanguage === 'en') return content;
    
    try {
      const result = await translationService.translateText(content, currentLanguage, 'en');
      return result.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return content; // Fallback to original content
    }
  };

  const translateSuggestions = async (suggestions: string[]): Promise<string[]> => {
    if (currentLanguage === 'en') return suggestions;
    
    try {
      const results = await translationService.translateBatch(suggestions, currentLanguage, 'en');
      return results.map(result => result.translatedText);
    } catch (error) {
      console.error('Suggestions translation error:', error);
      return suggestions; // Fallback to original suggestions
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputText.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Use React Native compatible AI service
      const { reactNativeAIService } = await import('../../services/aiAgent/reactNativeAIService');
      
      // Prepare messages for AI service
      const aiMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Get AI response using the service directly with userId
      const aiResponse = await reactNativeAIService.sendMessage(aiMessages, userId, currentConversationId);

      // Translate AI response content if needed
      const translatedContent = await translateAIContent(aiResponse.content);
      
      // Translate AI-generated suggestions if needed
      const originalSuggestions = aiResponse.suggestions || generateSuggestions(aiResponse.content, aiResponse.function_calls);
      const translatedSuggestions = await translateSuggestions(originalSuggestions);

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: translatedContent,
        timestamp: new Date(),
        function_calls: aiResponse.function_calls,
        suggestions: translatedSuggestions
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Generate new conversation ID if needed
      if (!currentConversationId) {
        const newConversationId = `conv_${Date.now()}_${userId}`;
        setCurrentConversationId(newConversationId);
        onNewConversation?.(newConversationId);
      }

      // Update suggestions with translated versions
      setSuggestions(translatedSuggestions);

      // Notify parent component
      onMessageSent?.(aiMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: t('errorMessage'),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      Alert.alert(t('errorTitle'), t('errorDescription'));
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(undefined);
    setSuggestions([
      t('searchForRice'),
      t('showMeVegetables'),
      t('whatAreTodaysDeals')
    ]);
  };

  const handleSuggestionPress = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const openFullChat = () => {
    setIsModalVisible(true);
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    
    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.aiText
          ]}>
            {message.content}
          </Text>
          
          {message.function_calls && message.function_calls.length > 0 && (
            <View style={styles.functionCallsContainer}>
              {message.function_calls.map((call, idx) => (
                <View key={idx} style={styles.functionCallItem}>
                  <Chip
                    style={styles.functionChip}
                    textStyle={styles.functionChipText}
                  >
                    {call.name}
                  </Chip>
                  {call.result && (
                    <Text style={styles.functionResultText}>
                      {typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        
        <Text style={styles.timestamp}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  const renderCompactView = () => (
    <View style={[styles.compactContainer, style]}>
      <TouchableOpacity
        style={styles.compactButton}
        onPress={openFullChat}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubbles" size={20} color="#667eea" />
        <Text style={styles.compactButtonText}>{t('chatWithDai')}</Text>
        {messages.length > 0 && (
          <View style={styles.messageCount}>
            <Text style={styles.messageCountText}>{messages.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderFullInterface = () => (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={24} color="#667eea" />
          <Text style={styles.headerTitle}>{t('daiAiAssistant')}</Text>
        </View>
        <TouchableOpacity onPress={startNewConversation} style={styles.newChatButton}>
          <Ionicons name="add" size={20} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <Ionicons name="chatbubbles" size={48} color="#667eea" />
            <Text style={styles.welcomeTitle}>{t('helloImDai')}</Text>
            <Text style={styles.welcomeText}>
              {t('daiDescription')}
            </Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={styles.loadingText}>{t('daiIsThinking')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          style={styles.suggestionsContainer}
          contentContainerStyle={styles.suggestionsContent}
          showsHorizontalScrollIndicator={false}
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={placeholder || t('askDaiAnything')}
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
        />
        
        <View style={styles.inputActions}>
          {showVoiceButton && (
            <TouchableOpacity
              style={styles.voiceButton}
              onPress={() => {/* TODO: Implement voice input */}}
            >
              <Ionicons name="mic" size={20} color="#667eea" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(!inputText.trim() || isLoading) ? "#ccc" : "#fff"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (compact) {
    return (
      <>
        {renderCompactView()}
        <Modal
          visible={isModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView
              style={styles.modalContent}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {renderFullInterface()}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </>
    );
  }

  return renderFullInterface();
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  compactContainer: {
    padding: 16,
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  compactButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  messageCount: {
    marginLeft: 'auto',
    backgroundColor: '#667eea',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  newChatButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minHeight: 'auto',
  },
  userBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    flexWrap: 'wrap',
    textAlign: 'left',
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  functionCallsContainer: {
    flexDirection: 'column',
    marginTop: 8,
    gap: 8,
  },
  functionCallItem: {
    marginBottom: 4,
  },
  functionChip: {
    backgroundColor: '#e3f2fd',
    height: 28,
    alignSelf: 'flex-start',
  },
  functionChipText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  functionResultText: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1976d2',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  suggestionsContainer: {
    maxHeight: 50,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  suggestionsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  suggestionChip: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#667eea',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'relative',
    minHeight: 60,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  sendButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#667eea',
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
});

export default AIChatInterface;
