import { GoogleCloudVisionOCRService } from '../googleCloud/visionOCRService';
import { Alert } from 'react-native';

export interface ProductMappingResult {
  success: boolean;
  originalText: string;
  translatedText?: string;
  detectedLanguage: string;
  extractedItems: string[];
  mappedProducts: ProductMatch[];
  unavailableItems: string[];
  error?: string;
}

export interface ProductMatch {
  id: string;
  name: string;
  category: string;
  price: number;
  wholesaler: {
    id: string;
    name: string;
    distance: number;
    inStock: boolean;
  };
  confidence: number;
  originalItem: string;
}

export interface ProductSearchResult {
  success: boolean;
  extractedText: string;
  searchQuery: string;
  detectedLanguage: string;
  suggestedProducts: ProductMatch[];
  error?: string;
}

class EnhancedOCRService {
  /**
   * Process image for product list mapping (Use Case 1)
   * Extracts text, translates to English, maps to database products
   */
  static async processProductListImage(): Promise<ProductMappingResult> {
    try {
      // Step 1: Extract text from image
      const ocrService = GoogleCloudVisionOCRService.getInstance();
      const ocrResults = await ocrService.showOCROptions(['en']);
      
      if (!ocrResults || ocrResults.length === 0) {
        return {
          success: false,
          originalText: '',
          detectedLanguage: 'unknown',
          extractedItems: [],
          mappedProducts: [],
          unavailableItems: [],
          error: 'Failed to extract text from image'
        };
      }

      const originalText = ocrResults[0].text.trim();
      const detectedLanguage = ocrResults[0].language || 'en';
      
      // Step 2: Translate to English if not already in English
      let translatedText = originalText;
      if (detectedLanguage !== 'en') {
        console.warn('Translation service not available, using original text');
        // Note: Translation functionality has been removed
        // Using original text as fallback
      }

      // Step 3: Extract individual items from the text
      const extractedItems = this.extractItemsFromText(translatedText);
      
      // Step 4: Map items to products in database
      const mappedProducts = await this.mapItemsToProducts(extractedItems);
      
      // Step 5: Identify unavailable items
      const mappedItemNames = mappedProducts.map(p => p.originalItem.toLowerCase());
      const unavailableItems = extractedItems.filter(item => 
        !mappedItemNames.includes(item.toLowerCase())
      );
      
      return {
        success: true,
        originalText,
        translatedText: detectedLanguage !== 'en' ? translatedText : undefined,
        detectedLanguage,
        extractedItems,
        mappedProducts,
        unavailableItems
      };
      
    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      return {
        success: false,
        originalText: '',
        detectedLanguage: 'unknown',
        extractedItems: [],
        mappedProducts: [],
        unavailableItems: [],
        error: `Processing failed: ${error}`
      };
    }
  }

  /**
   * Process image for general product search (Use Case 2)
   * Extracts text and provides search suggestions
   */
  static async processProductSearchImage(): Promise<ProductSearchResult> {
    try {
      // Step 1: Extract text from image
      const ocrService = GoogleCloudVisionOCRService.getInstance();
      const ocrResults = await ocrService.showOCROptions(['en']);
      
      if (!ocrResults || ocrResults.length === 0) {
        return {
          success: false,
          extractedText: '',
          searchQuery: '',
          detectedLanguage: 'unknown',
          suggestedProducts: [],
          error: 'Failed to extract text from image'
        };
      }

      const extractedText = ocrResults[0].text.trim();
      const detectedLanguage = ocrResults[0].language || 'en';
      
      // Step 2: Generate search query from extracted text
      const searchQuery = this.generateSearchQuery(extractedText);
      
      // Step 3: Get product suggestions based on search query
      const suggestedProducts = await this.searchProducts(searchQuery);
      
      return {
        success: true,
        extractedText,
        searchQuery,
        detectedLanguage,
        suggestedProducts
      };
      
    } catch (error) {
      console.error('Product search OCR failed:', error);
      return {
        success: false,
        extractedText: '',
        searchQuery: '',
        detectedLanguage: 'unknown',
        suggestedProducts: [],
        error: `Search processing failed: ${error}`
      };
    }
  }

