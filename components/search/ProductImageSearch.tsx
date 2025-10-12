import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedOCRService, { ProductSearchResult, ProductMatch } from '../../services/azureAI/enhancedOCRService';

interface ProductImageSearchProps {
  onProductSelect: (product: ProductMatch) => void;
  onSearchResults: (results: ProductMatch[]) => void;
  onClose: () => void;
  visible: boolean;
}

const { width, height } = Dimensions.get('window');

const ProductImageSearch: React.FC<ProductImageSearchProps> = ({
  onProductSelect,
  onSearchResults,
  onClose,
  visible
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResult, setSearchResult] = useState<ProductSearchResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentStep, setCurrentStep] = useState<'scan' | 'results'>('scan');

  const handleImageSearch = async () => {
    try {
      setIsProcessing(true);
      setCurrentStep('scan');
      
      const result = await EnhancedOCRService.processProductSearchImage();
      
      if (result.success && result.suggestedProducts.length > 0) {
        setSearchResult(result);
        setSearchQuery(result.searchQuery);
        setCurrentStep('results');
      } else {
        Alert.alert(
          'No Results Found',
          result.error || 'Could not find products matching the text in the image. Please try with a different image.',
          [{ text: 'Try Again', onPress: () => setCurrentStep('scan') }]
        );
      }
    } catch (error) {
      console.error('Product image search error:', error);
      Alert.alert(
        'Search Failed',
        'An error occurred while processing the image. Please try again.',
        [{ text: 'OK', onPress: () => setCurrentStep('scan') }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProductSelect = (product: ProductMatch) => {
    onProductSelect(product);
    handleClose();
  };

  const handleViewAllResults = () => {
    if (searchResult) {
      onSearchResults(searchResult.suggestedProducts);
      handleClose();
    }
  };

  const handleManualSearch = () => {
    if (searchQuery.trim()) {
      // Trigger manual search with the extracted/edited query
      console.log('Manual search for:', searchQuery);
      // You can implement manual search logic here
    }
  };

  const handleClose = () => {
    setSearchResult(null);
    setSearchQuery('');
    setCurrentStep('scan');
    setIsProcessing(false);
    onClose();
  };

  const renderScanStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="search" size={80} color="#007AFF" />
      </View>
      
      <Text style={styles.title}>Search with Image</Text>
      <Text style={styles.subtitle}>
        Take a photo of any product or text to search for similar items in our catalog.
      </Text>
      
      <View style={styles.featuresContainer}>
        <View style={styles.feature}>
          <Ionicons name="camera" size={24} color="#007AFF" />
          <Text style={styles.featureText}>Capture product images</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="language" size={24} color="#007AFF" />
          <Text style={styles.featureText}>Multi-language support</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="flash" size={24} color="#007AFF" />
          <Text style={styles.featureText}>Instant results</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.searchButton, isProcessing && styles.disabledButton]} 
        onPress={handleImageSearch}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Ionicons name="camera" size={24} color="white" />
        )}
        <Text style={styles.searchButtonText}>
          {isProcessing ? 'Processing Image...' : 'Search with Image'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderResultsStep = () => {
    if (!searchResult) return null;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentStep('scan')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Results</Text>
        </View>

        <View style={styles.searchInfoContainer}>
          <Text style={styles.searchInfoLabel}>Extracted Text:</Text>
          <Text style={styles.extractedText}>{searchResult.extractedText}</Text>
          
          <Text style={styles.searchInfoLabel}>Search Query:</Text>
          <View style={styles.queryContainer}>
            <TextInput
              style={styles.queryInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Edit search query..."
              multiline
            />
            <TouchableOpacity style={styles.manualSearchButton} onPress={handleManualSearch}>
              <Ionicons name="search" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.resultsCount}>
            Found {searchResult.suggestedProducts.length} matching products
          </Text>
        </View>

        <FlatList
          data={searchResult.suggestedProducts.slice(0, 5)} // Show top 5 results
          keyExtractor={(item) => item.id}
          style={styles.resultsList}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              style={styles.resultItem}
              onPress={() => handleProductSelect(item)}
            >
              <View style={styles.resultRank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultDetails}>
                  ₹{item.price} • {item.category}
                </Text>
                <Text style={styles.resultWholesaler}>
                  {item.wholesaler.name} • {typeof item.wholesaler.distance === 'number' ? item.wholesaler.distance.toFixed(1) : (parseFloat(String(item.wholesaler.distance)) || 0).toFixed(1)}km away
                </Text>
                <View style={styles.confidenceContainer}>
                  <View style={[styles.confidenceBar, { width: `${item.confidence * 100}%` }]} />
                  <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}% match</Text>
                </View>
              </View>
              
              <View style={styles.resultActions}>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          )}
        />

        <View style={styles.bottomActions}>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={handleViewAllResults}
          >
            <Text style={styles.viewAllButtonText}>
              View All {searchResult.suggestedProducts.length} Results
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Product Image Search</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {currentStep === 'scan' && renderScanStep()}
          {currentStep === 'results' && renderResultsStep()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: 'white'
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    padding: 5
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  content: {
    flex: 1
  },
  stepContainer: {
    flex: 1,
    padding: 20
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
    marginBottom: 30
  },
  featuresContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  featureText: {
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 15,
    fontWeight: '500'
  },
  searchButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20
  },
  disabledButton: {
    backgroundColor: '#999'
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  backButton: {
    padding: 5,
    marginRight: 15
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a'
  },
  searchInfoContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20
  },
  searchInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 5,
    marginTop: 10
  },
  extractedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    lineHeight: 20
  },
  queryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  queryInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    minHeight: 40
  },
  manualSearchButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  resultsList: {
    flex: 1
  },
  resultItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center'
  },
  resultRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },
  rankText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  },
  resultInfo: {
    flex: 1
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4
  },
  resultDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  resultWholesaler: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 8
  },
  confidenceContainer: {
    position: 'relative',
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginBottom: 4
  },
  confidenceBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2
  },
  confidenceText: {
    fontSize: 10,
    color: '#999',
    position: 'absolute',
    right: 0,
    top: 6
  },
  resultActions: {
    paddingLeft: 15
  },
  bottomActions: {
    paddingTop: 20
  },
  viewAllButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  viewAllButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default ProductImageSearch;