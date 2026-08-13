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
import { CartAnimationProvider } from '../contexts/CartAnimationContext';
import CartAnimationOverlay from '../components/cart/CartAnimationOverlay';
import React, { useEffect, useRef, useState } from 'react';
import { NotificationService } from '../services/notifications/NotificationService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureEdgeToEdge } from '../utils/android15EdgeToEdge';
import { useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';

// Import ProductCacheService for cache warming - Requirements 7.5
import { ProductCacheService } from '../services/products/ProductCacheService';

// Import services for early initialization
import { dynamicCategoryService } from '../services/dynamic/dynamicCategoryService';
import { translationService } from '../services/translationService';
import { supabaseConfigError } from '../config/secrets';

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

/**
 * Shown when the app is built without usable Supabase configuration.
 *
 * config/secrets.ts deliberately reports rather than throws, because a
 * module-scope throw happens before React mounts and yields a blank screen with
 * no ErrorBoundary and no Sentry event. app.config.js fails the build when these
 * values are absent, so this should be unreachable in a released build — it
 * exists so that if it ever is reached, the cause is legible.
 */
function ConfigurationErrorScreen({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#C62828', marginBottom: 12 }}>
        Configuration error
      </Text>
      <Text style={{ fontSize: 14, color: '#333', lineHeight: 20 }}>{message}</Text>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  // Report a broken build immediately and legibly, before any provider tries to
  // use the Supabase client and fails somewhere unrelated.
  useEffect(() => {
    if (supabaseConfigError) {
      console.error('[App] Supabase configuration error:', supabaseConfigError);
      Sentry.captureException(new Error(`Supabase misconfigured: ${supabaseConfigError}`));
    }
  }, []);

  const session = useAuthStore((state: any) => state.session);
  const loading = useAuthStore((state: any) => state.loading);
  const checkNotificationPermissions = useSettingsStore((state) => state.checkNotificationPermissions);
  const router = useRouter();
  const previousSession = useRef(session);

  // Initialize notification service after Firebase is ready (non-blocking)
  // This runs in background and doesn't block UI rendering
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Use setTimeout to ensure this doesn't block initial render
        setTimeout(async () => {
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
        }, 100); // Small delay to ensure UI renders first
      } catch (error) {
        console.error('App: NotificationService initialization setup failed:', error);
      }
    };

    initializeNotifications();
  }, [checkNotificationPermissions]);

  // CRITICAL: Initialize translation and category caches IMMEDIATELY at startup
  // This runs before anything else to ensure home screen has cached data
  useEffect(() => {
    const initializeCaches = async () => {
      try {
        // Run both initializations in parallel for fastest startup
        await Promise.all([
          translationService.initialize(),
          dynamicCategoryService.initialize(),
        ]);
        console.log('App: Translation and category caches initialized');
      } catch (error) {
        console.warn('App: Cache initialization failed (non-critical):', error);
      }
    };

    // Initialize immediately - no delay
    initializeCaches();
  }, []);

  // Warm product cache on app start - Requirements 7.5
  // Loads products for 5 most recently viewed wholesalers into memory cache
  useEffect(() => {
    const warmProductCache = async () => {
      try {
        console.log('App: Starting product cache warming...');
        const startTime = Date.now();

        // Warm cache with recently viewed wholesalers (limit 5)
        await ProductCacheService.warmCache();

        const duration = Date.now() - startTime;
        console.log(`App: Product cache warming complete in ${duration}ms`);
      } catch (error) {
        // Cache warming is non-critical, log and continue
        console.warn('App: Product cache warming failed:', error);
      }
    };

    // Run cache warming after a short delay to not block initial render
    const timeoutId = setTimeout(warmProductCache, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  // Get edge-to-edge configuration component
  const EdgeToEdgeComponent = configureEdgeToEdge({
    statusBarStyle: 'auto',
    hidden: false
  });

  // Track if layout is mounted to prevent navigation before mount
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle session changes and navigation (logout detection)
  // Navigation on app launch is handled by index.tsx using SimpleAuthLoader
  useEffect(() => {
    // Only navigate to language screen if we had a session and now don't (explicit logout)
    if (previousSession.current && !session && !loading) {
      console.log('Session cleared (user logged out), navigating to language screen');
      // Defer navigation to next tick to ensure layout is fully rendered
      // This prevents "Attempted to navigate before mounting the Root Layout" error
      setTimeout(() => {
        if (isMounted.current) {
          router.replace('/(auth)/language');
        }
      }, 0);
    }

    previousSession.current = session;
  }, [session, loading, router]);

  // Add timeout state to prevent infinite loading screen
  const [showLoading, setShowLoading] = useState(true);

  // Timeout to prevent infinite loading screen
  useEffect(() => {
    if (loading && !session) {
      const timeout = setTimeout(() => {
        setShowLoading(false);
        // Force set loading to false if timeout reached
        useAuthStore.getState().setLoading(false);
      }, 2000); // Max 2 seconds loading screen

      return () => clearTimeout(timeout);
    } else {
      setShowLoading(false);
    }
  }, [loading, session]);

  // A build without Supabase configuration cannot do anything useful, so say so
  // rather than rendering a UI whose every request will fail.
  if (supabaseConfigError) {
    return <ConfigurationErrorScreen message={supabaseConfigError} />;
  }

  // Show loading state ONLY if auth is being checked AND we don't have a session
  // This should be very brief - SimpleAuthLoader in index.tsx handles fast navigation
  // Don't block UI for Firebase/notification initialization - those are non-blocking
  if (loading && !session && showLoading) {
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
      <CartAnimationProvider>
        <LanguageProvider>
          <ThemeProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <Stack screenOptions={{
                  headerShown: false,
                  headerTitle: "", // Empty title to prevent showing route group names
                  animation: 'none',
                  header: () => null,
                  navigationBarHidden: true,
                  contentStyle: { backgroundColor: 'transparent' },
                }}>
                  {session ? (
                    <Stack.Screen
                      name="(main)"
                      options={{
                        headerShown: false,
                        title: "",
                        header: () => null,
                        navigationBarHidden: true,
                      }}
                    />
                  ) : (
                    <Stack.Screen
                      name="(auth)"
                      options={{
                        headerShown: false,
                        title: "",
                        header: () => null,
                        navigationBarHidden: true,
                      }}
                    />
                  )}
                </Stack>
                <CartAnimationOverlay />
              </ErrorBoundary>
            </NotificationProvider>
          </ThemeProvider>
        </LanguageProvider>
      </CartAnimationProvider>
    </SafeAreaProvider>
  );
});
