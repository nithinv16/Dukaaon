import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AzureSpeechService, { VoiceSearchResult } from '../../services/azureAI/speechService';
import { useTranslation } from '../../contexts/LanguageContext';
import OCRScanner from './OCRScanner';
import { SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';

interface VoiceSearchProps {
  onSearchResult: (query: string, intent?: string, entities?: any) => void;
  onOrderResult?: (productName: string, quantity?: number) => void;
  selectedLanguage?: string;
  placeholder?: string;
  style?: any;
}

const VoiceSearch: React.FC<VoiceSearchProps> = ({
  onSearchResult,
  onOrderResult,
  selectedLanguage = 'en-US',
  placeholder = 'Voice search',
  style
}) => {
  const { translate } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentRecognizer, setCurrentRecognizer] = useState<SpeechRecognizer | null>(null);
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [waveAnimation] = useState(new Animated.Value(0));
  const [azureServiceError, setAzureServiceError] = useState<string | null>(null);

  useEffect(() => {
    // Check Azure configuration on component mount
    try {
      // Just check if the service is available
      if (AzureSpeechService) {
        setAzureServiceError(null);
      } else {
        throw new Error('Azure Speech Service not available');
      }
    } catch (error) {
      setAzureServiceError(error instanceof Error ? error.message : 'Azure Speech Service configuration error');
    }

    return () => {
      // Cleanup recognizer on unmount
      if (currentRecognizer) {
        AzureSpeechService.stopContinuousRecognition(currentRecognizer);
      }
    };
  }, [currentRecognizer]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.timing(waveAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopWaveAnimation = () => {
    waveAnimation.stopAnimation();
    waveAnimation.setValue(0);
  };

  const startVoiceSearch = async () => {
    // Check for Azure configuration errors first
    if (azureServiceError) {
      Alert.alert(
        'Configuration Error',
        azureServiceError + '\n\nPlease check your Azure Speech Service configuration.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if AzureSpeechService is properly initialized
    if (!AzureSpeechService || !AzureSpeechService.startContinuousRecognition) {
      Alert.alert(
        'Service Unavailable',
        'Speech recognition service is not available. This might be due to a missing crypto polyfill.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsModalVisible(true);
      setIsListening(true);
      setRecognizedText('');
      setTranslatedText('');
      setShowConfirmation(false);
      startPulseAnimation();
      startWaveAnimation();

      const recognizer = AzureSpeechService.startContinuousRecognition(
        selectedLanguage,
        async (result) => {
          console.log('Azure Speech Recognition Result:', result);
          console.log('Recognized text:', result.text);
          console.log('Confidence:', result.confidence);
          console.log('Is interim result:', result.confidence <= 0.8);
          
          // Always update the UI with interim results for live transcription
          setRecognizedText(result.text);
          
          // Only process final results with high confidence to avoid interference
          if (result.confidence > 0.8 && result.text.trim()) {
            await processVoiceResult(result.text);
          }
        },
        (error) => {
          console.error('Voice recognition error:', error);
          Alert.alert('Error', 'Voice recognition failed. Please try again.');
          stopVoiceSearch();
        }
      );

      setCurrentRecognizer(recognizer);
    } catch (error) {
      console.error('Failed to start voice search:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('crypto.getRandomValues')) {
        Alert.alert(
          'Initialization Error',
          'Speech recognition requires crypto.getRandomValues() which is not available. Please restart the app.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes('Azure Speech Service key') || errorMessage.includes('Azure Speech Service region')) {
        Alert.alert(
          'Configuration Error',
          errorMessage + '\n\nPlease check your .env file and ensure all Azure credentials are properly configured.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to start voice recognition. Please check your microphone permissions.');
      }
      
      setIsModalVisible(false);
      setIsListening(false);
    }
  };

  const stopVoiceSearch = async () => {
    if (currentRecognizer) {
      AzureSpeechService.stopContinuousRecognition(currentRecognizer);
      setCurrentRecognizer(null);
    }

    setIsListening(false);
    stopPulseAnimation();
    stopWaveAnimation();

    if (recognizedText.trim()) {
      setIsProcessing(true);
      
      // Translate text if needed
      let translatedQuery = recognizedText;
      if (selectedLanguage !== 'en-US' && selectedLanguage !== 'en-IN') {
        try {
          const languageCode = selectedLanguage.split('-')[0];
          translatedQuery = await translate(recognizedText, 'en');
          setTranslatedText(translatedQuery);
        } catch (error) {
          console.error('Translation error:', error);
          setTranslatedText(recognizedText); // Fallback to original text
        }
      } else {
        setTranslatedText(recognizedText);
      }
      
      setIsProcessing(false);
      setShowConfirmation(true);
    } else {
      // No text recognized, close modal
      setIsModalVisible(false);
      resetVoiceSearch();
    }
  };

  const resetVoiceSearch = () => {
    setRecognizedText('');
    setTranslatedText('');
    setShowConfirmation(false);
    setIsProcessing(false);
  };

  const confirmAndSearch = async () => {
    const searchQuery = translatedText || recognizedText;
    
    try {
      // Process the voice command to extract intent and entities
      const voiceResult: VoiceSearchResult = await AzureSpeechService.voiceSearch(selectedLanguage);
      
      // Handle different intents
      switch (voiceResult.intent) {
        case 'order':
          if (onOrderResult && voiceResult.entities.productName) {
            onOrderResult(voiceResult.entities.productName, voiceResult.entities.quantity);
            await speakResponse(`Adding ${voiceResult.entities.productName} to your cart.`);
          } else {
            onSearchResult(searchQuery, 'order', voiceResult.entities);
          }
          break;
          
        case 'search':
          onSearchResult(searchQuery, 'search', voiceResult.entities);
          await speakResponse(`Searching for ${voiceResult.entities.productName || searchQuery}.`);
          break;
          
        case 'navigate':
          onSearchResult(searchQuery, 'navigate', voiceResult.entities);
          break;
          
        default:
          onSearchResult(searchQuery, 'search', voiceResult.entities);
          break;
      }
    } catch (error) {
      console.error('Error processing voice result:', error);
      // Fallback to simple search
      onSearchResult(searchQuery);
    }
    
    // Close modal and reset state
    setIsModalVisible(false);
    resetVoiceSearch();
  };

  const cancelSearch = () => {
    setIsModalVisible(false);
    resetVoiceSearch();
  };

  const speakResponse = async (text: string) => {
    try {
      const voiceNames = AzureSpeechService.getVoiceNames(selectedLanguage);
      const voiceName = voiceNames[0]; // Use first available voice
      
      // Translate response if needed
      let responseText = text;
      if (selectedLanguage !== 'en-US' && selectedLanguage !== 'en-IN') {
        try {
          const languageCode = selectedLanguage.split('-')[0];
          responseText = await translate(text, languageCode);
        } catch (error) {
          console.error('Translation error:', error);
          responseText = text; // Fallback to original text
        }
      }
      
      await AzureSpeechService.textToSpeech(responseText, selectedLanguage, voiceName);
    } catch (error) {
      console.error('Text-to-speech error:', error);
    }
  };

  const renderWaveform = () => {
    const waves = Array.from({ length: 5 }, (_, index) => {
      const animatedHeight = waveAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [10, 30 + index * 5],
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.wave,
            {
              height: animatedHeight,
              marginHorizontal: 2,
              backgroundColor: isListening ? '#4CAF50' : '#ccc',
            },
          ]}
        />
      );
    });

    return <View style={styles.waveContainer}>{waves}</View>;
  };

  const handleOCRTextExtracted = (text: string, language: string) => {
    console.log('OCR text extracted:', text, 'Language:', language);
  };

  const handleOCRSearchResult = (query: string, language: string, translatedQuery?: string, originalText?: string) => {
    console.log('OCR search triggered:', query, 'Language:', language);
    if (translatedQuery) {
      console.log('Translated query:', translatedQuery, 'Original text:', originalText);
    }
    // Trigger search with the OCR extracted text and multilingual parameters
    onSearchResult(query, 'ocr', { 
      originalText, 
      translatedQuery, 
      language,
      userLanguage: language,
      isMultilingual: true 
    });
  };

  return (
    <>
      <View style={[styles.buttonContainer, style]}>
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={startVoiceSearch}
          activeOpacity={0.7}
        >
          <Ionicons name="mic" size={18} color="#666" />
          <Text style={styles.voiceButtonText}>{placeholder}</Text>
        </TouchableOpacity>
        
        <OCRScanner
          onTextExtracted={handleOCRTextExtracted}
          onSearchResult={handleOCRSearchResult}
          buttonText="OCR"
          showModal={true}
          enableTranslation={true}
          autoTranslate={true}
        />
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={stopVoiceSearch}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Voice Search'}
            </Text>

            <Animated.View
              style={[
                styles.microphoneContainer,
                {
                  transform: [{ scale: pulseAnimation }],
                },
              ]}
            >
              <Ionicons
                name="mic"
                size={60}
                color={isListening ? '#4CAF50' : '#666'}
              />
            </Animated.View>

            {renderWaveform()}

            {showConfirmation ? (
              <View style={styles.transcriptionContainer}>
                <Text style={styles.transcriptionTitle}>Voice Transcription:</Text>
                
                <View style={styles.textContainer}>
                  <Text style={styles.transcriptionLabel}>Original ({selectedLanguage}):</Text>
                  <Text style={styles.recognizedText}>{recognizedText}</Text>
                </View>
                
                {translatedText && translatedText !== recognizedText && (
                  <View style={styles.textContainer}>
                    <Text style={styles.transcriptionLabel}>Translated (English):</Text>
                    <Text style={styles.translatedText}>{translatedText}</Text>
                  </View>
                )}
                
                <Text style={styles.confirmationText}>
                  Use this transcription as search keyword?
                </Text>
              </View>
            ) : recognizedText ? (
              <View style={styles.textContainer}>
                <Text style={styles.recognizedText}>{recognizedText}</Text>
              </View>
            ) : (
              <Text style={styles.instructionText}>
                {isListening ? 'Speak now...' : 'Tap the microphone to start'}
              </Text>
            )}

            <View style={styles.buttonContainer}>
              {showConfirmation ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.confirmButton]}
                    onPress={confirmAndSearch}
                  >
                    <Ionicons name="checkmark" size={24} color="white" />
                    <Text style={styles.buttonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={cancelSearch}
                  >
                    <Ionicons name="close" size={24} color="white" />
                    <Text style={styles.buttonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : isListening ? (
                <TouchableOpacity
                  style={[styles.actionButton, styles.stopButton]}
                  onPress={stopVoiceSearch}
                >
                  <Ionicons name="stop" size={24} color="white" />
                  <Text style={styles.buttonText}>Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={cancelSearch}
                >
                  <Ionicons name="close" size={24} color="white" />
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
    maxWidth: 140,
  },
  voiceButtonText: {
    marginLeft: 6,
    color: '#666',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: width * 0.8,
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  microphoneContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginBottom: 20,
  },
  wave: {
    width: 4,
    borderRadius: 2,
  },
  transcriptionContainer: {
    width: '100%',
    marginBottom: 20,
  },
  transcriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  transcriptionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 5,
  },
  textContainer: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  recognizedText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  translatedText: {
    fontSize: 16,
    color: '#2196F3',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  confirmationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginHorizontal: 5,
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoiceSearch;