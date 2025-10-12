import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Keyboard, Alert } from 'react-native';
import { TextInput, Text, Card, ActivityIndicator } from 'react-native-paper';
import { debounce } from 'lodash';

interface PlaceResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  lat: number;
  lng: number;
  address: string;
  place_id: string;
}

interface GooglePlacesAutocompleteProps {
  placeholder?: string;
  onPlaceSelected: (place: PlaceDetails) => void;
  onAddressChange?: (address: string) => void;
  onGoogleMapsUrlDetected?: (url: string) => void;
  initialValue?: string;
  style?: any;
  mode?: 'outlined' | 'flat';
  label?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  placeholder = 'Enter address',
  onPlaceSelected,
  onAddressChange,
  onGoogleMapsUrlDetected,
  initialValue = '',
  style,
  mode = 'outlined',
  label
}) => {
  const [query, setQuery] = useState(initialValue);
  const [predictions, setPredictions] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  // Removed inputMode since we now have separate components
  const inputRef = useRef<any>(null);

  // Fallback to Geocoding API when Places API fails
  const fallbackToGeocoding = async (searchText: string) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchText
        )}&key=${GOOGLE_MAPS_API_KEY}&components=country:IN`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        // Convert geocoding results to prediction format
        const geocodingPredictions = data.results.slice(0, 5).map((result: any, index: number) => ({
          place_id: result.place_id || `geocoding_${index}`,
          description: result.formatted_address,
          structured_formatting: {
            main_text: result.address_components[0]?.long_name || result.formatted_address.split(',')[0],
            secondary_text: result.formatted_address.split(',').slice(1).join(',').trim()
          },
          geometry: result.geometry
        }));
        
        setPredictions(geocodingPredictions);
        setShowPredictions(true);
        return true;
      }
    } catch (error) {
      console.error('Geocoding API error:', error);
    }
    return false;
  };

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchText: string) => {
      if (searchText.length < 3) {
        setPredictions([]);
        setShowPredictions(false);
        return;
      }

      setLoading(true);
      try {
        // First try Places API
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            searchText
          )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in&types=address`
        );
        
        const data = await response.json();
        
        if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
          setPredictions(data.predictions);
          setShowPredictions(true);
        } else if (data.status === 'ZERO_RESULTS' || (data.predictions && data.predictions.length === 0)) {
          // Fallback to Geocoding API
          console.log('Places API returned ZERO_RESULTS, trying Geocoding API...');
          const geocodingSuccess = await fallbackToGeocoding(searchText);
          if (!geocodingSuccess) {
            setPredictions([]);
            setShowPredictions(false);
          }
        } else {
          console.error('Places API error:', data.status, data.error_message);
          // Try geocoding as fallback for other errors too
          const geocodingSuccess = await fallbackToGeocoding(searchText);
          if (!geocodingSuccess) {
            setPredictions([]);
            setShowPredictions(false);
          }
        }
      } catch (error) {
        console.error('Error fetching places:', error);
        // Try geocoding as fallback for network errors
        const geocodingSuccess = await fallbackToGeocoding(searchText);
        if (!geocodingSuccess) {
          setPredictions([]);
          setShowPredictions(false);
        }
      } finally {
        setLoading(false);
      }
    }, 300)
  ).current;

  // Get place details by place_id or return geocoding data directly
  const getPlaceDetails = async (placeId: string, prediction?: any) => {
    // If this is a geocoding result with geometry, return it directly
    if (prediction?.geometry?.location) {
      const placeDetails: PlaceDetails = {
        lat: prediction.geometry.location.lat,
        lng: prediction.geometry.location.lng,
        address: prediction.description,
        place_id: prediction.place_id
      };
      
      console.log('Using geocoding result coordinates:', placeDetails);
      onPlaceSelected(placeDetails);
      setQuery(prediction.description);
      setShowPredictions(false);
      Keyboard.dismiss();
      return;
    }
    
    // Otherwise, try to get details from Places API
    try {
      setLoading(true);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        const { geometry, formatted_address } = data.result;
        
        // Validate that we have proper coordinates
        if (geometry?.location?.lat && geometry?.location?.lng) {
          const placeDetails: PlaceDetails = {
            lat: geometry.location.lat,
            lng: geometry.location.lng,
            address: formatted_address,
            place_id: placeId
          };
          
          console.log('Places API coordinates extracted:', placeDetails);
          onPlaceSelected(placeDetails);
          setQuery(formatted_address);
          setShowPredictions(false);
          Keyboard.dismiss();
        } else {
          console.error('Invalid geometry data from Places API:', geometry);
          Alert.alert('Error', 'Could not get location coordinates for this place');
        }
      } else {
        console.error('Places API error:', data.status, data.error_message);
        Alert.alert('Error', 'Could not get place details');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Error', 'Network error while fetching place details');
    } finally {
      setLoading(false);
    }
  };

  // Handle text input change
  const handleTextChange = (text: string) => {
    setQuery(text);
    onAddressChange?.(text);
    
    // Check if it's a Google Maps URL
    if (text.includes('maps.google.com') || text.includes('goo.gl/maps') || text.includes('maps.app.goo.gl')) {
      // Call the enhanced URL detection handler if provided
      if (onGoogleMapsUrlDetected) {
        onGoogleMapsUrlDetected(text);
        return;
      }
      
      // Fallback to local extraction for backward compatibility
      const location = extractLocationFromGoogleMapsUrl(text);
      if (location) {
        if (location.lat && location.lng) {
          // Direct coordinates found
          onPlaceSelected({
            lat: location.lat,
            lng: location.lng,
            address: text,
            place_id: ''
          });
          setShowPredictions(false);
          return;
        } else if (location.place_id) {
          // Place ID found, get details
          getPlaceDetails(location.place_id);
          return;
        }
      }
    }
    
    // Regular text search
    if (text.length > 2) {
      debouncedSearch(text);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };
  
  // Removed handleManualInput since we now have separate manual input component

  // Extract coordinates from Google Maps URL using enhanced patterns
  const extractLocationFromGoogleMapsUrl = (url: string) => {
    try {
      const cleanUrl = decodeURIComponent(url.trim());
      
      const patterns = [
        // Pattern 1: @lat,lng,zoom (most common Google Maps format)
        /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        
        // Pattern 2: ll=lat,lng (legacy format)
        /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        
        // Pattern 3: q=lat,lng (query format)
        /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        
        // Pattern 4: /place/name/@lat,lng (place URLs)
        /\/place\/[^@]*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        
        // Pattern 5: Data parameter coordinates (!3d!4d format)
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
        
        // Pattern 6: maps.google.com/?q=lat,lng
        /maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        
        // Pattern 7: maps.app.goo.gl URLs
        /maps\.app\.goo\.gl\/.*[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/
      ];
      
      for (const pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          
          // Validate coordinates
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            console.log('Coordinates extracted from URL:', { lat, lng });
            return { lat, lng };
          }
        }
      }
      
      // Try to extract place_id from URL for reverse geocoding
      const placeIdMatch = cleanUrl.match(/place_id[=:]([A-Za-z0-9_-]+)/);
      if (placeIdMatch) {
        console.log('Place ID extracted from URL:', placeIdMatch[1]);
        return { place_id: placeIdMatch[1] };
      }
      
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
    }
    return null;
  };

  // Handle prediction selection
  const handlePredictionPress = (prediction: PlaceResult) => {
    getPlaceDetails(prediction.place_id, prediction);
  };

  // Handle input focus
  const handleFocus = () => {
    if (predictions.length > 0) {
      setShowPredictions(true);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    // Delay hiding predictions to allow for selection
    setTimeout(() => {
      setShowPredictions(false);
    }, 200);
  };

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const renderPrediction = ({ item }: { item: PlaceResult }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => handlePredictionPress(item)}
    >
      <Text style={styles.mainText}>{item.structured_formatting?.main_text || 'Location'}</Text>
      <Text style={styles.secondaryText}>{item.structured_formatting?.secondary_text || ''}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        label={label}
        placeholder={placeholder}
        value={query}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={styles.textInput}
        mode={mode}
        right={loading ? <TextInput.Icon icon={() => <ActivityIndicator size="small" />} /> : undefined}
      />
      
      {showPredictions && predictions.length > 0 && (
        <Card style={styles.predictionsContainer}>
          <ScrollView
            style={styles.predictionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {predictions.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={styles.predictionItem}
                onPress={() => handlePredictionPress(item)}
              >
                <Text style={styles.mainText}>{item.structured_formatting?.main_text || 'Location'}</Text>
                <Text style={styles.secondaryText}>{item.structured_formatting?.secondary_text || ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  textInput: {
    marginBottom: 8,
  },
  predictionsContainer: {
    position: 'absolute',
    top: 60, // Adjusted since no segmented buttons
    left: 0,
    right: 0,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
  },
  predictionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  secondaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

export default GooglePlacesAutocomplete;