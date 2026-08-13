import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { BottomNav } from '../../components/navigation/BottomNav';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth';
import { useWishlistStore } from '../../store/wishlist';
import { ActivityIndicator, Text } from 'react-native-paper';
import { supabase } from '../../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEdgeToEdge, getSafeAreaStyles } from '../../utils/android15EdgeToEdge';
import { BottomNavProvider, useBottomNav } from '../../contexts/BottomNavContext';
import { supabaseConfig, supabaseAuthStorageKey } from '../../config/secrets';

// Define Stack type
type StackType = React.ComponentType<{
  screenOptions?: {
    headerShown?: boolean;
    gestureEnabled?: boolean;
    animation?: string;
    title?: string;
    headerTitle?: string;
  };
}>;

// Try to import Stack dynamically to avoid linter errors
let Stack: StackType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Stack = require('expo-router').Stack as StackType;
} catch (error) {
  console.error('Error importing Stack:', error);
}

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const loadWishlist = useWishlistStore((state) => state.loadWishlist);
  const [sellerDetails, setSellerDetails] = useState<undefined | null | 'error'>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [kycChecked, setKycChecked] = useState(false);
  const [isFetchingSellerDetails, setIsFetchingSellerDetails] = useState(false);
  const [sellerDetailsFetchError, setSellerDetailsFetchError] = useState<string | null>(null);
  const [sessionWaitStarted, setSessionWaitStarted] = useState<number | null>(null);

  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  const bottomNavHeight = 60 + insets.bottom;

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isLoading || user) return;

        console.log('Checking authentication in MainLayout');

        let authVerified: string | null = null;
        let profileId: string | null = null;

        try {
          [authVerified, profileId] = await Promise.all([
            AsyncStorage.getItem('auth_verified'),
            AsyncStorage.getItem('profile_id')
          ]);
        } catch (storageError) {
          console.error('Error reading from AsyncStorage in MainLayout:', storageError);
        }

        let userId: string | null = null;
        if (authVerified === 'true' && profileId) {
          userId = profileId;
        } else if (session?.user?.id) {
          userId = session.user.id;
        }

        if (userId && !user) {
          console.log('Getting user data for ID:', userId);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (profileData) {
            console.log('Found profile data, setting user in store');
            useAuthStore.getState().setUser(profileData);
            return;
          }
        }

        if (!user && !session && authVerified !== 'true') {
          console.log('No auth found, redirecting to language selection');
          router.replace('/(auth)/language');
          return;
        }
      } catch (error) {
        console.error('Error in auth check:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!user) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Check seller details function
  const checkSellerDetails = async () => {
    setIsFetchingSellerDetails(true);

    try {
      if (__DEV__) console.log('Checking seller details for user ID:', user?.id);

      if (!user?.id) {
        if (__DEV__) console.error('No valid user ID available for seller details check');
        setIsFetchingSellerDetails(false);
        router.replace('/(auth)/login');
        return;
      }

      // FIRST: Check if seller_details is already in the user object from auth store
      // This avoids database fetches and timeout issues
      if (user.seller_details) {
        console.log('Using seller_details from user object (from auth store)');
        const { business_name, owner_name, gst_number } = user.seller_details;
        const isComplete = business_name && owner_name && gst_number;

        if (isComplete) {
          console.log('Seller details from user object are complete');
          setSellerDetails(user.seller_details);
          setIsFetchingSellerDetails(false);
          return;
        } else {
          console.log('Seller details from user object are incomplete');
          setSellerDetails(null);
          setIsFetchingSellerDetails(false);
          return;
        }
      }

      console.log('No seller_details in user object, fetching from Supabase...');
      const fetchStartTime = Date.now();

      // Try Supabase client first, but with a short timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Seller details fetch timeout')), 5000);
      });

      try {
        const fetchPromise = supabase
          .from('seller_details')
          .select('*')
          .eq('user_id', user.id)
          .single();

        const result: any = await Promise.race([fetchPromise, timeoutPromise]);
        console.log('Fetch completed in', Date.now() - fetchStartTime, 'ms');

        const { data, error } = result;

        if (error) {
          // PGRST116 means no rows found - this is expected for new sellers
          if (error.code === 'PGRST116') {
            console.log('No seller details found for user ID:', user.id, '(this is expected for new sellers)');
            setSellerDetailsFetchError(null);
            setSellerDetails(null);
          } else {
            console.error('Database error during seller details check:', error);
            setSellerDetailsFetchError(error.message || 'Database error');
            setSellerDetails('error');
          }
        } else {
          console.log('Seller details found:', data ? 'Yes' : 'No');

          if (data) {
            const { business_name, owner_name, gst_number } = data;

            const isComplete =
              business_name &&
              business_name.trim() !== '' &&
              owner_name &&
              owner_name.trim() !== '' &&
              gst_number && String(gst_number).trim() !== '';

            console.log('Required seller fields check:', {
              business_name: !!business_name,
              owner_name: !!owner_name,
              gst_number: !!gst_number,
              isComplete
            });

            if (!isComplete) {
              console.log('Seller has incomplete details');
              setSellerDetails(null);
              return;
            }

            console.log('Seller details are complete, setting details');
            setSellerDetails(data);
            return;
          }

          setSellerDetails(data);
        }
      } catch (fetchError) {
        console.error('Supabase fetch failed, trying direct fetch with access token:', fetchError);

        // Fallback: Try direct fetch with access token from AsyncStorage (more reliable than session state)
        try {
          const authKey = supabaseAuthStorageKey;
          const sessionStr = await AsyncStorage.getItem(authKey);

          if (sessionStr) {
            const sessionData = JSON.parse(sessionStr);
            const accessToken = sessionData?.access_token;

            if (accessToken) {
              console.log('Using direct fetch with access token from AsyncStorage...');
              console.log('DEBUG: Access token starts with:', accessToken.substring(0, 50));

              const response = await fetch(
                `${supabaseConfig.url}/rest/v1/seller_details?user_id=eq.${user.id}&select=*`,
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
                const data = dataArr[0]; // single() returns first item

                if (data) {
                  console.log('Direct fetch successful, seller details found');
                  const { business_name, owner_name, gst_number } = data;
                  const isComplete = business_name && owner_name && gst_number;

                  if (isComplete) {
                    setSellerDetails(data);

                    // Also update the user object with seller_details for future use
                    if (user && !user.seller_details) {
                      useAuthStore.getState().setUser({ ...user, seller_details: data });
                    }
                    return;
                  }
                }

                console.log('No seller details found via direct fetch');
                setSellerDetails(null);
              } else {
                console.error('Direct fetch failed:', response.status);
                setSellerDetailsFetchError('Failed to load profile');
                setSellerDetails('error');
              }
            } else {
              console.error('No access token in stored session');
              setSellerDetailsFetchError('Session not available');
              setSellerDetails('error');
            }
          } else {
            console.error('No session found in AsyncStorage');
            setSellerDetailsFetchError('Session not available');
            setSellerDetails('error');
          }
        } catch (directFetchErr) {
          console.error('Direct fetch error:', directFetchErr);
          setSellerDetailsFetchError('Connection error');
          setSellerDetails('error');
        }
      }
    } catch (error) {
      console.error('Exception checking seller details:', error);
      setSellerDetailsFetchError((error as Error).message || 'Connection error');
      setSellerDetails('error');
    } finally {
      setIsFetchingSellerDetails(false);
    }
  };

  // Session wait timeout effect - triggers re-render after 10s to proceed with fetch
  useEffect(() => {
    if (user?.role === 'seller' && !session && sessionWaitStarted) {
      const timeoutId = setTimeout(() => {
        console.log('MainLayout: Session wait timeout triggered, forcing re-render');
        // Force re-render by updating a dummy state
        setSessionWaitStarted(prev => prev ? prev + 1 : Date.now());
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
  }, [user?.role, session, sessionWaitStarted]);

  // User role-based routing
  useEffect(() => {
    console.log('MainLayout: Routing effect triggered', {
      hasUser: !!user,
      hasSession: !!session,
      isLoading,
      userRole: user?.role,
      kycChecked
    });

    if (kycChecked) {
      console.log('MainLayout: KYC already checked, skipping routing');
      return;
    }

    if (!user || isLoading) {
      console.log('MainLayout: Skipping routing - user or isLoading not ready');
      return;
    }

    // CRITICAL: Wait for Supabase session before making authenticated requests
    // The session is restored by onAuthStateChange from the Supabase client
    // Without a session, RLS-protected queries like seller_details will fail
    if (user.role === 'seller' && !session) {
      // Track when we started waiting for session
      if (!sessionWaitStarted) {
        setSessionWaitStarted(Date.now());
        console.log('MainLayout: Started waiting for Supabase session...');
      }

      // Fallback: If session doesn't arrive within 10 seconds, try fetching anyway
      // The Supabase client might have a session internally even if our store doesn't
      const waitTime = sessionWaitStarted ? Date.now() - sessionWaitStarted : 0;
      if (waitTime < 10000) {
        console.log('MainLayout: Waiting for Supabase session...', { waitTime });
        return; // Will re-run when session becomes available
      } else {
        console.log('MainLayout: Session wait timeout, proceeding with fetch anyway');
      }
    }

    const handleUserRouting = async () => {
      try {
        if (user.role === 'seller') {
          console.log('Seller detected, checking details and routing...', {
            sellerDetails: sellerDetails === undefined ? 'undefined' : (sellerDetails === 'error' ? 'error' : (sellerDetails ? 'has data' : 'null')),
            isFetchingSellerDetails
          });

          if (sellerDetails === undefined && !isFetchingSellerDetails) {
            console.log('Seller details undefined, fetching...');
            await checkSellerDetails();
            return;
          } else if (sellerDetails === undefined && isFetchingSellerDetails) {
            console.log('Seller details fetch already in progress, waiting...');
            return;
          } else if (sellerDetails === 'error') {
            console.log('Seller details fetch failed with network error, showing error screen');
            return;
          } else if (sellerDetails === null) {
            console.log('Seller without details (confirmed), redirecting to KYC');
            router.replace('/(auth)/seller-kyc');
            return;
          } else {
            console.log('Seller KYC validated, allowing access', { pathname });
            setKycChecked(true);

            const isOnWholesalerScreen = pathname.includes('wholesaler');
            if (!isOnWholesalerScreen) {
              console.log('Seller with valid details, redirecting to wholesaler home');
              router.replace('/(main)/wholesaler');
            } else {
              console.log('Already on wholesaler screen, no redirect needed');
            }
            return;
          }
        }

        if (user.role === 'retailer') {
          console.log('Detected retailer user, checking business details...');

          const { data: fullProfile, error: profileError } = await supabase
            .from('profiles')
            .select('business_details, status')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching full profile:', profileError);
            router.replace('/(auth)/retailer-kyc');
            return;
          }

          const businessDetails = fullProfile?.business_details || {};
          const hasRequiredFields =
            businessDetails &&
            typeof businessDetails === 'object' &&
            Object.keys(businessDetails).length > 0 &&
            businessDetails.shopName &&
            businessDetails.ownerName &&
            businessDetails.address;

          if (!hasRequiredFields) {
            console.log('Retailer without business details, redirecting to KYC');
            router.replace('/(auth)/retailer-kyc');
            return;
          } else {
            console.log('Retailer KYC validated, staying on main screen');
            setKycChecked(true);
            try {
              await loadWishlist();
              console.log('Wishlist loaded successfully in MainLayout');
            } catch (err) {
              console.error('Error loading wishlist in MainLayout:', err);
            }
          }
        } else {
          console.warn('Unknown user role:', user.role);
          setKycChecked(true);
        }
      } catch (error) {
        console.error('Error in user routing:', error);
        setKycChecked(true);
      }
    };

    handleUserRouting();
  }, [user?.id, user?.role, session, sellerDetails, isLoading, kycChecked, isFetchingSellerDetails]);

  // Retry function for seller details fetch
  const retrySellerDetailsFetch = () => {
    setSellerDetails(undefined);
    setSellerDetailsFetchError(null);
    setIsFetchingSellerDetails(false);
  };

  // Show error screen for network errors
  if (user?.role === 'seller' && sellerDetails === 'error') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>
          {sellerDetailsFetchError || 'Unable to load your profile. Please check your internet connection.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={retrySellerDetailsFetch}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading state
  if (isLoading || (!kycChecked && user)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>{isLoading ? 'Loading...' : 'Verifying profile...'}</Text>
      </View>
    );
  }

  // If Stack is not available, use a simple container
  if (!Stack) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.container, getSafeAreaStyles(insets)]}>
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
            <BottomNav />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Return main layout
  return (
    <BottomNavProvider>
      <MainLayoutContent insets={insets} user={user} pathname={pathname} />
    </BottomNavProvider>
  );
}

function MainLayoutContent({ insets, user, pathname }: { insets: any; user: any; pathname: string }) {
  const { isVisible } = useBottomNav();

  const shouldApplyTopPadding = (currentPath: string) => {
    const fullScreenPaths = [
      '/screens/product/',
      '/screens/categories',
      '/screens/category/',
      '/screens/manufacturer/',
      '/screens/sellers',
      '/cart',
      '/stock',
    ];
    return !fullScreenPaths.some(path => currentPath.includes(path));
  };

  const containerStyles = shouldApplyTopPadding(pathname)
    ? [styles.container, getSafeAreaStyles(insets)]
    : [styles.container, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }];

  return (
    <SafeAreaProvider>
      <View style={containerStyles}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            title: "",
            headerTitle: "",
            animation: 'none',
            header: () => null,
          }}
        />
        {user && !pathname.includes('/phone-order') && !pathname.includes('/wholesaler') && !pathname.includes('/checkout') && (
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
            <BottomNav isVisible={isVisible} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingBottom: 60,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    zIndex: 900,
  },
  bottomNavHidden: {
    pointerEvents: 'none',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF4444',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#FF7D00',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});