import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, Pressable, Dimensions, ScrollView } from 'react-native';
import { Text, Searchbar, Card, Avatar, ActivityIndicator, IconButton, Chip, Button, Snackbar } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../services/supabase/supabase';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';
import ProductImage from '../../../components/common/ProductImage';
import CartIcon from '../../../components/CartIcon';
import { useCartStore } from '../../../store/cart';

import { useLocationStore } from '../../../store/location';
import ProductSearchService from '../../../services/productSearchService';
import { useAuthStore } from '../../../store/auth';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTranslateDynamic } from '../../../utils/translationUtils';
import CartDistanceManager from '../../../components/CartDistanceManager';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;
  
  try {
    router = useRouter();
  } catch (error) {
    console.error('[Search] Error initializing router:', error);
    router = null;
  }
  
  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Search] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Search] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Search] router.back not available');
      }
    },
    canGoBack: () => {
      if (router && typeof router.canGoBack === 'function') {
        return router.canGoBack();
      }
      return false;
    }
  };
  
  return safeRouter;
};


const { width } = Dimensions.get('window');
const productCardWidth = (width - 72) / 2; // Two cards per row with more spacing for smaller cards

interface SearchResult {
  type: 'product' | 'seller' | 'manufacturer' | 'category';
  id: string;
  name: string;
  image?: string;
  description?: string;
  path?: string;
  price?: string;
  unit?: string;
  seller_id?: string;
  min_quantity?: number;
  seller_name?: string;
  stock_available?: number;
}

