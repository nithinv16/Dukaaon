import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, BackHandler, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Portal, Modal, Avatar, TextInput, FAB, Checkbox, DataTable, SegmentedButtons, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseConfig } from '../../../config/secrets';
import { useAuthStore } from '../../../store/auth';
import { SellerDetails } from '../../../types/auth';
import MapView, { Marker } from 'react-native-maps';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';
import { Image } from 'react-native';
import { format } from 'date-fns';
import { WHOLESALER_COLORS } from '../../../constants/colors';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

interface PendingOrder {
  id: string;
  order_number: string;
  user_id: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  delivery_address: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  buyer?: {
    id: string;
    business_details?: {
      shopName?: string;
      address?: string;
    };
  };
}

export default function WholesalerHome() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  // Calculate FAB bottom position: Move down into the navbar area
  const fabBottomPosition = 20 + insets.bottom;

  console.log('WholesalerHome component loading with user:', user?.id, 'role:', user?.role);
  console.log('WholesalerHome: user.seller_details exists?', !!user?.seller_details);
  if (user?.seller_details) {
    console.log('WholesalerHome: seller_details.business_name:', user.seller_details.business_name);
  }

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
    exit: 'Exit',
    recentOrders: 'Recent Orders'
  });

  const [primaryLocation, setPrimaryLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
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
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [completedDeliveries, setCompletedDeliveries] = useState<Delivery[]>([]);
  const [loadingCompletedDeliveries, setLoadingCompletedDeliveries] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loadingPendingOrders, setLoadingPendingOrders] = useState(false);

  // Add helper methods at the beginning of the component to solve linter errors
  const emptyFunction = () => { }; // Used for onTextInput prop
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
          translationService.translateText('Exit App', currentLanguage),
          translationService.translateText('Are you sure you want to exit?', currentLanguage),
          translationService.translateText('Exit', currentLanguage),
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
          recentOrders: results[31].translatedText,
          exitApp: results[32].translatedText,
          exitConfirmMessage: results[33].translatedText,
          exit: results[34].translatedText,
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // IMMEDIATE: If seller_details is already in user object, use it right away
  // This is a synchronous operation that happens on every render if available
  useEffect(() => {
    if (user?.seller_details && !sellerDetails) {
      console.log('WholesalerHome: Immediate init - using seller_details from user object');
      const processedData = {
        ...user.seller_details,
        profile_image_url: user.seller_details.image_url || null
      };
      setSellerDetails(processedData);
      console.log('WholesalerHome: Set sellerDetails from user object:', processedData.business_name);
    }
  }, [user?.seller_details, sellerDetails]);

  useEffect(() => {
    console.log('WholesalerHome init: Running initialization, user:', user?.id);

    // CRITICAL: Wait for user.id before fetching
    if (!user?.id) {
      console.log('WholesalerHome init: No user.id yet, skipping fetch');
      setLoading(false); // Don't show infinite loading while waiting for auth
      return;
    }

    // Set loading to true while we fetch data
    setLoading(true);

    const initializeComponent = async () => {
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
        console.log('WholesalerHome init: Starting parallel fetches with user:', user.id);

        // Capture user.id to avoid stale closure issues
        const userId = user.id;

        const results = await promiseAllSettled([
          fetchSellerDetails(),
          fetchBusinessStats(),
          checkAndSetLocation(),
          checkPendingRequests(),
          fetchDeliveries(),
          // Inline pending orders fetch using DIRECT FETCH API to avoid hanging Supabase client
          (async () => {
            console.log('Inline fetchPendingOrders: Starting with userId:', userId);
            try {
              setLoadingPendingOrders(true);

              // Get access token from AsyncStorage
              const SUPABASE_AUTH_KEY = `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;
              const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
              let accessToken = '';
              if (sessionStr) {
                const sessionData = JSON.parse(sessionStr);
                accessToken = sessionData?.access_token || '';
              }

              if (!accessToken) {
                console.warn('Inline fetchPendingOrders: No access token, skipping');
                setPendingOrders([]);
                return;
              }

              console.log('Inline fetchPendingOrders: Using direct fetch API...');

              // Use direct fetch API instead of Supabase client
              const response = await fetch(
                `${supabaseConfig.url}/rest/v1/orders?seller_id=eq.${userId}&status=eq.pending&order=created_at.desc&limit=5`,
                {
                  method: 'GET',
                  headers: {
                    'apikey': supabaseConfig.anonKey,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  }
                }
              );

              console.log('Inline fetchPendingOrders: Fetch response status:', response.status);

              if (!response.ok) {
                const errorText = await response.text();
                console.error('Inline fetchPendingOrders: Fetch error:', errorText);
                setPendingOrders([]);
                return;
              }

              const ordersData = await response.json();
              console.log('Inline fetchPendingOrders: Fetched', ordersData?.length, 'orders');

              if (ordersData && ordersData.length > 0) {
                const ordersWithBuyers = ordersData.map((order: any) => ({
                  ...order,
                  buyer: null
                }));
                console.log('Inline fetchPendingOrders: Setting', ordersWithBuyers.length, 'orders');
                setPendingOrders(ordersWithBuyers as PendingOrder[]);
              } else {
                console.log('Inline fetchPendingOrders: No pending orders found');
                setPendingOrders([]);
              }
            } catch (error: any) {
              console.error('Inline fetchPendingOrders: Exception:', error?.message || error);
              setPendingOrders([]);
            } finally {
              console.log('Inline fetchPendingOrders: Done, setting loading to false');
              setLoadingPendingOrders(false);
            }
          })()
        ]);

        // Log any errors for debugging
        const functionNames = ['fetchSellerDetails', 'fetchBusinessStats', 'checkAndSetLocation', 'checkPendingRequests', 'fetchDeliveries', 'fetchPendingOrders'];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Error in ${functionNames[index]}:`, result.reason);
          } else {
            console.log(`✓ ${functionNames[index]} completed`);
          }
        });
        console.log('WholesalerHome init: All fetches completed');
      } catch (error) {
        console.error('WholesalerHome init: Error during initialization:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();

    // Re-run when user.id becomes available
  }, [user?.id]);

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
            { text: translations.cancel, style: 'cancel', onPress: () => { } },
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

      // FIRST: Check if seller_details is already in the user object (from auth store)
      // This is the most reliable source since the Supabase client may not have the session
      if (user?.seller_details) {
        console.log('✅ Using seller_details from user object');
        const processedData = {
          ...user.seller_details,
          profile_image_url: user.seller_details.image_url || null
        };
        setSellerDetails(processedData);
        console.log('Set seller details from user object:', processedData);
        return;
      }

      // FALLBACK 1: Try Supabase client (may fail if session not set)
      console.log('⚠️ No seller_details in user object, attempting Supabase fetch...');
      try {
        const { data: sellerData, error } = await supabase
          .from('seller_details')
          .select('*')
          .eq('user_id', user?.id)
          .single();

        if (!error && sellerData) {
          console.log('✅ Fetched seller details via Supabase client');
          const processedData = {
            ...sellerData,
            profile_image_url: sellerData.image_url || null
          };
          setSellerDetails(processedData);

          // Update user object with seller_details for future use
          if (user?.id) {
            useAuthStore.getState().setUser({ ...user, seller_details: sellerData } as any);
          }
          return;
        }

        if (error && error.code !== 'PGRST116') {
          console.error(`❌ Supabase fetch error: ${error.message}`);
        }
      } catch (supabaseErr) {
        console.warn('⚠️ Supabase client fetch failed:', supabaseErr);
      }

      // FALLBACK 2: Direct REST API fetch with token from AsyncStorage
      console.log('🔄 Trying direct fetch with access token from AsyncStorage...');
      try {
        const authKey = `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;
        const sessionStr = await AsyncStorage.getItem(authKey);

        if (sessionStr) {
          const sessionData = JSON.parse(sessionStr);
          const accessToken = sessionData?.access_token;

          if (accessToken) {
            const response = await fetch(
              `${supabaseConfig.url}/rest/v1/seller_details?user_id=eq.${user?.id}&select=*`,
              {
                method: 'GET',
                headers: {
                  'apikey': supabaseConfig.anonKey,
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (response.ok) {
              const dataArr = await response.json();
              const sellerData = dataArr[0];

              if (sellerData) {
                console.log('✅ Direct fetch successful, seller details found');
                const processedData = {
                  ...sellerData,
                  profile_image_url: sellerData.image_url || null
                };
                setSellerDetails(processedData);

                // Update user object with seller_details
                if (user?.id) {
                  useAuthStore.getState().setUser({ ...user, seller_details: sellerData } as any);
                }
                return;
              }
            }
          }
        }

        console.log('❌ No seller details found via any method');
      } catch (directFetchErr) {
        console.error('❌ Direct fetch error:', directFetchErr);
      }
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

  // Fetch pending orders for the home screen section
  const fetchPendingOrders = async () => {
    console.log('fetchPendingOrders: Starting, user:', user?.id);

    // Guard: Don't fetch without user ID
    if (!user?.id) {
      console.log('fetchPendingOrders: No user ID, setting loading to false');
      setLoadingPendingOrders(false);
      setPendingOrders([]);
      return;
    }

    try {
      setLoadingPendingOrders(true);

      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', user.id) // Use user.id directly since we've already checked it
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5); // Only show latest 5 pending orders

      console.log('fetchPendingOrders: Query result - data:', ordersData?.length, 'error:', error?.message);

      if (error) {
        console.error('fetchPendingOrders: Error fetching pending orders:', error);
        setLoadingPendingOrders(false);
        setPendingOrders([]);
        return;
      }

      if (ordersData && ordersData.length > 0) {
        // Fetch buyer details for each order
        const ordersWithBuyers = await Promise.all(
          ordersData.map(async (order) => {
            try {
              const { data: buyerData } = await supabase
                .from('profiles')
                .select('id, business_details')
                .eq('id', order.user_id)
                .single();

              return {
                ...order,
                buyer: buyerData || null
              };
            } catch {
              return { ...order, buyer: null };
            }
          })
        );
        console.log('fetchPendingOrders: Setting', ordersWithBuyers.length, 'orders');
        setPendingOrders(ordersWithBuyers as PendingOrder[]);
      } else {
        console.log('fetchPendingOrders: No pending orders found');
        setPendingOrders([]);
      }
    } catch (error) {
      console.error('fetchPendingOrders: Exception:', error);
      setPendingOrders([]);
    } finally {
      console.log('fetchPendingOrders: Done, setting loading to false');
      setLoadingPendingOrders(false);
    }
  };

  // Helper to confirm an order
  const confirmOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      // Refresh pending orders and stats
      fetchPendingOrders();
      fetchBusinessStats();
      Alert.alert('Success', 'Order confirmed successfully!');
    } catch (error) {
      console.error('Error confirming order:', error);
      Alert.alert('Error', 'Failed to confirm order');
    }
  };

  // Helper to get time ago string
  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diffMs = now.getTime() - orderDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(orderDate, 'dd MMM');
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
      // Check for pending profile change requests that include location
      const { data, error } = await supabase
        .from('profile_change_requests')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error checking pending requests: ${error.message}`, error);
        return;
      }

      // Filter for requests that include location changes (latitude/longitude)
      const locationRequest = data?.find(req =>
        req.requested_changes &&
        (req.requested_changes.latitude || req.requested_changes.longitude)
      );

      setPendingRequest(locationRequest || null);
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

      // Build address from non-empty parts only
      let formattedAddress = 'Address not found';
      if (address) {
        const addressParts = [
          address.street,
          address.subregion || address.district,
          address.city,
          address.region,
          address.postalCode
        ].filter(part => part && part.trim() !== '');

        formattedAddress = addressParts.length > 0
          ? addressParts.join(', ')
          : 'Address not found';
      }

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
    if (!editLocation) return;

    try {
      // Submit location change to profile_change_requests for admin approval
      const { error } = await supabase
        .from('profile_change_requests')
        .insert({
          user_id: user?.id,
          user_role: 'seller',
          current_values: {
            latitude: primaryLocation?.latitude || null,
            longitude: primaryLocation?.longitude || null,
            address: primaryLocation?.address || null
          },
          requested_changes: {
            latitude: editLocation.latitude,
            longitude: editLocation.longitude,
            address: editLocation.address
          },
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert(
        'Location Update Submitted',
        'Your location change request has been submitted for admin approval. You will be notified once it is reviewed.',
        [{ text: 'OK' }]
      );
      setShowEditLocationModal(false);
      setEditLocation(null);
      setChangeReason('');
      checkPendingRequests();
    } catch (error) {
      console.error('Error submitting location change:', error);
      Alert.alert('Error', 'Failed to submit location change request. Please try again.');
    }
  };

  const renderEditLocationModal = () => (
    <Portal>
      <Modal
        visible={showEditLocationModal}
        onDismiss={() => setShowEditLocationModal(false)}
        contentContainerStyle={[styles.modalContainer, { maxHeight: '60%', padding: 16 }]}
      >
        <Text variant="titleMedium" style={[styles.modalTitle, { marginBottom: 12, fontSize: 18 }]}>
          Update Store Location
        </Text>

        {editLocation && (
          <>
            <View style={{ height: 150, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <MapView
                style={{ width: '100%', height: '100%' }}
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
            </View>

            <Text variant="bodyMedium" style={[styles.addressText, { marginBottom: 12, fontSize: 13 }]}>
              {editLocation.address}
            </Text>

            <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>
              This change requires admin approval
            </Text>

            <View style={[styles.modalActions, { gap: 8 }]}>
              <Button
                mode="outlined"
                onPress={() => setShowEditLocationModal(false)}
                style={{ flex: 1 }}
                compact
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={submitLocationChange}
                style={{ flex: 1 }}
                compact
              >
                Submit
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
    setProductsToAdd(products.map(product => ({ ...product })));
    setConfirmationVisible(true);
  };

  const handleStockUpdate = (productId: string, newStock: string) => {
    if (/^\d*$/.test(newStock)) {  // Only allow numeric input
      setProductsToAdd(prevProducts =>
        prevProducts.map(product =>
          product.id === productId
            ? { ...product, stock: newStock }
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
    console.log('fetchDeliveries: Starting...');
    try {
      setLoadingDeliveries(true);
      setLoadingCompletedDeliveries(true);

      // Get access token from AsyncStorage
      const SUPABASE_AUTH_KEY = `sb-${supabaseConfig.url.split('//')[1].split('.')[0]}-auth-token`;
      const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
      let accessToken = '';
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        accessToken = sessionData?.access_token || '';
      }

      if (!accessToken) {
        console.warn('fetchDeliveries: No access token, skipping');
        setDeliveries([]);
        setCompletedDeliveries([]);
        setLoadingDeliveries(false);
        setLoadingCompletedDeliveries(false);
        return;
      }

      console.log('fetchDeliveries: Using direct fetch API...');

      // Fetch upcoming deliveries with direct fetch API
      try {
        const upcomingResponse = await fetch(
          `${supabaseConfig.url}/rest/v1/delivery_orders?seller_id=eq.${user?.id}&delivery_status=in.(pending,in_transit)&order=estimated_delivery_time.asc&limit=5`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('fetchDeliveries: Upcoming fetch status:', upcomingResponse.status);

        if (upcomingResponse.ok) {
          const upcomingData = await upcomingResponse.json();
          console.log('fetchDeliveries: Upcoming count:', upcomingData?.length);
          setDeliveries(upcomingData || []);
        } else {
          console.error('fetchDeliveries: Upcoming fetch error');
          setDeliveries([]);
        }
      } catch (err: any) {
        console.error('fetchDeliveries: Upcoming exception:', err?.message);
        setDeliveries([]);
      }
      setLoadingDeliveries(false);

      // Fetch completed deliveries with direct fetch API
      try {
        const completedResponse = await fetch(
          `${supabaseConfig.url}/rest/v1/delivery_orders?seller_id=eq.${user?.id}&delivery_status=in.(delivered,cancelled)&order=estimated_delivery_time.desc&limit=5`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('fetchDeliveries: Completed fetch status:', completedResponse.status);

        if (completedResponse.ok) {
          const completedData = await completedResponse.json();
          console.log('fetchDeliveries: Completed count:', completedData?.length);
          setCompletedDeliveries(completedData || []);
        } else {
          console.error('fetchDeliveries: Completed fetch error');
          setCompletedDeliveries([]);
        }
      } catch (err: any) {
        console.error('fetchDeliveries: Completed exception:', err?.message);
        setCompletedDeliveries([]);
      }
    } catch (error: any) {
      console.error('fetchDeliveries: Unexpected error:', error?.message);
      setDeliveries([]);
      setCompletedDeliveries([]);
    } finally {
      console.log('fetchDeliveries: Done, setting loading to false');
      setLoadingDeliveries(false);
      setLoadingCompletedDeliveries(false);
    }
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

  // Premium Wholesaler Theme - Updated
  const THEME = {
    primary: '#001F3F',    // Navy Blue (Bold Contrast)
    secondary: '#39CCCC',  // Teal
    accent: '#7FDBFF',     // Sky Blue
    background: 'transparent',
    surface: '#FFFFFF',    // White
    textPrimary: '#111111', // Black/Dark Neutral
    textSecondary: '#666666', // Gray Neutral
    success: '#39CCCC',    // Teal (Replacing Green)
    error: '#FF4136',
    warning: '#FF851B',    // Warm Orange
    border: '#E0E0E0',     // Light Gray
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return THEME.warning;
      case 'in_transit': return THEME.primary;
      case 'delivered': return THEME.success;
      case 'cancelled': return THEME.error;
      default: return THEME.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <SystemStatusBar style="light" backgroundColor="transparent" translucent />

      {/* Light Orange Gradient Background */}
      <LinearGradient
        colors={['#FFF3E0', '#FFFFFF', '#FFF8E1']} // Light Orange to White to Light Yellow/Cream
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        style={[styles.content, { backgroundColor: 'transparent' }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header */}
        <View style={[styles.header, { backgroundColor: THEME.primary, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingTop: 60 }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.profileSection}>
              <View style={[styles.avatarContainer, { borderColor: THEME.secondary }]}>
                <Avatar.Image
                  size={44}
                  source={(sellerDetails as any)?.profile_image_url ? { uri: (sellerDetails as any).profile_image_url } : require('../../../assets/images/avatar.png')}
                  style={{ backgroundColor: THEME.surface }}
                />
              </View>
              <View style={styles.nameContainer}>
                <Text style={[styles.welcomeText, { color: THEME.accent }]}>Welcome back,</Text>
                <Text style={[styles.businessName, { color: '#FFFFFF' }]}>
                  {sellerDetails?.business_name || user?.seller_details?.business_name || 'Business Name'}
                </Text>
              </View>
            </View>
            <IconButton
              icon="bell-badge-outline"
              size={24}
              iconColor="#FFFFFF"
              containerColor="rgba(255,255,255,0.15)"
              onPress={() => router.push('/(main)/wholesaler/notifications')}
            />
          </View>

          {/* Location - Pills Style */}
          <TouchableOpacity
            style={[styles.locationPill, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => (!primaryLocation && !(sellerDetails?.latitude)) ? updateLocation() : requestLocationChange()}
          >
            <MaterialCommunityIcons name="map-marker" size={16} color={THEME.secondary} />
            <Text style={[styles.locationText, { color: '#FFFFFF' }]} numberOfLines={1}>
              {primaryLocation?.address || sellerDetails?.location_address || user?.seller_details?.location_address || 'Set store location...'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={THEME.accent} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats - Floating Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {/* Revenue Card */}
            <View style={[styles.statCard, { backgroundColor: THEME.surface }]}>
              <View style={[styles.statIconBox, { backgroundColor: '#F4F7FE' }]}>
                <MaterialCommunityIcons name="currency-inr" size={22} color={THEME.secondary} />
              </View>
              <View>
                <Text style={[styles.statValue, { color: THEME.textPrimary }]}>₹{stats.revenue.today.toLocaleString()}</Text>
                <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>{translations.todayRevenue}</Text>
              </View>
            </View>

            {/* Pending Orders */}
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: THEME.surface }]}
              onPress={() => router.push('/(main)/wholesaler/orders')}
            >
              <View style={[styles.statIconBox, { backgroundColor: '#FFF7E6' }]}>
                <MaterialCommunityIcons name="clipboard-clock-outline" size={22} color={THEME.warning} />
              </View>
              <View>
                <Text style={[styles.statValue, { color: THEME.textPrimary }]}>{stats?.pendingOrders || 0}</Text>
                <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>{translations.pendingOrders}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending Orders Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderNew}>
            <Text style={[styles.sectionTitle, { color: THEME.textPrimary }]}>{translations.pendingOrders}</Text>
            <TouchableOpacity onPress={() => router.push('/(main)/wholesaler/orders')}>
              <Text style={{ color: THEME.secondary, fontWeight: '600' }}>{translations.viewAll}</Text>
            </TouchableOpacity>
          </View>

          {loadingPendingOrders ? (
            <ActivityIndicator color={THEME.secondary} style={{ marginTop: 20 }} />
          ) : pendingOrders.length === 0 ? (
            <View style={styles.emptyStateNew}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={THEME.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyTextNew, { color: THEME.textSecondary }]}>No pending orders</Text>
            </View>
          ) : (
            pendingOrders.map((order) => (
              <View key={order.id} style={[styles.pendingOrderCard, { backgroundColor: THEME.surface }]}>
                {/* Header Row: Retailer Name + Time Badge */}
                <View style={styles.pendingOrderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pendingOrderRetailer, { color: THEME.textPrimary }]}>
                      {order.buyer?.business_details?.shopName || 'Retailer'}
                    </Text>
                    <Text style={[styles.pendingOrderAddress, { color: THEME.textSecondary }]} numberOfLines={1}>
                      {order.delivery_address || order.buyer?.business_details?.address || 'Address not available'}
                    </Text>
                  </View>
                  <View style={[styles.timeAgoBadge, { backgroundColor: THEME.warning + '20' }]}>
                    <Text style={[styles.timeAgoText, { color: THEME.warning }]}>{getTimeAgo(order.created_at)}</Text>
                  </View>
                </View>

                {/* Order Details Row */}
                <View style={styles.pendingOrderDetails}>
                  <View style={styles.pendingOrderInfo}>
                    <Text style={[styles.pendingOrderLabel, { color: THEME.textSecondary }]}>Order Value</Text>
                    <Text style={[styles.pendingOrderValue, { color: THEME.secondary }]}>₹{order.total_amount?.toLocaleString() || 0}</Text>
                  </View>
                  <View style={styles.pendingOrderInfo}>
                    <Text style={[styles.pendingOrderLabel, { color: THEME.textSecondary }]}>Time</Text>
                    <Text style={[styles.pendingOrderValue, { color: THEME.textPrimary }]}>{format(new Date(order.created_at), 'hh:mm a')}</Text>
                  </View>
                </View>

                {/* Product Preview */}
                <View style={[styles.productPreview, { backgroundColor: THEME.background }]}>
                  <MaterialCommunityIcons name="package-variant" size={16} color={THEME.textSecondary} />
                  <Text style={[styles.productPreviewText, { color: THEME.textPrimary }]}>
                    {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.pendingOrderActions}>
                  <TouchableOpacity
                    style={[styles.confirmButtonNew, { backgroundColor: THEME.success }]}
                    onPress={() => confirmOrder(order.id)}
                  >
                    <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewDetailsButton, { borderColor: THEME.secondary }]}
                    onPress={() => router.push(`/(main)/wholesaler/orders/details?id=${order.id}`)}
                  >
                    <Text style={[styles.viewDetailsText, { color: THEME.secondary }]}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions - Horizontal Scroll or Grid */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: THEME.textPrimary }]}>{translations.quickActions}</Text>
          <View style={[styles.quickActionsCard, { backgroundColor: THEME.surface }]}>
            <View style={styles.actionGrid}>
              {[
                { label: translations.addProducts, icon: 'plus-box', color: THEME.secondary, route: '/(main)/wholesaler/products/add' },
                { label: 'Inventory', icon: 'package-variant', color: THEME.success, route: '/(main)/wholesaler/products' },
                { label: 'Analytics', icon: 'chart-box', color: '#707EAE', route: '/(main)/wholesaler/analytics' },
                { label: 'Customers', icon: 'account-group', color: THEME.warning, route: '/(main)/wholesaler/customers' },
                { label: translations.viewOrders, icon: 'truck-fast', color: '#FF5630', route: '/(main)/wholesaler/orders' },
                { label: 'Delivery', icon: 'bike', color: '#36B37E', route: '/(main)/wholesaler/delivery/book' },
              ].map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.actionItem}
                  onPress={() => router.push(action.route as any)}
                >
                  <View style={[styles.actionIconCircle, { backgroundColor: action.color + '15' }]}>
                    <MaterialCommunityIcons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: THEME.textPrimary }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Delivery / Orders Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderNew}>
            <Text style={[styles.sectionTitle, { color: THEME.textPrimary }]}>{translations.recentDeliveries}</Text>
            <TouchableOpacity onPress={() => router.push('/(main)/wholesaler/deliveries')}>
              <Text style={{ color: THEME.secondary, fontWeight: '600' }}>{translations.viewAll}</Text>
            </TouchableOpacity>
          </View>

          {/* New Tab Switcher */}
          <View style={styles.tabContainer}>
            {['upcoming', 'completed'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  deliveryFilter === tab && { backgroundColor: THEME.secondary, borderColor: THEME.secondary }
                ]}
                onPress={() => setDeliveryFilter(tab as 'upcoming' | 'completed')}
              >
                <Text style={[
                  styles.tabText,
                  { color: deliveryFilter === tab ? '#FFF' : THEME.textSecondary }
                ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Delivery List */}
          <View style={{ minHeight: 200 }}>
            {deliveryFilter === 'upcoming' ? (
              loadingDeliveries ? (
                <ActivityIndicator color={THEME.secondary} style={{ marginTop: 20 }} />
              ) : deliveries.length === 0 ? (
                <View style={styles.emptyStateNew}>
                  <MaterialCommunityIcons name="truck-outline" size={48} color={THEME.textSecondary} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTextNew, { color: THEME.textSecondary }]}>{translations.noDeliveries}</Text>
                  <Button
                    mode="text"
                    textColor={THEME.secondary}
                    onPress={() => router.push('/(main)/wholesaler/delivery/book')}
                  >
                    {translations.bookDelivery}
                  </Button>
                </View>
              ) : (
                deliveries.map(delivery => (
                  <TouchableOpacity
                    key={delivery.id}
                    style={[styles.deliveryCardNew, { backgroundColor: THEME.surface }]}
                    onPress={() => router.push(`/(main)/wholesaler/delivery/${delivery.id}`)}
                  >
                    <View style={styles.deliveryCardRow}>
                      <View style={[styles.deliveryIconBox, { backgroundColor: getStatusColor(delivery.delivery_status) + '15' }]}>
                        <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={getStatusColor(delivery.delivery_status)} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.deliveryTitle, { color: THEME.textPrimary }]}>{getRetailerName(delivery)}</Text>
                        <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                          {formatDateTime(delivery.estimated_delivery_time)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(delivery.delivery_status) + '20' }]}>
                          <Text style={{ color: getStatusColor(delivery.delivery_status), fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                            {delivery.delivery_status}
                          </Text>
                        </View>
                        {delivery.amount_to_collect && (
                          <Text style={{ color: THEME.success, fontWeight: '700', fontSize: 13, marginTop: 4 }}>
                            ₹{delivery.amount_to_collect}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )
            ) : (
              // Completed Deliveries
              loadingCompletedDeliveries ? (
                <ActivityIndicator color={THEME.secondary} style={{ marginTop: 20 }} />
              ) : completedDeliveries.length === 0 ? (
                <View style={styles.emptyStateNew}>
                  <Text style={[styles.emptyTextNew, { color: THEME.textSecondary }]}>No completed deliveries</Text>
                </View>
              ) : (
                completedDeliveries.map(delivery => (
                  <TouchableOpacity
                    key={delivery.id}
                    style={[styles.deliveryCardNew, { backgroundColor: THEME.surface }]}
                    onPress={() => router.push(`/(main)/wholesaler/delivery/${delivery.id}`)}
                  >
                    <View style={styles.deliveryCardRow}>
                      <View style={[styles.deliveryIconBox, { backgroundColor: getStatusColor(delivery.delivery_status) + '15' }]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={24} color={getStatusColor(delivery.delivery_status)} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.deliveryTitle, { color: THEME.textPrimary }]}>{getRetailerName(delivery)}</Text>
                        <Text style={{ color: THEME.textSecondary, fontSize: 12 }}>
                          {formatDateTime(delivery.estimated_delivery_time)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )
            )}
          </View>
        </View>

      </ScrollView>

      {renderLocationVerificationModal()}
      {renderEditLocationModal()}
      {renderQuickAddModal()}
      {renderConfirmationModal()}

      <FAB
        icon="plus"
        label="Quick Add"
        style={[styles.fab, { backgroundColor: THEME.secondary, bottom: fabBottomPosition }]}
        color="#FFF"
        onPress={() => router.push('../wholesaler/quick-add')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // Header Styles
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    padding: 2,
    borderWidth: 2,
    borderRadius: 24,
  },
  nameContainer: {
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    marginHorizontal: 6,
    maxWidth: 200,
  },

  // Stats Styles
  statsContainer: {
    paddingHorizontal: 20,
    marginTop: -10, // Slight overlap
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 0.48,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // Soft Shadow
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Sections
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  sectionHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Quick Actions
  quickActionsCard: {
    borderRadius: 20,
    padding: 20,
    paddingBottom: 0, // Icons have margin bottom
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Deliveries
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#E0E5F2', // Light grey bg for tabs
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deliveryCardNew: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deliveryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyStateNew: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    minHeight: 150,
  },
  emptyTextNew: {
    fontSize: 14,
    marginVertical: 10,
  },

  // Modal Styles (Preserved & Updated)
  modalContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B2559',
    marginBottom: 20,
    textAlign: 'center',
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  addressText: {
    fontSize: 14,
    color: '#1B2559',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  // === Legacy/Modal Styles Restored ===
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmationText: {
    marginBottom: 16,
    fontWeight: '500',
    color: '#1B2559',
  },
  confirmationScroll: {
    maxHeight: 400,
  },
  confirmationPrice: {
    color: '#2B3674',
    marginTop: 4,
    fontWeight: '600',
  },
  cancelButton: {
    marginLeft: 8,
  },
  addButton: {
    marginLeft: 8,
  },
  selectedCard: {
    backgroundColor: '#E3F2FD',
    borderColor: '#4318FF',
    borderWidth: 1,
  },
  quickAddProductImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryText: {
    color: '#A3AED0',
    fontSize: 12,
  },
  quickAddInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  inputGroup: {
    flex: 1,
    marginRight: 8,
  },
  inputField: {
    height: 40,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E5F2',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  quantityButton: {
    margin: 0,
  },
  quantityInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#1B2559',
  },
  productIcon: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },
  submitButton: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Other Modal Stuff
  fab: {
    position: 'absolute',
    // bottom is set dynamically via inline style based on safe area insets
    left: '50%',
    transform: [{ translateX: -70 }], // Approximate half width of FAB
    borderRadius: 16,
    elevation: 6,
    zIndex: 999,
  },

  // Keep required legacy styles if referenced
  reasonInput: {
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  pendingChip: {
    backgroundColor: '#FFF7E6',
    marginLeft: 8,
  },
  modalScroll: {
    maxHeight: 400,
  },
  confirmationCard: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F4F7FE',
    padding: 12,
  },
  confirmationCardContent: {
    padding: 0,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmationProductName: {
    flex: 1,
    fontWeight: '600',
    color: '#1B2559',
  },
  stockInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockInput: {
    width: 60,
    height: 36,
    backgroundColor: 'white',
    textAlign: 'center',
  },
  confirmationCategory: {
    color: '#A3AED0',
    marginTop: 4,
    fontSize: 12,
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
  quickAddSearchBar: {
    marginBottom: 16,
    backgroundColor: '#F4F7FE',
    elevation: 0,
  },
  quickAddCard: {
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    elevation: 1,
  },
  quickAddCardContent: {
    padding: 12,
  },
  quickAddProductInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAddProductDetails: {
    flex: 1,
    marginLeft: 12,
  },
  footerActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },

  // Pending Orders Section Styles
  pendingOrderCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#2B3674',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  pendingOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pendingOrderRetailer: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingOrderAddress: {
    fontSize: 12,
    maxWidth: 200,
  },
  timeAgoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeAgoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pendingOrderDetails: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 24,
  },
  pendingOrderInfo: {
    alignItems: 'flex-start',
  },
  pendingOrderLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  pendingOrderValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  productPreviewText: {
    fontSize: 13,
    flex: 1,
  },
  moreProductsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingOrderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    flex: 1,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewDetailsButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
