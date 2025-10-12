import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

interface LocationState {
  userLocation: {
    latitude: number;
    longitude: number;
    timestamp?: number; // Add timestamp for cache expiry
  } | null;
  locationAddress: string | null;
  distanceFilter: number;
  locationPermissionGranted: boolean;
  isLocationLoading: boolean; // Add loading state to prevent multiple requests
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
  setLocationAddress: (address: string | null) => void;
  setDistanceFilter: (distance: number) => void;
  setLocationPermissionGranted: (granted: boolean) => void;
  getCurrentLocation: (forceRefresh?: boolean) => Promise<{ latitude: number; longitude: number } | null>;
  requestLocationPermission: () => Promise<boolean>;
}

const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      userLocation: null,
      locationAddress: null,
      distanceFilter: 20, // Default 20km
      locationPermissionGranted: false,
      isLocationLoading: false,
      
      setUserLocation: (location) => {
        const locationWithTimestamp = location ? {
          ...location,
          timestamp: Date.now()
        } : null;
        set({ userLocation: locationWithTimestamp });
      },
      
      setLocationAddress: (address) => set({ locationAddress: address }),
      
      setDistanceFilter: (distance) => {
        // Ensure distance is always a number
        const numericDistance = Array.isArray(distance) ? distance[0] : distance;
        const safeDistance = typeof numericDistance === 'number' ? numericDistance : parseFloat(numericDistance) || 20;
        set({ distanceFilter: safeDistance });
      },
      
      setLocationPermissionGranted: (granted) => set({ locationPermissionGranted: granted }),
      
      getCurrentLocation: async (forceRefresh = false) => {
        const state = get();
        
        // If already loading, return null to prevent multiple simultaneous requests
        if (state.isLocationLoading) {
          console.log('Location request already in progress, skipping...');
          return state.userLocation ? { 
            latitude: state.userLocation.latitude, 
            longitude: state.userLocation.longitude 
          } : null;
        }
        
        // Check if we have cached location that's still valid (unless force refresh)
        if (!forceRefresh && state.userLocation && state.userLocation.timestamp) {
          const timeSinceLastUpdate = Date.now() - state.userLocation.timestamp;
          if (timeSinceLastUpdate < LOCATION_CACHE_DURATION) {
            console.log('Using cached location, age:', Math.round(timeSinceLastUpdate / 1000), 'seconds');
            return {
              latitude: state.userLocation.latitude,
              longitude: state.userLocation.longitude
            };
          }
        }
        
        set({ isLocationLoading: true });
        
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            console.error('Location permission denied');
            set({ locationPermissionGranted: false, isLocationLoading: false });
            return null;
          }
          
          set({ locationPermissionGranted: true });
          
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Use Balanced for better performance
            maximumAge: 60000, // Accept location up to 1 minute old
            timeout: 15000, // 15 second timeout
          });
          
          const location = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            timestamp: Date.now()
          };
          
          // Perform reverse geocoding to get human-readable address
          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: location.latitude,
              longitude: location.longitude
            });
            
            if (reverseGeocode && reverseGeocode.length > 0) {
              const address = reverseGeocode[0];
              const formattedAddress = [
                address.name,
                address.street,
                address.city,
                address.region,
                address.country
              ].filter(Boolean).join(', ');
              
              set({ 
                userLocation: location, 
                locationAddress: formattedAddress || 'Location detected',
                isLocationLoading: false 
              });
            } else {
              set({ 
                userLocation: location, 
                locationAddress: 'Location detected',
                isLocationLoading: false 
              });
            }
          } catch (geocodeError) {
            console.error('Error reverse geocoding:', geocodeError);
            set({ 
              userLocation: location, 
              locationAddress: 'Location detected',
              isLocationLoading: false 
            });
          }
          
          return {
            latitude: location.latitude,
            longitude: location.longitude
          };
        } catch (error) {
          console.error('Error getting location:', error);
          set({ isLocationLoading: false });
          return null;
        }
      },
      
      requestLocationPermission: async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          const granted = status === 'granted';
          set({ locationPermissionGranted: granted });
          return granted;
        } catch (error) {
          console.error('Error requesting location permission:', error);
          set({ locationPermissionGranted: false });
          return false;
        }
      }
    }),
    {
      name: 'location-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist location data for privacy, only settings
      partialize: (state) => ({
        distanceFilter: state.distanceFilter,
        locationPermissionGranted: state.locationPermissionGranted
      }),
      // Custom deserializer to handle corrupted distanceFilter data
      onRehydrateStorage: () => (state) => {
        if (state && state.distanceFilter) {
          // Fix corrupted distanceFilter if it's an array
          if (Array.isArray(state.distanceFilter)) {
            state.distanceFilter = state.distanceFilter[0] || 20;
          }
          // Ensure it's a valid number
          if (typeof state.distanceFilter !== 'number' || isNaN(state.distanceFilter)) {
            state.distanceFilter = 20;
          }
        }
      }
    }
  )
);