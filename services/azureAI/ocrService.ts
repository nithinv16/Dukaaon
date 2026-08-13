import { proxyOcr } from '../ai/aiProxyClient';
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

/**
 * OCR via the `ai-ocr` edge function (AWS Textract).
 *
 * Holds no provider configuration. This previously read
 * AZURE_AI_CONFIG.computerVisionKey, which came from
 * EXPO_PUBLIC_AZURE_COMPUTER_VISION_KEY with a live key hardcoded as a fallback —
 * so the key was inlined into the JS bundle and recoverable from any shipped APK.
 *
 * The class name and the exported OCRResponse shape are unchanged so the six
 * call sites are unaffected.
 */
class OCRService {

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
   * Extract text from a base64 image via the ai-ocr edge function.
   *
   * Textract's DetectDocumentText is synchronous, so the previous
   * submit -> Operation-Location -> poll-up-to-10-times sequence is gone; there is
   * nothing to poll. That also removes the up-to-10-second worst case.
   */
  private async extractTextFromBase64(base64Image: string): Promise<OCRResponse> {
    try {
      const result = await proxyOcr(base64Image);

      return {
        extractedText: result.text,
        results: result.lines.map((line) => ({
          text: line.text,
          confidence: line.confidence,
          language: 'en',
        })),
        language: 'en',
        // Textract does not report page orientation. Azure did, but no caller
        // reads this field; kept at 0 to preserve the response shape.
        orientation: 0,
        success: true,
      };
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

export default new OCRService();