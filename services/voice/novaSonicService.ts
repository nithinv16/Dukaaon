/**
 * Amazon Nova Sonic v1:0 Integration Service
 * Provides speech-to-text functionality using AWS Bedrock Nova Sonic model
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface NovaTranscriptionResult {
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

class NovaSonicService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  constructor() {
    this.configureAudio();
  }

  private async configureAudio() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
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

      // Create recording
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

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.recording = null;
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Transcribe audio using Amazon Nova Sonic
   */
  async transcribe(audioUri: string): Promise<NovaTranscriptionResult> {
    try {
      // Read audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get AWS credentials from environment
      const apiKey = process.env.EXPO_PUBLIC_AWS_BEDROCK_API_KEY;
      const region = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';

      if (!apiKey) {
        throw new Error('AWS Bedrock API key not configured');
      }

      // Decode the API key (it's base64 encoded)
      const decodedKey = atob(apiKey.split(':')[1] || apiKey);
      
      // Parse the key to get access key and secret
      const [accessKeyId, secretAccessKey] = decodedKey.split(':');

      // Call AWS Bedrock Nova Sonic model
      const response = await this.callNovaSonic(
        audioBase64,
        accessKeyId,
        secretAccessKey,
        region
      );

      return response;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  /**
   * Call Amazon Nova Sonic API
   */
  private async callNovaSonic(
    audioBase64: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<NovaTranscriptionResult> {
    try {
      // Import AWS SDK client
      const { BedrockRuntimeClient, InvokeModelCommand } = await import(
        '@aws-sdk/client-bedrock-runtime'
      );

      const client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Prepare request payload for Nova Sonic
      const payload = {
        audio: audioBase64,
        inputModality: 'AUDIO',
        outputModality: 'TEXT',
        audioConfig: {
          format: 'wav',
          sampleRate: 16000,
        },
        inferenceConfig: {
          temperature: 0.3,
          maxTokens: 1000,
        },
      };

      const command = new InvokeModelCommand({
        modelId: 'amazon.nova-sonic-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Extract transcript from response
      const transcript = responseBody.output?.text || responseBody.transcript || '';

      return {
        transcript: transcript.trim(),
        confidence: responseBody.confidence,
        languageCode: responseBody.languageCode || 'en-US',
      };
    } catch (error) {
      console.error('Error calling Nova Sonic API:', error);
      throw new Error(`Nova Sonic API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record and transcribe in one call
   */
  async recordAndTranscribe(): Promise<NovaTranscriptionResult> {
    try {
      await this.startRecording();
      
      // Wait for user to finish speaking (you might want to implement voice activity detection)
      // For now, the caller should handle when to stop
      
      return { transcript: '', confidence: 0 };
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
}

export type { NovaTranscriptionResult, RecordingConfig };
export { NovaSonicService };
export default NovaSonicService;
