import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, BackHandler, Alert } from 'react-native';
import { Text, Card, Button, Chip, FAB } from 'react-native-paper';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { Header } from '../../../components/home/Header';
import { NearbyWholesalers } from '../../../components/home/NearbyWholesalers';
import { NearbyManufacturers } from '../../../components/home/NearbyManufacturers';
import EnhancedVoiceSearch from '../../../components/common/EnhancedVoiceSearch';
import OCRScanner from '../../../components/common/OCRScanner';
import { useAuthStore } from '../../../store/auth';
import { useLocationStore } from '../../../store/location';
import { supabase } from '../../../services/supabase/supabase';
import ProductSearchService from '../../../services/productSearchService';
import * as Location from 'expo-location';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface Seller {
  id: string;
  business_name: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  image_url: string;
  distance: number;
}

interface SellerResponse {
  user_id: string;
  business_name: string;
  address: string | any;
  image_url: string;
  distance: number;
  latitude: number;
  longitude: number;
}

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { userLocation, distanceFilter, getCurrentLocation } = useLocationStore();
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { currentLanguage } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [locationFetched, setLocationFetched] = useState(false);
  const [products, setProducts] = useState([]);

  // Original texts for translation
  const originalTexts = {
    loading: "Loading...",
    nearbyWholesalers: "Nearby Wholesalers",
    nearbyManufacturers: "Nearby Manufacturers",
    browseCategoriesProducts: "Browse Categories & Products"
  };

  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        console.log('[Home] Loading translations for language:', currentLanguage);
        
        if (currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method
        const translatedTexts: Record<string, string> = {};
        
        for (const [key, text] of Object.entries(originalTexts)) {
          const result = await translationService.translateText(text, currentLanguage);
          translatedTexts[key] = result.translatedText;
        }
        
        console.log('[Home] Translations loaded:', translatedTexts);
        setTranslations(translatedTexts);
      } catch (error) {
        console.error('[Home] Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Handle enhanced voice search results with automatic language detection
  const handleEnhancedVoiceSearchResult = async (query: string, detectedLanguage: string, intent?: string, entities?: any) => {
    console.log('Voice search result:', { query, detectedLanguage, intent, entities });
    
    // Handle different intents
    if (intent === 'navigate' && entities?.target) {
      // Handle navigation commands
      const target = entities.target.toLowerCase();
      if (target.includes('cart')) {
        router.push('/cart');
      } else if (target.includes('profile')) {
        router.push('/profile');
      } else if (target.includes('orders')) {
        router.push('/orders');
      } else if (target.includes('categories') || target.includes('category')) {
        router.push('/screens/categories');
      }
    } else {
      // Use ProductSearchService for better search results
      try {
        const searchResults = await ProductSearchService.searchProducts({
          query,
          language: detectedLanguage,
          intent: intent as 'search' | 'order' | 'navigate',
          limit: 20,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter
        });
        
        console.log('Product search results:', searchResults);
        
        // If we found products, navigate to search results
        if (searchResults.products.length > 0) {
          const searchParams = new URLSearchParams({
            query: query,
            language: detectedLanguage,
            intent: intent || 'search',
            resultsCount: searchResults.totalCount.toString()
          });
          router.push(`/screens/search?${searchParams.toString()}`);
        } else {
          // Fallback to categories page
          const categoryParams = new URLSearchParams({
            search: query,
            language: detectedLanguage,
            intent: intent || 'search'
          });
          router.push(`/screens/categories?${categoryParams.toString()}`);
        }
      } catch (error) {
        console.error('Error in voice search:', error);
        // Fallback to categories page
        const fallbackParams = new URLSearchParams({
          search: query,
          language: detectedLanguage,
          intent: intent || 'search'
        });
        router.push(`/screens/categories?${fallbackParams.toString()}`);
      }
    }
  };

  // Handle enhanced voice order results
  const handleEnhancedVoiceOrderResult = async (productName: string, quantity?: number, detectedLanguage?: string) => {
    console.log('Voice order result:', { productName, quantity, detectedLanguage });
    
    try {
      // First, try to find the exact product
      const product = await ProductSearchService.findProductForOrder(productName);
      
      if (product && user?.id) {
        // Product found, try to add to cart automatically
        const success = await ProductSearchService.addToCartViaVoice(
          user.id,
          product.id,
          quantity || 1
        );
        
        if (success) {
          // Show success message and navigate to cart
          Alert.alert(
            'Added to Cart',
            `${product?.name || 'Product'} (${quantity || 1} item${(quantity || 1) > 1 ? 's' : ''}) has been added to your cart.`,
            [
              { text: 'Continue Shopping', style: 'cancel' },
              { text: 'View Cart', onPress: () => router.push('/cart') }
            ]
          );
        } else {
          // Failed to add to cart, navigate to product page
          router.push(`/products/${product.id}`);
        }
      } else {
        // Product not found, search for similar products
        const searchResults = await ProductSearchService.searchProducts({
          query: productName,
          language: detectedLanguage || 'en-US',
          intent: 'order',
          limit: 10,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter
        });
        
        if (searchResults.products.length > 0) {
          // Navigate to search results with order intent
          const orderParams = new URLSearchParams({
            query: productName,
            autoOrder: 'true',
            quantity: quantity?.toString() || '1',
            language: detectedLanguage || 'en-US',
            intent: 'order'
          });
          router.push(`/screens/search?${orderParams.toString()}`);
        } else {
          // No products found, show message and navigate to categories
          Alert.alert(
            'Product Not Found',
            `Sorry, we couldn't find "${productName}". Please browse our categories or try a different search.`,
            [{ text: 'OK', onPress: () => router.push('/screens/categories') }]
          );
        }
      }
    } catch (error) {
      console.error('Error in voice order:', error);
      // Fallback to categories search
      const fallbackOrderParams = new URLSearchParams({
        search: productName,
        autoOrder: 'true',
        quantity: quantity?.toString() || '1',
        language: detectedLanguage || 'en-US'
      });
      router.push(`/screens/categories?${fallbackOrderParams.toString()}`);
    }
  };

  const handleOCRSearchResult = (query: string, language: string, translatedQuery?: string, originalText?: string) => {
    console.log('OCR search result:', { query, language, translatedQuery, originalText });
    
    // Use ProductSearchService for enhanced multilingual OCR search
    const performOCRSearch = async () => {
      try {
        // Determine the best search query to use
        const searchQuery = translatedQuery && language !== 'en' ? translatedQuery : query;
        
        const searchResults = await ProductSearchService.searchProducts({
          query: searchQuery,
          language: language,
          intent: 'search',
          limit: 20,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter,
          userLanguage: language,
          translatedQuery: translatedQuery
        });
        
        console.log('OCR search results:', searchResults);
        
        // Navigate to search screen with enhanced parameters
        const ocrParams = new URLSearchParams({
          query: searchQuery,
          originalQuery: originalText || query,
          translatedQuery: translatedQuery || '',
          language: language,
          source: 'ocr',
          resultsCount: searchResults.totalCount.toString()
        });
        router.push(`/screens/search?${ocrParams.toString()}`);
      } catch (error) {
        console.error('Error in OCR search:', error);
        // Fallback to simple search navigation
        const fallbackOcrParams = new URLSearchParams({
          query: query,
          originalQuery: originalText || query,
          translatedQuery: translatedQuery || '',
          language: language,
          source: 'ocr'
        });
        router.push(`/screens/search?${fallbackOcrParams.toString()}`);
      }
    };
    
    performOCRSearch();
  };



  // Optimize: Combine user loading and location fetching into a single useEffect
  useEffect(() => {
    let isMounted = true;
    
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Ensure user is loaded first, then fetch and persist location
        if (!user) {
          await loadUserIfNeeded();
        }
        
        // Fetch location and update profiles table (lat, long, address)
        await getUserLocation();
        
        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    initializeApp();
    
    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  // Handle back button navigation on home screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Only show exit dialog if this is the root screen
      // Check if we can go back in the navigation stack
      if (router.canGoBack && router.canGoBack()) {
        // If we can go back, let the default navigation handle it
        return false;
      } else {
        // If we can't go back (this is the root), show exit confirmation
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {} },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: true }
        );
        return true;
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const loadUserIfNeeded = async () => {
    if (!user) {
      console.log('No user found in store, attempting to load from session');
      
      try {
        // Check if we have a session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          console.log('Found session, loading user data');
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            console.log('Found user profile, setting in store');
            useAuthStore.getState().setUser(profile);
          }
        } else {
          console.log('No session found, redirecting to auth');
          router.replace('/(auth)/language');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
  };

  // Function to get user location and update it in the database
  const getUserLocation = async () => {
    try {
      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
      
      console.log('Getting current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      console.log('Location obtained:', location.coords);
      
      // Perform reverse geocoding to get human-readable address
      let formattedAddress = 'Location detected';
      try {
        const addressResults = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        const addr = addressResults && addressResults.length > 0 ? addressResults[0] : null;
        formattedAddress = [
          addr?.name,
          addr?.street,
          addr?.city,
          addr?.region,
          addr?.country
        ].filter(Boolean).join(', ') || 'Location detected';
        console.log('Reverse geocoded address:', formattedAddress);
      } catch (geocodeError) {
        console.error('Error reverse geocoding in Home:', geocodeError);
      }
      
      // Update the location store immediately with the new coordinates and address
      const { setUserLocation, setLocationAddress } = useLocationStore.getState();
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setLocationAddress(formattedAddress);
      
      if (user?.id) {
        // First try to create or update the update_user_location function
        try {
          const sqlFunction = `
          CREATE OR REPLACE FUNCTION public.update_user_location(
            p_user_id UUID,
            p_latitude FLOAT,
            p_longitude FLOAT,
            p_location_address TEXT
          ) RETURNS JSONB AS $$
          DECLARE
            result JSONB;
          BEGIN
            -- Update the user profile with location coordinates
            UPDATE profiles
            SET 
              latitude = p_latitude,
              longitude = p_longitude,
              location_address = p_location_address,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = p_user_id
            RETURNING jsonb_build_object('latitude', latitude, 'longitude', longitude, 'location_address', location_address) INTO result;
            
            -- Return success result
            RETURN jsonb_build_object(
              'success', TRUE,
              'location', result
            );
          EXCEPTION
            WHEN OTHERS THEN
              RETURN jsonb_build_object(
                'success', FALSE,
                'error', SQLERRM,
                'details', 'SQL error occurred while updating location'
              );
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          `;
          
          // Try to create the function
          const { error: createError } = await supabase.rpc(
            'execute_sql_admin',
            { sql: sqlFunction }
          );
          
          if (createError) {
            console.log('Error creating SQL function (might already exist):', createError);
          }
        } catch (sqlError) {
          console.error('Error setting up location update function:', sqlError);
        }
        
        // Now try to update the location using our function
        console.log('Updating user location in database via RPC...');
        const { data: locationResult, error: locationError } = await supabase.rpc(
          'update_user_location',
          {
            p_user_id: user.id,
            p_latitude: location.coords.latitude,
            p_longitude: location.coords.longitude
          }
        );
        
        if (locationError) {
          console.error('Error updating location with RPC:', locationError);
          
          // Fallback to direct update
          console.log('Trying direct location update...');
          const { data: directResult, error: directError } = await supabase
            .from('profiles')
            .update({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              location_address: formattedAddress
            })
            .eq('id', user.id)
            .select();
            
          if (directError) {
            console.error('Error updating location directly:', directError);
          } else {
            console.log('Location updated successfully with direct update');
            setLocationFetched(true);
            
            // Update the user in the store with the new location
            const { data: updatedUser } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
              
            if (updatedUser) {
              useAuthStore.getState().setUser(updatedUser);
            }
          }
        } else {
          console.log('Location updated successfully with RPC:', locationResult);
          setLocationFetched(true);
          
          // Update the user in the store with the new location
          const { data: updatedUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (updatedUser) {
            useAuthStore.getState().setUser(updatedUser);
          }
        }
      }
    } catch (error) {
      console.error('Error getting or updating location:', error);
    }
  };

  // If loading or no user, show loading state
  if (isLoading || !user) {
    return (
      <View style={[styles.safeAreaContainer, getSafeAreaStyles(insets)]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF7D00" />
          <Text>{translations.loading}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeAreaContainer, getSafeAreaStyles(insets)]}>
      <SystemStatusBar style="dark" />
      <Header 
        user={user} 
        onVoiceSearchResult={handleEnhancedVoiceSearchResult}
        onVoiceOrderResult={handleEnhancedVoiceOrderResult}
        onOCRSearchResult={handleOCRSearchResult}
      />
      

      
      <ScrollView 
        style={styles.scrollSection}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {user?.role === 'retailer' && (
          <>
            <View style={styles.section}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {translations.nearbyWholesalers}
              </Text>
              <NearbyWholesalers showTitle={false} />
            </View>
            
            <View style={styles.section}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {translations.nearbyManufacturers}
              </Text>
              <NearbyManufacturers showTitle={false} />
            </View>
          </>
        )}

        {/* Add padding at bottom for the fixed button */}
        <View style={styles.bottomPadding} />
      </ScrollView>


      {/* Fixed button container */}
      <View style={styles.fixedButtonContainer}>
        <Button 
          mode="contained"
          onPress={() => router.push('/(main)/screens/categories')}
          style={styles.browseButton}
          contentStyle={styles.buttonContent}
        >
          {translations.browseCategoriesProducts}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 60,
  },
  scrollSection: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  bottomPadding: {
    height: 160,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    right: 16,
    elevation: 4,
    zIndex: 999,
  },
  browseButton: {
    borderRadius: 25,
    backgroundColor: '#FF7D00',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 200,
    marginRight: 12,
    marginVertical: 8,
  },
  cardImage: {
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },


  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    marginRight: 8,
  },
  distance: {
    marginTop: 4,
    color: '#666',
  },
});