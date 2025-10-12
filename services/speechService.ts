import { Platform } from 'react-native';
import AzureSpeechService, { SpeechToTextResult, VoiceSearchResult } from './azureAI/speechService';

// Unified interfaces
interface UnifiedSpeechToTextResult {
  text: string;
  confidence: number;
  language: string;
  isInterim?: boolean;
  provider: 'azure';
}

interface UnifiedVoiceSearchResult {
  searchQuery: string;
  intent: 'search' | 'order' | 'navigate' | 'unknown';
  entities: {
    productName?: string;
    quantity?: number;
    category?: string;
    brand?: string;
  };
  provider: 'azure';
}

interface UnifiedTextToSpeechResult {
  audioData?: Uint8Array;
  audioUrl?: string;
  contentType?: string;
  success: boolean;
  provider: 'azure';
}

interface UnifiedVoiceInfo {
  id: string;
  name: string;
  gender?: string;
  language: string;
  languageCode: string;
  provider: 'azure';
}

interface SpeechServiceConfig {
  azureEnabled: boolean;
}

class UnifiedSpeechService {
  private config: SpeechServiceConfig;
  private azureService: any;

  constructor(config: Partial<SpeechServiceConfig> = {}) {
    this.config = {
      azureEnabled: true,
      ...config
    };

    // Initialize Azure service
    this.azureService = AzureSpeechService;
    
    console.log('Unified Speech Service initialized with Azure provider');
  }

  /**
   * Convert speech to text using Azure
   * @param audioUri - Audio file URI or language code (for real-time)
   * @param language - Language code
   * @returns Promise<UnifiedSpeechToTextResult>
   */
  async speechToText(audioUri?: string, language: string = 'en-US'): Promise<UnifiedSpeechToTextResult> {
    try {
      const result = await this.azureService.speechToText(language);
      return this.normalizeSTTResult(result);
    } catch (error) {
      console.error('Speech to text failed with Azure:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech using Azure
   * @param text - Text to convert
   * @param language - Language code
   * @param voiceName - Voice name (optional)
   * @returns Promise<UnifiedTextToSpeechResult>
   */
  async textToSpeech(
    text: string, 
    language: string = 'en-US', 
    voiceName?: string
  ): Promise<UnifiedTextToSpeechResult> {
    try {
      const result = await this.azureService.textToSpeech(text, language, voiceName);
      return this.normalizeTTSResult(result);
    } catch (error) {
      console.error('Text to speech failed with Azure:', error);
      throw error;
    }
  }

  /**
   * Perform voice search with intent recognition
   * @param language - Language code
   * @returns Promise<UnifiedVoiceSearchResult>
   */
  async voiceSearch(language: string = 'en-US'): Promise<UnifiedVoiceSearchResult> {
    try {
      const result = await this.azureService.voiceSearch(language);
      return this.normalizeVoiceSearchResult(result);
    } catch (error) {
      console.error('Voice search failed with Azure:', error);
      throw error;
    }
  }

  /**
   * Start continuous speech recognition
   * @param language - Language code
   * @param onResult - Callback for results
   * @param onError - Callback for errors
   * @returns Promise<any> - Recognizer instance
   */
  async startContinuousRecognition(
    language: string,
    onResult: (result: UnifiedSpeechToTextResult) => void,
    onError: (error: Error) => void
  ): Promise<any> {
    try {
      return await this.azureService.startContinuousRecognition(
        language,
        (result: any) => onResult(this.normalizeSTTResult(result)),
        onError
      );
    } catch (error) {
      console.error('Continuous recognition failed with Azure:', error);
      throw error;
    }
  }

  /**
   * Stop continuous speech recognition
   * @param recognizer - Recognizer instance
   */
  async stopContinuousRecognition(recognizer: any): Promise<void> {
    try {
      await this.azureService.stopContinuousRecognition(recognizer);
    } catch (error) {
      console.error('Failed to stop continuous recognition:', error);
      throw error;
    }
  }

  /**
   * Get available voices for text-to-speech
   * @param language - Language code (optional)
   * @returns Promise<UnifiedVoiceInfo[]>
   */
  async getAvailableVoices(language?: string): Promise<UnifiedVoiceInfo[]> {
    try {
      const voices = await this.azureService.getAvailableVoices(language);
      return voices.map((voice: any) => ({
        ...voice,
        provider: 'azure' as const
      }));
    } catch (error) {
      console.error('Failed to get available voices:', error);
      throw error;
    }
  }

  /**
   * Check if speech services are available
   * @returns Promise<boolean>
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.azureService.isAvailable();
    } catch (error) {
      console.error('Failed to check service availability:', error);
      return false;
    }
  }

  /**
   * Get supported languages for speech-to-text
   * @returns Promise<string[]>
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      return await this.azureService.getSupportedLanguages();
    } catch (error) {
      console.error('Failed to get supported languages:', error);
      return ['en-US']; // Default fallback
    }
  }

  /**
   * Normalize speech-to-text result
   * @param result - Raw result from Azure
   * @returns UnifiedSpeechToTextResult
   */
  private normalizeSTTResult(result: any): UnifiedSpeechToTextResult {
    return {
      text: result.text || '',
      confidence: result.confidence || 0,
      language: result.language || 'en-US',
      isInterim: result.isInterim || false,
      provider: 'azure'
    };
  }

  /**
   * Normalize text-to-speech result
   * @param result - Raw result from Azure
   * @returns UnifiedTextToSpeechResult
   */
  private normalizeTTSResult(result: any): UnifiedTextToSpeechResult {
    return {
      audioData: result.audioData,
      audioUrl: result.audioUrl,
      contentType: result.contentType || 'audio/wav',
      success: result.success || false,
      provider: 'azure'
    };
  }

  /**
   * Normalize voice search result
   * @param result - Raw result from Azure
   * @returns UnifiedVoiceSearchResult
   */
  private normalizeVoiceSearchResult(result: any): UnifiedVoiceSearchResult {
    return {
      searchQuery: result.searchQuery || '',
      intent: result.intent || 'unknown',
      entities: result.entities || {},
      provider: 'azure'
    };
  }

  /**
   * Update configuration
   * @param newConfig - New configuration options
   */
  updateConfig(newConfig: Partial<SpeechServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Speech service configuration updated:', this.config);
  }

  /**
   * Get current configuration
   * @returns SpeechServiceConfig
   */
  getConfig(): SpeechServiceConfig {
    return { ...this.config };
  }

  /**
   * Get service health status
   * @returns Promise<{ azure: boolean }>
   */
  async getServiceHealth(): Promise<{ azure: boolean }> {
    try {
      const azureHealth = await this.azureService.isAvailable();
      return { azure: azureHealth };
    } catch (error) {
      console.error('Failed to check service health:', error);
      return { azure: false };
    }
  }
}

// Export singleton instance
const speechService = new UnifiedSpeechService();
export default speechService;

// Export types
export type {
  UnifiedSpeechToTextResult,
  UnifiedVoiceSearchResult,
  UnifiedTextToSpeechResult,
  UnifiedVoiceInfo,
  SpeechServiceConfig
};