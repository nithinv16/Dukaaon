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
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip } from 'react-native-paper';
import { AZURE_AI_CONFIG } from '../../config/azureAI';
import LanguageDetectionService, { DetectedLanguage } from '../../services/azureAI/languageDetectionService';
import { useTranslation } from '../../contexts/LanguageContext';
import NativeAzureSpeechService from '../../services/azureAI/nativeAzureSpeechService';

// Import Expo Speech for React Native compatibility
import * as Speech from 'expo-speech';

// For web platform, we'll use a different approach
let SpeechRecognition: any = null;
let useSpeechRecognition: any = null;

if (Platform.OS === 'web') {
  try {
    // Dynamic import for web-only speech recognition
    const speechModule = require('react-speech-recognition');
    SpeechRecognition = speechModule.default;
    useSpeechRecognition = speechModule.useSpeechRecognition;
  } catch (error) {
    console.warn('react-speech-recognition not available:', error);
  }
}

interface VoiceSearchProps {
  onSearchResult: (query: string, detectedLanguage: string, intent?: string, entities?: any) => void;
  onOrderResult?: (productName: string, quantity?: number, detectedLanguage?: string) => void;
  style?: any;
  placeholder?: string;
  compact?: boolean;
}



interface VoiceIntent {
  intent: string;
  confidence: number;
  entities: {
    productName?: string;
    quantity?: number;
    category?: string;
    action?: string;
  };
}

const { width } = Dimensions.get('window');

