import { supabase } from './supabase/supabase';
import { translationService } from './translationService';

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  brand?: string;
  image_url?: string;
  price?: number;
  description?: string;
  seller_id?: string;
  stock_available?: number;
}

interface SearchResult {
  products: Product[];
  categories: string[];
  brands: string[];
  totalCount: number;
}

interface VoiceSearchOptions {
  query: string;
  language?: string;
  intent?: 'search' | 'order' | 'navigate';
  limit?: number;
  includeOutOfStock?: boolean;
  userLatitude?: number;
  userLongitude?: number;
  radiusKm?: number;
}

interface ProcessedQuery {
  searchTerms: string[];
  category: string | null;
  brand: string | null;
  productNames: string[];
  originalQuery: string;
  categoryScore: number;
}

class ProductSearchService {
  /**
   * Enhanced product search with multilingual support
   */
  static async searchProducts(options: VoiceSearchOptions & { userLanguage?: string; translatedQuery?: string }): Promise<SearchResult> {
    const { query, language = 'en-US', intent = 'search', limit = 50, includeOutOfStock = true, userLatitude, userLongitude, radiusKm = 20, userLanguage = 'en', translatedQuery } = options;
    
    try {
      // Clean and process both original and translated queries
      const processedQuery = this.processVoiceQuery(query, language);
      const processedTranslatedQuery = translatedQuery ? this.processVoiceQuery(translatedQuery, 'en-US') : null;
      console.log('Processed search queries:', { original: processedQuery, translated: processedTranslatedQuery });
      
      // Get nearby wholesalers and manufacturers if location is provided
      let nearbySellerIds: string[] = [];
      if (userLatitude && userLongitude) {
        try {
          // Prefer RPC, but gracefully fallback to direct queries if RPC is missing
          let wholesalerIds: string[] = [];
          let manufacturerIds: string[] = [];

          const { data: nearbyWholesalers, error: wholesalerError } = await supabase
            .rpc('find_nearby_wholesalers', {
              radius_km: radiusKm,
              user_lat: userLatitude,
              user_lng: userLongitude
            });

          if (wholesalerError || !nearbyWholesalers) {
            console.warn('RPC find_nearby_wholesalers unavailable, using direct seller_details fallback.', wholesalerError);
            const { data: wholesalerRows, error: directWErr } = await supabase
              .from('seller_details')
              .select('user_id, latitude, longitude, seller_type')
              .eq('seller_type', 'wholesaler')
              .not('latitude', 'is', null)
              .not('longitude', 'is', null);

            if (directWErr) {
              console.error('Direct wholesaler fallback query error:', directWErr);
            } else if (wholesalerRows && wholesalerRows.length > 0) {
              wholesalerIds = wholesalerRows
                .filter((row: any) => ProductSearchService.haversineDistanceKm(userLatitude, userLongitude, row.latitude, row.longitude) <= radiusKm)
                .map((row: any) => row.user_id);
              console.log(`Fallback wholesalers within ${radiusKm}km: ${wholesalerIds.length}`);
            }
          } else {
            wholesalerIds = nearbyWholesalers.map((w: any) => w.user_id);
            console.log(`RPC wholesalers within ${radiusKm}km: ${wholesalerIds.length}`);
          }

          const { data: nearbyManufacturers, error: manufacturerError } = await supabase
            .rpc('find_nearby_manufacturers', {
              radius_km: radiusKm,
              user_lat: userLatitude,
              user_lng: userLongitude
            });

          if (manufacturerError || !nearbyManufacturers) {
            console.warn('RPC find_nearby_manufacturers unavailable, using direct seller_details fallback.', manufacturerError);
            const { data: manufacturerRows, error: directMErr } = await supabase
              .from('seller_details')
              .select('user_id, latitude, longitude, seller_type')
              .eq('seller_type', 'manufacturer')
              .not('latitude', 'is', null)
              .not('longitude', 'is', null);

            if (directMErr) {
              console.error('Direct manufacturer fallback query error:', directMErr);
            } else if (manufacturerRows && manufacturerRows.length > 0) {
              manufacturerIds = manufacturerRows
                .filter((row: any) => ProductSearchService.haversineDistanceKm(userLatitude, userLongitude, row.latitude, row.longitude) <= radiusKm)
                .map((row: any) => row.user_id);
              console.log(`Fallback manufacturers within ${radiusKm}km: ${manufacturerIds.length}`);
            }
          } else {
            manufacturerIds = nearbyManufacturers.map((m: any) => m.user_id);
            console.log(`RPC manufacturers within ${radiusKm}km: ${manufacturerIds.length}`);
          }
          
          // Combine and de-duplicate
          nearbySellerIds = [...new Set([...wholesalerIds, ...manufacturerIds])];
          console.log(`Total nearby sellers (combined): ${nearbySellerIds.length}`);
        } catch (error) {
          console.error('Error fetching nearby sellers:', error);
          // Continue with search even if location-based filtering fails
        }
      } else {
        console.log('No user location provided, searching all sellers');
      }

      // Build the search query
      let searchQuery = supabase
        .from('products')
        .select(`
          id,
          name,
          category,
          subcategory,
          brand,
          image_url,
          price,
          description,
          seller_id,
          stock_available,
          min_quantity
        `);
      
      // Apply search filters with enhanced product name matching
      if (processedQuery.searchTerms.length > 0 || processedQuery.productNames.length > 0) {
        let hasSearchConditions = false;
        
        // Strategy 1: Prioritize detected product names (highest priority)
        if (processedQuery.productNames.length > 0) {
          const productNameConditions = [];
          for (const productName of processedQuery.productNames) {
            productNameConditions.push(`name.ilike.%${productName}%`);
            productNameConditions.push(`description.ilike.%${productName}%`);
          }
          if (productNameConditions.length > 0) {
            searchQuery = searchQuery.or(productNameConditions.join(','));
            hasSearchConditions = true;
          }
        }
        
        // Strategy 2: Search each term individually across all fields
        if (processedQuery.searchTerms.length > 0) {
          const termConditions = [];
          for (const term of processedQuery.searchTerms) {
            termConditions.push(`name.ilike.%${term}%`);
            termConditions.push(`category.ilike.%${term}%`);
            termConditions.push(`subcategory.ilike.%${term}%`);
            termConditions.push(`brand.ilike.%${term}%`);
            termConditions.push(`description.ilike.%${term}%`);
          }
          
          // Strategy 3: Search combined terms for exact product names
          const combinedTerm = processedQuery.searchTerms.join(' ');
          termConditions.push(`name.ilike.%${combinedTerm}%`);
          termConditions.push(`description.ilike.%${combinedTerm}%`);
          
          // Strategy 4: Search for partial matches with different combinations
          if (processedQuery.searchTerms.length > 1) {
            for (let i = 0; i < processedQuery.searchTerms.length - 1; i++) {
              const partialTerm = processedQuery.searchTerms.slice(i, i + 2).join(' ');
              termConditions.push(`name.ilike.%${partialTerm}%`);
            }
          }
          
          // Strategy 5: Fuzzy matching for common misspellings
          const fuzzyTerms = processedQuery.searchTerms.map(term => {
            // Handle common misspellings and variations
            const variations = {
              'atta': ['ata', 'wheat flour', 'flour'],
              'haldi': ['turmeric', 'haladi'],
              'doodh': ['milk', 'dudh'],
              'chawal': ['rice', 'chaawal'],
              'namak': ['salt', 'namk']
            };
            
            const termVariations = variations[term] || [];
            return [term, ...termVariations];
          }).flat();
          
          for (const fuzzyTerm of fuzzyTerms) {
            termConditions.push(`name.ilike.%${fuzzyTerm}%`);
          }
          
          // Apply search conditions
          if (termConditions.length > 0) {
            if (hasSearchConditions) {
              // If we already have product name conditions, combine with AND
              searchQuery = searchQuery.or(termConditions.join(','));
            } else {
              searchQuery = searchQuery.or(termConditions.join(','));
            }
          }
        }
      }
      
      // Filter by specific categories if detected
      if (processedQuery.category) {
        searchQuery = searchQuery.eq('category', processedQuery.category);
      }
      
      // Filter by brand if detected
      if (processedQuery.brand) {
        searchQuery = searchQuery.eq('brand', processedQuery.brand);
      }
      
      // Filter by nearby sellers (wholesalers + manufacturers) if location is provided
      if (nearbySellerIds.length > 0) {
        searchQuery = searchQuery.in('seller_id', nearbySellerIds);
      }

      // Filter out of stock items if needed
      if (!includeOutOfStock) {
        searchQuery = searchQuery.gt('stock_available', 0);
      }
      
      // Apply limit and execute query
      console.log('Executing search query with filters applied');
      const { data: products, error, count } = await searchQuery
        .limit(limit)
        .order('name');
      
      console.log('Product search results:', { products, error, count });
      
      if (error) {
        console.error('Product search error:', error);
        throw error;
      }
      
      if (!products || products.length === 0) {
        console.log('No products found, trying simpler search...');
        // Fallback to simpler search if no results
        const fallbackQuery = supabase
          .from('products')
          .select(`
            id,
            name,
            category,
            subcategory,
            brand,
            image_url,
            price,
            description,
            seller_id,
            stock_available,
            min_quantity
          `);
        
        // Simple text search across name and description
        if (processedQuery.searchTerms.length > 0) {
          const simpleConditions = [];
          for (const term of processedQuery.searchTerms) {
            simpleConditions.push(`name.ilike.%${term}%`);
            simpleConditions.push(`description.ilike.%${term}%`);
          }
          fallbackQuery.or(simpleConditions.join(','));
        }
        
        // Filter by nearby sellers if available
        if (nearbySellerIds.length > 0) {
          fallbackQuery.in('seller_id', nearbySellerIds);
        }
        
        const { data: fallbackProducts, error: fallbackError } = await fallbackQuery
          .limit(limit)
          .order('name');
        
        if (!fallbackError && fallbackProducts) {
          console.log('Fallback search found:', fallbackProducts.length, 'products');
          return {
            products: fallbackProducts,
            categories: [...new Set(fallbackProducts.map(p => p.category).filter(Boolean))] as string[],
            brands: [...new Set(fallbackProducts.map(p => p.brand).filter(Boolean))] as string[],
            totalCount: fallbackProducts.length
          };
        }
      }
      
      // Extract unique categories and brands from results
      const categories = [...new Set(products?.map(p => p.category).filter(Boolean))] as string[];
      const brands = [...new Set(products?.map(p => p.brand).filter(Boolean))] as string[];
      
      return {
        products: products || [],
        categories,
        brands,
        totalCount: count || products?.length || 0
      };
      
    } catch (error) {
      console.error('Error in product search:', error);
      return {
        products: [],
        categories: [],
        brands: [],
        totalCount: 0
      };
    }
  }

