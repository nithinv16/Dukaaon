/**
 * React Native Compatible Azure Speech Service
 * Uses Expo Audio for recording and Azure REST API for recognition
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AZURE_AI_CONFIG } from '../../config/azureAI';

interface SpeechToTextResult {
  text: string;
  confidence: number;
  language: string;
}

class ReactNativeSpeechService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  constructor() {
    this.configureAudio();
  }

  private async configureAudio() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        console.log('Audio permissions granted and configured');
      } else {
        console.error('Audio permissions not granted');
      }
    } catch (error) {
      console.error('Error configuring audio:', error);
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        console.warn('Already recording');
        return;
      }

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio recording permission not granted');
      }

      console.log('Starting audio recording...');
      
      // Create and configure recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      this.recording = recording;
      this.isRecording = true;
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return audio file URI
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.warn('No active recording');
        return null;
      }

      console.log('Stopping recording...');
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;
      
      console.log('Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.recording = null;
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Transcribe audio using Azure Speech REST API
   */
  async transcribeAudio(audioUri: string, language: string = 'en-US'): Promise<SpeechToTextResult> {
    try {
      console.log('Reading audio file...');
      
      // Read audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to binary
      const audioData = this.base64ToArrayBuffer(audioBase64);

      console.log('Calling Azure Speech REST API...');
      console.log('Language:', language);
      console.log('Audio size:', audioData.byteLength, 'bytes');

      // Call Azure Speech REST API
      const endpoint = `https://${AZURE_AI_CONFIG.speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
      const url = `${endpoint}?language=${language}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_AI_CONFIG.speechKey,
          'Content-Type': 'audio/wav',
          'Accept': 'application/json',
        },
        body: audioData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure Speech API error:', response.status, errorText);
        throw new Error(`Azure Speech API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Azure Speech API response:', result);

      if (result.RecognitionStatus === 'Success') {
        return {
          text: result.DisplayText || '',
          confidence: result.Confidence || 0,
          language: language,
        };
      } else {
        throw new Error(`Recognition failed: ${result.RecognitionStatus}`);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  /**
   * Record and transcribe in one call
   */
  async recordAndTranscribe(language: string = 'en-US'): Promise<SpeechToTextResult> {
    try {
      // Start recording
      await this.startRecording();
      
      // Wait for user to stop (caller should call stopRecording)
      // This is a manual process, return empty for now
      return {
        text: '',
        confidence: 0,
        language,
      };
    } catch (error) {
      console.error('Error in recordAndTranscribe:', error);
      throw error;
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.recording && this.isRecording) {
      try {
        await this.stopRecording();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  }

  /**
   * Helper: Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): { [key: string]: string } {
    return {
      'en-US': 'English (US)',
      'en-IN': 'English (India)',
      'hi-IN': 'Hindi (India)',
      'ta-IN': 'Tamil (India)',
      'te-IN': 'Telugu (India)',
      'kn-IN': 'Kannada (India)',
      'ml-IN': 'Malayalam (India)',
      'gu-IN': 'Gujarati (India)',
      'mr-IN': 'Marathi (India)',
      'bn-IN': 'Bengali (India)',
      'pa-IN': 'Punjabi (India)',
      'or-IN': 'Odia (India)',
      'as-IN': 'Assamese (India)',
      'ur-IN': 'Urdu (India)'
    };
  }
}

// Export singleton instance
let speechServiceInstance: ReactNativeSpeechService | null = null;

export const getReactNativeSpeechService = (): ReactNativeSpeechService => {
  if (!speechServiceInstance) {
    speechServiceInstance = new ReactNativeSpeechService();
  }
  return speechServiceInstance;
};

export default getReactNativeSpeechService();
export type { SpeechToTextResult };
