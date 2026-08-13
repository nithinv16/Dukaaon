/**
 * App Entry Point - Simplified Auth Loading
 * 
 * This component handles the initial app loading and navigation.
 * It uses SimpleAuthLoader for a cache-first approach:
 * 1. Check AsyncStorage for cached auth (fast)
 * 2. Navigate immediately based on cache
 * 3. Validate session in background (non-blocking)
 * 
 * Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions, SafeAreaView } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuthStore } from '../store/auth';
import { SimpleAuthLoader } from '../services/auth/SimpleAuthLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, setCachedAccessToken, initializeSupabaseSession } from '../services/supabase/supabase';
import { supabaseConfig, supabaseAuthStorageKey } from '../config/secrets';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Maximum splash duration
const MAX_SPLASH_DURATION_MS = 10000;

// Supabase configuration — single source of truth is config/secrets.ts.
// These were previously hardcoded here, which meant the project could not be
// changed without editing app code and kept a copy of the anon key in a second
// place.
const SUPABASE_URL = supabaseConfig.url;
const SUPABASE_ANON_KEY = supabaseConfig.anonKey;
const SUPABASE_AUTH_KEY = supabaseAuthStorageKey;

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Start animations when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ),
    ]).start();
  }, []);

  /**
   * Main auth check and navigation effect
   */
  useEffect(() => {
    let isMounted = true;

    const checkAuthAndNavigate = async () => {
      console.log('Index: Starting simplified auth check');
      const startTime = Date.now();

      try {
        // Step 0: Initialize Supabase session first (ensures token is loaded/refreshed)
        console.log('Index: Initializing Supabase session...');
        await initializeSupabaseSession();
        console.log('Index: Supabase session initialized');

        // Step 1: Check cached auth
        const result = await SimpleAuthLoader.checkCachedAuth();
        const checkTime = Date.now() - startTime;
        console.log('Index: Cache check completed', {
          checkTime,
          isAuthenticated: result.isAuthenticated,
          navigateTo: result.navigateTo
        });

        if (!isMounted) return;

        // Step 2: Set auth store state if authenticated
        if (result.isAuthenticated && result.profile) {
          console.log('Index: Setting user in auth store');
          useAuthStore.getState().setUser(result.profile);

          // Cancel safety timeout
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
            console.log('Index: Cancelled safety timeout for authenticated user');
          }

          // SIMPLE FIX: Always refresh token on app reload to ensure it's valid server-side
          // Don't trust local expires_at - the server may have invalidated the token
          console.log('Index: Refreshing session token...');

          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            console.log('Index: Looking for session in AsyncStorage with key:', SUPABASE_AUTH_KEY);
            const sessionStr = await AsyncStorage.getItem(SUPABASE_AUTH_KEY);
            console.log('Index: Session string found:', sessionStr ? 'YES (length: ' + sessionStr.length + ')' : 'NO');

            if (sessionStr) {
              const sessionData = JSON.parse(sessionStr);
              console.log('Index: Session data parsed, has refresh_token:', !!sessionData?.refresh_token);

              if (sessionData?.refresh_token) {
                console.log('Index: Found refresh_token, getting fresh access token...');

                // Always refresh to get a valid token
                const refreshResponse = await fetch(
                  `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                  {
                    method: 'POST',
                    headers: {
                      'apikey': SUPABASE_ANON_KEY,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refresh_token: sessionData.refresh_token })
                  }
                );

                if (refreshResponse.ok) {
                  const newSessionData = await refreshResponse.json();
                  console.log('Index: Token refreshed successfully, user:', newSessionData.user?.id);

                  // Store the new session in AsyncStorage
                  await AsyncStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify(newSessionData));

                  // CRITICAL: Update the in-memory token cache for immediate use by customFetch
                  setCachedAccessToken(newSessionData.access_token);
                  console.log('Index: Updated in-memory token cache');

                  // Update our auth store
                  useAuthStore.setState({ session: newSessionData as any });

                  // NOTE: We do NOT call setSession - it hangs on React Native!
                  // The customFetch function will use the cached token instead.
                  console.log('Index: Skipping setSession (hangs on RN), using cached token for customFetch');

                  // Fetch fresh profile with seller_details using direct fetch
                  try {
                    console.log('Index: Fetching fresh profile with seller_details...');
                    const profileResponse = await fetch(
                      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${newSessionData.user.id}&select=*,seller_details:seller_details(*)`,
                      {
                        method: 'GET',
                        headers: {
                          'apikey': SUPABASE_ANON_KEY,
                          'Authorization': `Bearer ${newSessionData.access_token}`,
                          'Content-Type': 'application/json'
                        }
                      }
                    );

                    if (profileResponse.ok) {
                      const profileArr = await profileResponse.json();
                      if (profileArr && profileArr[0]) {
                        console.log('Index: Fresh profile fetched successfully');
                        useAuthStore.getState().setUser(profileArr[0]);
                        await SimpleAuthLoader.cacheAuthData(profileArr[0], newSessionData);
                      }
                    } else {
                      console.warn('Index: Profile fetch failed, using cached data');
                    }
                  } catch (profileErr) {
                    console.warn('Index: Failed to fetch fresh profile:', profileErr);
                    // Continue with cached profile - it's better than nothing
                  }
                } else {
                  const errorText = await refreshResponse.text();
                  console.error('Index: Token refresh failed:', refreshResponse.status, errorText);
                  // Refresh token is invalid - user needs to start fresh from language selection
                  await SimpleAuthLoader.clearCachedAuth();
                  useAuthStore.getState().clearAuth();
                  router.replace('/(auth)/language');
                  return;
                }
              } else {
                console.log('Index: No refresh_token, redirecting to language');
                router.replace('/(auth)/language');
                return;
              }
            } else {
              console.log('Index: No session found, redirecting to language');
              router.replace('/(auth)/language');
              return;
            }
          } catch (err) {
            console.error('Index: Error refreshing session:', err);
          }
        }

        if (!isMounted) return;

        // Step 3: Navigate to appropriate screen
        setNavigating(true);
        setLoading(false);
        console.log('Index: Navigating to', result.navigateTo);
        router.replace(result.navigateTo);

        // Step 4: Set logout callback
        if (result.isAuthenticated) {
          SimpleAuthLoader.setLogoutCallback(() => {
            console.log('Index: Background validation triggered logout');
            useAuthStore.getState().clearAuth();
            router.replace('/(auth)/language');
          });
        }

      } catch (err) {
        console.error('Index: Error during auth check', err);
        if (!isMounted) return;

        setError(err instanceof Error ? err.message : 'Unknown error');
        setNavigating(true);
        setLoading(false);
        router.replace('/(auth)/language');
      }
    };

    checkAuthAndNavigate();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Safety timeout - ensures splash screen never shows indefinitely
   */
  useEffect(() => {
    safetyTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log('Index: Safety timeout reached, navigating to language screen');
        setNavigating(true);
        setLoading(false);
        router.replace('/(auth)/language');
      }
    }, MAX_SPLASH_DURATION_MS);

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [loading]);

  // Show splash screen during loading OR navigating
  if (loading || navigating) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FF7D00', '#FFA64D', '#FFCC99']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.tagline}>Your One-Stop B2B Marketplace</Text>

              <View style={styles.loadingContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              <Text style={styles.loadingText}>Loading...</Text>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Error state view
  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#FF7D00', '#FFA64D', '#FFCC99']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.errorText}>Error: {error}</Text>

            <Button
              mode="contained"
              onPress={() => {
                setLoading(true);
                setError(null);
                router.replace('/');
              }}
              style={styles.button}
              buttonColor="#FFFFFF"
              textColor="#FF7D00"
            >
              Retry
            </Button>

            <Button
              mode="contained"
              onPress={() => router.replace('/(auth)/language')}
              style={[styles.button, { marginTop: 12 }]}
              buttonColor="#FFFFFF"
              textColor="#FF7D00"
            >
              Go to Language Selection
            </Button>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Fallback view
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF7D00', '#FFA64D', '#FFCC99']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.loadingText}>Welcome to DukaaOn</Text>

          <Button
            mode="contained"
            onPress={() => router.replace('/(main)/home/')}
            style={styles.button}
            buttonColor="#FFFFFF"
            textColor="#FF7D00"
          >
            Go to Home
          </Button>

          <Button
            mode="contained"
            onPress={() => router.replace('/(auth)/language')}
            style={[styles.button, { marginTop: 12 }]}
            buttonColor="#FFFFFF"
            textColor="#FF7D00"
          >
            Select Language
          </Button>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.6,
    height: width * 0.25,
    marginBottom: height * 0.04,
  },
  illustrationContainer: {
    width: '100%',
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.04,
  },
  illustration: {
    width: width * 0.8,
    height: height * 0.3,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: height * 0.04,
  },
  loadingContainer: {
    height: 8,
    width: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 24,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    width: '90%',
  },
  button: {
    marginTop: 24,
    width: '80%',
    borderRadius: 8,
    paddingVertical: 6,
  },
});