  /**
   * Process voice query to extract meaningful search terms
   */
  private static processVoiceQuery(query: string, language: string) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Remove common voice command words
    const stopWords = {
      'en-US': ['i', 'want', 'need', 'search', 'for', 'find', 'show', 'me', 'get', 'buy', 'order', 'a', 'an', 'the', 'some'],
      'hi-IN': ['मुझे', 'चाहिए', 'खोजो', 'दिखाओ', 'लाओ', 'ऑर्डर', 'करो'],
      'te-IN': ['నాకు', 'కావాలి', 'చూపించు', 'తెచ్చు', 'ఆర్డర్'],
      'ta-IN': ['எனக்கு', 'வேண்டும்', 'காட்டு', 'கொண்டு', 'ஆர்டர்'],
      'kn-IN': ['ನನಗೆ', 'ಬೇಕು', 'ತೋರಿಸು', 'ತಂದು', 'ಆರ್ಡರ್']
    };
    
    const currentStopWords = stopWords[language as keyof typeof stopWords] || stopWords['en-US'];
    
    // Split query into words and remove stop words
    const words = lowerQuery.split(/\s+/).filter(word => 
      word.length > 1 && !currentStopWords.includes(word)
    );
    
    // Enhanced product and category keywords
    const productKeywords = {
      // Groceries and Food Items
      'groceries': [
        'grocery', 'groceries', 'food', 'rice', 'dal', 'oil', 'flour', 'sugar', 'salt',
        'atta', 'wheat', 'maida', 'besan', 'rava', 'sooji', 'poha', 'upma',
        'turmeric', 'haldi', 'chili', 'mirchi', 'coriander', 'dhania', 'cumin', 'jeera',
        'mustard', 'sarson', 'fenugreek', 'methi', 'cardamom', 'elaichi',
        'milk', 'doodh', 'curd', 'dahi', 'paneer', 'cheese', 'butter', 'ghee',
        'onion', 'pyaz', 'potato', 'aloo', 'tomato', 'tamatar', 'ginger', 'adrak',
        'garlic', 'lehsun', 'green', 'vegetables', 'sabzi'
      ],
      'personal-care': [
        'soap', 'shampoo', 'toothpaste', 'cream', 'lotion', 'perfume', 'deodorant',
        'face wash', 'body wash', 'hair oil', 'moisturizer', 'sunscreen',
        'toothbrush', 'razor', 'shaving cream'
      ],
      'household': [
        'detergent', 'cleaner', 'brush', 'cloth', 'bucket', 'mop',
        'dishwash', 'floor cleaner', 'toilet cleaner', 'phenyl',
        'washing powder', 'fabric softener'
      ],
      'beverages': [
        'water', 'juice', 'tea', 'coffee', 'soft drink', 'cola',
        'chai', 'green tea', 'black tea', 'milk tea', 'lassi',
        'cold drink', 'energy drink'
      ],
      'snacks': [
        'biscuit', 'chips', 'namkeen', 'chocolate', 'candy', 'nuts',
        'cookies', 'crackers', 'wafers', 'mixture', 'sev', 'bhujia',
        'dry fruits', 'almonds', 'cashew', 'raisins', 'dates'
      ],
      'stationery': [
        'pen', 'pencil', 'notebook', 'paper', 'eraser', 'ruler',
        'marker', 'highlighter', 'stapler', 'scissors', 'glue'
      ]
    };
    
