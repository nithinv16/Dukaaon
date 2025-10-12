import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useManufacturersStore } from '../../store/manufacturers';
import { useLocationStore } from '../../store/location';
import { supabase } from '../../services/supabase/supabase';
import { useTranslateDynamic } from '../../utils/translationUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import * as Location from 'expo-location';

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
    return `${supabaseUrl}/storage/v1/object/public/${url}`;
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
}

// Add optional title prop
interface NearbyManufacturersProps {
  showTitle?: boolean;
}

export const NearbyManufacturers = React.memo(function NearbyManufacturers({ showTitle = false }: NearbyManufacturersProps) {
  const router = useRouter();
  const { userLocation, distanceFilter, setDistanceFilter, getCurrentLocation } = useLocationStore();
  const { translateArrayFields } = useTranslateDynamic();
  const { currentLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  
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
    nearbyText: "Nearby Manufacturers",
    loadingText: "Loading...",
    kmAwayText: "km away",
    noneFoundText: `No manufacturers found within ${safeDistanceFilter} km`,
    kmLabel: "km"
  };

  const [translations, setTranslations] = useState(originalTexts);

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
  }, [currentLanguage, safeDistanceFilter]);
  
  // Initial location fetch on component mount - removed since parent handles location
  // useEffect(() => {
  //   // Get and update user location
  //   getCurrentLocation();
  // }, []);

  // Fetch manufacturers when location is available or distance filter changes
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      fetchNearbyManufacturers();
    }
  }, [userLocation?.latitude, userLocation?.longitude, safeDistanceFilter, fetchNearbyManufacturers]);
  

  
  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1); 
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return Math.round(distance * 10) / 10;
  };
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };
  
  // Fetch manufacturers and calculate their distances
  const fetchNearbyManufacturers = useCallback(async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    
    try {
      const params = {
        user_lat: userLocation.latitude,
        user_lng: userLocation.longitude,
        radius_km: safeDistanceFilter
      };

      // First, try to get count of manufacturers
      const { data: countData, error: countError } = await supabase.rpc(
        'count_nearby_manufacturers',
        params
      );
      
      if (countError) {
        const count = countData || 0;
      }

      // Fetch nearby manufacturers using RPC
      const { data, error } = await supabase.rpc(
        'find_nearby_manufacturers',
        params
      );

      if (error) {
        console.error('RPC error:', error);
        // Fallback to direct query if RPC fails
        const { data: directData, error: directError } = await supabase
          .from('seller_details')
          .select(`
            user_id,
            business_name,
            address,
            image_url,
            latitude,
            longitude
          `)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (directError) {
          console.error('Error with direct query:', directError);
          setManufacturers([]);
          return;
        }

        // Calculate distance manually for direct query results and only translate if needed
        const processedData = directData
          .map((item: any) => {
            const distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              item.latitude,
              item.longitude
            );
            console.log('Direct query - calculated distance:', distance, 'for item:', item.business_name);
            return { ...item, distance };
          })
          .filter((item: any) => item.distance <= safeDistanceFilter)
          .sort((a: any, b: any) => a.distance - b.distance);

        // Only translate if we have data
        let translatedManufacturers = processedData;
        if (processedData.length > 0) {
          translatedManufacturers = await Promise.all(
            processedData.map(async (manufacturer: any) => ({
              ...manufacturer,
              business_name: await translateDynamic(manufacturer.business_name)
            }))
          );
        }
        
        setManufacturers(translatedManufacturers);
        return;
      }

      if (data && data.length > 0) {
        // Process RPC results with type checking
        const formattedManufacturers = data.map((item: any) => {
          console.log('Raw RPC item:', item);
          
          // The SQL function returns SETOF jsonb, so each item is the jsonb_build_object result
          // Supabase wraps this in another object, so we need to extract the actual data
          const manufacturer = item.jsonb_build_object || item;
          console.log('Processed manufacturer:', manufacturer);
          console.log('Manufacturer distance:', manufacturer.distance, 'Type:', typeof manufacturer.distance);
          
          // Handle distance properly - it might be nested or in different formats
          let distanceValue = 0;
          if (typeof manufacturer.distance === 'number') {
            distanceValue = manufacturer.distance;
            console.log('Distance is number:', distanceValue);
          } else if (typeof manufacturer.distance === 'string') {
            distanceValue = parseFloat(manufacturer.distance) || 0;
            console.log('Distance is string, parsed to:', distanceValue);
          } else if (manufacturer.distance && typeof manufacturer.distance === 'object') {
            // Handle nested distance object
            console.log('Distance is object:', manufacturer.distance);
            if (manufacturer.distance.distance) {
              distanceValue = parseFloat(String(manufacturer.distance.distance)) || 0;
              console.log('Extracted distance.distance:', distanceValue);
            } else if (manufacturer.distance.value) {
              distanceValue = parseFloat(String(manufacturer.distance.value)) || 0;
              console.log('Extracted distance.value:', distanceValue);
            } else {
              console.log('Distance object has no distance or value property');
            }
          } else {
            console.log('Distance is undefined or null');
          }

          const result = {
            id: manufacturer.user_id,
            user_id: manufacturer.user_id,
            business_name: manufacturer.business_name,
            address: manufacturer.address,
            image_url: formatImageUrl(manufacturer.image_url),
            distance: distanceValue,
            latitude: manufacturer.latitude,
            longitude: manufacturer.longitude,
            categories: manufacturer.categories || []
          };
          
          console.log('Final formatted manufacturer:', result);
          return result;
        });

        // Translate business names only if we have data
        let translatedManufacturers = formattedManufacturers;
        if (formattedManufacturers.length > 0) {
          translatedManufacturers = await Promise.all(
            formattedManufacturers.map(async (manufacturer: any) => ({
              ...manufacturer,
              business_name: await translateDynamic(manufacturer.business_name)
            }))
          );
        }
        
        setManufacturers(translatedManufacturers);
      } else {
        setManufacturers([]);
      }
    } catch (error) {
      console.error('Error fetching nearby manufacturers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, safeDistanceFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {showTitle && (
           <Text variant="titleMedium" style={styles.sectionTitle}>{translations.nearbyText}</Text>
         )}
        <View style={[styles.sliderValueWrapper, !showTitle && styles.sliderValueWrapperFullWidth]}>
          <View style={styles.sliderValueContainer}>
            <Text style={styles.sliderValue}>{(typeof localDistanceFilter === 'number' ? localDistanceFilter : 20).toFixed(0)} {translations.kmLabel}</Text>
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
          <Text style={styles.sliderMinLabel}>1 {translations.kmLabel}</Text>
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
          <Text style={styles.sliderMaxLabel}>50 {translations.kmLabel}</Text>
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
           <ActivityIndicator size="small" color="#FF7D00" />
           <Text style={styles.loadingText}>{translations.loadingText}</Text>
         </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {manufacturers.length === 0 ? (
             <Text style={styles.emptyMessage}>{translations.noneFoundText}</Text>
           ) : (
            manufacturers.map((manufacturer) => (
              <Card 
                key={manufacturer.id || manufacturer.user_id}
                style={styles.card}
                onPress={() => router.push(`/(main)/screens/manufacturer/${manufacturer.user_id}`)}
              >
                <View style={styles.cardInner}>
                  <Card.Cover 
                    source={manufacturer.image_url
                      ? { uri: manufacturer.image_url } 
                      : require('../../assets/icons/seller_shop.jpg')} 
                    style={styles.cardImage}
                    resizeMode="cover"
                    onError={(e) => {
                      // Use fallback image on error
                    }}
                    defaultSource={require('../../assets/icons/seller_shop.jpg')}
                  />
                  <Card.Content style={styles.cardContent}>
                    <Text variant="titleMedium">{manufacturer.business_name}</Text>
                    <Text variant="bodySmall" style={styles.distance}>
                      {(() => {
                        const distance = manufacturer.distance;
                        console.log('Distance value:', distance, 'Type:', typeof distance);
                        
                        // Handle different distance formats
                        let distanceValue;
                        if (typeof distance === 'number') {
                          distanceValue = distance.toFixed(1);
                        } else if (typeof distance === 'string') {
                          distanceValue = (parseFloat(distance) || 0).toFixed(1);
                        } else if (distance && typeof distance === 'object' && distance.distance) {
                          // Handle nested distance object
                          distanceValue = (parseFloat(String(distance.distance)) || 0).toFixed(1);
                        } else {
                          distanceValue = '0.0';
                        }
                        
                        const translationText = translations.kmAwayText;
                        return `${distanceValue} ${translationText}`;
                      })()}
                    </Text>
                    <Text variant="bodySmall" style={styles.categories}>
                      {manufacturer.categories?.join(' • ') || 'General'}
                    </Text>
                    {manufacturer.address && (
                      <Text variant="bodySmall" numberOfLines={1} style={styles.address}>
                        {typeof manufacturer.address === 'string' 
                          ? manufacturer.address 
                          : manufacturer.address?.street || 'Address not available'}
                      </Text>
                    )}
                  </Card.Content>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
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
  },
  card: {
    width: 280,
    marginHorizontal: 4,
    elevation: 2,
    backgroundColor: '#fff',
  },
  cardInner: {
    overflow: 'hidden',
  },
  cardImage: {
    height: 160,
    backgroundColor: '#f5f5f5',
  },
  cardContent: {
    paddingVertical: 8,
  },
  distance: {
    marginTop: 4,
    opacity: 0.7,
  },
  categories: {
    marginTop: 4,
    opacity: 0.7,
  },
  address: {
    marginTop: 4,
    opacity: 0.7,
  },
  emptyMessage: {
    padding: 12,
    textAlign: 'center',
    color: '#666',
    width: 280,
  }
});