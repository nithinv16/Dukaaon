import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, ViewToken, Image, Animated } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useLocationStore } from '../../store/location';
import { useAuthStore } from '../../store/auth';
import { SellersDataService } from '../../services/data/SellersDataService';
import Slider from '@react-native-community/slider';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';
import { translationService } from '../../services/translationService';
import { useSellerPrefetch } from '../../hooks/useSellerPrefetch';
import { useLanguage } from '../../contexts/LanguageContext';

// Add optional title prop and userId for defensive checks
interface NearbyWholesalersProps {
  showTitle?: boolean;
  userId?: string;
}

// Original texts for translation - defined outside component for stability
const ORIGINAL_TEXTS = {
  nearbyText: "Nearby Wholesalers",
  loadingText: "Loading wholesalers...",
  kmAwayText: "km away",
  noneFoundText: "No wholesalers found nearby",
  kmLabel: "km",
  gettingLocation: "Getting your location...",
  pleaseLogin: "Please log in to see nearby wholesalers",
  viewAll: "View All Wholesalers",
  addressNotAvailable: "Address not available"
};

export function NearbyWholesalers({ showTitle = false, userId: propUserId }: NearbyWholesalersProps) {
  // Use stable selector to prevent re-renders when user object reference changes
  // but the ID stays the same
  const storeUserId = useAuthStore((state) => state.user?.id);
  const userId = propUserId || storeUserId;
  const router = useRouter();
  const { userLocation, distanceFilter, setDistanceFilter } = useLocationStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [wholesalers, setWholesalers] = useState<any[]>([]);

  // Use instant translation hook - provides cached translations immediately
  const { t } = useInstantTranslation(ORIGINAL_TEXTS);

  // Also get currentLanguage and isLanguageReady for translating dynamic seller data
  const { currentLanguage, isLanguageReady } = useLanguage();

  // Use ref to access latest language in callbacks without adding to dependencies
  const currentLanguageRef = useRef(currentLanguage);
  useEffect(() => {
    currentLanguageRef.current = currentLanguage;
  }, [currentLanguage]);

  // Prefetch hook for visible wholesalers - Requirements 3.1, 3.2
  const { prefetchVisible, onLongPress } = useSellerPrefetch({ enabled: true });

  // Track visible items for prefetching
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300, // Wait 300ms before triggering prefetch
  }).current;

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
      console.log('[NearbyWholesalers] Waiting for location...');
      return;
    }

    // Create a key from fetch parameters to detect duplicates
    const fetchKey = `${userLocation.latitude.toFixed(3)}_${userLocation.longitude.toFixed(3)}_${safeDistanceFilter}`;

    // Skip if we're already fetching or if parameters haven't changed
    if (isFetchingRef.current || lastFetchParamsRef.current === fetchKey) {
      console.log('[NearbyWholesalers] Skipping duplicate fetch');
      return;
    }

    let isMounted = true;
    isFetchingRef.current = true;
    lastFetchParamsRef.current = fetchKey;
    setIsLoading(true);

    const loadData = async () => {
      try {
        await fetchNearbyWholesalers();
      } catch (error) {
        console.error('[NearbyWholesalers] Fetch error:', error);
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

  // Remove the debug useEffect - only log when needed for debugging
  // useEffect(() => {
  //   if (wholesalers.length > 0) {
  //     console.log('Wholesaler data structure:');
  //     const sampleWholesaler = wholesalers[0];
  //     console.log('Sample wholesaler:', JSON.stringify(sampleWholesaler, null, 2));
  //     console.log('seller_details:', sampleWholesaler.seller_details);
  //     
  //     // Log detailed information about seller_details
  //     if (sampleWholesaler.seller_details) {
  //       console.log('seller_details properties:', Object.keys(sampleWholesaler.seller_details));
  //       console.log('business_name:', sampleWholesaler.seller_details.business_name);
  //       console.log('latitude:', sampleWholesaler.seller_details.latitude);
  //       console.log('longitude:', sampleWholesaler.seller_details.longitude);
  //     }
  //     
  //     if (sampleWholesaler.seller_details && sampleWholesaler.seller_details.address) {
  //       console.log('address type:', typeof sampleWholesaler.seller_details.address);
  //       console.log('address value:', sampleWholesaler.seller_details.address);
  //     }
  //   }
  // }, [wholesalers]);

  // Store original (English) wholesalers for re-translation when language changes
  const [originalWholesalers, setOriginalWholesalers] = useState<any[]>([]);

  // Track the language for which data was last translated
  const lastTranslatedLangRef = useRef<string>('en');

  // Helper function to extract address string from any address format
  const extractAddressString = (address: any): string | null => {
    if (!address) return null;
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      // Try common address properties
      if (address.street) return address.street;
      if (address.line1) return address.line1;
      // Build from parts
      const parts = [];
      if (address.street) parts.push(address.street);
      if (address.city) parts.push(address.city);
      if (address.state) parts.push(address.state);
      if (parts.length > 0) return parts.join(', ');
    }
    return null;
  };

  // Background translation function - updates state when translation is complete
  const translateWholesalersBackground = async (wholesalersToTranslate: any[], lang: string) => {
    try {
      console.log(`[NearbyWholesalers] Background translation to ${lang}`);
      const textsToTranslate: string[] = [];
      const indexMap: {
        shopNameIdx: number;
        sellerBusinessNameIdx: number | null;
        businessAddressIdx: number | null;
        sellerAddressIdx: number | null;
        descriptionIdx: number | null;
      }[] = [];

      for (const wholesaler of wholesalersToTranslate) {
        const shopNameIdx = textsToTranslate.length;
        textsToTranslate.push(wholesaler.business_details.shopName);

        // Also translate seller_details.business_name if different from shopName
        let sellerBusinessNameIdx: number | null = null;
        if (wholesaler.seller_details?.business_name &&
          wholesaler.seller_details.business_name !== wholesaler.business_details.shopName) {
          sellerBusinessNameIdx = textsToTranslate.length;
          textsToTranslate.push(wholesaler.seller_details.business_name);
        }

        // Translate business_details.address (extract string from any format)
        let businessAddressIdx: number | null = null;
        const businessAddressStr = extractAddressString(wholesaler.business_details?.address);
        if (businessAddressStr) {
          businessAddressIdx = textsToTranslate.length;
          textsToTranslate.push(businessAddressStr);
        }

        // Translate seller_details.address (extract string from any format)
        let sellerAddressIdx: number | null = null;
        const sellerAddressStr = extractAddressString(wholesaler.seller_details?.address);
        if (sellerAddressStr) {
          sellerAddressIdx = textsToTranslate.length;
          textsToTranslate.push(sellerAddressStr);
        }

        // Translate seller_details.description
        let descriptionIdx: number | null = null;
        const description = wholesaler.seller_details?.description || wholesaler.description;
        if (description && typeof description === 'string' && description.trim()) {
          descriptionIdx = textsToTranslate.length;
          textsToTranslate.push(description.trim());
        }

        indexMap.push({ shopNameIdx, sellerBusinessNameIdx, businessAddressIdx, sellerAddressIdx, descriptionIdx });
      }

      const results = await translationService.translateBatch(textsToTranslate, lang as any);

      const translatedWholesalers = wholesalersToTranslate.map((wholesaler: any, i: number) => {
        const { shopNameIdx, sellerBusinessNameIdx, businessAddressIdx, sellerAddressIdx, descriptionIdx } = indexMap[i];
        const translatedShopName = results[shopNameIdx]?.translatedText || wholesaler.business_details.shopName;

        // Get original address strings for fallback
        const originalBusinessAddress = extractAddressString(wholesaler.business_details?.address);
        const originalSellerAddress = extractAddressString(wholesaler.seller_details?.address);
        const originalDescription = wholesaler.seller_details?.description || wholesaler.description;

        const translatedBusinessAddress = businessAddressIdx !== null
          ? (results[businessAddressIdx]?.translatedText || originalBusinessAddress)
          : originalBusinessAddress;
        const translatedSellerAddress = sellerAddressIdx !== null
          ? (results[sellerAddressIdx]?.translatedText || originalSellerAddress)
          : originalSellerAddress;
        const translatedDescription = descriptionIdx !== null
          ? (results[descriptionIdx]?.translatedText || originalDescription)
          : originalDescription;

        return {
          ...wholesaler,
          business_details: {
            ...wholesaler.business_details,
            shopName: translatedShopName,
            // Store translated address as string (overrides original object/string)
            address: translatedBusinessAddress || wholesaler.business_details?.address,
          },
          seller_details: {
            ...wholesaler.seller_details,
            // Use translated seller business name if we translated it, otherwise use the same as shopName
            business_name: sellerBusinessNameIdx !== null
              ? (results[sellerBusinessNameIdx]?.translatedText || wholesaler.seller_details.business_name)
              : translatedShopName,
            // Store translated address as string (overrides original object/string)
            address: translatedSellerAddress || wholesaler.seller_details?.address,
            // Store translated description
            description: translatedDescription || wholesaler.seller_details?.description,
          },
        };
      });

      console.log(`[NearbyWholesalers] Background translation complete for ${translatedWholesalers.length} wholesalers`);
      setWholesalers(translatedWholesalers);
      lastTranslatedLangRef.current = lang; // Track that we translated to this language
    } catch (error) {
      console.error('[NearbyWholesalers] Background translation failed:', error);
      // Keep showing English content on error
    }
  };


  // Fetch wholesalers within the specified radius using SellersDataService
  // Do NOT depend on currentLanguage - translation handled separately
  // Accepts optional distance parameter to override safeDistanceFilter (for direct calls from slider)
  const fetchNearbyWholesalers = useCallback(async (overrideDistance?: number) => {
    if (!userLocation) {
      return;
    }

    const distanceToUse = overrideDistance ?? safeDistanceFilter;

    try {
      console.log(`[NearbyWholesalers] Fetching wholesalers within ${distanceToUse} km`);

      // Use SellersDataService with cache-first strategy
      const result = await SellersDataService.fetchNearbySellers({
        userId: userId || 'anonymous',
        userLocation,
        radiusKm: distanceToUse,
        sellerType: 'wholesaler',
        useCache: false, // Disable cache when explicitly fetching
      });

      if (result.error) {
        console.error('[NearbyWholesalers] Error fetching wholesalers:', result.error);
      }

      // Format sellers for display
      const formattedWholesalers = result.sellers.map((seller: any) => ({
        id: seller.user_id,
        business_details: {
          shopName: seller.business_name || 'Shop',
          ownerName: 'Owner',
          image_url: seller.image_url || null,
          address: typeof seller.address === 'string'
            ? seller.address
            : (seller.address ? JSON.stringify(seller.address) : '')
        },
        seller_details: {
          business_name: seller.business_name,
          address: seller.address,
          description: seller.description,
          latitude: seller.latitude,
          longitude: seller.longitude,
        },
        image_url: seller.image_url || null,
        distance: seller.distance,
        latitude: seller.latitude,
        longitude: seller.longitude,
      }));

      console.log(`[NearbyWholesalers] Found ${formattedWholesalers.length} wholesalers (fromCache: ${result.fromCache}), currentLanguage=${currentLanguageRef.current}`);

      // Store original data for re-translation
      setOriginalWholesalers(formattedWholesalers);

      // Show wholesalers immediately (in English first) - NON-BLOCKING
      setWholesalers(formattedWholesalers);
      setIsLoading(false); // Loading done - content is visible

      // Reset lastTranslatedLangRef to 'en' - this tells the translation effect
      // that the current data is in English and needs translation
      lastTranslatedLangRef.current = 'en';

      // Translation will be handled by the translation effect when it runs
      // (triggered by originalWholesalers.length change)
    } catch (error) {
      console.error('[NearbyWholesalers] Error fetching nearby wholesalers:', error);
      // Try to get cached data as fallback
      try {
        const cachedResult = await SellersDataService.getCachedSellers(userId || '', 'wholesaler');
        if (cachedResult) {
          console.log('[NearbyWholesalers] Using cached data as fallback');
          const formattedWholesalers = cachedResult.sellers.map((seller: any) => ({
            id: seller.user_id,
            business_details: {
              shopName: seller.business_name || 'Shop',
              ownerName: 'Owner',
              image_url: seller.image_url || null,
              address: typeof seller.address === 'string'
                ? seller.address
                : (seller.address ? JSON.stringify(seller.address) : '')
            },
            seller_details: {
              business_name: seller.business_name,
              address: seller.address,
              description: seller.description,
              latitude: seller.latitude,
              longitude: seller.longitude,
            },
            image_url: seller.image_url || null,
            distance: seller.distance,
            latitude: seller.latitude,
            longitude: seller.longitude,
          }));
          setOriginalWholesalers(formattedWholesalers);
          setWholesalers(formattedWholesalers);
        } else {
          setWholesalers([]);
          setOriginalWholesalers([]);
        }
      } catch {
        setWholesalers([]);
        setOriginalWholesalers([]);
      }
    }
  }, [userLocation, safeDistanceFilter, userId]); // Removed currentLanguage

  // Translate wholesalers when language changes (uses already-fetched data)
  // IMPORTANT: This effect should ONLY run when language changes, not when data changes
  // Data changes are handled by translateWholesalersBackground in the fetch function
  useEffect(() => {
    // Wait for language to be loaded from storage
    if (!isLanguageReady) {
      return;
    }

    // Skip if no data
    if (originalWholesalers.length === 0) {
      return;
    }

    // Skip if already translated to this language
    if (lastTranslatedLangRef.current === currentLanguage) {
      console.log(`[NearbyWholesalers] Already translated to ${currentLanguage}, skipping`);
      return;
    }

    // If language is English, just update the ref (original data is already shown from fetch)
    // DON'T reset to originalWholesalers - this causes the "flash back to English" issue
    if (currentLanguage === 'en') {
      console.log('[NearbyWholesalers] Language is English, no translation needed');
      lastTranslatedLangRef.current = 'en';
      return;
    }

    console.log(`[NearbyWholesalers] Language changed from ${lastTranslatedLangRef.current} to ${currentLanguage}`);

    let isMounted = true;
    console.log(`[NearbyWholesalers] Starting translation for ${originalWholesalers.length} wholesalers to ${currentLanguage}`);

    const translateWholesalers = async () => {
      try {
        // Collect all texts to translate in a single batch
        const textsToTranslate: string[] = [];
        const indexMap: {
          shopNameIdx: number;
          sellerBusinessNameIdx: number | null;
          businessAddressIdx: number | null;
          sellerAddressIdx: number | null;
          descriptionIdx: number | null;
        }[] = [];

        for (const wholesaler of originalWholesalers) {
          const shopNameIdx = textsToTranslate.length;
          textsToTranslate.push(wholesaler.business_details.shopName);

          // Also translate seller_details.business_name if different from shopName
          let sellerBusinessNameIdx: number | null = null;
          if (wholesaler.seller_details?.business_name &&
            wholesaler.seller_details.business_name !== wholesaler.business_details.shopName) {
            sellerBusinessNameIdx = textsToTranslate.length;
            textsToTranslate.push(wholesaler.seller_details.business_name);
          }

          // Translate business_details.address (extract string from any format)
          let businessAddressIdx: number | null = null;
          const businessAddressStr = extractAddressString(wholesaler.business_details?.address);
          if (businessAddressStr) {
            businessAddressIdx = textsToTranslate.length;
            textsToTranslate.push(businessAddressStr);
          }

          // Translate seller_details.address (extract string from any format)
          let sellerAddressIdx: number | null = null;
          const sellerAddressStr = extractAddressString(wholesaler.seller_details?.address);
          if (sellerAddressStr) {
            sellerAddressIdx = textsToTranslate.length;
            textsToTranslate.push(sellerAddressStr);
          }

          // Translate seller_details.description
          let descriptionIdx: number | null = null;
          const description = wholesaler.seller_details?.description || wholesaler.description;
          if (description && typeof description === 'string' && description.trim()) {
            descriptionIdx = textsToTranslate.length;
            textsToTranslate.push(description.trim());
          }

          indexMap.push({ shopNameIdx, sellerBusinessNameIdx, businessAddressIdx, sellerAddressIdx, descriptionIdx });
        }

        // Single batch API call for all translations
        const results = await translationService.translateBatch(textsToTranslate, currentLanguage);

        if (!isMounted) return;

        // Apply translations
        const translatedWholesalers = originalWholesalers.map((wholesaler: any, i: number) => {
          const { shopNameIdx, sellerBusinessNameIdx, businessAddressIdx, sellerAddressIdx, descriptionIdx } = indexMap[i];
          const translatedShopName = results[shopNameIdx]?.translatedText || wholesaler.business_details.shopName;

          // Get original address strings for fallback
          const originalBusinessAddress = extractAddressString(wholesaler.business_details?.address);
          const originalSellerAddress = extractAddressString(wholesaler.seller_details?.address);
          const originalDescription = wholesaler.seller_details?.description || wholesaler.description;

          const translatedBusinessAddress = businessAddressIdx !== null
            ? (results[businessAddressIdx]?.translatedText || originalBusinessAddress)
            : originalBusinessAddress;
          const translatedSellerAddress = sellerAddressIdx !== null
            ? (results[sellerAddressIdx]?.translatedText || originalSellerAddress)
            : originalSellerAddress;
          const translatedDescription = descriptionIdx !== null
            ? (results[descriptionIdx]?.translatedText || originalDescription)
            : originalDescription;

          return {
            ...wholesaler,
            business_details: {
              ...wholesaler.business_details,
              shopName: translatedShopName,
              // Store translated address as string (overrides original object/string)
              address: translatedBusinessAddress || wholesaler.business_details?.address,
            },
            seller_details: {
              ...wholesaler.seller_details,
              // Use translated seller business name if we translated it, otherwise use the same as shopName
              business_name: sellerBusinessNameIdx !== null
                ? (results[sellerBusinessNameIdx]?.translatedText || wholesaler.seller_details.business_name)
                : translatedShopName,
              // Store translated address as string (overrides original object/string)
              address: translatedSellerAddress || wholesaler.seller_details?.address,
              // Store translated description
              description: translatedDescription || wholesaler.seller_details?.description,
            },
          };
        });

        console.log(`[NearbyWholesalers] Applied translations for ${translatedWholesalers.length} wholesalers`);
        setWholesalers(translatedWholesalers);
        lastTranslatedLangRef.current = currentLanguage;
      } catch (error) {
        console.error('[NearbyWholesalers] Error translating:', error);
      }
    };

    translateWholesalers();

    return () => {
      isMounted = false;
    };
  }, [currentLanguage, isLanguageReady, originalWholesalers.length]); // Re-run when data arrives

  // Helper function to extract address from seller_details
  const getFormattedAddress = useCallback((wholesaler: any): string => {
    // Check if seller_details exists and has address
    if (wholesaler.seller_details && wholesaler.seller_details.address) {
      const { address } = wholesaler.seller_details;

      // Check if address is a string
      if (typeof address === 'string') return address;

      // Check if address is an object
      if (typeof address === 'object') {
        // Try to handle different address formats
        if (address.street) return address.street;
        if (address.line1) return address.line1;

        // If address is a JSONB object with various properties
        const parts = [];
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);

        if (parts.length > 0) return parts.join(', ');
      }
    }

    // Fallback to business_details address if available
    if (wholesaler.business_details && wholesaler.business_details.address) {
      return wholesaler.business_details.address;
    }

    // Use coordinates as fallback if available
    if (wholesaler.seller_details) {
      if (wholesaler.seller_details.latitude && wholesaler.seller_details.longitude) {
        return `Lat: ${wholesaler.seller_details.latitude.toFixed(4)}, Lng: ${wholesaler.seller_details.longitude.toFixed(4)}`;
      }
    }

    // Final fallback - use translated text
    return t.addressNotAvailable;
  }, [t.addressNotAvailable]);

  /**
   * Handle viewable items change - Requirements 3.1
   * Triggers prefetch for visible wholesaler cards
   */
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const visibleSellerIds = viewableItems
        .filter(item => item.isViewable && item.item?.id)
        .map(item => item.item.id);

      if (visibleSellerIds.length > 0) {
        prefetchVisible(visibleSellerIds);
      }
    }
  }, [prefetchVisible]);

  /**
   * Handle long press on wholesaler card - Requirements 3.2
   * Triggers high-priority prefetch
   */
  const handleLongPress = useCallback((sellerId: string) => {
    onLongPress(sellerId);
  }, [onLongPress]);

  // Wholesaler Card Component with Animation
  const WholesalerCard = React.memo(({ wholesaler }: { wholesaler: any }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

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
        onPress={() => router.push(`/(main)/screens/category/${wholesaler.id}`)}
        onLongPress={() => handleLongPress(wholesaler.id)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        delayLongPress={300}
        style={{ marginRight: 16 }}
      >
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: wholesaler.image_url ||
                  wholesaler.business_details?.image_url ||
                  'https://via.placeholder.com/240x140?text=No+Image'
              }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>
                {(() => {
                  let distanceValue = wholesaler.distance;
                  if (typeof distanceValue === 'number') return distanceValue.toFixed(1);
                  if (typeof distanceValue === 'string') {
                    const parsed = parseFloat(distanceValue);
                    return isNaN(parsed) ? '0.0' : parsed.toFixed(1);
                  }
                  return '0.0';
                })()} {t.kmLabel}
              </Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text numberOfLines={1} style={styles.shopName}>
              {wholesaler.seller_details?.business_name || wholesaler.business_details?.shopName || 'Shop'}
            </Text>
            {(wholesaler.seller_details?.description || wholesaler.description) && (
              <Text style={styles.description} numberOfLines={1}>
                {wholesaler.seller_details?.description || wholesaler.description}
              </Text>
            )}
            <Text style={styles.address} numberOfLines={1}>
              {getFormattedAddress(wholesaler)}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    );
  });

  // Render individual wholesaler card
  const renderWholesalerCard = useCallback(({ item }: { item: any }) => (
    <WholesalerCard wholesaler={item} />
  ), []);

  // Defensive data check: Don't render if user is not logged in
  if (!userId) {
    return (
      <View style={styles.section}>
        <View style={styles.loginPromptContainer}>
          <Text style={styles.loginPromptText}>{t.pleaseLogin}</Text>
        </View>
      </View>
    );
  }

  // Defensive data check: Show loading state if location is not available yet
  if (!userLocation) {
    return (
      <View style={styles.section}>
        {showTitle && (
          <View style={styles.headerContainer}>
            <Text style={styles.sectionTitle}>
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
    <View style={styles.section}>
      {showTitle && (
        <View style={styles.headerContainer}>
          <Text style={styles.sectionTitle}>
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
              console.log(`[NearbyWholesalers] Slider complete - distance set to ${value}km, fetching directly`);
              fetchNearbyWholesalers(value).finally(() => setIsLoading(false));
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
              fetchNearbyWholesalers(10).finally(() => setIsLoading(false));
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
              fetchNearbyWholesalers(25).finally(() => setIsLoading(false));
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
              fetchNearbyWholesalers(50).finally(() => setIsLoading(false));
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
              fetchNearbyWholesalers(75).finally(() => setIsLoading(false));
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
              fetchNearbyWholesalers(100).finally(() => setIsLoading(false));
            }}
            style={[styles.quickButton, localDistanceFilter === 100 && styles.activeQuickButton]}
            labelStyle={styles.quickButtonLabel}
            contentStyle={styles.quickButtonContent}
          >
            100
          </Button>
        </View>
      </View>

      {isLoading && wholesalers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FF7D00" />
          <Text style={styles.loadingText}>{t.loadingText}</Text>
        </View>
      ) : wholesalers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyMessage}>{noneFoundText}</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={wholesalers}
          keyExtractor={(item) => item.id}
          renderItem={renderWholesalerCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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

      {!isLoading && wholesalers.length > 0 && (
        <View style={styles.viewAllContainer}>
          <Button
            mode="outlined"
            onPress={() => router.push('/(main)/screens/sellers?type=wholesaler')}
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
}

const styles = StyleSheet.create({
  section: {
    marginVertical: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: 18,
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
    paddingBottom: 4,
  },
  card: {
    width: 240,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  cardContent: {
    padding: 14,
  },
  shopName: {
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
    lineHeight: 18,
  },
  address: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  emptyMessage: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
    width: 200,
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