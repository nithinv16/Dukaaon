import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Portal, Modal, Avatar, TextInput, FAB, Checkbox, DataTable, SegmentedButtons, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { SellerDetails } from '../../../types/auth';
import MapView, { Marker } from 'react-native-maps';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';
import { Image } from 'react-native';
import { format } from 'date-fns';
import { WHOLESALER_COLORS } from '../../../constants/colors';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface BusinessStats {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  revenue: {
    today: number;
    thisMonth: number;
  };
}

interface LocationChangeRequest {
  id: string;
  seller_id: string;
  current_latitude: number;
  current_longitude: number;
  current_address: string;
  new_latitude: number;
  new_longitude: number;
  new_address: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string;
}

interface QuickAddItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  defaultPrice: string;
  unit: string;
  minQuantity: number;
  stock: string;
}

interface QuickAddProduct {
  id: string;
  brand: string;
  name: string;
  category: string;
  subcategory: string;
  selected: boolean;
  price: string;
  minQty: string;
  stock: string;
}

interface Delivery {
  id: string;
  retailer_id: string | null;
  manual_retailer: {
    business_name: string;
    address: string;
    phone: string;
  } | null;
  estimated_delivery_time: string;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  amount_to_collect: number | null;
  created_at: string;
  retailer?: {
    business_details: {
      shopName: string;
    };
  };
}

