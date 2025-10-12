import { Platform, Alert } from 'react-native';

export interface SpeechRecognitionService {
  requestPermissions(): Promise<boolean>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>;
  transcribeAudio(audioUri: string): Promise<string>;
  cleanup(): void;
  getSupportedLanguages(): string[];
  isCurrentlyRecording(): boolean;
}

export class NativeAzureSpeechService implements SpeechRecognitionService {
  private isRecording = false;
  private azureApiKey: string;
  private azureRegion: string;

  constructor(apiKey: string, region: string) {
    this.azureApiKey = apiKey;
    this.azureRegion = region;
    console.log('NativeAzureSpeechService initialized with fallback implementation');
  }

  async requestPermissions(): Promise<boolean> {
    try {
      console.log('Voice permissions requested (fallback mode)');
      return true; // Always return true for fallback
    } catch (error) {
      console.error('Error checking voice availability:', error);
      return false;
    }
  }

  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        console.warn('Recording is already in progress');
        return;
      }

      this.isRecording = true;
      console.log('Voice recording started (fallback mode)');
      
      // Show a simple alert for now
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Voice Recording',
          'Voice recording feature is temporarily disabled. Please use text input instead.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error starting voice recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string> {
    try {
      if (!this.isRecording) {
        throw new Error('No recording in progress');
      }

      this.isRecording = false;
      console.log('Voice recording stopped (fallback mode)');
      
      // Return empty string as fallback
      return '';
    } catch (error) {
      console.error('Error stopping voice recording:', error);
      throw error;
    }
  }

  async transcribeAudio(audioUri: string): Promise<string> {
    // Fallback implementation - return empty string
    console.warn('transcribeAudio called in fallback mode');
    return '';
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  cleanup(): void {
    try {
      this.isRecording = false;
      console.log('Voice service cleanup completed (fallback mode)');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  getSupportedLanguages(): string[] {
    return [
      'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN',
      'es-ES', 'es-MX', 'fr-FR', 'fr-CA', 'de-DE',
      'it-IT', 'pt-BR', 'pt-PT', 'ru-RU', 'ja-JP',
      'ko-KR', 'zh-CN', 'zh-TW', 'ar-SA', 'hi-IN',
      'th-TH', 'tr-TR', 'pl-PL', 'nl-NL', 'sv-SE',
      'da-DK', 'no-NO', 'fi-FI', 'cs-CZ', 'sk-SK',
      'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR', 'sl-SI',
      'et-EE', 'lv-LV', 'lt-LT', 'mt-MT', 'ga-IE',
      'cy-GB', 'eu-ES', 'ca-ES', 'gl-ES', 'is-IS',
      'mk-MK', 'sq-AL', 'sr-RS', 'bs-BA', 'me-ME',
      'te-IN', 'ta-IN', 'kn-IN', 'ml-IN', 'bn-IN',
      'gu-IN', 'mr-IN', 'pa-IN', 'or-IN', 'as-IN',
      'ur-PK', 'ne-NP', 'si-LK', 'my-MM', 'km-KH',
      'lo-LA', 'ka-GE', 'am-ET', 'sw-KE', 'zu-ZA',
      'af-ZA', 'xh-ZA', 'st-ZA', 'tn-ZA', 'nso-ZA',
      've-ZA', 'ts-ZA', 'ss-ZA', 'nr-ZA', 'rn-BI'
    ];
  }
}

export default NativeAzureSpeechService;