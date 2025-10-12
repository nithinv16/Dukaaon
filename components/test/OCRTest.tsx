import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Card, Button, Chip } from 'react-native-paper';
import OCRScanner from '../common/OCRScanner';
import { GoogleCloudVisionOCRService } from '../../services/googleCloud/visionOCRService';

interface ExtractedResult {
  text: string;
  language: string;
  timestamp: Date;
}

const OCRTest: React.FC = () => {
  const [results, setResults] = useState<ExtractedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleTextExtracted = (text: string, language: string) => {
    const newResult: ExtractedResult = {
      text,
      language,
      timestamp: new Date(),
    };
    setResults(prev => [newResult, ...prev]);
    
    Alert.alert(
      'Text Extracted Successfully!',
      `Language: ${language}\nText: ${text}`,
      [{ text: 'OK' }]
    );
  };

  const handleSearchResult = (query: string, language: string, translatedQuery?: string, originalText?: string) => {
    const message = translatedQuery 
      ? `Query: ${query}\nLanguage: ${language}\nTranslated: ${translatedQuery}\nOriginal: ${originalText}`
      : `Query: ${query}\nLanguage: ${language}`;
    
    Alert.alert(
      'Search Triggered',
      message,
      [
        {
          text: 'Simulate Search',
          onPress: () => {
            console.log('Simulating search for:', query);
            if (translatedQuery) {
              console.log('Translated query:', translatedQuery);
              console.log('Original text:', originalText);
            }
            // Here you would typically navigate to search results
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const testDirectOCR = async () => {
    setIsLoading(true);
    try {
      const ocrService = GoogleCloudVisionOCRService.getInstance();
      const results = await ocrService.showOCROptions(['en']);
      
      if (results && results.length > 0) {
        const extractedText = results[0]?.text?.trim() || '';
        handleTextExtracted(extractedText, 'en');
      } else {
        Alert.alert('Test Failed', 'No text extracted');
      }
    } catch (error) {
      Alert.alert('Test Error', `Failed to test OCR: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text style={styles.title}>OCR Functionality Test</Text>
          <Text style={styles.subtitle}>
            Test the OCR scanner component and Azure Computer Vision integration
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.testCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>OCR Scanner Component</Text>
          <Text style={styles.description}>
            Test the reusable OCR scanner with modal interface:
          </Text>
          
          <View style={styles.buttonContainer}>
            <OCRScanner
              onTextExtracted={handleTextExtracted}
              onSearchResult={handleSearchResult}
              buttonText="Test OCR Scanner"
              showModal={true}
              enableTranslation={true}
              autoTranslate={true}
              style={styles.ocrButton}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.testCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Direct Service Test</Text>
          <Text style={styles.description}>
            Test the OCR service directly without modal:
          </Text>
          
          <Button
            mode="outlined"
            onPress={testDirectOCR}
            loading={isLoading}
            disabled={isLoading}
            style={styles.testButton}
          >
            Test Direct OCR Service
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.resultsCard}>
        <Card.Content>
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionTitle}>Test Results ({results.length})</Text>
            {results.length > 0 && (
              <Button
                mode="text"
                onPress={clearResults}
                compact
              >
                Clear
              </Button>
            )}
          </View>
          
          {results.length === 0 ? (
            <Text style={styles.noResults}>
              No OCR tests performed yet. Use the buttons above to test the functionality.
            </Text>
          ) : (
            results.map((result, index) => (
              <Card key={index} style={styles.resultItem}>
                <Card.Content>
                  <View style={styles.resultHeader}>
                    <Chip style={styles.languageChip}>
                      {result.language.toUpperCase()}
                    </Chip>
                    <Text style={styles.timestamp}>
                      {formatTimestamp(result.timestamp)}
                    </Text>
                  </View>
                  
                  <Text style={styles.resultText}>
                    {result.text}
                  </Text>
                </Card.Content>
              </Card>
            ))
          )}
        </Card.Content>
      </Card>

      <Card style={styles.infoCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Test Instructions</Text>
          <Text style={styles.infoText}>
            1. Tap "Test OCR Scanner" to open the modal interface{"\n"}
            2. Choose Camera or Gallery to select an image{"\n"}
            3. Wait for text extraction to complete{"\n"}
            4. Review extracted text and test search functionality{"\n"}
            5. Use "Test Direct OCR Service" for non-modal testing{"\n"}
            6. Check results below to verify accuracy
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  testCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    alignItems: 'flex-start',
  },
  ocrButton: {
    backgroundColor: '#e3f2fd',
  },
  testButton: {
    alignSelf: 'flex-start',
  },
  resultsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noResults: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  resultItem: {
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  languageChip: {
    backgroundColor: '#e8f5e8',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  infoCard: {
    marginBottom: 32,
    elevation: 2,
    backgroundColor: '#e3f2fd',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
});

export default OCRTest;