export default function Search() {
  const router = useSafeRouter();
  const { query, results: initialResults, language, intent, autoOrder, quantity: voiceQuantity, source } = useLocalSearchParams();
  const { translateArrayFields } = useTranslateDynamic();
  
  // Direct text strings instead of translations
  const getTranslatedText = (text: string) => {
    const texts: Record<string, string> = {
      'Search Results': 'Search Results',
      'results': 'results',
      'Search wholesalers, products...': 'Search wholesalers, products...',
      'Sort by': 'Sort by',
      'Relevance': 'Relevance',
      'Name': 'Name',
      'No results found for': 'No results found for',
      'Products': 'Products',
      'Wholesalers': 'Wholesalers',
      'Manufacturers': 'Manufacturers',
      'Categories': 'Categories',
      'Product Name': 'Product Name',
      'No description available': 'No description available',
      'Seller': 'Seller',
      'Min Order': 'Min Order',
      'In stock': 'In stock',
      'Out of stock': 'Out of stock',
      'Wholesaler': 'Wholesaler',
      'Manufacturer': 'Manufacturer',
      'Add to Cart': 'Add to Cart',
      'Added': 'Added',
      'Remove': 'Remove',
      'Low stock': 'Low stock',
      'Available': 'Available',
      'Stock': 'Stock',
      'Min': 'Min',
      'Price': 'Price',
      '📷 OCR Order': '📷 OCR Order',
      '📷 Scan Search': '📷 Scan Search'
    };
    return texts[text] || text;
  };
  
  const [searchQuery, setSearchQuery] = useState(query as string);
  const [results, setResults] = useState<SearchResult[]>(() => {
    if (initialResults) {
      try {
        return JSON.parse(initialResults as string);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(!initialResults);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { addToCart } = useCartStore();
  const { user } = useAuthStore();
  const { userLocation } = useLocationStore();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [addedToCartIds, setAddedToCartIds] = useState<Record<string, boolean>>({});
  const [isVoiceSearch, setIsVoiceSearch] = useState(!!language);
  const [autoOrderMode, setAutoOrderMode] = useState(autoOrder === 'true');
  const [sortOption, setSortOption] = useState<'name' | 'relevance'>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [showDistanceManager, setShowDistanceManager] = useState(false);
  const [distanceError, setDistanceError] = useState('');






  // Remove product from search results
  const removeProduct = (productId: string) => {
    setResults(prev => prev.filter(item => item.id !== productId));
  };

  // Filter and sort results based on user preferences
  const getFilteredAndSortedResults = () => {
    let filteredResults = [...results];

    // Apply sorting
    filteredResults.sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          const priceA = parseFloat(a.price || '0');
          const priceB = parseFloat(b.price || '0');
          return priceA - priceB;
        case 'relevance':
        default:
          // Default sorting: products first
          if (a.type === 'product' && b.type !== 'product') return -1;
          if (a.type !== 'product' && b.type === 'product') return 1;
          return 0;
      }
    });

    return filteredResults;
  };

  // Reset filters
  const resetFilters = () => {
    setSortOption('relevance');
  };

  useEffect(() => {
    if (searchQuery) {
      performSearch(searchQuery);
    }
  }, []);
  
  // Handle voice search with auto-order on mount
  useEffect(() => {
    if (isVoiceSearch && autoOrderMode && searchQuery && !initialResults) {
      console.log('Voice search with auto-order detected, performing enhanced search...');
      performSearch(searchQuery);
    }
  }, [isVoiceSearch, autoOrderMode, searchQuery]);

  // Handle OCR search on mount
  useEffect(() => {
    if (source === 'ocr' && searchQuery && !initialResults) {
      console.log('OCR search detected, performing search for:', searchQuery);
      performSearch(searchQuery);
    }
  }, [source, searchQuery]);

  // Force re-render when sort option changes
  const [filterKey, setFilterKey] = useState(0);
  useEffect(() => {
    console.log('Filter changed - sortOption:', sortOption);
    setFilterKey(prev => prev + 1); // Force re-render
  }, [sortOption]);
  


  const handleQuantityChange = (productId: string, increment: boolean, minQuantity: number = 1) => {
    setQuantities(prev => {
      const currentQty = prev[productId] || minQuantity;
      return {
        ...prev,
        [productId]: increment ? currentQty + 1 : Math.max(minQuantity, currentQty - 1)
      };
    });
  };

  const handleAddToCart = async (product: SearchResult) => {
    try {
      if (product.type !== 'product') return;
      
      const quantity = quantities[product.id] || product.min_quantity || 1;
      
      await addToCart({
        uniqueId: `${product.id}-${Date.now()}`,
        product_id: product.id,
        name: product.name,
        price: product.price || "0",
        quantity,
        image_url: product.image || '',
        unit: product.unit || 'piece',
        seller_id: product.seller_id || ''
      });
      
      // Reset quantity after adding to cart
      setQuantities(prev => ({
        ...prev,
        [product.id]: product.min_quantity || 1
      }));

      // Show visual feedback
      setAddedToCartIds(prev => ({
        ...prev,
        [product.id]: true
      }));
      
      // Show snackbar message
      setSnackbarMessage(`Added ${product.name} to cart`);
      setSnackbarVisible(true);
      
      // Reset the checkmark after 2 seconds
      setTimeout(() => {
        setAddedToCartIds(prev => ({
          ...prev,
          [product.id]: false
        }));
      }, 2000);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      
      // Check if it's a distance validation error
      if (error.message && error.message.includes('Distance to')) {
        // Show distance constraint manager
        setDistanceError(error.message);
        setShowDistanceManager(true);
      } else {
        setSnackbarMessage("Failed to add item to cart. Please try again.");
        setSnackbarVisible(true);
        
        // Hide snackbar after 4 seconds for error messages
        setTimeout(() => {
          setSnackbarVisible(false);
        }, 4000);
      }
    }
  };

  const performSearch = async (query: string) => {
    if (!query) return;
    setLoading(true);
    console.log('Performing enhanced search for:', query, { language, intent, autoOrderMode });

    try {
      const { distanceFilter } = useLocationStore.getState();
      const isLocationFiltered = userLocation && distanceFilter;
      
      if (isLocationFiltered) {
        console.log(`Searching with location filter: ${distanceFilter}km radius from user location`);
      } else {
        console.log('Searching without location filter (no user location or distance filter)');
      }
      
      // Use the new ProductSearchService for better results with location-based filtering
      const searchResults = await ProductSearchService.searchProducts({
        query,
        language: language as string || 'en-US',
        intent: (intent as 'search' | 'order' | 'navigate') || 'search',
        limit: 50,
        includeOutOfStock: !autoOrderMode, // Exclude out of stock for orders
        userLatitude: userLocation?.latitude,
        userLongitude: userLocation?.longitude,
        radiusKm: isLocationFiltered ? distanceFilter : undefined
      }, language as string || 'en-US');
      
      console.log('Enhanced search results:', searchResults);
      
      const results: SearchResult[] = [];
      
      // Get seller details for products
      const productIds = searchResults.products.map(p => p.id);
      let sellerDetails: Record<string, any> = {};

      if (productIds.length > 0) {
        try {
          const sellerIds = searchResults.products.map(p => p.seller_id).filter(Boolean);
          console.log('Fetching seller details for seller IDs:', sellerIds);
          
          const { data: sellers, error: sellerError } = await supabase
            .from('seller_details')
            .select('user_id, business_name, latitude, longitude')
            .in('user_id', sellerIds);

          console.log('Seller details query result:', { sellers, sellerError });

          if (!sellerError && sellers) {
            sellers.forEach(seller => {
              sellerDetails[seller.user_id] = seller;
              console.log(`Seller ${seller.user_id} (${seller.business_name})`);
            });
          }
        } catch (error) {
          console.error('Error fetching seller details:', error);
        }
      }



      // Convert products to SearchResult format with seller info and distance filtering
      searchResults.products.forEach(product => {
        const seller = sellerDetails[product.seller_id || ''];
        
        console.log(`Processing product ${product.name}:`);
        console.log(`  - Seller ID: ${product.seller_id}`);
        console.log(`  - Seller found: ${!!seller}`);
        

        
        results.push({
          type: 'product',
          id: product.id,
          name: product.name,
          description: product.description || `${product.category} - ${product.subcategory}`,
          image: product.image_url,
          price: product.price?.toString() || '0',
          unit: 'piece',
          seller_id: product.seller_id,
          min_quantity: product.min_quantity || 1,
          seller_name: seller?.business_name || 'Unknown Seller',
          stock_available: product.stock_available
        });
      });
      
      // Products are already sorted by relevance from the search service
      console.log('Products sorted by relevance');
      
      // Add category results if no specific products found or for general search
      if (results.length < 5 || intent !== 'order') {
        console.log('Adding category results...');
        for (const category of PRODUCT_CATEGORIES) {
          if (category.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              type: 'category',
              id: category.id,
              name: category.name,
              description: `Browse ${category.name}`,
              path: `/(main)/screens/category/${category.id}`
            });
          }
          
          // Also search in subcategories
          if (category.subcategories) {
            for (const subcategory of category.subcategories) {
              if (subcategory.name.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  type: 'category',
                  id: subcategory.id,
                  name: subcategory.name,
                  description: `${category.name} > ${subcategory.name}`,
                  path: `/(main)/screens/category/${category.id}?subcategory=${subcategory.id}`
                });
              }
            }
          }
        }
      }
      
      // Search in profiles (sellers & manufacturers) for non-order searches
        if (intent !== 'order') {
          console.log('Searching in seller profiles...');
          let profileResults: any[] = [];
          
          try {
            // Sanitize query for tsquery - convert to proper format for PostgreSQL full-text search
            const sanitizedQuery = query
              .replace(/[\n\r\t]/g, ' ')  // Replace newlines and tabs with spaces
              .replace(/[^\w\s]/g, ' ')   // Replace special characters with spaces
              .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
              .trim()
              .split(' ')                 // Split into words
              .filter(word => word.length > 0) // Remove empty strings
              .join(' & ');               // Join with AND operator for tsquery
            
            console.log(`Original query: "${query}", Sanitized for tsquery: "${sanitizedQuery}"`);
            
            const { data, error } = await supabase
              .from('seller_details')
              .select(`
                user_id, 
                business_name, 
                address, 
                image_url, 
                profiles(id, role)
              `)
              .textSearch('business_name', sanitizedQuery);
              
            if (error) {
              console.error('Error searching in seller_details:', error);
            } else if (data && data.length > 0) {
              console.log(`Found ${data.length} results in seller_details`);
              
              // Add these results to profileResults
              data.forEach(seller => {
                // @ts-ignore - accessing profiles
                const role = seller.profiles?.role || 'seller';
                
                profileResults.push({
                  id: seller.user_id,
                  role: role,
                  name: seller.business_name,
                  image: seller.image_url,
                  description: seller.address?.street || 'Wholesaler'
                });
              });
            }
          } catch (err) {
            console.error('Exception in seller_details search:', err);
          }
          
          // Add the seller results to our main results array
          if (profileResults.length > 0) {
            console.log(`Found ${profileResults.length} total sellers/manufacturers`);
            
            profileResults.forEach(profile => {
              results.push({
                type: profile.role as 'seller' | 'manufacturer',
                id: profile.id,
                name: profile.name,
                image: profile.image,
                description: profile.description
              });
            });
          } else {
            console.log('No sellers or manufacturers found matching the search terms');
          }
        }
      
      // Handle auto-order mode for voice commands
      if (autoOrderMode && results.length > 0) {
        const productResults = results.filter(r => r.type === 'product');
        if (productResults.length > 0) {
          const firstProduct = productResults[0];
          const orderQuantity = parseInt(voiceQuantity as string) || 1;
          
          // Auto-add to cart
          try {
            if (user?.id && firstProduct.seller_id) {
              await ProductSearchService.addToCartViaVoice(
                user.id,
                firstProduct.id,
                orderQuantity
              );
              
              setSnackbarMessage(`Added ${orderQuantity} ${firstProduct.name} to cart automatically!`);
              setSnackbarVisible(true);
              setAddedToCartIds(prev => ({ ...prev, [firstProduct.id]: true }));
            }
          } catch (error) {
            console.error('Auto-order failed:', error);
            setSnackbarMessage('Auto-order failed. Please add manually.');
            setSnackbarVisible(true);
          }
        }
      }
      
      // Initialize quantities for voice search
      if (isVoiceSearch && voiceQuantity) {
        const initialQuantities: Record<string, number> = {};
        results.forEach(result => {
          if (result.type === 'product') {
            initialQuantities[result.id] = parseInt(voiceQuantity as string) || 1;
          }
        });
        setQuantities(initialQuantities);
       }

      console.log(`Total search results: ${results.length}`);
      
      // Translate search results
      const translatedResults = await translateArrayFields(
        results,
        ['name', 'description', 'seller_name']
      );
      
      setResults(translatedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'category':
        router.push(result.path || `/(main)/screens/category/${result.id}`);
        break;
      case 'seller':
      case 'manufacturer':
        router.push(`/(main)/screens/category/${result.id}`);
        break;
      case 'product':
        router.push(`/(main)/screens/product/${result.id}`);
        break;
    }
  };

  const renderProductItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'product') return null;
    
    const quantity = quantities[item.id] || item.min_quantity || 1;
    
    return (
      <View
        style={styles.productCard}
      >
        <Card style={styles.productCardInner}>
          <View style={styles.productHeader}>
            <View style={styles.imageContainer}>
              <ProductImage
                imageUrl={item.image}
                style={styles.productImage}
                resizeMode="cover"
              />
            </View>
            <IconButton
              icon="close"
              size={20}
              iconColor="#666"
              style={styles.removeButton}
              onPress={(e) => {
                e.stopPropagation();
                removeProduct(item.id);
              }}
            />
          </View>
          
          <View style={styles.productDetails}>
            <Text numberOfLines={2} style={styles.productName}>{item?.name || getTranslatedText('Product Name')}</Text>
            <Text numberOfLines={1} style={styles.productDescription}>{item?.description || getTranslatedText('No description available')}</Text>
            
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>{getTranslatedText('Seller')}: </Text>
              <Text style={styles.sellerName}>{item.seller_name || getTranslatedText('Seller')}</Text>
            </View>
            
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{item.price}</Text>
              <Text style={styles.unit}>/ {item.unit}</Text>
            </View>
            
            <View style={styles.stockInfo}>
              <Text style={styles.minOrderLabel}>{getTranslatedText('Min Order')}: </Text>
              <Text style={styles.minOrderValue}>{item.min_quantity} {item.unit}s</Text>
              {item.stock_available !== undefined && (
                <Text style={[styles.stockStatus, { color: item.stock_available > (item.min_quantity || 1) ? '#4CAF50' : '#F44336' }]}>
          • {item.stock_available > (item.min_quantity || 1) ? getTranslatedText('In stock') : getTranslatedText('Out of stock')}
        </Text>
              )}
            </View>
            
            <View style={styles.actionRow}>
              <View style={styles.quantityContainer}>
                <IconButton
                  icon="minus"
                  size={18}
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, false, item.min_quantity || 1)}
                />
                <Text style={styles.quantityText}>{quantity}</Text>
                <IconButton
                  icon="plus"
                  size={18}
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.id, true, item.min_quantity || 1)}
                />
              </View>
              
              <IconButton
                icon={addedToCartIds[item.id] ? "check" : "cart-plus"}
                iconColor={addedToCartIds[item.id] ? "#4CAF50" : "#666"}
                size={24}
                style={{ margin: 0, width: 40, height: 40 }}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
              />
            </View>
          </View>
        </Card>
      </View>
    );
  };

  const renderSellerItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'seller' && item.type !== 'manufacturer') return null;
    
    return (
      <Card
        style={styles.sellerCard}
        onPress={() => handleResultPress(item)}
      >
        <View style={styles.sellerCardInner}>
          <View style={styles.sellerImageContainer}>
            <ProductImage
              imageUrl={item.image}
              style={styles.sellerImage}
              resizeMode="cover"
            />
          </View>
          <Card.Content style={styles.sellerContent}>
            <Text variant="titleMedium" numberOfLines={1} style={styles.sellerName}>
              {item.name}
            </Text>
            <Text variant="bodySmall" style={styles.sellerAddress} numberOfLines={1}>
              {item.description}
            </Text>
            <Chip 
              icon={item.type === 'seller' ? 'store' : 'factory'} 
              style={styles.typeChip}
              textStyle={styles.chipText}
            >
              {item.type === 'seller' ? getTranslatedText('Wholesaler') : getTranslatedText('Manufacturer')}
            </Chip>
          </Card.Content>
        </View>
      </Card>
    );
  };

  const renderCategoryItem = ({ item }: { item: SearchResult }) => {
    if (item.type !== 'category') return null;
    
    return (
      <Card
        style={styles.categoryCard}
        onPress={() => handleResultPress(item)}
      >
        <Card.Content style={styles.categoryContent}>
          <Avatar.Icon 
            icon="folder" 
            size={40} 
            style={styles.categoryIcon} 
            color="#fff"
          />
          <View style={styles.categoryTextContainer}>
            <Text variant="titleMedium">{item.name || 'Product'}</Text>
            <Text variant="bodySmall">{item.description}</Text>
          </View>
          <IconButton 
            icon="chevron-right" 
            size={24} 
          />
        </Card.Content>
      </Card>
    );
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    switch (item.type) {
      case 'product':
        return renderProductItem({ item });
      case 'seller':
      case 'manufacturer':
        return renderSellerItem({ item });
      case 'category':
        return renderCategoryItem({ item });
      default:
        return null;
    }
  };

  // Group filtered and sorted results by type
  const filteredAndSortedResults = getFilteredAndSortedResults();
  const groupedResults = filteredAndSortedResults.reduce((acc, item) => {
    acc[item.type] = acc[item.type] || [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, SearchResult[]>);
  
  const renderResultsSection = () => {
    const hasProducts = groupedResults.product && groupedResults.product.length > 0;
    const hasSellers = groupedResults.seller && groupedResults.seller.length > 0;
    const hasManufacturers = groupedResults.manufacturer && groupedResults.manufacturer.length > 0;
    const hasCategories = groupedResults.category && groupedResults.category.length > 0;
    
    return (
      <>
        {/* Products Section */}
        {hasProducts && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>{getTranslatedText('Products')}</Text>
            <View style={styles.productsGrid}>
              {groupedResults.product?.map((item, index) => (
                <View key={`product-${item.id}`} style={{ width: '48%', marginRight: index % 2 === 0 ? '4%' : 0 }}>
                  {renderProductItem({ item })}
                </View>
              ))}
            </View>
          </View>
        )}
        {/* Wholesalers Section */}
        {hasSellers && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>{getTranslatedText('Wholesalers')}</Text>
            <View style={styles.sellersList}>
              {groupedResults.seller?.map((item) => (
                <View key={`seller-${item.id}`}>
                  {renderSellerItem({ item })}
                </View>
              ))}
            </View>
          </View>
        )}
        {/* Manufacturers Section */}
        {hasManufacturers && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>{getTranslatedText('Manufacturers')}</Text>
            <View style={styles.sellersList}>
              {groupedResults.manufacturer?.map((item) => (
                <View key={`manufacturer-${item.id}`}>
                  {renderSellerItem({ item })}
                </View>
              ))}
            </View>
          </View>
        )}
        {/* Categories Section */}
        {hasCategories && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>{getTranslatedText('Categories')}</Text>
            <View style={styles.categoriesList}>
              {groupedResults.category?.map((item) => (
                <View key={`category-${item.id}`}>
                  {renderCategoryItem({ item })}
                </View>
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="titleMedium" style={styles.headerTitle}>
          {isVoiceSearch ? (autoOrderMode ? "📷 OCR Order" : "📷 Scan Search") : "Search Results"}
        </Text>
          <View style={styles.headerRight}>
            {userLocation && useLocationStore.getState().distanceFilter && (
              <Chip
                icon="map-marker-radius"
                style={styles.distanceChip}
                textStyle={styles.distanceChipText}
              >
                {useLocationStore.getState().distanceFilter}km
              </Chip>
            )}
            {results.length > 0 && (
              <Text variant="bodySmall" style={styles.headerResultsCount}>
                {getFilteredAndSortedResults().length} results
              </Text>
            )}
            <CartIcon />
          </View>
        </View>
        {autoOrderMode && (
          <IconButton
            icon="cart-plus"
            iconColor="#4CAF50"
            onPress={() => {}}
          />
        )}
      </View>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={getTranslatedText('Search wholesalers, products...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => performSearch(searchQuery)}
          style={styles.searchBar}
        />
      </View>
      
      {/* Filter and Sort Controls */}
      {results.length > 0 && (
        <View style={styles.filtersContainer}>
          <View style={styles.filtersRow}>
            <IconButton
              icon={showFilters ? "filter" : "filter-outline"}
              iconColor={showFilters ? "#FF7D00" : "#666"}
              size={24}
              onPress={() => setShowFilters(!showFilters)}
            />
            <View style={styles.sortContainer}>
              <Text variant="bodySmall" style={styles.sortLabel}>{getTranslatedText('Sort by')}:</Text>
              <Chip
                selected={sortOption === 'relevance'}
                onPress={() => setSortOption('relevance')}
                style={[styles.sortChip, sortOption === 'relevance' && styles.selectedChip]}
                textStyle={styles.sortChipText}
              >
                {getTranslatedText('Relevance')}
              </Chip>
              <Chip
                selected={sortOption === 'name'}
                onPress={() => setSortOption('name')}
                style={[styles.sortChip, sortOption === 'name' && styles.selectedChip]}
                textStyle={styles.sortChipText}
              >
                {getTranslatedText('Name')}
              </Chip>
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : results.length > 0 ? (
          renderResultsSection()
        ) : (
          <View style={styles.noResults}>
            <Text>{getTranslatedText('No results found for')} "{searchQuery}"</Text>
          </View>
        )}
      </ScrollView>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        action={{
          label: "View Cart",
          onPress: () => router.push('/(main)/cart'),
        }}
      >
        {snackbarMessage}
      </Snackbar>

      {/* Distance Manager Modal */}
      <CartDistanceManager
        visible={showDistanceManager}
        onDismiss={() => setShowDistanceManager(false)}
        errorMessage={distanceError}
      />
    </View>
  );
}

export default Search;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceChip: {
    backgroundColor: '#E3F2FD',
    height: 28,
  },
  distanceChipText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '500',
  },
  headerResultsCount: {
    color: '#666',
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    fontStyle: 'italic',
  },
  searchContainer: {
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    elevation: 0,
  },
  list: {
    padding: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  // Product card styles
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  productCard: {
    width: productCardWidth,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  productCardInner: {
    elevation: 2,
  },
  productHeader: {
    position: 'relative',
  },
  imageContainer: {
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#f5f5f5',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    margin: 0,
  },
  productDetails: {
    padding: 4,
  },
  productName: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 1,
    color: '#333',
    lineHeight: 16,
  },
  productDescription: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
    lineHeight: 10,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  sellerLabel: {
    fontSize: 12,
    color: '#666',
  },
  sellerName: {
    fontSize: 7,
    fontWeight: '500',
    color: '#2196F3',
  },

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  price: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2196F3',
  },
  unit: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  // Filter and Sort styles
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsCount: {
    color: '#666',
    flex: 1,
    marginLeft: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sortLabel: {
    color: '#666',
    marginRight: 8,
  },
  sortChip: {
    marginHorizontal: 2,
    height: 32,
  },
  selectedChip: {
    backgroundColor: '#FF7D00',
  },
  sortChipText: {
    fontSize: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
  resetButtonText: {
    fontSize: 12,
    color: '#FF7D00',
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  minOrderLabel: {
    fontSize: 12,
    color: '#666',
  },
  minOrderValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  stockStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 2,
  },
  quantityButton: {
    margin: 0,
    width: 38,
    height: 38,
  },
  quantityText: {
    marginHorizontal: 2,
    fontWeight: '500',
    minWidth: 14,
    textAlign: 'center',
    fontSize: 16,
  },
  // Seller card styles
  sellersList: {
    paddingBottom: 8,
  },
  sellerCard: {
    marginBottom: 12,
    elevation: 2,
  },
  sellerCardInner: {
    flexDirection: 'row',
    // Remove overflow: 'hidden' from here
  },
  sellerImageContainer: {
    overflow: 'hidden', // Add this wrapper style
  },
  sellerImage: {
    width: 100,
    height: 100,
  },
  sellerContent: {
    flex: 1,
    padding: 8,
  },
  sellerName: {
    fontWeight: '600',
    fontSize: 12,
  },
  sellerAddress: {
    marginTop: 4,
    color: '#666',
  },
  typeChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    height: 24,
  },
  chipText: {
    fontSize: 12,
  },
  // Category card styles
  categoriesList: {
    paddingBottom: 8,
  },
  categoryCard: {
    marginBottom: 8,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    backgroundColor: '#4CAF50',
    marginRight: 16,
  },
  categoryTextContainer: {
    flex: 1,
  },


});