    // Detect category based on product keywords
    let detectedCategory = null;
    let categoryScore = 0;
    
    for (const [category, keywords] of Object.entries(productKeywords)) {
      const matches = keywords.filter(keyword => lowerQuery.includes(keyword)).length;
      if (matches > categoryScore) {
        categoryScore = matches;
        detectedCategory = category;
      }
    }
    
    // Detect common brand names (expanded list)
    const commonBrands = [
      'tata', 'amul', 'britannia', 'parle', 'nestle', 'unilever', 'colgate', 'dabur', 'patanjali',
      'maggi', 'knorr', 'kissan', 'mdh', 'everest', 'catch', 'aashirvaad', 'fortune',
      'saffola', 'sundrop', 'gemini', 'gold winner', 'pillsbury', 'quaker',
      'mother dairy', 'nandini', 'heritage', 'aavin'
    ];
    const detectedBrand = commonBrands.find(brand => lowerQuery.includes(brand));
    
    // Enhanced product name detection
    const productNames = [];
    
    // Check for common product combinations
    const productCombinations = {
      'wheat flour': ['atta', 'wheat flour', 'gehun ka atta'],
      'turmeric powder': ['turmeric', 'haldi', 'turmeric powder'],
      'milk': ['milk', 'doodh', 'fresh milk', 'toned milk'],
      'cooking oil': ['oil', 'cooking oil', 'sunflower oil', 'mustard oil'],
      'basmati rice': ['basmati', 'rice', 'basmati rice'],
      'tea': ['tea', 'chai', 'black tea', 'green tea'],
      'sugar': ['sugar', 'cheeni', 'white sugar'],
      'salt': ['salt', 'namak', 'iodized salt']
    };
    
