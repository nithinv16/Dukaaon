import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, FlatList, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { Text, Card, Searchbar, IconButton, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../services/supabase/supabase';
import { 
  getCategoryImage, 
  getCategoryImageDynamic, 
  getSubcategoryImage, 
  isDynamicCategory,
  getDynamicCategoryFallback 
} from '../../constants/categoryImages';
import { categoryImageService } from '../../services/categoryImageService';
import { useLocationStore } from '../../store/location';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslateDynamic } from '../../utils/translationUtils';
import { useCategoryTranslation } from '../../hooks/useCategoryTranslation';
import { translationService } from '../../services/translationService';

interface Category {
  id: string;
  name: string;
  image: any; // Changed to any to support both local and remote images
  image_url?: string; // Add image_url for dynamically loaded images
  isDynamic?: boolean; // Flag to indicate if this is a dynamically mapped category
  fallbackCategory?: string | null; // The fallback category for dynamic mapping
}

interface SubCategory {
  id: string;
  name: string;
  image_url?: any; // Changed to any to support both local and remote images
  isDynamic?: boolean; // Flag to indicate if this is a dynamically mapped subcategory
  fallbackCategory?: string | null; // The fallback category for dynamic mapping
}

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  brand?: string;
  image_url?: string;
}

interface Brand {
  id: string;
  name: string;
  category?: string;
}

