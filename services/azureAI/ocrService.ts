import { AZURE_AI_CONFIG } from '../../config/azureAI';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  language?: string;
}

export interface OCRResponse {
  extractedText: string;
  results: OCRResult[];
  language: string;
  orientation: number;
  success: boolean;
  error?: string;
}

class AzureOCRService {
  private apiKey: string;
  private endpoint: string;
  private region: string;

  constructor() {
    this.apiKey = AZURE_AI_CONFIG.computerVisionKey;
    this.endpoint = AZURE_AI_CONFIG.computerVisionEndpoint;
    this.region = AZURE_AI_CONFIG.computerVisionRegion;
  }

  /**
   * Request camera permissions
   */
  private async requestPermissions(): Promise<boolean> {
    // react-native-image-picker handles permissions internally
    return true;
  }

  /**
   * Launch camera to capture image for OCR
   */
  async captureImageForOCR(): Promise<OCRResponse | null> {
    try {
      // Request camera permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to use OCR functionality.',
          [{ text: 'OK' }]
        );
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
        
        // Resize and get base64
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipulatedImage.base64) {
          try {
            const ocrResult = await this.extractTextFromBase64(manipulatedImage.base64);
            return ocrResult;
          } catch (error) {
            console.error('Error extracting text from image:', error);
            return {
              extractedText: '',
              results: [],
              language: 'en',
              orientation: 0,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
          }
        } else {
          return {
            extractedText: '',
            results: [],
            language: 'en',
            orientation: 0,
            success: false,
            error: 'Failed to get base64 image data'
          };
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error capturing image for OCR:', error);
      return {
        extractedText: '',
        results: [],
        language: 'en',
        orientation: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Pick image from gallery for OCR
   */
  async pickImageForOCR(): Promise<OCRResponse | null> {
    try {
      // Request media library permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Permission to access camera roll is required!',
          [{ text: 'OK' }]
        );
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
        
        // Resize and get base64
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2000, height: 2000 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipulatedImage.base64) {
          try {
            const ocrResult = await this.extractTextFromBase64(manipulatedImage.base64);
            return ocrResult;
          } catch (error) {
            console.error('Error extracting text from image:', error);
            return {
              extractedText: '',
              results: [],
              language: 'en',
              orientation: 0,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
          }
        } else {
          return {
            extractedText: '',
            results: [],
            language: 'en',
            orientation: 0,
            success: false,
            error: 'Failed to get base64 image data'
          };
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error picking image for OCR:', error);
      return {
        extractedText: '',
        results: [],
        language: 'en',
        orientation: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Extract text from base64 image using Azure Computer Vision OCR
   */
  private async extractTextFromBase64(base64Image: string): Promise<OCRResponse> {
    try {
      if (!this.apiKey || !this.endpoint) {
        throw new Error('Azure Computer Vision API key or endpoint not configured');
      }

      // Convert base64 to binary
      const binaryImage = atob(base64Image);
      const bytes = new Uint8Array(binaryImage.length);
      for (let i = 0; i < binaryImage.length; i++) {
        bytes[i] = binaryImage.charCodeAt(i);
      }

      const response = await fetch(`${this.endpoint}/vision/v3.2/read/analyze`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR API request failed: ${response.status} - ${errorText}`);
      }

      // Get the operation location from response headers
      const operationLocation = response.headers.get('Operation-Location');
      if (!operationLocation) {
        throw new Error('No operation location returned from OCR API');
      }

      // Poll for results
      return await this.pollForResults(operationLocation);
    } catch (error) {
      console.error('Error extracting text from image:', error);
      return {
        extractedText: '',
        results: [],
        language: 'en',
        orientation: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Poll for OCR results
   */
  private async pollForResults(operationLocation: string): Promise<OCRResponse> {
    const maxAttempts = 10;
    const pollInterval = 1000; // 1 second

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(operationLocation, {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'succeeded') {
          return this.parseOCRResults(result);
        } else if (result.status === 'failed') {
          throw new Error('OCR operation failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`Polling attempt ${attempt + 1} failed:`, error);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('OCR operation timed out');
  }

  /**
   * Parse OCR results from Azure Computer Vision response
   */
  private parseOCRResults(apiResponse: any): OCRResponse {
    try {
      const analyzeResult = apiResponse.analyzeResult;
      if (!analyzeResult || !analyzeResult.readResults) {
        throw new Error('Invalid OCR response format');
      }

      let extractedText = '';
      const results: OCRResult[] = [];
      let detectedLanguage = 'en';
      let orientation = 0;

      // Process each page
      for (const page of analyzeResult.readResults) {
        if (page.language) {
          detectedLanguage = page.language;
        }
        if (page.angle !== undefined) {
          orientation = page.angle;
        }

        // Process each line
        for (const line of page.lines || []) {
          extractedText += line.text + '\n';
          
          // Create result object for each line
          const result: OCRResult = {
            text: line.text,
            confidence: line.appearance?.style?.confidence || 0.9,
            language: detectedLanguage,
          };

          // Add bounding box if available
          if (line.boundingBox && line.boundingBox.length >= 4) {
            result.boundingBox = {
              x: line.boundingBox[0],
              y: line.boundingBox[1],
              width: line.boundingBox[4] - line.boundingBox[0],
              height: line.boundingBox[5] - line.boundingBox[1],
            };
          }

          results.push(result);
        }
      }

      return {
        extractedText: extractedText.trim(),
        results,
        language: detectedLanguage,
        orientation,
        success: true,
      };
    } catch (error) {
      console.error('Error parsing OCR results:', error);
      return {
        extractedText: '',
        results: [],
        language: 'en',
        orientation: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse OCR results'
      };
    }
  }

  /**
   * Show OCR options to user (camera or gallery)
   */
  async showOCROptions(): Promise<OCRResponse | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'OCR Text Extraction',
        'Choose how you want to capture text:',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const result = await this.captureImageForOCR();
              resolve(result);
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              const result = await this.pickImageForOCR();
              resolve(result);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(null),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(null) }
      );
    });
  }
}

export default new AzureOCRService();