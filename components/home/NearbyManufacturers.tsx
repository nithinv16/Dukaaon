import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, FlatList, Image, Pressable, Animated } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../store/location';
import { useAuthStore } from '../../store/auth';
import { SellersDataService } from '../../services/data/SellersDataService';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';

// Utility function to ensure image URLs are properly formatted
const formatImageUrl = (url: string | null | undefined): string => {
  if (!url) return 'https://via.placeholder.com/200x120?text=No+Image';

  // If it's already a full URL, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a storage path, prepend the Supabase storage URL
  if (url.startsWith('seller-images/') || url.startsWith('profile-images/') || url.startsWith('product-images/')) {
    // Access the URL from the environment or use a hardcoded one from your config
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-supabase-project.supabase.co';
    return `${supabaseUrl} /storage/v1 / object / public / ${url} `;
  }

  // Otherwise, just return the URL as is
  return url;
};

// Define a type for seller address
interface SellerAddress {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

// Define a type for manufacturer data
interface Manufacturer {
  id: string;
  user_id: string;
  business_name: string;
  address: SellerAddress | string;
  image_url: string;
  distance: number;
  latitude?: number;
  longitude?: number;
  categories?: string[];
  description?: string;
}

// Add optional title prop and userId for defensive checks
interface NearbyManufacturersProps {
  showTitle?: boolean;
  userId?: string;
}

// Original texts for translation - defined outside component for stability
const ORIGINAL_TEXTS = {
  nearbyText: "Nearby Manufacturers",
  loadingText: "Loading...",
  kmAwayText: "km away",
  noneFoundText: "No manufacturers found nearby",
  kmLabel: "km",
  gettingLocation: "Getting your location...",
  viewAll: "View All Manufacturers"
};

export const NearbyManufacturers = React.memo(function NearbyManufacturers({ showTitle = false, userId: propUserId }: NearbyManufacturersProps) {
  const router = useRouter();
  // Use stable selector to prevent re-renders when user object reference changes
  // but the ID stays the same
  const storeUserId = useAuthStore((state) => state.user?.id);
  const userId = propUserId || storeUserId;

  const { userLocation, distanceFilter, setDistanceFilter, getCurrentLocation } = useLocationStore();
  const { currentLanguage, isLanguageReady } = useLanguage();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);

  // Use ref to access latest language in callbacks without adding to dependencies
  const currentLanguageRef = useRef(currentLanguage);
  useEffect(() => {
    currentLanguageRef.current = currentLanguage;
  }, [currentLanguage]);

  // Use instant translation hook - provides cached translations immediately
  const { t } = useInstantTranslation(ORIGINAL_TEXTS);

  // Use local state to ensure we always have a valid distance filter value
  // Initialize from store's distanceFilter
  const initialDistance = typeof distanceFilter === 'number' && distanceFilter > 0 ? distanceFilter : 50;
  const [localDistanceFilter, setLocalDistanceFilter] = useState<number>(initialDistance);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [thumbPosition, setThumbPosition] = useState<number>(((initialDistance - 1) / (100 - 1)) * 100);
  const [sliderWidth, setSliderWidth] = useState<number>(0);

  // Sync with store when distanceFilter changes, with better safeguards
  useEffect(() => {
    // Ensure we always have a valid number
    const safeDistance = typeof distanceFilter === 'number' && distanceFilter > 0 ? distanceFilter : 50;
    setLocalDistanceFilter(safeDistance);
    // Update thumb position when distance changes
    const percentage = ((safeDistance - 1) / (100 - 1)) * 100;
    setThumbPosition(percentage);
  }, [distanceFilter]);

  // Use the local distance filter as the safe value with additional safeguard
  const safeDistanceFilter = typeof localDistanceFilter === 'number' && localDistanceFilter > 0 ? localDistanceFilter : 50;

  // Create dynamic text with distance value
  const noneFoundText = `${t.noneFoundText} (${safeDistanceFilter} ${t.kmLabel})`;

  // Track last fetch parameters to prevent duplicate fetches
  const lastFetchParamsRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // Force fetch trigger - increment to force a refetch
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Simple data fetching - triggered when location changes
  useEffect(() => {
    if (!userLocation) {
      console.log('[NearbyManufacturers] Waiting for location...');
      return;
    }

    // Create a key from fetch parameters to detect duplicates
    const fetchKey = `${userLocation.latitude.toFixed(3)}_${userLocation.longitude.toFixed(3)}_${safeDistanceFilter} `;

    // Skip if we're already fetching or if parameters haven't changed
    if (isFetchingRef.current || lastFetchParamsRef.current === fetchKey) {
      console.log('[NearbyManufacturers] Skipping duplicate fetch');
      return;
    }

    let isMounted = true;
    isFetchingRef.current = true;
    lastFetchParamsRef.current = fetchKey;
    setIsLoading(true);

    const loadData = async () => {
      try {
        await fetchNearbyManufacturers();
      } catch (error) {
        console.error('[NearbyManufacturers] Fetch error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          isFetchingRef.current = false;
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [userLocation?.latitude, userLocation?.longitude, safeDistanceFilter, fetchTrigger]);

  // Store original (English) manufacturers for re-translation when language changes
  const [originalManufacturers, setOriginalManufacturers] = useState<Manufacturer[]>([]);

  // Track the language for which data was last translated
  const lastTranslatedLangRef = useRef<string>('en');

  // Background translation function - updates state when translation is complete
  const translateManufacturersBackground = async (manufacturersToTranslate: Manufacturer[], lang: string) => {
    try {
      console.log(`[NearbyManufacturers] Background translation to ${lang}`);
      const textsToTranslate: string[] = [];
      const indexMap: { nameIdx: number; addressIdx: number | null }[] = [];

      for (const manufacturer of manufacturersToTranslate) {
        const nameIdx = textsToTranslate.length;
        textsToTranslate.push(manufacturer.business_name);

        let addressIdx: number | null = null;
        if (manufacturer.address && typeof manufacturer.address === 'string') {
          addressIdx = textsToTranslate.length;
          textsToTranslate.push(manufacturer.address);
        }
        indexMap.push({ nameIdx, addressIdx });
      }

      const results = await translationService.translateBatch(textsToTranslate, lang as any);

      const translatedManufacturers = manufacturersToTranslate.map((manufacturer, i: number) => {
        const { nameIdx, addressIdx } = indexMap[i];
        return {
          ...manufacturer,
          business_name: results[nameIdx]?.translatedText || manufacturer.business_name,
          address: addressIdx !== null
            ? (results[addressIdx]?.translatedText || manufacturer.address)
            : manufacturer.address,
        };
      });

      console.log(`[NearbyManufacturers] Background translation complete for ${translatedManufacturers.length} manufacturers`);
      setManufacturers(translatedManufacturers);
      lastTranslatedLangRef.current = lang; // Track that we translated to this language
    } catch (error) {
      console.error('[NearbyManufacturers] Background translation failed:', error);
      // Keep showing English content on error
    }
  };

  // Fetch manufacturers within the specified radius using SellersDataService
  // Do NOT depend on currentLanguage - translation handled separately
  // Accepts optional distance parameter to override safeDistanceFilter (for direct calls from slider)
  const fetchNearbyManufacturers = useCallback(async (overrideDistance?: number) => {
    if (!userLocation) {
      return;
    }

    const distanceToUse = overrideDistance ?? safeDistanceFilter;

    try {
      console.log(`[NearbyManufacturers] Fetching manufacturers within ${distanceToUse} km`);

      // Use SellersDataService with cache-first strategy
      const result = await SellersDataService.fetchNearbySellers({
        userId: userId || 'anonymous',
        userLocation,
        radiusKm: distanceToUse,
        sellerType: 'manufacturer',
        useCache: false, // Disable cache when explicitly fetching
      });

      if (result.error) {
        console.error('[NearbyManufacturers] Error fetching manufacturers:', result.error);
      }

      // Format sellers for display
      const formattedManufacturers: Manufacturer[] = result.sellers.map((seller: any) => ({
        id: seller.user_id,
        user_id: seller.user_id,
        business_name: seller.business_name,
        address: seller.address,
        image_url: formatImageUrl(seller.image_url),
        distance: seller.distance,
        latitude: seller.latitude,
        longitude: seller.longitude,
        categories: seller.categories || [],
        description: seller.description,
      }));

      console.log(`[NearbyManufacturers] Found ${formattedManufacturers.length} manufacturers(fromCache: ${result.fromCache}), currentLanguage=${currentLanguageRef.current}`);

      // Store original data for re-translation
      setOriginalManufacturers(formattedManufacturers);

      // Show manufacturers immediately (in English first) - NON-BLOCKING
      setManufacturers(formattedManufacturers);
      setIsLoading(false); // Loading done - content is visible

      // Reset lastTranslatedLangRef to 'en' - this tells the translation effect
      // that the current data is in English and needs translation
      lastTranslatedLangRef.current = 'en';

      // Translation will be handled by the translation effect when it runs
      // (triggered by originalManufacturers.length change)
    } catch (error) {
      console.error('[NearbyManufacturers] Error fetching nearby manufacturers:', error);
      // Try to get cached data as fallback
      try {
        const cachedResult = await SellersDataService.getCachedSellers(userId || '', 'manufacturer');
        if (cachedResult) {
          console.log('[NearbyManufacturers] Using cached data as fallback');
          const formattedManufacturers = cachedResult.sellers.map((seller: any) => ({
            id: seller.user_id,
            user_id: seller.user_id,
            business_name: seller.business_name,
            address: seller.address,
            image_url: formatImageUrl(seller.image_url),
            distance: seller.distance,
            latitude: seller.latitude,
            longitude: seller.longitude,
            categories: seller.categories || [],
            description: seller.description,
          }));
          setOriginalManufacturers(formattedManufacturers);
          setManufacturers(formattedManufacturers);
        } else {
          setManufacturers([]);
          setOriginalManufacturers([]);
        }
      } catch {
        setManufacturers([]);
        setOriginalManufacturers([]);
      }
    }
  }, [userLocation, safeDistanceFilter, userId]); // Removed currentLanguage

  // Translate manufacturers when language changes (uses already-fetched data)
  // IMPORTANT: This effect should ONLY run when language changes, not when data changes
  // Data changes are handled by translateManufacturersBackground in the fetch function
  useEffect(() => {
    // Wait for language to be loaded from storage
    if (!isLanguageReady) {
      return;
    }

    // Skip if no data
    if (originalManufacturers.length === 0) {
      return;
    }

    // Skip if already translated to this language
    if (lastTranslatedLangRef.current === currentLanguage) {
      console.log(`[NearbyManufacturers] Already translated to ${currentLanguage}, skipping`);
      return;
    }

    // If language is English, just update the ref (original data is already shown from fetch)
    // DON'T reset to originalManufacturers - this causes the "flash back to English" issue
    if (currentLanguage === 'en') {
      console.log('[NearbyManufacturers] Language is English, no translation needed');
      lastTranslatedLangRef.current = 'en';
      return;
    }

    console.log(`[NearbyManufacturers] Language changed from ${lastTranslatedLangRef.current} to ${currentLanguage}`);

    let isMounted = true;
    console.log(`[NearbyManufacturers] Starting translation for ${originalManufacturers.length} manufacturers to ${currentLanguage}`);

    const translateManufacturers = async () => {
      try {
        // Collect all texts to translate in a single batch
        const textsToTranslate: string[] = [];
        const indexMap: { nameIdx: number; addressIdx: number | null }[] = [];

        for (const manufacturer of originalManufacturers) {
          const nameIdx = textsToTranslate.length;
          textsToTranslate.push(manufacturer.business_name);

          let addressIdx: number | null = null;
          if (manufacturer.address && typeof manufacturer.address === 'string') {
            addressIdx = textsToTranslate.length;
            textsToTranslate.push(manufacturer.address);
          }
          indexMap.push({ nameIdx, addressIdx });
        }

        const results = await translationService.translateBatch(textsToTranslate, currentLanguage);

        if (!isMounted) return;

        // Apply translations
        const translatedManufacturers = originalManufacturers.map((manufacturer, i: number) => {
          const { nameIdx, addressIdx } = indexMap[i];
          return {
            ...manufacturer,
            business_name: results[nameIdx]?.translatedText || manufacturer.business_name,
            address: addressIdx !== null
              ? (results[addressIdx]?.translatedText || manufacturer.address)
              : manufacturer.address,
          };
        });

        console.log(`[NearbyManufacturers] Applied translations for ${translatedManufacturers.length} manufacturers`);
        setManufacturers(translatedManufacturers);
        lastTranslatedLangRef.current = currentLanguage;
      } catch (error) {
        console.error('[NearbyManufacturers] Error translating:', error);
      }
    };

    translateManufacturers();

    return () => {
      isMounted = false;
    };
  }, [currentLanguage, isLanguageReady, originalManufacturers.length]); // Re-run when data arrives

  // Manufacturer Card Component with Animation
  const ManufacturerCard = React.memo(({ manufacturer }: { manufacturer: any }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Format distance
    const distanceValue = typeof manufacturer.distance === 'number'
      ? manufacturer.distance.toFixed(1)
      : '0.0';

    const onPressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 5,
        tension: 40
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 40
      }).start();
    };

    return (
      <Pressable
        onPress={() => router.push(`/(main)/screens/manufacturer/${manufacturer.user_id}`)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ marginRight: 16 }}
      >
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.imageContainer}>
            <Image
              source={manufacturer.image_url
                ? { uri: manufacturer.image_url }
                : require('../../assets/icons/seller_shop.jpg')}
              style={styles.cardImage}
              resizeMode="cover"
              defaultSource={require('../../assets/icons/seller_shop.jpg')}
            />
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>
                {distanceValue} {t.kmLabel}
              </Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.businessName} numberOfLines={1}>
              {manufacturer.business_name}
            </Text>
            {manufacturer.description && (
              <Text variant="bodySmall" style={styles.description} numberOfLines={1}>
                {manufacturer.description}
              </Text>
            )}
            <Text variant="bodySmall" style={styles.categories} numberOfLines={1}>
              {manufacturer.categories?.join(' • ') || 'General'}
            </Text>
            {manufacturer.address && (
              <Text variant="bodySmall" numberOfLines={1} style={styles.address}>
                {typeof manufacturer.address === 'string'
                  ? manufacturer.address
                  : manufacturer.address?.street || 'Address not available'}
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    );
  });

  // Render manufacturer card - memoized for performance
  const renderManufacturerCard = useCallback(({ item }: { item: any }) => (
    <ManufacturerCard manufacturer={item} />
  ), []);

  // Defensive data check: Show location loading if no location yet
  // Removed userId check - we can show sellers even for non-logged-in users

  // Defensive data check: Show loading state if location is not available yet
  if (!userLocation) {
    return (
      <View style={styles.container}>
        {showTitle && (
          <View style={styles.headerContainer}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t.nearbyText}
            </Text>
          </View>
        )}
        <View style={styles.locationLoadingContainer}>
          <ActivityIndicator size="small" color="#FF7D00" />
          <Text style={styles.locationLoadingText}>{t.gettingLocation}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <View style={styles.headerContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t.nearbyText}
          </Text>
        </View>
      )}

