/**
 * Real-time Voice Service for Conversational AI
 * Uses device's native speech recognition for real-time transcription
 * Uses expo-speech for text-to-speech responses
 * 
 * NOTE: This requires a native build (APK). Won't work in Expo Go.
 */

import Voice, {
    SpeechResultsEvent,
    SpeechErrorEvent,
    SpeechEndEvent,
    SpeechStartEvent,
    SpeechVolumeChangeEvent,
} from '@react-native-voice/voice';
import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';

export interface VoiceRecognitionResult {
    text: string;
    isFinal: boolean;
    partialResults?: string[];
}

export interface RealtimeVoiceServiceStatus {
    isListening: boolean;
    isSpeaking: boolean;
    isAvailable: boolean;
    volume?: number;
    error?: string;
}

type ResultCallback = (result: VoiceRecognitionResult) => void;
type ErrorCallback = (error: string) => void;
type StatusCallback = (status: RealtimeVoiceServiceStatus) => void;

class RealtimeVoiceService {
    private isListening = false;
    private isSpeaking = false;
    private isAvailable = false;
    private currentVolume = 0;
    private isNativeModuleAvailable = false;

    private onResultCallback: ResultCallback | null = null;
    private onErrorCallback: ErrorCallback | null = null;
    private onStatusCallback: StatusCallback | null = null;
    private partialResults: string[] = [];

    constructor() {
        this.initializeVoice();
    }

