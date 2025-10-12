import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, IconButton, Badge, Text as PaperText, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../store/location';
import { supabase } from '../../services/supabase/supabase';
import { useAuthStore } from '../../store/auth';
import { useCartStore } from '../../store/cart';
import { useWholesalersStore } from '../../store/wholesalers';
import { useTranslation } from '../../contexts/LanguageContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
// Temporarily disabled to fix blank screen issue
import EnhancedVoiceSearch from '../common/EnhancedVoiceSearch';
import OCRScanner from '../common/OCRScanner';

interface HeaderProps {
  user: Profile;
  onVoiceSearchResult?: (query: string, detectedLanguage: string, intent?: string, entities?: any) => void;
  onVoiceOrderResult?: (productName: string, quantity?: number, detectedLanguage?: string) => void;
  onOCRSearchResult?: (query: string, language: string, translatedQuery?: string, originalText?: string) => void;
}

interface SearchResult {
  type: 'product' | 'seller' | 'manufacturer' | 'category';
  id: string;
  name: string;
  description?: string;
  path?: string;
}

interface CategoryMapping {
  [key: string]: string;
}

export function Header({ user, onVoiceSearchResult, onVoiceOrderResult, onOCRSearchResult }: HeaderProps) {
  const router = useRouter();
  
  // Use the centralized location store instead of local state
  const { userLocation, locationAddress, isLocationLoading, getCurrentLocation } = useLocationStore();
  const { currentLanguage } = useLanguage();
  
  // Get loading state from auth store
  const { loading: authLoading } = useAuthStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const cartItems = useCartStore(state => state.items);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const setNearbyWholesalers = useWholesalersStore(state => state.setNearbyWholesalers);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoadingBusinessDetails, setIsLoadingBusinessDetails] = useState(false);

  // Translation state
  const originalTexts = {
    searchPlaceholder: "Search products, brands, categories..."
  };
  
  const [translations, setTranslations] = useState(originalTexts);

  // Load business details if not available
  useEffect(() => {
    const loadBusinessDetails = async () => {
      if (user?.id && !user.business_details?.shopName && !isLoadingBusinessDetails) {
        setIsLoadingBusinessDetails(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('business_details, profile_image_url')
            .eq('id', user.id)
            .single();
          
          if (!error && data) {
            // Update the user in auth store with business details
            const updatedUser = { ...user, ...data };
            useAuthStore.getState().setUser(updatedUser);
          }
        } catch (error) {
          console.warn('Error loading business details in Header:', error);
        } finally {
          setIsLoadingBusinessDetails(false);
        }
      }
    };

    loadBusinessDetails();
  }, [user?.id, user?.business_details?.shopName]);

  // Category keyword mappings
  const categoryMappings: CategoryMapping = {
    // Snacks & Beverages
    'biscuit': 'categories/snacks/biscuits',
    'biscuits': 'categories/snacks/biscuits',
    'chips': 'categories/snacks/chips',
    'namkeen': 'categories/snacks/namkeen',
    'chocolate': 'categories/snacks/chocolates',
    'beverages': 'categories/beverages',
    'soft drink': 'categories/beverages/soft-drinks',
    'juice': 'categories/beverages/juices',

    // Grocery & Staples
    'rice': 'categories/grocery/rice',
    'dal': 'categories/grocery/pulses',
    'pulses': 'categories/grocery/pulses',
    'atta': 'categories/grocery/atta',
    'flour': 'categories/grocery/atta',
    'oil': 'categories/grocery/oils',
    'spices': 'categories/grocery/spices',
    'masala': 'categories/grocery/spices',

    // Personal Care
    'soap': 'categories/personal-care/soaps',
    'shampoo': 'categories/personal-care/hair-care',
    'toothpaste': 'categories/personal-care/oral-care',
    'cream': 'categories/personal-care/skin-care',
    'lotion': 'categories/personal-care/skin-care',

    // Household
    'detergent': 'categories/household/laundry',
    'cleaner': 'categories/household/cleaners',
    'freshener': 'categories/household/fresheners',
  };

  // Optimized location request - uses the centralized store
  const requestLocationPermission = async () => {
    try {
      // Use the optimized location store method
      await getCurrentLocation();
      
      // Fetch nearby wholesalers if location is available
      if (userLocation) {
        await fetchNearbyWholesalers(userLocation.latitude, userLocation.longitude);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Separate function to fetch nearby wholesalers
  const fetchNearbyWholesalers = async (latitude: number, longitude: number) => {
    try {
      const { data: wholesalers, error } = await supabase
        .rpc('find_nearby_wholesalers', {
          user_lat: latitude,
          user_lng: longitude,
          radius_km: 10
        });

      if (error) throw error;
      setNearbyWholesalers(wholesalers);
    } catch (error) {
      console.error('Error fetching nearby wholesalers:', error);
    }
  };

  // Initialize location on component mount
  useEffect(() => {
    if (!userLocation && !isLocationLoading) {
      requestLocationPermission();
    }
  }, []);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      try {
        const translatedTexts = await Promise.all([
          translationService.translateText(originalTexts.searchPlaceholder, currentLanguage)
        ]);

        setTranslations({
          searchPlaceholder: translatedTexts[0]?.translatedText || originalTexts.searchPlaceholder
        });
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const searchTerms = searchQuery.toLowerCase().split(' ');
      let results: SearchResult[] = [];
      
      // Check category mappings
      for (const term of searchTerms) {
        const categoryPath = categoryMappings[term];
        if (categoryPath) {
          results.push({
            type: 'category',
            id: categoryPath,
            name: term.charAt(0).toUpperCase() + term.slice(1),
            description: `Browse ${term} products`,
            path: categoryPath
          });
        }
      }

      // Search in profiles
      const { data: profileResults, error: profileError } = await supabase
        .from('profiles')
        .select('id, business_details, role')
        .or(searchTerms.map(term => `business_details->>shopName.ilike.%${term}%`).join(','))
        .in('role', ['seller', 'manufacturer']);

      if (profileError) throw profileError;

      // Search in products
      const { data: productResults, error: productError } = await supabase
        .from('products')
        .select('id, name, category, description')
        .or(searchTerms.map(term => 
          `name.ilike.%${term}%,category.ilike.%${term}%,description.ilike.%${term}%`
        ).join(','));

      if (productError) throw productError;

      // Add profile results
      results = [
        ...results,
        ...profileResults
          .filter(profile => profile.business_details && profile.business_details.shopName)
          .map(profile => ({
            type: profile.role as 'seller' | 'manufacturer',
            id: profile.id,
            name: profile.business_details.shopName,
            description: `${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}`
          }))
      ];

      // Add product results
      results = [
        ...results,
        ...productResults.map(product => ({
          type: 'product',
          id: product.id,
          name: product.name,
          description: product.description || product.category
        }))
      ];

      if (results.length > 0) {
        // Route to search results page with all matches
        const searchParams = new URLSearchParams({
          query: searchQuery,
          results: JSON.stringify(results)
        });
        router.push(`/(main)/screens/search?${searchParams.toString()}`);
      } else {
        const basicSearchParams = new URLSearchParams({ query: searchQuery });
        router.push(`/(main)/screens/search?${basicSearchParams.toString()}`);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorSearchParams = new URLSearchParams({ query: searchQuery });
      router.push(`/(main)/screens/search?${errorSearchParams.toString()}`);
    }
  };

  const handleCartPress = () => {
    router.push('/(main)/cart');
  };

  // Fetch user avatar from Supabase
  useEffect(() => {
    if (user?.id) {
      fetchUserAvatar();
    }
  }, [user?.id, user?.profile_image_url]);

  // Also refresh avatar when component mounts or user changes
  useEffect(() => {
    const refreshAvatar = () => {
      if (user?.id) {
        console.log('Refreshing avatar on component mount/user change');
        console.log('User object:', user);
        fetchUserAvatar();
      }
    };
    
    refreshAvatar();
  }, [user]);

  // Set up real-time subscription for profile updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile updated via real-time:', payload);
          if (payload.new?.profile_image_url) {
            setAvatarUrl(payload.new.profile_image_url);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);
  
  const fetchUserAvatar = async () => {
    try {
      console.log('Fetching avatar for user ID:', user?.id);
      
      // First check if user object already has profile_image_url
      if (user?.profile_image_url) {
        console.log('Found profile_image_url in user object:', user.profile_image_url);
        setAvatarUrl(user.profile_image_url);
        return;
      }
      
      // If not in user object, fetch from database
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('id', user?.id)
        .single();
        
      if (error) {
        console.error('Error fetching avatar from database:', error);
        setAvatarUrl(null);
        return;
      }
      
      console.log('Avatar data received from database:', data);
      
      if (data?.profile_image_url) {
        console.log('Setting avatar URL from database:', data.profile_image_url);
        setAvatarUrl(data.profile_image_url);
      } else {
        console.log('No profile_image_url found in database, using default avatar');
        setAvatarUrl(null);
      }
    } catch (error) {
      console.error('Error fetching avatar:', error);
      setAvatarUrl(null);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.profile}>
            <Avatar.Image 
              size={40} 
              source={avatarUrl ? { uri: avatarUrl } : require('../../assets/images/avatar.png')} 
              onPress={() => {
                console.log('Avatar pressed, current avatarUrl:', avatarUrl);
                fetchUserAvatar(); // Refresh avatar on press
                router.push('/(main)/profile');
              }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <PaperText 
                variant="titleMedium" 
                style={(!user || (!user.business_details?.shopName && (authLoading || isLoadingBusinessDetails))) ? [styles.name, styles.loadingText] : styles.name}
              >
                {!user 
                  ? 'Loading...'
                  : user.business_details?.shopName 
                    ? user.business_details.shopName
                    : (authLoading || isLoadingBusinessDetails)
                      ? 'Loading...'
                      : (user.displayName || 'Shop Name')
                }
              </PaperText>
              <View style={styles.locationContainer}>
                <IconButton 
                  icon="map-marker" 
                  size={16}
                  onPress={requestLocationPermission}
                  loading={isLocationLoading}
                  style={styles.locationIcon}
                />
                <PaperText variant="bodySmall" style={styles.address}>
                  {locationAddress || "Detecting location..."}
                </PaperText>
              </View>
            </View>
          </View>
          <View style={styles.cartContainer}>
            <IconButton 
              icon="cart" 
              size={24}
              onPress={handleCartPress}
            />
            {cartItems.length > 0 && (
              <Badge size={20} style={styles.badge}>
                {cartItems.length}
              </Badge>
            )}
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Searchbar
            placeholder={translations.searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            contentStyle={styles.searchContent}
            placeholderTextColor="#666"
            numberOfLines={1}
            ellipsizeMode="tail"
          />
          <View style={styles.searchButtonsContainer}>
            <View style={styles.voiceSearchButton}>
              <EnhancedVoiceSearch
                onSearchResult={onVoiceSearchResult || (() => {})}
                onOrderResult={onVoiceOrderResult}
                placeholder="Voice"
                compact={true}
              />
            </View>
            <View style={styles.ocrScanButton}>
              <OCRScanner
                onSearchResult={onOCRSearchResult || (() => {})}
                buttonText="Scan"
                showModal={true}
                compact={true}
                enableTranslation={true}
                autoTranslate={true}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 8,
  },
  name: {
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationIcon: {
    margin: 0,
    padding: 0,
    marginLeft: -8, // Adjust to align with name
  },
  address: {
    flex: 1,
    opacity: 0.7,
  },
  cartContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#2196F3',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 14,
    paddingHorizontal: 2,
    paddingVertical: 0,
    textAlign: 'left',
    textAlignVertical: 'center',
    lineHeight: 20,
    height: 40,
  },
  searchContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceSearchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  ocrScanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: '#e0e0e0',
  },
  loadingText: {
    opacity: 0.6,
    fontStyle: 'italic',
  },
});

