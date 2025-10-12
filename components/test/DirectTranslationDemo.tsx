import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';

const DirectTranslationDemo: React.FC = () => {
  const { currentLanguage, changeLanguage, translate, tAsync, translateText, availableLanguages } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationHistory, setTranslationHistory] = useState<Array<{
    original: string;
    translated: string;
    language: string;
    timestamp: Date;
  }>>([]);

  // Example texts for demonstration
  const exampleTexts = [
    "Welcome to our store! We have fresh fruits and vegetables.",
    "Your order has been confirmed and will be delivered soon.",
    "Please enter your mobile number for OTP verification.",
    "We offer the best prices on groceries and household items.",
    "Thank you for shopping with us. Have a great day!",
    "Special discount available on bulk purchases today.",
    "Free delivery for orders above ₹500 in your area."
  ];

  const handleDirectTranslation = async (text: string) => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter some text to translate');
      return;
    }

    setIsTranslating(true);
    try {
      // Using the direct translation function
      const result = await translateText(text);
      setTranslatedText(result);
      
      // Add to history
      setTranslationHistory(prev => [{
        original: text,
        translated: result,
        language: currentLanguage,
        timestamp: new Date()
      }, ...prev.slice(0, 9)]); // Keep last 10 translations
      
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Translation Error', 'Failed to translate text. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExampleTranslation = async (text: string) => {
    setInputText(text);
    await handleDirectTranslation(text);
  };

  const clearHistory = () => {
    setTranslationHistory([]);
    setTranslatedText('');
    setInputText('');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Direct Azure Translation Demo</Text>
      <Text style={styles.subtitle}>
        Translate any text without predefined keys using Azure Translator
      </Text>

      {/* Language Selection */}
      <View style={styles.languageSection}>
        <Text style={styles.sectionTitle}>Current Language: {currentLanguage.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.languageScroll}>
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
        </ScrollView>
      </View>

      {/* Text Input */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>Enter Text to Translate:</Text>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type any text here..."
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity
          style={[styles.translateButton, isTranslating && styles.disabledButton]}
          onPress={() => handleDirectTranslation(inputText)}
          disabled={isTranslating}
        >
          <Text style={styles.translateButtonText}>
            {isTranslating ? 'Translating...' : 'Translate Now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Translation Result */}
      {translatedText ? (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Translation Result:</Text>
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{translatedText}</Text>
          </View>
        </View>
      ) : null}

      {/* Example Texts */}
      <View style={styles.examplesSection}>
        <Text style={styles.sectionTitle}>Try These Examples:</Text>
        {exampleTexts.map((text, index) => (
          <TouchableOpacity
            key={index}
            style={styles.exampleButton}
            onPress={() => handleExampleTranslation(text)}
          >
            <Text style={styles.exampleText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Translation History */}
      {translationHistory.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Translation History</Text>
            <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          {translationHistory.map((item, index) => (
            <View key={index} style={styles.historyItem}>
              <Text style={styles.historyOriginal}>Original: {item.original}</Text>
              <Text style={styles.historyTranslated}>
                {item.language.toUpperCase()}: {item.translated}
              </Text>
              <Text style={styles.historyTimestamp}>
                {item.timestamp.toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* API Information */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>How It Works:</Text>
        <Text style={styles.infoText}>
          • Uses Azure Translator API directly{'\n'}
          • No predefined translation keys required{'\n'}
          • Automatic caching for performance{'\n'}
          • Supports all 8 Indian languages{'\n'}
          • Graceful fallback on errors{'\n'}
          • 7-day cache expiry for fresh translations
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  languageSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  languageScroll: {
    flexDirection: 'row',
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
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
  inputSection: {
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  translateButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
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
  resultSection: {
    marginBottom: 20,
  },
  resultBox: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  examplesSection: {
    marginBottom: 20,
  },
  exampleButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  exampleText: {
    fontSize: 14,
    color: '#666',
  },
  historySection: {
    marginBottom: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  historyOriginal: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  historyTranslated: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 4,
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default DirectTranslationDemo;