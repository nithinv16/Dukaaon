import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button, TextInput, Card, Chip } from 'react-native-paper';
import { useTranslation } from '../../contexts/LanguageContext';
import { SupportedLanguage } from '../../services/translationService';

export default function TranslationTest() {
  const {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    translate,
    isLoading,
    clearCache,
    getCacheStats
  } = useTranslation();

  const [testText, setTestText] = useState('Hello, how are you today?');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [cacheStats, setCacheStats] = useState({ totalEntries: 0, totalTranslations: 0, cacheSize: '0 KB' });

  const handleTranslate = async () => {
    if (!testText.trim()) return;
    
    try {
      setIsTranslating(true);
      const result = await translate(testText);
      setTranslatedText(result);
    } catch (error) {
      Alert.alert('Error', 'Translation failed. Please try again.');
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLanguageChange = async (languageCode: SupportedLanguage) => {
    try {
      await changeLanguage(languageCode);
      Alert.alert('Success', `Language changed to ${availableLanguages.find(l => l.code === languageCode)?.name}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to change language');
    }
  };

  const handleClearCache = async () => {
    try {
      await clearCache();
      setCacheStats({ totalEntries: 0, totalTranslations: 0, cacheSize: '0 KB' });
      Alert.alert('Success', 'Cache cleared successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear cache');
    }
  };

  const loadCacheStats = () => {
    try {
      const stats = getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  React.useEffect(() => {
    loadCacheStats();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Translation System Test</Text>
      
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Current Language</Text>
          <Text style={styles.currentLanguage}>
            {availableLanguages.find(l => l.code === currentLanguage)?.name} ({currentLanguage})
          </Text>
          
          <Text style={styles.sectionTitle}>Available Languages</Text>
          <View style={styles.languageChips}>
            {availableLanguages.map((lang) => (
              <Chip
                key={lang.code}
                mode={currentLanguage === lang.code ? 'flat' : 'outlined'}
                selected={currentLanguage === lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                disabled={isLoading}
                style={styles.chip}
              >
                {lang.name}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Translation Test</Text>
          <TextInput
            label="Text to translate"
            value={testText}
            onChangeText={setTestText}
            mode="outlined"
            multiline
            style={styles.textInput}
          />
          
          <Button
            mode="contained"
            onPress={handleTranslate}
            loading={isTranslating}
            disabled={isTranslating || !testText.trim()}
            style={styles.button}
          >
            Translate to {availableLanguages.find(l => l.code === currentLanguage)?.name}
          </Button>
          
          {translatedText ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>Translation Result:</Text>
              <Text style={styles.resultText}>{translatedText}</Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Cache Management</Text>
          <Text style={styles.cacheStats}>
            Entries: {cacheStats.totalEntries} | Size: {cacheStats.cacheSize}
          </Text>
          
          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={loadCacheStats}
              style={[styles.button, styles.halfButton]}
            >
              Refresh Stats
            </Button>
            
            <Button
              mode="contained"
              onPress={handleClearCache}
              style={[styles.button, styles.halfButton]}
              buttonColor="#ff6b6b"
            >
              Clear Cache
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

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
    marginBottom: 20,
    color: '#333',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  currentLanguage: {
    fontSize: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
    color: '#1976d2',
  },
  languageChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
  textInput: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  halfButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2e7d32',
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  cacheStats: {
    fontSize: 14,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 4,
    color: '#ef6c00',
  },
});