export default function WholesalerHome() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  
  console.log('WholesalerHome component loading with user:', user?.id, 'role:', user?.role);
  
  // Translation state
  const [translations, setTranslations] = useState({
    dashboard: 'Dashboard',
    totalOrders: 'Total Orders',
    pendingOrders: 'Pending Orders',
    totalProducts: 'Total Products',
    lowStockProducts: 'Low Stock Products',
    todayRevenue: "Today's Revenue",
    monthRevenue: "This Month's Revenue",
    quickActions: 'Quick Actions',
    addProducts: 'Add Products',
    manageStock: 'Manage Stock',
    viewOrders: 'View Orders',
    bookDelivery: 'Book Delivery',
    recentDeliveries: 'Recent Deliveries',
    viewAll: 'View All',
    noDeliveries: 'No recent deliveries',
    businessLocation: 'Business Location',
    currentLocation: 'Current Location',
    verifyLocation: 'Verify Location',
    editLocation: 'Edit Location',
    locationPending: 'Location change request pending',
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    refresh: 'Refresh',
    exitApp: 'Exit App',
    exitConfirmMessage: 'Are you sure you want to exit?',
    exit: 'Exit'
  });
  
  const [primaryLocation, setPrimaryLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sellerDetails, setSellerDetails] = useState<SellerDetails | null>(null);
  const [stats, setStats] = useState<BusinessStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    revenue: {
      today: 0,
      thisMonth: 0,
    },
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [verifyingLocation, setVerifyingLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [editLocation, setEditLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const [pendingRequest, setPendingRequest] = useState<LocationChangeRequest | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<QuickAddItem | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [productsToAdd, setProductsToAdd] = useState<QuickAddProduct[]>([]);
  const [quickAddProducts, setQuickAddProducts] = useState<QuickAddProduct[]>([
    {
      id: '1',
      brand: 'Nestlé',
      name: 'Maggi Noodles',
      category: 'Food & Beverages',
      subcategory: 'Instant Noodles',
      selected: false,
      price: '',
      minQty: '10',
      stock: '0',
    },
    {
      id: '2',
      brand: 'Hindustan Unilever',
      name: 'Surf Excel Detergent',
      category: 'Home Care',
      subcategory: 'Detergent Powder',
      selected: false,
      price: '',
      minQty: '5',
      stock: '0',
    },
  ]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [deliveryFilter, setDeliveryFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [completedDeliveries, setCompletedDeliveries] = useState<Delivery[]>([]);
  const [loadingCompletedDeliveries, setLoadingCompletedDeliveries] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add helper methods at the beginning of the component to solve linter errors
  const emptyFunction = () => {}; // Used for onTextInput prop
  const emptyObject = {}; // Used for tvParallaxProperties

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return; // Skip translation for English
      
      try {
        const results = await Promise.all([
          translationService.translateText('Dashboard', currentLanguage),
          translationService.translateText('Total Orders', currentLanguage),
          translationService.translateText('Pending Orders', currentLanguage),
          translationService.translateText('Total Products', currentLanguage),
          translationService.translateText('Low Stock Products', currentLanguage),
          translationService.translateText("Today's Revenue", currentLanguage),
          translationService.translateText("This Month's Revenue", currentLanguage),
          translationService.translateText('Quick Actions', currentLanguage),
          translationService.translateText('Add Products', currentLanguage),
          translationService.translateText('Manage Stock', currentLanguage),
          translationService.translateText('View Orders', currentLanguage),
          translationService.translateText('Book Delivery', currentLanguage),
          translationService.translateText('Recent Deliveries', currentLanguage),
          translationService.translateText('View All', currentLanguage),
          translationService.translateText('No recent deliveries', currentLanguage),
          translationService.translateText('Business Location', currentLanguage),
          translationService.translateText('Current Location', currentLanguage),
          translationService.translateText('Verify Location', currentLanguage),
          translationService.translateText('Edit Location', currentLanguage),
          translationService.translateText('Location change request pending', currentLanguage),
          translationService.translateText('Loading...', currentLanguage),
          translationService.translateText('Error', currentLanguage),
          translationService.translateText('Retry', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Confirm', currentLanguage),
          translationService.translateText('Save', currentLanguage),
          translationService.translateText('Close', currentLanguage),
          translationService.translateText('Search', currentLanguage),
          translationService.translateText('Filter', currentLanguage),
          translationService.translateText('Sort', currentLanguage),
          translationService.translateText('Refresh', currentLanguage),
          translationService.translateText('Recent Orders', currentLanguage),
        ]);

        setTranslations({
          dashboard: results[0].translatedText,
          totalOrders: results[1].translatedText,
          pendingOrders: results[2].translatedText,
          totalProducts: results[3].translatedText,
          lowStockProducts: results[4].translatedText,
          todayRevenue: results[5].translatedText,
          monthRevenue: results[6].translatedText,
          quickActions: results[7].translatedText,
          addProducts: results[8].translatedText,
          manageStock: results[9].translatedText,
          viewOrders: results[10].translatedText,
          bookDelivery: results[11].translatedText,
          recentDeliveries: results[12].translatedText,
          viewAll: results[13].translatedText,
          noDeliveries: results[14].translatedText,
          businessLocation: results[15].translatedText,
          currentLocation: results[16].translatedText,
          verifyLocation: results[17].translatedText,
          editLocation: results[18].translatedText,
          locationPending: results[19].translatedText,
          loading: results[20].translatedText,
          error: results[21].translatedText,
          retry: results[22].translatedText,
          cancel: results[23].translatedText,
          confirm: results[24].translatedText,
          save: results[25].translatedText,
          close: results[26].translatedText,
          search: results[27].translatedText,
          filter: results[28].translatedText,
          sort: results[29].translatedText,
          refresh: results[30].translatedText,
          recentOrders: results[31].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    if (!user?.id) return;
    
    console.log('Running wholesaler home initialization once');
    
    let isActive = true;
    const initializeComponent = async () => {
      if (!isActive) return;
      setLoading(true);
      
      try {
        // Polyfill for Promise.allSettled if not available
        const promiseAllSettled = Promise.allSettled || ((promises: Promise<any>[]) => {
          return Promise.all(
            promises.map(promise =>
              Promise.resolve(promise)
                .then(value => ({ status: 'fulfilled', value }))
                .catch(reason => ({ status: 'rejected', reason }))
            )
          );
        });
        
        // Execute all promises but handle errors individually
        const results = await promiseAllSettled([
          fetchSellerDetails(),
          fetchBusinessStats(),
          checkAndSetLocation(),
          checkPendingRequests(),
          fetchDeliveries()
        ]);
        
        // Log any errors for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const functionNames = ['fetchSellerDetails', 'fetchBusinessStats', 'checkAndSetLocation', 'checkPendingRequests', 'fetchDeliveries'];
            console.error(`Error in ${functionNames[index]}:`, result.reason);
          }
        });
      } catch (error) {
        console.error('Error during initialization:', error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };
    
    initializeComponent();
    
    return () => {
      isActive = false;
    };
  }, [user?.id]); // Only re-run if user ID changes

  // Handle back button navigation on wholesaler home screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Only show exit dialog if this is the root screen
      // Check if we can go back in the navigation stack
      if (router.canGoBack()) {
        // If we can go back, let the default navigation handle it
        return false;
      } else {
        // If we can't go back (this is the root), show exit confirmation
        Alert.alert(
          translations.exitApp,
          translations.exitConfirmMessage,
          [
            { text: translations.cancel, style: 'cancel', onPress: () => {} },
            { text: translations.exit, style: 'destructive', onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: true }
        );
        return true;
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const fetchSellerDetails = async () => {
    try {
      console.log('🔍 Current user ID:', user?.id);
      console.log('🔍 Current user object:', user);
      
      // Fetch seller details including image_url from seller_details table
      const { data: sellerData, error } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.error('❌ Seller details not found for this user. You may need to complete your profile setup.');
          console.error('❌ User ID used in query:', user?.id);
        } else {
          console.error(`❌ Error fetching seller details: ${error.message}`, error);
        }
        return;
      }

      console.log('✅ Fetched seller details:', sellerData);
      console.log('✅ Business name:', sellerData?.business_name);
      console.log('✅ Owner name:', sellerData?.owner_name);

      // Map image_url to profile_image_url for compatibility with existing UI
      const processedData = {
        ...sellerData,
        profile_image_url: sellerData.image_url || null
      };
      
      setSellerDetails(processedData);
      console.log('Set seller details state:', processedData);
    } catch (error) {
      console.error('Unexpected error in fetchSellerDetails:', error);
    }
  };

  const fetchBusinessStats = async () => {
    try {
      // Fetch stats from Supabase
      const [ordersResponse, productsResponse, revenueResponse] = await Promise.all([
        supabase.from('orders').select('*').eq('seller_id', user?.id),
        supabase.from('products').select('*').eq('seller_id', user?.id),
        supabase.from('orders')
          .select('total_amount')
          .eq('seller_id', user?.id)
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ]);

      // Check for errors in responses
      if (ordersResponse.error) {
        console.error(`Error fetching orders: ${ordersResponse.error.message}`, ordersResponse.error);
        return;
      }
      
      if (productsResponse.error) {
        console.error(`Error fetching products: ${productsResponse.error.message}`, productsResponse.error);
        return;
      }
      
      if (revenueResponse.error) {
        console.error(`Error fetching revenue: ${revenueResponse.error.message}`, revenueResponse.error);
        return;
      }

      // Update stats
      setStats({
        totalOrders: ordersResponse.data?.length || 0,
        pendingOrders: ordersResponse.data?.filter(o => o.status === 'pending').length || 0,
        totalProducts: productsResponse.data?.length || 0,
        lowStockProducts: productsResponse.data?.filter(p => p.stock_available > 0 && p.stock_available <= p.min_quantity).length || 0,
        revenue: {
          today: revenueResponse.data?.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0) || 0,
          thisMonth: 0, // Calculate monthly revenue
        },
      });
    } catch (error) {
      console.error('Unexpected error in fetchBusinessStats:', error);
    }
  };

  const checkAndSetLocation = async () => {
    try {
      // First check if location exists in seller_details table
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_details')
        .select('latitude, longitude, address, location_address')
        .eq('user_id', user?.id)
        .single();

      if (!sellerError && sellerData && sellerData.latitude && sellerData.longitude) {
        // If location exists in seller_details, use it
        console.log('Using location from seller_details table:', sellerData);
        
        // Prefer location_address if available, otherwise fall back to address
        const locationAddress = sellerData.location_address || 
          (typeof sellerData.address === 'object' 
            ? `${sellerData.address?.street || ''}, ${sellerData.address?.city || ''}, ${sellerData.address?.state || ''}`
            : sellerData.address);
            
        setPrimaryLocation({
          latitude: sellerData.latitude,
          longitude: sellerData.longitude,
          address: locationAddress
        });
        return;
      }

      // If not in seller_details, check if location exists in profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude, location_address, location_verified')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      // If location exists in profile, use it
      if (profile.latitude && profile.longitude && profile.location_address) {
        console.log('Using location from profiles table:', profile);
        setPrimaryLocation({
          latitude: profile.latitude,
          longitude: profile.longitude,
          address: profile.location_address
        });

        // Also update seller_details with this location for consistency (only if record exists)
        const { data: existingRecord, error: checkError } = await supabase
          .from('seller_details')
          .select('user_id')
          .eq('user_id', user?.id)
          .single();

        if (!checkError && existingRecord) {
          await supabase
            .from('seller_details')
            .update({
              latitude: profile.latitude,
              longitude: profile.longitude,
              location_address: profile.location_address,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user?.id);
        }
        
        return;
      }

      // If no location exists in either table, the UI will show "Set Location" button
      console.log('No location found in either table, showing Set Location button');
    } catch (error) {
      console.error('Error checking location:', error);
    }
  };

  const updateLocation = async () => {
    try {
      // Double-check to prevent showing popup if location is already set
      if (primaryLocation) {
        console.log('Location already set, not showing popup');
        return;
      }

      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        alert('Permission to access location was denied');
        return;
      }

      console.log('Getting current location...');
      let currentLocation;
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced // Use Balanced instead of High for better compatibility
        });
      } catch (locationError) {
        console.error('Error getting current position:', locationError);
        alert('Failed to get your current location. Please check your device settings and try again.');
        return;
      }

      if (!currentLocation || !currentLocation.coords) {
        console.error('Location returned invalid or missing coordinates');
        alert('Could not determine your location. Please try again later.');
        return;
      }

      console.log('Location obtained successfully:', currentLocation.coords);
      
      // Safely obtain address with error handling
      let formattedAddress = 'Address not found';
      try {
        const addressResults = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

        const address = addressResults && addressResults.length > 0 ? addressResults[0] : null;
        
        // Safely format the address with null checks
        if (address) {
          const street = address.street || '';
          const city = address.city || '';
          const region = address.region || '';
          const postalCode = address.postalCode || '';
          
          // Build address with parts that exist
          const parts = [];
          if (street) parts.push(street);
          if (city) parts.push(city);
          if (region) parts.push(region);
          if (postalCode) parts.push(postalCode);
          
          formattedAddress = parts.length > 0 ? parts.join(', ') : 'Address details incomplete';
        }
      } catch (geocodeError) {
        console.error('Error in reverse geocoding:', geocodeError);
        // Continue with default address if geocoding fails
      }

      console.log('Formatted location address:', formattedAddress);

      // Set verifying location and show modal
      setVerifyingLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        address: formattedAddress
      });
      setShowLocationModal(true);

    } catch (error) {
      console.error('Error in updateLocation:', error);
      alert('Failed to get location. Please try again later.');
    }
  };

  const confirmLocation = async (location: typeof verifyingLocation) => {
    if (!location) {
      console.log('No location provided to confirmLocation');
      return;
    }
    
    try {
      console.log('Confirming location:', location);
      
      // Update location in profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          location_address: location.address,
          location_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id)
        .select();

      if (profileError) {
        console.error('Error updating profile location:', profileError);
        throw profileError;
      }
      
      console.log('Successfully updated profile location');

      // Update location in seller_details table (only if record exists)
      // First check if seller_details record exists
      const { data: existingSellerDetails, error: checkError } = await supabase
        .from('seller_details')
        .select('user_id')
        .eq('user_id', user?.id)
        .single();

      if (!checkError && existingSellerDetails) {
        // Record exists, update location fields only
        const { error: sellerError } = await supabase
          .from('seller_details')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            location_address: location.address,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        if (sellerError) {
          console.error('Error updating seller_details location:', sellerError);
          // Don't throw here, just log the error since we already updated the profile
        } else {
          console.log('Successfully updated seller_details location');
        }
      } else {
         console.log('No existing seller_details record found, skipping seller_details update');
         // This is normal for users who haven't completed their seller profile yet
       }

      // Update state
      setPrimaryLocation(location);
      alert('Store location has been set successfully');

    } catch (error) {
      console.error('Error in confirmLocation:', error);
      alert('Failed to save location. Please try again later.');
    }
  };

  const getProfileImage = () => {
    if ((sellerDetails as any)?.profile_image_url) {
      return { uri: (sellerDetails as any).profile_image_url };
    }
    return require('../../../assets/images/avatar.png');
  };

  const renderLocationVerificationModal = () => (
    <Portal>
      <Modal
        visible={showLocationModal}
        onDismiss={() => setShowLocationModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleMedium" style={styles.modalTitle}>
          Verify Store Location
        </Text>
        
        {verifyingLocation ? (
          <>
            {/* Wrap MapView in error boundary */}
            <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: verifyingLocation.latitude,
                longitude: verifyingLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{
                  latitude: verifyingLocation.latitude,
                  longitude: verifyingLocation.longitude,
                }}
              />
            </MapView>
            </View>

            <Text variant="bodyMedium" style={styles.addressText}>
              {verifyingLocation.address || 'Address not available'}
            </Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowLocationModal(false);
                  setVerifyingLocation(null);
                }}
              >
                Change Location
              </Button>
              <Button
                mode="contained"
                onPress={async () => {
                  await confirmLocation(verifyingLocation);
                  setShowLocationModal(false);
                  setVerifyingLocation(null);
                }}
              >
                Confirm Location
              </Button>
            </View>
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF7D00" />
            <Text>Loading location data...</Text>
          </View>
        )}
      </Modal>
    </Portal>
  );

  const checkPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('location_change_requests')
        .select('*')
        .eq('seller_id', user?.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) {
        console.error(`Error checking pending location change requests: ${error.message}`, error);
        return;
      }
      
      setPendingRequest(data);
    } catch (error) {
      console.error('Unexpected error in checkPendingRequests:', error);
    }
  };

  const requestLocationChange = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const [address] = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      const formattedAddress = address ? 
        `${address.street || ''}, ${address.city || ''}, ${address.region || ''}, ${address.postalCode || ''}` 
        : 'Address not found';

      if (!primaryLocation) {
        // If no location is set, use updateLocation instead
        updateLocation();
        return;
      }

      // Set up edit location with current coordinates and formatted address
      setEditLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        address: formattedAddress
      });
      setShowEditLocationModal(true);
      
    } catch (error) {
      console.error('Error requesting location change:', error);
      alert('Failed to get new location. Please try again.');
    }
  };

  const submitLocationChange = async () => {
    if (!editLocation || !changeReason) return;
    
    try {
      const { error } = await supabase
        .from('location_change_requests')
        .insert({
          seller_id: user?.id,
          current_latitude: primaryLocation?.latitude,
          current_longitude: primaryLocation?.longitude,
          current_address: primaryLocation?.address,
          new_latitude: editLocation.latitude,
          new_longitude: editLocation.longitude,
          new_address: editLocation.address,
          reason: changeReason,
          status: 'pending'
        });

      if (error) throw error;

      alert('Location change request submitted for admin approval');
      setShowEditLocationModal(false);
      setEditLocation(null);
      setChangeReason('');
      checkPendingRequests();
    } catch (error) {
      console.error('Error submitting location change:', error);
      alert('Failed to submit location change request');
    }
  };

  const renderEditLocationModal = () => (
    <Portal>
      <Modal
        visible={showEditLocationModal}
        onDismiss={() => setShowEditLocationModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text variant="titleMedium" style={styles.modalTitle}>
          Request Location Change
        </Text>

        {editLocation && (
          <>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: editLocation.latitude,
                longitude: editLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{
                  latitude: editLocation.latitude,
                  longitude: editLocation.longitude,
                }}
              />
            </MapView>

            <Text variant="bodyMedium" style={styles.addressText}>
              {editLocation.address}
            </Text>

            <TextInput
              label="Reason for change"
              value={changeReason}
              onChangeText={setChangeReason}
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowEditLocationModal(false)}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={submitLocationChange}
                disabled={!changeReason.trim()}
              >
                Submit Request
              </Button>
            </View>
          </>
        )}
      </Modal>
    </Portal>
  );

  const handleQuickAdd = async (item: QuickAddItem) => {
    try {
      const { error } = await supabase
        .from('products')
        .insert({
          seller_id: user?.id,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          price: item.defaultPrice,
          unit: item.unit,
          min_quantity: item.minQuantity,
          stock_available: parseInt(item.stock) || 0,
          status: 'active',
        });

      if (error) throw error;
      alert('Product added successfully');
      setQuickAddVisible(false);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product');
    }
  };

  const handleQuickAddMultiple = async (products: QuickAddProduct[]) => {
    try {
      const { error } = await supabase
        .from('products')
        .insert(products.map(p => ({
          seller_id: user?.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          subcategory: p.subcategory,
          price: p.price,
          min_quantity: parseInt(p.minQty),
          stock_available: parseInt(p.stock) || 0,
          status: 'active',
        })));

      if (error) throw error;
      alert('Products added successfully');
      setQuickAddVisible(false);
      setConfirmationVisible(false);
    } catch (error) {
      console.error('Error adding products:', error);
      alert('Failed to add products');
    }
  };

  const showConfirmation = (products: QuickAddProduct[]) => {
    console.log("Showing confirmation dialog for products:", products.length);
    // Create a deep copy of the products array to ensure independent state
    setProductsToAdd(products.map(product => ({...product})));
    setConfirmationVisible(true);
  };

  const handleStockUpdate = (productId: string, newStock: string) => {
    if (/^\d*$/.test(newStock)) {  // Only allow numeric input
      setProductsToAdd(prevProducts => 
        prevProducts.map(product => 
          product.id === productId 
            ? {...product, stock: newStock}
            : product
        )
      );
    }
  };

  const renderConfirmationModal = () => (
    <Portal>
      <Modal
        visible={confirmationVisible}
        onDismiss={() => setConfirmationVisible(false)}
        contentContainerStyle={[styles.modalContainer, { zIndex: 9999 }]}
      >
        <View style={styles.modalHeader}>
          <Text variant="titleMedium" style={styles.modalTitle}>Confirm Inventory Addition</Text>
          <IconButton 
            icon="close" 
            onPress={() => setConfirmationVisible(false)} 
            size={20}
          />
        </View>
        
        <Text style={styles.confirmationText}>
          You are about to add {productsToAdd.length} product{productsToAdd.length !== 1 ? 's' : ''} to your inventory:
        </Text>
        
        <ScrollView style={styles.confirmationScroll}>
          {productsToAdd.map((product) => (
            <Card key={product.id} style={styles.confirmationCard}>
              <Card.Content style={styles.confirmationCardContent}>
                <View style={styles.confirmationRow}>
                  <Text variant="titleSmall" style={styles.confirmationProductName}>{product?.name || 'Product Name'}</Text>
                  <View style={styles.stockInputContainer}>
                    <Text variant="bodySmall">Stock:</Text>
                    <TextInput
                      mode="outlined"
                      value={product.stock}
                      onChangeText={(text) => handleStockUpdate(product.id, text)}
                      keyboardType="numeric"
                      style={styles.stockInput}
                      dense
                    />
                  </View>
                </View>
                <Text variant="bodySmall" style={styles.confirmationCategory}>
                  {product.category} • {product.subcategory}
                </Text>
                <Text variant="bodyMedium" style={styles.confirmationPrice}>
                  Price: ₹{product.price} • Min Qty: {product.minQty}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
        
        <View style={styles.footerActions}>
          <Button 
            mode="outlined" 
            onPress={() => setConfirmationVisible(false)}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => handleQuickAddMultiple(productsToAdd)}
            style={styles.addButton}
          >
            Confirm Addition
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderQuickAddModal = () => (
    <Portal>
      <Modal
        visible={quickAddVisible}
        onDismiss={() => setQuickAddVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <Text variant="titleLarge" style={styles.modalTitle}>Quick Add Products</Text>
          <IconButton 
            icon="close" 
            onPress={() => setQuickAddVisible(false)} 
            size={20}
          />
        </View>
        
        <Searchbar
          placeholder="Search products"
          style={styles.quickAddSearchBar}
          onChangeText={(text) => {
            // Filter the quickAddProducts based on search input
            // Implemented through rendering logic below
            setSearchQuery(text);
          }}
          value={searchQuery}
        />

        <ScrollView style={styles.modalScroll}>
          {quickAddProducts
            .filter(product => 
              product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
              product.subcategory.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((product) => (
              <Card 
                key={product.id} 
                style={[
                  styles.quickAddCard,
                  product.selected && styles.selectedCard
                ]}
                onPress={() => {
                  setQuickAddProducts(prevProducts => 
                    prevProducts.map(p => 
                      p.id === product.id ? { ...p, selected: !p.selected } : p
                    )
                  );
                }}
              >
                <Card.Content style={styles.quickAddCardContent}>
                  <View style={styles.quickAddProductInfo}>
                    <Image 
                      source={require('../../../assets/images/products/default.jpg')}
                      style={styles.quickAddProductImage}
                    />
                    <View style={styles.quickAddProductDetails}>
                      <Text variant="titleMedium">{product?.name || 'Product Name'}</Text>
                      <Text variant="bodySmall" style={styles.categoryText}>
                        {product.category} • {product.subcategory}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.quickAddInputRow}>
                    <View style={styles.inputGroup}>
                      <Text variant="labelSmall">Price (₹)</Text>
                      <TextInput
                        mode="outlined"
                        value={product.price}
                        placeholder="0.00"
                        onChangeText={(text) => {
                          setQuickAddProducts(prevProducts => 
                            prevProducts.map(p => 
                              p.id === product.id ? { ...p, price: text } : p
                            )
                          );
                        }}
                        keyboardType="numeric"
                        style={styles.inputField}
                        dense
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text variant="labelSmall">Stock</Text>
                      <View style={styles.quantityInputContainer}>
                        <IconButton
                          icon="minus"
                          size={16}
                          style={styles.quantityButton}
                          onPress={() => {
                            const currentStock = parseInt(product.stock) || 0;
                            const newStock = Math.max(0, currentStock - 1).toString();
                            setQuickAddProducts(prevProducts => 
                              prevProducts.map(p => 
                                p.id === product.id ? { ...p, stock: newStock } : p
                              )
                            );
                          }}
                          disabled={!product.stock || parseInt(product.stock) <= 0}
                        />
                        <TextInput
                          mode="outlined"
                          value={product.stock}
                          placeholder="0"
                          onChangeText={(text) => {
                            // Only allow numeric input
                            if (/^\d*$/.test(text)) {
                              setQuickAddProducts(prevProducts => 
                                prevProducts.map(p => 
                                  p.id === product.id ? { ...p, stock: text } : p
                                )
                              );
                            }
                          }}
                          keyboardType="numeric"
                          style={styles.quantityInput}
                          dense
                        />
                        <IconButton
                          icon="plus"
                          size={16}
                          style={styles.quantityButton}
                          onPress={() => {
                            const currentStock = parseInt(product.stock) || 0;
                            const newStock = (currentStock + 1).toString();
                            setQuickAddProducts(prevProducts => 
                              prevProducts.map(p => 
                                p.id === product.id ? { ...p, stock: newStock } : p
                              )
                            );
                          }}
                        />
                      </View>
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text variant="labelSmall">Min Qty</Text>
                      <TextInput
                        mode="outlined"
                        value={product.minQty}
                        placeholder="1"
                        onChangeText={(text) => {
                          // Only allow numeric input
                          if (/^\d*$/.test(text)) {
                            setQuickAddProducts(prevProducts => 
                              prevProducts.map(p => 
                                p.id === product.id ? { ...p, minQty: text } : p
                              )
                            );
                          }
                        }}
                        keyboardType="numeric"
                        style={styles.inputField}
                        dense
                      />
                    </View>
                  </View>
                  
                  <Checkbox
                    status={product.selected ? 'checked' : 'unchecked'}
                    onPress={() => {
                      setQuickAddProducts(prevProducts => 
                        prevProducts.map(p => 
                          p.id === product.id ? { ...p, selected: !p.selected } : p
                        )
                      );
                    }}
                  />
                </Card.Content>
              </Card>
            ))}
        </ScrollView>
        
        <View style={styles.footerActions}>
          <Button 
            mode="outlined" 
            onPress={() => setQuickAddVisible(false)}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button 
            mode="contained"
            onPress={() => {
              const selectedProducts = quickAddProducts.filter(p => p.selected && p.price);
              if (selectedProducts.length === 0) {
                alert('Please select products and set prices');
                return;
              }
              setQuickAddVisible(false);
              setTimeout(() => {
                showConfirmation(selectedProducts);
              }, 100);
            }}
            style={styles.addButton}
          >
            Add {quickAddProducts.filter(p => p.selected).length} Selected
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const fetchDeliveries = async () => {
    let isMounted = true;
    try {
      setLoadingDeliveries(true);
      setLoadingCompletedDeliveries(true);
      
      // Fetch upcoming deliveries (pending and in_transit)
      const upcomingResponse = await supabase
        .from('delivery_orders')
        .select('*, retailer:retailer_id(business_details)')
        .eq('seller_id', user?.id)
        .in('delivery_status', ['pending', 'in_transit'])
        .order('estimated_delivery_time', { ascending: true })
        .limit(5);

      if (upcomingResponse.error) {
        console.error(`Error fetching upcoming deliveries: ${upcomingResponse.error.message}`, upcomingResponse.error);
        if (isMounted) {
          setDeliveries([]);
          setLoadingDeliveries(false);
        }
        return;
      }
      
      if (isMounted) {
        setDeliveries(upcomingResponse.data || []);
        setLoadingDeliveries(false);
      }
      
      // Fetch completed deliveries (delivered and cancelled)
      const completedResponse = await supabase
        .from('delivery_orders')
        .select('*, retailer:retailer_id(business_details)')
        .eq('seller_id', user?.id)
        .in('delivery_status', ['delivered', 'cancelled'])
        .order('estimated_delivery_time', { ascending: false })
        .limit(5);

      if (completedResponse.error) {
        console.error(`Error fetching completed deliveries: ${completedResponse.error.message}`, completedResponse.error);
        if (isMounted) {
          setCompletedDeliveries([]);
          setLoadingCompletedDeliveries(false);
        }
        return;
      }
      
      if (isMounted) {
        setCompletedDeliveries(completedResponse.data || []);
      }
    } catch (error) {
      console.error('Unexpected error in fetchDeliveries:', error);
      // Set empty arrays on error to prevent infinite loading
      if (isMounted) {
        setDeliveries([]);
        setCompletedDeliveries([]);
      }
    } finally {
      if (isMounted) {
        setLoadingDeliveries(false);
        setLoadingCompletedDeliveries(false);
      }
    }
    
    return () => { isMounted = false; };
  };

  const getRetailerName = (delivery: Delivery) => {
    if (delivery.retailer_id && delivery.retailer) {
      return delivery.retailer.business_details.shopName;
    } else if (delivery.manual_retailer) {
      return delivery.manual_retailer.business_name;
    }
    return 'Unknown Retailer';
  };

  const formatDateTime = (datetime: string) => {
    try {
      const dateObj = new Date(datetime);
      return format(dateObj, 'MMM d, h:mm a');
    } catch (e) {
      return datetime;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return WHOLESALER_COLORS.secondary;
      case 'in_transit': return WHOLESALER_COLORS.primary;
      case 'delivered': return WHOLESALER_COLORS.success;
      case 'cancelled': return WHOLESALER_COLORS.error;
      default: return WHOLESALER_COLORS.mediumGrey;
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="dark" />

      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profileInfo}>
            <Avatar.Image 
              size={40} 
              source={(sellerDetails as any)?.profile_image_url ? { uri: (sellerDetails as any).profile_image_url } : require('../../../assets/images/avatar.png')} 
            />
            <View style={styles.nameContainer}>
              <Text style={styles.businessName}>
                {sellerDetails?.business_name || 'Complete your profile'}
              </Text>
              <Text style={styles.ownerName}>
                {sellerDetails?.owner_name || 'Tap to add business details'}
              </Text>
            </View>
          </View>
          <IconButton 
            icon="bell-outline" 
            size={24}
            iconColor={WHOLESALER_COLORS.background}
            onPress={() => router.push('/(main)/wholesaler/notifications')}
          />
        </View>

        {/* Location Section */}
        <View style={styles.locationSection}>
          <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
          <Text variant="bodyMedium" style={styles.locationText}>
            {primaryLocation?.address || sellerDetails?.location_address || 'Set store location...'}
          </Text>
          {!primaryLocation && !(sellerDetails?.latitude && sellerDetails?.longitude) && (
            <Button 
              mode="outlined" 
              style={styles.setLocationButton}
              onPress={() => {
                updateLocation();
              }}
            >
              Set Location
            </Button>
          )}
          {pendingRequest && (
            <Chip 
              icon="clock-outline"
              style={styles.pendingChip}
            >
              Change Pending
            </Chip>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text variant="titleLarge">₹{stats.revenue.today}</Text>
              <Text variant="bodySmall">{translations.todayRevenue}</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statsCard} onPress={() => router.push('/(main)/wholesaler/orders')}>
            <Card.Content>
              <Text variant="titleLarge">{stats?.pendingOrders || 0}</Text>
              <Text variant="bodySmall">{translations.pendingOrders}</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statsCard} onPress={() => router.push('/(main)/wholesaler/inventory')}>
            <Card.Content>
              <Text variant="titleLarge">{stats?.lowStockProducts || 0}</Text>
              <Text variant="bodySmall">{translations.lowStockProducts}</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statsCard}>
            <Card.Content>
              <Text variant="titleLarge">{stats?.totalProducts || 0}</Text>
              <Text variant="bodySmall">{translations.totalProducts}</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Quick Actions */}
        <Card style={styles.enhancedCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.enhancedSectionTitle}>
              {translations.quickActions}
            </Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/products/add')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.primaryLight }]}>
                  <MaterialCommunityIcons name="plus" size={24} color={WHOLESALER_COLORS.primary} />
                </View>
                <Text style={styles.actionLabel}>{translations.addProducts}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/products')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.successLight }]}>
                  <MaterialCommunityIcons name="package-variant" size={24} color={WHOLESALER_COLORS.success} />
                </View>
                <Text style={styles.actionLabel}>{translations.manageStock}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/customers')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.secondaryLight }]}>
                  <MaterialCommunityIcons name="account-group" size={24} color={WHOLESALER_COLORS.secondary} />
                </View>
                <Text style={styles.actionLabel}>Customers</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/analytics')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.primaryLight }]}>
                  <MaterialCommunityIcons name="chart-bar" size={24} color={WHOLESALER_COLORS.primary} />
                </View>
                <Text style={styles.actionLabel}>Analytics</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/orders')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.secondaryLight }]}>
                  <MaterialCommunityIcons name="truck" size={24} color={WHOLESALER_COLORS.secondary} />
                </View>
                <Text style={styles.actionLabel}>{translations.viewOrders}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => router.push('/(main)/wholesaler/delivery/book')}
              >
                <View style={[styles.iconCircle, { backgroundColor: WHOLESALER_COLORS.secondaryLight }]}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color={WHOLESALER_COLORS.secondary} />
                </View>
                <Text style={styles.actionLabel}>{translations.bookDelivery}</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Booked Deliveries */}
        <Card style={styles.enhancedCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.enhancedSectionTitle}>
              {translations.recentDeliveries}
            </Text>
            
            <View style={styles.sectionHeader}>
              <SegmentedButtons
                value={deliveryFilter}
                onValueChange={(value) => setDeliveryFilter(value as 'upcoming' | 'completed')}
                buttons={[
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'completed', label: 'Completed' }
                ]}
                style={styles.deliveryTabs}
              />
              <Button 
                mode="text"
                onPress={() => router.push('/(main)/wholesaler/deliveries')}
              >
                {translations.viewAll}
              </Button>
            </View>
            
            {deliveryFilter === 'upcoming' ? (
              loadingDeliveries ? (
                <ActivityIndicator style={styles.loader} />
              ) : deliveries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{translations.noDeliveries}</Text>
                  <Button 
                    mode="outlined" 
                    onPress={() => router.push('/(main)/wholesaler/delivery/book')}
                    style={styles.emptyButton}
                  >
                    {translations.bookDelivery}
                  </Button>
                </View>
              ) : (
                <View>
                  {deliveries.map(delivery => (
                    <Card 
                      key={delivery.id} 
                      style={styles.deliveryCard}
                      onPress={() => router.push(`/(main)/wholesaler/delivery/${delivery.id}`)}
                    >
                      <Card.Content>
                        <View style={styles.deliveryHeader}>
                          <View style={styles.deliveryInfo}>
                            <Text variant="titleMedium">{getRetailerName(delivery)}</Text>
                            <Text variant="bodyMedium" style={styles.deliveryTime}>
                              {formatDateTime(delivery.estimated_delivery_time)}
                            </Text>
                          </View>
                          <Chip 
                            style={[
                              styles.statusChip, 
                              { backgroundColor: `${getStatusColor(delivery.delivery_status)}20` }
                            ]}
                            textStyle={{ color: getStatusColor(delivery.delivery_status) }}
                          >
                            {delivery.delivery_status.replace('_', ' ')}
                          </Chip>
                        </View>
                        
                        {delivery.amount_to_collect && (
                          <Text variant="bodyMedium" style={styles.amountText}>
                            Amount to collect: ₹{delivery.amount_to_collect}
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )
            ) : (
              loadingCompletedDeliveries ? (
                <ActivityIndicator style={styles.loader} />
              ) : completedDeliveries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No completed delivery orders found</Text>
                </View>
              ) : (
                <View>
                  {completedDeliveries.map(delivery => (
                    <Card 
                      key={delivery.id} 
                      style={styles.deliveryCard}
                      onPress={() => router.push(`/(main)/wholesaler/delivery/${delivery.id}`)}
                    >
                      <Card.Content>
                        <View style={styles.deliveryHeader}>
                          <View style={styles.deliveryInfo}>
                            <Text variant="titleMedium">{getRetailerName(delivery)}</Text>
                            <Text variant="bodyMedium" style={styles.deliveryTime}>
                              {formatDateTime(delivery.estimated_delivery_time)}
                            </Text>
                          </View>
                          <Chip 
                            style={[
                              styles.statusChip, 
                              { backgroundColor: `${getStatusColor(delivery.delivery_status)}20` }
                            ]}
                            textStyle={{ color: getStatusColor(delivery.delivery_status) }}
                          >
                            {delivery.delivery_status.replace('_', ' ')}
                          </Chip>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )
            )}
          </Card.Content>
        </Card>

        {/* Recent Orders */}
        <Card style={styles.enhancedCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.enhancedSectionTitle}>
              {translations.recentOrders || 'Recent Orders'}
            </Text>
            <View style={styles.sectionHeader}>
              <Button 
                mode="text"
                onPress={() => router.push('/(main)/wholesaler/orders')}
              >
                View All
              </Button>
            </View>
            {/* Add recent orders list here */}
          </Card.Content>
        </Card>

        {/* Low Stock Alerts */}
        <Card style={styles.alertsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Low Stock Alerts
            </Text>
            {/* Add low stock items list here */}
          </Card.Content>
        </Card>
      </ScrollView>
      {renderLocationVerificationModal()}
      {renderEditLocationModal()}
      {renderQuickAddModal()}
      {renderConfirmationModal()}
      
      <FAB
        icon="plus"
        label="Quick Add"
        style={styles.fab}
        onPress={() => router.push('../wholesaler/quick-add')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  header: {
    padding: 16,
    paddingTop: 16,
    backgroundColor: WHOLESALER_COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: WHOLESALER_COLORS.lightGrey,
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameContainer: {
    marginLeft: 12,
  },
  businessName: {
    fontWeight: '600',
    color: WHOLESALER_COLORS.background,
  },
  ownerName: {
    color: WHOLESALER_COLORS.background,
    opacity: 0.9,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  locationText: {
    flex: 1,
    marginLeft: 8,
    color: WHOLESALER_COLORS.darkGrey,
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  statsCard: {
    width: '48%',
    margin: '1%',
    elevation: 2,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  enhancedCard: {
    margin: 16,
    elevation: 4,
    borderRadius: 12,
    backgroundColor: WHOLESALER_COLORS.background,
    shadowColor: WHOLESALER_COLORS.darkGrey,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  enhancedSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: WHOLESALER_COLORS.darkGrey,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  ordersCard: {
    margin: 16,
    marginTop: 0,
    elevation: 2,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  alertsCard: {
    margin: 16,
    marginTop: 0,
    elevation: 2,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalContainer: {
    backgroundColor: WHOLESALER_COLORS.background,
    margin: 20,
    borderRadius: 8,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  addressText: {
    marginBottom: 16,
    textAlign: 'center',
    color: WHOLESALER_COLORS.darkGrey,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reasonInput: {
    marginVertical: 16,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  pendingChip: {
    backgroundColor: WHOLESALER_COLORS.secondaryLight,
    color: WHOLESALER_COLORS.secondaryDark,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    backgroundColor: WHOLESALER_COLORS.secondary,
    elevation: 4,
    zIndex: 999,
  },
  modalScroll: {
    maxHeight: 400,
  },
  productIcon: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },
  categoryText: {
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 12,
  },
  inputField: {
    height: 35,
    width: 70,
    fontSize: 12,
  },
  submitButton: {
    marginLeft: 8,
  },
  deliveryCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryTime: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  amountText: {
    marginTop: 8,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  emptyState: {
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginBottom: 16,
  },
  emptyButton: {
    borderRadius: 20,
    borderColor: WHOLESALER_COLORS.primary,
  },
  loader: {
    padding: 20,
  },
  deliveryTabs: {
    maxWidth: '70%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  setLocationButton: {
    marginLeft: 8,
    height: 36,
  },
  infoText: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quickAddSearchBar: {
    marginBottom: 16,
  },
  quickAddCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  quickAddCardContent: {
    padding: 16,
  },
  quickAddProductInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAddProductImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 16,
  },
  quickAddProductDetails: {
    flex: 1,
  },
  quickAddInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    marginHorizontal: 4,
  },
  quantityInput: {
    width: 50,
  },
  footerActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    marginLeft: 8,
  },
  addButton: {
    marginLeft: 8,
  },
  selectedCard: {
    backgroundColor: WHOLESALER_COLORS.selected,
  },
  confirmationText: {
    marginBottom: 16,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  confirmationScroll: {
    maxHeight: 400,
  },
  confirmationCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  confirmationCardContent: {
    padding: 16,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmationProductName: {
    flex: 1,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  stockInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockInput: {
    width: 80,
    height: 36,
    backgroundColor: 'white',
  },
  confirmationCategory: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 4,
  },
  confirmationPrice: {
    color: WHOLESALER_COLORS.darkGrey,
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: WHOLESALER_COLORS.background,
    margin: 20,
    borderRadius: 8,
    padding: 20,
    maxHeight: '80%',
  },
  confirmationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmButton: {
    marginTop: 16,
    alignSelf: 'flex-end',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
