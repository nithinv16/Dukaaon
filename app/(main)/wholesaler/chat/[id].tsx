import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Avatar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export default function CustomerChat() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [translations, setTranslations] = useState({
    customerChat: 'Customer Chat',
    typeMessage: 'Type a message...',
    noMessages: 'No messages yet',
    startConversation: 'Start a conversation',
    errorLoading: 'Error loading messages',
    errorSending: 'Error sending message'
  });

  useEffect(() => {
    fetchMessages();
    subscribeToNewMessages();
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      const results = await Promise.all([
        translationService.translateText('Chat', currentLanguage),
        translationService.translateText('Type a message...', currentLanguage),
        translationService.translateText('Send', currentLanguage),
        translationService.translateText('Loading messages...', currentLanguage),
        translationService.translateText('No messages yet', currentLanguage),
        translationService.translateText('Start the conversation!', currentLanguage),
        translationService.translateText('Failed to load messages', currentLanguage),
        translationService.translateText('Failed to send message', currentLanguage),
        translationService.translateText('Retry', currentLanguage),
        translationService.translateText('Online', currentLanguage),
        translationService.translateText('Offline', currentLanguage),
        translationService.translateText('Last seen', currentLanguage),
        translationService.translateText('Just now', currentLanguage),
        translationService.translateText('minutes ago', currentLanguage),
        translationService.translateText('hours ago', currentLanguage),
        translationService.translateText('days ago', currentLanguage),
        translationService.translateText('Message sent', currentLanguage),
        translationService.translateText('Message delivered', currentLanguage),
        translationService.translateText('Message read', currentLanguage)
      ]);
  
      setTranslations({
        chat: results[0].translatedText,
        typeMessage: results[1].translatedText,
        send: results[2].translatedText,
        loadingMessages: results[3].translatedText,
        noMessages: results[4].translatedText,
        startConversation: results[5].translatedText,
        failedToLoadMessages: results[6].translatedText,
        failedToSendMessage: results[7].translatedText,
        retry: results[8].translatedText,
        online: results[9].translatedText,
        offline: results[10].translatedText,
        lastSeen: results[11].translatedText,
        justNow: results[12].translatedText,
        minutesAgo: results[13].translatedText,
        hoursAgo: results[14].translatedText,
        daysAgo: results[15].translatedText,
        messageSent: results[16].translatedText,
        messageDelivered: results[17].translatedText,
        messageRead: results[18].translatedText
      });
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNewMessages = () => {
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${id},receiver_id=eq.${user?.id}`,
      }, payload => {
        setMessages(current => [payload.new as Message, ...current]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: id,
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item: message }: { item: Message }) => {
    const isOwnMessage = message.sender_id === user?.id;

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <Text style={styles.messageText}>{message?.content || ''}</Text>
        <Text style={styles.messageTime}>
          {new Date(message.created_at).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Avatar.Text size={40} label="CS" />
        <Text variant="titleMedium" style={styles.headerTitle}>
          {translations.customerChat}
        </Text>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{translations.noMessages}</Text>
            <Text style={styles.emptyMessage}>{translations.startConversation}</Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <TextInput
          mode="outlined"
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder={translations.typeMessage}
          right={
            <TextInput.Icon 
              icon="send"
              onPress={sendMessage}
            />
          }
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    marginLeft: 12,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
  },
});