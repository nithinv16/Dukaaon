import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { Text, Card, IconButton, ActivityIndicator } from 'react-native-paper';
import { useAzureAIAgent } from '../../../hooks/useAzureAIAgent';
import { Link } from 'expo-router';

export default function ChatTest() {
  const [inputText, setInputText] = useState('');
  const {
    isInitialized,
    isProcessing,
    threadId,
    lastResponse,
    conversationHistory,
    initializeAgent,
    sendMessage,
    resetConversation
  } = useAzureAIAgent();

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing || !isInitialized) return;
    
    const message = inputText.trim();
    setInputText('');
    await sendMessage(message);
  };

  const renderMessage = (message: any, index: number) => (
    <Card key={index} style={[
      styles.messageCard,
      message.role === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <Card.Content>
        <Text style={styles.roleText}>{message.role === 'user' ? 'You' : 'Dai'}:</Text>
        <Text style={styles.messageText}>{message?.content || ''}</Text>
        <Text style={styles.timestamp}>
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Link href="/(main)/home" asChild>
          <TouchableOpacity style={styles.backButton}>
            <IconButton icon="arrow-left" size={24} />
          </TouchableOpacity>
        </Link>
        <Text style={styles.headerTitle}>AI Agent</Text>
        <TouchableOpacity onPress={resetConversation} style={styles.resetButton}>
          <IconButton icon="refresh" size={20} />
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isInitialized ? 'Ready' : 'Initializing...'}
        </Text>
        <Text style={styles.statusText}>
          Thread ID: {threadId || 'None'}
        </Text>
        <Text style={styles.statusText}>
          Messages: {conversationHistory.length}
        </Text>
      </View>

      {/* Messages */}
      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {conversationHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Hello! I'm your AI agent. How can I help you today?</Text>
          </View>
        ) : (
          conversationHistory.map(renderMessage)
        )}
        
        {isProcessing && (
          <Card style={[styles.messageCard, styles.assistantMessage]}>
            <Card.Content style={styles.processingContent}>
              <ActivityIndicator size="small" color="#667eea" />
              <Text style={styles.processingText}>Processing...</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          multiline
          editable={isInitialized && !isProcessing}
        />
        <TouchableOpacity 
          onPress={handleSendMessage} 
          style={[
            styles.sendButton,
            (!isInitialized || isProcessing || !inputText.trim()) && styles.sendButtonDisabled
          ]}
          disabled={!isInitialized || isProcessing || !inputText.trim()}
        >
          <IconButton icon="send" size={24} iconColor="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    elevation: 2
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center'
  },
  resetButton: {
    padding: 4
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16
  },
  messagesContent: {
    paddingVertical: 8
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  messageCard: {
    marginVertical: 4,
    elevation: 1
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    marginLeft: 40
  },
  assistantMessage: {
    backgroundColor: 'white',
    marginRight: 40
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right'
  },
  processingContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#667eea'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    elevation: 2
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    marginRight: 8,
    fontSize: 14
  },
  sendButton: {
    backgroundColor: '#667eea',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc'
  }
});