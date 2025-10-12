import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Linking, Platform, Image, ScrollView, Pressable, TouchableOpacity, Alert, ActivityIndicator, Animated, TextInput, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { Text, Card, Button, IconButton, List, Divider, Surface, FAB } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useLocalSearchParams } from 'expo-router';
import AIChatInterface from '../../../components/ai/AIChatInterface';

import { translationService } from '../../../services/translationService';

import { getCurrentUser } from '../../../services/auth/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Phone numbers for order placement
const OFFICE_PHONE = '+918089668552'; // Replace with your actual office phone number
const SUPPORT_PHONE = '+918089668552'; // Replace with your actual support phone number

// Interfaces
interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface OrderSession {
  id: string;
  items: CartItem[];
  total: number;
  timestamp: Date;
}

export default function PhoneOrder() {
  let router;
  
  try {
    router = useRouter();
  } catch (error) {
    console.error('[PhoneOrder] Error initializing router:', error);
    router = null;
  }
  
  // Language hook with error handling
  const { currentLanguage } = useLanguage();
  
  // Original English text (never changes)
  const originalTexts = {
    orderByCall: 'Order by Call',
    quickAndConvenient: 'Quick and Convenient',
    placeYourOrderNow: 'Place Your Order Now',
    ourRepresentativesAvailable: 'Our representatives are available to help you place orders quickly and efficiently.',
    callNow: 'Call Now',
    whatsApp: 'WhatsApp',
    availableMonSat9to6: 'Available Mon-Sat 9 AM to 6 PM',
    howToPlaceOrderByPhone: 'How to Place Order by Phone',
    callOurOrderDesk: 'Call Our Order Desk',
    dialOurNumberDuringHours: 'Dial our number during business hours and speak with our friendly staff.',
    provideYourDetails: 'Provide Your Details',
    shareNameBusinessAddress: 'Share your name, business address, and contact information.',
    specifyProducts: 'Specify Products',
    tellUsProductsQuantities: 'Tell us the products you need and their quantities.',
    confirmOrder: 'Confirm Order',
    reviewOrderConfirmPayment: 'Review your order details and confirm payment method.',
    needAssistance: 'Need Assistance?',
    customerSupportReady: 'Our customer support team is ready to help with any questions.',
    callCustomerSupport: 'Call Customer Support'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);
  
  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        console.log('[PhoneOrder] Loading translations for language:', currentLanguage);
        
        // Add safety check for currentLanguage
        if (!currentLanguage) {
          console.log('[PhoneOrder] currentLanguage is undefined, using original texts');
          setTranslations(originalTexts);
          return;
        }
        
        if (currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like other screens)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`[PhoneOrder] Translating "${key}": "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`[PhoneOrder] Translation result for "${key}":`, translated);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('[PhoneOrder] All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('[PhoneOrder] Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Translation function
  const t = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };
  const insets = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { aiMode } = useLocalSearchParams();

  // Add validation to prevent ReferenceError
  if (!router || typeof router !== 'object') {
    console.error('[PhoneOrder] Router is not available or invalid');
    return null;
  }
  
  // Additional safety check for router methods
  const safeRouter = {
    push: router.push?.bind(router) || (() => console.warn('[PhoneOrder] router.push not available')),
    replace: router.replace?.bind(router) || (() => console.warn('[PhoneOrder] router.replace not available')),
    back: router.back?.bind(router) || (() => console.warn('[PhoneOrder] router.back not available')),
    canGoBack: router.canGoBack?.bind(router) || (() => false)
  };
  
  // Interface state
  const [isAIMode, setIsAIMode] = useState(false);
  const [cart, setCart] = useState<OrderSession>({ id: '', items: [], total: 0, timestamp: new Date() });
  const [userId, setUserId] = useState<string>('');

  // Get user ID on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        // Try to get current user from Supabase
        const user = await getCurrentUser();
        if (user?.id) {
          setUserId(user.id);
          return;
        }

        // Fallback: try to get from AsyncStorage
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          return;
        }

        // Generate a temporary user ID for testing
        const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setUserId(tempUserId);
        console.log('Generated temporary user ID:', tempUserId);
      } catch (error) {
        console.error('Error getting user ID:', error);
        // Generate a temporary user ID as fallback
        const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setUserId(tempUserId);
      }
    };

    getUserId();
  }, []);

  // Direct text strings instead of translations
  const getTranslatedText = (text: string) => {
    const texts: Record<string, string> = {
      'AI Agent \'Dai\'': 'AI Agent \'Dai\'',
      'Clear Cart': 'Clear Cart',
      'Are you sure you want to clear your cart?': 'Are you sure you want to clear your cart?',
      'Cancel': 'Cancel',
      'Clear': 'Clear',
      'Error': 'Error',
      'Failed to process your message. Please try again.': 'Failed to process your message. Please try again.',
      'AI Agent Not Ready': 'AI Agent Not Ready',
      'Please wait for the AI agent to initialize.': 'Please wait for the AI agent to initialize.',
      'I would like to order some vegetables': 'I would like to order some vegetables',
      'Hi! I\'m Dai, your AI ordering assistant. How can I help you place an order today?': 'Hi! I\'m Dai, your AI ordering assistant. How can I help you place an order today?',
      'Listening...': 'Listening...',
      'Tap to speak': 'Tap to speak',
      'Type your message...': 'Type your message...',
      'Initializing AI Agent...': 'Initializing AI Agent...',
      'Speaking...': 'Speaking...',
      'Processing...': 'Processing...',
      'Your Order': 'Your Order',
      'Total:': 'Total:',
      'Meet Dai - Your AI Assistant': 'Meet Dai - Your AI Assistant',
      'Chat with our AI agent to place orders using voice or text. Get instant product recommendations and seamless ordering experience.': 'Chat with our AI agent to place orders using voice or text. Get instant product recommendations and seamless ordering experience.',
      'Chat with Dai': 'Chat with Dai'
    };
    return texts[text] || text;
  };



  const clearCart = () => {
    setCart({ id: '', items: [], total: 0, timestamp: new Date() });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  // Phone order handlers
  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = (phoneNumber: string) => {
    const whatsappNumber = phoneNumber.replace('+', '');
    Linking.openURL(`https://wa.me/${whatsappNumber}?text=I%20want%20to%20place%20an%20order`);
  };

  // Render AI mode interface
  const renderAIInterface = () => {
    if (!userId) {
      return (
        <View style={styles.aiContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Initializing AI Assistant...</Text>
          </View>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView 
        style={styles.aiContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {/* AI Chat Interface */}
        <AIChatInterface
          userId={userId}
          conversationId={`phone-order-${Date.now()}`}
          onNewConversation={(conversationId) => {
            console.log('New conversation started:', conversationId);
          }}
          onMessageSent={(message) => {
            console.log('Message sent:', message);
          }}
          style={{ flex: 1 }}
          placeholder="Type your order here..."
          showVoiceButton={true}
          compact={false}
        />
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={[styles.mainSafeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.safeAreaContainer}>
      <SystemStatusBar style="dark" />
      
      {/* Custom header */}
      <View style={styles.header}>
        <Link href="/(main)/home" asChild>
          <TouchableOpacity style={styles.backButton}>
            <IconButton icon="arrow-left" size={24} />
          </TouchableOpacity>
        </Link>
        <Text style={styles.headerTitle}>
          {isAIMode ? getTranslatedText('AI Agent \'Dai\'') : t('orderByCall')}
        </Text>
        <View style={styles.headerActions}>
          {isAIMode && cart.items.length > 0 && (
            <TouchableOpacity onPress={clearCart} style={styles.clearButton}>
              <IconButton icon="delete" size={20} iconColor="#FF5722" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => setIsAIMode(!isAIMode)} 
            style={[styles.aiToggle, isAIMode && styles.aiToggleActive]}
          >
            <IconButton 
              icon={isAIMode ? "phone" : "chat"} 
              size={20} 
              iconColor={isAIMode ? "white" : "#667eea"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {isAIMode ? (
        renderAIInterface()
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          bounces={false}
          showsVerticalScrollIndicator={true}
        >
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <Image 
              source={require('../../../assets/images/call-center.png')} 
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerOverlay}>
              <Text variant="headlineMedium" style={styles.bannerTitle}>
                {t('orderByCall')}
              </Text>
              <Text variant="bodyLarge" style={styles.bannerSubtitle}>
                {t('quickAndConvenient')}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* Call Button Card */}
            <Surface style={styles.callNowCard}>
              <Text variant="titleLarge" style={styles.callNowTitle}>
                {t('placeYourOrderNow')}
              </Text>
              <Text variant="bodyMedium" style={styles.callNowDescription}>
                {t('ourRepresentativesAvailable')}
              </Text>
              <View style={styles.callButtonsRow}>
                <Button 
                  mode="contained" 
                  icon="phone"
                  onPress={() => handleCall(OFFICE_PHONE)}
                  style={styles.callNowButton}
                  contentStyle={styles.callNowButtonContent}
                  labelStyle={styles.callNowButtonLabel}
                >
                  {t('callNow')}
                </Button>
                <Button 
                  mode="contained" 
                  icon="whatsapp"
                  onPress={() => handleWhatsApp(OFFICE_PHONE)}
                  style={[styles.callNowButton, styles.whatsappButton]}
                  contentStyle={styles.callNowButtonContent}
                  labelStyle={styles.callNowButtonLabel}
                >
                  {t('whatsApp')}
                </Button>
              </View>
              <Text variant="bodySmall" style={styles.callHours}>
                {t('availableMonSat9to6')}
              </Text>
            </Surface>

            <Card style={styles.instructionCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.instructionTitle}>
                  {t('howToPlaceOrderByPhone')}
                </Text>
                <List.Item
                  title={t('callOurOrderDesk')}
                  description={t('dialOurNumberDuringHours')}
                  left={props => <List.Icon {...props} icon="phone" color="#4CAF50" />}
                  style={styles.listItem}
                />
                <Divider style={styles.divider} />
                <List.Item
                  title={t('provideYourDetails')}
                  description={t('shareNameBusinessAddress')}
                  left={props => <List.Icon {...props} icon="account" color="#2196F3" />}
                  style={styles.listItem}
                />
                <Divider style={styles.divider} />
                <List.Item
                  title={t('specifyProducts')}
                  description={t('tellUsProductsQuantities')}
                  left={props => <List.Icon {...props} icon="cart" color="#FF9800" />}
                  style={styles.listItem}
                />
                <Divider style={styles.divider} />
                <List.Item
                  title={t('confirmOrder')}
                  description={t('reviewOrderConfirmPayment')}
                  left={props => <List.Icon {...props} icon="check-circle" color="#FF7D00" />}
                  style={styles.listItem}
                />
              </Card.Content>
            </Card>

            {/* AI Agent Card */}
            <Card style={styles.aiAgentCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.aiAgentTitle}>
                  {getTranslatedText('Meet Dai - Your AI Assistant')}
                </Text>
                <Text variant="bodyMedium" style={styles.aiAgentText}>
                  {getTranslatedText('Chat with our AI agent to place orders using voice or text. Get instant product recommendations and seamless ordering experience.')}
                </Text>
                <Button
                  mode="contained"
                  icon="chat"
                  onPress={() => setIsAIMode(true)}
                  style={styles.aiAgentButton}
                  contentStyle={styles.aiAgentButtonContent}
                  labelStyle={styles.aiAgentButtonLabel}
                >
                  {getTranslatedText('Chat with Dai')}
                </Button>
              </Card.Content>
            </Card>

            <Card style={styles.supportCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.supportTitle}>
                  {t('needAssistance')}
                </Text>
                <Text variant="bodyMedium" style={styles.supportText}>
                  {t('customerSupportReady')}
                </Text>
                <Button
                  mode="contained"
                  icon="headphones"
                  onPress={() => handleCall(SUPPORT_PHONE)}
                  style={styles.supportButton}
                >
                  {t('callCustomerSupport')}
                </Button>
              </Card.Content>
            </Card>
            
            {/* Extra padding view to ensure content is scrollable past the bottom nav */}
            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainSafeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerBanner: {
    height: 180,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    fontSize: 28,
  },
  bannerSubtitle: {
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  content: {
    padding: 16,
  },
  callNowCard: {
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: -30,
  },
  callNowTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  callNowDescription: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#555',
  },
  callButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  callNowButton: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#4CAF50',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  callNowButtonContent: {
    paddingVertical: 8,
  },
  callNowButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  callHours: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  instructionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  instructionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  listItem: {
    paddingVertical: 4,
  },
  divider: {
    marginVertical: 2,
  },
  aiAgentCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#f8f9ff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  aiAgentTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  aiAgentText: {
    marginBottom: 16,
    color: '#666',
    lineHeight: 20,
  },
  aiAgentButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  aiAgentButtonContent: {
    paddingVertical: 4,
  },
  aiAgentButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#EBF5FB',
  },
  supportTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  supportText: {
    marginBottom: 12,
    color: '#555',
  },
  supportButton: {
    marginTop: 8,
    backgroundColor: '#2196F3',
  },
  bottomSpacer: {
    height: 120, // Increased height to ensure content is fully visible
  },
  // AI Interface Styles
  aiContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  aiKeyboardContainer: {
    flex: 1,
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conversationContent: {
    paddingTop: 8,
    paddingBottom: 140, // Adequate padding for input area
    flexGrow: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 50,
  },
  welcomeText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    lineHeight: 24,
  },
  initializingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  initializingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  conversationItem: {
    marginBottom: 12,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  agentMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  transcriptBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: 'white',
  },
  agentText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  transcriptLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
    fontStyle: 'italic',
    marginTop: 4,
  },
  processingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  cartCard: {
    margin: 16,
    elevation: 2,
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cartItemDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  cartDivider: {
    marginVertical: 8,
  },
  cartTotal: {
    alignItems: 'flex-end',
  },
  cartTotalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  voiceInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  micButton: {
    marginBottom: 8,
  },
  micButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  micButtonActive: {
    backgroundColor: '#FF5722',
  },
  micLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleButton: {
    marginLeft: 12,
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 4,
  },
  aiToggle: {
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  aiToggleActive: {
    backgroundColor: '#667eea',
  },
});