import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Button, Card, Title, Paragraph, Chip } from 'react-native-paper';
import GoogleCloudVisionOCRService, { OCRResultWithTranslation } from '../../services/googleCloud/visionOCRService';

interface OCRTranslationDemoProps {
  onSearchResult?: (query: string, language: string, translatedText?: string, originalText?: string) => void;
}

const OCRTranslationDemo: React.FC<OCRTranslationDemoProps> = ({ onSearchResult }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<OCRResultWithTranslation[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleExtractForSearch = async (source: 'camera' | 'gallery') => {
    try {
      setIsProcessing(true);
      setResults([]);
      setSearchQuery('');

      const ocrService = GoogleCloudVisionOCRService.getInstance();
      let imageUri: string | null = null;

      if (source === 'camera') {
        imageUri = await ocrService.captureImage();
      } else {
        imageUri = await ocrService.pickImage();
      }

      if (!imageUri) {
        Alert.alert('Error', 'No image selected');
        return;
      }

      console.log('Extracting text for search from image:', imageUri);
      const searchResults = await ocrService.extractTextForSearch(imageUri);

      if (searchResults && searchResults.length > 0) {
        setResults(searchResults);
        
        // Get the best search query
        const bestQuery = await ocrService.getSearchQueryFromImage(imageUri);
        setSearchQuery(bestQuery || '');

        Alert.alert(
          'Text Extracted Successfully',
          `Found ${searchResults.length} text region(s).\nBest search query: "${bestQuery}"`,
          [
            { text: 'OK' },
            {
              text: 'Use for Search',
              onPress: () => {
                if (onSearchResult && bestQuery) {
                  const primaryResult = searchResults[0];
                  onSearchResult(
                    bestQuery,
                    primaryResult.translatedText ? 'en' : (primaryResult.detectedLanguage || 'auto'),
                    primaryResult.translatedText,
                    primaryResult.text
                  );
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('No Text Found', 'No text was detected in the image.');
      }
    } catch (error) {
      console.error('OCR Translation Demo error:', error);
      Alert.alert('Error', 'Failed to extract text from image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderResult = (result: OCRResultWithTranslation, index: number) => (
    <Card key={index} style={styles.resultCard}>
      <Card.Content>
        <Title style={styles.resultTitle}>Text Region {index + 1}</Title>
        
        <View style={styles.chipContainer}>
          <Chip icon="translate" style={styles.chip}>
            {result.detectedLanguage || 'Unknown'}
          </Chip>
          {result.needsTranslation && (
            <Chip icon="arrow-right" style={styles.chip}>
              Translation Needed
            </Chip>
          )}
          {result.translatedText && (
            <Chip icon="check" style={styles.successChip}>
              Translated
            </Chip>
          )}
        </View>

        <Paragraph style={styles.label}>Original Text:</Paragraph>
        <Text style={styles.textContent}>{result.text}</Text>

        {result.translatedText && (
          <>
            <Paragraph style={styles.label}>English Translation:</Paragraph>
            <Text style={styles.translatedText}>{result.translatedText}</Text>
            {result.translationConfidence && (
              <Text style={styles.confidence}>
                Confidence: {(result.translationConfidence * 100).toFixed(1)}%
              </Text>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Title>OCR Translation Demo</Title>
          <Paragraph>
            This demo shows the new automatic English translation feature for OCR text extraction.
            Perfect for search optimization!
          </Paragraph>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => handleExtractForSearch('camera')}
          disabled={isProcessing}
          style={styles.button}
          icon="camera"
        >
          Extract from Camera
        </Button>
        
        <Button
          mode="contained"
          onPress={() => handleExtractForSearch('gallery')}
          disabled={isProcessing}
          style={styles.button}
          icon="image"
        >
          Extract from Gallery
        </Button>
      </View>

      {isProcessing && (
        <Card style={styles.processingCard}>
          <Card.Content>
            <Text style={styles.processingText}>Processing image and translating text...</Text>
          </Card.Content>
        </Card>
      )}

      {searchQuery && (
        <Card style={styles.searchQueryCard}>
          <Card.Content>
            <Title style={styles.searchTitle}>Optimized Search Query</Title>
            <Text style={styles.searchQuery}>"{searchQuery}"</Text>
            <TouchableOpacity
              style={styles.useSearchButton}
              onPress={() => {
                if (onSearchResult && results.length > 0) {
                  const primaryResult = results[0];
                  onSearchResult(
                    searchQuery,
                    primaryResult.translatedText ? 'en' : (primaryResult.detectedLanguage || 'auto'),
                    primaryResult.translatedText,
                    primaryResult.text
                  );
                }
              }}
            >
              <Text style={styles.useSearchButtonText}>Use for Search</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
      )}

      {results.map((result, index) => renderResult(result, index))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  button: {
    flex: 0.45,
  },
  processingCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  processingText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#1976d2',
  },
  searchQueryCard: {
    marginBottom: 16,
    backgroundColor: '#e8f5e8',
  },
  searchTitle: {
    color: '#2e7d32',
    fontSize: 18,
  },
  searchQuery: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b5e20',
    marginVertical: 8,
  },
  useSearchButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  useSearchButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  resultCard: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  successChip: {
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#c8e6c9',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  translatedText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2e7d32',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  confidence: {
    fontSize: 12,
    color: '#666',
  },
});

export default OCRTranslationDemo;