export function CategoryGrid() {
  const router = useRouter();
  const { userLocation, distanceFilter, getCurrentLocation } = useLocationStore();
  const { currentLanguage } = useLanguage();
  const { translateArrayFields } = useTranslateDynamic();
  const { translateCategoryOrSubcategory } = useCategoryTranslation();
  
  // Define original texts for translation
  const originalTexts = {
    browseAllCategories: 'Browse All Categories',
    searchPlaceholder: 'Search categories, products, brands...',
    loadingCategories: 'Loading categories...',
    categories: 'Categories',
    allCategories: 'All Categories',
    products: 'Products',
    brands: 'Brands',
    noResults: 'No results for',
    tryDifferentSearch: 'Try a different search term',
    availableItems: 'Available Items'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);


  useEffect(() => {
    // Get location on component mount
    if (!userLocation) {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    fetchCategoriesFromDatabase();
    fetchSubCategories();
    fetchProducts();
    fetchBrands();
    
    // Language persistence is now handled by LanguageContext
    // No need for manual language resets
  }, [currentLanguage, userLocation, distanceFilter]);

  // Filter data based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      setFilteredSubCategories(subCategories);
      setFilteredProducts([]);
      setFilteredBrands([]);
    } else {
      const query = searchQuery.toLowerCase();
      
      // Filter categories
       const filteredCats = categories.filter(category =>
         category.name && category.name.toLowerCase().includes(query)
       );
       
       // Filter subcategories
      const filteredSubCats = subCategories.filter(subCategory =>
        subCategory.name && subCategory.name.toLowerCase().includes(query)
      );
      
      // Filter products - only show products that match the search AND belong to a matching category
      const filteredProds = products.filter(product => {
        const nameMatch = product.name && product.name.toLowerCase().includes(query);
        const categoryMatch = product.category && product.category.toLowerCase().includes(query);
        const subcategoryMatch = product.subcategory && product.subcategory.toLowerCase().includes(query);
        const brandMatch = product.brand && product.brand.toLowerCase().includes(query);
        // Also check if query matches the first word of product name (extracted brand)
        const extractedBrandMatch = product.name && 
          product.name.toLowerCase().startsWith(query.toLowerCase() + ' ');
        
        // Check if the product belongs to a category that matches the search
        const belongsToMatchingCategory = filteredCats.some(cat => 
          cat.id === product.category || cat.name.toLowerCase() === product.category?.toLowerCase()
        );
        
        // Check if the product belongs to a subcategory that matches the search
        const belongsToMatchingSubcategory = filteredSubCats.some(subcat => 
          subcat.id === product.subcategory || subcat.name.toLowerCase() === product.subcategory?.toLowerCase()
        );
        
        return nameMatch || categoryMatch || subcategoryMatch || brandMatch || extractedBrandMatch || 
               belongsToMatchingCategory || belongsToMatchingSubcategory;
      });
      
      // Filter brands
      const filteredBrandsList = brands.filter(brand =>
        brand.name && brand.name.toLowerCase().includes(query)
      );
      
      setFilteredCategories(filteredCats);
      setFilteredSubCategories(filteredSubCats);
      setFilteredProducts(filteredProds);
      setFilteredBrands(filteredBrandsList);
    }
  }, [searchQuery, categories, subCategories, products, brands]);

  // Enhanced image retrieval using database-backed system
  const getCategoryImageForDisplay = async (categoryId: string, categoryName: string, parentCategory?: string): Promise<any> => {
    try {
      // First try with categoryId using database service
      const dbImage = await categoryImageService.getCategoryImageWithDB(categoryId);
      if (dbImage && dbImage.uri) {
        return dbImage;
      }
      
      // If no database image, try with category name
      const nameBasedImage = await categoryImageService.getCategoryImageWithDB(categoryName.toLowerCase());
      if (nameBasedImage && nameBasedImage.uri) {
        return nameBasedImage;
      }
      
      // Fallback to static images if database doesn't have the image
      return getCategoryImageDynamic(categoryId, parentCategory);
    } catch (error) {
      console.warn('Error fetching category image from database:', error);
      // Fallback to static images on error
      return getCategoryImageDynamic(categoryId, parentCategory);
    }
  };

  // Updated to fetch categories from products table
  const fetchCategoriesFromDatabase = async () => {
    setLoading(true);
    try {
      // Fetch categories from products table
      const { data: productsData, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null);
      
      if (error) throw error;
      
      // If we have categories from products, use them
      if (productsData && productsData.length > 0) {
        // Get unique categories
        const uniqueCategories = Array.from(new Set(
          productsData
            .map(item => item.category)
            .filter(Boolean) // Remove null/undefined values
        ));
        
        const formattedCategories = await Promise.all(
          uniqueCategories.map(async (categoryName) => {
            const isDynamic = isDynamicCategory(categoryName);
            const image = await getCategoryImageForDisplay(categoryName, categoryName, null);
            
            return {
              id: categoryName, 
              name: categoryName,
              image: image,
              isDynamic: isDynamic,
              fallbackCategory: isDynamic ? getDynamicCategoryFallback(categoryName) : null
            };
          })
        );
        
        // Use optimized batch translation for better performance
        const translatedCategories = await translateArrayFields(
          formattedCategories,
          ['name'],
          currentLanguage
        );
        setCategories(translatedCategories);
      } else {
        // Fallback to default categories if database is empty
        const defaultCategoryData = [
          { id: 'groceries', name: 'Groceries' },
          { id: 'personal-care', name: 'Personal Care' },
          { id: 'household', name: 'Household' },
          { id: 'beverages', name: 'Beverages' },
          { id: 'snacks', name: 'Snacks' },
          { id: 'stationery', name: 'Stationery' },
          { id: 'more', name: 'More' }
        ];
        
        // Translate default category names
        const translatedDefaultCategories = await translateArrayFields(
          defaultCategoryData,
          ['name'],
          currentLanguage
        );
        
        const defaultCategories = await Promise.all(
          translatedDefaultCategories.map(async (cat) => {
            const isDynamic = isDynamicCategory(cat.id);
            const image = cat.id === 'more' 
              ? getCategoryImage('more')
              : await getCategoryImageForDisplay(cat.id, cat.name, null);
            
            return {
              id: cat.id,
              name: cat.name,
              image: image,
              isDynamic: isDynamic,
              fallbackCategory: isDynamic ? getDynamicCategoryFallback(cat.id) : null
            };
          })
        );
        setCategories(defaultCategories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fall back to defaults on error
      const defaultCategoryData: Category[] = [
        {
          id: 'groceries',
          name: 'Groceries',
          image: getCategoryImage('groceries'),
        },
        {
          id: 'personal-care',
          name: 'Personal Care',
          image: getCategoryImage('personal-care'),
        },
        {
          id: 'household',
          name: 'Household',
          image: getCategoryImage('household'),
        },
        {
          id: 'beverages',
          name: 'Beverages',
          image: getCategoryImage('beverages'),
        },
        {
          id: 'snacks',
          name: 'Snacks',
          image: getCategoryImage('snacks'),
        },
        {
          id: 'more',
          name: 'More',
          image: getCategoryImage('more'),
        }
      ];
      
      // Use optimized batch translation for error fallback categories
      const translatedErrorCategories = await translateArrayFields(
        defaultCategoryData,
        ['name'],
        currentLanguage
      );
      setCategories(translatedErrorCategories);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubCategories = async () => {
    try {
      let query = supabase
        .from('products')
        .select('subcategory, category, seller_id')
        .not('subcategory', 'is', null);

      // If user location is available, filter by distance
      if (userLocation) {
        // Get nearby wholesalers and manufacturers within distance range
        const [wholesalersResult, manufacturersResult] = await Promise.all([
          supabase.rpc('find_nearby_wholesalers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          }),
          supabase.rpc('find_nearby_manufacturers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          })
        ]);

        const nearbySellerIds: string[] = [];
        
        // Add wholesaler IDs
        if (!wholesalersResult.error && wholesalersResult.data) {
          nearbySellerIds.push(...wholesalersResult.data.map((seller: any) => seller.user_id));
        }
        
        // Add manufacturer IDs
        if (!manufacturersResult.error && manufacturersResult.data) {
          nearbySellerIds.push(...manufacturersResult.data.map((seller: any) => seller.user_id));
        }

        if (nearbySellerIds.length > 0) {
          query = query.in('seller_id', nearbySellerIds);
        } else {
          // If no nearby sellers found, return empty array
          setSubCategories([]);
          return;
        }
      }

      const { data: productsData, error: productsError } = await query;

      if (productsError) throw productsError;

      // Get unique subcategories using Set
      const uniqueSubCategories = await Promise.all(
        Array.from(new Set(
          productsData
            .map(item => item.subcategory)
            .filter(Boolean) // Remove null/undefined values
        )).map(async (subcategory) => {
          // Find a product with this subcategory to get its category
          const product = productsData.find(p => p.subcategory === subcategory);
          const category = product?.category || 'Unknown';
          
          // Try database subcategory image first, then local fallback
          let image_url;
          try {
            const dbImage = await categoryImageService.getSubcategoryImageWithDB(subcategory);
            if (dbImage) {
              image_url = dbImage;
            } else {
              // Fallback to local subcategory images
              image_url = getSubcategoryImage(subcategory);
              if (!image_url || image_url === getCategoryImage('default')) {
                image_url = getCategoryImage('default');
              }
            }
          } catch (error) {
            console.warn('Error fetching subcategory image from database:', error);
            image_url = getSubcategoryImage(subcategory) || getCategoryImage('default');
          }
          
          return {
            id: subcategory,
            name: subcategory,
            image_url: image_url
          };
        })
      );

      // Use optimized batch translation for subcategories
      const translatedSubCategories = await translateArrayFields(
        uniqueSubCategories,
        ['name'],
        currentLanguage
      );
      setSubCategories(translatedSubCategories);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('id, name, category, subcategory, brand, image_url, seller_id')
        .limit(100); // Limit to avoid too many results

      // If user location is available, filter by distance
      if (userLocation) {
        // Get nearby wholesalers and manufacturers within distance range
        const [wholesalersResult, manufacturersResult] = await Promise.all([
          supabase.rpc('find_nearby_wholesalers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          }),
          supabase.rpc('find_nearby_manufacturers', {
            user_lat: userLocation.latitude,
            user_lng: userLocation.longitude,
            radius_km: distanceFilter
          })
        ]);

        const nearbySellerIds: string[] = [];
        
        // Add wholesaler IDs
        if (!wholesalersResult.error && wholesalersResult.data) {
          nearbySellerIds.push(...wholesalersResult.data.map((seller: any) => seller.user_id));
        }
        
        // Add manufacturer IDs
        if (!manufacturersResult.error && manufacturersResult.data) {
          nearbySellerIds.push(...manufacturersResult.data.map((seller: any) => seller.user_id));
        }

        if (nearbySellerIds.length > 0) {
          query = query.in('seller_id', nearbySellerIds);
        } else {
          // If no nearby sellers found, return empty array
          setProducts([]);
          return;
        }
      }

      const { data: productsData, error } = await query;

      if (error) throw error;

      if (productsData) {
        // Use optimized batch translation for products
        const translatedProducts = await translateArrayFields(
          productsData,
          ['name', 'category', 'subcategory', 'brand'],
          currentLanguage
        );
        setProducts(translatedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('name, brand, category')
        .not('name', 'is', null);

      if (error) throw error;

      if (productsData) {
        const brandSet = new Set<string>();
        
        productsData.forEach(product => {
          // Add existing brand field if available
          if (product.brand && product.brand.trim()) {
            brandSet.add(product.brand.trim());
          }
          
          // Extract brand from product name (first word)
          if (product.name && product.name.trim()) {
            const words = product.name.trim().split(' ');
            if (words.length > 0) {
              const potentialBrand = words[0];
              // Only add if it looks like a brand (not too short, not a common word)
              if (potentialBrand.length > 2 && 
                  !['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By', 'New', 'Old', 'Big', 'Small'].includes(potentialBrand)) {
                brandSet.add(potentialBrand);
              }
            }
          }
        });
        
        // Convert to array and create brand objects
        const uniqueBrands = Array.from(brandSet).map(brandName => {
          // Find a product with this brand to get its category
          const product = productsData.find(p => 
            p.brand === brandName || 
            (p.name && p.name.startsWith(brandName + ' '))
          );
          return {
            id: brandName,
            name: brandName,
            category: product?.category
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        console.log('Extracted brands:', uniqueBrands.map(b => b.name));
        
        // Use optimized batch translation for brands
        const translatedBrands = await translateArrayFields(
          uniqueBrands,
          ['name'],
          currentLanguage
        );
        setBrands(translatedBrands);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push(`/(main)/screens/category/${categoryId}`);
  };

  const handleSubCategoryPress = (subCategoryId: string) => {
    const subCategoryParams = new URLSearchParams({
      id: subCategoryId,
      subcategory: subCategoryId
    });
    router.push(`/(main)/screens/category/${subCategoryId}?${subCategoryParams.toString()}`);
  };

  const handleProductPress = (productId: string) => {
    router.push(`/(main)/products/${productId}`);
  };

  const handleBrandPress = (brandName: string) => {
    const brandParams = new URLSearchParams({
      id: brandName,
      brand: brandName,
      type: 'brand' // Add type to distinguish brand filtering
    });
    router.push(`/screens/category/${brandName}?${brandParams.toString()}`);
  };

  const renderItem = ({ item }: { item: Category | SubCategory }) => {
    const isMainCategory = 'image' in item;
    let imageSource;
    
    if (isMainCategory) {
      const categoryImage = (item as Category).image;
      // Check if it's a local require() or a remote URI
      if (typeof categoryImage === 'object' && categoryImage.uri) {
        imageSource = categoryImage; // Remote image with URI
      } else if (typeof categoryImage === 'number' || (typeof categoryImage === 'object' && !categoryImage.uri)) {
        imageSource = categoryImage; // Local require() image
      } else {
        imageSource = getCategoryImage('default'); // Fallback
      }
    } else {
      const subCategoryImageUrl = (item as SubCategory).image_url;
      if (subCategoryImageUrl) {
        if (typeof subCategoryImageUrl === 'string') {
          imageSource = { uri: subCategoryImageUrl }; // Remote image URL
        } else if (typeof subCategoryImageUrl === 'object' && subCategoryImageUrl.uri) {
          imageSource = subCategoryImageUrl; // Database image object
        } else {
          imageSource = subCategoryImageUrl; // Local require() image
        }
      } else {
        // Fallback to local subcategory images
        imageSource = getSubcategoryImage(item.id) || getCategoryImage('default');
        // Note: Database images for subcategories are now fetched during data loading
      }
    }
    
    return (
      <Pressable
        style={styles.item}
        onPress={() => 
          isMainCategory 
            ? handleCategoryPress(item.id)
            : handleSubCategoryPress(item.id)
        }
      >
        <Card style={styles.card}>
          <Image 
            source={imageSource} 
            style={styles.image} 
            defaultSource={require('../../assets/images/products/dummy_product_image.jpg')}
          />
          <Text style={styles.name}>{translateCategoryOrSubcategory(item.name, 'category') || 'Category'}</Text>
        </Card>
      </Pressable>
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    return (
      <Pressable
        style={styles.item}
        onPress={() => handleProductPress(item.id)}
      >
        <Card style={styles.card}>
          <Image 
            source={item.image_url ? { uri: item.image_url } : require('../../assets/images/products/dummy_product_image.jpg')} 
            style={styles.image} 
            defaultSource={require('../../assets/images/products/dummy_product_image.jpg')}
          />
          <Text style={styles.name}>{item.name || 'Product'}</Text>
          <Text style={styles.categoryText}>{translateCategoryOrSubcategory(item.category, 'category') || 'Category'}</Text>
          {item.brand && <Text style={styles.brandText}>{item.brand}</Text>}
        </Card>
      </Pressable>
    );
  };

  const renderBrand = ({ item }: { item: Brand }) => {
    return (
      <Pressable
        style={styles.item}
        onPress={() => handleBrandPress(item.name)}
      >
        <Card style={styles.card}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandInitial}>{item.name ? item.name.charAt(0).toUpperCase() : 'B'}</Text>
          </View>
          <Text style={styles.name}>{item.name || 'Brand'}</Text>
          {item.category && <Text style={styles.categoryText}>{translateCategoryOrSubcategory(item.category, 'category')}</Text>}
        </Card>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>{translations.loadingCategories}</Text>
      </View>
    );
  }

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible && searchQuery) {
      setSearchQuery('');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Categories title and Search toggle */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{translations.categories}</Text>
        <FAB
          icon={isSearchVisible ? "close" : "magnify"}
          style={styles.headerFab}
          onPress={toggleSearch}
          size="small"
        />
      </View>

      {/* Conditional Search Bar */}
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder={translations.searchPlaceholder}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            autoFocus={true}
          />
        </View>
      )}

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {searchQuery.trim() ? (
          // Search Results
          <>
            {/* Categories Results */}
            {filteredCategories.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.categories}</Text>
                <FlatList
                  data={filteredCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Subcategories Results */}
            {filteredSubCategories.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.allCategories}</Text>
                <FlatList
                  data={filteredSubCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Products Results */}
            {filteredProducts.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.products}</Text>
                <FlatList
                  data={filteredProducts}
                  renderItem={renderProduct}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* Brands Results */}
            {filteredBrands.length > 0 && (
              <View style={styles.searchSection}>
                <Text style={styles.sectionTitle}>{translations.brands}</Text>
                <FlatList
                  data={filteredBrands}
                  renderItem={renderBrand}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.searchGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}

            {/* No Results */}
            {filteredCategories.length === 0 && 
             filteredSubCategories.length === 0 && 
             filteredProducts.length === 0 && 
             filteredBrands.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>{translations.noResults} "{searchQuery}"</Text>
              <Text style={styles.noResultsSubtext}>{translations.tryDifferentSearch}</Text>
              </View>
            )}
          </>
        ) : (
          // Default View
          <>
            {/* Categories Section */}
            <View style={styles.categoriesSection}>
              <FlatList
                data={categories}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={3}
                contentContainerStyle={styles.categoriesGrid}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                nestedScrollEnabled={true}
              />
            </View>
            
            {/* Available Items Section */}
            {subCategories.length > 0 && (
              <View style={styles.subCategoriesSection}>
                <Text style={styles.sectionTitle}>{translations.availableItems}</Text>
                <FlatList
                  data={subCategories}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.subCategoriesGrid}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={true}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 0,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerFab: {
    backgroundColor: '#FF7D00',
    margin: 0,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    height: 48,
  },
  searchInput: {
    fontSize: 14,
    textAlign: 'left',
    paddingHorizontal: 8,
    color: '#333',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingVertical: 0,
    lineHeight: 20,
    minHeight: 48,
  },
  voiceSearchButton: {
    flex: 1,
    marginRight: 5,
  },

  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Add bottom padding to account for FAB button
    flexGrow: 1,
  },
  categoriesSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  categoriesGrid: {
    paddingBottom: 16,
  },
  subCategoriesSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  subCategoriesGrid: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 8,
    color: '#333',
  },
  item: {
    flex: 1/3,
    padding: 8,
  },
  card: {
    padding: 8,
    alignItems: 'center',
  },
  image: {
    width: 80,
    height: 80,
    marginBottom: 2,
    borderRadius: 3,
  },
  subCategoryIcon: {
    width: 80,
    height: 80,
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    textAlign: 'center',
    fontSize: 12,
  },
  searchSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  searchGrid: {
    paddingBottom: 16,
  },
  categoryText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  brandText: {
    fontSize: 10,
    color: '#FF7D00',
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 2,
  },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF7D00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  searchGrid: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Add bottom padding for loading state too
  },
});