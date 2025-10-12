import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip } from 'react-native-paper';
import GoogleCloudVisionOCRService, { OCRResultWithTranslation } from '../../services/googleCloud/visionOCRService';
import { useTranslation } from '../../contexts/LanguageContext';

interface OCRResponse {
  success: boolean;
  extractedText: string;
  language: string;
  error?: string;
}

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

interface OCRScannerProps {
  onTextExtracted?: (text: string, language: string) => void;
  onSearchResult?: (query: string, language: string, translatedQuery?: string, originalText?: string) => void;
  style?: any;
  buttonText?: string;
  showModal?: boolean;
  isFloating?: boolean;
  compact?: boolean;
  enableTranslation?: boolean;
  autoTranslate?: boolean;
}

const OCRScanner: React.FC<OCRScannerProps> = ({
  onTextExtracted,
  onSearchResult,
  style,
  buttonText = 'OCR Scan',
  showModal = true,
  isFloating = false,
  compact = false,
  enableTranslation = true,
  autoTranslate = true,
}) => {
  const { currentLanguage, translate } = useTranslation();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const styles = createStyles(screenWidth, screenHeight);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [editableText, setEditableText] = useState('');
  const [ocrResults, setOcrResults] = useState<OCRResponse | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string[]>([]); // Default to automatic detection
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(enableTranslation && autoTranslate);
  const [showTranslation, setShowTranslation] = useState(false);
  const [needsTranslation, setNeedsTranslation] = useState(false);

  // Helper function to determine if translation is needed
  const shouldTranslate = (detectedLanguage: string, appLanguage: string): boolean => {
    // Normalize language codes for comparison
    const normalizeLanguage = (lang: string): string => {
      if (!lang) return 'en';
      // Handle common variations
      const normalized = lang.toLowerCase().split('-')[0]; // Remove region codes
      if (normalized === 'auto') return 'en';
      return normalized;
    };

    const normalizedDetected = normalizeLanguage(detectedLanguage);
    const normalizedApp = normalizeLanguage(appLanguage);
    
    // No translation needed if languages match
    if (normalizedDetected === normalizedApp) {
      return false;
    }
    
    // No translation needed if app is in English and detected text is English
    if (normalizedApp === 'en' && normalizedDetected === 'en') {
      return false;
    }
    
    // Translation needed if languages are different
    return true;
  };

  const handleOCRPress = async () => {
    if (showModal) {
      setIsModalVisible(true);
    } else {
      // Use optimized search method for better results
      await performOCRWithSearch();
    }
  };

  const performOCRWithSearch = async (source?: 'camera' | 'gallery') => {
    try {
      setIsProcessing(true);
      
      const ocrService = GoogleCloudVisionOCRService.getInstance();
      let imageUri: string | null = null;
      
      if (source === 'camera') {
        imageUri = await ocrService.captureImage();
      } else if (source === 'gallery') {
        imageUri = await ocrService.pickImage();
      } else {
        // For showOCROptions, we'll fall back to the original method
        return await performOCR(source);
      }
      
      if (!imageUri) {
        Alert.alert('Error', 'No image selected');
        return;
      }
      
      // Use the new search-optimized extraction method
      const searchResults = await ocrService.extractTextForSearch(imageUri);
      
      if (searchResults && searchResults.length > 0) {
        const primaryResult = searchResults[0];
        
        const result: OCRResponse = {
          success: true,
          extractedText: primaryResult.text,
          language: primaryResult.detectedLanguage || 'auto'
        };
        
        setExtractedText(primaryResult.text);
        setEditableText(primaryResult.text);
        setOcrResults(result);
        setNeedsTranslation(primaryResult.needsTranslation);
        
        // Set translation if available
        if (primaryResult.translatedText) {
          // Extract translated text string properly
          const translatedTextString = typeof primaryResult.translatedText === 'string' 
            ? primaryResult.translatedText 
            : primaryResult.translatedText?.translatedText || '';
          setTranslatedText(translatedTextString);
          setShowTranslation(true);
        }
        
        if (onTextExtracted) {
          onTextExtracted(primaryResult.text, primaryResult.detectedLanguage || 'auto');
        }
        
        if (showModal) {
          // Keep modal open to show results
        } else {
          // Automatically trigger search for non-modal usage
          if (onSearchResult) {
            console.log('OCR: Using optimized search with extracted text:', primaryResult.text);
            
            // Extract translated text string properly
            const translatedTextString = typeof primaryResult.translatedText === 'string' 
              ? primaryResult.translatedText 
              : primaryResult.translatedText?.translatedText || '';
              
            const searchQuery = translatedTextString || primaryResult.text;
            const searchLanguage = translatedTextString ? 'en' : (primaryResult.detectedLanguage || 'auto');
            onSearchResult(searchQuery, searchLanguage, translatedTextString, primaryResult.text);
          } else {
            // Show quick alert if no search callback provided
            // Extract translated text string properly
            const translatedTextString = typeof primaryResult.translatedText === 'string' 
              ? primaryResult.translatedText 
              : primaryResult.translatedText?.translatedText || '';
              
            Alert.alert(
              'Text Extracted',
              `Extracted: "${primaryResult.text}"${translatedTextString ? `\nTranslated: "${translatedTextString}"` : ''}`,
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        Alert.alert(
          'OCR Error',
          'No text detected in the image. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert(
        'OCR Error',
        'An unexpected error occurred while processing the image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const performOCR = async (source?: 'camera' | 'gallery') => {
    try {
      setIsProcessing(true);
      
      let result: OCRResponse | null = null;
      
      const ocrService = GoogleCloudVisionOCRService.getInstance();
      let ocrResults: OCRResult[] | null = null;
      
      if (source === 'camera') {
        const imageUri = await ocrService.captureImage();
        if (imageUri) {
          ocrResults = selectedLanguage.length > 0 
            ? await ocrService.extractTextFromImage(imageUri, selectedLanguage)
            : await ocrService.extractTextWithHybridLanguageDetection(imageUri);
        }
      } else if (source === 'gallery') {
        const imageUri = await ocrService.pickImage();
        if (imageUri) {
          ocrResults = selectedLanguage.length > 0 
            ? await ocrService.extractTextFromImage(imageUri, selectedLanguage)
            : await ocrService.extractTextWithHybridLanguageDetection(imageUri);
        }
      } else {
        ocrResults = await ocrService.showOCROptions(selectedLanguage);
      }
      
      if (ocrResults && ocrResults.length > 0) {
        // Use the first (and typically only) result's text directly
        const extractedText = ocrResults[0].text.trim();
        // Extract detected language from OCR results if available
        const detectedLanguage = ocrResults[0]?.detectedLanguage || 
          (selectedLanguage.length > 0 ? selectedLanguage[0] : 'auto');
        
        result = {
          success: true,
          extractedText,
          language: detectedLanguage
        };
      } else {
        result = {
          success: false,
          extractedText: '',
          language: 'auto',
          error: 'No text detected in the image'
        };
      }
      
      if (result && result.success && result.extractedText) {
        setExtractedText(result.extractedText);
        setEditableText(result.extractedText);
        setOcrResults(result);
        
        // Determine if translation is needed based on app language vs detected language
        const translationNeeded = shouldTranslate(result.language, currentLanguage);
        setNeedsTranslation(translationNeeded);
        
        // Handle translation if enabled and needed
        if (enableTranslation && translationEnabled && translationNeeded) {
          await handleTranslation(result.extractedText, result.language);
        }
        
        if (onTextExtracted) {
          onTextExtracted(result.extractedText, result.language);
        }
        
        if (showModal) {
          // Keep modal open to show results
        } else {
          // Automatically trigger search for non-modal usage
          if (onSearchResult) {
            console.log('OCR: Automatically triggering search with extracted text:', result.extractedText);
            await handleSmartSearch(result.extractedText, result.language);
          } else {
            // Show quick alert if no search callback provided
            Alert.alert(
              'Text Extracted',
              `Extracted: "${result.extractedText}"`,
              [{ text: 'OK' }]
            );
          }
        }
      } else if (result && !result.success) {
        Alert.alert(
          'OCR Error',
          result.error || 'Failed to extract text from image. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert(
        'OCR Error',
        'An unexpected error occurred while processing the image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranslation = async (text: string, sourceLanguage: string) => {
    try {
      setIsTranslating(true);
      
      // Use new translation service
      const translationResult = await translate(text, 'en');
      
      // Extract the translated text string from the result object
      // Handle nested translation structure: translationResult.translated.translatedText
      let translatedTextString = text; // fallback to original text
      
      if (translationResult?.translatedText) {
        // Direct translatedText property
        translatedTextString = translationResult.translatedText;
      } else if (translationResult?.translated?.translatedText) {
        // Nested translated.translatedText property
        translatedTextString = translationResult.translated.translatedText;
      } else if (typeof translationResult?.translated === 'string') {
        // translated property is a string
        translatedTextString = translationResult.translated;
      }
      
      setTranslatedText(translatedTextString);
      setShowTranslation(true);
      
      console.log('Translation completed:', {
        original: text,
        translated: translationResult,
        sourceLanguage
      });
    } catch (error) {
      console.error('Translation error:', error);
      // Don't show error to user, just continue without translation
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSmartSearch = async (text: string, language: string) => {
    if (!onSearchResult) return;
    
    try {
      // Check if translation is needed based on app language vs detected language
      const translationNeeded = shouldTranslate(language, currentLanguage);
      
      // If no translation needed or translation is disabled, search directly
      if (!translationNeeded || !enableTranslation) {
        console.log('Smart search: No translation needed', {
          detectedLanguage: language,
          appLanguage: currentLanguage,
          translationNeeded,
          enableTranslation
        });
        onSearchResult(text, language);
        return;
      }
      
      // Translation needed - determine target language
      const targetLanguage = currentLanguage === 'en' ? 'en' : currentLanguage;
      
      let translatedQuery = '';
      try {
        // Use new translation service
        translatedQuery = await translate(text, targetLanguage);
      } catch (error) {
        console.log('Translation failed, using original text:', error);
        translatedQuery = text; // Fallback to original text
      }
      
      // Call search with translated text as primary query for better results
      onSearchResult(translatedQuery, targetLanguage, text, text);
      
      console.log('Smart search executed with translation:', {
        searchQuery: translatedQuery,
        originalText: text,
        detectedLanguage: language,
        appLanguage: currentLanguage,
        targetLanguage
      });
    } catch (error) {
      console.error('Smart search error:', error);
      // Fallback to original text search
      onSearchResult(text, language);
    }
  };

  const handleSearch = async () => {
    if (editableText && onSearchResult) {
      // Use translated text if available and translation is enabled
      const searchText = (translationEnabled && needsTranslation && translatedText) 
        ? translatedText 
        : editableText;
      
      const searchLanguage = (translationEnabled && needsTranslation && translatedText)
        ? currentLanguage
        : (ocrResults?.language || 'auto');
      
      // For direct search, pass the appropriate text and language
      if (translationEnabled && needsTranslation && translatedText) {
        // Use translated text for search
        onSearchResult(searchText, searchLanguage, undefined, editableText);
      } else {
        // Use original text or call smart search for potential translation
        await handleSmartSearch(editableText, ocrResults?.language || 'auto');
      }
      
      closeModal();
    }
  };

  const handleManualTranslation = async () => {
    if (extractedText && ocrResults?.language) {
      await handleTranslation(extractedText, ocrResults.language);
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setExtractedText('');
    setEditableText('');
    setOcrResults(null);
    setTranslatedText('');
    setShowTranslation(false);
    setIsTranslating(false);
  };

  const handleCameraPress = () => {
    // Use optimized search method for camera
    performOCRWithSearch('camera');
  };

  const handleGalleryPress = () => {
    // Use optimized search method for gallery
    performOCRWithSearch('gallery');
  };

  return (
    <>
      {isFloating ? (
        <TouchableOpacity
          style={[styles.floatingButton, style]}
          onPress={handleOCRPress}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size={24} color="#FFFFFF" />
          ) : (
            <Ionicons 
              name="camera" 
              size={28} 
              color="#FFFFFF" 
            />
          )}
        </TouchableOpacity>
      ) : compact ? (
        <TouchableOpacity
          style={[styles.compactButton, style]}
          onPress={handleOCRPress}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size={18} color="#FFFFFF" />
          ) : (
            <Ionicons 
              name="camera" 
              size={20} 
              color="#666" 
            />
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.ocrButton, style]}
          onPress={handleOCRPress}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size={18} color="#FFFFFF" />
          ) : (
            <Ionicons 
              name="camera" 
              size={18} 
              color="#FFFFFF" 
            />
          )}
          <Text style={styles.ocrButtonText}>
            {isProcessing ? 'Processing...' : buttonText}
          </Text>
        </TouchableOpacity>
      )}

      {showModal && (
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Scan & Search</Text>
                  <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {!extractedText && !isProcessing && (
                  <View style={styles.optionsContainer}>
                    <Text style={styles.instructionText}>
                      Choose how you want to capture text:
                    </Text>
                    
                    <View style={styles.buttonRow}>
                      <Button
                        mode="contained"
                        onPress={handleCameraPress}
                        style={styles.optionButton}
                        icon="camera"
                        disabled={isProcessing}
                      >
                        Camera
                      </Button>
                      
                      <Button
                        mode="outlined"
                        onPress={handleGalleryPress}
                        style={styles.optionButton}
                        icon="image"
                        disabled={isProcessing}
                      >
                        Gallery
                      </Button>
                    </View>
                  </View>
                )}

                {isProcessing && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.processingText}>Processing image...</Text>
                    <Text style={styles.processingSubtext}>
                      Extracting text using Google Cloud Vision
                    </Text>
                  </View>
                )}

                {extractedText && ocrResults && (
                  <View style={styles.resultsContainer}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultTitle}>Extracted Text</Text>
                      {ocrResults.language && (
                        <Chip style={styles.languageChip}>
                          {(ocrResults.language || 'AUTO').toUpperCase()}
                        </Chip>
                      )}
                    </View>
                    
                    <ScrollView 
                      style={styles.scrollableContent}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                    >
                      {/* Translation Controls */}
                      {enableTranslation && needsTranslation && (
                        <View style={styles.translationControls}>
                          <View style={styles.languageInfo}>
                            <Text style={styles.languageInfoText}>
                              Detected: {(ocrResults.language || 'AUTO').toUpperCase()} • App: {(currentLanguage || 'EN').toUpperCase()}
                            </Text>
                            <Text style={styles.languageInfoSubtext}>
                              Translation recommended for better search results
                            </Text>
                          </View>
                          
                          <View style={styles.translationToggle}>
                            <Text style={styles.toggleLabel}>Auto-translate for search:</Text>
                            <Switch
                              value={translationEnabled}
                              onValueChange={setTranslationEnabled}
                              trackColor={{ false: '#e0e0e0', true: '#FF7D00' }}
                              thumbColor={translationEnabled ? '#FFFFFF' : '#f4f3f4'}
                            />
                          </View>
                          
                          {!showTranslation && (
                            <Button
                              mode="outlined"
                              onPress={handleManualTranslation}
                              style={styles.translateButton}
                              icon="translate"
                              disabled={isTranslating}
                              loading={isTranslating}
                            >
                              {isTranslating ? 'Translating...' : `Translate to ${currentLanguage === 'en' ? 'English' : (currentLanguage || 'EN').toUpperCase()}`}
                            </Button>
                          )}
                        </View>
                      )}
                      
                      {/* Show info when no translation is needed */}
                      {enableTranslation && !needsTranslation && (
                        <View style={styles.noTranslationInfo}>
                          <View style={styles.languageMatchInfo}>
                            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                            <Text style={styles.languageMatchText}>
                              Text language matches app language ({(currentLanguage || 'EN').toUpperCase()}) - no translation needed
                            </Text>
                          </View>
                        </View>
                      )}
                      
                      <Text style={styles.instructionText}>
                        Review and edit the extracted text before searching:
                      </Text>
                      
                      <View style={styles.textInputContainer}>
                        <TextInput
                          style={styles.textInput}
                          value={editableText}
                          onChangeText={setEditableText}
                          multiline
                          placeholder="Edit extracted text here..."
                          placeholderTextColor="#999"
                          textAlignVertical="top"
                        />
                      </View>
                      
                      {/* Translation Results */}
                      {showTranslation && translatedText && (
                        <View style={styles.translationContainer}>
                          <View style={styles.translationHeader}>
                            <Text style={styles.translationTitle}>English Translation</Text>
                            <Chip style={styles.translationChip}>
                              EN
                            </Chip>
                          </View>
                          <View style={styles.translationTextContainer}>
                            <Text style={styles.translationText}>{translatedText}</Text>
                          </View>
                          <Text style={styles.translationNote}>
                            Search will use both original and translated text for better results
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                    
                    <View style={styles.actionButtons}>
                      <Button
                        mode="outlined"
                        onPress={closeModal}
                        style={styles.actionButton}
                      >
                        Cancel
                      </Button>
                      
                      {onSearchResult && (
                        <Button
                          mode="contained"
                          onPress={handleSearch}
                          style={styles.actionButton}
                          icon="magnify"
                          disabled={!editableText.trim()}
                        >
                          {translationEnabled && needsTranslation ? 'Smart Search' : 'Search'}
                        </Button>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const createStyles = (screenWidth: number, screenHeight: number) => StyleSheet.create({
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7D00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0,
    minWidth: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  ocrButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: screenWidth > 600 ? '70%' : '95%',
    minWidth: 320,
    maxWidth: screenWidth > 600 ? 600 : screenWidth - 20,
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight > 700 ? 500 : screenHeight * 0.7,
    borderRadius: 16,
    elevation: 8,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  optionButton: {
    flex: 1,
  },
  processingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  resultsContainer: {
    padding: 20,
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  languageChip: {
    backgroundColor: '#e3f2fd',
  },
  textInputContainer: {
    marginBottom: 20,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
  extractedText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF7D00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionButton: {
    flex: 1,
  },
  // Translation Styles
  translationControls: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  translationToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    flex: 1,
  },
  translateButton: {
    borderColor: '#FF7D00',
  },
  translationContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#c3e6c3',
  },
  translationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  translationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d5a2d',
  },
  translationChip: {
    backgroundColor: '#4caf50',
  },
  translationTextContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#a8d4a8',
  },
  translationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  translationNote: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Language Information Styles
  languageInfo: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  languageInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    textAlign: 'center',
  },
  languageInfoSubtext: {
    fontSize: 11,
    color: '#856404',
    textAlign: 'center',
    marginTop: 2,
  },
  noTranslationInfo: {
    backgroundColor: '#d4edda',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  languageMatchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageMatchText: {
    fontSize: 13,
    color: '#155724',
    marginLeft: 6,
    fontWeight: '500',
  },
  // Scrollable Content Styles
  scrollableContent: {
    maxHeight: 400,
    paddingBottom: 10,
  },
});

export default OCRScanner;