  /**
   * Extract individual items from text (handles lists, bullet points, etc.)
   */
  private static extractItemsFromText(text: string): string[] {
    // Clean and normalize the text
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Split by common list separators
    const separators = /[\n\r•·\-\*\d+\.\)\(]/;
    const lines = cleanText.split(separators)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => line.length > 2) // Filter out very short items
      .filter(line => !/^[\d\s\-\.\)\(]+$/.test(line)); // Filter out number-only lines
    
    // Also try comma separation for inline lists
    const commaItems = cleanText.split(',')
      .map(item => item.trim())
      .filter(item => item.length > 2);
    
    // Combine and deduplicate
    const allItems = [...new Set([...lines, ...commaItems])];
    
    // Clean up each item
    return allItems.map(item => {
      return item
        .replace(/^[\d\s\-\.\)\(•·\*]+/, '') // Remove leading numbers/bullets
        .replace(/[\d\s\-\.\)\(•·\*]+$/, '') // Remove trailing numbers/bullets
        .trim()
        .toLowerCase();
    }).filter(item => item.length > 1);
  }

  /**
   * Generate optimized search query from extracted text
   */
  private static generateSearchQuery(text: string): string {
    // Remove common noise words and clean the text
    const noiseWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'];
    
    const words = text.toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !noiseWords.includes(word));
    
    // Take the most relevant words (first few meaningful words)
    return words.slice(0, 5).join(' ');
  }

  /**
   * Map extracted items to actual products
   */
  private static async mapItemsToProducts(items: string[]): Promise<ProductMatch[]> {
    // TODO: Implement actual product database queries
    // For now, throw an error to indicate this needs real implementation
    throw new Error('Product mapping not yet implemented. Please implement actual product database queries.');
  }

  /**
   * Search for products based on query
   */
  private static async searchProducts(query: string): Promise<ProductMatch[]> {
    // TODO: Implement actual product search API
    // For now, throw an error to indicate this needs real implementation
    throw new Error('Product search not yet implemented. Please implement actual product search API.');
  }



  /**
   * Show product list confirmation dialog
   */
  static showProductListConfirmation(
    result: ProductMappingResult,
    onConfirm: (selectedProducts: ProductMatch[]) => void
  ) {
    if (!result.success || result.mappedProducts.length === 0) {
      Alert.alert(
        'No Products Found',
        'Could not find matching products for the items in the image. Please try with a clearer image or search manually.',
        [{ text: 'OK' }]
      );
      return;
    }

    const productList = result.mappedProducts
      .slice(0, 5) // Show top 5 matches
      .map((product, index) => 
        `${index + 1}. ${product.name} - ₹${product.price} (${product.wholesaler.name})`
      )
      .join('\n');

    Alert.alert(
      'Confirm Product List',
      `Found ${result.mappedProducts.length} matching products:\n\n${productList}\n\nWould you like to add these to your cart?`,
      [
        {
          text: 'Add to Cart',
          onPress: () => onConfirm(result.mappedProducts)
        },
        {
          text: 'View All',
          onPress: () => {
            // Navigate to detailed product list view
            console.log('Navigate to detailed view with:', result.mappedProducts);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }

  /**
   * Show product search results
   */
  static showSearchResults(
    result: ProductSearchResult,
    onProductSelect: (product: ProductMatch) => void
  ) {
    if (!result.success || result.suggestedProducts.length === 0) {
      Alert.alert(
        'No Results Found',
        'Could not find products matching the text in the image. Please try with a different image or search manually.',
        [{ text: 'OK' }]
      );
      return;
    }

    const topProduct = result.suggestedProducts[0];
    
    Alert.alert(
      'Search Results',
      `Found products for: "${result.searchQuery}"\n\nTop result: ${topProduct.name} - ₹${topProduct.price}\n\nWould you like to view this product or see all results?`,
      [
        {
          text: 'View Product',
          onPress: () => onProductSelect(topProduct)
        },
        {
          text: 'View All Results',
          onPress: () => {
            // Navigate to search results page
            console.log('Navigate to search results with:', result.suggestedProducts);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  }
}

export default EnhancedOCRService;