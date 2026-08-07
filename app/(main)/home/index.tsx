import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, BackHandler, Alert, AppState, AppStateStatus, Pressable, Animated, Easing } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { Header } from '../../../components/home/Header';
import { DynamicHomeSections } from '../../../components/home/DynamicHomeSections';
import { HomeComponentErrorBoundary } from '../../../components/home/HomeComponentErrorBoundary';
import { useAuthStore } from '../../../store/auth';
import { useLocationStore } from '../../../store/location';
import { supabase, refreshTokenInBackground } from '../../../services/supabase/supabase';
import ProductSearchService from '../../../services/productSearchService';
import * as Location from 'expo-location';
import { useInstantTranslation } from '../../../hooks/useInstantTranslation';
import { SimpleAuthLoader } from '../../../services/auth/SimpleAuthLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomNav } from '../../../contexts/BottomNavContext';

// Premium Color Palette
const COLORS = {
  primary: '#FF7D00', // Vibrant Orange
  primaryLight: '#FFF3E0', // Soft Orange for backgrounds
  secondary: '#1A1A1A', // Almost Black for text/headers
  text: '#333333',
  textLight: '#888888',
  white: '#FFFFFF',
  background: '#F8F9FA', // Cool White/Grey for overall background
  cardBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  border: '#E5E7EB',
};

// Declare global variable for revalidation cooldown tracking
// This persists across component remounts to prevent rapid revalidation loops
declare global {
  var __homeLastRevalidationTime: number | undefined;
}

// Original texts for translation - defined outside component for stability
const ORIGINAL_TEXTS = {
  loading: "Loading...",
  nearbyWholesalers: "Nearby Wholesalers",
  nearbyManufacturers: "Nearby Manufacturers",
  browseCategoriesProducts: "Browse Categories & Products"
};

/**
 * Home Screen - Simplified to use cached profile synchronously
 * 
 * Requirements: 2.1, 2.2
 * - Profile data is available synchronously from auth store
 * - No async profile loading on mount - SimpleAuthLoader handles this
 * - Profile should already be in store before this component mounts
 */
