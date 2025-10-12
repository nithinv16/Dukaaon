/**
 * Google Cloud Vision OCR Service
 * Handles text extraction from images using Google Cloud Vision API
 * with hybrid language detection (app language + automatic detection),
 * automatic translation to English for search queries, and enhanced error handling
 * 
 * Features:
 * - Hybrid language detection: Uses app's current language as primary
 * - Automatic fallback to Google Cloud Vision detection for accuracy
 * - Configurable detection modes: app_only, vision_only, or hybrid
 * - Enhanced text cleaning and artifact removal
 * - Automatic translation to English for search optimization
 * - Dual translation service support (Azure + fallback)
 * - Search-optimized text extraction with translation
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { GOOGLE_CLOUD_CONFIG } from '../../config/googleCloud';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translationService } from '../translationService';

interface OCRResult {
  text: string;
  confidence: number;
  detectedLanguage?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface OCRResultWithTranslation extends OCRResult {
  translatedText?: string;
  translationConfidence?: number;
  needsTranslation?: boolean;
}

interface VisionAPIResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly?: {
        vertices: Array<{ x: number; y: number }>;
      };
    }>;
    fullTextAnnotation?: {
      text: string;
      pages?: Array<{
        property?: {
          detectedLanguages?: Array<{
            languageCode: string;
            confidence: number;
          }>;
        };
      }>;
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
}

export class GoogleCloudVisionOCRService {
  private static instance: GoogleCloudVisionOCRService;
  private apiKey: string;
  private apiUrl: string;

  private constructor() {
    this.apiKey = GOOGLE_CLOUD_CONFIG.apiKey;
    this.apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;
  }

  public static getInstance(): GoogleCloudVisionOCRService {
    if (!GoogleCloudVisionOCRService.instance) {
      GoogleCloudVisionOCRService.instance = new GoogleCloudVisionOCRService();
    }
    return GoogleCloudVisionOCRService.instance;
  }

  /**
   * Request camera permission
   */
  public async requestCameraPermission(): Promise<boolean> {
    // react-native-image-picker handles permissions internally
    return true;
  }

  /**
   * Request media library permission
   */
  public async requestMediaLibraryPermission(): Promise<boolean> {
    // react-native-image-picker handles permissions internally
    return true;
  }

  /**
   * Capture image from camera
   */
  public async captureImage(): Promise<string | null> {
    try {
      // Request camera permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Camera permission is required to capture images.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Resize the image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        return manipulatedImage.uri;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image');
      return null;
    }
  }

  /**
   * Pick image from gallery
   */
  public async pickImage(): Promise<string | null> {
    try {
      // Request media library permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Media library permission is required to select images.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Resize the image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        return manipulatedImage.uri;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
      return null;
    }
  }

  /**
   * Convert image URI to base64
   */
  private async imageToBase64(imageUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64');
    }
  }

  /**
   * Extract text from image using Google Cloud Vision API
   */
  public async extractTextFromImage(
    imageUri: string,
    languageHints: string[] = []
  ): Promise<OCRResult[]> {
    try {
      const base64Image = await this.imageToBase64(imageUri);
      return await this.extractTextFromBase64(base64Image, languageHints);
    } catch (error) {
      console.error('Error extracting text from image:', error);
      throw error;
    }
  }

  /**
   * Extract text from image with hybrid language detection (app language + auto detection)
   */
  public async extractTextWithAutoDetection(imageUri: string): Promise<OCRResult[]> {
    try {
      console.log('Starting automatic language detection OCR...');
      const base64Image = await this.imageToBase64(imageUri);
      
      // Get current app language and prioritize it in language hints
      const appLanguage = await this.getCurrentAppLanguage();
      console.log(`Using app language as primary: ${appLanguage}`);
      
      // Create language hints with app language as primary, followed by common regional languages
      const regionalLanguageHints = ['hi', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'mr', 'pa', 'or', 'as', 'ur', 'en'];
      
      // Remove app language from regional hints to avoid duplication
      const filteredRegionalHints = regionalLanguageHints.filter(lang => lang !== appLanguage);
      
      // Prioritize app language as first hint, followed by other regional languages
      const prioritizedLanguageHints = [appLanguage, ...filteredRegionalHints];
      
      console.log(`Language hints priority: ${prioritizedLanguageHints.slice(0, 5).join(', ')}... (${prioritizedLanguageHints.length} total)`);
      
      return await this.extractTextFromBase64(base64Image, prioritizedLanguageHints);
    } catch (error) {
      console.error('Error extracting text with auto-detection:', error);
      throw error;
    }
  }

  /**
   * Extract text from base64 image string with automatic language detection
   */
  public async extractTextFromBase64(
    base64Image: string,
    languageHints: string[] = []
  ): Promise<OCRResult[]> {
    try {
      const features = [
        {
          type: 'TEXT_DETECTION',
          maxResults: GOOGLE_CLOUD_CONFIG.maxResults || 50,
        },
      ];

      // Add DOCUMENT_TEXT_DETECTION for better language detection and structure
      if (GOOGLE_CLOUD_CONFIG.enableDocumentTextDetection) {
        features.push({
          type: 'DOCUMENT_TEXT_DETECTION',
          maxResults: 1,
        });
      }

      const requestBody: any = {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: features,
          },
        ],
      };

      // Only add language hints if provided, otherwise let Google auto-detect
      if (languageHints.length > 0) {
        requestBody.requests[0].imageContext = {
          languageHints: languageHints,
        };
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data: VisionAPIResponse = await response.json();
      return await this.parseVisionAPIResponse(data);
    } catch (error) {
      console.error('Error extracting text from base64:', error);
      throw error;
    }
  }

  /**
   * Get current app language from storage
   */
  private async getCurrentAppLanguage(): Promise<string> {
    try {
      // First try to get from settings store (primary source)
      const settingsData = await AsyncStorage.getItem('dukaaon-settings');
      if (settingsData) {
        try {
          const settings = JSON.parse(settingsData);
          const savedLanguage = settings.state?.language;
          if (savedLanguage) {
            console.log(`Using app language as primary: ${savedLanguage}`);
            return savedLanguage;
          }
        } catch (parseError) {
          console.error('Error parsing settings data:', parseError);
        }
      }

      // Fallback to direct language storage
      const directLanguage = await AsyncStorage.getItem('selectedLanguage');
      if (directLanguage) {
        console.log(`Using fallback app language: ${directLanguage}`);
        return directLanguage;
      }

      // Default to English if no language is set
      console.log('No app language found, defaulting to English');
      return 'en';
    } catch (error) {
      console.error('Error getting app language:', error);
      return 'en';
    }
  }

  /**
   * Parse Google Cloud Vision API response with hybrid language detection
   * Uses app language as primary and Google Cloud Vision detection as fallback
   */
  private async parseVisionAPIResponse(response: VisionAPIResponse): Promise<OCRResult[]> {
    try {
      const results: OCRResult[] = [];
      
      if (!response.responses || response.responses.length === 0) {
        return results;
      }

      const firstResponse = response.responses[0];
      
      // Check for API errors
      if (firstResponse.error) {
        throw new Error(`Vision API Error: ${firstResponse.error.message}`);
      }

      // Hybrid language detection: Use app language as primary, Google Cloud Vision as fallback
      const appLanguage = await this.getCurrentAppLanguage();
      let finalLanguage = appLanguage;
      let detectionMethod = 'app_primary';
      
      // Extract Google Cloud Vision detected language for fallback
      let visionDetectedLanguage: string | undefined;
      let highestConfidence = 0;
      
      if (firstResponse.fullTextAnnotation) {
        console.log('Full text detected:', firstResponse.fullTextAnnotation.text);
        
        // Extract the most confident detected language from Vision API
        if (firstResponse.fullTextAnnotation.pages) {
          firstResponse.fullTextAnnotation.pages.forEach((page, pageIndex) => {
            if (page.property?.detectedLanguages) {
              console.log(`Page ${pageIndex + 1} detected languages:`);
              page.property.detectedLanguages.forEach(lang => {
                console.log(`  - ${lang.languageCode}: ${(lang.confidence * 100).toFixed(1)}% confidence`);
                if (lang.confidence > highestConfidence) {
                  highestConfidence = lang.confidence;
                  visionDetectedLanguage = lang.languageCode;
                }
              });
            }
          });
        }
      }

      // Decision logic for language detection - prioritize Vision API for regional languages
      if (visionDetectedLanguage && highestConfidence > 0.7) {
        // Check if app language is just the default fallback
        const isAppLanguageDefault = appLanguage === 'en';
        
        if (appLanguage !== visionDetectedLanguage) {
          console.log(`Language mismatch detected:`);
          console.log(`  - App language: ${appLanguage} (default: ${isAppLanguageDefault})`);
          console.log(`  - Vision detected: ${visionDetectedLanguage} (${(highestConfidence * 100).toFixed(1)}% confidence)`);
          
          // Use Vision API detection if:
          // 1. Very high confidence (>90%), OR
          // 2. Good confidence (>70%) AND app language is default English
          if (highestConfidence > 0.9 || (highestConfidence > 0.7 && isAppLanguageDefault)) {
            finalLanguage = visionDetectedLanguage;
            detectionMethod = 'vision_override';
            console.log(`Using Vision API language: ${visionDetectedLanguage} (${(highestConfidence * 100).toFixed(1)}% confidence)`);
          } else {
            console.log(`Keeping app language ${appLanguage} as primary choice`);
          }
        } else {
          console.log(`App language ${appLanguage} confirmed by Vision API (${(highestConfidence * 100).toFixed(1)}% confidence)`);
          detectionMethod = 'app_confirmed';
        }
      } else {
        console.log(`Using app language ${appLanguage} (Vision API confidence too low or no detection)`);
      }
      
      console.log(`Final language decision: ${finalLanguage} (method: ${detectionMethod})`);

      // Use fullTextAnnotation if available (preferred for complete text)
      if (firstResponse.fullTextAnnotation && firstResponse.fullTextAnnotation.text) {
        const rawText = firstResponse.fullTextAnnotation.text;
        const cleanedText = this.cleanExtractedText(rawText);
        
        console.log('Raw OCR text:', JSON.stringify(rawText));
        console.log('Cleaned OCR text:', JSON.stringify(cleanedText));
        
        results.push({
            text: cleanedText,
            confidence: 0.9,
            detectedLanguage: finalLanguage,
            boundingBox: undefined, // Full text doesn't have specific bounding box
          });
      } else if (firstResponse.textAnnotations && firstResponse.textAnnotations.length > 0) {
        // Fallback to first text annotation only (contains full text)
        const firstAnnotation = firstResponse.textAnnotations[0];
        if (firstAnnotation.description) {
          const rawText = firstAnnotation.description;
          const cleanedText = this.cleanExtractedText(rawText);
          
          console.log('Raw OCR text (fallback):', JSON.stringify(rawText));
          console.log('Cleaned OCR text (fallback):', JSON.stringify(cleanedText));
          
          let boundingBox;
          if (firstAnnotation.boundingPoly && firstAnnotation.boundingPoly.vertices) {
            const vertices = firstAnnotation.boundingPoly.vertices;
            if (vertices.length >= 4) {
              const minX = Math.min(...vertices.map(v => v.x || 0));
              const minY = Math.min(...vertices.map(v => v.y || 0));
              const maxX = Math.max(...vertices.map(v => v.x || 0));
              const maxY = Math.max(...vertices.map(v => v.y || 0));
              
              boundingBox = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
              };
            }
          }

          results.push({
            text: cleanedText,
            confidence: 0.9,
            detectedLanguage: finalLanguage,
            boundingBox,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error parsing Vision API response:', error);
      throw error;
    }
  }

  /**
   * Show OCR options (camera or gallery) with hybrid language detection
   * Uses app language as primary, with optional language hints and automatic detection as fallback
   */
  public async showOCROptions(languageHints: string[] = []): Promise<OCRResult[]> {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Select Image Source',
        'Choose how you want to capture the image for OCR',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                const imageUri = await this.captureImage();
                if (imageUri) {
                  // Always use hybrid detection (app language + auto detection)
                   // Language hints are still passed for additional context if provided
                   const results = languageHints.length > 0 
                    ? await this.extractTextFromImage(imageUri, languageHints)
                    : await this.extractTextWithAutoDetection(imageUri);
                  resolve(results);
                } else {
                  reject(new Error('No image captured'));
                }
              } catch (error) {
                reject(error);
              }
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              try {
                const imageUri = await this.pickImage();
                if (imageUri) {
                  const results = languageHints.length > 0 
                    ? await this.extractTextFromImage(imageUri, languageHints)
                    : await this.extractTextWithAutoDetection(imageUri);
                  resolve(results);
                } else {
                  reject(new Error('No image selected'));
                }
              } catch (error) {
                reject(error);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => reject(new Error('User cancelled')),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Clean extracted text to remove unwanted characters or artifacts
   */
  private cleanExtractedText(text: string): string {
    if (!text) return '';
    
    // Remove any trailing numbers that might be artifacts (like confidence scores)
    // But preserve numbers that are part of actual text content
    let cleaned = text.trim();
    
    // Remove common OCR artifacts
    cleaned = cleaned.replace(/\.\.\.$/, ''); // Remove trailing ellipsis
    cleaned = cleaned.replace(/^[0-9]+\s*/, ''); // Remove leading standalone numbers
    cleaned = cleaned.replace(/\s+[0-9]+$/, ''); // Remove trailing standalone numbers
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Extract text with configurable language detection mode
   * @param imageUri - The image URI to process
   * @param detectionMode - 'app_only', 'vision_only', or 'hybrid' (default)
   * @param languageHints - Optional language hints for Vision API
   */
  public async extractTextWithLanguageMode(
    imageUri: string, 
    detectionMode: 'app_only' | 'vision_only' | 'hybrid' = 'hybrid',
    languageHints: string[] = []
  ): Promise<OCRResult[]> {
    try {
      if (detectionMode === 'app_only') {
        // Force use app language only
        const appLanguage = await this.getCurrentAppLanguage();
        const results = await this.extractTextFromImage(imageUri, [appLanguage]);
        // Override detected language with app language
        return results.map(result => ({
          ...result,
          detectedLanguage: appLanguage
        }));
      } else if (detectionMode === 'vision_only') {
        // Use only Google Cloud Vision detection (legacy behavior)
        return await this.extractTextFromImage(imageUri, languageHints);
      } else {
        // Default hybrid mode
        return languageHints.length > 0 
          ? await this.extractTextFromImage(imageUri, languageHints)
          : await this.extractTextWithAutoDetection(imageUri);
      }
    } catch (error) {
      console.error('Error in extractTextWithLanguageMode:', error);
      throw error;
    }
  }

  /**
   * Extract text from image and automatically translate to English for search queries
   * This method is optimized for search functionality where English queries work best
   * @param imageUri - The image URI to process
   * @param forceTranslation - Force translation even if text is already in English
   * @returns OCR results with automatic English translation for search
   */
  public async extractTextForSearch(
    imageUri: string,
    forceTranslation: boolean = false
  ): Promise<OCRResultWithTranslation[]> {
    try {
      console.log('Starting OCR extraction for search with auto-translation...');
      
      // First, extract text using hybrid language detection
      const ocrResults = await this.extractTextWithLanguageMode(imageUri, 'hybrid');
      
      if (ocrResults.length === 0) {
        console.log('No text extracted from image');
        return [];
      }

      const resultsWithTranslation: OCRResultWithTranslation[] = [];
      
      for (const result of ocrResults) {
        const enhancedResult: OCRResultWithTranslation = {
          ...result,
          needsTranslation: false,
          translatedText: undefined,
          translationConfidence: undefined
        };
        
        // Check if translation to English is needed
        const detectedLang = result.detectedLanguage || 'auto';
        const needsTranslation = forceTranslation || (detectedLang !== 'en' && detectedLang !== 'auto');
        
        if (needsTranslation && result.text.trim()) {
          try {
            console.log(`Translating text to English from ${detectedLang}:`, result.text);
            
            // Use TranslationService for translation
            const translatedText = await translationService.translateText(result.text, 'en');
            const translationConfidence = 0.8;
            console.log('Translation successful:', translatedText);
            
            enhancedResult.translatedText = translatedText;
            enhancedResult.translationConfidence = translationConfidence;
            enhancedResult.needsTranslation = true;
            
            console.log('Translation completed:', {
              original: result.text,
              translated: translatedText,
              sourceLanguage: detectedLang,
              confidence: translationConfidence
            });
            
          } catch (translationError) {
            console.error('Translation failed:', translationError);
            // Continue without translation - use original text
            enhancedResult.needsTranslation = false;
          }
        } else {
          console.log('No translation needed - text is already in English or auto-detected');
        }
        
        resultsWithTranslation.push(enhancedResult);
      }
      
      return resultsWithTranslation;
      
    } catch (error) {
      console.error('Error in extractTextForSearch:', error);
      throw error;
    }
  }

  /**
   * Extract text and get the best search query (translated to English if needed)
   * This is a convenience method that returns the best text for search purposes
   * @param imageUri - The image URI to process
   * @param forceTranslation - Force translation even if text is already in English
   * @returns The best search query text in English
   */
  public async getSearchQueryFromImage(
    imageUri: string,
    forceTranslation: boolean = false
  ): Promise<{
    searchQuery: string;
    originalText: string;
    detectedLanguage: string;
    wasTranslated: boolean;
    confidence: number;
  } | null> {
    try {
      const results = await this.extractTextForSearch(imageUri, forceTranslation);
      
      if (results.length === 0) {
        return null;
      }
      
      // Get the first (and usually most comprehensive) result
      const primaryResult = results[0];
      
      return {
        searchQuery: primaryResult.translatedText || primaryResult.text,
        originalText: primaryResult.text,
        detectedLanguage: primaryResult.detectedLanguage || 'auto',
        wasTranslated: !!primaryResult.translatedText,
        confidence: primaryResult.translationConfidence || primaryResult.confidence
      };
      
    } catch (error) {
      console.error('Error getting search query from image:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): { [key: string]: string } {
    return GOOGLE_CLOUD_CONFIG.supportedLanguages || {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'gu': 'Gujarati',
      'bn': 'Bengali',
      'mr': 'Marathi',
      'pa': 'Punjabi',
      'or': 'Odia',
      'as': 'Assamese',
      'ur': 'Urdu',
    };
  }
}

export default GoogleCloudVisionOCRService;
export { OCRResult, OCRResultWithTranslation };