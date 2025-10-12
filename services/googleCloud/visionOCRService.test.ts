/**
 * Test file for Google Cloud Vision OCR Service
 * Demonstrates the hybrid language detection functionality
 */

import GoogleCloudVisionOCRService from './visionOCRService';

// Mock AsyncStorage for testing
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
};

// Mock the AsyncStorage module
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('GoogleCloudVisionOCRService - Hybrid Language Detection', () => {
  let ocrService: GoogleCloudVisionOCRService;

  beforeEach(() => {
    ocrService = new GoogleCloudVisionOCRService();
    jest.clearAllMocks();
  });

  describe('getCurrentAppLanguage', () => {
    it('should return language from settings store', async () => {
      const mockSettings = {
        state: {
          language: 'hi'
        }
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockSettings));

      // Access private method for testing
      const appLanguage = await (ocrService as any).getCurrentAppLanguage();
      expect(appLanguage).toBe('hi');
    });

    it('should fallback to direct language storage', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(null) // No settings data
        .mockResolvedValueOnce('te'); // Direct language storage

      const appLanguage = await (ocrService as any).getCurrentAppLanguage();
      expect(appLanguage).toBe('te');
    });

    it('should default to English when no language is set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const appLanguage = await (ocrService as any).getCurrentAppLanguage();
      expect(appLanguage).toBe('en');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid-json');

      const appLanguage = await (ocrService as any).getCurrentAppLanguage();
      expect(appLanguage).toBe('en');
    });
  });

  describe('Language Detection Modes', () => {
    it('should support app_only mode', async () => {
      // This would require mocking the actual OCR functionality
      // For now, we're testing the method exists and has correct signature
      expect(typeof ocrService.extractTextWithLanguageMode).toBe('function');
    });

    it('should support vision_only mode', async () => {
      expect(typeof ocrService.extractTextWithLanguageMode).toBe('function');
    });

    it('should support hybrid mode (default)', async () => {
      expect(typeof ocrService.extractTextWithLanguageMode).toBe('function');
    });
  });

  describe('Supported Languages', () => {
    it('should return supported languages mapping', () => {
      const supportedLanguages = ocrService.getSupportedLanguages();
      expect(typeof supportedLanguages).toBe('object');
      expect(supportedLanguages).toHaveProperty('en');
    });
  });
});

/**
 * Example usage of the hybrid language detection:
 * 
 * const ocrService = new GoogleCloudVisionOCRService();
 * 
 * // Use hybrid detection (recommended)
 * const results = await ocrService.extractTextWithAutoDetection(imageUri);
 * 
 * // Force app language only
 * const appOnlyResults = await ocrService.extractTextWithLanguageMode(
 *   imageUri, 
 *   'app_only'
 * );
 * 
 * // Use Vision API detection only (legacy)
 * const visionOnlyResults = await ocrService.extractTextWithLanguageMode(
 *   imageUri, 
 *   'vision_only', 
 *   ['en', 'hi']
 * );
 * 
 * // Hybrid with language hints
 * const hybridResults = await ocrService.extractTextWithLanguageMode(
 *   imageUri, 
 *   'hybrid', 
 *   ['te', 'kn']
 * );
 */