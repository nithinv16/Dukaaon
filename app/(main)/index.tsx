import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { View, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { supabase } from '../../services/supabase/supabase';

/**
 * Main index route that conditionally redirects based on user role
 * This prevents sellers from seeing the retailer home screen initially
 */
export default function MainIndex() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  useEffect(() => {
    // Wait for user data to be available
    if (!user) {
      return;
    }

    const routeUser = async () => {
      if (user.role === 'seller') {
        console.log('Main index: Seller detected, checking seller_details completeness before routing');
        try {
          const { data: details, error } = await supabase
            .from('seller_details')
            .select('business_name, owner_name, gst_number')
            .eq('user_id', user.id)
            .single();
          
          if (error) {
            if (error.code === 'PGRST116') {
              console.log('No seller_details found, redirecting to seller KYC');
              router.replace('/(auth)/seller-kyc');
              return;
            }
            console.error('Error fetching seller_details:', error);
            router.replace('/(auth)/seller-kyc');
            return;
          }

          const isComplete = !!(details?.business_name && details?.owner_name && details?.gst_number);
          console.log('Seller_details completeness (business_name, owner_name, gst_number):', isComplete);
          if (isComplete) {
            router.replace('/(main)/wholesaler');
          } else {
            router.replace('/(auth)/seller-kyc');
          }
        } catch (e) {
          console.error('Exception checking seller_details in MainIndex:', e);
          router.replace('/(auth)/seller-kyc');
        }
      } else {
        console.log('Main index: Non-seller user, routing to home');
        router.replace('/(main)/home/');
      }
    };

    routeUser();
  }, [user, router]);
  
  // Show loading while waiting for user data
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF7D00" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }
  
  return null;
}