    /**
     * Initialize voice recognition callbacks
     */
    private async initializeVoice(): Promise<void> {
        try {
            // Check if Voice module is available (null in Expo Go)
            if (!Voice) {
                console.warn('[RealtimeVoiceService] Voice module not available (running in Expo Go?)');
                this.isAvailable = false;
                this.isNativeModuleAvailable = false;
                return;
            }

            this.isNativeModuleAvailable = true;

            // Check if voice recognition is available on device
            const isAvailable = await Voice.isAvailable();
            this.isAvailable = Boolean(isAvailable);

            if (!this.isAvailable) {
                console.warn('[RealtimeVoiceService] Voice recognition not available on this device');
                return;
            }

            // Set up event listeners
            Voice.onSpeechStart = this.onSpeechStart.bind(this);
            Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
            Voice.onSpeechResults = this.onSpeechResults.bind(this);
            Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
            Voice.onSpeechError = this.onSpeechError.bind(this);
            Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);

            console.log('[RealtimeVoiceService] Voice recognition initialized successfully');
        } catch (error) {
            console.error('[RealtimeVoiceService] Error initializing voice:', error);
            this.isAvailable = false;
            this.isNativeModuleAvailable = false;
        }
    }

    /**
     * Speech started callback
     */
    private onSpeechStart(event: SpeechStartEvent): void {
        console.log('[RealtimeVoiceService] Speech started');
        this.isListening = true;
        this.partialResults = [];
        this.notifyStatus();
    }

    /**
     * Speech ended callback
     */
    private onSpeechEnd(event: SpeechEndEvent): void {
        console.log('[RealtimeVoiceService] Speech ended');
        this.isListening = false;
        this.notifyStatus();
    }

    /**
     * Final speech results callback
     */
    private onSpeechResults(event: SpeechResultsEvent): void {
        const results = event.value || [];
        console.log('[RealtimeVoiceService] Final results:', results);

        if (results.length > 0) {
            const bestResult = results[0]; // First result is usually the best
            if (this.onResultCallback) {
                this.onResultCallback({
                    text: bestResult,
                    isFinal: true,
                    partialResults: results,
                });
            }
        }
    }

    /**
     * Partial speech results callback (real-time)
     */
    private onSpeechPartialResults(event: SpeechResultsEvent): void {
        const results = event.value || [];
        this.partialResults = results;

        if (results.length > 0 && this.onResultCallback) {
            this.onResultCallback({
                text: results[0],
                isFinal: false,
                partialResults: results,
            });
        }
    }

    /**
     * Speech error callback
     */
    private onSpeechError(event: SpeechErrorEvent): void {
        const errorMessage = event.error?.message || 'Speech recognition error';
        const errorCode = event.error?.code || '';

        // Check if this is an expected/normal error that should be handled gracefully
        const isExpectedError =
            errorMessage.includes('No match') ||
            errorMessage.includes('Didn\'t understand') ||
            errorMessage.includes('cancelled') ||
            errorMessage.includes('Cancelled') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('Timeout') ||
            errorCode === '5' ||  // ERROR_CLIENT (often from cancellation)
            errorCode === '7' ||  // ERROR_NO_MATCH
            errorCode === '13';   // ERROR_SPEECH_TIMEOUT or similar

        if (!isExpectedError) {
            console.error('[RealtimeVoiceService] Speech error:', event.error);
        } else {
            console.log('[RealtimeVoiceService] Speech ended:', errorMessage);
        }

        this.isListening = false;

        if (this.onErrorCallback) {
            this.onErrorCallback(errorMessage);
        }

        this.notifyStatus();
    }

    /**
     * Volume change callback (for visual feedback)
     */
    private onSpeechVolumeChanged(event: SpeechVolumeChangeEvent): void {
        this.currentVolume = event.value || 0;
        // Optionally notify status for volume visualization
        // this.notifyStatus();
    }

    /**
     * Notify status change
     */
    private notifyStatus(): void {
        if (this.onStatusCallback) {
            this.onStatusCallback({
                isListening: this.isListening,
                isSpeaking: this.isSpeaking,
                isAvailable: this.isAvailable,
                volume: this.currentVolume,
            });
        }
    }

    /**
     * Start listening for speech
     * @param language Language code (e.g., 'en-US', 'hi-IN', 'ml-IN')
     * @param onResult Callback for speech results
     * @param onError Callback for errors
     * @param onStatus Callback for status changes
     */
    async startListening(
        language: string = 'en-US',
        onResult?: ResultCallback,
        onError?: ErrorCallback,
        onStatus?: StatusCallback
    ): Promise<boolean> {
        try {
            if (!this.isAvailable) {
                const message = 'Voice recognition is not available on this device';
                console.error('[RealtimeVoiceService]', message);
                if (onError) onError(message);
                return false;
            }

            if (this.isListening) {
                console.warn('[RealtimeVoiceService] Already listening');
                return false;
            }

            // Stop any ongoing TTS
            if (this.isSpeaking) {
                await this.stopSpeaking();
            }

            // Set callbacks
            this.onResultCallback = onResult || null;
            this.onErrorCallback = onError || null;
            this.onStatusCallback = onStatus || null;

            // Map language codes to proper format
            const languageMap: Record<string, string> = {
                'en': 'en-US',
                'hi': 'hi-IN',
                'ml': 'ml-IN',
                'ta': 'ta-IN',
                'te': 'te-IN',
                'kn': 'kn-IN',
                'mr': 'mr-IN',
                'bn': 'bn-IN',
            };

            const recognitionLanguage = languageMap[language] || language;
            console.log('[RealtimeVoiceService] Starting with language:', recognitionLanguage);

            // Ensure Voice module is available
            if (!Voice) {
                throw new Error('Voice module not available. Please use a native build (APK).');
            }

            // Re-ensure event handlers are set (in case they were corrupted)
            if (typeof Voice.onSpeechStart !== 'function') {
                console.log('[RealtimeVoiceService] Re-initializing Voice event handlers...');
                Voice.onSpeechStart = this.onSpeechStart.bind(this);
                Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
                Voice.onSpeechResults = this.onSpeechResults.bind(this);
                Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
                Voice.onSpeechError = this.onSpeechError.bind(this);
                Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);
            }

            // Start voice recognition
            await Voice.start(recognitionLanguage);

            console.log('[RealtimeVoiceService] Voice recognition started');
            return true;
        } catch (error: any) {
            console.error('[RealtimeVoiceService] Error starting voice recognition:', error);

            // If it's an EventEmitter error, try to reinitialize and retry once
            if (error.message && error.message.includes('EventEmitter')) {
                console.log('[RealtimeVoiceService] Attempting to reinitialize Voice module...');
                try {
                    // Reinitialize handlers
                    Voice.onSpeechStart = this.onSpeechStart.bind(this);
                    Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
                    Voice.onSpeechResults = this.onSpeechResults.bind(this);
                    Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
                    Voice.onSpeechError = this.onSpeechError.bind(this);
                    Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);

                    const retryLanguageMap: Record<string, string> = {
                        'en': 'en-US', 'hi': 'hi-IN', 'ml': 'ml-IN', 'ta': 'ta-IN',
                        'te': 'te-IN', 'kn': 'kn-IN', 'mr': 'mr-IN', 'bn': 'bn-IN',
                    };
                    const recognitionLanguage = retryLanguageMap[language] || language;
                    await Voice.start(recognitionLanguage);
                    console.log('[RealtimeVoiceService] Voice recognition started after reinit');
                    return true;
                } catch (retryError) {
                    console.error('[RealtimeVoiceService] Retry also failed:', retryError);
                }
            }

            if (this.onErrorCallback) {
                this.onErrorCallback(error.message || 'Failed to start voice recognition');
            }

            return false;
        }
    }

    /**
     * Stop listening for speech
     */
    async stopListening(): Promise<string> {
        try {
            if (!this.isListening) {
                return '';
            }

            if (Voice) await Voice.stop();
            this.isListening = false;
            this.notifyStatus();

            // Return the last partial result if no final result was received
            const lastResult = this.partialResults[0] || '';
            console.log('[RealtimeVoiceService] Stopped, last result:', lastResult);

            return lastResult;
        } catch (error) {
            console.error('[RealtimeVoiceService] Error stopping voice recognition:', error);
            this.isListening = false;
            return '';
        }
    }

    /**
     * Cancel voice recognition
     */
    async cancel(): Promise<void> {
        try {
            if (Voice) await Voice.cancel();
            this.isListening = false;
            this.partialResults = [];
            this.notifyStatus();
            console.log('[RealtimeVoiceService] Voice recognition cancelled');
        } catch (error) {
            console.error('[RealtimeVoiceService] Error cancelling voice recognition:', error);
            this.isListening = false;
        }
    }

    /**
     * Speak text using TTS
     * @param text Text to speak
     * @param language Language for TTS
     */
    async speak(text: string, language: string = 'en'): Promise<void> {
        try {
            // Stop listening while speaking
            if (this.isListening) {
                await this.cancel();
            }

            this.isSpeaking = true;
            this.notifyStatus();

            // Map language codes to TTS language
            const languageMap: Record<string, string> = {
                'en': 'en-US',
                'hi': 'hi-IN',
                'ml': 'ml-IN',
                'ta': 'ta-IN',
                'te': 'te-IN',
                'kn': 'kn-IN',
                'mr': 'mr-IN',
                'bn': 'bn-IN',
            };

            const ttsLanguage = languageMap[language] || language;

            console.log('[RealtimeVoiceService] Speaking:', text.substring(0, 50) + '...');

            // Use expo-speech for TTS
            await new Promise<void>((resolve, reject) => {
                Speech.speak(text, {
                    language: ttsLanguage,
                    rate: 1.0,
                    pitch: 1.0,
                    onDone: () => {
                        this.isSpeaking = false;
                        this.notifyStatus();
                        resolve();
                    },
                    onError: (error) => {
                        this.isSpeaking = false;
                        this.notifyStatus();
                        reject(error);
                    },
                    onStopped: () => {
                        this.isSpeaking = false;
                        this.notifyStatus();
                        resolve();
                    },
                });
            });
        } catch (error) {
            console.error('[RealtimeVoiceService] Error speaking:', error);
            this.isSpeaking = false;
            this.notifyStatus();
        }
    }

    /**
     * Stop TTS
     */
    async stopSpeaking(): Promise<void> {
        try {
            await Speech.stop();
            this.isSpeaking = false;
            this.notifyStatus();
        } catch (error) {
            console.error('[RealtimeVoiceService] Error stopping speech:', error);
            this.isSpeaking = false;
        }
    }

    /**
     * Check if voice recognition is available
     */
    checkAvailability(): boolean {
        return this.isAvailable;
    }

    /**
     * Get current status
     */
    getStatus(): RealtimeVoiceServiceStatus {
        return {
            isListening: this.isListening,
            isSpeaking: this.isSpeaking,
            isAvailable: this.isAvailable,
            volume: this.currentVolume,
        };
    }

    /**
     * Get available languages for recognition
     */
    async getAvailableLanguages(): Promise<string[]> {
        try {
            const services = await Voice.getSpeechRecognitionServices();
            console.log('[RealtimeVoiceService] Available services:', services);

            // Return common languages for Indian users
            return [
                'en-US', 'en-IN',
                'hi-IN', 'ml-IN', 'ta-IN', 'te-IN', 'kn-IN', 'mr-IN', 'bn-IN',
            ];
        } catch (error) {
            console.error('[RealtimeVoiceService] Error getting languages:', error);
            return ['en-US'];
        }
    }

    /**
     * Cleanup when service is no longer needed
     * Note: This is a singleton, so we don't fully destroy - just stop current operations
     */
    async destroy(): Promise<void> {
        try {
            await this.cancel();
            await this.stopSpeaking();

            // Clear callbacks but keep the Voice module intact since this is a singleton
            this.onResultCallback = null;
            this.onErrorCallback = null;
            this.onStatusCallback = null;
            this.partialResults = [];

            console.log('[RealtimeVoiceService] Voice service cleaned up');
        } catch (error) {
            console.error('[RealtimeVoiceService] Error cleaning up voice service:', error);
        }
    }
}

// Export singleton instance
export const realtimeVoiceService = new RealtimeVoiceService();
export default realtimeVoiceService;
