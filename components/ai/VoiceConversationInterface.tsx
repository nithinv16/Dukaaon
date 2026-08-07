/**
 * Voice Conversation Interface
 * 
 * A ChatGPT-like voice conversation interface for ordering products.
 * Users can speak naturally, AI responds with voice, and the conversation
 * continues until the order is placed.
 * 
 * Example flow:
 * User: "I want to order rice"
 * AI: "Sure! What type of rice would you like? We have Basmati, Sona Masoori, and Ponni rice."
 * User: "5kg of nirmal rice, 10 pieces"
 * AI: "I found Nirmal atta rice. Adding 10 pieces of 5kg each to your cart. The total is ₹4,500. Should I place this order?"
 * User: "Yes, place the order"
 * AI: "Order placed successfully! Your order ID is #12345. Anything else?"
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Animated,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/theme';
import { getNativeVoiceService } from '../../services/voice/nativeVoiceService';
import { useLanguage } from '../../contexts/LanguageContext';

interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isSpeaking?: boolean;
}

interface VoiceConversationInterfaceProps {
    userId: string;
    visible: boolean;
    onClose: () => void;
    onOrderComplete?: (orderId: string, items: any[]) => void;
    language?: string;
}

type ConversationState =
    | 'idle'
    | 'listening'
    | 'processing'
    | 'speaking'
    | 'waiting_for_input'
    | 'order_complete'
    | 'error';

const VoiceConversationInterface: React.FC<VoiceConversationInterfaceProps> = ({
    userId,
    visible,
    onClose,
    onOrderComplete,
    language = 'en-US',
}) => {
    const { currentLanguage } = useLanguage();
    const [conversationState, setConversationState] = useState<ConversationState>('idle');
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [statusText, setStatusText] = useState('Tap the microphone to start');
    const [voiceService] = useState(() => getNativeVoiceService());
    const [detectedLanguage, setDetectedLanguage] = useState<string>('en');

    // Map short language codes to speech recognition codes
    const getSpeechCode = (langCode: string): string => {
        const speechCodeMap: Record<string, string> = {
            'en': 'en-US',
            'hi': 'hi-IN',
            'ml': 'ml-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'kn': 'kn-IN',
            'mr': 'mr-IN',
            'bn': 'bn-IN',
            'pa': 'pa-IN',
        };
        return speechCodeMap[langCode] || langCode;
    };

    // Simple language detection based on character patterns
    const detectLanguage = (text: string): string => {
        if (!text) return 'en';

        // Check for non-ASCII characters (regional languages)
        const hasDevanagari = /[\u0900-\u097F]/.test(text); // Hindi, Marathi
        const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
        const hasTamil = /[\u0B80-\u0BFF]/.test(text);
        const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
        const hasKannada = /[\u0C80-\u0CFF]/.test(text);
        const hasBengali = /[\u0980-\u09FF]/.test(text);
        const hasGurmukhi = /[\u0A00-\u0A7F]/.test(text); // Punjabi

        if (hasMalayalam) return 'ml';
        if (hasTamil) return 'ta';
        if (hasTelugu) return 'te';
        if (hasKannada) return 'kn';
        if (hasBengali) return 'bn';
        if (hasGurmukhi) return 'pa';
        if (hasDevanagari) return 'hi'; // Could also be Marathi

        // Default to English if no regional script detected
        return 'en';
    };

    // Get the speech recognition code for the current language
    const speechCode = getSpeechCode(currentLanguage);

    // Animation values
    const pulseAnimation = useRef(new Animated.Value(1)).current;
    const waveAnimation = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    // Conversation context for AI
    const conversationContextRef = useRef<{
        cart: any[];
        currentIntent: string | null;
        awaitingConfirmation: boolean;
    }>({
        cart: [],
        currentIntent: null,
        awaitingConfirmation: false,
    });

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollViewRef.current && messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    // Cleanup on unmount or close
    useEffect(() => {
        return () => {
            stopAllAudio();
        };
    }, []);

    // Start conversation when modal becomes visible
    useEffect(() => {
        if (visible) {
            startConversation();
        } else {
            resetConversation();
        }
    }, [visible]);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnimation, {
                    toValue: 1.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnimation, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const stopPulseAnimation = () => {
        pulseAnimation.stopAnimation();
        pulseAnimation.setValue(1);
    };

    const startWaveAnimation = () => {
        Animated.loop(
            Animated.timing(waveAnimation, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    };

    const stopWaveAnimation = () => {
        waveAnimation.stopAnimation();
        waveAnimation.setValue(0);
    };

    const stopAllAudio = async () => {
        try {
            await voiceService.stopSpeaking();
            await voiceService.cancel();
        } catch (error) {
            console.error('[VoiceConversation] Error stopping audio:', error);
        }
        setIsListening(false);
        setIsSpeaking(false);
        stopPulseAnimation();
        stopWaveAnimation();
    };

    const resetConversation = () => {
        setMessages([]);
        setCurrentTranscript('');
        setConversationState('idle');
        setStatusText('Tap the microphone to start');
        conversationContextRef.current = {
            cart: [],
            currentIntent: null,
            awaitingConfirmation: false,
        };
        stopAllAudio();
    };

    const startConversation = async () => {
        // Add welcome message from AI
        const welcomeMessage: ConversationMessage = {
            id: `ai_welcome_${Date.now()}`,
            role: 'assistant',
            content: "Hi! I'm Dai, your shopping assistant. How can I help you today? You can say things like 'I want to order rice' or 'Show me vegetables'.",
            timestamp: new Date(),
        };

        setMessages([welcomeMessage]);
        setConversationState('speaking');
        setStatusText('Dai is speaking...');
        setIsSpeaking(true);

        try {
            // Speak the welcome message
            await voiceService.speak(welcomeMessage.content, speechCode);
            setIsSpeaking(false);

            // Automatically start listening after welcome
            await startListening();
        } catch (error) {
            console.error('[VoiceConversation] Error speaking welcome:', error);
            setIsSpeaking(false);
            setConversationState('waiting_for_input');
            setStatusText('Tap the microphone to speak');
        }
    };

    const startListening = async () => {
        try {
            if (!voiceService.isAvailable()) {
                Alert.alert(
                    'Voice Not Available',
                    'Voice recognition requires a native build (APK). Please type your message instead.'
                );
                return;
            }

            // Stop any ongoing speech first
            if (isSpeaking) {
                await voiceService.stopSpeaking();
                setIsSpeaking(false);
            }

            setConversationState('listening');
            setIsListening(true);
            setCurrentTranscript('');
            setStatusText('Listening... speak now');
            startPulseAnimation();
            startWaveAnimation();

            console.log('[VoiceConversation] Starting to listen with language:', speechCode);

            const started = await voiceService.startListening(
                speechCode,
                // onResult callback
                (result) => {
                    console.log('[VoiceConversation] Speech result:', result.text, 'isFinal:', result.isFinal);
                    setCurrentTranscript(result.text);

                    if (result.isFinal && result.text.trim()) {
                        // Stop listening and process the result
                        setIsListening(false);
                        stopPulseAnimation();
                        stopWaveAnimation();
                        handleUserInput(result.text.trim());
                    }
                },
                // onError callback
                (error) => {
                    console.log('[VoiceConversation] Speech recognition ended:', error);
                    setIsListening(false);
                    stopPulseAnimation();
                    stopWaveAnimation();

                    // Check if this is a "no match" error (user didn't speak or speech wasn't recognized)
                    const isNoMatch = error.includes('No match') || error.includes('7/');
                    const isTimeout = error.includes('timeout') || error.includes('Timeout');

                    if (isNoMatch || isTimeout) {
                        // This is normal - user just didn't speak or wasn't recognized
                        setConversationState('waiting_for_input');
                        setStatusText("I didn't catch that. Tap the mic to try again.");
                    } else {
                        // Actual error
                        console.error('[VoiceConversation] Actual speech error:', error);
                        setConversationState('waiting_for_input');
                        setStatusText('Voice recognition issue. Tap to retry.');
                    }
                }
            );

            if (!started) {
                throw new Error('Failed to start speech recognition');
            }

            // Auto-stop after 15 seconds if no final result
            setTimeout(() => {
                if (voiceService.isCurrentlyListening()) {
                    console.log('[VoiceConversation] Auto-stopping after timeout');
                    stopListeningAndProcess();
                }
            }, 15000);

        } catch (error: any) {
            console.error('[VoiceConversation] Error starting listening:', error);
            setIsListening(false);
            stopPulseAnimation();
            stopWaveAnimation();
            setConversationState('waiting_for_input');
            setStatusText('Tap the microphone to speak');

            Alert.alert('Voice Error', error.message || 'Failed to start voice recognition');
        }
    };

    const stopListeningAndProcess = async () => {
        try {
            setStatusText('Processing...');
            const finalText = await voiceService.stopListening();
            setIsListening(false);
            stopPulseAnimation();
            stopWaveAnimation();

            if (finalText && finalText.trim()) {
                handleUserInput(finalText.trim());
            } else if (currentTranscript.trim()) {
                handleUserInput(currentTranscript.trim());
            } else {
                setConversationState('waiting_for_input');
                setStatusText('No speech detected. Tap to try again.');
            }
        } catch (error) {
            console.error('[VoiceConversation] Error stopping:', error);
            setConversationState('waiting_for_input');
            setStatusText('Tap the microphone to speak');
        }
    };

    const handleUserInput = async (text: string) => {
        // Detect language from the user's speech
        const spokenLanguage = detectLanguage(text);
        setDetectedLanguage(spokenLanguage);
        console.log('[VoiceConversation] Detected language:', spokenLanguage, 'from text:', text.substring(0, 50));

        // Add user message to conversation
        const userMessage: ConversationMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setCurrentTranscript('');
        setConversationState('processing');
        setStatusText('Dai is thinking...');

        try {
            // Get AI response with detected language
            const aiResponse = await getAIResponse(text, spokenLanguage);

            // Add AI message to conversation
            const aiMessage: ConversationMessage = {
                id: `ai_${Date.now()}`,
                role: 'assistant',
                content: aiResponse.content,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, aiMessage]);

            // Speak the AI response in the detected spoken language
            setConversationState('speaking');
            setStatusText('Dai is speaking...');
            setIsSpeaking(true);

            try {
                // Use the detected spoken language for TTS response
                const ttsSpeechCode = getSpeechCode(spokenLanguage);
                await voiceService.speak(aiResponse.content, ttsSpeechCode);
            } catch (speakError) {
                console.error('[VoiceConversation] Error speaking response:', speakError);
            }

            setIsSpeaking(false);

            // Check if order is complete
            if (aiResponse.orderComplete) {
                setConversationState('order_complete');
                setStatusText('Order placed successfully!');

                if (onOrderComplete && aiResponse.orderId) {
                    onOrderComplete(aiResponse.orderId, aiResponse.orderItems || []);
                }

                // Auto-close after showing success
                setTimeout(() => {
                    onClose();
                }, 3000);
            } else {
                // Continue the conversation - start listening again
                await startListening();
            }

        } catch (error: any) {
            console.error('[VoiceConversation] Error processing:', error);

            const errorMessage: ConversationMessage = {
                id: `ai_error_${Date.now()}`,
                role: 'assistant',
                content: "I'm sorry, I had trouble processing that. Could you please try again?",
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, errorMessage]);
            setConversationState('waiting_for_input');
            setStatusText('Tap the microphone to try again');

            // Speak the error message
            try {
                setIsSpeaking(true);
                await voiceService.speak(errorMessage.content, speechCode);
                setIsSpeaking(false);
            } catch (speakError) {
                console.error('[VoiceConversation] Error speaking error message:', speakError);
                setIsSpeaking(false);
            }
        }
    };

    const getAIResponse = async (userInput: string, spokenLanguage: string = 'en'): Promise<{
        content: string;
        orderComplete?: boolean;
        orderId?: string;
        orderItems?: any[];
        searchResults?: any[];
    }> => {
        try {
            // Import the AI service
            const { reactNativeAIService } = await import('../../services/aiAgent/reactNativeAIService');

            // Build conversation history for AI context
            const aiMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
            }));

            // Add the current user message
            aiMessages.push({
                role: 'user' as const,
                content: userInput,
                timestamp: new Date(),
            });

            // Add system context for voice conversation - more detailed for ordering
            const systemContext = `You are Dai, a helpful voice shopping assistant for Dukaaon marketplace. 
You are having a voice conversation with a customer who wants to order products.
Keep your responses concise and conversational (2-3 sentences max) since they will be spoken aloud.

IMPORTANT: When the user wants to order something:
1. First, use the search_products function to find products. Include a quantity parameter if the user mentions one.
2. When products are found, mention the top 1-2 options with their prices and seller info.
3. If the user confirms or selects a product, use the add_to_cart function with the product_id and quantity.
4. After adding to cart, ask if they want to confirm the order.
5. When the user confirms, use the place_order function.

When searching for products, ALWAYS specify the requested_quantity parameter if the user mentions a quantity.
When adding to cart, use the product_id from the search results.

Current context: Voice conversation mode - keep responses brief and natural.
IMPORTANT: Respond in the SAME language the user is speaking. The user is speaking in ${spokenLanguage === 'en' ? 'English' : spokenLanguage}.`;

            // Get AI response - use the spoken language, not the app language
            // This ensures the AI responds in the language the user is actually speaking
            const response = await reactNativeAIService.sendMessage(
                aiMessages,
                userId,
                undefined,
                spokenLanguage  // Use detected spoken language instead of app language
            );

            console.log('[VoiceConversation] AI Response:', {
                content: response.content?.substring(0, 100),
                hasSearchResults: !!(response as any).search_results?.length,
                hasOrderItems: !!(response as any).order_items?.length,
                functionCalls: response.function_calls?.map(f => f.name)
            });

            // Check if order was placed
            let orderComplete = false;
            let orderId: string | undefined;
            let orderItems: any[] = [];
            let searchResults: any[] = [];

            // Get search results and order items from response
            if ((response as any).search_results) {
                searchResults = (response as any).search_results;
                console.log('[VoiceConversation] Found', searchResults.length, 'search results');
            }

            if ((response as any).order_items) {
                orderItems = (response as any).order_items;
                console.log('[VoiceConversation] Found', orderItems.length, 'order items');
            }

            if (response.function_calls) {
                for (const call of response.function_calls) {
                    // Cast to any to access result property which may be added at runtime
                    const callWithResult = call as any;

                    if (call.name === 'place_order' && callWithResult.result?.success) {
                        orderComplete = true;
                        orderId = callWithResult.result.orderId || callWithResult.result.order_id;
                        orderItems = callWithResult.result.items || [];
                    }

                    // Log function calls for debugging
                    console.log('[VoiceConversation] Function call:', call.name,
                        callWithResult.result ? 'success' : 'no result');
                }
            }

            // Keep response concise for voice
            let content = response.content || "I'm processing your request.";

            // Truncate long responses for voice
            if (content.length > 400) {
                const sentences = content.split(/[.!?]+/).filter(s => s.trim());
                content = sentences.slice(0, 4).join('. ') + '.';
            }

            // Remove any markdown or special formatting
            content = content
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/```[\s\S]*?```/g, '')
                .replace(/\{[\s\S]*?\}/g, '')
                .replace(/\[[\s\S]*?\]/g, '')
                .replace(/\n\n+/g, ' ')
                // Remove emojis so TTS doesn't read them as words
                .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
                .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
                .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
                .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
                .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
                .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
                .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
                .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
                .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols (sun, cloud, etc.)
                .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats (✓, ✗, etc.)
                .replace(/[\u{2300}-\u{23FF}]/gu, '')   // Misc Technical
                .replace(/[\u{2B50}-\u{2B55}]/gu, '')   // Stars
                .replace(/[\u{200D}]/gu, '')            // Zero width joiner
                .replace(/[\u{FE0F}]/gu, '')            // Variation selector
                .replace(/\s+/g, ' ')                   // Collapse multiple spaces
                .trim();

            return {
                content,
                orderComplete,
                orderId,
                orderItems,
                searchResults,
            };

        } catch (error) {
            console.error('[VoiceConversation] AI service error:', error);
            throw error;
        }
    };

    const handleMicPress = async () => {
        if (isListening) {
            await stopListeningAndProcess();
        } else if (isSpeaking) {
            await voiceService.stopSpeaking();
            setIsSpeaking(false);
            await startListening();
        } else {
            await startListening();
        }
    };

    const handleClose = () => {
        stopAllAudio();
        onClose();
    };

    const renderMessage = (message: ConversationMessage) => {
        const isUser = message.role === 'user';

        return (
            <View
                key={message.id}
                style={[
                    styles.messageContainer,
                    isUser ? styles.userMessageContainer : styles.aiMessageContainer,
                ]}
            >
                {!isUser && (
                    <View style={styles.avatarContainer}>
                        <LinearGradient
                            colors={[COLORS.orange, COLORS.lightOrange]}
                            style={styles.avatar}
                        >
                            <MaterialCommunityIcons name="robot" size={16} color={COLORS.white} />
                        </LinearGradient>
                    </View>
                )}

                <View
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.aiBubble,
                    ]}
                >
                    <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
                        {message.content}
                    </Text>
                </View>

                {isUser && (
                    <View style={styles.avatarContainer}>
                        <View style={styles.userAvatar}>
                            <Ionicons name="person" size={16} color={COLORS.white} />
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderWaveform = () => {
        const waves = Array.from({ length: 5 }, (_, i) => {
            // Use scaleY transform instead of height (native driver compatible)
            const baseHeight = 20;
            const scale = waveAnimation.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.2, 1 + (i * 0.2), 0.2],
            });

            return (
                <Animated.View
                    key={i}
                    style={[
                        styles.wave,
                        {
                            height: baseHeight,
                            transform: [{ scaleY: scale }],
                            backgroundColor: isListening ? COLORS.orange : COLORS.grey,
                        },
                    ]}
                />
            );
        });

        return <View style={styles.waveContainer}>{waves}</View>;
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={[COLORS.orange, COLORS.lightOrange]}
                    style={styles.header}
                >
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={COLORS.white} />
                    </TouchableOpacity>

                    <View style={styles.headerContent}>
                        <MaterialCommunityIcons name="robot" size={28} color={COLORS.white} />
                        <Text style={styles.headerTitle}>Voice Ordering</Text>
                        <Text style={styles.headerSubtitle}>Talk to Dai to place your order</Text>
                    </View>

                    <View style={styles.headerPlaceholder} />
                </LinearGradient>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map(renderMessage)}

                    {/* Current transcript while listening */}
                    {isListening && currentTranscript && (
                        <View style={[styles.messageContainer, styles.userMessageContainer]}>
                            <View style={[styles.messageBubble, styles.userBubble, styles.listeningBubble]}>
                                <Text style={[styles.messageText, styles.userText, styles.listeningText]}>
                                    {currentTranscript}
                                </Text>
                                <ActivityIndicator size="small" color={COLORS.white} style={styles.listeningIndicator} />
                            </View>
                            <View style={styles.avatarContainer}>
                                <View style={styles.userAvatar}>
                                    <Ionicons name="person" size={16} color={COLORS.white} />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Processing indicator */}
                    {conversationState === 'processing' && (
                        <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                            <View style={styles.avatarContainer}>
                                <LinearGradient
                                    colors={[COLORS.orange, COLORS.lightOrange]}
                                    style={styles.avatar}
                                >
                                    <MaterialCommunityIcons name="robot" size={16} color={COLORS.white} />
                                </LinearGradient>
                            </View>
                            <View style={[styles.messageBubble, styles.aiBubble]}>
                                <View style={styles.processingDots}>
                                    <View style={[styles.dot, { backgroundColor: COLORS.orange }]} />
                                    <View style={[styles.dot, { backgroundColor: COLORS.lightOrange }]} />
                                    <View style={[styles.dot, { backgroundColor: COLORS.orange }]} />
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Input Area */}
                <View style={styles.inputArea}>
                    {/* Status Text */}
                    <Text style={styles.statusText}>{statusText}</Text>

                    {/* Waveform */}
                    {isListening && renderWaveform()}

                    {/* Microphone Button */}
                    <TouchableOpacity
                        style={styles.micButtonContainer}
                        onPress={handleMicPress}
                        disabled={conversationState === 'processing' || conversationState === 'order_complete'}
                        activeOpacity={0.7}
                    >
                        <Animated.View
                            style={[
                                styles.micButton,
                                { transform: [{ scale: pulseAnimation }] },
                                isListening && styles.micButtonActive,
                                isSpeaking && styles.micButtonSpeaking,
                            ]}
                        >
                            <Ionicons
                                name={isListening ? 'mic' : isSpeaking ? 'volume-high' : 'mic-outline'}
                                size={32}
                                color={COLORS.white}
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    {/* Control Buttons */}
                    <View style={styles.controlButtons}>
                        {isListening && (
                            <TouchableOpacity
                                style={styles.controlButton}
                                onPress={stopListeningAndProcess}
                            >
                                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                                <Text style={styles.controlButtonText}>Done</Text>
                            </TouchableOpacity>
                        )}

                        {isSpeaking && (
                            <TouchableOpacity
                                style={styles.controlButton}
                                onPress={() => {
                                    voiceService.stopSpeaking();
                                    setIsSpeaking(false);
                                    startListening();
                                }}
                            >
                                <Ionicons name="hand-left" size={24} color={COLORS.orange} />
                                <Text style={styles.controlButtonText}>Skip</Text>
                            </TouchableOpacity>
                        )}

                        {conversationState === 'waiting_for_input' && (
                            <TouchableOpacity
                                style={styles.controlButton}
                                onPress={startListening}
                            >
                                <Ionicons name="refresh" size={24} color={COLORS.grey} />
                                <Text style={styles.controlButtonText}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Exit Button */}
                    <TouchableOpacity style={styles.exitButton} onPress={handleClose}>
                        <Text style={styles.exitButtonText}>End Conversation</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.offWhite,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    closeButton: {
        padding: 8,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.white,
        marginTop: 4,
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    headerPlaceholder: {
        width: 40,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 24,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    aiMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        marginHorizontal: 8,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.grey,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageBubble: {
        maxWidth: width * 0.7,
        padding: 12,
        borderRadius: 16,
    },
    userBubble: {
        backgroundColor: COLORS.orange,
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: COLORS.white,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.lightGrey,
    },
    listeningBubble: {
        opacity: 0.8,
        flexDirection: 'row',
        alignItems: 'center',
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
    listeningText: {
        fontStyle: 'italic',
    },
    listeningIndicator: {
        marginLeft: 8,
    },
    processingDots: {
        flexDirection: 'row',
        padding: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 2,
    },
    inputArea: {
        backgroundColor: COLORS.white,
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGrey,
        alignItems: 'center',
    },
    statusText: {
        fontSize: 14,
        color: COLORS.grey,
        marginBottom: 16,
        textAlign: 'center',
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        marginBottom: 16,
        gap: 4,
    },
    wave: {
        width: 4,
        borderRadius: 2,
    },
    micButtonContainer: {
        marginBottom: 16,
    },
    micButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.orange,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.orange,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    micButtonActive: {
        backgroundColor: COLORS.success,
    },
    micButtonSpeaking: {
        backgroundColor: COLORS.info,
    },
    controlButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 24,
    },
    controlButton: {
        alignItems: 'center',
        padding: 8,
    },
    controlButtonText: {
        fontSize: 12,
        color: COLORS.grey,
        marginTop: 4,
    },
    exitButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    exitButtonText: {
        fontSize: 14,
        color: COLORS.error,
        fontWeight: '500',
    },
});

export default VoiceConversationInterface;