const EnhancedVoiceSearch: React.FC<VoiceSearchProps> = ({
  onSearchResult,
  onOrderResult,
  style,
  placeholder = 'Tap to speak in any language...',
  compact = false
}) => {
  const { translate } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedLanguages, setDetectedLanguages] = useState<DetectedLanguage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [showTranslation, setShowTranslation] = useState(false);
  const [recordingService] = useState(() => new NativeAzureSpeechService(
    AZURE_AI_CONFIG.speechKey,
    AZURE_AI_CONFIG.speechRegion
  ));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [waveAnimation] = useState(new Animated.Value(0));
  const [processingStep, setProcessingStep] = useState('');
  const [azureServiceError, setAzureServiceError] = useState<string | null>(null);

  // Supported languages for automatic detection
  const supportedLanguages = [
    { code: 'en-US', name: 'English', displayName: 'English (US)' },
    { code: 'hi-IN', name: 'Hindi', displayName: 'हिंदी (Hindi)' },
    { code: 'te-IN', name: 'Telugu', displayName: 'తెలుగు (Telugu)' },
    { code: 'ta-IN', name: 'Tamil', displayName: 'தமிழ் (Tamil)' },
    { code: 'kn-IN', name: 'Kannada', displayName: 'ಕನ್ನಡ (Kannada)' },
    { code: 'ml-IN', name: 'Malayalam', displayName: 'മലയാളം (Malayalam)' },
    { code: 'bn-IN', name: 'Bengali', displayName: 'বাংলা (Bengali)' },
    { code: 'gu-IN', name: 'Gujarati', displayName: 'ગુજરાતી (Gujarati)' },
    { code: 'mr-IN', name: 'Marathi', displayName: 'मराठी (Marathi)' },
    { code: 'pa-IN', name: 'Punjabi', displayName: 'ਪੰਜਾਬੀ (Punjabi)' },
  ];

  useEffect(() => {
    // Check Azure configuration on component mount
    try {
      if (!AZURE_AI_CONFIG.speechKey || !AZURE_AI_CONFIG.speechRegion) {
        throw new Error('Azure Speech Service configuration missing');
      }
      setAzureServiceError(null);
    } catch (error) {
      setAzureServiceError(error instanceof Error ? error.message : 'Azure Speech Service configuration error');
    }

    return () => {
      // Cleanup recording on unmount
      if (recordingService.isCurrentlyRecording()) {
        try {
          recordingService.cleanup();
        } catch (error) {
          console.error('Error stopping recording:', error);
        }
      }
    };
  }, [recordingService]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
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
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopWaveAnimation = () => {
    waveAnimation.stopAnimation();
    waveAnimation.setValue(0);
  };



  const analyzeIntent = (text: string, language: string): VoiceIntent => {
    const lowerText = text.toLowerCase();
    
    // Order intent keywords by language
    const orderKeywords = {
      'en-US': ['order', 'buy', 'purchase', 'add to cart', 'i want', 'i need'],
      'hi-IN': ['ऑर्डर', 'खरीदना', 'चाहिए', 'लेना', 'मंगवाना'],
      'te-IN': ['ఆర్డర్', 'కొనాలి', 'కావాలి', 'తీసుకోవాలి'],
      'ta-IN': ['ஆர்டர்', 'வாங்க', 'வேண்டும்', 'கொள்ள'],
      'kn-IN': ['ಆರ್ಡರ್', 'ಖರೀದಿಸು', 'ಬೇಕು', 'ತೆಗೆದುಕೊಳ್ಳು'],
    };

    // Search intent keywords
    const searchKeywords = {
      'en-US': ['search', 'find', 'look for', 'show me', 'where is'],
      'hi-IN': ['खोजना', 'ढूंढना', 'दिखाओ', 'कहाँ है'],
      'te-IN': ['వెతకు', 'కనుగొను', 'చూపించు', 'ఎక్కడ ఉంది'],
      'ta-IN': ['தேடு', 'கண்டுபிடி', 'காட்டு', 'எங்கே இருக்கிறது'],
      'kn-IN': ['ಹುಡುಕು', 'ಕಂಡುಹಿಡಿ', 'ತೋರಿಸು', 'ಎಲ್ಲಿದೆ'],
    };

    const langOrderKeywords = orderKeywords[language as keyof typeof orderKeywords] || orderKeywords['en-US'];
    const langSearchKeywords = searchKeywords[language as keyof typeof searchKeywords] || searchKeywords['en-US'];

    // Check for order intent
    const hasOrderKeyword = langOrderKeywords.some(keyword => lowerText.includes(keyword));
    if (hasOrderKeyword) {
      // Extract product name and quantity
      const words = text.split(' ');
      const productName = words.slice(1).join(' '); // Assume product name comes after intent
      const quantityMatch = text.match(/(\d+)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      return {
        intent: 'order',
        confidence: 0.8,
        entities: { productName, quantity }
      };
    }

    // Check for search intent
    const hasSearchKeyword = langSearchKeywords.some(keyword => lowerText.includes(keyword));
    if (hasSearchKeyword) {
      return {
        intent: 'search',
        confidence: 0.8,
        entities: { productName: text }
      };
    }

    // Default to search
    return {
      intent: 'search',
      confidence: 0.6,
      entities: { productName: text }
    };
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

    try {
      setIsModalVisible(true);
      setIsListening(true);
      setRecognizedText('');
      setTranslatedText('');
      setShowTranslation(false);
      setDetectedLanguages([]);
      setProcessingStep('Initializing...');
      startPulseAnimation();
      startWaveAnimation();

      if (Platform.OS === 'web' && SpeechRecognition) {
        // Use Web Speech API for web platform
        await startWebSpeechRecognition();
      } else {
        // Use React Native compatible approach
        await startReactNativeSpeechRecognition();
      }
    } catch (error) {
      console.error('Failed to start voice search:', error);
      setProcessingStep('Error occurred');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Check for specific React Native compatibility issues
      if (errorMessage.includes('Web Audio API') || 
          errorMessage.includes('AudioContext') ||
          errorMessage.includes('privAudioSource') ||
          errorMessage.includes('microphone')) {
        Alert.alert(
          'Platform Compatibility Issue',
          'Speech recognition is not fully supported in this React Native environment. Please try using the web version of the app for optimal voice search functionality.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Voice Search Error',
          `Failed to start voice search: ${errorMessage}`,
          [{ text: 'OK' }]
        );
      }
      
      // Cleanup and reset state
      setTimeout(() => {
        cancelVoiceSearch();
      }, 2000);
    }
  };

  const startWebSpeechRecognition = async () => {
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not available on this platform');
    }

    setProcessingStep('Starting web speech recognition...');
    
    try {
      // Configure speech recognition
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
        language: 'en-US' // Default language, can be made dynamic
      });
      
      setProcessingStep('Listening...');
      console.log('Web speech recognition started successfully');
    } catch (error) {
      console.error('Web speech recognition failed:', error);
      throw error;
    }
  };

  const startReactNativeSpeechRecognition = async () => {
    setProcessingStep('Starting recording...');
    
    try {
      console.log('Using React Native Speech Service...');
      console.log('Starting recording with language:', selectedLanguage || 'en-US');
      
      // Start recording
      await recordingService.startRecording();
      setProcessingStep('Listening... Speak now');
      console.log('Recording started successfully');
      
      // Set a timeout to automatically stop recording after 30 seconds
      setTimeout(() => {
        if (recordingService.isCurrentlyRecording() && isListening) {
          console.log('Auto-stopping recording after timeout');
          stopVoiceSearch();
        }
      }, 30000); // 30 seconds timeout
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setProcessingStep('Failed to start recording');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Recording Error',
        `Failed to start recording: ${errorMessage}. Please check microphone permissions.`,
        [{ text: 'OK', onPress: () => cancelVoiceSearch() }]
      );
    }
  };

  // Web Speech Recognition hook integration
  const webSpeechHook = Platform.OS === 'web' && useSpeechRecognition ? useSpeechRecognition() : null;

  useEffect(() => {
    if (Platform.OS === 'web' && webSpeechHook) {
      const { transcript, listening, resetTranscript } = webSpeechHook;
      
      if (transcript && transcript.trim()) {
        setRecognizedText(transcript);
        setProcessingStep('Processing speech...');
        
        // Process the final transcript when listening stops
        if (!listening && transcript) {
          processRecognizedText(transcript);
        }
      }
      
      setIsListening(listening);
      
      if (!listening && isListening) {
        // Speech recognition stopped
        stopPulseAnimation();
        stopWaveAnimation();
      }
    }
  }, [webSpeechHook?.transcript, webSpeechHook?.listening, isListening]);

  const processRecognizedText = async (text: string) => {
    try {
      console.log('Processing recognized text:', text);
      setProcessingStep('Analyzing language...');
      
      // Use our enhanced language detection service
      const enhancedDetection = await LanguageDetectionService.detectLanguage(text);
      
      setDetectedLanguages(enhancedDetection);
      
      if (enhancedDetection.length > 0) {
        const primaryLanguage = enhancedDetection[0];
        setSelectedLanguage(primaryLanguage.language);
        
        setProcessingStep('Analyzing intent...');
        
        // Analyze user intent
        const intent = analyzeIntent(text, primaryLanguage.language);
        console.log('Detected intent:', intent);
        
        // Handle translation if needed
        if (primaryLanguage.language !== 'en-US') {
          setProcessingStep('Translating...');
          try {
            const translatedResult = await translate(text, 'en');
            setTranslatedText(translatedResult);
            setShowTranslation(true);
          } catch (translationError) {
            console.error('Translation failed:', translationError);
            setShowTranslation(false);
          }
        }
        
        setProcessingStep('Complete!');
        
        // Execute the appropriate callback based on intent
        if (intent.intent === 'order' && onOrderResult && intent.entities.productName) {
          onOrderResult(
            intent.entities.productName,
            intent.entities.quantity,
            primaryLanguage.language
          );
        } else {
          onSearchResult(
            text,
            primaryLanguage.language,
            intent.intent,
            intent.entities
          );
        }
        
        // Auto-close modal after processing
        setTimeout(() => {
          setIsModalVisible(false);
          resetVoiceSearch();
        }, 2000);
      }
    } catch (error) {
      console.error('Error processing recognized text:', error);
      setProcessingStep('Processing failed');
      Alert.alert(
        'Processing Error',
        'Failed to process the recognized speech. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const resetVoiceSearch = () => {
    setRecognizedText('');
    setTranslatedText('');
    setShowTranslation(false);
    setDetectedLanguages([]);
    setSelectedLanguage('en-US');
    setProcessingStep('');
    setIsListening(false);
    stopPulseAnimation();
  };

  const stopVoiceSearch = async () => {
    if (Platform.OS === 'web' && SpeechRecognition) {
      try {
        SpeechRecognition.stopListening();
        console.log('Web speech recognition stopped');
      } catch (error) {
        console.error('Error stopping web speech recognition:', error);
      }
    } else if (recordingService.isCurrentlyRecording()) {
      // Stop recording and transcribe
      setProcessingStep('Processing audio...');
      setIsListening(false);
      stopPulseAnimation();
      stopWaveAnimation();
      
      try {
        const transcribedText = await recordingService.stopRecording();
        
        if (transcribedText && transcribedText.trim()) {
          setProcessingStep('Processing result...');
          console.log('Transcription result:', transcribedText);
          setRecognizedText(transcribedText);
          
          await handleVoiceSearchResult(transcribedText);
        } else {
          console.warn('No speech recognized');
          setProcessingStep('No speech recognized');
        }
      } catch (error) {
        console.error('Error processing recording:', error);
        setProcessingStep('Processing failed');
        Alert.alert(
          'Processing Error',
          'Failed to process the recording. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
    
    setIsListening(false);
    stopPulseAnimation();
    stopWaveAnimation();

    setTimeout(() => {
      setIsModalVisible(false);
      setRecognizedText('');
      setDetectedLanguages([]);
      setSelectedLanguage('');
      setProcessingStep('');
    }, 1500);
  };

  const processVoiceResult = async (text: string, detectedLang: string) => {
    try {
      setProcessingStep('Processing language...');
      
      // Translate to English if needed for better search results
      let translatedText = text;
      if (detectedLang !== 'en') {
        try {
          translatedText = await translate(text, 'en');
        } catch (error) {
          console.error('Translation failed:', error);
        }
      }
      
      console.log('Translation result:', { originalText: text, translatedText, language: detectedLang });
      
      // Update UI with translation if needed
      if (detectedLang !== 'en' && translatedText !== text) {
        setTranslatedText(translatedText);
        setShowTranslation(true);
      } else {
        setShowTranslation(false);
      }
      
      // Analyze intent using both original and translated text
      const voiceIntent = analyzeIntent(text, detectedLang);
      
      setProcessingStep('Understanding request...');
      
      // Use translated text for search if available, otherwise use original
      const searchText = translatedText || text;
      
      // Enhanced entities with translation info
      const enhancedEntities = {
        ...voiceIntent.entities,
        originalText: text,
        translatedText: translatedText || text,
        searchQuery: searchText,
        detectedLanguage: detectedLang,
        translationConfidence: detectedLang !== 'en' ? 0.9 : 1.0
      };
      
      // Handle different intents
      switch (voiceIntent.intent) {
        case 'order':
          if (onOrderResult && voiceIntent.entities.productName) {
            // Use translated product name for better matching
            const productName = detectedLang !== 'en' ? 
              translatedText : voiceIntent.entities.productName;
            
            onOrderResult(
              productName,
              voiceIntent.entities.quantity,
              detectedLang
            );
          } else {
            onSearchResult(searchText, detectedLang, 'order', enhancedEntities);
          }
          break;
          
        case 'search':
        default:
          onSearchResult(searchText, detectedLang, voiceIntent.intent, enhancedEntities);
          break;
      }
      
      setProcessingStep('Complete!');
    } catch (error) {
      console.error('Error processing voice result:', error);
      Alert.alert('Error', 'Failed to process voice command. Please try again.');
    }
  };

  const handleVoiceSearchResult = async (recognizedText: string) => {
    try {
      setProcessingStep('Processing voice command...');
      
      // Detect language if not already detected
      if (detectedLanguages.length === 0) {
        const detected = await LanguageDetectionService.detectLanguage(recognizedText);
        setDetectedLanguages(detected);
        
        if (detected.length > 0) {
          setSelectedLanguage(detected[0].language);
        }
      }
      
      // Translate if needed
      let finalText = recognizedText;
      const primaryLang = detectedLanguages[0];
      if (primaryLang && primaryLang.language !== 'en-US' && primaryLang.confidence > 0.7) {
        setProcessingStep('Translating...');
        try {
          const translated = await translate(recognizedText, 'en');
          setTranslatedText(translated);
          setShowTranslation(true);
          finalText = translated;
        } catch (error) {
          console.error('Translation failed:', error);
          finalText = recognizedText; // Fallback to original text
        }
      }
      
      setProcessingStep('Executing search...');
      
      // Trigger the appropriate callback with correct parameters
      if (onSearchResult) {
        onSearchResult(
          finalText,
          primaryLang?.language || 'en-US',
          'search',
          {
            originalText: recognizedText,
            translatedText: finalText,
            confidence: primaryLang?.confidence || 1.0
          }
        );
      }
      
      // Auto-close after successful processing
      setTimeout(() => {
        cancelVoiceSearch();
      }, 1500);
      
    } catch (error) {
      console.error('Error handling voice search result:', error);
      setProcessingStep('Processing failed');
      Alert.alert(
        'Processing Error',
        'Failed to process voice command. Please try again.',
        [{ text: 'OK', onPress: () => cancelVoiceSearch() }]
      );
    }
  };

  const cancelVoiceSearch = () => {
    if (Platform.OS === 'web' && SpeechRecognition) {
      try {
        SpeechRecognition.abortListening();
        if (webSpeechHook?.resetTranscript) {
          webSpeechHook.resetTranscript();
        }
      } catch (error) {
        console.error('Error canceling web speech recognition:', error);
      }
    } else if (recordingService.isCurrentlyRecording()) {
      // Stop any ongoing recording
      try {
        recordingService.cleanup();
        console.log('Recording stopped successfully');
      } catch (error) {
        console.log('Error stopping recording:', error);
      }
    }
    
    setIsModalVisible(false);
    setIsListening(false);
    resetVoiceSearch();
    stopPulseAnimation();
    stopWaveAnimation();
  };

  return (
    <>
      <TouchableOpacity
        style={[compact ? styles.compactVoiceButton : styles.voiceButton, style]}
        onPress={startVoiceSearch}
        disabled={azureServiceError !== null}
      >
        <Ionicons 
          name="mic" 
          size={compact ? 20 : 24} 
          color={azureServiceError ? "#ccc" : "#666"} 
        />
        {!compact && (
          <Text style={[styles.buttonText, azureServiceError && styles.disabledText]}>
            {placeholder}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelVoiceSearch}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Card.Content style={styles.modalContent}>
              {/* Microphone Animation */}
              <View style={styles.micContainer}>
                <Animated.View
                  style={[
                    styles.micButton,
                    {
                      transform: [{ scale: pulseAnimation }],
                      backgroundColor: isListening ? '#007AFF' : '#f0f0f0',
                    },
                  ]}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-off"}
                    size={32}
                    color={isListening ? "white" : "#666"}
                  />
                </Animated.View>
                
                {/* Wave Animation */}
                {isListening && (
                  <Animated.View
                    style={[
                      styles.waveCircle,
                      {
                        opacity: waveAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 0],
                        }),
                        transform: [
                          {
                            scale: waveAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                )}
              </View>

              {/* Status Text */}
              <Text style={styles.statusText}>
                {isProcessing ? processingStep : isListening ? 'Listening...' : 'Tap to speak'}
              </Text>

              {/* Transcription */}
              {(recognizedText || isListening) && (
                <View style={styles.transcriptionContainer}>
                  <Text style={styles.transcriptionLabel}>
                    {isListening ? '🎤 Live Transcription:' : '📝 Transcription:'}
                  </Text>
                  <View style={[styles.textContainer, isListening && styles.listeningContainer]}>
                    <Text style={[styles.recognizedText, isListening && styles.listeningText]}>
                      {recognizedText || (isListening ? 'Listening for speech...' : '')}
                    </Text>
                    {isListening && !recognizedText && (
                      <Text style={styles.hintText}>Speak clearly for better recognition</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Translation */}
              {showTranslation && translatedText && (
                <View style={styles.translationContainer}>
                  <Text style={styles.translationLabel}>🌐 English Translation:</Text>
                  <View style={styles.textContainer}>
                    <Text style={styles.translatedText}>
                      {translatedText}
                    </Text>
                    <Text style={styles.translationNote}>
                      Search will use this translation for better results
                    </Text>
                  </View>
                </View>
              )}

              {/* Detected Languages */}
              {detectedLanguages.length > 0 && (
                <View style={styles.languageContainer}>
                  <Text style={styles.languageLabel}>Detected Language:</Text>
                  {detectedLanguages.map((lang, index) => (
                    <Chip
                      key={index}
                      style={styles.languageChip}
                      textStyle={styles.languageChipText}
                    >
                      {lang.displayName} ({Math.round(lang.confidence * 100)}%)
                    </Chip>
                  ))}
                </View>
              )}

              {/* Processing Indicator */}
              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={cancelVoiceSearch}
                  style={styles.cancelButton}
                >
                  Cancel
                </Button>
                {isListening && (
                  <Button
                    mode="contained"
                    onPress={stopVoiceSearch}
                    style={styles.stopButton}
                  >
                    Stop
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7D00',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  compactVoiceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  disabledText: {
    color: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 16,
    elevation: 8,
  },
  modalContent: {
    alignItems: 'center',
    padding: 24,
  },
  micContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  waveCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  transcriptionContainer: {
    width: '100%',
    marginBottom: 16,
  },
  transcriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'left',
  },
  translationContainer: {
    width: '100%',
    marginBottom: 16,
  },
  translationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'left',
  },
  translatedText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    lineHeight: 24,
    fontWeight: '500',
  },
  translationNote: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  textContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    minHeight: 50,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  recognizedText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    lineHeight: 24,
    fontStyle: 'normal',
  },
  listeningContainer: {
    borderLeftColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  listeningText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  languageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  languageLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  languageChip: {
    backgroundColor: '#e3f2fd',
    marginBottom: 4,
  },
  languageChipText: {
    fontSize: 12,
    color: '#1976d2',
  },
  processingContainer: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    borderColor: '#dc3545',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
});

export default EnhancedVoiceSearch;
