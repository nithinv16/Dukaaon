/**
 * Azure Voice Live Service
 * 
 * Real-time voice-to-voice AI using Azure Voice Live API.
 * Streams audio directly to Azure/OpenAI, receives audio responses.
 * No separate STT/TTS layers - all handled by the service.
 * 
 * Features:
 * - Real-time audio streaming via WebSocket
 * - Function calling for ordering capabilities
 * - Multi-language support
 * - Noise reduction and echo cancellation
 * - Interruption handling
 * 
 * Audio Recording:
 * - Uses expo-av for recording (with limitations on Android)
 * - For best results, use native STT + Voice Live for output
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// Configuration for Azure Voice Live
interface VoiceLiveConfig {
    resourceName: string;
    apiKey: string;
    model?: string;
    voice?: {
        name: string;
        type: 'azure-standard' | 'azure-hd' | 'azure-custom';
        temperature?: number;
    };
    language?: string;
}

// Session configuration
interface SessionConfig {
    instructions: string;
    turnDetection?: {
        type: 'azure_semantic_vad' | 'server_vad';
        threshold?: number;
        prefixPaddingMs?: number;
        silenceDurationMs?: number;
        removeFillerWords?: boolean;
    };
    inputAudioNoiseReduction?: {
        type: 'azure_deep_noise_suppression' | 'none';
    };
    inputAudioEchoCancellation?: {
        type: 'server_echo_cancellation' | 'none';
    };
    tools?: ToolDefinition[];
}

// Tool definition for function calling
interface ToolDefinition {
    type: 'function';
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

// Event types
type VoiceLiveEventType =
    | 'session.created'
    | 'session.updated'
    | 'input_audio_buffer.speech_started'
    | 'input_audio_buffer.speech_stopped'
    | 'input_audio_buffer.committed'
    | 'response.created'
    | 'response.output_item.added'
    | 'response.audio.delta'
    | 'response.audio.done'
    | 'response.audio_transcript.delta'
    | 'response.audio_transcript.done'
    | 'response.function_call_arguments.delta'
    | 'response.function_call_arguments.done'
    | 'response.done'
    | 'error';

interface VoiceLiveEvent {
    type: VoiceLiveEventType;
    event_id?: string;
    session?: any;
    response?: any;
    delta?: string;
    transcript?: string;
    error?: {
        type: string;
        code: string;
        message: string;
    };
    item?: any;
    // Function call properties
    name?: string;
    arguments?: string;
    call_id?: string;
}

// Callbacks for handling events
interface VoiceLiveCallbacks {
    onSessionCreated?: () => void;
    onSpeechStarted?: () => void;
    onSpeechStopped?: () => void;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onAudioResponse?: (audioData: ArrayBuffer) => void;
    onResponseText?: (text: string, isFinal: boolean) => void;
    onFunctionCall?: (name: string, args: any) => Promise<any>;
    onError?: (error: string) => void;
    onConnectionChange?: (connected: boolean) => void;
}

// Connection state
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

class VoiceLiveService {
    private config: VoiceLiveConfig;
    private ws: WebSocket | null = null;
    private connectionState: ConnectionState = 'disconnected';
    private callbacks: VoiceLiveCallbacks = {};
    private recording: Audio.Recording | null = null;
    private isRecording = false;
    private isContinuousMode = false;  // Continuous listening mode
    private isAISpeaking = false;  // Pause recording while AI speaks
    private streamingInterval: ReturnType<typeof setInterval> | null = null;
    private audioStreamSubscription: any = null;  // For expo-audio-studio
    private audioQueue: ArrayBuffer[] = [];
    private isPlayingAudio = false;
    private sound: Audio.Sound | null = null;
    private sessionId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private pendingResponseText = '';
    private pendingAudioChunks: string[] = [];  // Collect base64 audio chunks

    constructor() {
        // Initialize with empty config - env vars will be read at connect time
        this.config = {
            resourceName: '',
            apiKey: '',
            model: 'gpt-4o-realtime-preview',
            voice: {
                name: 'en-US-AvaNeural',  // Standard neural voice (HD may not be available)
                type: 'azure-standard',
                temperature: 0.8,
            },
            language: 'en',
        };
    }

    /**
     * Initialize the Voice Live service
     */
    async initialize(callbacks: VoiceLiveCallbacks): Promise<boolean> {
        this.callbacks = callbacks;

        // Request audio permissions
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                this.callbacks.onError?.('Microphone permission not granted');
                return false;
            }

            // Configure audio mode for recording and playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            return true;
        } catch (error) {
            console.error('[VoiceLive] Error initializing audio:', error);
            this.callbacks.onError?.('Failed to initialize audio');
            return false;
        }
    }

    /**
     * Connect to Azure Voice Live WebSocket
     */
    async connect(sessionConfig?: Partial<SessionConfig>): Promise<boolean> {
        // Read environment variables at connect time
        // Fallback to hardcoded values if env vars aren't available (not ideal, but works for now)
        const resourceName = process.env.EXPO_PUBLIC_AZURE_FOUNDRY_RESOURCE || 'nithinvthomas96-2664-resource';
        const apiKey = process.env.EXPO_PUBLIC_AZURE_FOUNDRY_KEY || 'BoAylDHkLnHj3WloBq5loZL22t2fVCd3YPwSFtIdINazL8C4IeZ0JQQJ99BIACHYHv6XJ3w3AAAAACOGnwpd';

        console.log('[VoiceLive] Environment check:', {
            hasResource: !!resourceName,
            resourceName: resourceName ? resourceName.substring(0, 10) + '...' : 'MISSING',
            hasKey: !!apiKey,
            keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING',
            envKeys: Object.keys(process.env).filter(k => k.includes('AZURE')).join(', '),
        });

        this.config.resourceName = resourceName;
        this.config.apiKey = apiKey;

        if (!this.config.resourceName || !this.config.apiKey) {
            console.error('[VoiceLive] Missing Azure Foundry configuration');
            console.error('[VoiceLive] Please add to .env file:');
            console.error('  EXPO_PUBLIC_AZURE_FOUNDRY_RESOURCE=your-resource-name');
            console.error('  EXPO_PUBLIC_AZURE_FOUNDRY_KEY=your-api-key');
            this.callbacks.onError?.('Azure Foundry configuration missing. Check console for details.');
            return false;
        }

        try {
            this.connectionState = 'connecting';
            this.callbacks.onConnectionChange?.(false);

            // Build WebSocket URL (API version 2025-10-01 per official docs)
            const wsUrl = `wss://${this.config.resourceName}.services.ai.azure.com/voice-live/realtime?api-version=2025-10-01&model=${this.config.model}&api-key=${this.config.apiKey}`;

            console.log('[VoiceLive] Connecting to:', wsUrl.replace(this.config.apiKey, '***'));

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.ws?.close();
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.ws!.onopen = () => {
                    clearTimeout(timeout);
                    console.log('[VoiceLive] WebSocket connected');
                    this.connectionState = 'connected';
                    this.callbacks.onConnectionChange?.(true);
                    this.reconnectAttempts = 0;

                    // Send session configuration
                    this.configureSession(sessionConfig);
                    resolve(true);
                };

                this.ws!.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.ws!.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('[VoiceLive] WebSocket error:', error);
                    this.connectionState = 'error';
                    this.callbacks.onError?.('WebSocket connection error');
                    reject(error);
                };

                this.ws!.onclose = (event) => {
                    console.log('[VoiceLive] WebSocket closed:', event.code, event.reason);
                    this.connectionState = 'disconnected';
                    this.callbacks.onConnectionChange?.(false);
                    this.handleDisconnect();
                };
            });
        } catch (error) {
            console.error('[VoiceLive] Connection error:', error);
            this.connectionState = 'error';
            this.callbacks.onError?.(`Connection failed: ${error}`);
            return false;
        }
    }

    /**
     * Configure the Voice Live session
     */
    private configureSession(config?: Partial<SessionConfig>): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const defaultTools = this.getDefaultTools();

        // Phrase list for better product recognition
        const productPhraseList = [
            'rice', 'sugar', 'wheat', 'flour', 'oil', 'ghee', 'dal', 'lentils',
            'vegetables', 'fruits', 'milk', 'butter', 'cheese', 'eggs', 'chicken',
            'fish', 'mutton', 'spices', 'masala', 'turmeric', 'cumin', 'coriander',
            'salt', 'pepper', 'tea', 'coffee', 'biscuits', 'snacks', 'chips',
            'bread', 'atta', 'maida', 'sooji', 'poha', 'dosa', 'idli', 'sambar',
            'Basmati rice', 'Sunflower oil', 'Groundnut oil', 'Mustard oil',
            'Tata salt', 'Aashirvaad atta', 'Fortune oil', 'Amul butter',
            'kilogram', 'kg', 'gram', 'grams', 'litre', 'liter', 'packet', 'dozen',
        ];

        const sessionUpdate = {
            type: 'session.update',
            session: {
                instructions: config?.instructions || `You are Dai, a helpful voice shopping assistant for Dukaaon marketplace.
You help customers find and order products through natural conversation.
Keep responses concise (1-2 sentences) since they will be spoken.
When a customer wants to order, search for products, confirm details, and help them complete the purchase.
Be friendly, helpful, and efficient.
Always confirm the product name and quantity before adding to cart.`,

                // Input audio configuration
                input_audio_sampling_rate: 24000,

                // Note: phrase_list is not supported for gpt-4o-realtime-preview (multimodal)
                // It only works with cascaded pipelines using azure-speech model
                // The multimodal model handles transcription natively

                // Turn detection with Azure Semantic VAD
                // Note: end_of_utterance_detection is only for cascaded pipelines (non-multimodal)
                turn_detection: config?.turnDetection || {
                    type: 'azure_semantic_vad',
                    threshold: 0.3,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    remove_filler_words: true,
                    create_response: true,
                    interrupt_response: true,
                },

                // Noise reduction and echo cancellation
                input_audio_noise_reduction: config?.inputAudioNoiseReduction || {
                    type: 'azure_deep_noise_suppression',
                },
                input_audio_echo_cancellation: config?.inputAudioEchoCancellation || {
                    type: 'server_echo_cancellation',
                },

                // Voice output configuration
                voice: this.config.voice,

                // Function calling
                tools: config?.tools || defaultTools,
                tool_choice: 'auto',
            },
        };

        this.ws.send(JSON.stringify(sessionUpdate));
        console.log('[VoiceLive] Session configuration sent with Azure Speech transcription');
    }

    /**
     * Get default tools for order processing
     */
    private getDefaultTools(): ToolDefinition[] {
        return [
            {
                type: 'function',
                name: 'search_products',
                description: 'Search for products in the marketplace. Use this when a customer asks about or wants to order a product.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The product name or search query',
                        },
                        quantity: {
                            type: 'number',
                            description: 'The quantity requested by the customer',
                        },
                        category: {
                            type: 'string',
                            description: 'Optional product category filter',
                        },
                    },
                    required: ['query'],
                },
            },
            {
                type: 'function',
                name: 'add_to_cart',
                description: 'Add a product to the customer cart. Use after confirming product selection.',
                parameters: {
                    type: 'object',
                    properties: {
                        product_id: {
                            type: 'string',
                            description: 'The ID of the product to add',
                        },
                        quantity: {
                            type: 'number',
                            description: 'The quantity to add',
                        },
                        seller_id: {
                            type: 'string',
                            description: 'The ID of the seller',
                        },
                    },
                    required: ['product_id', 'quantity'],
                },
            },
            {
                type: 'function',
                name: 'view_cart',
                description: 'View the current items in the cart. Use when customer asks about their cart.',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                type: 'function',
                name: 'place_order',
                description: 'Place an order for the items in the cart. Use when customer confirms they want to order.',
                parameters: {
                    type: 'object',
                    properties: {
                        payment_method: {
                            type: 'string',
                            enum: ['cod', 'online', 'credit'],
                            description: 'The payment method',
                        },
                        notes: {
                            type: 'string',
                            description: 'Any special instructions for the order',
                        },
                    },
                },
            },
        ];
    }

    /**
     * Handle incoming WebSocket messages
     */
    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            // Check if it's binary audio data
            if (event.data instanceof ArrayBuffer) {
                this.handleAudioResponse(event.data);
                return;
            }

            // Parse JSON message
            const message: VoiceLiveEvent = JSON.parse(event.data);
            console.log('[VoiceLive] Received:', message.type);

            switch (message.type) {
                case 'session.created':
                    this.sessionId = message.session?.id;
                    this.callbacks.onSessionCreated?.();
                    break;

                case 'session.updated':
                    console.log('[VoiceLive] Session updated:', message.session);
                    break;

                case 'input_audio_buffer.speech_started':
                    this.callbacks.onSpeechStarted?.();
                    break;

                case 'input_audio_buffer.speech_stopped':
                    this.callbacks.onSpeechStopped?.();
                    break;

                case 'response.created':
                    // New response starting, clear pending data and pause recording
                    this.pendingResponseText = '';
                    this.pendingAudioChunks = [];
                    this.isAISpeaking = true;  // Pause recording while AI responds
                    console.log('[VoiceLive] AI starting to respond, pausing recording');
                    break;

                case 'response.audio_transcript.delta':
                    if (message.delta) {
                        this.pendingResponseText += message.delta;
                        this.callbacks.onResponseText?.(message.delta, false);
                    }
                    break;

                case 'response.audio_transcript.done':
                    if (message.transcript) {
                        this.pendingResponseText = message.transcript;
                        this.callbacks.onResponseText?.(message.transcript, true);
                    }
                    break;

                case 'response.audio.delta':
                    // Collect audio chunks (base64 encoded PCM16 at 24kHz)
                    if (message.delta) {
                        this.pendingAudioChunks.push(message.delta);
                    }
                    break;

                case 'response.audio.done':
                    // All audio chunks received - combine and play
                    console.log('[VoiceLive] Audio complete, chunks:', this.pendingAudioChunks.length);
                    if (this.pendingAudioChunks.length > 0) {
                        this.playAzureAudio();
                    }
                    break;

                case 'response.done':
                    // Response complete - resume listening
                    console.log('[VoiceLive] Response done. Audio chunks:', this.pendingAudioChunks.length, 'Text length:', this.pendingResponseText.length);
                    // Note: If audio chunks existed, playAzureAudio() was already called in response.audio.done
                    // Resume recording after a short delay to let audio playback finish
                    setTimeout(() => {
                        this.isAISpeaking = false;
                        console.log('[VoiceLive] AI finished, resuming recording');
                    }, 500);
                    break;

                case 'response.function_call_arguments.done':
                    await this.handleFunctionCall(message);
                    break;

                case 'error':
                    console.error('[VoiceLive] Error:', message.error);
                    const errorMsg = message.error?.message || 'Unknown error';

                    // Check for region-related errors and stop reconnection
                    if (errorMsg.includes('not supported in this region')) {
                        console.error('[VoiceLive] Region not supported. gpt-4o-realtime-preview is only available in: East US 2, Sweden Central, West US 2');
                        // Stop reconnection attempts for region errors
                        this.reconnectAttempts = this.maxReconnectAttempts;
                        this.callbacks.onError?.('Voice Live not available in your Azure region. Please use East US 2, Sweden Central, or West US 2.');
                    } else {
                        this.callbacks.onError?.(errorMsg);
                    }
                    break;

                default:
                    // Skip logging for common unhandled types to reduce noise
                    const silentTypes = ['response.output_item.added', 'conversation.item.created',
                        'response.content_part.added', 'response.audio.done',
                        'response.content_part.done', 'response.output_item.done'];
                    if (!silentTypes.includes(message.type)) {
                        console.log('[VoiceLive] Unhandled message type:', message.type);
                    }
            }
        } catch (error) {
            console.error('[VoiceLive] Error handling message:', error);
        }
    }

    /**
     * Handle function call from the model
     */
    private async handleFunctionCall(message: VoiceLiveEvent): Promise<void> {
        try {
            // Log the full message structure for debugging
            console.log('[VoiceLive] Function call message:', JSON.stringify(message, null, 2));

            // The function call data can be in message.item or directly in message
            const functionName = message.name || message.item?.name;
            const args = message.arguments || message.item?.arguments;
            const callId = message.call_id || message.item?.call_id;

            if (!functionName) {
                console.error('[VoiceLive] Function call missing name:', message);
                return;
            }

            const parsedArgs = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {});
            console.log('[VoiceLive] Function call:', functionName, parsedArgs, 'callId:', callId);

            // Execute the function via callback
            let result: any;
            if (this.callbacks.onFunctionCall) {
                result = await this.callbacks.onFunctionCall(functionName, parsedArgs);
            } else {
                result = { error: 'No function handler registered' };
            }

            console.log('[VoiceLive] Function result:', result);

            // Send function result back to the model
            if (callId) {
                this.sendFunctionResult(callId, result);
            } else {
                console.error('[VoiceLive] Missing call_id for function result');
            }
        } catch (error) {
            console.error('[VoiceLive] Function call error:', error);
        }
    }

    /**
     * Send function result back to the model
     */
    private sendFunctionResult(callId: string, result: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const event = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(result),
            },
        };

        this.ws.send(JSON.stringify(event));

        // Request a new response after function result
        this.ws.send(JSON.stringify({ type: 'response.create' }));
    }

    /**
     * Handle audio response from the model
     */
    private handleAudioResponse(audioData: ArrayBuffer): void {
        this.audioQueue.push(audioData);
        this.callbacks.onAudioResponse?.(audioData);

        if (!this.isPlayingAudio) {
            this.playNextAudio();
        }
    }

    /**
     * Play the next audio chunk in the queue
     */
    private async playNextAudio(): Promise<void> {
        if (this.audioQueue.length === 0) {
            this.isPlayingAudio = false;
            return;
        }

        this.isPlayingAudio = true;
        const audioData = this.audioQueue.shift();

        if (!audioData) {
            this.isPlayingAudio = false;
            return;
        }

        try {
            // For React Native, we need to convert to base64 and play
            const base64Audio = this.arrayBufferToBase64(audioData);

            // Create audio URI (PCM audio needs to be converted)
            // Note: Expo Audio doesn't directly support raw PCM
            // We'll need to buffer and convert to a playable format

            // For now, skip to next chunk (audio playback needs native module)
            this.playNextAudio();
        } catch (error) {
            console.error('[VoiceLive] Error playing audio:', error);
            this.playNextAudio();
        }
    }

    /**
     * Speak the response using TTS (fallback since raw PCM not supported)
     */
    private async speakResponse(text: string): Promise<void> {
        try {
            // Stop any current speech
            Speech.stop();

            // Map language code to TTS language
            const ttsLanguageMap: Record<string, string> = {
                'en': 'en-US',
                'hi': 'hi-IN',
                'ml': 'ml-IN',
                'ta': 'ta-IN',
                'te': 'te-IN',
                'kn': 'kn-IN',
                'mr': 'mr-IN',
                'bn': 'bn-IN',
            };

            const language = ttsLanguageMap[this.config.language || 'en'] || 'en-US';

            // Speak the response
            Speech.speak(text, {
                language,
                rate: 1.0,
                pitch: 1.0,
                onDone: () => {
                    console.log('[VoiceLive] TTS completed');
                },
                onError: (error) => {
                    console.error('[VoiceLive] TTS error:', error);
                },
            });
        } catch (error) {
            console.error('[VoiceLive] Error speaking response:', error);
        }
    }

    /**
     * Play audio received from Azure Voice Live
     * Combines PCM chunks into a WAV file and plays it
     */
    private async playAzureAudio(): Promise<void> {
        if (this.pendingAudioChunks.length === 0) return;

        try {
            // Combine all base64 chunks
            const combinedBase64 = this.pendingAudioChunks.join('');
            console.log('[VoiceLive] Combined audio size:', combinedBase64.length, 'bytes (base64)');

            // Convert base64 to binary
            const pcmData = this.base64ToArrayBuffer(combinedBase64);
            console.log('[VoiceLive] PCM data size:', pcmData.byteLength, 'bytes');

            // Create WAV header for PCM16, 24kHz, mono
            const wavHeader = this.createWavHeader(pcmData.byteLength, 24000, 1, 16);

            // Combine header and PCM data
            const wavBuffer = new Uint8Array(wavHeader.byteLength + pcmData.byteLength);
            wavBuffer.set(new Uint8Array(wavHeader), 0);
            wavBuffer.set(new Uint8Array(pcmData), wavHeader.byteLength);

            // Convert to base64 for file writing
            const wavBase64 = this.arrayBufferToBase64(wavBuffer.buffer);

            // Write to temp file
            const tempPath = FileSystem.cacheDirectory + `azure_audio_${Date.now()}.wav`;
            await FileSystem.writeAsStringAsync(tempPath, wavBase64, {
                encoding: FileSystem.EncodingType.Base64,
            });

            console.log('[VoiceLive] WAV file created:', tempPath);

            // Unload previous sound if any
            if (this.sound) {
                await this.sound.unloadAsync();
                this.sound = null;
            }

            // Play the audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: tempPath },
                { shouldPlay: true }
            );
            this.sound = sound;

            // Clean up when done
            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    console.log('[VoiceLive] Azure audio playback complete');
                    await sound.unloadAsync();
                    this.sound = null;
                    // Clean up temp file
                    await FileSystem.deleteAsync(tempPath, { idempotent: true });
                }
            });

        } catch (error) {
            console.error('[VoiceLive] Error playing Azure audio:', error);
            // Fallback to TTS if audio playback fails
            if (this.pendingResponseText.trim()) {
                console.log('[VoiceLive] Falling back to TTS');
                this.speakResponse(this.pendingResponseText);
            }
        }
    }

    /**
     * Create a WAV header for PCM audio data
     */
    private createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): ArrayBuffer {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        // "RIFF" chunk descriptor
        view.setUint8(0, 0x52); // R
        view.setUint8(1, 0x49); // I
        view.setUint8(2, 0x46); // F
        view.setUint8(3, 0x46); // F
        view.setUint32(4, 36 + dataLength, true); // File size - 8
        view.setUint8(8, 0x57);  // W
        view.setUint8(9, 0x41);  // A
        view.setUint8(10, 0x56); // V
        view.setUint8(11, 0x45); // E

        // "fmt " sub-chunk
        view.setUint8(12, 0x66); // f
        view.setUint8(13, 0x6D); // m
        view.setUint8(14, 0x74); // t
        view.setUint8(15, 0x20); // (space)
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
        view.setUint16(22, channels, true); // NumChannels
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true); // ByteRate
        view.setUint16(32, channels * bitsPerSample / 8, true); // BlockAlign
        view.setUint16(34, bitsPerSample, true); // BitsPerSample

        // "data" sub-chunk
        view.setUint8(36, 0x64); // d
        view.setUint8(37, 0x61); // a
        view.setUint8(38, 0x74); // t
        view.setUint8(39, 0x61); // a
        view.setUint32(40, dataLength, true); // Subchunk2Size

        return header;
    }

    /**
     * Start continuous listening mode
     * Records audio in short chunks and streams them continuously
     * Azure VAD will detect speech start/stop automatically
     */
    async startContinuousListening(): Promise<boolean> {
        if (this.isContinuousMode) return true;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.callbacks.onError?.('Not connected');
            return false;
        }

        console.log('[VoiceLive] Starting continuous listening mode...');
        this.isContinuousMode = true;

        // Start the continuous recording loop
        this.continuousRecordLoop();

        return true;
    }

    /**
     * Fallback: Continuous recording loop using expo-av
     * Used when expo-audio-studio is not available
     */
    private async continuousRecordLoop(): Promise<void> {
        if (!this.isContinuousMode || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[VoiceLive] Continuous mode stopped');
            return;
        }

        // Skip recording while AI is speaking (echo cancellation)
        if (this.isAISpeaking) {
            // Check again in 200ms
            setTimeout(() => this.continuousRecordLoop(), 200);
            return;
        }

        try {
            // Create a new recording for this chunk
            const recordingOptions: Audio.RecordingOptions = {
                android: {
                    extension: '.wav',
                    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
                    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 384000,
                },
                ios: {
                    extension: '.wav',
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 384000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            };

            this.recording = new Audio.Recording();
            await this.recording.prepareToRecordAsync(recordingOptions);
            await this.recording.startAsync();
            this.isRecording = true;

            // Record for 1.5 seconds then send
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (!this.isContinuousMode) {
                // Mode was stopped while recording
                if (this.recording) {
                    await this.recording.stopAndUnloadAsync();
                    this.recording = null;
                }
                return;
            }

            // Get the audio and send it
            const uri = this.recording.getURI();
            await this.recording.stopAndUnloadAsync();
            this.recording = null;
            this.isRecording = false;

            if (uri && this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Read the audio file as base64
                const audioBase64 = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                if (audioBase64.length > 100) {
                    // Convert base64 to ArrayBuffer to strip WAV header
                    const wavData = this.base64ToArrayBuffer(audioBase64);

                    // WAV header is 44 bytes - strip it to get raw PCM
                    // Azure expects raw PCM16 at 24kHz, not WAV
                    if (wavData.byteLength > 44) {
                        const pcmData = wavData.slice(44);
                        const pcmBase64 = this.arrayBufferToBase64(pcmData);

                        const event = {
                            type: 'input_audio_buffer.append',
                            audio: pcmBase64,
                        };
                        this.ws.send(JSON.stringify(event));
                        console.log('[VoiceLive] Sent PCM chunk:', pcmBase64.length, 'chars (from', wavData.byteLength, 'bytes WAV)');
                    }
                }

                // Clean up temp file
                await FileSystem.deleteAsync(uri, { idempotent: true });
            }

            // Continue the loop
            if (this.isContinuousMode) {
                // Small delay before next recording
                setTimeout(() => this.continuousRecordLoop(), 100);
            }

        } catch (error) {
            console.error('[VoiceLive] Continuous recording error:', error);
            // Try to continue on error
            if (this.isContinuousMode) {
                setTimeout(() => this.continuousRecordLoop(), 500);
            }
        }
    }

    /**
     * Stop continuous listening mode
     */
    async stopContinuousListening(): Promise<void> {
        console.log('[VoiceLive] Stopping continuous listening mode...');
        this.isContinuousMode = false;

        // Stop audio stream subscription if active
        if (this.audioStreamSubscription) {
            this.audioStreamSubscription.remove();
            this.audioStreamSubscription = null;
        }

        // Stop expo-av recording if active
        if (this.recording) {
            try {
                await this.recording.stopAndUnloadAsync();
            } catch (e) {
                // Ignore errors when stopping
            }
            this.recording = null;
        }
        this.isRecording = false;
    }

    /**
     * Start recording and streaming audio (manual push-to-talk mode)
     */
    async startStreaming(): Promise<boolean> {
        if (this.isRecording) return true;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.callbacks.onError?.('Not connected');
            return false;
        }

        try {
            // Configure recording options for PCM audio
            const recordingOptions: Audio.RecordingOptions = {
                android: {
                    extension: '.wav',
                    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
                    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 384000,
                },
                ios: {
                    extension: '.wav',
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 384000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            };

            this.recording = new Audio.Recording();
            await this.recording.prepareToRecordAsync(recordingOptions);

            // Set up audio streaming callback
            this.recording.setOnRecordingStatusUpdate((status) => {
                if (status.isRecording && status.metering !== undefined) {
                    // Audio level available for visualization
                }
            });

            await this.recording.startAsync();
            this.isRecording = true;

            // Start streaming audio data
            this.streamAudioLoop();

            console.log('[VoiceLive] Recording started');
            return true;
        } catch (error) {
            console.error('[VoiceLive] Error starting recording:', error);
            this.callbacks.onError?.('Failed to start recording');
            return false;
        }
    }

    /**
     * Stream audio data in a loop
     */
    private async streamAudioLoop(): Promise<void> {
        if (!this.isRecording || !this.recording) return;

        try {
            // Get the URI of the current recording
            const uri = this.recording.getURI();

            // In a production implementation, we would:
            // 1. Use a native module to get real-time PCM data
            // 2. Chunk it into frames
            // 3. Base64 encode and send via WebSocket

            // For now, we'll use a polling approach with expo-av
            // Note: This is not optimal - a native module would be better

            // Continue streaming loop
            if (this.isRecording) {
                setTimeout(() => this.streamAudioLoop(), 100);
            }
        } catch (error) {
            console.error('[VoiceLive] Audio streaming error:', error);
        }
    }

    /**
     * Send audio data to the WebSocket
     */
    private sendAudioData(audioData: ArrayBuffer): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Convert to base64 and send as input_audio_buffer.append
        const base64Audio = this.arrayBufferToBase64(audioData);

        const event = {
            type: 'input_audio_buffer.append',
            audio: base64Audio,
        };

        this.ws.send(JSON.stringify(event));
    }

    /**
     * Stop recording and streaming
     */
    async stopStreaming(): Promise<void> {
        if (!this.isRecording) return;

        try {
            this.isRecording = false;

            let audioUri: string | null = null;

            if (this.recording) {
                // Get the URI before stopping
                audioUri = this.recording.getURI();
                await this.recording.stopAndUnloadAsync();
                this.recording = null;
            }

            // Read the recorded audio file and send to Azure
            if (audioUri && this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log('[VoiceLive] Reading recorded audio from:', audioUri);

                try {
                    // Read the audio file as base64
                    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    console.log('[VoiceLive] Audio file size:', audioBase64.length, 'bytes (base64)');

                    // Send the audio data
                    const event = {
                        type: 'input_audio_buffer.append',
                        audio: audioBase64,
                    };
                    this.ws.send(JSON.stringify(event));
                    console.log('[VoiceLive] Audio sent to Azure');

                    // Clean up the temp file
                    await FileSystem.deleteAsync(audioUri, { idempotent: true });

                    // Since we're sending pre-recorded audio (not real-time streaming),
                    // we need to manually trigger response creation
                    // Note: Don't use input_audio_buffer.commit with VAD enabled
                    console.log('[VoiceLive] Requesting response...');
                    this.ws.send(JSON.stringify({ type: 'response.create' }));
                } catch (readError) {
                    console.error('[VoiceLive] Error reading audio file:', readError);
                }
            }

            console.log('[VoiceLive] Recording stopped');
        } catch (error) {
            console.error('[VoiceLive] Error stopping recording:', error);
        }
    }

    /**
     * Interrupt the current response
     */
    interrupt(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Cancel the current response
        this.ws.send(JSON.stringify({ type: 'response.cancel' }));

        // Clear the audio queue
        this.audioQueue = [];
        this.isPlayingAudio = false;

        console.log('[VoiceLive] Response interrupted');
    }

    /**
     * Send a text message (for testing or fallback)
     */
    sendTextMessage(text: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const event = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: text,
                    },
                ],
            },
        };

        this.ws.send(JSON.stringify(event));
        this.ws.send(JSON.stringify({ type: 'response.create' }));
    }

    /**
     * Handle disconnection
     */
    private handleDisconnect(): void {
        this.isRecording = false;
        this.recording = null;
        this.audioQueue = [];
        this.isPlayingAudio = false;

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[VoiceLive] Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        }
    }

    /**
     * Disconnect from Voice Live
     */
    async disconnect(): Promise<void> {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

        if (this.isRecording) {
            await this.stopStreaming();
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.connectionState = 'disconnected';
        this.callbacks.onConnectionChange?.(false);
        console.log('[VoiceLive] Disconnected');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<VoiceLiveConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Set the voice to use based on language
     * Uses Azure HD voices where available for better quality
     */
    setVoice(language: string): void {
        // Map language codes to Azure voice names (HD voices where available)
        // HD voices only supported in: eastus, eastus2, westus2, swedencentral, westeurope, southeastasia, centralindia
        const voiceMap: Record<string, { name: string; isHD: boolean }> = {
            'en': { name: 'en-US-AvaNeural', isHD: false },  // Standard voice
            'hi': { name: 'hi-IN-SwaraNeural', isHD: false },
            'ml': { name: 'ml-IN-SobhanaNeural', isHD: false },
            'ta': { name: 'ta-IN-PallaviNeural', isHD: false },
            'te': { name: 'te-IN-ShrutiNeural', isHD: false },
            'kn': { name: 'kn-IN-SapnaNeural', isHD: false },
            'mr': { name: 'mr-IN-AarohiNeural', isHD: false },
            'bn': { name: 'bn-IN-TanishaaNeural', isHD: false },
        };

        const voiceConfig = voiceMap[language] || voiceMap['en'];

        this.config.voice = {
            name: voiceConfig.name,
            type: 'azure-standard',
            temperature: 0.8,
        };
        this.config.language = language;

        console.log('[VoiceLive] Voice set to:', voiceConfig.name, voiceConfig.isHD ? '(HD)' : '');
    }

    /**
     * Get connection state
     */
    getConnectionState(): ConnectionState {
        return this.connectionState;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    // Utility functions
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}

// Export singleton instance
export const voiceLiveService = new VoiceLiveService();
export default voiceLiveService;