export default function Home() {
  const router = useRouter();
  // Profile is available synchronously from auth store (Requirements 2.1, 2.2)
  // SimpleAuthLoader loads profile into store before navigating to main screen
  const user = useAuthStore((state) => state.user);
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [isTrackerVisible, setIsTrackerVisible] = useState(false);
  const { userLocation, distanceFilter } = useLocationStore();
  const { hide: hideBottomNav, show: showBottomNav, isVisible: isBottomNavVisible } = useBottomNav();

  // Animation hooks - MUST be declared before any useEffects that use them (React Rules of Hooks)
  // Header height: paddingTop(12) + avatar(40) + marginBottom(16) + searchBar(50) + paddingBottom(8) = 126px
  const HEADER_HEIGHT = 126;

  // Animation for Header hiding/showing
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollYClamped = Animated.diffClamp(scrollY, 0, HEADER_HEIGHT);
  const previousScrollY = useRef(0);
  const lastAnimationTime = useRef(0);

  // Animation for browse button position based on tracker visibility
  const buttonBottomPosition = useRef(new Animated.Value(115)).current;
  const isInitialMount = useRef(true);

  // Animate bottom safe area padding to hide with bottom nav
  // Track bottom nav visibility state
  const bottomNavVisible = useRef(new Animated.Value(1)).current;

  // Listen for tracker visibility changes from BottomNav
  useEffect(() => {
    // Store callback in global so BottomNav can access it
    (global as any).__homeTrackerVisibilityCallback = setIsTrackerVisible;
    return () => {
      delete (global as any).__homeTrackerVisibilityCallback;
    };
  }, []);

  // Animate button position based on tracker visibility and bottom nav visibility
  useEffect(() => {
    // Button should be up when: tracker exists AND is visible AND bottom nav is visible
    // Button should be down when: tracker doesn't exist OR tracker is hidden OR bottom nav is hidden
    const shouldMoveUp = hasActiveOrders && isTrackerVisible && isBottomNavVisible;
    const targetValue = shouldMoveUp ? 140 : 115;

    if (isInitialMount.current) {
      // Skip animation on initial mount - just set the value directly
      buttonBottomPosition.setValue(targetValue);
      isInitialMount.current = false;
    } else {
      // Animate on subsequent changes
      Animated.timing(buttonBottomPosition, {
        toValue: targetValue,
        duration: 200,
        useNativeDriver: false, // bottom position can't use native driver
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [hasActiveOrders, isTrackerVisible, isBottomNavVisible, buttonBottomPosition]);

  // Sync isTrackerVisible with hasActiveOrders as a fallback
  // This ensures consistent button positioning when navigating back to home
  useEffect(() => {
    if (hasActiveOrders && !isTrackerVisible) {
      // If we know there are active orders, assume tracker should be visible
      // This prevents the button from jumping when the tracker notification is delayed
      setIsTrackerVisible(true);
    }
  }, [hasActiveOrders]);

  // Check for active orders to adjust browse button position
  useEffect(() => {
    if (!user?.id) {
      setHasActiveOrders(false);
      return;
    }

    const checkActiveOrders = async () => {
      try {
        const ACTIVE_STATUSES = ['pending', 'confirmed', 'accepted', 'processing', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'];
        const { data, error } = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ACTIVE_STATUSES)
          .limit(1);

        if (!error && data && data.length > 0) {
          setHasActiveOrders(true);
        } else {
          setHasActiveOrders(false);
        }
      } catch (error) {
        console.error('Error checking active orders:', error);
        setHasActiveOrders(false);
      }
    };

    checkActiveOrders();

    // Subscribe to order changes
    const subscription = supabase
      .channel('home_active_orders_check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          checkActiveOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });

  // Track app state for background revalidation (Requirements 4.5)
  const appState = useRef(AppState.currentState);
  const [isRevalidating, setIsRevalidating] = useState(false);

  // Use instant translation hook - provides cached translations immediately
  // No blocking on API calls during startup
  const { t: translations } = useInstantTranslation(ORIGINAL_TEXTS);

  // Animate bottomNavVisible when visibility changes (ref was declared earlier with other hooks)
  useEffect(() => {
    Animated.timing(bottomNavVisible, {
      toValue: isBottomNavVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // padding can't use native driver
    }).start();
  }, [isBottomNavVisible, bottomNavVisible]);

  // Handle enhanced voice search results with automatic language detection
  const handleEnhancedVoiceSearchResult = async (query: string, detectedLanguage: string, intent?: string, entities?: any) => {
    console.log('Voice search result:', { query, detectedLanguage, intent, entities });

    // Handle different intents
    if (intent === 'navigate' && entities?.target) {
      // Handle navigation commands
      const target = entities.target.toLowerCase();
      if (target.includes('cart')) {
        router.push('/cart');
      } else if (target.includes('profile')) {
        router.push('/profile');
      } else if (target.includes('orders')) {
        router.push('/orders');
      } else if (target.includes('categories') || target.includes('category')) {
        router.push('/screens/categories');
      }
    } else {
      // Use ProductSearchService for better search results
      try {
        const searchResults = await ProductSearchService.searchProducts({
          query,
          language: detectedLanguage,
          intent: intent as 'search' | 'order' | 'navigate',
          limit: 20,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter
        });

        console.log('Product search results:', searchResults);

        // If we found products, navigate to search results
        if (searchResults.products.length > 0) {
          const searchParams = new URLSearchParams({
            query: query,
            language: detectedLanguage,
            intent: intent || 'search',
            resultsCount: searchResults.totalCount.toString()
          });
          router.push(`/screens/search?${searchParams.toString()}`);
        } else {
          // Fallback to categories page
          const categoryParams = new URLSearchParams({
            search: query,
            language: detectedLanguage,
            intent: intent || 'search'
          });
          router.push(`/screens/categories?${categoryParams.toString()}`);
        }
      } catch (error) {
        console.error('Error in voice search:', error);
        // Fallback to categories page
        const fallbackParams = new URLSearchParams({
          search: query,
          language: detectedLanguage,
          intent: intent || 'search'
        });
        router.push(`/screens/categories?${fallbackParams.toString()}`);
      }
    }
  };

  // Handle enhanced voice order results
  const handleEnhancedVoiceOrderResult = async (productName: string, quantity?: number, detectedLanguage?: string) => {
    console.log('Voice order result:', { productName, quantity, detectedLanguage });

    try {
      // First, try to find the exact product
      const product = await ProductSearchService.findProductForOrder(productName);

      if (product && user?.id) {
        // Product found, try to add to cart automatically
        const success = await ProductSearchService.addToCartViaVoice(
          user.id,
          product.id,
          quantity || 1
        );

        if (success) {
          // Show success message and navigate to cart
          Alert.alert(
            'Added to Cart',
            `${product?.name || 'Product'} (${quantity || 1} item${(quantity || 1) > 1 ? 's' : ''}) has been added to your cart.`,
            [
              { text: 'Continue Shopping', style: 'cancel' },
              { text: 'View Cart', onPress: () => router.push('/cart') }
            ]
          );
        } else {
          // Failed to add to cart, navigate to product page
          router.push(`/products/${product.id}`);
        }
      } else {
        // Product not found, search for similar products
        const searchResults = await ProductSearchService.searchProducts({
          query: productName,
          language: detectedLanguage || 'en-US',
          intent: 'order',
          limit: 10,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter
        });

        if (searchResults.products.length > 0) {
          // Navigate to search results with order intent
          const orderParams = new URLSearchParams({
            query: productName,
            autoOrder: 'true',
            quantity: quantity?.toString() || '1',
            language: detectedLanguage || 'en-US',
            intent: 'order'
          });
          router.push(`/screens/search?${orderParams.toString()}`);
        } else {
          // No products found, show message and navigate to categories
          Alert.alert(
            'Product Not Found',
            `Sorry, we couldn't find "${productName}". Please browse our categories or try a different search.`,
            [{ text: 'OK', onPress: () => router.push('/screens/categories') }]
          );
        }
      }
    } catch (error) {
      console.error('Error in voice order:', error);
      // Fallback to categories search
      const fallbackOrderParams = new URLSearchParams({
        search: productName,
        autoOrder: 'true',
        quantity: quantity?.toString() || '1',
        language: detectedLanguage || 'en-US'
      });
      router.push(`/screens/categories?${fallbackOrderParams.toString()}`);
    }
  };

  const handleOCRSearchResult = (query: string, language: string, translatedQuery?: string, originalText?: string) => {
    console.log('OCR search result:', { query, language, translatedQuery, originalText });

    // Use ProductSearchService for enhanced multilingual OCR search
    const performOCRSearch = async () => {
      try {
        // Determine the best search query to use
        const searchQuery = translatedQuery && language !== 'en' ? translatedQuery : query;

        const searchResults = await ProductSearchService.searchProducts({
          query: searchQuery,
          language: language,
          intent: 'search',
          limit: 20,
          userLatitude: userLocation?.latitude,
          userLongitude: userLocation?.longitude,
          radiusKm: distanceFilter,
          userLanguage: language,
          translatedQuery: translatedQuery
        });

        console.log('OCR search results:', searchResults);

        // Navigate to search screen with enhanced parameters
        const ocrParams = new URLSearchParams({
          query: searchQuery,
          originalQuery: originalText || query,
          translatedQuery: translatedQuery || '',
          language: language,
          source: 'ocr',
          resultsCount: searchResults.totalCount.toString()
        });
        router.push(`/screens/search?${ocrParams.toString()}`);
      } catch (error) {
        console.error('Error in OCR search:', error);
        // Fallback to simple search navigation
        const fallbackOcrParams = new URLSearchParams({
          query: query,
          originalQuery: originalText || query,
          translatedQuery: translatedQuery || '',
          language: language,
          source: 'ocr'
        });
        router.push(`/screens/search?${fallbackOcrParams.toString()}`);
      }
    };

    performOCRSearch();
  };



  // Simple initialization: Just fetch location in background
  // Profile is already available synchronously from SimpleAuthLoader (Requirements 2.1, 2.2)
  useEffect(() => {
    // Start location fetch in background (non-blocking)
    // Profile is already in store - no need to load it
    console.log('[Home] Starting location fetch (profile already available)');
    getUserLocation().catch(err => {
      console.warn('[Home] Location loading failed (non-critical):', err);
    });
  }, []); // Only run once on mount

  // Handle back button navigation on home screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Only show exit dialog if this is the root screen
      // Check if we can go back in the navigation stack
      if (router.canGoBack && router.canGoBack()) {
        // If we can go back, let the default navigation handle it
        return false;
      } else {
        // If we can't go back (this is the root), show exit confirmation
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
          ],
          { cancelable: true }
        );
        return true;
      }
    });

    return () => backHandler.remove();
  }, [router]);

  /**
   * Background revalidation on app resume (Requirements 4.5)
   * Property 11: Background revalidation on app resume
   * 
   * When the app resumes from background, trigger a background revalidation
   * of cached data without showing loading states to the user.
   */
  // Use a module-level variable to persist across component remounts
  // This fixes the bug where cooldown was reset on remount
  const REVALIDATION_COOLDOWN = 60000; // 1 minute cooldown between revalidations

  useEffect(() => {
    // Initialize lastRevalidationTime from module-level storage
    // This persists across component remounts
    if (!globalThis.__homeLastRevalidationTime) {
      globalThis.__homeLastRevalidationTime = 0;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Detect transition from background/inactive to active (app resume)
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Check cooldown to prevent rapid revalidation loops
        const now = Date.now();
        const lastRevalidation = globalThis.__homeLastRevalidationTime || 0;
        const timeSinceLastRevalidation = now - lastRevalidation;

        if (timeSinceLastRevalidation < REVALIDATION_COOLDOWN) {
          console.log(`[Home] Skipping revalidation - cooldown active (${Math.round(timeSinceLastRevalidation / 1000)}s since last)`);
          appState.current = nextAppState;
          return;
        }

        // Only revalidate if we have a user and not already revalidating
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.id && !isRevalidating) {
          console.log('[Home] App resumed from background, triggering background revalidation');
          globalThis.__homeLastRevalidationTime = now;
          setIsRevalidating(true);

          try {
            // Trigger background revalidation without showing loading states
            await revalidateDataInBackground(currentUser.id);
          } catch (error) {
            console.warn('[Home] Background revalidation failed (non-critical):', error);
          } finally {
            setIsRevalidating(false);
          }
        }
      }

      appState.current = nextAppState;
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isRevalidating]); // Removed user?.id from dependencies to prevent re-subscription on user updates

  /**
   * Revalidate cached data in background without showing loading states
   * This function is called when the app resumes from background
   * Uses SimpleAuthLoader for background validation (Requirements 3.1, 3.3)
   */
  const revalidateDataInBackground = async (userId: string): Promise<void> => {
    console.log('[Home] Starting background revalidation for user:', userId);

    try {
      // CRITICAL: Refresh the token in background to ensure Supabase queries work
      // This prevents auth failures when the app has been in background for a while
      const tokenRefreshed = await refreshTokenInBackground();
      console.log('[Home] Token refresh result:', tokenRefreshed);

      // Use SimpleAuthLoader's background validation
      // This validates session and refreshes profile without blocking UI
      SimpleAuthLoader.validateSessionInBackground();
      console.log('[Home] Background revalidation triggered');

      // Note: Don't call getUserLocation() here to avoid triggering re-renders
      // Location is already fetched on initial mount

    } catch (error) {
      console.warn('[Home] Background revalidation error:', error);
      // Don't throw - background revalidation failures are non-critical
    }
  };

  // Function to get user location and update it in the database
  // This function is non-blocking and runs in parallel with user loading
  // IMPORTANT: For retailers, only update location if shop location was not set during KYC
  const getUserLocation = async () => {
    try {
      // For retailers: Check if shop location was already set during KYC
      // If location_address exists, it means shop location was set and shouldn't be auto-updated
      if (user?.role === 'retailer' && user?.location_address) {
        console.log('Retailer shop location already set during KYC, skipping auto-update');
        // Still update location store for distance filtering, but don't update database
        if (user.latitude && user.longitude) {
          const { setUserLocation, setLocationAddress } = useLocationStore.getState();
          setUserLocation({
            latitude: Number(user.latitude),
            longitude: Number(user.longitude)
          });
          setLocationAddress(user.location_address);
        }
        return;
      }

      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      console.log('Getting current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      console.log('Location obtained:', location.coords);

      // Update the location store immediately with coordinates
      // This allows components to start using location data right away
      const { setUserLocation, setLocationAddress } = useLocationStore.getState();
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // Perform reverse geocoding in parallel (non-blocking)
      const geocodePromise = Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }).then(addressResults => {
        const addr = addressResults && addressResults.length > 0 ? addressResults[0] : null;
        const formattedAddress = [
          addr?.name,
          addr?.street,
          addr?.city,
          addr?.region,
          addr?.country
        ].filter(Boolean).join(', ') || 'Location detected';
        console.log('Reverse geocoded address:', formattedAddress);
        setLocationAddress(formattedAddress);
        return formattedAddress;
      }).catch(geocodeError => {
        console.error('Error reverse geocoding in Home:', geocodeError);
        const fallbackAddress = 'Location detected';
        setLocationAddress(fallbackAddress);
        return fallbackAddress;
      });

      if (user?.id) {
        // Skip SQL function creation - execute_sql_admin doesn't exist
        // Just use direct update which is faster and more reliable

        // Wait for geocoding to complete before database update
        const formattedAddress = await geocodePromise;

        // Only update database if user is not a retailer OR retailer doesn't have location_address set
        // (meaning shop location wasn't set during KYC)
        const shouldUpdateDb = user.role !== 'retailer' || !user.location_address;

        if (shouldUpdateDb) {
          // Direct update (simpler and faster)
          console.log('Updating user location in database...');
          const { data: directResult, error: directError } = await supabase
            .from('profiles')
            .update({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              location_address: formattedAddress
            })
            .eq('id', user.id)
            .select();

          if (directError) {
            console.error('Error updating location in database:', directError);
          } else {
            console.log('Location updated successfully in database');

            // Update the user in the store with the new location
            if (directResult && directResult.length > 0) {
              useAuthStore.getState().setUser(directResult[0]);
            }
          }
        } else {
          console.log('Skipping database update - retailer shop location already set');
        }
      }
    } catch (error) {
      console.error('Error getting or updating location:', error);
      // Don't throw - location is optional, app should still work
    }
  };

  // Handle scroll for bottom nav and active order tracker visibility
  // MUST be declared before early return to follow React Rules of Hooks
  const handleScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - previousScrollY.current;
    const now = Date.now();

    // Throttle animation triggers to max once per 100ms
    if (now - lastAnimationTime.current < 100) {
      previousScrollY.current = currentScrollY;
      return;
    }

    // Only trigger if scrolled more than 10px to avoid jitter
    if (Math.abs(scrollDifference) > 10) {
      if (scrollDifference > 0 && currentScrollY > 50) {
        // Scrolling DOWN - Hide bottom navigation (and active order tracker)
        hideBottomNav();
        lastAnimationTime.current = now;
      } else if (scrollDifference < 0) {
        // Scrolling UP - Show bottom navigation (and active order tracker)
        showBottomNav();
        lastAnimationTime.current = now;
      }
      previousScrollY.current = currentScrollY;
    }
  }, [hideBottomNav, showBottomNav]);

  // Handle retry - redirect to language screen for re-authentication
  const handleRetry = () => {
    router.replace('/(auth)/language');
  };

  // Profile should be available synchronously from SimpleAuthLoader (Requirements 2.1, 2.2)
  // If no user, show error with option to re-authenticate
  // This should rarely happen since SimpleAuthLoader ensures profile is loaded before navigation
  if (!user) {
    console.warn('[Home] No user in store - this should not happen with SimpleAuthLoader');
    return (
      <View style={[styles.safeAreaContainer, getSafeAreaStyles(insets)]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Unable to load user profile</Text>
          <Text style={styles.errorSubtext}>Please sign in again</Text>
          <Button
            mode="contained"
            onPress={handleRetry}
            style={styles.retryButton}
          >
            Sign In
          </Button>
        </View>
      </View>
    );
  }

  // Derived animation values (using refs declared earlier - before early return)
  const headerTranslateY = scrollYClamped.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  // Animate safe area top spacing to hide with header
  // Using transform translateY which supports native driver
  const safeAreaTopTranslate = scrollYClamped.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -insets.top],
    extrapolate: 'clamp',
  });

  const safeAreaBottomPadding = bottomNavVisible.interpolate({
    inputRange: [0, 1],
    outputRange: [0, insets.bottom],
    extrapolate: 'clamp',
  });


  // User is available synchronously - render the home screen
  return (
    <View
      style={[
        styles.safeAreaContainer,
        {
          // NOTE: paddingTop is already applied by parent _layout.tsx via getSafeAreaStyles
          // Only apply horizontal padding here to avoid double top padding
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }
      ]}
    >
      <Animated.View
        style={[
          styles.gradientContainer,
          {
            transform: [{ translateY: safeAreaTopTranslate }],
          }
        ]}
      >
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.white, COLORS.background]}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SystemStatusBar style="dark" />

        <Animated.View style={[
          styles.headerAnimContainer,
          { transform: [{ translateY: headerTranslateY }] }
        ]}>
          <Header
            user={user}
            onVoiceSearchResult={handleEnhancedVoiceSearchResult}
            onVoiceOrderResult={handleEnhancedVoiceOrderResult}
            onOCRSearchResult={handleOCRSearchResult}
          />
        </Animated.View>

        <Animated.ScrollView
          style={styles.scrollSection}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 16 }]}
          removeClippedSubviews={true}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: true,
              listener: handleScroll
            }
          )}
        >
          {/* Dynamic Home Sections - shows products, categories, banners, nearby sellers, etc. */}
          {/* Note: NearbyWholesalers and NearbyManufacturers are rendered inside DynamicHomeSections */}
          {/* to avoid duplicate rendering. Do NOT add them separately here. */}
          {/* Wrapped with error boundary for graceful degradation (Requirements 4.3) */}
          <HomeComponentErrorBoundary
            componentName="Dynamic Sections"
            fallbackMessage="Unable to load personalized content. Please try again."
          >
            <DynamicHomeSections userId={user.id} />
          </HomeComponentErrorBoundary>

          {/* Add padding at bottom for the fixed button */}
          <View style={styles.bottomPadding} />
        </Animated.ScrollView>


        {/* Premium Liquid Glass Browse Button */}
        <Animated.View style={[
          styles.fixedButtonContainer,
          { bottom: buttonBottomPosition }
        ]}>
          <Pressable
            onPress={() => router.push('/(main)/screens/categories')}
            style={styles.glassPressable}
          >
            <LinearGradient
              colors={['rgba(255, 125, 0, 0.25)', 'rgba(255, 125, 0, 0.15)', 'rgba(255, 87, 34, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glassGradient}
            >
              {/* Inner glow effect */}
              <View style={styles.glassInner}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.glassHighlight}
                />
                {/* Top Lens Refraction Effect */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.topLensEffect}
                />

                {/* Bottom Lens Refraction Effect */}
                <LinearGradient
                  colors={['rgba(255, 125, 0, 0)', 'rgba(255, 125, 0, 0.25)', 'rgba(255, 87, 34, 0.5)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.bottomLensEffect}
                />
                <View style={styles.buttonContentContainer}>
                  <IconButton
                    icon="view-grid"
                    size={16}
                    iconColor="#424242"
                    style={styles.glassIcon}
                  />
                  <Text style={styles.glassButtonText}>
                    {translations.browseCategoriesProducts}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={{
          height: safeAreaBottomPadding,
        }}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
  },
  scrollSection: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    color: COLORS.secondary,
  },
  bottomPadding: {
    height: 160,
  },
  headerAnimContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: COLORS.primaryLight, // Ensure solid background to hide scrolling content
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 115,
    alignSelf: 'center', // Center horizontally
    zIndex: 999,
    alignItems: 'center',
  },
  fixedButtonContainerWithOrders: {
    bottom: 150, // Move up when active orders are present, closer to the tracker
  },
  // Advanced Thick Glass Edge Button Styles
  glassPressable: {
    // width: '100%', // Removed to allow auto width
    // maxWidth: 400, // Removed max width constraint
    borderRadius: 30,
    overflow: 'hidden',
  },
  // Thick glass outer border
  thickGlassBorder: {
    borderRadius: 30,
    padding: 6, // Thick border width
    overflow: 'hidden',
  },
  // Glass bevel layer
  glassBevel: {
    borderRadius: 24,
    padding: 3,
    overflow: 'hidden',
  },
  // Blur container
  blurContainer: {
    borderRadius: 21,
    overflow: 'hidden',
    position: 'relative',
  },
  // Top lens refraction effect - More visible
  topLensEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%', // Larger area
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
    zIndex: 1,
  },
  // Bottom lens refraction effect - More visible
  bottomLensEffect: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%', // Larger area
    borderBottomLeftRadius: 21,
    borderBottomRightRadius: 21,
    zIndex: 1,
  },
  glassGradient: {
    borderRadius: 28,
    padding: 2,
    overflow: 'hidden',
  },
  glassInner: {
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  buttonContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    backgroundColor: 'rgba(255, 245, 235, 0.35)', // Orange-tinted frosted glass
    borderWidth: 2,
    borderColor: 'rgba(255, 200, 150, 0.6)', // Orange glass edge
    borderRadius: 21,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 2, // Above lens effects
  },
  glassIcon: {
    margin: 0,
    marginRight: 8,
  },
  glassButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#424242', // Dark grey text
    letterSpacing: 0.6,
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  card: {
    width: 200,
    marginRight: 12,
    marginVertical: 8,
  },
  cardImage: {
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterChip: {
    marginRight: 8,
  },
  distance: {
    marginTop: 4,
    color: COLORS.textLight,
  },
});