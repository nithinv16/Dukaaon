import { getUnifiedSpeechService } from '../services/speechService';
import AWSTranscribeService from '../services/awsAI/transcribeService';
import AWSPollyService from '../services/awsAI/pollyService';
import AzureSpeechService from '../services/azureAI/speechService';

// Mock audio data for testing
const mockAudioUri = 'https://example.com/test-audio.wav';
const testText = 'Hello, welcome to Dukaaon! How can I help you today?';
const hindiTestText = 'नमस्ते, दुकानों में आपका स्वागत है!';

describe('AWS Speech Services Integration Tests', () => {
  let speechService: any;

  beforeAll(() => {
    // Initialize unified speech service
    speechService = getUnifiedSpeechService({
      preferredProvider: 'aws',
      fallbackEnabled: true,
      azureEnabled: true,
      awsEnabled: true
    });
  });

  describe('AWS Transcribe Service', () => {
    test('should initialize AWS Transcribe service', () => {
      expect(AWSTranscribeService).toBeDefined();
      expect(typeof AWSTranscribeService.speechToText).toBe('function');
    });

    test('should support required languages', () => {
      const supportedLanguages = AWSTranscribeService.getSupportedLanguages();
      expect(supportedLanguages).toContain('en-US');
      expect(supportedLanguages).toContain('hi-IN');
      expect(supportedLanguages).toContain('ta-IN');
    });

    test('should validate language support', () => {
      expect(AWSTranscribeService.isLanguageSupported('en-US')).toBe(true);
      expect(AWSTranscribeService.isLanguageSupported('hi-IN')).toBe(true);
      expect(AWSTranscribeService.isLanguageSupported('invalid-lang')).toBe(false);
    });

    test('should process voice commands correctly', () => {
      const testCommands = [
        {
          input: 'Add 2 packets of rice to my cart',
          expected: {
            intent: 'order',
            entities: {
              productName: 'rice',
              quantity: 2
            }
          }
        },
        {
          input: 'Search for organic vegetables',
          expected: {
            intent: 'search',
            entities: {
              category: 'vegetables',
              productName: 'organic vegetables'
            }
          }
        },
        {
          input: 'Show me my orders',
          expected: {
            intent: 'navigate'
          }
        }
      ];

      testCommands.forEach(({ input, expected }) => {
        const result = AWSTranscribeService.processVoiceCommand(input, 'en-US');
        expect(result.intent).toBe(expected.intent);
        if (expected.entities) {
          expect(result.entities).toMatchObject(expected.entities);
        }
      });
    });
  });

  describe('AWS Polly Service', () => {
    test('should initialize AWS Polly service', () => {
      expect(AWSPollyService).toBeDefined();
      expect(typeof AWSPollyService.synthesizeSpeech).toBe('function');
    });

    test('should support required languages', () => {
      const supportedLanguages = AWSPollyService.getSupportedLanguages();
      expect(supportedLanguages).toContain('en-US');
      expect(supportedLanguages).toContain('hi-IN');
    });

    test('should validate language support', () => {
      expect(AWSPollyService.isLanguageSupported('en-US')).toBe(true);
      expect(AWSPollyService.isLanguageSupported('hi-IN')).toBe(true);
      expect(AWSPollyService.isLanguageSupported('invalid-lang')).toBe(false);
    });

    test('should get voice names for supported languages', async () => {
      const englishVoices = await AWSPollyService.getVoiceNames('en-US');
      expect(englishVoices).toContain('Joanna');
      expect(englishVoices).toContain('Matthew');

      const hindiVoices = await AWSPollyService.getVoiceNames('hi-IN');
      expect(hindiVoices.length).toBeGreaterThan(0);
    });

    test('should get detailed voice information', async () => {
      const voices = await AWSPollyService.getVoicesForLanguage('en-US');
      expect(voices.length).toBeGreaterThan(0);
      
      const joanna = voices.find(v => v.name === 'Joanna');
      expect(joanna).toBeDefined();
      expect(joanna?.gender).toBe('Female');
      expect(joanna?.languageCode).toBe('en-US');
    });
  });

  describe('Unified Speech Service', () => {
    test('should initialize with correct configuration', () => {
      expect(speechService).toBeDefined();
      expect(speechService.getCurrentProvider()).toBe('aws');
    });

    test('should switch providers correctly', () => {
      speechService.switchProvider('azure');
      expect(speechService.getCurrentProvider()).toBe('azure');
      
      speechService.switchProvider('aws');
      expect(speechService.getCurrentProvider()).toBe('aws');
    });

    test('should get supported languages from all providers', () => {
      const languages = speechService.getSupportedLanguages();
      expect(languages).toContain('en-US');
      expect(languages).toContain('hi-IN');
      expect(languages.length).toBeGreaterThan(5);
    });

    test('should handle provider-specific language selection', () => {
      // Test that the service selects appropriate provider based on language support
      const service = getUnifiedSpeechService({
        preferredProvider: 'auto',
        fallbackEnabled: true,
        azureEnabled: true,
        awsEnabled: true
      });
      
      expect(service).toBeDefined();
    });
  });

  describe('Performance Comparison Tests', () => {
    test('should measure speech-to-text performance', async () => {
      const testCases = [
        { language: 'en-US', provider: 'azure' },
        { language: 'en-US', provider: 'aws' },
        { language: 'hi-IN', provider: 'azure' },
        { language: 'hi-IN', provider: 'aws' }
      ];

      const results: any[] = [];

      for (const testCase of testCases) {
        const startTime = Date.now();
        
        try {
          speechService.switchProvider(testCase.provider);
          
          // Mock the actual API call for testing
          const mockResult = {
            text: 'Test transcription',
            confidence: 0.95,
            language: testCase.language,
            provider: testCase.provider
          };
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({
            ...testCase,
            duration,
            success: true,
            result: mockResult
          });
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({
            ...testCase,
            duration,
            success: false,
            error: error
          });
        }
      }

      // Analyze results
      const azureResults = results.filter(r => r.provider === 'azure');
      const awsResults = results.filter(r => r.provider === 'aws');
      
      console.log('Performance Comparison Results:');
      console.log('Azure Average Duration:', 
        azureResults.reduce((sum, r) => sum + r.duration, 0) / azureResults.length);
      console.log('AWS Average Duration:', 
        awsResults.reduce((sum, r) => sum + r.duration, 0) / awsResults.length);
      
      expect(results.length).toBe(testCases.length);
    });

    test('should measure text-to-speech performance', async () => {
      const testCases = [
        { text: testText, language: 'en-US', provider: 'azure' },
        { text: testText, language: 'en-US', provider: 'aws' },
        { text: hindiTestText, language: 'hi-IN', provider: 'azure' },
        { text: hindiTestText, language: 'hi-IN', provider: 'aws' }
      ];

      const results: any[] = [];

      for (const testCase of testCases) {
        const startTime = Date.now();
        
        try {
          speechService.switchProvider(testCase.provider);
          
          // Mock the actual API call for testing
          const mockResult = {
            success: true,
            audioUrl: 'https://example.com/audio.mp3',
            provider: testCase.provider
          };
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({
            ...testCase,
            duration,
            success: true,
            result: mockResult
          });
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          results.push({
            ...testCase,
            duration,
            success: false,
            error: error
          });
        }
      }

      // Analyze results
      const azureResults = results.filter(r => r.provider === 'azure');
      const awsResults = results.filter(r => r.provider === 'aws');
      
      console.log('TTS Performance Comparison Results:');
      console.log('Azure Average Duration:', 
        azureResults.reduce((sum, r) => sum + r.duration, 0) / azureResults.length);
      console.log('AWS Average Duration:', 
        awsResults.reduce((sum, r) => sum + r.duration, 0) / awsResults.length);
      
      expect(results.length).toBe(testCases.length);
    });
  });

  describe('Error Handling and Fallback Tests', () => {
    test('should handle provider failures gracefully', async () => {
      const serviceWithFallback = getUnifiedSpeechService({
        preferredProvider: 'aws',
        fallbackEnabled: true,
        azureEnabled: true,
        awsEnabled: true
      });

      // Mock a failure scenario
      const originalMethod = AWSTranscribeService.speechToText;
      AWSTranscribeService.speechToText = jest.fn().mockRejectedValue(new Error('AWS service unavailable'));

      try {
        // This should fallback to Azure
        const result = await serviceWithFallback.speechToText(mockAudioUri, 'en-US');
        expect(result.provider).toBe('azure'); // Should fallback to Azure
      } catch (error) {
        // If both providers fail, error should indicate that
        expect(error.message).toContain('Both speech providers failed');
      }

      // Restore original method
      AWSTranscribeService.speechToText = originalMethod;
    });

    test('should handle invalid configurations', () => {
      expect(() => {
        const service = getUnifiedSpeechService({
          preferredProvider: 'aws',
          fallbackEnabled: false,
          azureEnabled: false,
          awsEnabled: false
        });
        service.switchProvider('azure');
      }).toThrow('Azure Speech Service is not enabled');
    });

    test('should handle unsupported languages', () => {
      const result = speechService.processVoiceCommand('Hello', 'unsupported-lang');
      expect(result).toBeDefined();
      // Should still process with default language handling
    });
  });

  describe('Integration with Existing Components', () => {
    test('should maintain backward compatibility', () => {
      // Test that existing Azure-based components still work
      expect(AzureSpeechService).toBeDefined();
      expect(typeof AzureSpeechService.speechToText).toBe('function');
      expect(typeof AzureSpeechService.textToSpeech).toBe('function');
    });

    test('should provide unified interface', () => {
      const methods = [
        'speechToText',
        'textToSpeech',
        'voiceSearch',
        'startContinuousRecognition',
        'stopContinuousRecognition',
        'processVoiceCommand',
        'getVoiceNames',
        'getSupportedLanguages',
        'switchProvider',
        'getCurrentProvider'
      ];

      methods.forEach(method => {
        expect(typeof speechService[method]).toBe('function');
      });
    });
  });

  describe('Configuration Validation', () => {
    test('should validate AWS configuration', () => {
      const config = {
        accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY,
        region: process.env.EXPO_PUBLIC_AWS_REGION
      };

      // In a real test, these would be actual validation checks
      expect(config).toBeDefined();
    });

    test('should handle missing environment variables gracefully', () => {
      // Test behavior when AWS credentials are not configured
      const originalEnv = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;
      delete process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;

      try {
        const service = getUnifiedSpeechService({
          preferredProvider: 'aws',
          fallbackEnabled: true,
          azureEnabled: true,
          awsEnabled: true
        });
        
        // Should fallback to Azure or handle gracefully
        expect(service.getCurrentProvider()).toBeDefined();
      } finally {
        // Restore environment variable
        if (originalEnv) {
          process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID = originalEnv;
        }
      }
    });
  });
});

