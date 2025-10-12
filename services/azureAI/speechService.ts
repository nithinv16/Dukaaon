import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { Platform } from 'react-native';
import { AZURE_AI_CONFIG } from '../../config/azureAI';

interface SpeechToTextResult {
  text: string;
  confidence: number;
  language: string;
}

interface VoiceSearchResult {
  searchQuery: string;
  intent: 'search' | 'order' | 'navigate' | 'unknown';
  entities: {
    productName?: string;
    quantity?: number;
    category?: string;
    brand?: string;
  };
}

class AzureSpeechService {
  private speechConfig: sdk.SpeechConfig | null;
  private audioConfig: sdk.AudioConfig | null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.speechConfig = null;
    this.audioConfig = null;
    
    // Start initialization immediately but handle it asynchronously
    this.initializationPromise = this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Delay slightly to ensure crypto polyfills are loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Check if crypto.getRandomValues is available
      if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        throw new Error('crypto.getRandomValues() not supported. Please ensure react-native-get-random-values is properly imported.');
      }

      // Validate Azure Speech configuration
      if (!AZURE_AI_CONFIG.speechKey || AZURE_AI_CONFIG.speechKey.trim() === '') {
        throw new Error('Azure Speech Service key is missing. Please add EXPO_PUBLIC_AZURE_SPEECH_KEY to your .env file.');
      }
      
      if (!AZURE_AI_CONFIG.speechRegion || AZURE_AI_CONFIG.speechRegion.trim() === '') {
        throw new Error('Azure Speech Service region is missing. Please add EXPO_PUBLIC_AZURE_SPEECH_REGION to your .env file.');
      }

      console.log('Azure Speech Service Configuration:');
      console.log('- Region:', AZURE_AI_CONFIG.speechRegion);
      console.log('- Speech Endpoint:', AZURE_AI_CONFIG.speechEndpoint);
      console.log('- AI Services Endpoint:', AZURE_AI_CONFIG.aiServicesEndpoint);
      console.log('- Key configured:', !!AZURE_AI_CONFIG.speechKey);
      console.log('- Crypto available:', typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function');

      // Use standard subscription-based configuration for Azure Speech Service
      if (AZURE_AI_CONFIG.speechKey && AZURE_AI_CONFIG.speechRegion) {
        console.log('Using subscription-based configuration for Azure Speech Service');
        this.speechConfig = sdk.SpeechConfig.fromSubscription(
          AZURE_AI_CONFIG.speechKey,
          AZURE_AI_CONFIG.speechRegion
        );
      } else {
        throw new Error('Azure Speech Service key and region are required');
      }
      
      // Set default language and other configurations
      if (this.speechConfig) {
        this.speechConfig.speechRecognitionLanguage = AZURE_AI_CONFIG.speechRecognition.defaultLanguage;
        this.speechConfig.enableDictation();
      }
      
      // For React Native, we need to use fromDefaultMicrophoneInput carefully
      try {
        this.audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
        console.log('Audio config created successfully');
      } catch (audioError) {
        console.error('Failed to create audio config:', audioError);
        // Try alternative audio configuration for React Native
        this.audioConfig = null;
        console.warn('Will create audio config per recognizer instead');
      }
      
      this.isInitialized = true;
      
      console.log('Azure Speech Service initialized successfully');
      console.log('Speech config available:', !!this.speechConfig);
      console.log('Audio config available:', !!this.audioConfig);
    } catch (error) {
      console.error('Failed to initialize Azure Speech Service:', error);
      this.isInitialized = false;
      
      // Provide specific error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('crypto.getRandomValues')) {
          throw new Error('Failed to initialize Azure Speech Service: crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
        }
      }
      
      throw new Error(`Failed to initialize Azure Speech Service: ${error}`);
    }
  }

  /**
   * Ensure the service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    
    if (!this.isInitialized || !this.speechConfig) {
      throw new Error('Azure Speech Service is not initialized. Please check your configuration.');
    }
  }

  /**
   * Convert speech to text with language detection
   */
  async speechToText(language: string = 'en-US'): Promise<SpeechToTextResult> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.speechConfig || !this.audioConfig) {
        reject(new Error('Speech service not initialized'));
        return;
      }
      
      this.speechConfig.speechRecognitionLanguage = language;
      const recognizer = new sdk.SpeechRecognizer(this.speechConfig, this.audioConfig);

      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            const confidenceValue = result.properties?.getProperty('Speech.Recognition.Confidence');
            const confidence = typeof confidenceValue === 'number' ? confidenceValue : parseFloat(confidenceValue || '0');
            resolve({
              text: result.text,
              confidence,
              language: language
            });
          } else {
            reject(new Error(`Speech recognition failed: ${result.errorDetails}`));
          }
          recognizer.close();
        },
        (error) => {
          reject(new Error(`Speech recognition error: ${error}`));
          recognizer.close();
        }
      );
    });
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(text: string, language: string = 'en-US', voiceName?: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      if (!this.speechConfig) {
        reject(new Error('Speech service not initialized'));
        return;
      }
      
      this.speechConfig.speechSynthesisLanguage = language;
      if (voiceName) {
        this.speechConfig.speechSynthesisVoiceName = voiceName;
      }

      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve();
          } else {
            reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
          }
          synthesizer.close();
        },
        (error) => {
          reject(new Error(`Speech synthesis error: ${error}`));
          synthesizer.close();
        }
      );
    });
  }

  /**
   * Enhanced voice search with intent recognition
   */
  async voiceSearch(language: string = 'en-US'): Promise<VoiceSearchResult> {
    try {
      const speechResult = await this.speechToText(language);
      const processedResult = await this.processVoiceCommand(speechResult.text, language);
      
      return {
        searchQuery: speechResult.text,
        intent: processedResult.intent,
        entities: processedResult.entities
      };
    } catch (error) {
      console.error('Voice search failed:', error);
      throw error;
    }
  }

  /**
   * Process voice command to extract intent and entities
   */
  async processVoiceCommand(text: string, language: string = 'en-US'): Promise<{
    intent: 'search' | 'order' | 'navigate' | 'unknown';
    entities: any;
  }> {
    const lowerText = text.toLowerCase();
    
    // Intent detection patterns
    const orderPatterns = [
      /(?:order|buy|purchase|add to cart)\s+(.+)/i,
      /(?:i want|i need)\s+(.+)/i,
      /(?:get me|bring me)\s+(.+)/i
    ];
    
    const searchPatterns = [
      /(?:search for|find|look for|show me)\s+(.+)/i,
      /(?:where is|where can i find)\s+(.+)/i
    ];
    
    const navigationPatterns = [
      /(?:go to|navigate to|open)\s+(.+)/i,
      /(?:show|display)\s+(.+)\s+(?:page|section)/i
    ];

    // Extract entities
    const entities: any = {};
    
    // Extract quantity
    const quantityMatch = text.match(/(\d+)\s*(?:pieces?|items?|kg|grams?|liters?|bottles?)?/i);
    if (quantityMatch) {
      entities.quantity = parseInt(quantityMatch[1]);
    }

    // Check for order intent
    for (const pattern of orderPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.productName = match[1].trim();
        return { intent: 'order', entities };
      }
    }

    // Check for search intent
    for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.productName = match[1].trim();
        return { intent: 'search', entities };
      }
    }

    // Check for navigation intent
    for (const pattern of navigationPatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.target = match[1].trim();
        return { intent: 'navigate', entities };
      }
    }

    // Default to search if no specific intent detected
    entities.productName = text.trim();
    return { intent: 'search', entities };
  }

  /**
   * Get supported languages for speech recognition
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

  /**
   * Get voice names for text-to-speech
   */
  getVoiceNames(language: string): string[] {
    const voiceMap: { [key: string]: string[] } = {
      'en-US': ['en-US-JennyNeural', 'en-US-GuyNeural'],
      'en-IN': ['en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
      'hi-IN': ['hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
      'ta-IN': ['ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'],
      'te-IN': ['te-IN-ShrutiNeural', 'te-IN-MohanNeural'],
      'kn-IN': ['kn-IN-SapnaNeural', 'kn-IN-GaganNeural'],
      'ml-IN': ['ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'],
      'gu-IN': ['gu-IN-DhwaniNeural', 'gu-IN-NiranjanNeural'],
      'mr-IN': ['mr-IN-AarohiNeural', 'mr-IN-ManoharNeural'],
      'bn-IN': ['bn-IN-TanishaaNeural', 'bn-IN-BashkarNeural'],
      'pa-IN': ['pa-IN-LatikaNeuralNeural', 'pa-IN-HarpreetNeural'],
      'or-IN': ['or-IN-SubhasiniNeural', 'or-IN-SukantNeural'],
      'as-IN': ['as-IN-YasminNeural', 'as-IN-RanjanNeural'],
      'ur-IN': ['ur-IN-GulNeural', 'ur-IN-SalmanNeural']
    };
    
    return voiceMap[language] || voiceMap['en-US'];
  }

  /**
   * Continuous speech recognition for real-time voice commands
   */
  async startContinuousRecognition(
    language: string,
    onResult: (result: SpeechToTextResult) => void,
    onError: (error: string) => void
  ): Promise<sdk.SpeechRecognizer> {
    await this.ensureInitialized();
    
    if (!this.speechConfig) {
      const error = 'Speech config not initialized';
      console.error(error);
      onError(error);
      throw new Error(error);
    }
    
    // Validate and ensure language is not null or empty
    const validLanguage = language && language.trim() !== '' ? language : AZURE_AI_CONFIG.speechRecognition.defaultLanguage;
    console.log('Starting continuous recognition with language:', validLanguage);
    
    // Clone the config to avoid modifying the shared instance
    const sessionConfig = sdk.SpeechConfig.fromSubscription(
      AZURE_AI_CONFIG.speechKey,
      AZURE_AI_CONFIG.speechRegion
    );
    sessionConfig.speechRecognitionLanguage = validLanguage;
    sessionConfig.enableDictation();
    
    // Create audio config for this session
    let audioConfig: sdk.AudioConfig;
    try {
      audioConfig = this.audioConfig || sdk.AudioConfig.fromDefaultMicrophoneInput();
      console.log('Using audio config for recognition');
    } catch (error) {
      console.error('Failed to create audio config:', error);
      const errorMsg = 'Failed to access microphone. Please check permissions.';
      onError(errorMsg);
      throw new Error(errorMsg);
    }
    
    const recognizer = new sdk.SpeechRecognizer(sessionConfig, audioConfig);
    console.log('Speech recognizer created successfully');

    // Handle interim results for live transcription
    recognizer.recognizing = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
        onResult({
          text: e.result.text,
          confidence: 0.5, // Lower confidence for interim results
          language: language
        });
      }
    };

    // Handle final results
    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        onResult({
          text: e.result.text,
          confidence: parseFloat(e.result.properties?.getProperty('Speech.Recognition.Confidence') || '0'),
          language: language
        });
      }
    };

    recognizer.canceled = (s, e) => {
      console.log('Recognition canceled:', e.reason);
      if (e.reason === sdk.CancellationReason.Error) {
        console.error('Recognition error:', e.errorDetails);
        onError(`Recognition canceled: ${e.errorDetails}`);
      } else {
        console.log('Recognition canceled normally');
      }
      recognizer.stopContinuousRecognitionAsync();
    };

    recognizer.sessionStarted = (s, e) => {
      console.log('Speech recognition session started');
    };

    recognizer.sessionStopped = (s, e) => {
      console.log('Speech recognition session stopped');
    };

    recognizer.speechStartDetected = (s, e) => {
      console.log('Speech start detected');
    };

    recognizer.speechEndDetected = (s, e) => {
      console.log('Speech end detected');
    };

    console.log('Starting continuous recognition async...');
    recognizer.startContinuousRecognitionAsync(
      () => {
        console.log('Continuous recognition started successfully');
      },
      (error) => {
        console.error('Failed to start continuous recognition:', error);
        onError(`Failed to start recognition: ${error}`);
      }
    );
    
    return recognizer;
  }

  /**
   * Stop continuous recognition
   */
  stopContinuousRecognition(recognizer: sdk.SpeechRecognizer): void {
    recognizer.stopContinuousRecognitionAsync();
    recognizer.close();
  }
}

