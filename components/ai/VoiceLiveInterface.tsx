/**
 * Voice Live Interface
 * 
 * A full-screen voice conversation interface using Azure Voice Live API.
 * Uses native speech recognition for input (since expo-av doesn't support raw PCM on Android)
 * and Azure Voice Live for AI voice output.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    SafeAreaView,
    ScrollView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useLanguage } from '../../contexts/LanguageContext';
import { voiceLiveService } from '../../services/voice/voiceLiveService';
import { nativeVoiceService } from '../../services/voice/nativeVoiceService';
import { bedrockAIService } from '../../services/aiAgent/bedrockAIService';
import { useCartStore } from '../../store/cart';
import { supabase } from '../../services/supabase/supabase';

// Color palette
const COLORS = {
    primary: '#FF6B00',
    primaryDark: '#E55A00',
    background: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceLight: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    success: '#00C853',
    error: '#FF5252',
    warning: '#FFB300',
    info: '#2196F3',
    gradient: ['#1A1A2E', '#16213E', '#0F3460'] as const,
};

interface VoiceLiveInterfaceProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    onOrderComplete?: (orderId: string, items: any[]) => void;
}

interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isPartial?: boolean;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

const VoiceLiveInterface: React.FC<VoiceLiveInterfaceProps> = ({
    visible,
    onClose,
    userId,
    onOrderComplete,
}) => {
    const { currentLanguage } = useLanguage();
    const cartStore = useCartStore();

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [conversationState, setConversationState] = useState<ConversationState>('idle');
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [statusText, setStatusText] = useState('Tap to connect');
    const [isInitializing, setIsInitializing] = useState(false);
    const [isSttListening, setIsSttListening] = useState(false);  // Native STT state

    // Refs
    const scrollViewRef = useRef<ScrollView>(null);
    const pulseAnimation = useRef(new Animated.Value(1)).current;
    const waveAnimation = useRef(new Animated.Value(0)).current;
    const responseTextRef = useRef('');
    const nativeSttActive = useRef(false);  // Track if native STT is active

    // Animation functions
    const startPulseAnimation = useCallback(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnimation, {
                    toValue: 1.2,
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
    }, [pulseAnimation]);

    const stopPulseAnimation = useCallback(() => {
        pulseAnimation.stopAnimation();
        pulseAnimation.setValue(1);
    }, [pulseAnimation]);

    const startWaveAnimation = useCallback(() => {
        Animated.loop(
            Animated.timing(waveAnimation, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, [waveAnimation]);

    const stopWaveAnimation = useCallback(() => {
        waveAnimation.stopAnimation();
        waveAnimation.setValue(0);
    }, [waveAnimation]);

    // Handle function calls from Voice Live
    const handleFunctionCall = useCallback(async (name: string, args: any): Promise<any> => {
        console.log('[VoiceLive UI] Function call:', name, args);

        try {
            switch (name) {
                case 'search_products': {
                    const { query, quantity, category } = args;

                    // Use the existing product search
                    const { data: products, error } = await supabase
                        .from('products')
                        .select(`
              id, name, price, image_url, category, subcategory, brand,
              stock_available, unit, min_quantity, seller_id,
              profiles!products_seller_id_fkey (
                id,
                seller_details (
                  business_name
                )
              )
            `)
                        .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
                        .eq('status', 'active')
                        .limit(5);

                    if (error) {
                        return { success: false, error: error.message };
                    }

                    if (!products || products.length === 0) {
                        return {
                            success: false,
                            message: `No products found matching "${query}"`
                        };
                    }

                    const formattedProducts = products.map(p => {
                        const profile = p.profiles as any;
                        const sellerName = profile?.seller_details?.[0]?.business_name || 'Unknown';
                        return {
                            id: p.id,
                            name: p.name,
                            price: p.price,
                            unit: p.unit,
                            stock: p.stock_available,
                            seller: sellerName,
                            seller_id: p.seller_id,
                        };
                    });

                    return {
                        success: true,
                        products: formattedProducts,
                        message: `Found ${products.length} products matching "${query}"`,
                    };
                }

                case 'add_to_cart': {
                    const { product_id, quantity, seller_id } = args;

                    // Fetch product details
                    const { data: product, error } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', product_id)
                        .single();

                    if (error || !product) {
                        return { success: false, error: 'Product not found' };
                    }

                    // Add to cart using store
                    await cartStore.addToCart({
                        uniqueId: `voice_${Date.now()}`,
                        product_id: product.id,
                        seller_id: seller_id || product.seller_id,
                        name: product.name,
                        price: String(product.price),
                        quantity: quantity || 1,
                        image_url: product.image_url || '',
                        unit: product.unit || '',
                    });

                    return {
                        success: true,
                        message: `Added ${quantity || 1} ${product.unit || 'units'} of ${product.name} to cart`,
                        cart_total: cartStore.getTotal(),
                        cart_items: cartStore.items.length,
                    };
                }

                case 'view_cart': {
                    const items = cartStore.items.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        subtotal: parseFloat(item.price) * item.quantity,
                    }));

                    return {
                        success: true,
                        items,
                        total: cartStore.getTotal(),
                        item_count: cartStore.items.length,
                    };
                }

                case 'place_order': {
                    const { payment_method, notes } = args;

                    if (cartStore.items.length === 0) {
                        return { success: false, error: 'Cart is empty' };
                    }

                    // Create order
                    const { data: order, error } = await supabase
                        .from('orders')
                        .insert({
                            user_id: userId,
                            items: cartStore.items,
                            total: cartStore.getTotal(),
                            status: 'pending',
                            payment_method: payment_method || 'cod',
                            notes: notes,
                        })
                        .select()
                        .single();

                    if (error) {
                        return { success: false, error: error.message };
                    }

                    // Clear cart
                    cartStore.clearCart();

                    // Notify parent
                    if (onOrderComplete) {
                        onOrderComplete(order.id, cartStore.items);
                    }

                    return {
                        success: true,
                        order_id: order.id,
                        message: 'Order placed successfully!',
                    };
                }

                default:
                    return { success: false, error: `Unknown function: ${name}` };
            }
        } catch (error: any) {
            console.error('[VoiceLive UI] Function error:', error);
            return { success: false, error: error.message };
        }
    }, [userId, cartStore, onOrderComplete]);

    // Initialize Voice Live connection
    const initializeVoiceLive = useCallback(async () => {
        setIsInitializing(true);
        setStatusText('Initializing...');
        setConnectionState('connecting');

        try {
            // Set the voice based on language
            voiceLiveService.setVoice(currentLanguage);

            // Initialize the service
            const initialized = await voiceLiveService.initialize({
                onSessionCreated: () => {
                    console.log('[VoiceLive UI] Session created');
                    setConnectionState('connected');
                    setStatusText('Tap to speak');
                    setConversationState('idle');

                    // Don't start continuous audio streaming - use native STT instead
                    // We'll use push-to-talk with native speech recognition

                    // Add welcome message
                    const welcomeMessage: ConversationMessage = {
                        id: `welcome_${Date.now()}`,
                        role: 'assistant',
                        content: 'Hi! I\'m Dai, your voice shopping assistant. Tap the microphone and speak to me!',
                        timestamp: new Date(),
                    };
                    setMessages([welcomeMessage]);
                },
                onSpeechStarted: () => {
                    setConversationState('listening');
                    setStatusText('Listening...');
                    startPulseAnimation();
                    startWaveAnimation();
                },
                onSpeechStopped: () => {
                    setConversationState('processing');
                    setStatusText('Processing...');
                    stopPulseAnimation();
                    stopWaveAnimation();
                },
                onTranscript: (text, isFinal) => {
                    setCurrentTranscript(text);
                    if (isFinal && text.trim()) {
                        // Add user message
                        const userMessage: ConversationMessage = {
                            id: `user_${Date.now()}`,
                            role: 'user',
                            content: text,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, userMessage]);
                        setCurrentTranscript('');
                    }
                },
                onResponseText: (text, isFinal) => {
                    if (isFinal) {
                        responseTextRef.current = text;
                        // Add or update assistant message
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg?.role === 'assistant' && lastMsg.isPartial) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, content: text, isPartial: false },
                                ];
                            }
                            return [
                                ...prev,
                                {
                                    id: `ai_${Date.now()}`,
                                    role: 'assistant',
                                    content: text,
                                    timestamp: new Date(),
                                },
                            ];
                        });
                    } else {
                        responseTextRef.current += text;
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg?.role === 'assistant' && lastMsg.isPartial) {
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, content: responseTextRef.current },
                                ];
                            }
                            return [
                                ...prev,
                                {
                                    id: `ai_${Date.now()}`,
                                    role: 'assistant',
                                    content: responseTextRef.current,
                                    timestamp: new Date(),
                                    isPartial: true,
                                },
                            ];
                        });
                    }
                    setConversationState('speaking');
                    setStatusText('Dai is speaking...');
                },
                onAudioResponse: (audioData) => {
                    // Audio is being played by the service
                    setConversationState('speaking');
                },
                onFunctionCall: handleFunctionCall,
                onError: (error) => {
                    console.error('[VoiceLive UI] Error:', error);
                    setStatusText(`Error: ${error}`);
                    setConversationState('error');
                },
                onConnectionChange: (connected) => {
                    setConnectionState(connected ? 'connected' : 'disconnected');
                    if (!connected) {
                        setStatusText('Disconnected. Tap to reconnect');
                        setConversationState('idle');
                    }
                },
            });

            if (!initialized) {
                throw new Error('Failed to initialize Voice Live');
            }

            // Connect to Voice Live
            const connected = await voiceLiveService.connect();

            if (!connected) {
                throw new Error('Failed to connect to Voice Live');
            }
        } catch (error: any) {
            console.error('[VoiceLive UI] Initialization error:', error);
            setStatusText(`Connection failed: ${error.message}`);
            setConnectionState('error');
        } finally {
            setIsInitializing(false);
        }
    }, [currentLanguage, handleFunctionCall, startPulseAnimation, startWaveAnimation, stopPulseAnimation, stopWaveAnimation]);

    // Handle microphone button press - uses native STT for speech recognition
    const handleMicPress = useCallback(async () => {
        if (connectionState === 'disconnected' || connectionState === 'error') {
            await initializeVoiceLive();
            return;
        }

        if (!voiceLiveService.isConnected()) {
            await initializeVoiceLive();
            return;
        }

        if (conversationState === 'speaking') {
            // Interrupt current response
            voiceLiveService.interrupt();
            setConversationState('idle');
            setStatusText('Tap to speak');
            stopPulseAnimation();
            stopWaveAnimation();
            return;
        }

        // Toggle native STT
        if (isSttListening) {
            // Stop listening and process
            try {
                await nativeVoiceService.stopListening();
                setIsSttListening(false);
                nativeSttActive.current = false;
                setConversationState('processing');
                setStatusText('Processing...');
                stopPulseAnimation();
                stopWaveAnimation();
            } catch (error) {
                console.error('[VoiceLive UI] Error stopping STT:', error);
            }
        } else {
            // Start listening with native STT
            try {
                const language = currentLanguage === 'hi' ? 'hi-IN' : 'en-US';

                const started = await nativeVoiceService.startListening(
                    language,
                    // onResult callback
                    (result) => {
                        setCurrentTranscript(result.text);

                        // If final result, process it
                        if (result.isFinal && result.text.trim()) {
                            setIsSttListening(false);
                            nativeSttActive.current = false;
                            setCurrentTranscript('');

                            // Add user message to chat
                            const userMessage: ConversationMessage = {
                                id: `user_${Date.now()}`,
                                role: 'user',
                                content: result.text,
                                timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, userMessage]);

                            // Send text to Voice Live for AI response with voice
                            voiceLiveService.sendTextMessage(result.text);
                            setConversationState('processing');
                            setStatusText('Dai is thinking...');
                            stopPulseAnimation();
                            stopWaveAnimation();
                        }
                    },
                    // onError callback
                    (error: string) => {
                        console.error('[VoiceLive UI] STT error:', error);
                        setIsSttListening(false);
                        nativeSttActive.current = false;
                        setConversationState('idle');
                        setStatusText('Tap to speak');
                        stopPulseAnimation();
                        stopWaveAnimation();
                    }
                );

                if (started) {
                    setIsSttListening(true);
                    nativeSttActive.current = true;
                    setConversationState('listening');
                    setStatusText('Listening...');
                    startPulseAnimation();
                    startWaveAnimation();
                }
            } catch (error) {
                console.error('[VoiceLive UI] Error starting STT:', error);
            }
        }
    }, [connectionState, conversationState, isSttListening, currentLanguage, initializeVoiceLive, startPulseAnimation, startWaveAnimation, stopPulseAnimation, stopWaveAnimation]);

    // Handle close
    const handleClose = useCallback(async () => {
        // Stop native STT if active
        if (nativeSttActive.current) {
            await nativeVoiceService.cancel();
            nativeSttActive.current = false;
            setIsSttListening(false);
        }
        stopPulseAnimation();
        stopWaveAnimation();

        await voiceLiveService.disconnect();
        setConnectionState('disconnected');
        setConversationState('idle');
        setMessages([]);
        setCurrentTranscript('');
        responseTextRef.current = '';
        onClose();
    }, [onClose, stopPulseAnimation, stopWaveAnimation]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollViewRef.current) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            voiceLiveService.disconnect();
        };
    }, []);

    // Get status color
    const getStatusColor = () => {
        switch (connectionState) {
            case 'connected':
                return COLORS.success;
            case 'connecting':
                return COLORS.warning;
            case 'error':
                return COLORS.error;
            default:
                return COLORS.textSecondary;
        }
    };

    // Get mic button color
    const getMicButtonStyle = () => {
        if (conversationState === 'listening') {
            return styles.micButtonListening;
        }
        if (conversationState === 'speaking') {
            return styles.micButtonSpeaking;
        }
        if (conversationState === 'processing') {
            return styles.micButtonProcessing;
        }
        return styles.micButton;
    };

    // Render waveform
    const renderWaveform = () => {
        if (conversationState !== 'listening' && conversationState !== 'speaking') {
            return null;
        }

        const bars = [];
        for (let i = 0; i < 5; i++) {
            const delay = i * 150;
            const minHeight = 8;
            const maxHeight = 40;

            bars.push(
                <Animated.View
                    key={i}
                    style={[
                        styles.waveBar,
                        {
                            transform: [
                                {
                                    scaleY: waveAnimation.interpolate({
                                        inputRange: [0, 0.5, 1],
                                        outputRange: [0.3, 1, 0.3],
                                    }),
                                },
                            ],
                            opacity: waveAnimation.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0.5, 1, 0.5],
                            }),
                        },
                    ]}
                />
            );
        }

        return <View style={styles.waveformContainer}>{bars}</View>;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <LinearGradient colors={COLORS.gradient} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={COLORS.text} />
                        </TouchableOpacity>

                        <View style={styles.headerCenter}>
                            <View style={styles.headerTitleContainer}>
                                <MaterialCommunityIcons name="robot" size={24} color={COLORS.primary} />
                                <Text style={styles.headerTitle}>Voice Live</Text>
                            </View>
                            <View style={styles.statusContainer}>
                                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                                <Text style={styles.statusText}>{statusText}</Text>
                            </View>
                        </View>

                        <View style={styles.headerRight}>
                            <Text style={styles.languageLabel}>{currentLanguage.toUpperCase()}</Text>
                        </View>
                    </View>

                    {/* Messages */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {messages.map((message) => (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageBubble,
                                    message.role === 'user' ? styles.userBubble : styles.aiBubble,
                                ]}
                            >
                                {message.role === 'assistant' && (
                                    <View style={styles.aiAvatar}>
                                        <MaterialCommunityIcons name="robot" size={16} color={COLORS.primary} />
                                    </View>
                                )}
                                <Text style={[
                                    styles.messageText,
                                    message.role === 'user' ? styles.userText : styles.aiText,
                                    message.isPartial && styles.partialText,
                                ]}>
                                    {message.content}
                                </Text>
                            </View>
                        ))}

                        {/* Current transcript */}
                        {currentTranscript ? (
                            <View style={[styles.messageBubble, styles.userBubble, styles.transcriptBubble]}>
                                <Text style={[styles.messageText, styles.userText, styles.partialText]}>
                                    {currentTranscript}
                                </Text>
                            </View>
                        ) : null}
                    </ScrollView>

                    {/* Waveform visualization */}
                    {renderWaveform()}

                    {/* Microphone button */}
                    <View style={styles.bottomContainer}>
                        {/* Test button - send text to verify API works */}
                        {connectionState === 'connected' && (
                            <TouchableOpacity
                                style={styles.testButton}
                                onPress={() => {
                                    voiceLiveService.sendTextMessage("Hello, I'm looking for rice");
                                    setMessages(prev => [...prev, {
                                        id: `user_${Date.now()}`,
                                        role: 'user',
                                        content: "[Test] Hello, I'm looking for rice",
                                        timestamp: new Date(),
                                    }]);
                                }}
                            >
                                <Text style={styles.testButtonText}>Test: Send Text</Text>
                            </TouchableOpacity>
                        )}

                        <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
                            <TouchableOpacity
                                style={[styles.micButtonBase, getMicButtonStyle()]}
                                onPress={handleMicPress}
                                disabled={isInitializing}
                            >
                                {isInitializing ? (
                                    <MaterialCommunityIcons name="loading" size={40} color={COLORS.text} />
                                ) : conversationState === 'listening' ? (
                                    <MaterialCommunityIcons name="microphone" size={40} color={COLORS.text} />
                                ) : conversationState === 'speaking' ? (
                                    <MaterialCommunityIcons name="volume-high" size={40} color={COLORS.text} />
                                ) : (
                                    <MaterialCommunityIcons name="microphone-outline" size={40} color={COLORS.text} />
                                )}
                            </TouchableOpacity>
                        </Animated.View>

                        <Text style={styles.instructions}>
                            {connectionState === 'disconnected' || connectionState === 'error'
                                ? 'Tap to connect'
                                : conversationState === 'listening'
                                    ? 'Listening... Tap to mute'
                                    : conversationState === 'speaking'
                                        ? 'Tap to interrupt'
                                        : 'Tap to unmute'}
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        padding: 8,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    headerRight: {
        padding: 8,
    },
    languageLabel: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '600',
    },
    messagesContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    messagesContent: {
        paddingVertical: 16,
        gap: 12,
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primary,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.surfaceLight,
    },
    transcriptBubble: {
        opacity: 0.7,
    },
    aiAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        flex: 1,
    },
    userText: {
        color: COLORS.text,
    },
    aiText: {
        color: COLORS.text,
    },
    partialText: {
        opacity: 0.7,
        fontStyle: 'italic',
    },
    waveformContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        gap: 6,
    },
    waveBar: {
        width: 6,
        height: 40,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
    },
    bottomContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    micButtonBase: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    micButton: {
        backgroundColor: COLORS.surface,
    },
    micButtonListening: {
        backgroundColor: COLORS.error,
    },
    micButtonSpeaking: {
        backgroundColor: COLORS.info,
    },
    micButtonProcessing: {
        backgroundColor: COLORS.warning,
    },
    instructions: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    testButton: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 16,
    },
    testButtonText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default VoiceLiveInterface;
