import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GoogleCloudVisionOCRService, { OCRResultWithTranslation } from '../../services/googleCloud/visionOCRService';

/**
 * Test component to demonstrate the new OCR with automatic translation functionality
 * This shows how to use the extractTextForSearch and getSearchQueryFromImage methods
 */
const OCRSearchTest: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<OCRResultWithTranslation[] | null>(null);
  const [searchQuery, setSearchQuery] = useState<{
    searchQuery: string;
    originalText: string;
    detectedLanguage: string;
    wasTranslated: boolean;
    confidence: number;
  } | null>(null);

  const ocrService = GoogleCloudVisionOCRService.getInstance();

  const handleExtractForSearch = async (source: 'camera' | 'gallery') => {
    try {
      setIsProcessing(true);
      setResults(null);
      setSearchQuery(null);

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

      console.log('Testing OCR with automatic translation...');
      
      // Test the detailed extraction method
      const detailedResults = await ocrService.extractTextForSearch(imageUri);
      setResults(detailedResults);
      
      // Test the convenience method for search queries
      const queryResult = await ocrService.getSearchQueryFromImage(imageUri);
      setSearchQuery(queryResult);
      
      if (detailedResults.length === 0) {
        Alert.alert('No Text Found', 'No text was detected in the image.');
      } else {
        const primaryResult = detailedResults[0];
        const message = `Text extracted successfully!\n\n` +
          `Original: ${primaryResult.text}\n\n` +
          `${primaryResult.translatedText ? `Translated: ${primaryResult.translatedText}\n\n` : ''}` +
          `Language: ${primaryResult.detectedLanguage}\n` +
          `Translation needed: ${primaryResult.needsTranslation ? 'Yes' : 'No'}\n` +
          `Search query: ${queryResult?.searchQuery || 'N/A'}`;
        
        Alert.alert('OCR Results', message);
      }
      
    } catch (error) {
      console.error('OCR extraction error:', error);
      Alert.alert('Error', `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateSearch = () => {
    if (searchQuery) {
      Alert.alert(
        'Search Simulation',
        `Searching for: "${searchQuery.searchQuery}"\n\n` +
        `This would be sent to your search API for better results in English.`
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OCR Search Translation Test</Text>
        <Text style={styles.subtitle}>
          Test the new automatic translation feature for search queries
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cameraButton]}
          onPress={() => handleExtractForSearch('camera')}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size={20} color="#FFFFFF" />
          ) : (
            <Ionicons name="camera" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>
            {isProcessing ? 'Processing...' : 'Camera'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.galleryButton]}
          onPress={() => handleExtractForSearch('gallery')}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size={20} color="#FFFFFF" />
          ) : (
            <Ionicons name="images" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>
            {isProcessing ? 'Processing...' : 'Gallery'}
          </Text>
        </TouchableOpacity>
      </View>

      {searchQuery && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Search Query Result:</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Search Query (English):</Text>
            <Text style={styles.resultText}>{searchQuery.searchQuery}</Text>
            
            <Text style={styles.resultLabel}>Original Text:</Text>
            <Text style={styles.resultText}>{searchQuery.originalText}</Text>
            
            <Text style={styles.resultLabel}>Detected Language:</Text>
            <Text style={styles.resultText}>{searchQuery.detectedLanguage}</Text>
            
            <Text style={styles.resultLabel}>Was Translated:</Text>
            <Text style={[styles.resultText, searchQuery.wasTranslated ? styles.translated : styles.notTranslated]}>
              {searchQuery.wasTranslated ? 'Yes' : 'No'}
            </Text>
            
            <Text style={styles.resultLabel}>Confidence:</Text>
            <Text style={styles.resultText}>{(searchQuery.confidence * 100).toFixed(1)}%</Text>
          </View>
          
          <TouchableOpacity style={styles.searchButton} onPress={simulateSearch}>
            <Ionicons name="search" size={16} color="#FFFFFF" />
            <Text style={styles.searchButtonText}>Simulate Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {results && results.length > 0 && (
        <View style={styles.detailedResults}>
          <Text style={styles.resultsTitle}>Detailed Results:</Text>
          {results.map((result, index) => (
            <View key={index} style={styles.resultCard}>
              <Text style={styles.resultIndex}>Result {index + 1}:</Text>
              
              <Text style={styles.resultLabel}>Original Text:</Text>
              <Text style={styles.resultText}>{result.text}</Text>
              
              {result.translatedText && (
                <>
                  <Text style={styles.resultLabel}>Translated Text:</Text>
                  <Text style={styles.resultText}>{result.translatedText}</Text>
                </>
              )}
              
              <Text style={styles.resultLabel}>Language:</Text>
              <Text style={styles.resultText}>{result.detectedLanguage}</Text>
              
              <Text style={styles.resultLabel}>Needs Translation:</Text>
              <Text style={[styles.resultText, result.needsTranslation ? styles.translated : styles.notTranslated]}>
                {result.needsTranslation ? 'Yes' : 'No'}
              </Text>
              
              {result.translationConfidence && (
                <>
                  <Text style={styles.resultLabel}>Translation Confidence:</Text>
                  <Text style={styles.resultText}>{(result.translationConfidence * 100).toFixed(1)}%</Text>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  galleryButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    padding: 20,
  },
  detailedResults: {
    padding: 20,
    paddingTop: 0,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultIndex: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  translated: {
    color: '#34C759',
    fontWeight: '600',
  },
  notTranslated: {
    color: '#FF9500',
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OCRSearchTest;