import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Chip, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface VoiceOrderItem {
  product_id: string;
  name?: string;
  quantity: number;
  price?: number;
  added_at: Date;
}

interface VoiceOrderSession {
  id: string;
  userId: string;
  isActive: boolean;
  language: string;
  context: {
    cart: VoiceOrderItem[];
    totalAmount: number;
    currentStep: 'listening' | 'processing' | 'confirming' | 'completed';
  };
  startTime: Date;
  lastActivity: Date;
}

interface VoiceOrderingInterfaceProps {
  userId: string;
  onOrderComplete?: (orderId: string, items: VoiceOrderItem[]) => void;
  onSessionEnd?: () => void;
  style?: any;
  language?: string;
  autoStart?: boolean;
}

const VoiceOrderingInterface: React.FC<VoiceOrderingInterfaceProps> = ({
  userId,
  onOrderComplete,
  onSessionEnd,
  style,
  language = 'en-US',
  autoStart = false
}) => {
  const [session, setSession] = useState<VoiceOrderSession | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<string>('continue_listening');
  
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (autoStart) {
      startVoiceOrdering();
    }
  }, [autoStart]);

  useEffect(() => {
    // Animate microphone when listening
    if (isListening) {
      startPulseAnimation();
      startWaveAnimation();
    } else {
      stopAnimations();
    }
  }, [isListening]);

  useEffect(() => {
    // Play audio response if available
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(console.error);
    }
  }, [audioUrl]);

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

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.timing(waveAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopAnimations = () => {
    pulseAnimation.stopAnimation();
    waveAnimation.stopAnimation();
    pulseAnimation.setValue(1);
    waveAnimation.setValue(0);
  };

  const startVoiceOrdering = async () => {
    try {
      setIsProcessing(true);
      setIsModalVisible(true);

      const response = await fetch('/api/ai/voice/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          userId,
          language
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setSession(data.session);
      setAiResponse(data.aiResponse);
      setAudioUrl(data.audioResponse);
      setSuggestions(data.suggestions || []);
      setNextAction(data.nextAction || 'continue_listening');

    } catch (error) {
      console.error('Error starting voice ordering:', error);
      Alert.alert('Error', 'Failed to start voice ordering. Please try again.');
      setIsModalVisible(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = async () => {
    if (!session) return;

    try {
      setIsListening(true);
      setTranscript('');
      
      // Start recording audio
      const mediaRecorder = await startAudioRecording();
      
      // Stop recording after 10 seconds or when user stops
      setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 10000);

    } catch (error) {
      console.error('Error starting listening:', error);
      Alert.alert('Error', 'Failed to start listening. Please check microphone permissions.');
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (!session || !isListening) return;

    try {
      setIsListening(false);
      setIsProcessing(true);

      // Stop audio recording and get the blob
      const audioBlob = await stopAudioRecording();
      
      if (audioBlob) {
        await processVoiceCommand(audioBlob);
      }

    } catch (error) {
      console.error('Error stopping listening:', error);
      Alert.alert('Error', 'Failed to process voice command.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processVoiceCommand = async (audioBlob: Blob) => {
    if (!session) return;

    try {
      const formData = new FormData();
      formData.append('action', 'process');
      formData.append('sessionId', session.id);
      formData.append('userId', userId);
      formData.append('language', session.language);
      formData.append('audio', audioBlob, 'voice_command.webm');

      const response = await fetch('/api/ai/voice/order', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setTranscript(data.transcript || '');
      setAiResponse(data.aiResponse);
      setSession(data.session);
      setAudioUrl(data.audioResponse);
      setSuggestions(data.suggestions || []);
      setNextAction(data.nextAction || 'continue_listening');

    } catch (error) {
      console.error('Error processing voice command:', error);
      setAiResponse('Sorry, I had trouble understanding that. Could you please try again?');
    }
  };

  const confirmOrder = async () => {
    if (!session) return;

    try {
      setIsProcessing(true);

      const response = await fetch('/api/ai/voice/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'confirm',
          sessionId: session.id,
          userId
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAiResponse(data.aiResponse);
      setAudioUrl(data.audioResponse);
      
      if (data.session && !data.session.isActive) {
        // Order completed
        onOrderComplete?.(data.orderId || 'unknown', session.context.cart);
        setTimeout(() => {
          endSession();
        }, 3000);
      }

    } catch (error) {
      console.error('Error confirming order:', error);
      Alert.alert('Error', 'Failed to confirm order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelOrder = async () => {
    if (!session) return;

    try {
      const response = await fetch('/api/ai/voice/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          sessionId: session.id,
          userId
        }),
      });

      const data = await response.json();
      setAiResponse(data.aiResponse);
      
    } catch (error) {
      console.error('Error cancelling order:', error);
    } finally {
      endSession();
    }
  };

  const endSession = () => {
    setSession(null);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setAiResponse('');
    setAudioUrl(null);
    setSuggestions([]);
    setIsModalVisible(false);
    onSessionEnd?.();
  };

  const handleSuggestionPress = (suggestion: string) => {
    // Convert suggestion to audio and process
    const utterance = new SpeechSynthesisUtterance(suggestion);
    utterance.lang = language;
    speechSynthesis.speak(utterance);
    
    // Simulate processing the suggestion as voice input
    setTranscript(suggestion);
    // You could also call processVoiceCommand with a synthesized audio blob
  };

  // Audio recording functions (simplified - would need proper implementation)
  const startAudioRecording = async (): Promise<MediaRecorder> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    return mediaRecorder;
  };

  const stopAudioRecording = async (): Promise<Blob | null> => {
    // This would return the recorded audio blob
    // Implementation depends on the MediaRecorder setup
    return null;
  };

  const renderWaveform = () => {
    const waves = Array.from({ length: 5 }, (_, i) => (
      <Animated.View
        key={i}
        style={[
          styles.wave,
          {
            height: waveAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 20 + i * 4],
            }),
            backgroundColor: isListening ? '#4CAF50' : '#ddd',
          },
        ]}
      />
    ));

    return <View style={styles.waveContainer}>{waves}</View>;
  };

  const renderOrderSummary = () => {
    if (!session || session.context.cart.length === 0) return null;

    return (
      <Card style={styles.orderSummaryCard}>
        <Card.Content>
          <Text style={styles.orderSummaryTitle}>Current Order</Text>
          {session.context.cart.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <Text style={styles.orderItemName}>
                {item.name || `Product ${item.product_id}`}
              </Text>
              <Text style={styles.orderItemDetails}>
                Qty: {item.quantity} • ₹{item.price || 100}
              </Text>
            </View>
          ))}
          <View style={styles.orderTotal}>
            <Text style={styles.orderTotalText}>
              Total: ₹{session.context.totalAmount}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderActionButtons = () => {
    if (!session) return null;

    return (
      <View style={styles.actionButtons}>
        {nextAction === 'continue_listening' && (
          <Button
            mode="contained"
            onPress={isListening ? stopListening : startListening}
            disabled={isProcessing}
            style={[styles.actionButton, styles.primaryButton]}
            labelStyle={styles.buttonText}
          >
            {isListening ? 'Stop Listening' : 'Start Speaking'}
          </Button>
        )}
        
        {nextAction === 'confirm_order' && (
          <>
            <Button
              mode="contained"
              onPress={confirmOrder}
              disabled={isProcessing}
              style={[styles.actionButton, styles.confirmButton]}
              labelStyle={styles.buttonText}
            >
              Confirm Order
            </Button>
            <Button
              mode="outlined"
              onPress={startListening}
              disabled={isProcessing}
              style={styles.actionButton}
            >
              Add More Items
            </Button>
          </>
        )}
        
        <Button
          mode="text"
          onPress={cancelOrder}
          disabled={isProcessing}
          style={styles.cancelButton}
        >
          Cancel Order
        </Button>
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.voiceOrderButton, style]}
        onPress={startVoiceOrdering}
        activeOpacity={0.7}
      >
        <Ionicons name="mic" size={24} color="#fff" />
        <Text style={styles.voiceOrderButtonText}>Voice Order</Text>
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={endSession}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Voice Ordering</Text>
            <TouchableOpacity onPress={endSession} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {/* Microphone Visualization */}
            <View style={styles.microphoneSection}>
              <Animated.View
                style={[
                  styles.microphoneContainer,
                  { transform: [{ scale: pulseAnimation }] },
                ]}
              >
                <Ionicons
                  name="mic"
                  size={60}
                  color={isListening ? '#4CAF50' : isProcessing ? '#FF9800' : '#666'}
                />
              </Animated.View>
              
              {renderWaveform()}
              
              <Text style={styles.statusText}>
                {isProcessing
                  ? 'Processing...'
                  : isListening
                  ? 'Listening... Speak now'
                  : 'Tap to speak'}
              </Text>
            </View>

            {/* Transcript and Response */}
            {transcript && (
              <Card style={styles.transcriptCard}>
                <Card.Content>
                  <Text style={styles.transcriptLabel}>You said:</Text>
                  <Text style={styles.transcriptText}>{transcript}</Text>
                </Card.Content>
              </Card>
            )}

            {aiResponse && (
              <Card style={styles.responseCard}>
                <Card.Content>
                  <Text style={styles.responseLabel}>Dai:</Text>
                  <Text style={styles.responseText}>{aiResponse}</Text>
                </Card.Content>
              </Card>
            )}

            {/* Order Summary */}
            {renderOrderSummary()}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsTitle}>Quick Actions:</Text>
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => handleSuggestionPress(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Progress Indicator */}
            {session && (
              <View style={styles.progressSection}>
                <Text style={styles.progressLabel}>Order Progress</Text>
                <ProgressBar
                  progress={
                    session.context.currentStep === 'listening' ? 0.25 :
                    session.context.currentStep === 'processing' ? 0.5 :
                    session.context.currentStep === 'confirming' ? 0.75 : 1
                  }
                  color="#667eea"
                  style={styles.progressBar}
                />
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalFooter}>
            {renderActionButtons()}
          </View>
        </SafeAreaView>

        {/* Hidden audio element for playing responses */}
        <audio ref={audioRef} style={{ display: 'none' }} />
      </Modal>
    </>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  voiceOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  voiceOrderButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  microphoneSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  microphoneContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    marginBottom: 16,
    gap: 4,
  },
  wave: {
    width: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  transcriptCard: {
    marginBottom: 16,
  },
  transcriptLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 16,
    color: '#333',
  },
  responseCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  responseLabel: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 4,
    fontWeight: '600',
  },
  responseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  orderSummaryCard: {
    marginBottom: 16,
    backgroundColor: '#f3e5f5',
  },
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7b1fa2',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  orderItemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  orderItemDetails: {
    fontSize: 12,
    color: '#666',
  },
  orderTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  orderTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#667eea',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 25,
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
  confirmButton: {
    backgroundColor: '#4caf50',
  },
  cancelButton: {
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoiceOrderingInterface;