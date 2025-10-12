import { useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert, Image, Animated, Dimensions, SafeAreaView } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuthStore } from '../store/auth';
import { supabase } from '../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/auth/authService';
import { LinearGradient } from 'expo-linear-gradient';


// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Function to check if we need to force reload the app
const checkForceReload = async () => {
  try {
    const forceReload = await AsyncStorage.getItem('_forceReload');
    if (forceReload) {
      console.log('Force reload flag detected, clearing...');
      await AsyncStorage.removeItem('_forceReload');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking force reload flag:', error);
    return false;
  }
};



export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const redirectAttempts = useRef(0);
  const [showManualNav, setShowManualNav] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Check for force reload when component mounts
  useEffect(() => {
    const checkReload = async () => {
      const shouldReload = await checkForceReload();
      if (shouldReload) {
        console.log('App was force reloaded, redirecting to language screen...');
        setLoading(false);
        router.replace('/(auth)/language');
      }
    };
    
    checkReload();
  }, []);
  
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
  
  // Show manual navigation after 5 seconds if still on loading screen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (redirectPath === '/(main)/home' && redirectAttempts.current >= 2) {
        console.log('Showing manual navigation option');
        setShowManualNav(true);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [redirectPath, redirectAttempts.current]);
  
  // Helper function for manual navigation
  const handleManualNavigation = () => {
    console.log('Manual navigation triggered');
    // Reset any redirects in progress
    setRedirectPath(null);
    // Navigate directly
    router.push('/(main)/home/');
  };
  
  // Helper function to force navigation to home screen
  const forceNavigateToHome = useCallback(() => {
    console.log('Force navigating to home screen');
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Force direct navigation with reset
    try {
      // Try the backup route first
      router.push('/home');
      console.log('Navigation attempted via backup route');
      
      // Set a fallback to try direct navigation again after a delay
      setTimeout(() => {
        console.log('Fallback navigation attempt');
        router.push('/(main)/home/');
      }, 1000);
    } catch (e) {
      console.error('Navigation error:', e);
    }
  }, [router]);

  // Set a timeout to prevent the app from getting stuck in a loading state
  useEffect(() => {
    console.log('Setting up safety timeout for splash screen');
    // Increased safety timeout to 8 seconds to match the auth store timeout
    // This prevents race conditions between different timeout mechanisms
    const safetyTimeout = setTimeout(() => {
      console.log('Splash screen safety timeout reached after 8 seconds');
      if (loading) {
        console.log('Still loading, redirecting to language screen');
        setLoading(false);
        router.replace('/(auth)/language');
      }
    }, 8000); // Increased to 8 seconds to match auth store timeout
    
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [loading]);

  // Wait for auth store to complete initialization instead of doing independent auth check
  useEffect(() => {
    const checkAuthStore = async () => {
      console.log('Index: Waiting for auth store initialization');
      
      try {
        // First check if we have cached auth data
        const cachedAuthData = await Promise.all([
          AsyncStorage.getItem('auth_verified'),
          AsyncStorage.getItem('user_id'),
          AsyncStorage.getItem('profile_id')
        ]);
        
        const [authVerified, userId, profileId] = cachedAuthData;
        const hasCachedAuth = authVerified === 'true' && (userId || profileId);
        
        if (hasCachedAuth) {
          console.log('Index: Found cached auth data for user:', userId);
        } else {
          console.log('Index: No cached auth data found');
        }
        
        // Wait for auth store to finish loading with longer timeout for cached auth
        const maxWaitTime = hasCachedAuth ? 5000 : 3000; // Give more time if we have cached auth
        const startTime = Date.now();
        
        console.log(`Index: Waiting up to ${maxWaitTime}ms for auth store initialization`);
        
        const waitForAuthStore = new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            const authState = useAuthStore.getState();
            const elapsedTime = Date.now() - startTime;
            
            // If auth store has finished loading
            if (!authState.loading) {
              console.log(`Index: Auth store finished loading after ${elapsedTime}ms`);
              clearInterval(checkInterval);
              resolve();
            }
            // Or if we've waited too long
            else if (elapsedTime >= maxWaitTime) {
              console.log(`Index: Auth store still loading after ${elapsedTime}ms, proceeding anyway`);
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
        
        await waitForAuthStore;
        
        // Get final auth state after initialization
        const authState = useAuthStore.getState();
        console.log('Index: Auth store state after wait:', {
          hasSession: !!authState.session,
          hasUser: !!authState.user,
          loading: authState.loading
        });
        
        // If we have a valid session or cached user, navigate to main app
        if (authState.session || authState.user) {
          console.log('Index: Valid authentication found, navigating to main app');
          setLoading(false);
          router.replace('/(main)');
        } else if (hasCachedAuth && authState.loading) {
          // Auth store is still loading but we have cached auth - give it more time
          console.log('Index: Auth store still loading with cached auth, waiting 3 more seconds');
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const updatedAuthState = useAuthStore.getState();
          console.log('Index: Auth store state after extended wait:', {
            hasSession: !!updatedAuthState.session,
            hasUser: !!updatedAuthState.user,
            loading: updatedAuthState.loading
          });
          
          if (updatedAuthState.session || updatedAuthState.user) {
            console.log('Index: Auth restored after extended wait, navigating to main app');
            setLoading(false);
            router.replace('/(main)');
          } else {
            console.log('Index: Auth not restored after extended wait, navigating to language screen');
            setLoading(false);
            router.replace('/(auth)/language');
          }
        } else {
          // No cached auth or auth store finished without user
          console.log('Index: No valid authentication found, navigating to language screen');
          setLoading(false);
          router.replace('/(auth)/language');
        }
      } catch (error) {
        console.error('Index: Error in auth check:', error);
        setLoading(false);
        router.replace('/(auth)/language');
      }
    };
    
    checkAuthStore();
  }, []);

  // Handle navigation effect - always defined, not conditionally
  useEffect(() => {
    if (redirectPath) {
      console.log('Navigating to:', redirectPath);
      // Increment redirect attempts for tracking
      redirectAttempts.current += 1;
      
      // Small timeout to ensure component is fully rendered before navigation
      const navigationTimer = setTimeout(() => {
        try {
          console.log('Trying navigation to', redirectPath);
          router.push(redirectPath);
          
          // Additional fallback - try again after 500ms
          setTimeout(() => {
            if (window.location.pathname === '/') {
              console.log('Still on index page, trying replacement');
              router.replace(redirectPath);
            }
          }, 500);
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback to replacement if push fails
          try {
            console.log('Trying replacement navigation');
            router.replace(redirectPath);
          } catch (replaceError) {
            console.error('Replacement navigation error:', replaceError);
            
            // Last resort - create direct navigation link for user
            console.log('Adding manual navigation option');
            setShowManualNav(true);
          }
        }
      }, 300); // Increased delay for navigation
      
      return () => clearTimeout(navigationTimer);
    }
  }, [redirectPath]);
  
  // If loading, show the new splash screen
  if (loading) {
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
                }
              ]}
            >
              <Image 
                source={require('../assets/images/logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              
              <View style={styles.illustrationContainer}>
                <Image 
                  source={require('../assets/images/connecting-retailers.png')} 
                  style={styles.illustration}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.tagline}>Connecting Retailers & Wholesalers</Text>
              
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
              
              <Text style={styles.loadingText}>Loading your experience...</Text>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }
  
  // If error and not redirecting, show error with retry option
  if (errorMessage && !redirectPath) {
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
            
            <Text style={styles.errorText}>Error: {errorMessage}</Text>
            
            <Button 
              mode="contained"
              onPress={() => {
                setLoading(true);
                setErrorMessage(null);
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
              onPress={() => router.push('/(auth)/language')}
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
  
  // If we have a redirect path, show redirecting screen
  if (redirectPath) {
    console.log('Preparing navigation to:', redirectPath);
    
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
            
            <Text style={styles.loadingText}>Taking you to the app...</Text>
            
            <ActivityIndicator size="large" color="#FFFFFF" style={styles.spinner} />
            
            <Button 
              mode="contained"
              onPress={() => {
                // Manual navigation as backup
                console.log('Manual navigation to:', redirectPath);
                try {
                  router.push(redirectPath);
                } catch (error) {
                  console.error('Manual navigation error:', error);
                  router.replace(redirectPath);
                }
              }}
              style={styles.button}
              buttonColor="#FFFFFF"
              textColor="#FF7D00"
            >
              Continue
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
            onPress={handleManualNavigation}
            style={styles.button}
            buttonColor="#FFFFFF"
            textColor="#FF7D00"
          >
            Go to Home
          </Button>
          
          <Button 
            mode="contained"
            onPress={() => router.push('/(auth)/language')}
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
  spinner: {
    marginVertical: 20,
  },
  button: {
    marginTop: 24,
    width: '80%',
    borderRadius: 8,
    paddingVertical: 6,
  },
});
