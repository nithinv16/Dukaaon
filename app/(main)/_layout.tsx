import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { BottomNav } from '../../components/navigation/BottomNav';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth';
import { useWishlistStore } from '../../store/wishlist';
import { ActivityIndicator, Text } from 'react-native-paper';
import { supabase } from '../../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEdgeToEdge, getSafeAreaStyles } from '../../utils/android15EdgeToEdge';

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
  const [sellerDetails, setSellerDetails] = useState<undefined | null>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add edge-to-edge support for Android navigation
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  
  // Calculate bottom navigation height including safe area
  const bottomNavHeight = 60 + insets.bottom;

  // Optimized authentication logic with reduced database calls
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip if already processing or user already loaded
        if (isLoading || user) return;
        
        console.log('Checking authentication in MainLayout');
        
        // Batch AsyncStorage reads for better performance
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
        
        // Determine user source and fetch data only once
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
            return; // Exit early, let the next useEffect handle routing
          }
        }
        
        // If no auth at all, redirect to language screen
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
    
    // Only run if we don't have user data yet
    if (!user) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [session?.user?.id]); // Simplified dependency array

  // Separate useEffect for user role-based routing to avoid redundant checks
  useEffect(() => {
    if (!user || isLoading) return;

    const handleUserRouting = async () => {
      try {
        // Early check for seller role to prevent showing retailer home screen
        if (user.role === 'seller') {
          console.log('Seller detected, checking details and routing...');
          
          // Check seller details before any redirect; do not auto-redirect from home
          if (sellerDetails === undefined) {
            await checkSellerDetails();
          } else if (!sellerDetails) {
            console.log('Seller without details, redirecting to KYC');
            router.replace('/(auth)/seller-kyc');
            return;
          } else {
            // Allow sellers to access wholesaler-specific pages (including profile)
            if (pathname.startsWith('/(main)/wholesaler')) {
              console.log('Seller accessing wholesaler section, allowing navigation to:', pathname);
              return; // Allow access to wholesaler pages including profile
            } else {
              console.log('Seller with valid details, redirecting to wholesaler home');
              router.replace('/(main)/wholesaler');
              return;
            }
          }
          return; // Exit early for sellers
        }

        // Handle non-seller roles
        if (user.role !== 'seller') {
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
              console.log('Retailer with valid business details, staying on main screen');
              try {
                await loadWishlist();
                console.log('Wishlist loaded successfully in MainLayout');
              } catch (err) {
                console.error('Error loading wishlist in MainLayout:', err);
              }
            }
          } else if (user.role === 'wholesaler') {
            console.log('Detected wholesaler user, checking business details...');
            if (!user.business_details || 
                Object.keys(user.business_details).length === 0 || 
                (typeof user.business_details === 'object' && !Object.values(user.business_details).some(val => val))) {
              console.log('Wholesaler without business details, redirecting to KYC');
              router.replace('/(auth)/wholesaler-kyc');
              return;
            } else {
              console.log('Wholesaler with valid business details, staying on main screen');
            }
          }
          return;
        }
      } catch (error) {
        console.error('Error in user routing:', error);
      }
    };

    handleUserRouting();
  }, [user?.id, user?.role, sellerDetails]); // Removed pathname to prevent redirection loops

  const checkSellerDetails = async () => {
    try {
      console.log('Checking seller details for user ID:', user?.id);
      
      // First, check if user exists and has valid ID
      if (!user?.id) {
        console.error('No valid user ID available for seller details check');
        router.replace('/(auth)/login');
        return;
      }
      
      // Check for seller_details
      const { data, error } = await supabase
        .from('seller_details')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching seller details:', error);
        
        // Check if the error is because the details don't exist
        if (error.code === 'PGRST116') {
          console.log('No seller details found for user ID:', user.id);
          setSellerDetails(null);
        } else {
          // Network or other database error
          console.error('Database error during seller details check:', error);
        setSellerDetails(null);
        }
      } else {
        console.log('Seller details found:', data ? 'Yes' : 'No');
        
        // Check if required fields are filled
        if (data) {
          const { business_name, owner_name, address, gst_number } = data;
          console.log('Seller details found:', data ? 'Yes' : 'No');
          
          // Simplified validation - just check if essential fields exist
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
            address: !!address, 
            isComplete 
          });
          
          // More detailed check for address field
          if (address) {
            if (typeof address === 'object') {
              console.log('DEBUG - Address object check:', { 
                hasStreet: !!address.street,
                hasCity: !!address.city, 
                hasState: !!address.state,
                hasPincode: !!address.pincode 
              });
            } else {
              console.log('DEBUG - Address string length:', address.trim().length);
            }
          } else {
            console.log('DEBUG - Address is null or undefined');
          }
          
          // If any required field is missing, treat as incomplete
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
    } catch (error) {
      console.error('Exception checking seller details:', error);
      setSellerDetails(null);
    }
  };
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text>Loading...</Text>
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

  // Use properly typed Stack component
  const StackComponent = Stack as StackType;
  
  // Return minimal layout with Stack
  return (
    <SafeAreaProvider>
      <View style={[styles.container, getSafeAreaStyles(insets)]}>
        <StackComponent 
          screenOptions={{ 
            headerShown: false,
            gestureEnabled: true, // Enable gestures by default - specific screens will override this
            title: "", // Set empty title to hide route group names
            headerTitle: "", // Also set empty header title
          }} 
        />
        {/* Show bottom nav for retailers and other users, but not for wholesalers or on AI agent screen */}
        {user && !pathname.includes('/phone-order') && !pathname.includes('/wholesaler') && (
          <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>
            <BottomNav />
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
    paddingBottom: 60, // Add padding for the bottom nav
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 900, // Lower z-index so seller bottom nav can override it
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});