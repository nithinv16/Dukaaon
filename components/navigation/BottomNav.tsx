import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, Animated, Easing } from 'react-native';
import { useRouter, Link, usePathname } from 'expo-router';
import { IconButton, Surface } from 'react-native-paper';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';
import { COLORS } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import { Video, AVPlaybackStatus } from 'expo-av';
import { supabase } from '../../services/supabase/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveOrderTracker } from './ActiveOrderTracker';
import { useAuthStore } from '../../store/auth';

// Fallback video URL if database fetch fails
const FALLBACK_VIDEO_URL = 'https://xcpznnkpjgyrpbvpnvit.supabase.co/storage/v1/object/sign/ai_transition_video/Ai%20transition.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83MjUxM2M2Mi00NWZjLTRlMDMtODA4OC03Y2VlZjZjNDc3ZDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhaV90cmFuc2l0aW9uX3ZpZGVvL0FpIHRyYW5zaXRpb24ubXA0IiwiaWF0IjoxNzY1MDM0MDIxLCJleHAiOjE5MjI3MTQwMjF9.8NELzj9txtETJboGfkPyB8O5ftB6p2XX_FCL06VZCvw';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;

  try {
    router = useRouter();
  } catch (error) {
    console.error('[BottomNav] Error initializing router:', error);
    router = null;
  }

  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[BottomNav] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[BottomNav] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[BottomNav] router.back not available');
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

// Helper function to check if we're on the home screen
const isHomeScreen = (path: string): boolean => {
  if (!path || path === '') return false; // Don't show tracker if path is unknown

  // Normalize the path for comparison (remove leading/trailing slashes)
  const normalizedPath = path.toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');

  // Match home screen paths (more lenient matching)
  const homePathPatterns = [
    '(main)/home',
    'home',
    '(main)/home/index',
    'home/index',
    '/(main)/home', // With leading slash
    '/home', // With leading slash
  ];

  // Check exact match after normalization
  const matchesPattern = homePathPatterns.some(pattern => {
    const normalizedPattern = pattern.toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
    return normalizedPath === normalizedPattern;
  });

  // Also check if path contains 'home' (but not in orders/home context)
  const containsHome = normalizedPath.includes('home') && !normalizedPath.includes('orders');

  const result = matchesPattern || containsHome;

  return result;
};

// Define a type for the storage interface
interface StorageInterface {
  getProfileImageUrl?: (userId: string, fileName: string) => string | null;
  getShopImageUrl?: (userId: string, fileName: string) => string | null;
  buildAvatarPath?: (userId: string) => string;
  buildShopPath?: (userId: string) => string;
}

// Declare a global interface to augment the global object
declare global {
  var storage: StorageInterface | undefined;
}

// Color constants are imported from '../../constants/colors'

// Create a safe storage accessor to prevent undefined errors
const safeStorage: StorageInterface = {
  // Fallback helper for any missing storage functions
  getProfileImageUrl: (userId: string, fileName: string) => {
    try {
      // Access the actual storage function if it exists
      if (global.storage?.getProfileImageUrl) {
        return global.storage.getProfileImageUrl(userId, fileName);
      }
      console.warn('storage.getProfileImageUrl is not available');
      return null;
    } catch (error) {
      console.error('Error in getProfileImageUrl:', error);
      return null;
    }
  },
  getShopImageUrl: (userId: string, fileName: string) => {
    try {
      if (global.storage?.getShopImageUrl) {
        return global.storage.getShopImageUrl(userId, fileName);
      }
      console.warn('storage.getShopImageUrl is not available');
      return null;
    } catch (error) {
      console.error('Error in getShopImageUrl:', error);
      return null;
    }
  },
  buildAvatarPath: (userId: string) => {
    try {
      if (global.storage?.buildAvatarPath) {
        return global.storage.buildAvatarPath(userId);
      }
      console.warn('storage.buildAvatarPath is not available');
      return '';
    } catch (error) {
      console.error('Error in buildAvatarPath:', error);
      return '';
    }
  },
  buildShopPath: (userId: string) => {
    try {
      if (global.storage?.buildShopPath) {
        return global.storage.buildShopPath(userId);
      }
      console.warn('storage.buildShopPath is not available');
      return '';
    } catch (error) {
      console.error('Error in buildShopPath:', error);
      return '';
    }
  }
};

