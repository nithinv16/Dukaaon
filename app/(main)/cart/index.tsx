import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Text, Button, Card, IconButton, Divider, Portal, Snackbar, Chip } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useCartStore } from '../../../store/cart';
import { usePaymentStore } from '../../../store/payment';
import { supabase } from '../../../services/supabase/supabase';
import { useAuthStore } from '../../../store/auth';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import ProductImage from '../../../components/common/ProductImage';
import * as Location from 'expo-location';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;
  
  try {
    router = useRouter();
  } catch (error) {
    console.error('[Cart] Error initializing router:', error);
    router = null;
  }
  
  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Cart] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Cart] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Cart] router.back not available');
      }
    },
    canGoBack: () => {
      if (router && typeof router.canGoBack === 'function') {
        return router.canGoBack();
      }
      return false;
    }
  };
  
  return safeRouter;
};

// Add this helper function at the top of the file, outside the component
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
};

export default function Cart() {
  const user = useAuthStore(state => state.user);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const { items, removeItem, updateQuantity, loading, clearCart, calculateDeliveryFee } = useCartStore();
  const [clearingCart, setClearingCart] = useState(false);
  const router = useSafeRouter();
  const { defaultMethod } = usePaymentStore();
  const { currentLanguage } = useLanguage();

  // Define original texts for translation
  const originalTexts = {
    cartCleared: 'Cart cleared successfully',
    clearFailed: 'Failed to clear cart',
    locationRequired: 'Location Required',
    locationRequiredMessage: 'Please enable location access to calculate delivery fees and place orders.',
    ok: 'OK',
    orderError: 'Order Error',
    sellerLocationError: 'Unable to get seller location information',
    orderFailed: 'Failed to place order',
    orderPlacedSuccessfully: 'Order placed successfully!',
    addPaymentMethod: 'Add Payment Method',
    placeOrder: 'Place Order',
    proceedToCheckout: 'Proceed to Checkout',
    emptyTitle: 'Your cart is empty',
    emptyMessage: 'Add some products to get started',
    browseProducts: 'Browse Products',
    orderByCall: 'Order by Call',
    title: 'Cart',
    totalItems: 'Total Items',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery Fee',
    total: 'Total',
    payment: 'Payment',
    change: 'Change'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Create a synchronous translation function for UI text
  const t = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [deliveryDetails, setDeliveryDetails] = useState({
    fee: 0,
    vehicleType: '2 wheeler',
    distance: 0
  });
  
  // Store locations for delivery calculation
  const [userLocation, setUserLocation] = useState({
    latitude: 0,
    longitude: 0
  });
  
  // Add this state to track if we have all needed locations
  const [locationsReady, setLocationsReady] = useState(false);

  useEffect(() => {
    useCartStore.getState().loadCart();
    loadUserLocation();
  }, []);
  
  // Simplified approach to location loading and delivery calculation
  useEffect(() => {
    if (items.length > 0) {
      // Load user location only
      loadUserLocation().then(() => {
        setLocationLoading(false);
      }).catch(error => {
        console.error('Error loading user location:', error);
        setLocationLoading(false);
      });
    } else {
      setLocationLoading(false);
    }
  }, [items]);
  
  // Effect to calculate delivery fee when locations and loading state change
  useEffect(() => {
    if (!locationLoading && 
        userLocation?.latitude && 
        userLocation?.longitude) {
      calculateDeliveryFeeForCart();
    }
  }, [locationLoading, userLocation, items]);
  
  // Simplified user location fetching - focus on profile table only
  const loadUserLocation = async () => {
    try {
      const user = useAuthStore.getState().user;
      if (!user?.id) return;
      
      // Get retailer's location directly from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .single();
      
      if (!error && data && data.latitude && data.longitude) {
        console.log('Got retailer location from profile:', data);
        setUserLocation({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude)
        });
        return true;
      } else {
        console.error('No retailer location in profile:', error || 'Missing data');
        
        // Get current location as fallback
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced // Balance speed and accuracy
          });
          
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
          
          // Save to profile for future use
          await supabase
            .from('profiles')
            .update({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              last_location_update: new Date().toISOString()
            })
            .eq('id', user.id);
          
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading user location:', error);
      return false;
    }
  };
  

  
  // Batch delivery fee calculation for cart display
  const calculateDeliveryFeeForCart = async () => {
    try {
      if (!userLocation?.latitude || !userLocation?.longitude) {
        console.error('Missing user coordinates for delivery calculation');
        setDeliveryDetails({
          fee: 0,
          vehicleType: '2 wheeler',
          distance: 0
        });
        return 0;
      }
      
      // Group items by seller
      const itemsBySeller = items.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      const sellerIds = Object.keys(itemsBySeller);
      
      // If only one seller, use simple calculation
      if (sellerIds.length === 1) {
        const sellerId = sellerIds[0];
        
        // Fetch seller location dynamically
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', sellerId)
          .single();
          
        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          console.error('Missing store coordinates for delivery calculation:', sellerError);
          setDeliveryDetails({
            fee: 0,
            vehicleType: '2 wheeler',
            distance: 0
          });
          return 0;
        }
        
        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };
        
        const subtotal = calculateSubtotal();
        const itemCount = items.reduce((count, item) => count + item.quantity, 0);
        
        const details = calculateDeliveryFee(
          subtotal,
          itemCount,
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );
        
        setDeliveryDetails(details);
        return details.fee;
      }
      
      // For multiple sellers, calculate batch delivery fee
      const sellerDistances: Record<string, { distance: number; location: { latitude: number; longitude: number } }> = {};
      
      // Get all seller locations and calculate distances
      for (const sellerId of sellerIds) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', sellerId)
          .single();
          
        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          console.error('Missing seller location for:', sellerId);
          continue;
        }
        
        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        // Calculate distance to this seller
        const distance = calculateDistance(
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        sellerDistances[sellerId] = {
          distance,
          location: sellerLocation
        };
      }
      
      // Find the farthest seller
      const farthestSeller = Object.entries(sellerDistances).reduce((farthest, [sellerId, data]) => 
        data.distance > farthest.distance ? { sellerId, distance: data.distance, location: data.location } : farthest,
        { sellerId: '', distance: 0, location: { latitude: 0, longitude: 0 } }
      );
      
      if (!farthestSeller.sellerId) {
        setDeliveryDetails({
          fee: 0,
          vehicleType: '2 wheeler',
          distance: 0
        });
        return 0;
      }
      
      // Calculate delivery fee based on farthest seller and total order value
      const totalSubtotal = calculateSubtotal();
      const totalItemCount = items.reduce((count, item) => count + item.quantity, 0);
      
      const batchDeliveryDetails = calculateDeliveryFee(
        totalSubtotal,
        totalItemCount,
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        farthestSeller.location.latitude,
        farthestSeller.location.longitude
      );
      
      setDeliveryDetails(batchDeliveryDetails);
      return batchDeliveryDetails.fee;
      
    } catch (error) {
      console.error('Error in delivery calculation wrapper:', error);
      setDeliveryDetails({
        fee: 0,
        vehicleType: '2 wheeler',
        distance: 0
      });
      return 0;
    }
  };
  
  // Helper function to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      return total + (Number(item.price) * item.quantity);
    }, 0);
  };

  const calculateItemTotal = (price: string, quantity: number) => {
    return Number(price) * quantity;
  };
  
  // Calculate total including delivery fee
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + deliveryDetails.fee;
  };
  
  // Handle clearing the cart with confirmation
  const handleClearCart = async () => {
    try {
      setClearingCart(true);
      await clearCart();
      setSnackbarMessage(t('cartCleared'));
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error clearing cart:', error);
      setSnackbarMessage(t('clearFailed'));
      setSnackbarVisible(true);
    } finally {
      setClearingCart(false);
    }
  };

  const placeOrder = async () => {
    try {
      if (!user?.id) return;

      // Basic validation
      if (!userLocation?.latitude || !userLocation?.longitude) {
        Alert.alert(
        t('locationRequired'),
        t('locationRequiredMessage'),
        [{ text: t('ok') }]
        );
        return;
      }

      // Group items by seller
      const itemsBySeller = items.reduce((acc, item) => {
        if (!acc[item.seller_id]) {
          acc[item.seller_id] = [];
        }
        acc[item.seller_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      // Prepare delivery address
      const deliveryAddress = {
        street: user.business_details?.address || '',
        city: user.business_details?.city || '',
        state: user.business_details?.state || '',
        postal_code: user.business_details?.postal_code || '',
        country: 'India',
        latitude: Number(userLocation.latitude),
        longitude: Number(userLocation.longitude)
      };

      // Calculate total amounts
      let totalAmount = 0;
      let totalDeliveryFee = 0;
      const ordersBySeller: Record<string, any> = {};
      const sellerDistances: Record<string, { distance: number; location: { latitude: number; longitude: number } }> = {};

      // First pass: Get all seller locations and calculate distances
      for (const [seller_id, sellerItems] of Object.entries(itemsBySeller)) {
        console.log('Processing order for seller:', seller_id);
        
        // Get seller location directly
        const { data: sellerData, error: sellerError } = await supabase
          .from('seller_details')
          .select('latitude, longitude')
          .eq('user_id', seller_id)
          .single();
          
        if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
          Alert.alert(
              t('orderError'),
              t('sellerLocationError'),
              [{ text: t('ok') }]
          );
          return;
        }
        
        // Create coordinates with explicit number conversion
        const sellerLocation = {
          latitude: Number(sellerData.latitude),
          longitude: Number(sellerData.longitude)
        };

        // Calculate distance to this seller
        const distance = calculateDistance(
          Number(userLocation.latitude),
          Number(userLocation.longitude),
          sellerLocation.latitude,
          sellerLocation.longitude
        );

        sellerDistances[seller_id] = {
          distance,
          location: sellerLocation
        };

        const subtotal = sellerItems.reduce((total, item) => 
          total + (Number(item.price) * item.quantity), 0);
        
        totalAmount += subtotal;
      }

      // Find the farthest seller for batch delivery fee calculation
      const farthestSeller = Object.entries(sellerDistances).reduce((farthest, [sellerId, data]) => 
        data.distance > farthest.distance ? { sellerId, distance: data.distance } : farthest,
        { sellerId: '', distance: 0 }
      );

      // Calculate combined order details for delivery fee
      const totalItemCount = items.reduce((count, item) => count + item.quantity, 0);
      
      // Calculate delivery fee based on farthest seller and combined order value
      const batchDeliveryDetails = calculateDeliveryFee(
        totalAmount,
        totalItemCount,
        Number(userLocation.latitude),
        Number(userLocation.longitude),
        sellerDistances[farthestSeller.sellerId].location.latitude,
        sellerDistances[farthestSeller.sellerId].location.longitude
      );

      totalDeliveryFee = batchDeliveryDetails.fee;

      // Second pass: Create orders with proper delivery fee distribution
      for (const [seller_id, sellerItems] of Object.entries(itemsBySeller)) {
        const subtotal = sellerItems.reduce((total, item) => 
          total + (Number(item.price) * item.quantity), 0);
        
        // Only the farthest seller gets the delivery fee, others get 0
        const deliveryFeeForThisSeller = seller_id === farthestSeller.sellerId ? totalDeliveryFee : 0;
        
        ordersBySeller[seller_id] = {
          user_id: user.id,
          seller_id: seller_id,
          items: sellerItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            unit: item.unit
          })),
          total_amount: subtotal,
          delivery_fee: deliveryFeeForThisSeller, // Explicitly set delivery fee
          status: 'pending',
          payment_method: defaultMethod?.type || 'cod',
          delivery_address: user.business_details?.shopName 
            ? `${user.business_details.shopName}, ${user.business_details?.address || ''}`
            : user.business_details?.address || '',
          order_number: generateOrderNumber(),
        };
      }

      // Helper function to calculate distance
      function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
      }

      function deg2rad(deg: number): number {
        return deg * (Math.PI/180);
      }

      // Use MasterOrderService to place the complete order
      const { MasterOrderService } = await import('../../../services/masterOrderService');
      
      const result = await MasterOrderService.placeCompleteOrder(
        user.id,
        ordersBySeller,
        deliveryAddress,
        totalAmount, // Pass only the subtotal without delivery fee
        totalDeliveryFee,
        defaultMethod?.type || 'cod',
        undefined // delivery instructions
      );

      if (!result.success) {
        console.error('Error placing master order:', result.error);
        setSnackbarMessage(result.error || t('orderFailed'));
        setSnackbarVisible(true);
        return;
      }

      // Show success message first
      setSnackbarMessage(t('orderPlacedSuccessfully'));
      setSnackbarVisible(true);

      // Clear cart and navigate after a delay
      setTimeout(() => {
        clearCart();
        router.replace('/(main)/orders');
      }, 2000);

    } catch (error) {
      console.error('Error placing order:', error);
      setSnackbarMessage(t('orderFailed'));
      setSnackbarVisible(true);
    }
  };

  const handleCheckout = () => {
    if (!defaultMethod) {
      router.push(`/(main)/payment/methods?amount=${calculateTotal()}`);
    } else if (defaultMethod.type === 'cod') {
      placeOrder();
    } else {
      router.push('/(main)/checkout');
    }
  };

  const getButtonLabel = () => {
    if (!defaultMethod) {
      return t('addPaymentMethod');
    }
    if (defaultMethod.type === 'cod') {
      return t('placeOrder');
    }
    return t('proceedToCheckout');
  };

  if (loading) {
    return (
      <View style={[styles.container, getSafeAreaStyles(insets)]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, getSafeAreaStyles(insets)]}>
        <Text variant="headlineMedium">{t('emptyTitle')}</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {t('emptyMessage')}
        </Text>
        <View style={styles.emptyCartActions}>
          <Button 
            mode="contained"
            onPress={() => router.push('/(main)/screens/categories')}
            style={styles.browseButton}
          >
            {t('browseProducts')}
          </Button>
          <Button 
            mode="outlined"
            icon="phone"
            onPress={() => router.push('/(main)/phone-order')}
            style={styles.callButton}
          >
            {t('orderByCall')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getSafeAreaStyles(insets)]}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>{t('title')}</Text>
        {items.length > 0 && (
          <IconButton 
            icon="trash-can-outline"
            size={24}
            onPress={handleClearCart}
            disabled={clearingCart}
            style={styles.headerRight}
          />
        )}
      </View>

      <View style={styles.mainContent}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          overScrollMode="always"
        >
          {items.map((item) => (
            <Card key={item.uniqueId} style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <ProductImage
                   imageUrl={item.image_url}
                   style={styles.image}
                   resizeMode="cover"
                 />
                <View style={styles.itemDetails}>
                  <Text variant="bodySmall" style={styles.itemName}>{item?.name || 'Product'}</Text>
                  <View style={styles.priceRow}>
                    <Text variant="labelSmall">Rs. {item.price} {item.unit}</Text>
                    <Text variant="labelMedium" style={styles.itemTotal}>
                      Rs. {calculateItemTotal(item.price, item.quantity)}
                    </Text>
                  </View>
                  <View style={styles.quantityContainer}>
                    <IconButton 
                      icon="minus" 
                      size={14}
                      style={styles.quantityButton}
                      onPress={() => {
                        if (item.quantity > 1) {
                          updateQuantity(item.uniqueId!, item.quantity - 1);
                        } else {
                          removeItem(item.uniqueId!);
                        }
                      }}
                    />
                    <Text variant="labelMedium">{item.quantity}</Text>
                    <IconButton 
                      icon="plus" 
                      size={14}
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.uniqueId!, item.quantity + 1)}
                    />
                  </View>
                </View>
                <IconButton 
                  icon="delete" 
                  size={16}
                  style={styles.deleteButton}
                  onPress={() => removeItem(item.uniqueId!)}
                />
              </Card.Content>
            </Card>
          ))}
          
          <Card style={styles.totalItemsCard}>
            <Card.Content>
              <View style={styles.totalItemsRow}>
                <View style={styles.totalItemsLabelContainer}>
                  <IconButton 
                    icon="cart" 
                    size={20} 
                    style={styles.totalItemsIcon} 
                  />
                  <Text variant="titleSmall">{t('totalItems')}</Text>
                </View>
                <Chip
                  mode="outlined"
                  style={styles.totalItemsChip}
                  textStyle={styles.totalItemsChipText}
                >
                  {items.length}
                </Chip>
              </View>
            </Card.Content>
          </Card>
          
          <View style={styles.bottomPadding} />
        </ScrollView>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <View style={styles.compactSummarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('subtotal')}</Text>
                <Text style={styles.summaryValue}>₹{calculateSubtotal()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.deliveryFeeContainer}>
                  <Text style={styles.summaryLabel}>{t('deliveryFee')}</Text>
                  {locationLoading ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.summaryValue}>₹{deliveryDetails.fee}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.deliveryDetailsContainer}>
                <Chip 
                  icon="map-marker-distance" 
                  style={styles.deliveryChip}
                  textStyle={styles.chipText}
                  compact={true}
                  mode="outlined"
                >
                  {(() => {
                    const distanceValue = typeof deliveryDetails.distance === 'number' 
                      ? deliveryDetails.distance
                      : typeof deliveryDetails.distance === 'string'
                      ? parseFloat(deliveryDetails.distance)
                      : typeof deliveryDetails.distance === 'object' && deliveryDetails.distance !== null
                      ? (deliveryDetails.distance.distance || deliveryDetails.distance.value || 0)
                      : 0;
                    return (distanceValue || 0).toFixed(1);
                  })()} km
                </Chip>
                <Chip 
                  icon="truck-delivery" 
                  style={styles.deliveryChip}
                  textStyle={styles.chipText}
                  compact={true}
                  mode="outlined"
                >
                  {deliveryDetails.vehicleType}
                </Chip>
              </View>
            </View>
            
            <Divider style={styles.compactDivider} />
            
            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.totalLabel}>{t('total')}</Text>
              <Text variant="titleMedium" style={styles.totalValue}>₹{calculateTotal()}</Text>
            </View>

            {defaultMethod && (
              <View style={styles.paymentMethod}>
                <Text variant="bodySmall" style={styles.paymentLabel}>{t('payment')}: {defaultMethod?.title || 'Payment Method'}</Text>
                <Button 
                  mode="text" 
                  onPress={() => router.push('/(main)/payment/methods')}
                  style={styles.changeButton}
                  labelStyle={styles.changeButtonLabel}
                  compact
                >
                  {t('change')}
                </Button>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleCheckout}
              style={styles.checkoutButton}
              labelStyle={styles.checkoutButtonLabel}
              contentStyle={styles.checkoutButtonContent}
              disabled={items.length === 0 || locationLoading}
            >
              {getButtonLabel()}
            </Button>
          </Card.Content>
        </Card>
      </View>

      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={2500}
          style={styles.snackbar}
          wrapperStyle={styles.snackbarWrapper}
        >
          <Text style={{ color: 'white' }}>{snackbarMessage || 'Notification'}</Text>
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 0,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerRight: {
    width: 48,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 2,
    paddingBottom: 200,
  },
  card: {
    marginVertical: 1,
    marginHorizontal: 2,
    elevation: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    paddingVertical: 6,
  },
  image: {
    width: 35,
    height: 35,
    borderRadius: 4,
    marginRight: 4,
  },
  itemDetails: {
    flex: 1,
    marginRight: 0,
  },
  itemName: {
    fontSize: 12,
    marginBottom: 0,
    lineHeight: 16,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    height: 24,
  },
  quantityButton: {
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
  deleteButton: {
    margin: 0,
    padding: 0,
    width: 24,
    height: 24,
  },
  bottomPadding: {
    height: 140,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
    height: 16,
  },
  itemTotal: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryCard: {
    position: 'absolute',
    bottom: 85,
    left: 12,
    right: 12,
    elevation: 5,
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    zIndex: 5,
  },
  summaryContent: {
    padding: 10,
  },
  compactSummarySection: {
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#555',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  deliveryFeeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  deliveryDetailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  deliveryChip: {
    height: 26,
    margin: 0,
    paddingVertical: 0,
    paddingHorizontal: 2,
    minWidth: 70,
  },
  chipText: {
    fontSize: 10,
    marginVertical: 0,
    paddingVertical: 0,
    lineHeight: 15,
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  compactDivider: {
    marginVertical: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  paymentLabel: {
    fontSize: 12,
  },
  changeButton: {
    margin: 0,
    padding: 0,
  },
  changeButtonLabel: {
    fontSize: 12,
    margin: 0,
  },
  checkoutButton: {
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 8,
  },
  checkoutButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkoutButtonContent: {
    height: 40,
    paddingHorizontal: 8,
  },
  snackbar: {
    backgroundColor: '#4CAF50',  // Green color for success
  },
  snackbarWrapper: {
    bottom: 0,  // Position at bottom
    zIndex: 1000,  // Ensure it's above other content
  },
  totalItemsCard: {
    marginTop: 10,
    marginHorizontal: 10,
    elevation: 2,
    backgroundColor: '#f5f9ff',
    borderWidth: 1,
    borderColor: '#e0e0ff',
    marginBottom: 8,
  },
  totalItemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
  },
  totalItemsLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalItemsIcon: {
    marginRight: 4,
    margin: 0,
  },
  totalItemsChip: {
    backgroundColor: '#2196F3',
    marginLeft: 4,
  },
  totalItemsChipText: {
    color: '#fff',
  },
  emptyCartActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  browseButton: {
    flex: 1,
  },
  callButton: {
    flex: 1,
    marginLeft: 8,
  },
});