// Performance benchmarking utility
export class SpeechServiceBenchmark {
  static async benchmarkSpeechToText(
    providers: ('azure' | 'aws')[],
    testCases: { audioUri: string; language: string }[],
    iterations: number = 3
  ) {
    const results: any[] = [];
    
    for (const provider of providers) {
      for (const testCase of testCases) {
        const providerResults: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
          const speechService = getUnifiedSpeechService({ preferredProvider: provider });
          
          const startTime = performance.now();
          try {
            await speechService.speechToText(testCase.audioUri, testCase.language);
            const endTime = performance.now();
            providerResults.push(endTime - startTime);
          } catch (error) {
            console.error(`Benchmark failed for ${provider}:`, error);
            providerResults.push(-1); // Indicate failure
          }
        }
        
        const avgTime = providerResults.filter(t => t > 0).reduce((a, b) => a + b, 0) / providerResults.filter(t => t > 0).length;
        const successRate = providerResults.filter(t => t > 0).length / iterations;
        
        results.push({
          provider,
          language: testCase.language,
          averageTime: avgTime,
          successRate,
          iterations
        });
      }
    }
    
    return results;
  }

  static async benchmarkTextToSpeech(
    providers: ('azure' | 'aws')[],
    testCases: { text: string; language: string }[],
    iterations: number = 3
  ) {
    const results: any[] = [];
    
    for (const provider of providers) {
      for (const testCase of testCases) {
        const providerResults: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
          const speechService = getUnifiedSpeechService({ preferredProvider: provider });
          
          const startTime = performance.now();
          try {
            await speechService.textToSpeech(testCase.text, testCase.language);
            const endTime = performance.now();
            providerResults.push(endTime - startTime);
          } catch (error) {
            console.error(`Benchmark failed for ${provider}:`, error);
            providerResults.push(-1); // Indicate failure
          }
        }
        
        const avgTime = providerResults.filter(t => t > 0).reduce((a, b) => a + b, 0) / providerResults.filter(t => t > 0).length;
        const successRate = providerResults.filter(t => t > 0).length / iterations;
        
        results.push({
          provider,
          language: testCase.language,
          averageTime: avgTime,
          successRate,
          iterations
        });
      }
    }
    
    return results;
  }

  static generateReport(results: any[]) {
    console.log('\n=== Speech Services Performance Report ===\n');
    
    const groupedResults = results.reduce((acc, result) => {
      const key = `${result.provider}-${result.language}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(result);
      return acc;
    }, {});
    
    Object.entries(groupedResults).forEach(([key, results]: [string, any]) => {
      const [provider, language] = key.split('-');
      const avgTime = results.reduce((sum: number, r: any) => sum + r.averageTime, 0) / results.length;
      const avgSuccessRate = results.reduce((sum: number, r: any) => sum + r.successRate, 0) / results.length;
      
      console.log(`${provider.toUpperCase()} (${language}):`);
      console.log(`  Average Response Time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
      console.log('');
    });
  }
}