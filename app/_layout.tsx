// Import global polyfills first
import '../global-setup';

// Import Hermes fix for property errors
import '../native-modules/hermes-fix';

// Import React Native Firebase app - MUST be first Firebase import
import '@react-native-firebase/app';

// Import Firebase service early to ensure initialization
import { waitForFirebaseInitialization } from '../services/firebase/firebase';

import { Stack } from 'expo-router/stack';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider } from '../providers/ThemeProvider';
import { LanguageProvider } from '../contexts/LanguageContext';

import { NotificationProvider } from '../providers/NotificationProvider';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { NotificationService } from '../services/notifications/NotificationService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureEdgeToEdge } from '../utils/android15EdgeToEdge';
import { SystemBars } from 'react-native-edge-to-edge';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Sentry.init({
  dsn: 'https://571c5f83af1d8cbcd0fb71edfd76a1c0@o4509453256622080.ingest.de.sentry.io/4509453272744016',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function RootLayout() {
  const session = useAuthStore((state: any) => state.session);
  const loading = useAuthStore((state: any) => state.loading);
  const checkNotificationPermissions = useSettingsStore((state) => state.checkNotificationPermissions);
  const [timeoutOccurred, setTimeoutOccurred] = useState(false);
  const router = useRouter();
  const previousSession = useRef(session);

  // Initialize notification service after Firebase is ready
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        console.log('App: Waiting for Firebase initialization...');
        await waitForFirebaseInitialization();
        console.log('App: Firebase ready, starting NotificationService initialization...');
        
        await NotificationService.initialize();
        console.log('App: NotificationService initialized successfully');
        
        // Check and sync notification permission status with settings
        console.log('App: Checking notification permissions...');
        await checkNotificationPermissions();
        console.log('App: Notification permissions checked');
      } catch (error) {
        console.error('App: NotificationService initialization failed:', error);
      }
    };
    
    initializeNotifications();
  }, [checkNotificationPermissions]);
  
  // Get edge-to-edge configuration component
  const EdgeToEdgeComponent = configureEdgeToEdge({
    statusBarStyle: 'auto',
    hidden: false
  });

  // Handle session changes and navigation
  useEffect(() => {
    // Only navigate to language screen if we had a session and now don't (explicit logout)
    if (previousSession.current && !session && !loading) {
      console.log('Session cleared (user logged out), navigating to language screen');
      router.replace('/(auth)/language');
    }
    
    previousSession.current = session;
  }, [session, loading, router]);

  // Add safety timeout to prevent getting stuck in loading state - ONLY during initial app load
  useEffect(() => {
    // Only apply timeout during initial loading, not when app is resumed
    if (!previousSession.current && loading && !session) {
      console.log('Layout: Starting initial auth timeout (20 seconds)');
      
      const timeoutId = setTimeout(() => {
        // Double-check we're still in initial loading state
        if (loading && !session && !previousSession.current) {
          console.log('Layout: Initial auth loading timed out after 20 seconds');
          
          // Check if there's any cached auth data before clearing
          const checkCachedAuth = async () => {
            try {
              const authVerified = await AsyncStorage.getItem('auth_verified');
              const userId = await AsyncStorage.getItem('user_id');
              const currentState = useAuthStore.getState();
              
              // If we have cached auth data, don't clear - just force loading to false
              if (authVerified === 'true' && userId) {
                console.log('Layout: Found cached auth data, forcing loading state to false instead of clearing');
                // Just set loading to false, don't clear auth
                useAuthStore.setState({ loading: false });
                setTimeoutOccurred(true);
              } else {
                // No cached auth data, safe to clear
                console.log('Layout: No cached auth data found, clearing auth state');
                currentState.clearAuth();
                setTimeoutOccurred(true);
              }
            } catch (error) {
              console.error('Layout: Error checking cached auth:', error);
              useAuthStore.getState().clearAuth();
              setTimeoutOccurred(true);
            }
          };
          
          checkCachedAuth();
        } else {
          console.log('Layout: Auth timeout cancelled - session found or not in initial loading state');
        }
      }, 20000);

      return () => {
        console.log('Layout: Clearing initial auth timeout');
        clearTimeout(timeoutId);
      };
    }
    
    // No timeout needed if we've had a session before or not in loading state
    return () => {};
  }, [loading, session]);

  // Show loading state while auth is being checked
  if (loading && !timeoutOccurred) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading app...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <EdgeToEdgeComponent />
        <LanguageProvider>
          <ThemeProvider>
            <NotificationProvider>
              <ErrorBoundary>
              <Stack screenOptions={{ 
                headerShown: false,
                headerTitle: "", // Empty title to prevent showing route group names
              }}>
                {session ? (
                  <Stack.Screen 
                    name="(main)" 
                    options={{ headerShown: false, title: "" }} 
                  />
                ) : (
                  <Stack.Screen 
                    name="(auth)" 
                    options={{ headerShown: false, title: "" }} 
                  />
                )}
              </Stack>
              </ErrorBoundary>
            </NotificationProvider>
          </ThemeProvider>
        </LanguageProvider>
    </SafeAreaProvider>
   );
});