      <View style={styles.sliderContainer}>
        <View
          style={styles.sliderWrapper}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setSliderWidth(width);
          }}
        >
          <Slider
            value={localDistanceFilter}
            onValueChange={(value: number) => {
              setLocalDistanceFilter(value);
              setDistanceFilter(value);
              // Calculate thumb position for popup
              if (sliderWidth > 0) {
                const percentage = ((value - 1) / (100 - 1)) * 100;
                setThumbPosition(percentage);
              }
            }}
            onSlidingStart={() => {
              setIsSliding(true);
              // Calculate initial position
              if (sliderWidth > 0) {
                const percentage = ((localDistanceFilter - 1) / (100 - 1)) * 100;
                setThumbPosition(percentage);
              }
            }}
            onSlidingComplete={(value: number) => {
              setIsSliding(false);
              // Clear the last fetch params to allow a fresh fetch with the new distance
              lastFetchParamsRef.current = null;
              // Invalidate the cache to ensure fresh data
              SellersDataService.invalidateCache();
              // Show loading state and directly fetch with the new distance
              setIsLoading(true);
              console.log(`[NearbyManufacturers] Slider complete - distance set to ${value}km, fetching directly`);
              fetchNearbyManufacturers(value).finally(() => setIsLoading(false));
            }}
            minimumValue={1}
            maximumValue={100}
            step={1}
            style={styles.slider}
            minimumTrackTintColor="#FF7D00"
            maximumTrackTintColor="#EAEAEA"
            thumbTintColor="transparent"
          />
          {/* Custom thumb overlay */}
          <View
            style={[
              styles.customThumbOverlay,
              { left: `${thumbPosition}%`, marginLeft: -20 }
            ]}
          >
            <View style={styles.customThumb}>
              <Text style={styles.thumbText}>
                {localDistanceFilter.toFixed(0)}
              </Text>
            </View>
          </View>
          {/* Popup while sliding */}
          {isSliding && (
            <View
              style={[
                styles.popupContainer,
                { left: `${thumbPosition}%`, marginLeft: -30 }
              ]}
            >
              <View style={styles.popup}>
                <Text style={styles.popupText}>
                  {localDistanceFilter.toFixed(0)} {t.kmLabel}
                </Text>
              </View>
              <View style={styles.popupArrow} />
            </View>
          )}
        </View>
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderScaleLabel}>5</Text>
          <Text style={styles.sliderScaleLabel}>10</Text>
          <Text style={styles.sliderScaleLabel}>20</Text>
          <Text style={styles.sliderScaleLabel}>30</Text>
          <Text style={styles.sliderScaleLabel}>40</Text>
          <Text style={styles.sliderScaleLabel}>50</Text>
          <Text style={styles.sliderScaleLabel}>60</Text>
          <Text style={styles.sliderScaleLabel}>70</Text>
          <Text style={styles.sliderScaleLabel}>80</Text>
          <Text style={styles.sliderScaleLabel}>90</Text>
          <Text style={styles.sliderMaxLabel}>100 {t.kmLabel}</Text>
        </View>
        <View style={styles.quickAccessButtons}>
          <Button
            compact
            mode="outlined"
            onPress={() => {
              setLocalDistanceFilter(10);
              setDistanceFilter(10);
              lastFetchParamsRef.current = null;
              SellersDataService.invalidateCache();
              setIsLoading(true);
              fetchNearbyManufacturers(10).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 10 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            10
          </Button>
          <Button
            compact
            mode="outlined"
            onPress={() => {
              setLocalDistanceFilter(25);
              setDistanceFilter(25);
              lastFetchParamsRef.current = null;
              SellersDataService.invalidateCache();
              setIsLoading(true);
              fetchNearbyManufacturers(25).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 25 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            25
          </Button>
          <Button
            compact
            mode="outlined"
            onPress={() => {
              setLocalDistanceFilter(50);
              setDistanceFilter(50);
              lastFetchParamsRef.current = null;
              SellersDataService.invalidateCache();
              setIsLoading(true);
              fetchNearbyManufacturers(50).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 50 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            50
          </Button>
          <Button
            compact
            mode="outlined"
            onPress={() => {
              setLocalDistanceFilter(75);
              setDistanceFilter(75);
              lastFetchParamsRef.current = null;
              SellersDataService.invalidateCache();
              setIsLoading(true);
              fetchNearbyManufacturers(75).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 75 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            75
          </Button>
          <Button
            compact
            mode="outlined"
            onPress={() => {
              setLocalDistanceFilter(100);
              setDistanceFilter(100);
              lastFetchParamsRef.current = null;
              SellersDataService.invalidateCache();
              setIsLoading(true);
              fetchNearbyManufacturers(100).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 100 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            100
          </Button>
        </View>
      </View>

      {isLoading && manufacturers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FF7D00" />
          <Text style={styles.loadingText}>{t.loadingText}</Text>
        </View>
      ) : manufacturers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyMessage}>{noneFoundText}</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={manufacturers}
          keyExtractor={(item) => item.id || item.user_id}
          renderItem={renderManufacturerCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          getItemLayout={(data, index) => ({
            length: 212, // card width (200) + margin (12)
            offset: 212 * index,
            index,
          })}
        />
      )}

      {!isLoading && manufacturers.length > 0 && (
        <View style={styles.viewAllContainer}>
          <Button
            mode="outlined"
            onPress={() => router.push('/(main)/screens/sellers?type=manufacturer')}
            style={styles.viewAllButton}
            textColor="#FF7D00"
            icon="chevron-right"
          >
            {t.viewAll}
          </Button>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sliderContainer: {
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 8,
  },
  sliderWrapper: {
    position: 'relative',
    height: 50,
    justifyContent: 'center',
  },
  slider: {
    height: 40,
  },
  customThumbOverlay: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  customThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7D00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  thumbText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  popupContainer: {
    position: 'absolute',
    top: -50,
    zIndex: 1000,
    alignItems: 'center',
  },
  popup: {
    backgroundColor: '#FF7D00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  popupText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  popupArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF7D00',
    marginTop: -1,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
    paddingHorizontal: 2,
  },
  sliderScaleLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  sliderMaxLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    paddingRight: 4,
  },
  quickAccessButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  quickButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: '#FF7D00',
    borderWidth: 1,
    padding: 0,
    minWidth: 36,
  },
  quickButtonContent: {
    width: 36,
    height: 36,
    padding: 0,
    margin: 0,
  },
  quickButtonLabel: {
    fontSize: 11,
    color: '#FF7D00',
    fontWeight: '600',
    marginVertical: 0,
    marginHorizontal: 0,
    lineHeight: 11,
  },
  activeQuickButton: {
    backgroundColor: '#FF7D00',
  },
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 250,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    height: 140,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
  },
  distanceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContent: {
    padding: 14,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  categories: {
    fontSize: 12,
    color: '#FF7D00',
    marginBottom: 2,
    fontWeight: '600',
  },
  address: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyMessage: {
    padding: 12,
    textAlign: 'center',
    color: '#666',
    width: 280,
  },
  viewAllContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllButton: {
    borderColor: '#FF7D00',
    width: '100%',
  },
  // Defensive check styles
  loginPromptContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 12,
  },
  loginPromptText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  locationLoadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  locationLoadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});