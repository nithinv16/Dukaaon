import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useWholesalersStore } from '../../store/wholesalers';
import { useLocationStore } from '../../store/location';
import { supabase } from '../../services/supabase/supabase';
import { Slider } from '@miblanchard/react-native-slider';
import * as Location from 'expo-location';
import { useTranslateDynamic } from '../../utils/translationUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

// Add optional title prop
interface NearbyWholesalersProps {
  showTitle?: boolean;
}

export function NearbyWholesalers({ showTitle = false }: NearbyWholesalersProps) {
  const router = useRouter();
  const { userLocation, distanceFilter, setDistanceFilter, getCurrentLocation } = useLocationStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [wholesalers, setWholesalers] = useState<any[]>([]);
  const { translateArrayFields } = useTranslateDynamic();
  const { currentLanguage } = useLanguage();
  
  // Use local state to ensure we always have a valid distance filter value
  const [localDistanceFilter, setLocalDistanceFilter] = useState<number>(20);
  
  // Sync with store when distanceFilter changes, with better safeguards
  useEffect(() => {
    // Ensure we always have a valid number
    const safeDistance = typeof distanceFilter === 'number' && distanceFilter > 0 ? distanceFilter : 20;
    setLocalDistanceFilter(safeDistance);
  }, [distanceFilter]);
  
  // Use the local distance filter as the safe value with additional safeguard
  const safeDistanceFilter = typeof localDistanceFilter === 'number' && localDistanceFilter > 0 ? localDistanceFilter : 20;
  
  // Original texts for translation
  const originalTexts = {
    nearbyText: "Nearby Wholesalers",
    loadingText: "Loading wholesalers...",
    kmAwayText: "km away",
    noneFoundText: "No wholesalers found within {distance} km",
    kmLabel: "km"
  };

  const [translations, setTranslations] = useState(originalTexts);

  // Create a computed property for the dynamic noneFoundText
  const dynamicTranslations = {
    ...translations,
    noneFoundText: translations.noneFoundText.replace('{distance}', safeDistanceFilter.toFixed(0))
  };

  // Small helper to compute distance (km) using Haversine formula for fallback paths
  const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      try {
        const translatedTexts = await Promise.all([
          translationService.translateText(originalTexts.nearbyText, currentLanguage),
          translationService.translateText(originalTexts.loadingText, currentLanguage),
          translationService.translateText(originalTexts.kmAwayText, currentLanguage),
          translationService.translateText(originalTexts.noneFoundText, currentLanguage),
          translationService.translateText(originalTexts.kmLabel, currentLanguage)
        ]);

        setTranslations({
          nearbyText: translatedTexts[0]?.translatedText || originalTexts.nearbyText,
          loadingText: translatedTexts[1]?.translatedText || originalTexts.loadingText,
          kmAwayText: translatedTexts[2]?.translatedText || originalTexts.kmAwayText,
          noneFoundText: translatedTexts[3]?.translatedText || originalTexts.noneFoundText,
          kmLabel: translatedTexts[4]?.translatedText || originalTexts.kmLabel
        });
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage, distanceFilter]);
  
  // Optimize: Combine all initialization logic into a single useEffect
  useEffect(() => {
    let isMounted = true;
    
    const initializeComponent = async () => {
      // Only fetch if we have location and component is mounted
      if (userLocation && isMounted) {
        await fetchNearbyWholesalers();
      }
    };
    
    initializeComponent();
    
    return () => {
      isMounted = false;
    };
  }, [userLocation?.latitude, userLocation?.longitude, safeDistanceFilter]); // Only re-run when location coordinates or distance filter changes
  
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
  
  // Fetch wholesalers within the specified radius
  const fetchNearbyWholesalers = useCallback(async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    try {
      console.log(`Fetching wholesalers within ${safeDistanceFilter} km`);
      
      const { data, error } = await supabase.rpc('find_nearby_wholesalers', {
        user_lat: userLocation.latitude,
        user_lng: userLocation.longitude,
        radius_km: safeDistanceFilter
      });

      if (error) {
        console.error('RPC error (find_nearby_wholesalers):', error);
        // Fallback to direct query against seller_details when RPC is missing
        const { data: directData, error: directError } = await supabase
          .from('seller_details')
          .select(`
            user_id,
            business_name,
            address,
            image_url,
            latitude,
            longitude,
            seller_type
          `)
          .eq('seller_type', 'wholesaler')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (directError) {
          console.error('Error with direct seller_details query:', directError);
          setWholesalers([]);
          return;
        }

        const processedData = (directData || [])
          .map((item: any) => {
            const distance = haversineDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              item.latitude,
              item.longitude
            );
            return { ...item, distance };
          })
          .filter((item: any) => item.distance <= safeDistanceFilter)
          .sort((a: any, b: any) => a.distance - b.distance);

        let formattedWholesalers = processedData.map((item: any) => ({
          id: item.user_id,
          business_details: {
            shopName: item.business_name || 'Shop',
            ownerName: 'Owner',
            image_url: item.image_url || null,
            address:
              typeof item.address === 'string'
                ? item.address
                : (item.address ? JSON.stringify(item.address) : '')
          },
          seller_details: item,
          image_url: item.image_url || null,
          distance: item.distance,
          latitude: item.latitude,
          longitude: item.longitude
        }));

        if (formattedWholesalers.length > 0) {
          formattedWholesalers = await translateArrayFields(
            formattedWholesalers,
            ['business_details.shopName', 'business_details.ownerName', 'business_details.address', 'seller_details.address', 'seller_details.business_name']
          );
        }

        setWholesalers(formattedWholesalers);
        return; // stop here, we already set data via fallback
      }

      if (data) {
        // Only log in development mode
        if (__DEV__) {
          console.log('Raw response from find_nearby_wholesalers:', data?.length || 0, 'wholesalers found');
        }
        
        // Fetch seller_details for each wholesaler
        const wholesalerIds = data.map((seller: any) => seller.user_id);
        console.log(`Found ${wholesalerIds.length} wholesaler IDs to fetch details for`);
        
        // Fetch full seller_details with explicit columns to ensure we get the address
        const { data: sellerDetails, error: sellerError } = await supabase
          .from('seller_details')
          .select('user_id, address, longitude, latitude, business_name, owner_name, created_at, updated_at')
          .in('user_id', wholesalerIds);

        if (sellerError) {
          console.error('Error fetching seller details:', sellerError);
          throw sellerError;
        }

        // Log seller details for debugging
        console.log('Seller details count:', sellerDetails?.length || 0);
        if (sellerDetails && sellerDetails.length > 0) {
          console.log('First seller detail:', JSON.stringify(sellerDetails[0], null, 2));
          console.log('First seller detail properties:', Object.keys(sellerDetails[0]));
        }

        // Create a map of user_id to seller_details
        const sellerDetailsMap = sellerDetails?.reduce((acc: any, curr: any) => {
          acc[curr.user_id] = curr;
          return acc;
        }, {}) || {};

        // Also fetch profiles to get business_details as a fallback
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, business_details')
          .in('id', wholesalerIds);
          
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }
        
        // Create a map of profile id to business_details
        const profilesMap = profiles?.reduce((acc: any, curr: any) => {
          acc[curr.id] = curr;
          return acc;
        }, {}) || {};

        const formattedWholesalers = data.map((seller: any) => {
          // Get business_details from profile if available
          const profileBusinessDetails = profilesMap[seller.user_id]?.business_details || {};
          // Get seller details
          const sellerDetail = sellerDetailsMap[seller.user_id] || {};
          
          return {
            id: seller.user_id,
            business_details: {
              shopName: sellerDetail.business_name || seller.business_name || profileBusinessDetails.shopName || 'Shop',
              ownerName: seller.owner_name || profileBusinessDetails.ownerName || 'Owner',
              image_url: seller.image_url || null,
              address: profileBusinessDetails.address || ''
            },
            seller_details: sellerDetailsMap[seller.user_id] || null,
            image_url: seller.image_url || null,
            distance: seller.distance,
            latitude: seller.latitude || sellerDetail.latitude,
            longitude: seller.longitude || sellerDetail.longitude
          };
        });

        console.log(`Found ${formattedWholesalers.length} wholesalers within ${safeDistanceFilter} km`);
        if (formattedWholesalers.length > 0) {
          console.log('Sample formatted wholesaler:', formattedWholesalers[0]);
        }
        
        // Translate wholesaler business names, owner names, and addresses if not in English
        // Only translate if we have data to translate
        let translatedWholesalers = formattedWholesalers;
        if (formattedWholesalers.length > 0) {
          translatedWholesalers = await translateArrayFields(
            formattedWholesalers,
            ['business_details.shopName', 'business_details.ownerName', 'business_details.address', 'seller_details.address', 'seller_details.business_name']
          );
        }
        
        setWholesalers(translatedWholesalers);
      }
    } catch (error) {
      console.error('Error fetching nearby wholesalers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, safeDistanceFilter]);

  // Helper function to extract address from seller_details
  const getFormattedAddress = (wholesaler: any): string => {
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
    
    // Final fallback
    return 'Address not available';
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerContainer}>
        {showTitle && (
          <Text variant="titleMedium" style={styles.sectionTitle}>{translations.nearbyText || "Nearby Wholesalers"}</Text>
        )}
        <View style={[styles.sliderValueWrapper, !showTitle && styles.sliderValueWrapperFullWidth]}>
          <View style={styles.sliderValueContainer}>
            <Text style={styles.sliderValue}>{(typeof localDistanceFilter === 'number' ? localDistanceFilter : 20).toFixed(0)} {translations.kmLabel || "km"}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.sliderContainer}>
        <Slider
          value={localDistanceFilter}
          onValueChange={(value: number) => {
            setLocalDistanceFilter(value);
            setDistanceFilter(value);
          }}
          minimumValue={1}
          maximumValue={50}
          step={1}
          style={styles.slider}
          minimumTrackTintColor="#FF7D00"
          maximumTrackTintColor="#EAEAEA"
          thumbTintColor="#FF7D00"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderMinLabel}>1 {translations.kmLabel || "km"}</Text>
          <View style={styles.distanceButtonsContainer}>
            <Button 
              compact 
              mode="text" 
              onPress={() => {
                setLocalDistanceFilter(5);
                setDistanceFilter(5);
              }} 
              style={[styles.distanceButton, localDistanceFilter === 5 && styles.activeDistanceButton]}
              labelStyle={styles.distanceButtonLabel}
            >
              5
            </Button>
            <Button 
              compact 
              mode="text" 
              onPress={() => {
                setLocalDistanceFilter(15);
                setDistanceFilter(15);
              }} 
              style={[styles.distanceButton, localDistanceFilter === 15 && styles.activeDistanceButton]}
              labelStyle={styles.distanceButtonLabel}
            >
              15
            </Button>
            <Button 
              compact 
              mode="text" 
              onPress={() => {
                setLocalDistanceFilter(25);
                setDistanceFilter(25);
              }} 
              style={[styles.distanceButton, localDistanceFilter === 25 && styles.activeDistanceButton]}
              labelStyle={styles.distanceButtonLabel}
            >
              25
            </Button>
            <Button 
              compact 
              mode="text" 
              onPress={() => {
                setLocalDistanceFilter(40);
                setDistanceFilter(40);
              }} 
              style={[styles.distanceButton, localDistanceFilter === 40 && styles.activeDistanceButton]}
              labelStyle={styles.distanceButtonLabel}
            >
              40
            </Button>
          </View>
          <Text style={styles.sliderMaxLabel}>50 {translations.kmLabel || "km"}</Text>
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FF7D00" />
          <Text style={styles.loadingText}>{translations.loadingText || "Loading wholesalers..."}</Text>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {wholesalers.length === 0 ? (
            <Text style={styles.emptyMessage}>{dynamicTranslations.noneFoundText}</Text>
          ) : (
            wholesalers.map((wholesaler) => (
              <Card
                key={wholesaler.id}
                style={styles.card}
                onPress={() => router.push(`/(main)/screens/category/${wholesaler.id}`)}
              >
                <View style={styles.cardInner}>
                  <Card.Cover 
                    source={{ 
                      uri: wholesaler.image_url || 
                          wholesaler.business_details?.image_url || 
                          'https://via.placeholder.com/200x120?text=No+Image' 
                    }} 
                    style={styles.cardImage}
                  />
                  <Card.Content style={styles.cardContent}>
                    <Text variant="titleMedium" numberOfLines={1} style={styles.shopName}>
                      {wholesaler.seller_details?.business_name || wholesaler.business_details?.shopName || 'Shop'}
                    </Text>
                    <Text variant="bodySmall" style={styles.address} numberOfLines={1}>
                      {getFormattedAddress(wholesaler)}
                    </Text>
                    <Text variant="bodySmall" style={styles.distance}>
                      {(() => {
                        let distanceValue = wholesaler.distance;
                        
                        // Handle different distance formats
                        if (typeof distanceValue === 'number') {
                          return distanceValue.toFixed(1);
                        } else if (typeof distanceValue === 'string') {
                          const parsed = parseFloat(distanceValue);
                          return isNaN(parsed) ? '0.0' : parsed.toFixed(1);
                        } else if (typeof distanceValue === 'object' && distanceValue !== null) {
                          // Handle nested distance objects
                          if (typeof distanceValue.distance === 'number') {
                            return distanceValue.distance.toFixed(1);
                          } else if (typeof distanceValue.value === 'number') {
                            return distanceValue.value.toFixed(1);
                          } else if (typeof distanceValue.distance === 'string') {
                            const parsed = parseFloat(distanceValue.distance);
                            return isNaN(parsed) ? '0.0' : parsed.toFixed(1);
                          }
                        }
                        
                        // Fallback
                        return '0.0';
                      })()} {translations.kmAwayText || "km away"}
                    </Text>
                  </Card.Content>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sliderValueWrapper: {
    alignItems: 'flex-end',
  },
  sliderValueWrapperFullWidth: {
    flex: 1,
    alignItems: 'flex-end',
  },
  sliderValueContainer: {
    backgroundColor: '#FF7D00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  sliderValue: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  sliderContainer: {
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
  },
  sliderMinLabel: {
    fontSize: 12,
    color: '#666',
    width: '15%',
  },
  sliderMaxLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    width: '15%',
  },
  distanceButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '70%',
  },
  distanceButton: {
    marginHorizontal: 2,
    minWidth: 36,
    paddingVertical: 0,
  },
  distanceButtonLabel: {
    fontSize: 13,
    marginVertical: 0,
  },
  activeDistanceButton: {
    backgroundColor: 'rgba(255, 125, 0, 0.1)',
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
    width: 200,
    marginRight: 12,
    elevation: 2,
    backgroundColor: '#fff',
  },
  cardInner: {
    overflow: 'hidden',
  },
  cardImage: {
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  cardContent: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  shopName: {
    fontSize: 14,
    fontWeight: '600',
  },
  distance: {
    marginTop: 2,
    opacity: 0.7,
    fontSize: 12,
  },
  address: {
    marginTop: 2,
    opacity: 0.7,
    fontSize: 12,
  },
  emptyMessage: {
    padding: 16,
    textAlign: 'center',
    color: '#666',
    width: 200,
  }
});