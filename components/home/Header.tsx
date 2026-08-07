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
    searchPlaceholder: "Search products, brands, categories...",
    detectingLocation: "Detecting location...",
    locationDetected: "Location detected",
    loading: "Loading...",
    shopName: "Shop Name",
  };

  const [translations, setTranslations] = useState(originalTexts);
  const [translatedLocationAddress, setTranslatedLocationAddress] = useState<string | null>(null);
  const [translatedShopName, setTranslatedShopName] = useState<string | null>(null);

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

  // Load translations when language changes (non-blocking, cache-first)
  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslations(originalTexts);
      return;
    }

    // Translate all UI texts
    const translateAllTexts = async () => {
      const translatedTexts: typeof originalTexts = { ...originalTexts };

      for (const [key, value] of Object.entries(originalTexts)) {
        // Check cache first
        const cached = translationService.getCachedTranslationSync(value, currentLanguage);
        if (cached) {
          translatedTexts[key as keyof typeof originalTexts] = cached;
        } else {
          // Translate in background
          try {
            const result = await translationService.translateText(value, currentLanguage);
            if (result?.translatedText) {
              translatedTexts[key as keyof typeof originalTexts] = result.translatedText;
            }
          } catch (e) {
            // Keep original on error
          }
        }
      }

      setTranslations(translatedTexts);
    };

    translateAllTexts();
  }, [currentLanguage]);

  // Translate location address when it changes or language changes
  useEffect(() => {
    if (!locationAddress) {
      setTranslatedLocationAddress(null);
      return;
    }

    if (currentLanguage === 'en') {
      setTranslatedLocationAddress(locationAddress);
      return;
    }

    // Check cache first for instant display
    const cached = translationService.getCachedTranslationSync(locationAddress, currentLanguage);
    if (cached) {
      setTranslatedLocationAddress(cached);
    } else {
      setTranslatedLocationAddress(locationAddress); // Show original while translating
    }

    // Translate in background
    translationService.translateText(locationAddress, currentLanguage)
      .then(result => {
        if (result?.translatedText) {
          setTranslatedLocationAddress(result.translatedText);
        }
      })
      .catch(() => {
        // Keep original on error
      });
  }, [locationAddress, currentLanguage]);

  // Translate shop/business name when language changes or user data changes
  useEffect(() => {
    const shopName = user?.business_details?.shopName || user?.displayName;

    if (!shopName) {
      setTranslatedShopName(null);
      return;
    }

    if (currentLanguage === 'en') {
      setTranslatedShopName(shopName);
      return;
    }

    // Check cache first for instant display
    const cached = translationService.getCachedTranslationSync(shopName, currentLanguage);
    if (cached) {
      setTranslatedShopName(cached);
    } else {
      setTranslatedShopName(shopName); // Show original while translating
    }

    // Translate in background
    translationService.translateText(shopName, currentLanguage)
      .then(result => {
        if (result?.translatedText) {
          setTranslatedShopName(result.translatedText);
        }
      })
      .catch(() => {
        // Keep original on error
      });
  }, [user?.business_details?.shopName, user?.displayName, currentLanguage]);

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
  // OPTIMIZED: Skip fetch if avatar already set and user hasn't changed
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const refreshAvatar = () => {
      if (!user?.id) return;

      // Skip if same user and avatar already set
      if (lastUserIdRef.current === user.id && avatarUrl) {
        return;
      }

      lastUserIdRef.current = user.id;

      // Check user object first - no need to fetch if already available
      if (user?.profile_image_url) {
        setAvatarUrl(user.profile_image_url);
        return;
      }

      // Only fetch if avatar not in user object
      fetchUserAvatar();
    };

    refreshAvatar();
  }, [user?.id]); // Only depend on user ID, not entire user object

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
      if (!user?.id) return;

      // First check if user object already has profile_image_url
      if (user?.profile_image_url) {
        setAvatarUrl(user.profile_image_url);
        return;
      }

      // If not in user object, fetch from database (only log in dev mode)
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('id', user.id)
        .single();

      if (error) {
        if (__DEV__) {
          console.error('Error fetching avatar from database:', error);
        }
        setAvatarUrl(null);
        return;
      }

      if (data?.profile_image_url) {
        setAvatarUrl(data.profile_image_url);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error fetching avatar:', error);
      }
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
                  ? translations.loading
                  : (authLoading || isLoadingBusinessDetails)
                    ? translations.loading
                    : translatedShopName || translations.shopName
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
                  {translatedLocationAddress || translations.detectingLocation}
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
                onSearchResult={onVoiceSearchResult || (() => { })}
                onOrderResult={onVoiceOrderResult}
                placeholder="Voice"
                compact={true}
              />
            </View>
            <View style={styles.ocrScanButton}>
              <OCRScanner
                onSearchResult={onOCRSearchResult || (() => { })}
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
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  locationIcon: {
    margin: 0,
    padding: 0,
    width: 16,
    height: 16,
  },
  address: {
    flex: 1,
    fontSize: 12,
    opacity: 0.8,
    color: '#333',
    marginLeft: 4,
  },
  cartContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF7D00',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    elevation: 4, // Soft shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  searchInput: {
    fontSize: 15,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'left',
    textAlignVertical: 'center',
    lineHeight: 20,
    height: 50,
    minHeight: 50, // Fix for some android versions
    color: '#333',
  },
  searchContent: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  searchButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ocrScanButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#fff',
    elevation: 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  loadingText: {
    opacity: 0.6,
    fontStyle: 'italic',
  },
});

