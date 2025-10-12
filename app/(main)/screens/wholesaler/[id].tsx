import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Text, Card, Button, Chip, Divider } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import * as Location from 'expo-location';

// Define types
interface WholesalerProfile {
  id: string;
  user_id: string;
  business_name: string;
  owner_name?: string;
  address: any;
  contact_phone?: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  categories?: string[];
  created_at?: string;
}

export default function WholesalerDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wholesaler, setWholesaler] = useState<WholesalerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    fetchWholesalerDetails();
    getCurrentLocation();
  }, [id]);

  // Fetch wholesaler details from the database
  const fetchWholesalerDetails = async () => {
    setLoading(true);
    try {
      console.log('Fetching wholesaler details for ID:', id);
      
      // Try to get from seller_details first
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', id)
        .eq('seller_type', 'wholesaler')
        .single();
      
      if (sellerData) {
        console.log('Found wholesaler in seller_details:', sellerData);
        setWholesaler(sellerData);
        setLoading(false);
        return;
      }
      
      // If not found in seller_details, check profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('role', 'wholesaler')
        .single();
        
      if (profileError) {
        console.error('Error fetching wholesaler profile:', profileError);
        throw profileError;
      }
      
      if (profileData) {
        console.log('Found wholesaler in profiles:', profileData);
        
        // Transform profile data to the same format
        const transformed: WholesalerProfile = {
          id: profileData.id,
          user_id: profileData.id,
          business_name: profileData.business_details?.shopName || 'Wholesaler',
          owner_name: profileData.business_details?.ownerName,
          address: profileData.business_details?.address || {},
          contact_phone: profileData.phone,
          image_url: profileData.image_url,
          latitude: profileData.latitude,
          longitude: profileData.longitude
        };
        
        setWholesaler(transformed);
      } else {
        console.log('No wholesaler found with ID:', id);
      }
    } catch (error) {
      console.error('Error in fetchWholesalerDetails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get current location to calculate distance
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Calculate distance when both wholesaler and current location are available
  useEffect(() => {
    if (wholesaler?.latitude && wholesaler?.longitude && currentLocation) {
      const calculatedDistance = calculateDistance(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        wholesaler.latitude,
        wholesaler.longitude
      );
      setDistance(calculatedDistance);
    }
  }, [wholesaler, currentLocation]);

  // Calculate distance between two coordinates (Haversine formula)
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
    const d = R * c; // Distance in km
    return Math.round(d * 10) / 10;
  };
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Format address for display
  const formatAddress = (address: any): string => {
    if (!address) return 'Address not available';
    
    if (typeof address === 'string') {
      return address;
    }
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    
    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>Loading wholesaler details...</Text>
      </View>
    );
  }

  if (!wholesaler) {
    return (
      <View style={styles.errorContainer}>
        <Text>Wholesaler not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{
          title: wholesaler.business_name || 'Wholesaler Profile',
        }}
      />
      
      <View style={styles.header}>
        <Image 
          source={
            wholesaler.image_url 
              ? { uri: wholesaler.image_url }
              : require('../../../../assets/icons/seller_shop.jpg')
          }
          style={styles.coverImage}
          resizeMode="cover"
        />
      </View>
      
      <Card style={styles.profileCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.businessName}>
            {wholesaler.business_name}
          </Text>
          
          {distance !== null && (
            <Chip style={styles.distanceChip} icon="map-marker-distance">
              {typeof distance === 'number' ? distance.toFixed(1) : parseFloat(distance) || 0} km away
            </Chip>
          )}
          
          <Divider style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text variant="bodyLarge" style={styles.infoLabel}>Owner:</Text>
            <Text variant="bodyLarge" style={styles.infoValue}>
              {wholesaler.owner_name || 'Not available'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text variant="bodyLarge" style={styles.infoLabel}>Address:</Text>
            <Text variant="bodyLarge" style={styles.infoValue}>
              {formatAddress(wholesaler.address)}
            </Text>
          </View>
          
          {wholesaler.contact_phone && (
            <View style={styles.infoRow}>
              <Text variant="bodyLarge" style={styles.infoLabel}>Contact:</Text>
              <Text variant="bodyLarge" style={styles.infoValue}>
                {wholesaler.contact_phone}
              </Text>
            </View>
          )}
          
          <Divider style={styles.divider} />
          
          <View style={styles.actionButtons}>
            <Button 
              mode="contained" 
              icon="phone" 
              style={styles.actionButton}
              onPress={() => {/* Handle call action */}}
            >
              Call
            </Button>
            <Button 
              mode="contained" 
              icon="message-text" 
              style={styles.actionButton}
              onPress={() => {/* Handle message action */}}
            >
              Message
            </Button>
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.mapCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Location</Text>
          <Text variant="bodyMedium">
            {formatAddress(wholesaler.address)}
          </Text>
          
          {/* Map placeholder - in a real app, replace with a map component */}
          <View style={styles.mapPlaceholder}>
            <Text>Map view would be displayed here</Text>
          </View>
          
          <Button 
            mode="outlined" 
            icon="directions" 
            style={styles.directionsButton}
            onPress={() => {/* Handle get directions action */}}
          >
            Get Directions
          </Button>
        </Card.Content>
      </Card>
      
      {/* Products section */}
      <Card style={styles.productsCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Products</Text>
          <Text variant="bodyMedium">
            Contact this wholesaler to get information about their products.
          </Text>
          
          <Button 
            mode="contained" 
            icon="shopping" 
            style={styles.browseButton}
            onPress={() => {/* Handle browse products action */}}
          >
            Browse Products
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
  profileCard: {
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 10,
    elevation: 4,
  },
  businessName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  distanceChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '700',
    width: 80,
  },
  infoValue: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  mapCard: {
    margin: 16,
    borderRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  directionsButton: {
    marginTop: 8,
  },
  productsCard: {
    margin: 16,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 24,
  },
  browseButton: {
    marginTop: 16,
  },
});