export function BottomNav({ isVisible = true }: { isVisible?: boolean }) {
  // Get current path using expo-router's usePathname hook (more reliable)
  // Use usePathname directly - it should always be available in expo-router context
  const pathname = usePathname();
  const currentPath = pathname;

  const [activeTab, setActiveTab] = useState(currentPath || '(main)/home');
  const router = useSafeRouter();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const viewOtherOrdersRef = useRef<(() => void) | null>(null);
  const trackerVisibilityRef = useRef<((isVisible: boolean) => void) | null>(null);
  const [isTrackerVisible, setIsTrackerVisible] = useState(true); // Default to true, will be updated by tracker

  // Video URL state - fetched ONCE at parent level to prevent infinite loop
  // (Nested PhoneOrderButton was causing re-fetch on every re-render)
  const [videoUrl, setVideoUrl] = useState<string>(FALLBACK_VIDEO_URL);
  const videoUrlFetchedRef = useRef(false);

  // Fetch video URL ONCE at parent level
  useEffect(() => {
    // Prevent duplicate fetches
    if (videoUrlFetchedRef.current) {
      return;
    }
    videoUrlFetchedRef.current = true;

    const fetchVideoUrl = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_transition_video')
          .select('video_url')
          .limit(1);

        if (error) {
          console.log('[BottomNav] Error fetching video URL:', error.message);
          return;
        }

        const videoData = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (videoData?.video_url && typeof videoData.video_url === 'string' && videoData.video_url.trim() !== '') {
          console.log('[BottomNav] Fetched video URL from database (once):', videoData.video_url);
          setVideoUrl(videoData.video_url);
        }
      } catch (err) {
        console.log('[BottomNav] Failed to fetch video URL:', err);
      }
    };
    fetchVideoUrl();
  }, []); // Empty dependency - runs ONLY once at mount

  // Notify home screen about tracker visibility changes
  useEffect(() => {
    // Set up the callback wrapper that notifies both BottomNav and home screen
    trackerVisibilityRef.current = (isVisible: boolean) => {
      setIsTrackerVisible(isVisible);
      // Notify home screen if callback exists
      if ((global as any).__homeTrackerVisibilityCallback) {
        (global as any).__homeTrackerVisibilityCallback(isVisible);
      }
    };
  }, []);

  // Original texts for translation - uses static translations from translationService
  const ORIGINAL_TEXTS = {
    home: 'Home',
    stockSharing: 'Stock Sharing',
    loans: 'Loans',
    profile: 'Profile',
    callToOrder: 'Call To Order',
    viewAllOrders: 'View All Orders',
    pressHoldForAI: 'Press & Hold for AI',
    aiMode: 'AI Mode'
  };

  // Use instant translation hook - checks static translations first for contextual accuracy
  const { t: translations } = useInstantTranslation(ORIGINAL_TEXTS);

  // Animate bottom nav visibility
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isVisible ? 0 : 100,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: 60,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  }, [isVisible, translateY, opacity]);

  // Update active tab when pathname changes (for compatibility, but isActive uses currentPath directly)
  useEffect(() => {
    if (currentPath) {
      setActiveTab(currentPath);
    }
  }, [currentPath]);

  const isActive = (path: string) => {
    // Always use currentPath directly from usePathname (most reliable)
    const pathToCheck = currentPath || '';

    if (!pathToCheck) return false;

    // Normalize both paths by removing leading/trailing slashes
    const normalizedCurrentPath = pathToCheck.replace(/^\/+/, '').replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');

    // Extract the key part (remove (main) prefix if present)
    const pathKey = normalizedPath.replace(/^\(main\)\//, '');
    const currentKey = normalizedCurrentPath.replace(/^\(main\)\//, '');

    // Match using the key (works for both "(main)/home" and "/home" formats)
    if (currentKey === pathKey || currentKey.startsWith(pathKey + '/')) {
      return true;
    }

    // Also try exact match with full path
    if (normalizedCurrentPath === normalizedPath || normalizedCurrentPath.startsWith(normalizedPath + '/')) {
      return true;
    }

    return false;
  };

  const isPhoneOrderActive = isActive('/(main)/phone-order');

  // Create a NavItem component to avoid duplicate code and prevent view hierarchy issues
  const NavItem = ({ path, icon, label }: { path: string; icon: string; label: string }) => {
    const active = isActive(path);

    // Handle tab press
    const handlePress = () => {
      setActiveTab(path);
    };

    return (
      <Link href={path} asChild>
        <Pressable style={styles.navItem} onPress={handlePress}>
          <View style={{ alignItems: 'center' }}>
            {active && <View style={styles.activeIndicator} />}
            <IconButton
              icon={icon}
              size={26}
              iconColor={active ? COLORS.orange : '#9E9E9E'}
            />
            <Text style={[
              styles.label,
              active && styles.activeNavText
            ]}>{label || 'Nav'}</Text>
          </View>
        </Pressable>
      </Link>
    );
  };

  // Create NavButtonItem for the central phone button with carousel animation
  const PhoneOrderButton = () => {
    // Check if we're on home screen
    const isHomeScreen = currentPath === '/(main)/home' || currentPath === '(main)/home' || currentPath === '/home' || currentPath?.includes('home');
    const [isAIMode, setIsAIMode] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;
    const user = useAuthStore((state) => state.user);
    const [latestOrderTime, setLatestOrderTime] = useState<string | null>(null);
    const [latestOrderId, setLatestOrderId] = useState<string | null>(null);

    // Long press state for AI transition
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [isPreloadingVideo, setIsPreloadingVideo] = useState(false);
    // videoUrl is now fetched at parent level and passed via closure
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const preloadVideoRef = useRef<Video>(null);
    const hasLongPressed = useRef(false); // Track if long press was completed
    const pressStartTime = useRef<number>(0); // Track when press started
    const wasQuickTap = useRef(false); // Track if this was a quick tap (to prevent timer from firing)

    // Fetch latest active order time
    useEffect(() => {
      if (!user?.id) {
        setLatestOrderTime(null);
        return;
      }

      const fetchLatestOrderTime = async () => {
        try {
          const ACTIVE_STATUSES = ['pending', 'confirmed', 'accepted', 'processing', 'picked_up', 'in_transit', 'out_for_delivery', 'shipped'];
          const { data, error } = await supabase
            .from('orders')
            .select('id, order_number, created_at, updated_at')
            .eq('user_id', user.id)
            .in('status', ACTIVE_STATUSES)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            const order = data[0];
            const timeString = order.updated_at || order.created_at;
            if (timeString) {
              const date = new Date(timeString);
              const hours = date.getHours();
              const minutes = date.getMinutes();
              const ampm = hours >= 12 ? 'pm' : 'am';
              const displayHours = hours % 12 || 12;
              const displayMinutes = minutes.toString().padStart(2, '0');
              setLatestOrderTime(`${displayHours}:${displayMinutes} ${ampm}`);
            } else {
              setLatestOrderTime(null);
            }

            // Get short order ID
            const shortOrderId = order.order_number
              ? order.order_number.slice(-6).toUpperCase()
              : order.id.slice(-6).toUpperCase();
            setLatestOrderId(shortOrderId);
          } else {
            setLatestOrderTime(null);
            setLatestOrderId(null);
          }
        } catch (error) {
          console.error('Error fetching latest order time:', error);
          setLatestOrderTime(null);
          setLatestOrderId(null);
        }
      };

      fetchLatestOrderTime();

      // Subscribe to order changes
      const subscription = supabase
        .channel('phone_button_order_time')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchLatestOrderTime();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }, [user?.id]);

    // NOTE: videoUrl is now fetched at parent (BottomNav) level to prevent infinite loop
    // The nested component was being recreated on every render, causing useEffect to run repeatedly

    // Auto-carousel effect - switch icons every 3 seconds
    useEffect(() => {
      const interval = setInterval(() => {
        // Animate flip
        Animated.sequence([
          Animated.timing(flipAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(flipAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Toggle icon in the middle of animation
        setTimeout(() => {
          setIsAIMode(prev => !prev);
        }, 200);
      }, 3000);

      return () => clearInterval(interval);
    }, [flipAnim]);

    // Pulse animation when long pressing
    useEffect(() => {
      if (isLongPressing) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.3,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
      }
    }, [isLongPressing, pulseAnim]);


    const handlePhonePress = () => {
      // Only prevent navigation if long press timer actually completed (1000ms hold)
      // Quick taps will always go through
      if (hasLongPressed.current) {
        hasLongPressed.current = false; // Reset for next interaction
        wasQuickTap.current = false;
        return;
      }

      // Mark this as a quick tap to prevent timer from firing
      wasQuickTap.current = true;

      // CRITICAL: Clear any pending long press timer to prevent it from firing after navigation
      // This prevents the AI chat from opening after a quick tap
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Also reset long press state
      setIsLongPressing(false);
      setIsPreloadingVideo(false);
      progressAnim.setValue(0);

      // Trigger haptic feedback
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        // Haptics not available
      }

      // Navigate to phone order screen WITHOUT AI mode (regular phone order)
      router.push('/(main)/phone-order?aiMode=false');
      setActiveTab('/(main)/phone-order');
    };

    const handleLongPressStart = async () => {
      hasLongPressed.current = false; // Reset flag when starting new press
      wasQuickTap.current = false; // Reset quick tap flag
      pressStartTime.current = Date.now(); // Record when press started
      setIsLongPressing(true);
      setIsPreloadingVideo(true); // Start preloading video immediately
      progressAnim.setValue(0);

      // Store video URL in AsyncStorage immediately so PhoneOrder can start loading it
      try {
        if (videoUrl && videoUrl !== FALLBACK_VIDEO_URL) {
          await AsyncStorage.setItem('ai_transition_video_url', videoUrl);
          await AsyncStorage.setItem('ai_transition_video_preloaded', 'false'); // Reset preload status
          console.log('[BottomNav] Stored video URL in AsyncStorage for preloading:', videoUrl);

          // Video component will auto-start loading when mounted
          // We'll track its status via onPlaybackStatusUpdate and onReadyForDisplay
        }
      } catch (err) {
        console.log('[BottomNav] Failed to store video URL:', err);
      }

      // Start progress animation
      // Progress animation for 1 second
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
        easing: Easing.linear,
      }).start();

      // Haptic feedback for starting long press
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) { }

      // Navigate to AI mode after 1 second of holding
      // During this time, video is being preloaded
      longPressTimer.current = setTimeout(async () => {
        // Strong haptic when activated
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { }

        hasLongPressed.current = true; // Mark that long press was completed
        setIsLongPressing(false);

        // Check if video is preloaded, if not wait a bit more
        const preloaded = await AsyncStorage.getItem('ai_transition_video_preloaded');
        if (preloaded !== 'true' && preloadVideoRef.current) {
          console.log('[BottomNav] Video not fully preloaded yet, waiting a bit more...');
          // Wait up to 500ms more for video to finish loading
          let attempts = 0;
          const checkPreload = setInterval(async () => {
            attempts++;
            const status = await AsyncStorage.getItem('ai_transition_video_preloaded');
            if (status === 'true' || attempts >= 10) {
              clearInterval(checkPreload);
              console.log('[BottomNav] Video preload check complete, navigating...');
              triggerAITransition();
            }
          }, 50);
        } else {
          triggerAITransition();
        }
      }, 1000);
    };

    const handleLongPressEnd = () => {
      setIsLongPressing(false);
      setIsPreloadingVideo(false); // Stop preloading if user releases early
      progressAnim.setValue(0);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      // Note: hasLongPressed will only be true if timer completed (1000ms)
      // If user releases early, hasLongPressed stays false and onPress will proceed normally
      // Don't reset wasQuickTap here - let onPress handle it if it's a quick tap
    };

    const triggerAITransition = () => {
      // CRITICAL: Don't navigate if this was a quick tap (user already navigated)
      if (wasQuickTap.current) {
        wasQuickTap.current = false; // Reset for next interaction
        return;
      }

      // Navigate to AI mode immediately - animation is handled by the phone-order page
      router.push('/(main)/phone-order?aiMode=true');
      setActiveTab('/(main)/phone-order');
      // Stop preloading after navigation starts
      setTimeout(() => setIsPreloadingVideo(false), 500);
    };

    const isActive = isPhoneOrderActive;

    // Calculate animation values
    const scale = flipAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.8, 1],
    });
    const rotateY = flipAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ['0deg', '90deg', '0deg'],
    });

    // Progress ring for long press
    const progressRotate = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <>
        <View style={styles.callButtonContainer}>
          {/* View Other Orders Button - only show on home screen, if there are orders, and tracker is visible */}
          {latestOrderTime && latestOrderId && isHomeScreen && isTrackerVisible && (
            <Animated.View
              style={{
                opacity,
                transform: [{ translateY }],
              }}
            >
              <Pressable
                onPress={() => {
                  if (viewOtherOrdersRef.current) {
                    viewOtherOrdersRef.current();
                  }
                }}
                style={styles.viewOtherOrdersButtonTop}
              >
                <Text style={styles.viewOtherOrdersTextTop}>
                  {translations.viewAllOrders}
                </Text>
                <IconButton icon="chevron-up" size={16} iconColor={COLORS.orange} style={styles.viewOtherOrdersIconTop} />
              </Pressable>
            </Animated.View>
          )}

          <Pressable
            onPress={handlePhonePress}
            onPressIn={handleLongPressStart}
            onPressOut={handleLongPressEnd}
          >
            <Surface style={[
              styles.callButtonSurface,
              isActive && styles.callButtonSurfaceActive,
            ]}>
              {/* Long press progress ring */}
              {isLongPressing && (
                <Animated.View style={[
                  styles.progressRing,
                  { transform: [{ rotate: progressRotate }] }
                ]}>
                  <View style={styles.progressArc} />
                </Animated.View>
              )}
              <Animated.View style={{
                transform: [{ scale: isLongPressing ? pulseAnim : scale }, { rotateY }],
              }}>
                <IconButton
                  icon={isAIMode ? "robot" : "phone"}
                  size={30}
                  mode="contained"
                  iconColor="#FFFFFF"
                  containerColor={isLongPressing ? '#4CAF50' : (isActive ? (isAIMode ? '#4CAF50' : '#FF5722') : COLORS.orange)}
                  style={[
                    styles.callButton,
                    isActive && styles.callButtonActive
                  ]}
                />
              </Animated.View>
            </Surface>
          </Pressable>
          <View style={styles.callLabelContainer}>
            <Text style={[
              styles.callButtonLabel,
              isActive && styles.callButtonLabelActive,
              isLongPressing && { color: '#4CAF50', fontWeight: '700' }
            ]}>
              {isLongPressing ? `✨ ${translations.aiMode}` : (isAIMode ? translations.pressHoldForAI : translations.callToOrder)}
            </Text>
          </View>
        </View>

        {/* Hidden Video component for preloading when long-pressing */}
        {isPreloadingVideo && (
          <Video
            ref={preloadVideoRef}
            source={{ uri: videoUrl }}
            style={{ width: 0, height: 0, opacity: 0 }}
            shouldPlay={false}
            isMuted={true}
            onLoadStart={() => {
              console.log('[BottomNav] Video preload started');
            }}
            onPlaybackStatusUpdate={async (status: AVPlaybackStatus) => {
              if (status.isLoaded && !status.isBuffering) {
                console.log('[BottomNav] AI video preloaded and ready');
                try {
                  await AsyncStorage.setItem('ai_transition_video_preloaded', 'true');
                } catch (err) {
                  console.log('[BottomNav] Error storing preload status:', err);
                }
              }
            }}
            onReadyForDisplay={async () => {
              console.log('[BottomNav] Preload video ready for display');
              try {
                await AsyncStorage.setItem('ai_transition_video_preloaded', 'true');
              } catch (err) {
                console.log('[BottomNav] Error storing preload status:', err);
              }
            }}
            onLoad={(status) => {
              if (status.isLoaded) {
                console.log('[BottomNav] Preload video loaded');
                AsyncStorage.setItem('ai_transition_video_preloaded', 'true').catch(() => { });
              }
            }}
          />
        )}
      </>
    );
  };

  return (
    <View style={styles.outerContainer}>
      {/* Bottom Navigation - conditionally visible */}
      <Animated.View style={[
        styles.navBarContainer,
        {
          transform: [{ translateY }],
          opacity
        }
      ]}>
        {/* Premium Glass Effect (Translucent Fallback) */}
        <View style={styles.blurView}>
          {/* Bottom Navigation */}
          <View style={styles.container}>
            <NavItem path="(main)/home" icon="home" label={translations.home} />
            <NavItem path="(main)/stock" icon="share-variant" label={translations.stockSharing} />

            {/* Empty space for the middle button */}
            <View style={styles.middleSpace} />

            <NavItem path="(main)/loans" icon="cash" label={translations.loans} />
            <NavItem path="(main)/profile" icon="account" label={translations.profile} />
          </View>
        </View>
      </Animated.View>

      {/* Call to Order floating button - always visible, positioned in bottom nav */}
      <PhoneOrderButton />

      {/* Active Order Tracker - only show on home screen (strict path matching) */}
      {(() => {
        const shouldShowTracker = isHomeScreen(currentPath);
        console.log('[BottomNav] Tracker render check - currentPath:', currentPath, 'isHomeScreen:', shouldShowTracker);
        return shouldShowTracker ? (
          <Animated.View
            style={[
              styles.activeOrderTrackerWrapper,
              {
                transform: [{ translateY }],
                opacity
              }
            ]}
            pointerEvents={isVisible ? 'box-none' : 'none'}
          >
            <ActiveOrderTracker
              onViewOtherOrdersRef={viewOtherOrdersRef}
              onVisibilityChangeRef={trackerVisibilityRef}
            />
          </Animated.View>
        ) : null;
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    paddingTop: 0, // No padding needed since button will be positioned relative to nav
  },
  activeOrderTrackerWrapper: {
    position: 'absolute',
    bottom: 72, // Lowered slightly as requested
    left: 0,
    right: 0,
    zIndex: 50, // Higher than nav bar background but lower than call button (100)
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 6,
    height: 68, // Increased height for better visibility
  },
  navBarContainer: {
    marginHorizontal: 16,
    marginBottom: 5, // Moved closer to bottom to create more space above for browse button
    borderRadius: 34, // Fully rounded pill (half of height)
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    elevation: 20, // Premium floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    overflow: 'hidden', // Keep content inside pill
  },
  blurView: {
    flex: 1,
    width: '100%',
  },
  // Removed Notch Styles entirely for minimalist floating look
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingVertical: 4,
  },
  middleSpace: {
    width: 70, // Space for floating button
  },
  label: {
    fontSize: 11,
    color: '#9E9E9E', // Lighter grey for inactive
    marginTop: -2, // Reduce gap between icon and label
    textAlign: 'center',
    fontWeight: '500',
  },
  activeNavText: {
    color: COLORS.orange,
    fontWeight: '700',
  },
  // Enhanced Call Button
  callButtonContainer: {
    position: 'absolute',
    bottom: 42, // Position so half button (32px) bumps above nav bar (nav at bottom: 5, nav height: 68, center at 5+34=39, so button center at 39+3=42)
    alignSelf: 'center',
    zIndex: 100,
    elevation: 25, // Higher than nav bar
    alignItems: 'center',
  },
  orderTimeContainer: {
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderTimeText: {
    fontSize: 10,
    color: '#757575',
    fontWeight: '600',
  },
  callButtonSurface: {
    width: 64,
    height: 64,
    borderRadius: 32,
    elevation: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible', // Allow pulse to be seen
    borderWidth: 4,
    borderColor: '#F5F5F7', // Subtle border to separate from background content
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  callButton: {
    margin: 0,
  },
  callButtonSurfaceActive: {
    backgroundColor: '#FF5722',
    borderColor: '#FFCCBC',
    transform: [{ scale: 1.1 }],
  },
  callButtonActive: {
    // No border change needed on icon itself
  },
  callLabelContainer: {
    position: 'absolute',
    bottom: -22,
    width: 100, // Fixed width to prevent wrapping issues
    alignSelf: 'center', // Center properly
    alignItems: 'center',
    left: '50%', // Center horizontally
    marginLeft: -50, // Half of width
  },
  callButtonLabel: {
    textAlign: 'center',
    color: '#757575',
    backgroundColor: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '600',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  callButtonLabelActive: {
    color: COLORS.orange,
    fontWeight: 'bold',
    backgroundColor: '#FFF',
  },
  // AI Transition Animation Styles
  progressRing: {
    position: 'absolute',
    width: 74, // Larger than button
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#4CAF50',
    borderRightColor: '#4CAF50',
    top: -5, // Center over button (border width offset)
    left: -5,
  },
  progressArc: {
    width: '100%',
    height: '100%',
  },
  activeIndicator: {
    position: 'absolute',
    top: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  viewOtherOrdersButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  viewOtherOrdersTextTop: {
    fontSize: 10,
    color: COLORS.orange,
    fontWeight: '600',
  },
  viewOtherOrdersIconTop: {
    margin: 0,
    width: 16,
    height: 16,
  },
});