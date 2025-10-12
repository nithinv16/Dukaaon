import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { azureFoundryService } from '../../services/azureAI/azureFoundryService';

const AzureAITest: React.FC = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeService = async () => {
    try {
      setIsLoading(true);
      const success = await azureFoundryService.initialize();
      setIsInitialized(success);
      if (success) {
        Alert.alert('Success', 'Azure AI service initialized successfully!');
      } else {
        Alert.alert('Error', 'Failed to initialize Azure AI service');
      }
    } catch (error) {
      console.error('Error initializing service:', error);
      Alert.alert('Error', 'Failed to initialize Azure AI service');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      setIsLoading(true);
      const result = await azureFoundryService.sendMessage(message);
      if (result.success) {
        setResponse(result.message);
      } else {
        setResponse(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Azure AI Service Test</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        <Text style={styles.status}>
          Status: {isInitialized ? 'Initialized' : 'Not Initialized'}
        </Text>
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={initializeService}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Initializing...' : 'Initialize Service'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Message</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Enter your test message here..."
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity 
          style={[styles.button, (!isInitialized || isLoading) && styles.buttonDisabled]} 
          onPress={sendTestMessage}
          disabled={!isInitialized || isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Sending...' : 'Send Message'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Response</Text>
        <View style={styles.responseContainer}>
          <Text style={styles.responseText}>
            {response || 'No response yet...'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 30,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  status: {
    fontSize: 16,
    marginBottom: 15,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  responseContainer: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
    minHeight: 100,
  },
  responseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});

export default AzureAITest;