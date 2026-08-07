/**
 * Native Voice Service for React Native
 * Uses @react-native-voice/voice for real-time speech recognition
 * Uses expo-speech for text-to-speech
 * 
 * This provides a ChatGPT/Claude-like conversational voice experience
 */

import * as Speech from 'expo-speech';
import { Platform, Alert } from 'react-native';
import { VOICE_CONFIG } from '../../config/awsBedrock';
import { realtimeVoiceService, VoiceRecognitionResult, RealtimeVoiceServiceStatus } from './realtimeVoiceService';

export interface SpeechRecognitionResult {
  text: string;
  confidence?: number;
  isFinal: boolean;
  partialResults?: string[];
}

export interface NativeVoiceServiceStatus {
  isListening: boolean;
  isSpeaking: boolean;
  isAvailable: boolean;
  error?: string;
}

type SpeechResultCallback = (result: SpeechRecognitionResult) => void;
type SpeechErrorCallback = (error: string) => void;

class NativeVoiceService {
  private isListening = false;
  private isSpeaking = false;
  private onResultCallback: SpeechResultCallback | null = null;
  private onErrorCallback: SpeechErrorCallback | null = null;

  constructor() {
    console.log('[NativeVoiceService] Initialized with realtime voice recognition');
  }

  /**
   * Start listening for speech (uses device's native speech recognition)
   */
  async startListening(
    language: string = 'en-US',
    onResult?: SpeechResultCallback,
    onError?: SpeechErrorCallback
  ): Promise<boolean> {
    try {
      if (this.isListening) {
        console.warn('[NativeVoiceService] Already listening');
        return false;
      }

      // Check if voice recognition is available
      if (!realtimeVoiceService.checkAvailability()) {
        const errorMsg = 'Voice recognition requires a native build (APK). Please type your message instead.';
        console.warn('[NativeVoiceService]', errorMsg);
        if (onError) onError(errorMsg);
        return false;
      }

      // Stop any ongoing TTS
      if (this.isSpeaking) {
        await this.stopSpeaking();
      }

      this.onResultCallback = onResult || null;
      this.onErrorCallback = onError || null;

      console.log('[NativeVoiceService] Starting speech recognition, language:', language);

      // Use the realtime voice service for native speech recognition
      const started = await realtimeVoiceService.startListening(
        language,
        (result: VoiceRecognitionResult) => {
          console.log('[NativeVoiceService] Recognition result:', result.text, 'isFinal:', result.isFinal);

          if (this.onResultCallback) {
            this.onResultCallback({
              text: result.text,
              isFinal: result.isFinal,
              partialResults: result.partialResults,
              confidence: result.isFinal ? 0.9 : 0.7,
            });
          }
        },
        (error: string) => {
          // Check if this is an expected/normal error
          const isExpectedError =
            error.includes('No match') ||
            error.includes('Didn\'t understand') ||
            error.includes('cancelled') ||
            error.includes('Cancelled') ||
            error.includes('timeout');

          if (!isExpectedError) {
            console.error('[NativeVoiceService] Recognition error:', error);
          } else {
            console.log('[NativeVoiceService] Recognition ended:', error);
          }

          this.isListening = false;

          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
        },
        (status: RealtimeVoiceServiceStatus) => {
          this.isListening = status.isListening;
          this.isSpeaking = status.isSpeaking;
        }
      );

      if (started) {
        this.isListening = true;
        console.log('[NativeVoiceService] Speech recognition started');
        return true;
      } else {
        console.error('[NativeVoiceService] Failed to start speech recognition');
        return false;
      }
    } catch (error: any) {
      console.error('[NativeVoiceService] Error starting speech recognition:', error);
      this.isListening = false;

      if (this.onErrorCallback) {
        this.onErrorCallback(error.message || 'Failed to start speech recognition');
      }

      return false;
    }
  }

  /**
   * Stop listening and get the final transcription
   */
  async stopListening(): Promise<string> {
    try {
      if (!this.isListening) {
        return '';
      }

      console.log('[NativeVoiceService] Stopping speech recognition');
      const result = await realtimeVoiceService.stopListening();
      this.isListening = false;

      console.log('[NativeVoiceService] Final result:', result);
      return result;
    } catch (error) {
      console.error('[NativeVoiceService] Error stopping speech recognition:', error);
      this.isListening = false;
      return '';
    }
  }

  /**
   * Cancel speech recognition
   */
  async cancel(): Promise<void> {
    try {
      await realtimeVoiceService.cancel();
      this.isListening = false;
      this.onResultCallback = null;
      this.onErrorCallback = null;
      console.log('[NativeVoiceService] Speech recognition cancelled');
    } catch (error) {
      console.error('[NativeVoiceService] Error cancelling:', error);
      this.isListening = false;
    }
  }

  /**
   * Speak text using TTS
   */
  async speak(text: string, language: string = 'en'): Promise<void> {
    try {
      // Stop listening while speaking
      if (this.isListening) {
        await this.cancel();
      }

      console.log('[NativeVoiceService] Speaking:', text.substring(0, 50) + '...');
      this.isSpeaking = true;

      await realtimeVoiceService.speak(text, language);

      this.isSpeaking = false;
    } catch (error) {
      console.error('[NativeVoiceService] Error speaking:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Stop TTS
   */
  async stopSpeaking(): Promise<void> {
    try {
      await realtimeVoiceService.stopSpeaking();
      this.isSpeaking = false;
    } catch (error) {
      console.error('[NativeVoiceService] Error stopping speech:', error);
      this.isSpeaking = false;
    }
  }

  /**
   * Check if voice recognition is available
   */
  isAvailable(): boolean {
    return realtimeVoiceService.checkAvailability();
  }

  /**
   * Get current status
   */
  getStatus(): NativeVoiceServiceStatus {
    const status = realtimeVoiceService.getStatus();
    return {
      isListening: status.isListening,
      isSpeaking: status.isSpeaking,
      isAvailable: status.isAvailable,
    };
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  /**
   * Check if currently speaking
   */
  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await realtimeVoiceService.destroy();
    this.isListening = false;
    this.isSpeaking = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
  }
}

// Singleton instance
const nativeVoiceServiceInstance = new NativeVoiceService();

// Backward compatible exports
export const nativeVoiceService = nativeVoiceServiceInstance;
export const getNativeVoiceService = () => nativeVoiceServiceInstance;
export { NativeVoiceService };
export default nativeVoiceServiceInstance;