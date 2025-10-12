/**
 * Native Voice Service using react-native-nitro-sound
 * Provides speech-to-text functionality without expo-av dependency
 */

import Sound from 'react-native-nitro-sound';
import * as FileSystem from 'expo-file-system';
import { Platform, PermissionsAndroid } from 'react-native';

interface VoiceTranscriptionResult {
  transcript: string;
  confidence?: number;
  languageCode?: string;
}

interface RecordingConfig {
  sampleRate?: number;
  numberOfChannels?: number;
  bitRate?: number;
  format?: string;
}

class NativeVoiceService {
  private sound: Sound | null = null;
  private isRecording = false;
  private recordingPath: string = '';

  constructor() {
    this.sound = new Sound();
    this.requestPermissions();
  }

  private async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        
        const allPermissionsGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
        
        if (!allPermissionsGranted) {
          console.error('Audio permissions not granted');
        }
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
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

      if (!this.sound) {
        this.sound = new Sound();
      }

      // Generate a unique filename for the recording
      const timestamp = Date.now();
      this.recordingPath = `${FileSystem.documentDirectory}recording_${timestamp}.m4a`;

      await this.sound.startRecorder(this.recordingPath, {
        SampleRate: 22050,
        Channels: 1,
        AudioQuality: 'High',
        AudioEncoding: 'aac',
        AudioEncodingBitRate: 32000,
      });

      this.isRecording = true;
      console.log('Recording started:', this.recordingPath);
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording audio
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording || !this.sound) {
        console.warn('Not currently recording');
        return null;
      }

      const result = await this.sound.stopRecorder();
      this.isRecording = false;
      
      console.log('Recording stopped:', result);
      return this.recordingPath;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Transcribe audio using Azure Speech Service
   */
  async transcribe(audioUri: string): Promise<VoiceTranscriptionResult> {
    try {
      // Read the audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // For now, return a mock result since we need to implement the actual transcription service
      // This would typically call Azure Speech Service or another transcription API
      return {
        transcript: 'Mock transcription - implement actual service',
        confidence: 0.95,
        languageCode: 'en-US'
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  /**
   * Record and transcribe in one operation
   */
  async recordAndTranscribe(): Promise<VoiceTranscriptionResult> {
    try {
      await this.startRecording();
      
      // Wait for user to stop recording (this would be controlled by UI)
      // For now, we'll just wait a few seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const audioUri = await this.stopRecording();
      
      if (!audioUri) {
        throw new Error('No audio recorded');
      }
      
      return await this.transcribe(audioUri);
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isRecording && this.sound) {
        await this.sound.stopRecorder();
        this.isRecording = false;
      }
      
      if (this.sound) {
        // Clean up the sound instance if needed
        this.sound = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export type { VoiceTranscriptionResult, RecordingConfig };
export { NativeVoiceService };
export default NativeVoiceService;