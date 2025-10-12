import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from '../store/auth';
import { getCurrentUser } from '../services/auth/authService';
import { handleSupabaseAuth } from '../services/auth/firebaseSupabaseSync';
import LoadingScreen from '../screens/loading/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OTPScreen from '../app/(auth)/otp';
import BusinessVerificationScreen from '../screens/verification/BusinessVerificationScreen';
import BottomTabNavigator from './BottomTabNavigator';
import ProductDetailScreen from '../screens/product/ProductDetailScreen';
import CartScreen from '../screens/cart/CartScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import OrderDetailScreen from '../screens/order/OrderDetailScreen';
import StoreDetailScreen from '../screens/store/StoreDetailScreen';
import CreditDetailScreen from '../screens/credit/CreditDetailScreen';
import CreditApplicationScreen from '../screens/credit/CreditApplicationScreen';

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
  const { isLoggedIn, user, loading } = useAuthStore();

  useEffect(() => {
    const checkSupabaseAuth = async () => {
      // Check for Supabase session on startup
      const supabaseUser = await getCurrentUser();
      if (supabaseUser) {
        // User is signed in, attempt to sync profile
        console.log('Supabase user detected, attempting to sync profile');
        await handleSupabaseAuth(supabaseUser);
      } else {
        // No user is signed in
        console.log('No Supabase user detected');
      }
    };

    checkSupabaseAuth();
  }, []);

  // If we have Supabase auth but profile is still loading, show loading screen
  const showLoadingScreen = loading && !user;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          // Logged in flow
          <>
            <Stack.Screen name="Main" component={BottomTabNavigator} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
            <Stack.Screen name="CreditDetail" component={CreditDetailScreen} />
            <Stack.Screen name="CreditApplication" component={CreditApplicationScreen} />
            <Stack.Screen
              name="BusinessVerification"
              component={BusinessVerificationScreen}
            />
          </>
        ) : showLoadingScreen ? (
          // Loading state (Supabase auth exists but profile not loaded)
          <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : (
          // Not logged in flow
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
            <Stack.Screen
              name="BusinessVerification"
              component={BusinessVerificationScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;