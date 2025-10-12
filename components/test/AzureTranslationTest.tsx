import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';

const AzureTranslationTest: React.FC = () => {
  const { currentLanguage, changeLanguage, translate, translateText, availableLanguages } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some text to translate');
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(inputText);
      setTranslatedText(result);
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  };

  const testPhrases = [
    'Hello, how are you?',
    'Welcome to our store',
    'Add to cart',
    'Search products',
    'Your order is ready',
    'Thank you for shopping with us',
  ];

  const handleTestPhrase = async (phrase: string) => {
    setInputText(phrase);
    setIsTranslating(true);
    try {
      const result = await translateText(phrase);
      setTranslatedText(result);
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Azure Translation Test</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Language: {currentLanguage}</Text>
        
        <View style={styles.languageButtons}>
          {availableLanguages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageButton,
                currentLanguage === lang.code && styles.activeLanguageButton
              ]}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text style={[
                styles.languageButtonText,
                currentLanguage === lang.code && styles.activeLanguageButtonText
              ]}>
                {lang.localizedName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Translation</Text>
        
        <TextInput
          style={styles.textInput}
          placeholder="Enter text to translate..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        
        <TouchableOpacity
          style={[styles.translateButton, isTranslating && styles.disabledButton]}
          onPress={handleTranslate}
          disabled={isTranslating}
        >
          <Text style={styles.translateButtonText}>
            {isTranslating ? 'Translating...' : 'Translate'}
          </Text>
        </TouchableOpacity>
        
        {translatedText ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultLabel}>Translation:</Text>
            <Text style={styles.resultText}>{translatedText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Phrases</Text>
        
        {testPhrases.map((phrase, index) => (
          <TouchableOpacity
            key={index}
            style={styles.testPhraseButton}
            onPress={() => handleTestPhrase(phrase)}
          >
            <Text style={styles.testPhraseText}>{phrase}</Text>
          </TouchableOpacity>
        ))}
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
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  languageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
  },
  activeLanguageButton: {
    backgroundColor: '#007AFF',
  },
  languageButtonText: {
    fontSize: 14,
    color: '#333',
  },
  activeLanguageButtonText: {
    color: 'white',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  translateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  translateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  testPhraseButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  testPhraseText: {
    fontSize: 14,
    color: '#333',
  },
});

export default AzureTranslationTest;