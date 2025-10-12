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
  Slider
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedOCRService, { ProductMappingResult, ProductMatch } from '../../services/azureAI/enhancedOCRService';
import { useTranslateDynamic } from '../../utils/translationUtils';

interface ProductListScannerProps {
  onProductsSelected: (products: ProductMatch[]) => void;
  onClose: () => void;
  visible: boolean;
}

interface SelectedProduct extends ProductMatch {
  selected: boolean;
  quantity: number;
}

const { width, height } = Dimensions.get('window');

const ProductListScanner: React.FC<ProductListScannerProps> = ({
  onProductsSelected,
  onClose,
  visible
}) => {
  const { translateArrayFields } = useTranslateDynamic();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ProductMappingResult | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [currentStep, setCurrentStep] = useState<'scan' | 'review' | 'confirm'>('scan');
  const [maxDistance, setMaxDistance] = useState<number>(50); // Default 50km
  const [filteredProducts, setFilteredProducts] = useState<SelectedProduct[]>([]);
  const [showUnavailableItems, setShowUnavailableItems] = useState<boolean>(false);

  const handleScanPress = async () => {
    try {
      setIsProcessing(true);
      setCurrentStep('scan');
      
      const result = await EnhancedOCRService.processProductListImage();
      
      if (result.success && result.mappedProducts.length > 0) {
        setScanResult(result);
        
        // Translate product names and wholesaler business names
        const translatedProducts = await translateArrayFields(
          result.mappedProducts,
          ['name', 'wholesaler.business_name']
        );
        
        // Initialize selected products with default quantities
        const productsWithSelection = translatedProducts.map(product => ({
          ...product,
          selected: true, // Pre-select all products
          quantity: 1
        }));
        
        setSelectedProducts(productsWithSelection);
        setFilteredProducts(productsWithSelection);
        setCurrentStep('review');
      } else {
        Alert.alert(
          'No Products Found',
          result.error || 'Could not find matching products in the image. Please try with a clearer image.',
          [{ text: 'Try Again', onPress: () => setCurrentStep('scan') }]
        );
      }
    } catch (error) {
      console.error('Product list scanning error:', error);
      Alert.alert(
        'Scanning Failed',
        'An error occurred while processing the image. Please try again.',
        [{ text: 'OK', onPress: () => setCurrentStep('scan') }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, selected: !product.selected }
          : product
      )
    );
    setFilteredProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, selected: !product.selected }
          : product
      )
    );
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setSelectedProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, quantity }
          : product
      )
    );
    setFilteredProducts(prev => 
      prev.map(product => 
        product.id === productId 
          ? { ...product, quantity }
          : product
      )
    );
  };

  const filterProductsByDistance = (distance: number) => {
    setMaxDistance(distance);
    const filtered = selectedProducts.filter(product => 
      product.wholesaler.distance <= distance
    );
    setFilteredProducts(filtered);
  };

  const handleConfirmSelection = () => {
    const finalProducts = filteredProducts
      .filter(product => product.selected)
      .map(({ selected, quantity, ...product }) => ({
        ...product,
        quantity // Add quantity to the product data
      }));
    
    if (finalProducts.length === 0) {
      Alert.alert(
        'No Products Selected',
        'Please select at least one product to continue.',
        [{ text: 'OK' }]
      );
      return;
    }

    onProductsSelected(finalProducts);
    handleClose();
  };

  const handleClose = () => {
    setScanResult(null);
    setSelectedProducts([]);
    setFilteredProducts([]);
    setMaxDistance(50);
    setShowUnavailableItems(false);
    setCurrentStep('scan');
    setIsProcessing(false);
    onClose();
  };

  const renderScanStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="camera" size={80} color="#007AFF" />
      </View>
      
      <Text style={styles.title}>Scan Product List</Text>
      <Text style={styles.subtitle}>
        Take a photo of your product list in any regional language.
        We'll translate it to English and find matching products.
      </Text>
      
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Tips for better results:</Text>
        <Text style={styles.instruction}>• Ensure good lighting</Text>
        <Text style={styles.instruction}>• Keep text clear and readable</Text>
        <Text style={styles.instruction}>• Avoid shadows and glare</Text>
        <Text style={styles.instruction}>• Hold camera steady</Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.scanButton, isProcessing && styles.disabledButton]} 
        onPress={handleScanPress}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Ionicons name="camera" size={24} color="white" />
        )}
        <Text style={styles.scanButtonText}>
          {isProcessing ? 'Processing...' : 'Scan Product List'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewStep = () => {
    if (!scanResult) return null;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentStep('scan')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Products</Text>
        </View>

        {scanResult.translatedText && (
          <View style={styles.translationContainer}>
            <Text style={styles.translationLabel}>Detected Language: {scanResult.detectedLanguage.toUpperCase()}</Text>
            <Text style={styles.originalText}>Original: {scanResult.originalText}</Text>
                <Text style={styles.translatedText}>Translated: {scanResult.translatedText}</Text>
          </View>
        )}

        <View style={styles.filtersContainer}>
          <Text style={styles.sectionTitle}>
            Found {filteredProducts.filter(p => p.selected).length} of {filteredProducts.length} products
          </Text>
          
          <View style={styles.distanceFilterContainer}>
            <Text style={styles.filterLabel}>Maximum Distance: {maxDistance}km</Text>
            <Slider
              style={styles.distanceSlider}
              minimumValue={1}
              maximumValue={100}
              value={maxDistance}
              onValueChange={filterProductsByDistance}
              step={1}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#d3d3d3"
              thumbStyle={styles.sliderThumb}
            />
            <View style={styles.distanceLabels}>
              <Text style={styles.distanceLabel}>1km</Text>
              <Text style={styles.distanceLabel}>100km</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          style={styles.productList}
          renderItem={({ item }) => (
            <View style={[styles.productItem, !item.selected && styles.unselectedProduct]}>
              <TouchableOpacity 
                style={styles.productHeader}
                onPress={() => toggleProductSelection(item.id)}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productDetails}>
                    ₹{item.price} • {item.category} • {item.confidence * 100}% match
                  </Text>
                  <Text style={styles.wholesalerInfo}>
                    {item.wholesaler.name} • {typeof item.wholesaler.distance === 'number' ? item.wholesaler.distance.toFixed(1) : (parseFloat(String(item.wholesaler.distance)) || 0).toFixed(1)}km away
                  </Text>
                  <Text style={styles.originalItem}>From: "{item.originalItem}"</Text>
                </View>
                
                <View style={styles.selectionContainer}>
                  <Ionicons 
                    name={item.selected ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={item.selected ? "#007AFF" : "#999"} 
                  />
                </View>
              </TouchableOpacity>
              
              {item.selected && (
                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateProductQuantity(item.id, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateProductQuantity(item.id, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        />

        {scanResult && scanResult.unavailableItems && scanResult.unavailableItems.length > 0 && (
          <View style={styles.unavailableSection}>
            <TouchableOpacity 
              style={styles.unavailableHeader}
              onPress={() => setShowUnavailableItems(!showUnavailableItems)}
            >
              <Text style={styles.unavailableTitle}>
                Not Available Items ({scanResult.unavailableItems.length})
              </Text>
              <Ionicons 
                name={showUnavailableItems ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {showUnavailableItems && (
              <View style={styles.unavailableList}>
                {scanResult.unavailableItems.map((item, index) => (
                  <View key={index} style={styles.unavailableItem}>
                    <Ionicons name="close-circle" size={16} color="#ff6b6b" />
                    <Text style={styles.unavailableItemText}>{item}</Text>
                  </View>
                ))}
                <Text style={styles.unavailableNote}>
                  These items were detected but no matching products were found in our database.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomActions}>
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={handleConfirmSelection}
          >
            <Text style={styles.confirmButtonText}>
              Add {filteredProducts.filter(p => p.selected).length} Products to Cart
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
          <Text style={styles.modalTitle}>Product List Scanner</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {currentStep === 'scan' && renderScanStep()}
          {currentStep === 'review' && renderReviewStep()}
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
  instructionsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20
  },
  scanButton: {
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
  scanButtonText: {
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
  translationContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8
  },
  originalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  translatedText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15
  },
  productList: {
    flex: 1
  },
  productItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden'
  },
  unselectedProduct: {
    opacity: 0.6
  },
  productHeader: {
    flexDirection: 'row',
    padding: 15
  },
  productInfo: {
    flex: 1
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4
  },
  productDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  wholesalerInfo: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4
  },
  originalItem: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic'
  },
  selectionContainer: {
    justifyContent: 'center',
    paddingLeft: 15
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a'
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginHorizontal: 15,
    minWidth: 30,
    textAlign: 'center'
  },
  bottomActions: {
    paddingTop: 20
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  filtersContainer: {
    marginBottom: 20
  },
  distanceFilterContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginTop: 10
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10
  },
  distanceSlider: {
    width: '100%',
    height: 40
  },
  sliderThumb: {
    backgroundColor: '#007AFF',
    width: 20,
    height: 20
  },
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5
  },
  distanceLabel: {
    fontSize: 12,
    color: '#666'
  },
  unavailableSection: {
    marginTop: 20,
    marginBottom: 10
  },
  unavailableHeader: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffeaa7'
  },
  unavailableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404'
  },
  unavailableList: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 5,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e1e5e9'
  },
  unavailableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  unavailableItemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1
  },
  unavailableNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center'
  }
});

export default ProductListScanner;