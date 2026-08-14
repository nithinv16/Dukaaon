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
  Image,
  ActionSheetIOS,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Button, Chip, FAB } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import OrderReviewCard from './OrderReviewCard';
import ProductSearchResultsCard, { ProductSearchResult } from './ProductSearchResultsCard';
import EnhancedVoiceSearch from '../common/EnhancedVoiceSearch';
import { getNativeVoiceService } from '../../services/voice/nativeVoiceService';
import VoiceConversationInterface from './VoiceConversationInterface';

// Order item for image-based ordering
interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  image_url?: string;
  unit?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  function_calls?: any[];
  suggestions?: string[];
  order_items?: OrderItem[];  // For image-based order review
  unavailable_items?: string[];  // Items not found
  search_results?: ProductSearchResult[];  // For product search results display
  search_query?: string;  // The search query used
}

interface AIChatInterfaceProps {
  userId: string;
  conversationId?: string;
  onNewConversation?: (conversationId: string) => void;
  onMessageSent?: (message: Message) => void;
  onBack?: () => void;
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
  onBack,
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
    yourAiAssistant: 'Your AI Assistant',
    helloImDai: 'Hello! I\'m Dai',
    daiDescription: 'I can help you find products, place orders, and answer questions about Dukaaon marketplace.',
    daiIsThinking: 'Dai is thinking...',
    errorMessage: 'Sorry, I encountered an error. Please try again.',
    errorTitle: 'Error',
    errorDescription: 'Failed to send message. Please try again.',
    takePhoto: 'Take Photo',
    chooseFromGallery: 'Choose from Gallery',
    cancel: 'Cancel',
    selectImage: 'Select Image',
    processingImage: 'Processing product list...',
    imageAttached: 'Image attached',
    // Loading and welcome screen texts
    loadingConversation: 'Loading conversation...',
    restoringChatHistory: 'Restoring your chat history',
    yourIntelligentAssistant: 'Your Intelligent Assistant',
    tryAskingMe: 'Try asking me:',
    popularProducts: 'Popular Products',
    nearbySellers: 'Nearby Sellers',
    viewCart: 'View Cart',
    orderHistory: 'Order History',
    showMePopularProducts: 'Show me popular products',
    findNearbySellers: 'Find nearby sellers',
    showMyCart: 'Show my cart',
    trackMyOrders: 'Track my orders'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Image picker state
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    base64: string;
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  } | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showImageActionSheet, setShowImageActionSheet] = useState(false);

  // Feedback state
  const [messageFeedback, setMessageFeedback] = useState<{ [messageId: string]: 'positive' | 'negative' }>({});
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<Message | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<'positive' | 'negative' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<string | null>(null);

  // Chat history state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [conversationList, setConversationList] = useState<{
    id: string;
    thread_id: string;
    title: string;
    last_message?: string;
    message_count: number;
    created_at: Date;
    updated_at: Date;
  }[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Voice mode state - AI responds with voice
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceService] = useState(() => getNativeVoiceService());

  // Voice conversation mode - full conversational interface
  const [showVoiceConversation, setShowVoiceConversation] = useState(false);

  // Voice Live mode - Azure real-time voice AI

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
    return (translations as Record<string, string>)[key] || (originalTexts as Record<string, string>)[key] || key;
  };

  // Initialize/update suggestions when translations are loaded
  useEffect(() => {
    // Always update default suggestions when translations change
    const defaultSuggestions = [
      translations.searchForRice || originalTexts.searchForRice,
      translations.showMeVegetables || originalTexts.showMeVegetables,
      translations.whatAreTodaysDeals || originalTexts.whatAreTodaysDeals
    ];
    setSuggestions(defaultSuggestions);
    console.log('[AIChatInterface] Updated suggestions to:', defaultSuggestions);
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
      setCurrentConversationId(conversationId);
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
      setIsLoadingHistory(true);
      console.log('[AIChatInterface] Loading conversation history for:', convId);

      // Import the AI service dynamically
      const { bedrockAIService } = await import('../../services/aiAgent/bedrockAIService');

      // Load conversation history using the service directly
      const conversation = await bedrockAIService.getConversation(convId, userId);

      if (conversation && conversation.messages) {
        // Convert AIMessage format to Message format, restoring search_results and order_items from metadata
        const loadedMessages: Message[] = conversation.messages.map((msg: any, idx: number) => {
          const metadata = msg.metadata || {};
          return {
            id: `loaded_${Date.now()}_${idx}`,
            role: msg.role as 'user' | 'assistant',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: msg.timestamp || new Date(),
            function_calls: msg.function_calls,
            // Restore search_results, order_items, and unavailable_items from metadata
            search_results: metadata.search_results,
            search_query: metadata.search_query,
            order_items: metadata.order_items,
            unavailable_items: metadata.unavailable_items
          };
        });
        setMessages(loadedMessages);
        const restoredCards = loadedMessages.filter(m => m.search_results || m.order_items).length;
        console.log('[AIChatInterface] Loaded', loadedMessages.length, 'messages from history,', restoredCards, 'with cards');
      } else {
        console.log('[AIChatInterface] No conversation history found for:', convId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      Alert.alert('Error', 'Failed to load conversation history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save message to database
  const saveMessageToDatabase = async (message: Message) => {
    try {
      if (!currentConversationId) {
        // Generate conversation ID if it doesn't exist
        const newConversationId = `conv_${Date.now()}_${userId}`;
        setCurrentConversationId(newConversationId);
        onNewConversation?.(newConversationId);
      }

      const { bedrockAIService } = await import('../../services/aiAgent/bedrockAIService');

      // Convert Message to AIMessage format, including search_results and order_items
      // Store them in metadata so they can be restored when loading history
      const metadata: Record<string, any> = {};
      if (message.search_results && message.search_results.length > 0) {
        metadata.search_results = message.search_results;
        metadata.search_query = message.search_query;
      }
      if (message.order_items && message.order_items.length > 0) {
        metadata.order_items = message.order_items;
      }
      if (message.unavailable_items && message.unavailable_items.length > 0) {
        metadata.unavailable_items = message.unavailable_items;
      }

      const aiMessage = {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        function_calls: message.function_calls,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      };

      await bedrockAIService.saveMessage(currentConversationId!, userId, aiMessage);
      console.log('[AIChatInterface] Saved message to database:', message.role,
        metadata.search_results ? `with ${metadata.search_results.length} search results` : '',
        metadata.order_items ? `and ${metadata.order_items.length} order items` : '');
    } catch (error) {
      console.error('[AIChatInterface] Error saving message to database:', error);
      // Don't show error to user - saving is non-critical
    }
  };

  // Load user's conversation history
  const loadUserConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const { bedrockAIService } = await import('../../services/aiAgent/bedrockAIService');
      const conversations = await bedrockAIService.getUserConversations(userId);
      setConversationList(conversations);
      console.log('[AIChatInterface] Loaded', conversations.length, 'conversations');
    } catch (error) {
      console.error('[AIChatInterface] Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversation history');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Handle selecting a conversation from history
  const handleSelectConversation = async (threadId: string) => {
    setShowHistoryModal(false);
    setMessages([]); // Clear current messages
    setCurrentConversationId(threadId);
    onNewConversation?.(threadId);
    await loadConversationHistory(threadId);
  };

  // Start a new conversation
  const handleNewConversation = () => {
    setShowHistoryModal(false);
    const newConvId = `conv_${Date.now()}_${userId}`;
    setMessages([]);
    setCurrentConversationId(newConvId);
    onNewConversation?.(newConvId);
    console.log('[AIChatInterface] Started new conversation:', newConvId);
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

    // Allow sending if there's text OR an image
    if ((!text && !selectedImage) || isLoading) return;

    // Create user message content
    let displayContent = text || '';
    if (selectedImage) {
      displayContent = text ? `📷 ${t('imageAttached')}: ${text}` : `📷 ${t('imageAttached')}`;
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: displayContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Save user message to database
    await saveMessageToDatabase(userMessage);

    // Store image info before clearing
    const imageToSend = selectedImage;
    setSelectedImage(null);

    try {
      // Use React Native compatible AI service
      const { reactNativeAIService } = await import('../../services/aiAgent/reactNativeAIService');

      let aiResponse;

      if (imageToSend) {
        // Send image with multimodal message
        setIsProcessingImage(true);

        // Create multimodal message content for Claude
        const multimodalContent = [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: imageToSend.mediaType,
              data: imageToSend.base64
            }
          },
          {
            type: 'text' as const,
            text: text || 'Please analyze this product list image and extract all products with their quantities. Search for each product in nearby seller inventory (within 50km) and show me which products are available with seller details, prices, and which are not available.'
          }
        ];

        // Prepare message with image
        const aiMessages = messages.concat({
          ...userMessage,
          content: multimodalContent as any
        }).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

        aiResponse = await reactNativeAIService.sendMessage(aiMessages, userId, currentConversationId);
        setIsProcessingImage(false);
      } else {
        // Regular text message
        const aiMessages = messages.concat(userMessage).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

        aiResponse = await reactNativeAIService.sendMessage(aiMessages, userId, currentConversationId);
      }

      // Translate AI response content if needed
      let contentToShow = aiResponse.content;
      let orderItems: OrderItem[] = [];
      let unavailableItems: string[] = [];
      let isJsonOrderResponse = false;

      // Check if response is a JSON order_review format
      try {
        let trimmedContent = aiResponse.content.trim();

        // Strip markdown code block if present (```json ... ``` or ``` ... ```)
        if (trimmedContent.startsWith('```')) {
          // Remove opening ``` or ```json
          trimmedContent = trimmedContent.replace(/^```(?:json)?\s*\n?/, '');
          // Remove closing ```
          trimmedContent = trimmedContent.replace(/\n?```\s*$/, '');
        }

        if (trimmedContent.startsWith('{') && trimmedContent.includes('"type"')) {
          const jsonResponse = JSON.parse(trimmedContent);

          if (jsonResponse.type === 'order_review') {
            isJsonOrderResponse = true;
            contentToShow = jsonResponse.message || 'Order review ready';

            // Parse available items
            if (jsonResponse.available_items && Array.isArray(jsonResponse.available_items)) {
              orderItems = jsonResponse.available_items.map((item: any, idx: number) => ({
                id: `order_item_${Date.now()}_${idx}`,
                product_id: item.product_id,
                name: item.name,
                quantity: Math.max(item.requested_qty || 1, item.min_quantity || 1), // Apply min qty logic
                unit_price: item.unit_price || 0,
                unit: item.unit,
                min_quantity: item.min_quantity || 1,
                seller_name: item.seller_name,
                image_url: item.image_url
              }));
            }

            // Parse unavailable items
            if (jsonResponse.unavailable_items && Array.isArray(jsonResponse.unavailable_items)) {
              unavailableItems = jsonResponse.unavailable_items.map((item: any) =>
                typeof item === 'string' ? item : `${item.name} (${item.reason || 'not found'})`
              );
            }

            console.log('[AIChatInterface] Parsed JSON order review:', orderItems.length, 'items,', unavailableItems.length, 'unavailable');
          }
        }
      } catch (e) {
        console.log('[AIChatInterface] Not a JSON response:', e);
      }

      // Use order_items from aiResponse (parsed by reactNativeAIService)
      if ((aiResponse as any).order_items && (aiResponse as any).order_items.length > 0) {
        orderItems = (aiResponse as any).order_items.map((item: any, idx: number) => ({
          id: item.id || `order_item_${Date.now()}_${idx}`,
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          unit: item.unit,
          image_url: item.image_url,
          min_quantity: item.min_quantity || 1,
          seller_name: item.seller_name
        }));
        console.log('[AIChatInterface] Using order_items from aiResponse:', orderItems.length);
      }

      if ((aiResponse as any).unavailable_items && (aiResponse as any).unavailable_items.length > 0) {
        unavailableItems = (aiResponse as any).unavailable_items;
        console.log('[AIChatInterface] Unavailable items:', unavailableItems);
      }

      const translatedContent = await translateAIContent(contentToShow);

      // Translate AI-generated suggestions if needed
      const originalSuggestions = aiResponse.suggestions || generateSuggestions(aiResponse.content, aiResponse.function_calls);
      const translatedSuggestions = await translateSuggestions(originalSuggestions);

      // Extract search results if available
      let searchResults: ProductSearchResult[] = [];
      let searchQuery = '';

      if ((aiResponse as any).search_results && (aiResponse as any).search_results.length > 0) {
        searchResults = (aiResponse as any).search_results.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          name: item.name,
          price: item.price || item.unit_price || 0,
          unit: item.unit,
          min_quantity: item.min_quantity,
          stock_available: item.stock_available,
          seller_name: item.seller_name,
          seller_id: item.seller_id,
          distance_km: item.distance_km,
          image_url: item.image_url
        }));
        searchQuery = (aiResponse as any).search_query || '';
        console.log('[AIChatInterface] Search results found:', searchResults.length, 'for query:', searchQuery);
      }

      // Determine display content based on results type
      // order_items: used for image-based orders (OrderReviewCard)
      // search_results: used for text searches (ProductSearchResultsCard)
      let displayContent = translatedContent;
      if (orderItems.length > 0) {
        displayContent = 'I found products from your list. Please review and confirm your order:';
      } else if (searchResults.length > 0) {
        // Simplify message when showing search results card
        displayContent = `I found ${searchResults.length} ${searchQuery || 'product'} option${searchResults.length > 1 ? 's' : ''} for you:`;
      }

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: displayContent,
        timestamp: new Date(),
        function_calls: aiResponse.function_calls,
        suggestions: translatedSuggestions,
        order_items: orderItems.length > 0 ? orderItems : undefined,
        unavailable_items: unavailableItems.length > 0 ? unavailableItems : undefined,
        search_results: searchResults.length > 0 ? searchResults : undefined,
        search_query: searchQuery || undefined
      };

      console.log('[AIChatInterface] Message sent:', JSON.stringify({
        content: aiMessage.content.substring(0, 100),
        function_calls: aiMessage.function_calls?.map(c => c.name),
        order_items_count: aiMessage.order_items?.length,
        search_results_count: aiMessage.search_results?.length,
        search_query: aiMessage.search_query,
        unavailable_items: aiMessage.unavailable_items
      }, null, 2));

      setMessages(prev => [...prev, aiMessage]);

      // Generate new conversation ID if needed
      if (!currentConversationId) {
        const newConversationId = `conv_${Date.now()}_${userId}`;
        setCurrentConversationId(newConversationId);
        onNewConversation?.(newConversationId);
      }

      // Save assistant message to database
      await saveMessageToDatabase(aiMessage);

      // Speak AI response if voice mode is enabled
      if (isVoiceMode && displayContent) {
        setIsSpeaking(true);
        try {
          // Strip any JSON or code from the response for speaking
          const textToSpeak = displayContent
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/\{[\s\S]*?\}/g, '') // Remove JSON
            .replace(/\[[\s\S]*?\]/g, '') // Remove arrays
            .replace(/\*/g, '') // Remove asterisks
            .trim();

          if (textToSpeak) {
            await voiceService.speak(textToSpeak, currentLanguage || 'en-US');
          }
        } catch (speakError) {
          console.error('[AIChatInterface] Error speaking response:', speakError);
        } finally {
          setIsSpeaking(false);
        }
      }

      // Update suggestions with translated versions
      setSuggestions(translatedSuggestions);

      // Notify parent component
      onMessageSent?.(aiMessage);

    } catch (error: any) {
      console.error('Error sending message:', error);
      setIsProcessingImage(false);

      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `${t('errorMessage')}\n\nError: ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      // Save error message to database
      await saveMessageToDatabase(errorMessage);

      Alert.alert(t('errorTitle'), `${t('errorDescription')}\n\n${error.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Image picker functions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const getMediaType = (uri: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  };

  const processPickedImage = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      try {
        // Read the image as base64
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setSelectedImage({
          uri: asset.uri,
          base64: base64,
          mediaType: getMediaType(asset.uri)
        });
      } catch (error) {
        console.error('Error processing image:', error);
        Alert.alert('Error', 'Failed to process the image. Please try again.');
      }
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false, // We'll read it separately for better control
    });

    await processPickedImage(result);
    setShowImageActionSheet(false);
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Photo library access is required to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    await processPickedImage(result);
    setShowImageActionSheet(false);
  };

  const showImagePicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('cancel'), t('takePhoto'), t('chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        }
      );
    } else {
      // For Android, show our custom action sheet
      setShowImageActionSheet(true);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(undefined);
    setSelectedImage(null);
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

  // =====================================================
  // FEEDBACK HANDLERS
  // =====================================================

  // Handle quick feedback (thumbs up/down)
  const handleQuickFeedback = async (message: Message, rating: 'positive' | 'negative') => {
    // If already has same feedback, ignore
    if (messageFeedback[message.id] === rating) return;

    // Update local state immediately for UI responsiveness
    setMessageFeedback(prev => ({ ...prev, [message.id]: rating }));

    // If negative feedback, show modal for more details
    if (rating === 'negative') {
      setFeedbackMessage(message);
      setFeedbackRating(rating);
      setFeedbackModalVisible(true);
      return;
    }

    // For positive feedback, save immediately
    await saveFeedbackToDatabase(message, rating);
  };

  // Save feedback to database
  const saveFeedbackToDatabase = async (
    message: Message,
    rating: 'positive' | 'negative',
    category?: string,
    text?: string
  ) => {
    try {
      const { bedrockAIService } = await import('../../services/aiAgent/bedrockAIService');

      // Find the previous user message (the query that led to this response)
      const messageIndex = messages.findIndex(m => m.id === message.id);
      const previousMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
      const userQuery = previousMessage?.role === 'user' ? previousMessage.content : undefined;

      const result = await bedrockAIService.saveFeedback({
        messageId: message.id,
        conversationId: currentConversationId || 'unknown',
        userId: userId,
        rating: rating,
        feedbackText: text,
        feedbackCategory: category as any,
        responseContent: message.content,
        userQuery: userQuery,
        functionCalls: message.function_calls,
        searchResultsCount: message.search_results?.length || 0,
        orderItemsCount: message.order_items?.length || 0,
        metadata: {
          hasSearchResults: !!message.search_results,
          hasOrderItems: !!message.order_items,
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        console.log('[AIChatInterface] Feedback saved successfully:', result.feedbackId);
      } else {
        console.error('[AIChatInterface] Failed to save feedback:', result.error);
      }
    } catch (error) {
      console.error('[AIChatInterface] Error saving feedback:', error);
    }
  };

  // Submit detailed feedback from modal
  const submitDetailedFeedback = async () => {
    if (!feedbackMessage || !feedbackRating) return;

    await saveFeedbackToDatabase(
      feedbackMessage,
      feedbackRating,
      feedbackCategory || undefined,
      feedbackText || undefined
    );

    // Close modal and reset
    setFeedbackModalVisible(false);
    setFeedbackMessage(null);
    setFeedbackRating(null);
    setFeedbackText('');
    setFeedbackCategory(null);
  };

  // Cancel feedback modal
  const cancelFeedback = () => {
    // Remove the negative feedback from state since user cancelled
    if (feedbackMessage) {
      setMessageFeedback(prev => {
        const newState = { ...prev };
        delete newState[feedbackMessage.id];
        return newState;
      });
    }
    setFeedbackModalVisible(false);
    setFeedbackMessage(null);
    setFeedbackRating(null);
    setFeedbackText('');
    setFeedbackCategory(null);
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';

    return (
      <View key={message.id} style={styles.messageWrapper}>
        {/* Message Row */}
        <View style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer
        ]}>
          {/* AI Avatar for assistant messages */}
          {!isUser && (
            <View style={styles.messageAvatarContainer}>
              <LinearGradient
                colors={[COLORS.orange, COLORS.lightOrange]}
                style={styles.messageAvatar}
              >
                <MaterialCommunityIcons name="robot" size={16} color={COLORS.white} />
              </LinearGradient>
            </View>
          )}

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
                    <View style={styles.functionChipContainer}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                      <Text style={styles.functionChipText}>{call.name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Feedback Buttons for AI Messages */}
            {!isUser && (
              <View style={styles.feedbackContainer}>
                <TouchableOpacity
                  style={[
                    styles.feedbackButton,
                    messageFeedback[message.id] === 'positive' && styles.feedbackButtonActive
                  ]}
                  onPress={() => handleQuickFeedback(message, 'positive')}
                >
                  <Ionicons
                    name={messageFeedback[message.id] === 'positive' ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={14}
                    color={messageFeedback[message.id] === 'positive' ? COLORS.success : COLORS.grey}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.feedbackButton,
                    messageFeedback[message.id] === 'negative' && styles.feedbackButtonActiveNegative
                  ]}
                  onPress={() => handleQuickFeedback(message, 'negative')}
                >
                  <Ionicons
                    name={messageFeedback[message.id] === 'negative' ? 'thumbs-down' : 'thumbs-down-outline'}
                    size={14}
                    color={messageFeedback[message.id] === 'negative' ? COLORS.danger : COLORS.grey}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* User Avatar for user messages */}
          {isUser && (
            <View style={styles.messageAvatarContainer}>
              <View style={styles.userAvatar}>
                <Ionicons name="person" size={16} color={COLORS.white} />
              </View>
            </View>
          )}
        </View>

        {/* Product Search Results Card - Full Width Below Message */}
        {!isUser && message.search_results && message.search_results.length > 0 && !message.order_items && (
          <View style={styles.orderReviewContainer}>
            <ProductSearchResultsCard
              products={message.search_results}
              searchQuery={message.search_query}
              onSelectProduct={handleProductSelect}
              onPlaceOrder={handlePlaceOrderFromSearch}
              onViewMore={() => {
                if (message.search_query) {
                  sendMessage(`Show more ${message.search_query} options`);
                }
              }}
              isLoading={isLoading}
            />
          </View>
        )}

        {/* Order Review Card - Full Width Below Message */}
        {!isUser && message.order_items && message.order_items.length > 0 && (
          <View style={styles.orderReviewContainer}>
            <OrderReviewCard
              items={message.order_items}
              unavailableItems={message.unavailable_items}
              onConfirmOrder={handleConfirmOrder}
              onCancel={() => {
                const cancelMessage: Message = {
                  id: `user_${Date.now()}`,
                  role: 'user',
                  content: 'Cancel this order',
                  timestamp: new Date()
                };
                setMessages(prev => [...prev, cancelMessage]);
              }}
              isLoading={isLoading}
            />
          </View>
        )}
      </View>
    );
  };

  // Handle order confirmation from OrderReviewCard
  const handleConfirmOrder = async (items: OrderItem[]) => {
    if (items.length === 0) return;

    setIsLoading(true);
    try {
      // Format items for place_order
      const orderItems = items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      // Create a confirmation message
      const confirmMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: `Confirm order with ${items.length} items (Total: ₹${items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2)})`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMessage]);

      // Send to AI to place the order
      const aiService = await import('../../services/aiAgent/reactNativeAIService');
      const response = await aiService.reactNativeAIService.sendMessage(
        [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          {
            role: 'user' as const,
            content: `Place order with these items: ${JSON.stringify(orderItems)}. Call the place_order function with the items array.`
          }
        ],
        userId,
        conversationId
      );

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        function_calls: response.function_calls,
        suggestions: response.suggestions
      };
      setMessages(prev => [...prev, aiMessage]);
      setSuggestions(response.suggestions || []);
    } catch (error: any) {
      console.error('Order confirmation error:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle product selection from search results
  const handleProductSelect = async (product: ProductSearchResult, quantity: number) => {
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: `Add ${quantity} ${product.name} to cart`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { reactNativeAIService } = await import('../../services/aiAgent/reactNativeAIService');

      const response = await reactNativeAIService.sendMessage(
        [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          {
            role: 'user' as const,
            content: `Add ${quantity} pieces of ${product.name} (product_id: ${product.product_id}) at ₹${product.price} each to my cart. The seller is ${product.seller_name || 'the nearest seller'}.`
          }
        ],
        userId,
        currentConversationId
      );

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        function_calls: response.function_calls,
        suggestions: response.suggestions
      };
      setMessages(prev => [...prev, aiMessage]);
      setSuggestions(response.suggestions || []);
    } catch (error: any) {
      console.error('Add to cart error:', error);
      Alert.alert('Error', 'Failed to add product to cart. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle place order from search results
  const handlePlaceOrderFromSearch = async (items: Array<{ product: ProductSearchResult; quantity: number }>) => {
    if (items.length === 0) return;

    setIsLoading(true);
    try {
      // Format items for place_order
      const orderItems = items.map(item => ({
        product_id: item.product.product_id,
        quantity: item.quantity,
        unit_price: item.product.price
      }));

      // Create a confirmation message
      const confirmMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: `Place order with ${items.length} items (Total: ₹${items.reduce((sum, item) => sum + item.quantity * item.product.price, 0).toFixed(2)})`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMessage]);

      // Send to AI to place the order
      const aiService = await import('../../services/aiAgent/reactNativeAIService');
      const response = await aiService.reactNativeAIService.sendMessage(
        [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          {
            role: 'user' as const,
            content: `Place order with these items: ${JSON.stringify(orderItems)}. Call the place_order function with the items array.`
          }
        ],
        userId,
        currentConversationId
      );

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        function_calls: response.function_calls,
        suggestions: response.suggestions
      };
      setMessages(prev => [...prev, aiMessage]);
      setSuggestions(response.suggestions || []);
    } catch (error: any) {
      console.error('Place order error:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCompactView = () => (
    <View style={[styles.compactContainer, style]}>
      <TouchableOpacity
        style={styles.compactButton}
        onPress={openFullChat}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[COLORS.orange, COLORS.lightOrange]}
          style={styles.compactButtonGradient}
        >
          <MaterialCommunityIcons name="robot-happy" size={20} color={COLORS.white} />
        </LinearGradient>
        <Text style={styles.compactButtonText}>{t('chatWithDai')}</Text>
        {messages.length > 0 && (
          <View style={styles.messageCount}>
            <Text style={styles.messageCountText}>{messages.length}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={COLORS.grey} />
      </TouchableOpacity>
    </View>
  );

  const renderFullInterface = () => (
    <View style={[styles.container, style]}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[COLORS.darkBlueGrey, '#2C3E50']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          {/* Back Button */}
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
          )}
          <View style={styles.aiAvatarContainer}>
            <MaterialCommunityIcons name="robot-happy" size={24} color={COLORS.white} />
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{t('daiAiAssistant')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{t('yourAiAssistant')}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {/* The Azure Voice Live entry point was removed with the Azure migration.
              Real-time bidirectional voice needs a streaming backend, which an edge
              function cannot host; the conversational voice button below uses the
              device-native speech path and covers the same user intent. */}
          {/* Conversational Voice Button - Opens full voice conversation */}
          <TouchableOpacity
            onPress={() => setShowVoiceConversation(true)}
            style={styles.historyButton}
          >
            <MaterialCommunityIcons name="headset" size={20} color={COLORS.white} />
          </TouchableOpacity>
          {/* Chat History Button */}
          <TouchableOpacity
            onPress={() => {
              loadUserConversations();
              setShowHistoryModal(true);
            }}
            style={styles.historyButton}
          >
            <Ionicons name="time-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          {/* New Chat Button */}
          <TouchableOpacity onPress={startNewConversation} style={styles.newChatButton}>
            <Ionicons name="add-circle" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading Conversation History Indicator */}
        {isLoadingHistory ? (
          <View style={styles.loadingHistoryContainer}>
            <LinearGradient
              colors={[COLORS.orange, COLORS.lightOrange]}
              style={styles.loadingHistoryGradient}
            >
              <ActivityIndicator size="large" color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.loadingHistoryText}>{t('loadingConversation')}</Text>
            <Text style={styles.loadingHistorySubtext}>{t('restoringChatHistory')}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            {/* AI Avatar Circle */}
            <View style={styles.welcomeAvatarContainer}>
              <LinearGradient
                colors={[COLORS.orange, COLORS.lightOrange]}
                style={styles.welcomeAvatarGradient}
              >
                <MaterialCommunityIcons name="robot-happy-outline" size={56} color={COLORS.white} />
              </LinearGradient>
            </View>

            <Text style={styles.welcomeTitle}>{t('helloImDai')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('yourIntelligentAssistant')}</Text>
            <Text style={styles.welcomeText}>
              {t('daiDescription')}
            </Text>

            {/* Quick Actions */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsTitle}>{t('tryAskingMe')}</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => sendMessage(t('showMePopularProducts'))}>
                  <Ionicons name="trending-up" size={20} color={COLORS.orange} />
                  <Text style={styles.quickActionText}>{t('popularProducts')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => sendMessage(t('findNearbySellers'))}>
                  <Ionicons name="location" size={20} color={COLORS.orange} />
                  <Text style={styles.quickActionText}>{t('nearbySellers')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => sendMessage(t('showMyCart'))}>
                  <Ionicons name="cart" size={20} color={COLORS.orange} />
                  <Text style={styles.quickActionText}>{t('viewCart')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => sendMessage(t('trackMyOrders'))}>
                  <Ionicons name="receipt" size={20} color={COLORS.orange} />
                  <Text style={styles.quickActionText}>{t('orderHistory')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          messages.map(renderMessage)
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDots}>
              <View style={[styles.loadingDot, { backgroundColor: COLORS.orange }]} />
              <View style={[styles.loadingDot, { backgroundColor: COLORS.lightOrange, marginHorizontal: 4 }]} />
              <View style={[styles.loadingDot, { backgroundColor: COLORS.orange }]} />
            </View>
            <Text style={styles.loadingText}>{t('daiIsThinking')}</Text>
          </View>
        )}

        {/* Speaking Indicator */}
        {isSpeaking && (
          <TouchableOpacity
            style={styles.speakingContainer}
            onPress={() => {
              voiceService.stopSpeaking();
              setIsSpeaking(false);
            }}
          >
            <View style={styles.speakingDots}>
              <Ionicons name="volume-high" size={20} color={COLORS.orange} />
            </View>
            <Text style={styles.speakingText}>Dai is speaking... Tap to stop</Text>
          </TouchableOpacity>
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

      {/* Image Preview */}
      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
          <TouchableOpacity style={styles.removeImageButton} onPress={removeSelectedImage}>
            <Ionicons name="close-circle" size={24} color="#ff4444" />
          </TouchableOpacity>
          <Text style={styles.imagePreviewText}>📷 {t('imageAttached')}</Text>
        </View>
      )}

      {/* Processing Image Indicator */}
      {isProcessingImage && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="small" color={COLORS.orange} />
          <Text style={styles.processingText}>{t('processingImage')}</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        {/* Image Picker Button */}
        <TouchableOpacity
          style={styles.imagePickerButton}
          onPress={showImagePicker}
          disabled={isLoading}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="camera" size={22} color={isLoading ? COLORS.grey : COLORS.orange} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          key="chat-input"
          style={styles.textInput}
          value={inputText}
          onChangeText={(text) => setInputText(text)}
          placeholder={selectedImage ? "Add a note about this image..." : (placeholder || t('askDaiAnything'))}
          placeholderTextColor={COLORS.grey}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
          editable={true}
          autoCapitalize="sentences"
          returnKeyType="send"
        />

        <View style={styles.inputActions}>
          {showVoiceButton && (
            <EnhancedVoiceSearch
              compact={true}
              onSearchResult={(query, detectedLanguage, intent, entities) => {
                // Set the recognized text as input and send message
                setInputText(query);
                sendMessage(query);
              }}
              onOrderResult={(productName, quantity, detectedLanguage) => {
                // Handle voice order in AI chat
                const orderMessage = `I want to order ${quantity || 1} ${productName}`;
                setInputText(orderMessage);
                sendMessage(orderMessage);
              }}
              style={styles.voiceButton}
            />
          )}

          <TouchableOpacity
            style={[
              styles.sendButton,
              ((!inputText.trim() && !selectedImage) || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage()}
            disabled={(!inputText.trim() && !selectedImage) || isLoading}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="send"
              size={20}
              color={((!inputText.trim() && !selectedImage) || isLoading) ? COLORS.grey : COLORS.white}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Android Action Sheet Modal */}
      {Platform.OS === 'android' && (
        <Modal
          visible={showImageActionSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowImageActionSheet(false)}
        >
          <TouchableOpacity
            style={styles.actionSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowImageActionSheet(false)}
          >
            <View style={styles.actionSheetContainer}>
              <Text style={styles.actionSheetTitle}>{t('selectImage')}</Text>

              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={takePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="camera" size={24} color={COLORS.orange} />
                <Text style={styles.actionSheetButtonText}>{t('takePhoto')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSheetButton}
                onPress={pickImage}
                activeOpacity={0.7}
              >
                <Ionicons name="images" size={24} color={COLORS.orange} />
                <Text style={styles.actionSheetButtonText}>{t('chooseFromGallery')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionSheetButton, styles.actionSheetCancelButton]}
                onPress={() => setShowImageActionSheet(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionSheetCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Feedback Modal */}
      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelFeedback}
      >
        <TouchableOpacity
          style={styles.feedbackModalOverlay}
          activeOpacity={1}
          onPress={cancelFeedback}
        >
          <View style={styles.feedbackModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.feedbackModalHeader}>
              <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.orange} />
              <Text style={styles.feedbackModalTitle}>Help us improve</Text>
              <TouchableOpacity onPress={cancelFeedback} style={styles.feedbackModalClose}>
                <Ionicons name="close" size={24} color={COLORS.grey} />
              </TouchableOpacity>
            </View>

            <Text style={styles.feedbackModalSubtitle}>
              What was wrong with this response?
            </Text>

            {/* Category Selection */}
            <View style={styles.feedbackCategoryContainer}>
              {[
                { id: 'wrong_product', label: 'Wrong product', icon: 'cube-outline' },
                { id: 'irrelevant', label: 'Irrelevant', icon: 'help-circle-outline' },
                { id: 'slow', label: 'Too slow', icon: 'time-outline' },
                { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.feedbackCategoryButton,
                    feedbackCategory === cat.id && styles.feedbackCategoryButtonActive
                  ]}
                  onPress={() => setFeedbackCategory(cat.id)}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={18}
                    color={feedbackCategory === cat.id ? COLORS.white : COLORS.grey}
                  />
                  <Text style={[
                    styles.feedbackCategoryText,
                    feedbackCategory === cat.id && styles.feedbackCategoryTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional Text Input */}
            <TextInput
              style={styles.feedbackTextInput}
              placeholder="Tell us more (optional)..."
              placeholderTextColor={COLORS.grey}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              maxLength={500}
            />

            {/* Action Buttons */}
            <View style={styles.feedbackModalActions}>
              <TouchableOpacity
                style={styles.feedbackCancelButton}
                onPress={cancelFeedback}
              >
                <Text style={styles.feedbackCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackSubmitButton}
                onPress={submitDetailedFeedback}
              >
                <Text style={styles.feedbackSubmitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Chat History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.historyModalOverlay}
          onPress={() => setShowHistoryModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.historyModalContent}>
            <View style={styles.historyModalHeader}>
              <Ionicons name="time" size={24} color={COLORS.orange} />
              <Text style={styles.historyModalTitle}>Chat History</Text>
              <TouchableOpacity
                onPress={() => setShowHistoryModal(false)}
                style={styles.historyModalClose}
              >
                <Ionicons name="close" size={24} color={COLORS.grey} />
              </TouchableOpacity>
            </View>

            {/* New Conversation Button */}
            <TouchableOpacity
              style={styles.newConversationButton}
              onPress={handleNewConversation}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.white} />
              <Text style={styles.newConversationButtonText}>Start New Conversation</Text>
            </TouchableOpacity>

            {/* Conversation List */}
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {isLoadingConversations ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator size="large" color={COLORS.orange} />
                  <Text style={styles.historyLoadingText}>Loading conversations...</Text>
                </View>
              ) : conversationList.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <MaterialCommunityIcons name="chat-outline" size={48} color={COLORS.lightGrey} />
                  <Text style={styles.historyEmptyText}>No past conversations</Text>
                  <Text style={styles.historyEmptySubtext}>Your chat history will appear here</Text>
                </View>
              ) : (
                conversationList.map((conv) => (
                  <TouchableOpacity
                    key={conv.id}
                    style={styles.historyItem}
                    onPress={() => handleSelectConversation(conv.thread_id)}
                  >
                    <View style={styles.historyItemIcon}>
                      <MaterialCommunityIcons name="message-text" size={24} color={COLORS.orange} />
                    </View>
                    <View style={styles.historyItemContent}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>
                        {conv.title}
                      </Text>
                      {conv.last_message && (
                        <Text style={styles.historyItemPreview} numberOfLines={1}>
                          {conv.last_message}
                        </Text>
                      )}
                      <View style={styles.historyItemMeta}>
                        <Text style={styles.historyItemDate}>
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.historyItemMessageCount}>
                          {conv.message_count} messages
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.lightGrey} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Voice Conversation Interface - Full conversational voice ordering */}
      <VoiceConversationInterface
        userId={userId}
        visible={showVoiceConversation}
        onClose={() => setShowVoiceConversation(false)}
        onOrderComplete={(orderId: string, items: any[]) => {
          console.log('[AIChatInterface] Voice order complete:', orderId, items);
          // Optionally add a message about the completed order
          const completedMessage: Message = {
            id: `ai_voice_order_${Date.now()}`,
            role: 'assistant',
            content: `Your voice order #${orderId} has been placed successfully!`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, completedMessage]);
        }}
        language={currentLanguage}
      />

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

  // Non-compact mode - return full interface directly
  // Note: Parent component should wrap with KeyboardAvoidingView if needed
  return renderFullInterface();
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
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
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    elevation: 3,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  compactButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.darkBlueGrey,
    fontWeight: '600',
    flex: 1,
  },
  messageCount: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageCountText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  aiAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  newChatButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  loadingHistoryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  loadingHistoryGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkBlueGrey,
    marginBottom: 4,
  },
  loadingHistorySubtext: {
    fontSize: 14,
    color: COLORS.grey,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  welcomeAvatarContainer: {
    marginBottom: 20,
  },
  welcomeAvatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.darkBlueGrey,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: COLORS.orange,
    fontWeight: '500',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 15,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  quickActionsContainer: {
    width: '100%',
    marginTop: 28,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.grey,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  quickActionCard: {
    width: (width - 80) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.darkBlueGrey,
    marginTop: 8,
    textAlign: 'center',
  },
  messageWrapper: {
    marginBottom: 8,
  },
  orderReviewContainer: {
    marginLeft: 36,  // Align with message bubble (avatar width + margin)
    marginRight: 16,
    marginTop: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatarContainer: {
    marginHorizontal: 8,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.darkBlueGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: width * 0.70,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: COLORS.darkBlueGrey,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.white,
  },
  aiText: {
    color: COLORS.darkBlueGrey,
  },
  functionCallsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGrey,
  },
  functionCallItem: {
    marginBottom: 6,
  },
  functionChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  functionChipText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
    marginLeft: 4,
  },
  functionResultText: {
    fontSize: 13,
    color: COLORS.grey,
    marginTop: 6,
    padding: 10,
    backgroundColor: COLORS.offWhite,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
  },
  // Feedback Styles
  feedbackContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGrey,
    gap: 8,
  },
  feedbackButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: COLORS.offWhite,
  },
  feedbackButtonActive: {
    backgroundColor: '#E8F5E9',
  },
  feedbackButtonActiveNegative: {
    backgroundColor: '#FFEBEE',
  },
  // Feedback Modal Styles
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  feedbackModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkBlueGrey,
    marginLeft: 10,
    flex: 1,
  },
  feedbackModalClose: {
    padding: 4,
  },
  feedbackModalSubtitle: {
    fontSize: 14,
    color: COLORS.grey,
    marginBottom: 16,
  },
  feedbackCategoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  feedbackCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.offWhite,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    gap: 6,
  },
  feedbackCategoryButtonActive: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  },
  feedbackCategoryText: {
    fontSize: 13,
    color: COLORS.grey,
    fontWeight: '500',
  },
  feedbackCategoryTextActive: {
    color: COLORS.white,
  },
  feedbackTextInput: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: COLORS.darkBlueGrey,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  feedbackModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
  },
  feedbackCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.grey,
  },
  feedbackSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
  },
  feedbackSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  loadingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.grey,
    fontWeight: '500',
  },
  speakingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 125, 0, 0.1)',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.orange,
  },
  speakingDots: {
    marginRight: 8,
  },
  speakingText: {
    fontSize: 14,
    color: COLORS.orange,
    fontWeight: '500',
  },
  suggestionsContainer: {
    maxHeight: 56,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGrey,
  },
  suggestionsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  suggestionChip: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.orange,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGrey,
    minHeight: 64,
    zIndex: 100,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: COLORS.offWhite,
    color: COLORS.darkBlueGrey,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  voiceButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: COLORS.offWhite,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  voiceConversationButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: COLORS.offWhite,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.orange,
  },
  sendButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.lightGrey,
    shadowOpacity: 0,
    elevation: 0,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  // Image picker styles
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8F0',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightOrange,
  },
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    left: 68,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePreviewText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.orange,
    fontWeight: '600',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFF8F0',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightOrange,
  },
  processingText: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.orange,
    fontWeight: '600',
  },
  imagePickerButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: COLORS.offWhite,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  // Action sheet styles (Android)
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: COLORS.darkBlueGrey,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: COLORS.offWhite,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGrey,
  },
  actionSheetButtonText: {
    fontSize: 16,
    marginLeft: 16,
    color: COLORS.darkBlueGrey,
    fontWeight: '500',
  },
  actionSheetCancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    marginTop: 8,
    justifyContent: 'center',
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Header Right Section
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  historyButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Chat History Modal Styles
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  historyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkBlueGrey,
    marginLeft: 10,
    flex: 1,
  },
  historyModalClose: {
    padding: 4,
  },
  newConversationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  newConversationButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 400,
  },
  historyLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.grey,
  },
  historyEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.grey,
    marginTop: 12,
  },
  historyEmptySubtext: {
    fontSize: 14,
    color: COLORS.lightGrey,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGrey,
  },
  historyItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkBlueGrey,
  },
  historyItemPreview: {
    fontSize: 13,
    color: COLORS.grey,
    marginTop: 2,
  },
  historyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  historyItemDate: {
    fontSize: 12,
    color: COLORS.lightGrey,
  },
  historyItemMessageCount: {
    fontSize: 12,
    color: COLORS.orange,
    fontWeight: '500',
  },
});

export default AIChatInterface;