    for (const [productName, variations] of Object.entries(productCombinations)) {
      if (variations.some(variation => lowerQuery.includes(variation))) {
        productNames.push(productName);
      }
    }
    
    return {
      searchTerms: words,
      category: detectedCategory,
      brand: detectedBrand,
      productNames: productNames,
      originalQuery: query,
      categoryScore: categoryScore
    };
  }
  
  /**
   * Get product suggestions based on partial input
   */
  static async getProductSuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(limit);
      
      if (error) {
        console.error('Error fetching product suggestions:', error);
        return [];
      }
      
      return products?.map(p => p.name) || [];
    } catch (error) {
      console.error('Error in getProductSuggestions:', error);
      return [];
    }
  }
  
  /**
   * Apply multilingual text search to products
   */
  private static applyMultilingualTextSearch(
    products: any[], 
    originalQuery: ProcessedQuery | null, 
    translatedQuery: ProcessedQuery | null,
    userLanguage: string
  ): any[] {
    if ((!originalQuery || !originalQuery.searchTerms.length) && 
        (!translatedQuery || !translatedQuery.searchTerms.length)) {
      return products;
    }

    return products.filter(product => {
      const searchableText = [
        product.name,
        product.category,
        product.subcategory,
        product.brand,
        product.description
      ].filter(Boolean).join(' ').toLowerCase();

      let hasMatch = false;
      product._relevanceScore = 0;

      // Search with original query (user's language)
      if (originalQuery && originalQuery.searchTerms.length > 0) {
        const originalMatch = this.searchWithQuery(product, searchableText, originalQuery, userLanguage === 'en' ? 1.0 : 1.2);
        if (originalMatch) {
          hasMatch = true;
        }
      }

      // Search with translated query (English)
      if (translatedQuery && translatedQuery.searchTerms.length > 0) {
        const translatedMatch = this.searchWithQuery(product, searchableText, translatedQuery, userLanguage === 'en' ? 1.2 : 1.0);
        if (translatedMatch) {
          hasMatch = true;
        }
      }

      return hasMatch;
    });
  }

  /**
   * Search with a specific query and apply relevance scoring
   */
  private static searchWithQuery(
    product: any, 
    searchableText: string, 
    processedQuery: ProcessedQuery, 
    scoreMultiplier: number = 1.0
  ): boolean {
    let hasMatch = false;

    // Strategy 1: Prioritize products where name contains search terms
    const nameMatches = processedQuery.searchTerms.some(term => 
      product.name?.toLowerCase().includes(term.toLowerCase())
    );
    
    if (nameMatches) {
      product._relevanceScore = (product._relevanceScore || 0) + (10 * scoreMultiplier);
      hasMatch = true;
    }

    // Strategy 2: Search for individual terms
    const individualMatches = processedQuery.searchTerms.some(term => 
      searchableText.includes(term.toLowerCase())
    );
    
    if (individualMatches) {
      product._relevanceScore = (product._relevanceScore || 0) + (5 * scoreMultiplier);
      hasMatch = true;
    }

    // Strategy 3: Search for combined terms
    const combinedQuery = processedQuery.searchTerms.join(' ').toLowerCase();
    if (searchableText.includes(combinedQuery)) {
      product._relevanceScore = (product._relevanceScore || 0) + (8 * scoreMultiplier);
      hasMatch = true;
    }

    // Strategy 4: Partial matches
    const partialMatches = processedQuery.searchTerms.some(term => {
      return searchableText.split(' ').some(word => 
        word.startsWith(term.toLowerCase()) || term.toLowerCase().startsWith(word)
      );
    });
    
    if (partialMatches) {
      product._relevanceScore = (product._relevanceScore || 0) + (3 * scoreMultiplier);
      hasMatch = true;
    }

    // Strategy 5: Fuzzy matching for common misspellings
    const fuzzyMatches = processedQuery.searchTerms.some(term => {
      return this.fuzzyMatch(term.toLowerCase(), searchableText);
    });
    
    if (fuzzyMatches) {
      product._relevanceScore = (product._relevanceScore || 0) + (2 * scoreMultiplier);
      hasMatch = true;
    }

    return hasMatch;
  }

  /**
   * Apply text search to products (legacy method for backward compatibility)
   */
  private static applyTextSearch(products: any[], processedQuery: ProcessedQuery): any[] {
    return this.applyMultilingualTextSearch(products, processedQuery, null, 'en');
  }

  /**
   * Sort products by multilingual relevance score
   */
  private static sortByMultilingualRelevance(
    products: any[], 
    originalQuery: ProcessedQuery | null, 
    translatedQuery: ProcessedQuery | null,
    userLanguage: string
  ): any[] {
    return products.sort((a, b) => {
      const scoreA = a._relevanceScore || 0;
      const scoreB = b._relevanceScore || 0;
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Higher score first
      }
      
      // Secondary sort by name similarity (prioritize user's language)
      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      
      let maxSimilarityA = 0;
      let maxSimilarityB = 0;
      
      // Calculate similarity with original query
      if (originalQuery && originalQuery.searchTerms.length > 0) {
        const originalQueryTerms = originalQuery.searchTerms.join(' ').toLowerCase();
        const similarityA = this.calculateStringSimilarity(nameA, originalQueryTerms);
        const similarityB = this.calculateStringSimilarity(nameB, originalQueryTerms);
        
        maxSimilarityA = Math.max(maxSimilarityA, similarityA * (userLanguage === 'en' ? 1.0 : 1.2));
        maxSimilarityB = Math.max(maxSimilarityB, similarityB * (userLanguage === 'en' ? 1.0 : 1.2));
      }
      
      // Calculate similarity with translated query
      if (translatedQuery && translatedQuery.searchTerms.length > 0) {
        const translatedQueryTerms = translatedQuery.searchTerms.join(' ').toLowerCase();
        const similarityA = this.calculateStringSimilarity(nameA, translatedQueryTerms);
        const similarityB = this.calculateStringSimilarity(nameB, translatedQueryTerms);
        
        maxSimilarityA = Math.max(maxSimilarityA, similarityA * (userLanguage === 'en' ? 1.2 : 1.0));
        maxSimilarityB = Math.max(maxSimilarityB, similarityB * (userLanguage === 'en' ? 1.2 : 1.0));
      }
      
      if (maxSimilarityA !== maxSimilarityB) {
        return maxSimilarityB - maxSimilarityA;
      }
      
      // Tertiary sort by creation date (newer first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Sort products by relevance score (legacy method for backward compatibility)
   */
  private static sortByRelevance(products: any[], processedQuery: ProcessedQuery): any[] {
    return this.sortByMultilingualRelevance(products, processedQuery, null, 'en');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Fuzzy matching for common misspellings and variations
   */
  private static fuzzyMatch(term: string, text: string): boolean {
    // Handle common misspellings and variations
    const variations: { [key: string]: string[] } = {
      'atta': ['ata', 'wheat flour', 'flour'],
      'haldi': ['turmeric', 'haladi'],
      'doodh': ['milk', 'dudh'],
      'chawal': ['rice', 'chaawal'],
      'namak': ['salt', 'namk'],
      'mirchi': ['chili', 'chilli', 'pepper'],
      'jeera': ['cumin', 'jira'],
      'dhania': ['coriander', 'cilantro']
    };
    
    // Check if term has variations
    const termVariations = variations[term] || [];
    
    // Check direct match
    if (text.includes(term)) return true;
    
    // Check variations
    return termVariations.some(variation => text.includes(variation));
  }
  
  /**
   * Find exact product match for ordering
   */
  static async findProductForOrder(productName: string): Promise<Product | null> {
    try {
      // First try exact match
      let { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', productName)
        .limit(1);
      
      if (error) throw error;
      
      // If no exact match, try partial match
      if (!products || products.length === 0) {
        ({ data: products, error } = await supabase
          .from('products')
          .select('*')
          .ilike('name', `%${productName}%`)
          .limit(1));
        
        if (error) throw error;
      }
      
      return products && products.length > 0 ? products[0] : null;
    } catch (error) {
      console.error('Error finding product for order:', error);
      return null;
    }
  }
  
  /**
   * Add product to cart (for voice ordering)
   */
  static async addToCartViaVoice(userId: string, productId: string, quantity: number = 1): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cart_items')
        .upsert({
          user_id: userId,
          product_id: productId,
          quantity: quantity,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,product_id'
        });
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error adding to cart via voice:', error);
      return false;
    }
  }

  // Haversine distance (km) helper for fallback path calculations
  private static haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}

export default ProductSearchService;
export type { Product, SearchResult, VoiceSearchOptions };