// Export a singleton instance with lazy initialization
let speechServiceInstance: AzureSpeechService | null = null;

export const getAzureSpeechService = (): AzureSpeechService => {
  if (!speechServiceInstance) {
    speechServiceInstance = new AzureSpeechService();
  }
  return speechServiceInstance;
};

// For backward compatibility
export default {
  get instance() {
    return getAzureSpeechService();
  },
  // Proxy all methods to the singleton instance
  speechToText: async (language?: string) => getAzureSpeechService().speechToText(language),
  textToSpeech: async (text: string, language?: string, voiceName?: string) => 
    getAzureSpeechService().textToSpeech(text, language, voiceName),
  voiceSearch: async (language?: string) => getAzureSpeechService().voiceSearch(language),
  startContinuousRecognition: async (language: string, onResult: any, onError: any) => 
    getAzureSpeechService().startContinuousRecognition(language, onResult, onError),
  stopContinuousRecognition: async (recognizer: any) => 
    getAzureSpeechService().stopContinuousRecognition(recognizer),
  getVoiceNames: (language: string) => getAzureSpeechService().getVoiceNames(language),
  processVoiceCommand: (text: string, language?: string) => 
    getAzureSpeechService().processVoiceCommand(text, language || 'en-US')
};
export type { SpeechToTextResult, VoiceSearchResult };
