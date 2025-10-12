import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, IconButton, Chip, Button, Avatar, TextInput } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Feedback {
  id: string;
  order_id: string;
  rating: number;
  comment: string;
  created_at: string;
  response?: string;
  response_at?: string;
}

export default function CustomerFeedback() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentLanguage } = useLanguage();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [translations, setTranslations] = useState({
    customerFeedback: 'Customer Feedback',
    rating: 'Rating',
    comment: 'Comment',
    orderNumber: 'Order #',
    date: 'Date',
    response: 'Response',
    yourResponse: 'Your Response',
    addResponse: 'Add Response',
    submit: 'Submit',
    cancel: 'Cancel',
    noFeedback: 'No feedback found',
    noFeedbackMessage: 'This customer has not provided any feedback yet.',
    responded: 'Responded',
    pending: 'Pending Response'
  });

  useEffect(() => {
    fetchFeedback();
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;
      
      try {
        const results = await Promise.all([
        translationService.translateText('Customer Feedback', currentLanguage),
        translationService.translateText('Rating', currentLanguage),
        translationService.translateText('Comment', currentLanguage),
        translationService.translateText('Order #', currentLanguage),
        translationService.translateText('Date', currentLanguage),
        translationService.translateText('Response', currentLanguage),
        translationService.translateText('Your Response', currentLanguage),
        translationService.translateText('Add Response', currentLanguage),
        translationService.translateText('Submit', currentLanguage),
        translationService.translateText('Cancel', currentLanguage),
        translationService.translateText('No feedback found', currentLanguage),
        translationService.translateText('This customer has not provided any feedback yet.', currentLanguage),
        translationService.translateText('Responded', currentLanguage),
        translationService.translateText('Pending Response', currentLanguage)
      ]);

        setTranslations({
          customerFeedback: results[0].translatedText,
          rating: results[1].translatedText,
          comment: results[2].translatedText,
          orderNumber: results[3].translatedText,
          date: results[4].translatedText,
          response: results[5].translatedText,
          yourResponse: results[6].translatedText,
          addResponse: results[7].translatedText,
          submit: results[8].translatedText,
          cancel: results[9].translatedText,
          noFeedback: results[10].translatedText,
          noFeedbackMessage: results[11].translatedText,
          responded: results[12].translatedText,
          pending: results[13].translatedText
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('retailer_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedback(data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async (feedbackId: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({
          response,
          response_at: new Date().toISOString(),
        })
        .eq('id', feedbackId);

      if (error) throw error;

      setFeedback(feedback.map(f => 
        f.id === feedbackId 
          ? { ...f, response, response_at: new Date().toISOString() }
          : f
      ));
      setResponse('');
      setSelectedFeedback(null);
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  const renderFeedback = ({ item: feedback }: { item: Feedback }) => (
    <Card style={styles.feedbackCard}>
      <Card.Content>
        <View style={styles.feedbackHeader}>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <IconButton
                key={star}
                icon="star"
                size={16}
                iconColor={star <= feedback.rating ? '#FFC107' : '#e0e0e0'}
              />
            ))}
          </View>
          <Text variant="bodySmall" style={styles.date}>
            {new Date(feedback.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text variant="bodyMedium" style={styles.comment}>
          {feedback.comment}
        </Text>

        {feedback.response ? (
          <View style={styles.responseContainer}>
            <Text variant="bodySmall" style={styles.responseLabel}>
              {translations.yourResponse}:
            </Text>
            <Text variant="bodyMedium" style={styles.response}>
              {feedback.response}
            </Text>
            <Text variant="bodySmall" style={styles.responseDate}>
              {new Date(feedback.response_at!).toLocaleDateString()}
            </Text>
          </View>
        ) : (
          <View>
            {selectedFeedback === feedback.id ? (
              <View style={styles.responseInput}>
                <TextInput
                  mode="outlined"
                  value={response}
                  onChangeText={setResponse}
                  placeholder={translations.yourResponse + "..."}
                  multiline
                />
                <View style={styles.responseActions}>
                  <Button
                    mode="text"
                    onPress={() => {
                      setResponse('');
                      setSelectedFeedback(null);
                    }}
                  >
                    {translations.cancel}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => submitResponse(feedback.id)}
                  >
                    {translations.submit}
                  </Button>
                </View>
              </View>
            ) : (
              <Button
                mode="outlined"
                onPress={() => setSelectedFeedback(feedback.id)}
                style={styles.respondButton}
              >
                {translations.addResponse}
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.customerFeedback}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={feedback}
        renderItem={renderFeedback}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {translations.noFeedback}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyMessage}>
              {translations.noFeedbackMessage}
            </Text>
          </View>
        )}
      />
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
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRight: {
    width: 48,
  },
  list: {
    padding: 16,
  },
  feedbackCard: {
    marginBottom: 16,
    elevation: 2,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  date: {
    color: '#666',
  },
  comment: {
    marginBottom: 16,
  },
  responseContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  responseLabel: {
    color: '#666',
    marginBottom: 4,
  },
  response: {
    marginBottom: 4,
  },
  responseDate: {
    color: '#666',
    textAlign: 'right',
  },
  responseInput: {
    marginTop: 12,
  },
  responseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  respondButton: {
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginBottom: 8,
    color: '#666',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
  },
});
