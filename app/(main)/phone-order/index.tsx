import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Linking, Platform, Image, ScrollView, Pressable, TouchableOpacity, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, SafeAreaView, BackHandler, Modal, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Card, Button, IconButton, List, Divider, Surface, FAB } from 'react-native-paper';
import { Link, useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { SystemStatusBar } from '../../../components/SystemStatusBar';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useLocalSearchParams } from 'expo-router';
import AIChatInterface from '../../../components/ai/AIChatInterface';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { supabase } from '../../../services/supabase/supabase';

import { translationService } from '../../../services/translationService';

import { getCurrentUser } from '../../../services/auth/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback video URL if database fetch fails
const FALLBACK_VIDEO_URL = 'https://xcpznnkpjgyrpbvpnvit.supabase.co/storage/v1/object/sign/ai_transition_video/Ai%20transition.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83MjUxM2M2Mi00NWZjLTRlMDMtODA4OC03Y2VlZjZjNDc3ZDUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhaV90cmFuc2l0aW9uX3ZpZGVvL0FpIHRyYW5zaXRpb24ubXA0IiwiaWF0IjoxNzY1MDM0MDIxLCJleHAiOjE5MjI3MTQwMjF9.8NELzj9txtETJboGfkPyB8O5ftB6p2XX_FCL06VZCvw';

// Phone numbers for order placement
const OFFICE_PHONE = '+918089668552'; // Replace with your actual office phone number
const SUPPORT_PHONE = '+918089668552'; // Replace with your actual support phone number

// Interfaces
interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface OrderSession {
  id: string;
  items: CartItem[];
  total: number;
  timestamp: Date;
}

export default function PhoneOrder() {
  let router;

  try {
    router = useRouter();
  } catch (error) {
    console.error('[PhoneOrder] Error initializing router:', error);
    router = null;
  }

  // Language hook with error handling
  const { currentLanguage } = useLanguage();

  // Original English text (never changes)
  const originalTexts = {
    orderByCall: 'Order by Call',
    quickAndConvenient: 'Quick and Convenient',
    placeYourOrderNow: 'Place Your Order Now',
    ourRepresentativesAvailable: 'Our representatives are available to help you place orders quickly and efficiently.',
    callNow: 'Call Now',
    whatsApp: 'WhatsApp',
    availableMonSat9to6: 'Available Mon-Sat 9 AM to 6 PM',
    howToPlaceOrderByPhone: 'How to Place Order by Phone',
    callOurOrderDesk: 'Call Our Order Desk',
    dialOurNumberDuringHours: 'Dial our number during business hours and speak with our friendly staff.',
    provideYourDetails: 'Provide Your Details',
    shareNameBusinessAddress: 'Share your name, business address, and contact information.',
    specifyProducts: 'Specify Products',
    tellUsProductsQuantities: 'Tell us the products you need and their quantities.',
    confirmOrder: 'Confirm Order',
    reviewOrderConfirmPayment: 'Review your order details and confirm payment method.',
    needAssistance: 'Need Assistance?',
    customerSupportReady: 'Our customer support team is ready to help with any questions.',
    callCustomerSupport: 'Call Customer Support',
    // AI transition/loading texts
    daiIsWakingUp: 'Dai is waking up...',
    ready: 'Ready!',
    aiPowered: 'AI Powered',
    meetDai: 'Meet Dai - Your AI Assistant',
    chatWithDai: 'Chat with Dai',
    meetDaiDescription: 'Chat with our AI agent to place orders using voice, text or image. Get instant product recommendations and seamless ordering experience.'
  };

  // Dynamic translations state
  const [translations, setTranslations] = useState(originalTexts);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        console.log('[PhoneOrder] Loading translations for language:', currentLanguage);

        // Add safety check for currentLanguage
        if (!currentLanguage) {
          console.log('[PhoneOrder] currentLanguage is undefined, using original texts');
          setTranslations(originalTexts);
          return;
        }

        if (currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like other screens)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          console.log(`[PhoneOrder] Translating "${key}": "${value}" to ${currentLanguage}`);
          const translated = await translationService.translateText(value, currentLanguage);
          console.log(`[PhoneOrder] Translation result for "${key}":`, translated);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        console.log('[PhoneOrder] All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('[PhoneOrder] Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Translation function
  const t = (key: string) => {
    return translations[key as keyof typeof translations] || key;
  };
  const insets = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { aiMode } = useLocalSearchParams<{ aiMode?: string }>();

  // Add validation to prevent ReferenceError
  if (!router || typeof router !== 'object') {
    console.error('[PhoneOrder] Router is not available or invalid');
    return null;
  }

  // Additional safety check for router methods
  const safeRouter = {
    push: router.push?.bind(router) || (() => console.warn('[PhoneOrder] router.push not available')),
    replace: router.replace?.bind(router) || (() => console.warn('[PhoneOrder] router.replace not available')),
    back: router.back?.bind(router) || (() => console.warn('[PhoneOrder] router.back not available')),
    canGoBack: router.canGoBack?.bind(router) || (() => false)
  };

  // Interface state
  const [isAIMode, setIsAIMode] = useState(false);
  const [cart, setCart] = useState<OrderSession>({ id: '', items: [], total: 0, timestamp: new Date() });
  const [userId, setUserId] = useState<string>('');
  const [isUserIdLoading, setIsUserIdLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string>(() => `phone-order-${Date.now()}`);

  // AI Transition video state
  const [showAITransition, setShowAITransition] = useState(false);
  const [videoPhase, setVideoPhase] = useState<'intro' | 'playing' | 'outro' | 'done'>('done');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [introAnimDone, setIntroAnimDone] = useState(false);
  const videoRef = useRef<Video>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Magical intro animation values
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const robotPathAnim = useRef(new Animated.Value(0)).current; // 0-1 controls path around screen
  const robotScaleAnim = useRef(new Animated.Value(0)).current;
  const robotRotateAnim = useRef(new Animated.Value(0)).current;
  const burstScaleAnim = useRef(new Animated.Value(1)).current; // For burst out transition
  const introFadeAnim = useRef(new Animated.Value(1)).current; // Controls fade out of intro elements
  const videoFadeAnim = useRef(new Animated.Value(0)).current; // Controls fade in of video
  const daiCometAnim = useRef(new Animated.Value(0)).current; // Comet animation around Dai card border
  const [daiCardDimensions, setDaiCardDimensions] = useState({ width: 0, height: 0 }); // Store card dimensions

  // Particle trail animations (8 particles that follow robot)
  const particleAnims = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      offsetX: new Animated.Value(0),
      offsetY: new Animated.Value(0),
    }))
  ).current;

  // Video URL state - fetched from database (null means no video to play)
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Fetch video URL - first check AsyncStorage (preloaded by BottomNav), then database
  useEffect(() => {
    const fetchVideoUrl = async () => {
      try {
        // First, try to get from AsyncStorage (preloaded by BottomNav during long press)
        const cachedUrl = await AsyncStorage.getItem('ai_transition_video_url');
        const isPreloaded = await AsyncStorage.getItem('ai_transition_video_preloaded');

        if (cachedUrl && cachedUrl.trim() !== '') {
          console.log('[PhoneOrder] Using preloaded video URL from AsyncStorage:', cachedUrl);
          console.log('[PhoneOrder] Video preload status:', isPreloaded);
          setVideoUrl(cachedUrl);

          // If video was preloaded by BottomNav, mark it as ready immediately
          if (isPreloaded === 'true') {
            console.log('[PhoneOrder] Video was preloaded by BottomNav - marking as ready');
            setIsVideoReady(true);
          } else {
            setIsVideoReady(false);
          }
          return; // Use cached URL, no need to fetch from database
        }

        // If not in cache, fetch from database
        console.log('[PhoneOrder] Video URL not in cache, fetching from database...');
        const { data, error } = await supabase
          .from('ai_transition_video')
          .select('video_url')
          .limit(1);

        if (error) {
          console.log('[PhoneOrder] Error fetching video URL:', error.message);
          console.log('[PhoneOrder] Error details:', error);
          setVideoUrl(null); // No video to play
          return;
        }

        console.log('[PhoneOrder] Video URL query result:', { data, dataType: typeof data, isArray: Array.isArray(data) });

        // Get first row if array has items
        const videoData = Array.isArray(data) && data.length > 0 ? data[0] : (data || null);

        console.log('[PhoneOrder] Extracted video data:', videoData);

        if (videoData?.video_url && typeof videoData.video_url === 'string' && videoData.video_url.trim() !== '') {
          console.log('[PhoneOrder] Fetched video URL from database:', videoData.video_url);
          setVideoUrl(videoData.video_url);
          // Store in AsyncStorage for future use
          await AsyncStorage.setItem('ai_transition_video_url', videoData.video_url);
          // Reset video ready state when URL changes
          setIsVideoReady(false);

          // If we're already in intro phase and waiting, trigger re-check
          if (videoPhase === 'intro' && introAnimDone) {
            console.log('[PhoneOrder] Video URL loaded during intro - will transition to playing when ready');
          }
        } else {
          console.log('[PhoneOrder] No valid video URL found. videoData:', videoData);
          setVideoUrl(null);
        }
      } catch (err) {
        console.log('[PhoneOrder] Failed to fetch video URL - skipping video:', err);
        setVideoUrl(null);
      }
    };

    fetchVideoUrl();
  }, []);

  // Handle Android hardware back button
  useEffect(() => {
    const backAction = () => {
      if (showAITransition) {
        return true; // Prevent back during transition
      }
      if (isAIMode) {
        // If in AI mode, exit AI mode instead of navigating back
        setIsAIMode(false);
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior (navigate back)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [isAIMode, showAITransition]);

  // Comet animation around Dai card border
  useEffect(() => {
    const startCometAnimation = () => {
      daiCometAnim.setValue(0);
      Animated.loop(
        Animated.timing(daiCometAnim, {
          toValue: 1,
          duration: 4000, // 4 seconds for full loop
          easing: Easing.linear,
          useNativeDriver: false, // Must be false for left/top positioning
        })
      ).start();
    };
    startCometAnimation();
  }, []);

  // Handle aiMode URL parameter - start magical intro animation
  useEffect(() => {
    if (aiMode === 'true' && !isAIMode) {
      console.log('[PhoneOrder] AI mode enabled - starting magical transition');
      console.log('[PhoneOrder] Current video URL state:', videoUrl);
      setIsAIMode(true);
      setShowAITransition(true);
      setVideoPhase('intro');
      setIsVideoReady(false);
      setIntroAnimDone(false);

      // Reset all animations
      fadeAnim.setValue(0);
      robotPathAnim.setValue(0);
      robotScaleAnim.setValue(0);
      robotRotateAnim.setValue(0);
      introFadeAnim.setValue(1); // Show intro elements
      videoFadeAnim.setValue(0); // Hide video initially
      particleAnims.forEach(p => {
        p.opacity.setValue(0);
        p.scale.setValue(0);
        p.offsetX.setValue(0);
        p.offsetY.setValue(0);
      });

      // ===== MAGICAL INTRO ANIMATION =====
      // Dai pops out from button, travels around screen edges with particle trails

      // Fade in dark overlay
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Robot pops out from button with bounce
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(robotScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();

      // Robot travels around screen edges (0 to 1)
      // Path: bottom-center -> right -> top -> left -> center
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(robotPathAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.cubic),
        }),
      ]).start();

      // Robot rotates while moving
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(robotRotateAnim, {
          toValue: 2, // 2 full rotations
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ]).start();

      // Particle trail animations - particles spawn and drift away
      particleAnims.forEach((particle, index) => {
        const delay = 400 + index * 120; // Stagger particles
        const angle = (index / particleAnims.length) * Math.PI * 2;
        const driftX = Math.cos(angle) * 80;
        const driftY = Math.sin(angle) * 80;

        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            // Fade in
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // Scale up
            Animated.spring(particle.scale, {
              toValue: 1,
              friction: 6,
              useNativeDriver: true,
            }),
            // Drift away
            Animated.timing(particle.offsetX, {
              toValue: driftX,
              duration: 800,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
            Animated.timing(particle.offsetY, {
              toValue: driftY,
              duration: 800,
              useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            }),
          ]),
          // Fade out
          Animated.timing(particle.opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });

      // Minimum animation time - wait for full robot animation (1.8 seconds total)
      // This ensures the animation completes before transitioning to video
      setTimeout(() => {
        console.log('[PhoneOrder] Intro animation time elapsed (1.8s)');
        setIntroAnimDone(true);
      }, 1800); // Match the robot animation duration (300ms delay + 1500ms animation)

      // SKIP VIDEO if it takes too long (5 seconds max - enough for animation + loading)
      // Go directly to AI chat instead of waiting
      setTimeout(() => {
        if (videoPhase === 'intro') {
          console.log('[PhoneOrder] Video taking too long - skipping to AI chat');
          setVideoPhase('done');
          setShowAITransition(false);
        }
      }, 5000);
    }
  }, [aiMode]);

  // Start playing video AS SOON AS IT'S READY, even during intro animation
  // This ensures smooth transition - video plays as soon as buffered
  useEffect(() => {
    if (videoUrl && isVideoReady) {
      // If we're in intro phase, transition to playing
      if (videoPhase === 'intro') {
        console.log('[PhoneOrder] Video is ready during intro - starting playback immediately!');

        // Fade out intro elements and fade in video smoothly
        Animated.parallel([
          Animated.timing(introFadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(videoFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();

        setVideoPhase('playing');
      }
      // If we're already in playing phase but video just became ready, ensure it's playing
      else if (videoPhase === 'playing') {
        console.log('[PhoneOrder] Video became ready while in playing phase - ensuring playback');
        // Video should already be playing, but we can trigger a refresh if needed
      }
    }
  }, [videoPhase, isVideoReady, videoUrl]);

  // Fallback: If animation completes but video isn't ready yet, wait for it
  useEffect(() => {
    if (videoPhase === 'intro' && introAnimDone) {
      // Wait a bit for video URL to be fetched (it might still be loading asynchronously)
      if (videoUrl === null) {
        console.log('[PhoneOrder] Video URL not yet loaded - waiting for fetch to complete...');
        const waitForUrl = setTimeout(() => {
          // After 1.5 seconds, if still no URL, skip to AI chat
          if (videoUrl === null && videoPhase === 'intro') {
            console.log('[PhoneOrder] No video URL after waiting - skipping to AI chat');
            setVideoPhase('done');
            setShowAITransition(false);
          }
        }, 1500);

        return () => clearTimeout(waitForUrl);
      }

      // If video URL exists but not ready yet, wait for it to become ready
      // Don't start playing until video is actually ready
      if (!isVideoReady) {
        console.log('[PhoneOrder] Animation done but video not ready - waiting for video to load...');
        // Video will transition to playing when isVideoReady becomes true (handled by other useEffect)
      }
    }
  }, [videoPhase, introAnimDone, isVideoReady, videoUrl]);

  // Handle video playback status - wrap in setTimeout to run on main thread
  const handleVideoPlaybackStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      // Video is loaded and buffered
      if (!isVideoReady && status.isBuffering === false) {
        console.log('[PhoneOrder] Video is ready to play', {
          duration: status.durationMillis,
          position: status.positionMillis,
          isPlaying: status.isPlaying
        });
        setTimeout(() => {
          setIsVideoReady(true);

          // If we're in intro phase and video is ready, transition to playing immediately
          // Don't wait for animation to complete - play as soon as ready
          if (videoPhase === 'intro') {
            console.log('[PhoneOrder] Video ready during intro - transitioning to playing immediately');
            // Fade out intro and fade in video
            Animated.parallel([
              Animated.timing(introFadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(videoFadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
            setVideoPhase('playing');
          }
        }, 0);
      }
      if (status.didJustFinish) {
        console.log('[PhoneOrder] Video finished, starting outro animation');
        setTimeout(() => startOutroAnimation(), 0);
      }

      // Log any errors in playback
      if (status.error) {
        console.log('[PhoneOrder] Video playback error:', status.error);
      }
    } else if (status.error) {
      console.log('[PhoneOrder] Video load error:', status.error);
    }
  };

  // Handle video ready to play - wrap in setTimeout to run on main thread
  const handleVideoReadyForDisplay = () => {
    console.log('[PhoneOrder] Video ready for display');
    setTimeout(() => {
      if (!isVideoReady) {
        setIsVideoReady(true);
        // If we're in intro phase, transition to playing immediately (don't wait for animation)
        if (videoPhase === 'intro') {
          console.log('[PhoneOrder] Video ready for display during intro - transitioning to playing immediately');
          // Fade out intro and fade in video
          Animated.parallel([
            Animated.timing(introFadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(videoFadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
          setVideoPhase('playing');
        }
      }
    }, 0);
  };

  // Video component auto-loads when rendered
  // We track its loading status via onLoad, onReadyForDisplay, and onPlaybackStatusUpdate
  // No need to manually call prepareAsync - Video component handles it automatically

  // If video is already preloaded (from BottomNav), mark it as ready immediately
  useEffect(() => {
    if (showAITransition && videoUrl) {
      AsyncStorage.getItem('ai_transition_video_preloaded').then((preloaded) => {
        if (preloaded === 'true') {
          console.log('[PhoneOrder] Video was preloaded by BottomNav - marking as ready');
          setIsVideoReady(true);
        }
      }).catch(() => { });
    }
  }, [showAITransition, videoUrl]);

  // Outro animation - burst out transition
  const startOutroAnimation = () => {
    setVideoPhase('outro');
    // Reset burst scale
    burstScaleAnim.setValue(1);

    Animated.parallel([
      // Quick fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      // Burst scale up (explode outward)
      Animated.timing(burstScaleAnim, {
        toValue: 3,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start(() => {
      console.log('[PhoneOrder] Transition complete');
      setVideoPhase('done');
      setShowAITransition(false);
    });
  };

  // Fallback: dismiss after timeout if video doesn't load/finish
  useEffect(() => {
    if (showAITransition) {
      const fallbackTimer = setTimeout(() => {
        console.log('[PhoneOrder] Transition fallback timeout - dismissing');
        if (videoPhase !== 'outro' && videoPhase !== 'done') {
          startOutroAnimation();
        }
      }, 10000); // 10 second fallback for 6 second video + buffers

      return () => clearTimeout(fallbackTimer);
    }
  }, [showAITransition, videoPhase]);

  // Load conversation ID from AsyncStorage on mount
  useEffect(() => {
    const loadConversationId = async () => {
      try {
        const storedConvId = await AsyncStorage.getItem('phoneOrderConversationId');
        if (storedConvId) {
          console.log('[PhoneOrder] Loaded conversation ID from storage:', storedConvId);
          setConversationId(storedConvId);
        } else {
          // Generate a new conversation ID if none exists
          const newConvId = `phone-order-${Date.now()}`;
          console.log('[PhoneOrder] Generated new conversation ID:', newConvId);
          setConversationId(newConvId);
          await AsyncStorage.setItem('phoneOrderConversationId', newConvId);
        }
      } catch (error) {
        console.error('[PhoneOrder] Error loading conversation ID:', error);
      }
    };
    loadConversationId();
  }, []);

  // Save conversation ID when it changes
  useEffect(() => {
    if (conversationId) {
      AsyncStorage.setItem('phoneOrderConversationId', conversationId).catch(err =>
        console.error('[PhoneOrder] Error saving conversation ID:', err)
      );
    }
  }, [conversationId]);

  // Get user ID on component mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        // Try to get current user from Supabase
        const user = await getCurrentUser();
        if (user?.id) {
          setUserId(user.id);
          return;
        }

        // Fallback: try to get from AsyncStorage
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          return;
        }

        // Generate a temporary user ID for testing
        const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setUserId(tempUserId);
        console.log('Generated temporary user ID:', tempUserId);
      } catch (error) {
        console.error('Error getting user ID:', error);
        // Generate a temporary user ID as fallback
        const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setUserId(tempUserId);
      }
    };

    getUserId();
  }, []);

  // Direct text strings instead of translations
  const getTranslatedText = (text: string) => {
    const texts: Record<string, string> = {
      'AI Agent \'Dai\'': 'AI Agent \'Dai\'',
      'Clear Cart': 'Clear Cart',
      'Are you sure you want to clear your cart?': 'Are you sure you want to clear your cart?',
      'Cancel': 'Cancel',
      'Clear': 'Clear',
      'Error': 'Error',
      'Failed to process your message. Please try again.': 'Failed to process your message. Please try again.',
      'AI Agent Not Ready': 'AI Agent Not Ready',
      'Please wait for the AI agent to initialize.': 'Please wait for the AI agent to initialize.',
      'I would like to order some vegetables': 'I would like to order some vegetables',
      'Hi! I\'m Dai, your AI ordering assistant. How can I help you place an order today?': 'Hi! I\'m Dai, your AI ordering assistant. How can I help you place an order today?',
      'Listening...': 'Listening...',
      'Tap to speak': 'Tap to speak',
      'Type your message...': 'Type your message...',
      'Initializing AI Agent...': 'Initializing AI Agent...',
      'Speaking...': 'Speaking...',
      'Processing...': 'Processing...',
      'Your Order': 'Your Order',
      'Total:': 'Total:',
      'Meet Dai - Your AI Assistant': 'Meet Dai - Your AI Assistant',
      'Chat with our AI agent to place orders using voice or text. Get instant product recommendations and seamless ordering experience.': 'Chat with our AI agent to place orders using voice or text. Get instant product recommendations and seamless ordering experience.',
      'Chat with Dai': 'Chat with Dai'
    };
    return texts[text] || text;
  };



  const clearCart = () => {
    setCart({ id: '', items: [], total: 0, timestamp: new Date() });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  // Phone order handlers
  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = (phoneNumber: string) => {
    const whatsappNumber = phoneNumber.replace('+', '');
    Linking.openURL(`https://wa.me/${whatsappNumber}?text=I%20want%20to%20place%20an%20order`);
  };

  // Render AI mode interface
  const renderAIInterface = () => {
    if (!userId) {
      return (
        <View style={styles.aiContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF7D00" />
            <Text style={styles.loadingText}>Initializing AI Assistant...</Text>
            <TouchableOpacity
              style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FF7D00', borderRadius: 24 }}
              onPress={() => {
                const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.log('[PhoneOrder] User clicked Start Chat Now, ID:', tempUserId);
                setUserId(tempUserId);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Start Chat Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        style={styles.aiContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {/* AI Chat Interface */}
        <AIChatInterface
          userId={userId}
          conversationId={conversationId}
          onNewConversation={(newConvId) => {
            console.log('New conversation started:', newConvId);
            setConversationId(newConvId);
          }}
          onMessageSent={(message) => {
            console.log('Message sent:', message);
          }}
          onBack={() => {
            // Exit AI mode and go back to phone order screen
            setIsAIMode(false);
          }}
          style={{ flex: 1 }}
          placeholder="Type your order here..."
          showVoiceButton={true}
          compact={false}
        />
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={[styles.mainSafeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.safeAreaContainer}>
        <SystemStatusBar style="dark" />

        {/* Custom header - hide when in AI mode */}
        {!isAIMode && (
          <View style={styles.header}>
            <Link href="/(main)/home" asChild>
              <TouchableOpacity style={styles.backButton}>
                <IconButton icon="arrow-left" size={24} />
              </TouchableOpacity>
            </Link>
            <Text style={styles.headerTitle}>
              {t('orderByCall')}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setIsAIMode(!isAIMode)}
                style={[styles.aiToggle, isAIMode && styles.aiToggleActive]}
              >
                <IconButton
                  icon="chat"
                  size={20}
                  iconColor="#667eea"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isAIMode ? (
          renderAIInterface()
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Top Section - Order by Call & Meet Dai Together */}
              <View style={styles.topSection}>
                {/* Order by Call Card */}
                <View style={styles.orderCard}>
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderIconContainer}>
                      <IconButton
                        icon="phone"
                        size={24}
                        iconColor="#FF7D00"
                        style={styles.orderIcon}
                      />
                    </View>
                    <View style={styles.orderCardContent}>
                      <Text style={styles.orderCardTitle}>{t('orderByCall')}</Text>
                      <Text style={styles.orderCardSubtitle}>{t('quickAndConvenient')}</Text>
                    </View>
                  </View>

                  <View style={styles.orderActionsRow}>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => handleCall(OFFICE_PHONE)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#FF7D00', '#FFAB58']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.callButtonGradient}
                      >
                        <IconButton icon="phone" size={20} iconColor="#FFFFFF" style={styles.callButtonIcon} />
                        <Text style={styles.callButtonText}>{t('callNow')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.whatsappButton}
                      onPress={() => handleWhatsApp(OFFICE_PHONE)}
                      activeOpacity={0.7}
                    >
                      <IconButton icon="whatsapp" size={20} iconColor="#25D366" style={styles.whatsappButtonIcon} />
                      <Text style={styles.whatsappButtonText}>{t('whatsApp')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.hoursRow}>
                    <IconButton icon="clock-outline" size={16} iconColor="#808080" style={styles.hoursIconSmall} />
                    <Text style={styles.hoursTextSmall}>{t('availableMonSat9to6')}</Text>
                  </View>
                </View>

                {/* Meet Dai Card - Premium AI Feature Highlight */}
                <View
                  style={styles.daiCardWrapper}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    if (width > 0 && height > 0) {
                      setDaiCardDimensions({ width, height });
                    }
                  }}
                >
                  {/* Comet Animation Around Border */}
                  {daiCardDimensions.width > 0 && daiCardDimensions.height > 0 && (
                    <Animated.View
                      style={[
                        styles.comet,
                        {
                          left: daiCometAnim.interpolate({
                            inputRange: [0, 0.25, 0.5, 0.75, 1],
                            outputRange: [
                              -12, // Top-left corner
                              daiCardDimensions.width - 12, // Top-right corner
                              daiCardDimensions.width - 12, // Bottom-right corner
                              -12, // Bottom-left corner
                              -12, // Back to top-left
                            ],
                          }),
                          top: daiCometAnim.interpolate({
                            inputRange: [0, 0.25, 0.5, 0.75, 1],
                            outputRange: [
                              -12, // Top-left corner
                              -12, // Top-right corner
                              daiCardDimensions.height - 12, // Bottom-right corner
                              daiCardDimensions.height - 12, // Bottom-left corner
                              -12, // Back to top-left
                            ],
                          }),
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={['#FF7D00', '#FFAB58', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cometGradient}
                      />
                    </Animated.View>
                  )}

                  <LinearGradient
                    colors={['#FFF5E6', '#FFFFFF', '#FFF5E6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.daiCardGradient}
                  >
                    <View style={styles.daiCard}>
                      {/* AI Badge */}
                      <View style={styles.daiBadge}>
                        <IconButton icon="star" size={14} iconColor="#FF7D00" style={styles.daiBadgeIcon} />
                        <Text style={styles.daiBadgeText}>{t('aiPowered')}</Text>
                      </View>

                      <View style={styles.daiCardHeader}>
                        <View style={styles.daiIconContainer}>
                          <LinearGradient
                            colors={['#FF7D00', '#FFAB58']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.daiIconGradient}
                          >
                            <IconButton icon="robot" size={28} iconColor="#FFFFFF" style={styles.daiIcon} />
                          </LinearGradient>
                        </View>
                        <View style={styles.daiCardContent}>
                          <Text style={styles.daiCardTitle}>
                            {t('meetDai')}
                          </Text>
                          <Text style={styles.daiCardSubtitle}>
                            {t('meetDaiDescription')}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.daiButton}
                        onPress={() => setIsAIMode(true)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={['#FF7D00', '#FFAB58']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.daiButtonGradient}
                        >
                          <IconButton icon="chat" size={20} iconColor="#FFFFFF" style={styles.daiButtonIcon} />
                          <Text style={styles.daiButtonText}>{t('chatWithDai')}</Text>
                          <IconButton icon="arrow-right" size={18} iconColor="#FFFFFF" style={styles.daiButtonArrow} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              </View>

              {/* How It Works - Refined Step Cards */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{t('howToPlaceOrderByPhone')}</Text>

                <View style={styles.stepsContainer}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{t('callOurOrderDesk')}</Text>
                      <Text style={styles.stepDescription}>{t('dialOurNumberDuringHours')}</Text>
                    </View>
                    <IconButton icon="phone" size={20} iconColor="#4CAF50" style={styles.stepIcon} />
                  </View>

                  <View style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{t('provideYourDetails')}</Text>
                      <Text style={styles.stepDescription}>{t('shareNameBusinessAddress')}</Text>
                    </View>
                    <IconButton icon="account" size={20} iconColor="#2196F3" style={styles.stepIcon} />
                  </View>

                  <View style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{t('specifyProducts')}</Text>
                      <Text style={styles.stepDescription}>{t('tellUsProductsQuantities')}</Text>
                    </View>
                    <IconButton icon="cart" size={20} iconColor="#FF9800" style={styles.stepIcon} />
                  </View>

                  <View style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{t('confirmOrder')}</Text>
                      <Text style={styles.stepDescription}>{t('reviewOrderConfirmPayment')}</Text>
                    </View>
                    <IconButton icon="check-circle" size={20} iconColor="#FF7D00" style={styles.stepIcon} />
                  </View>
                </View>
              </View>

              {/* Support Card - Premium Design */}
              <View style={styles.supportCardContainer}>
                <View style={styles.supportCard}>
                  <View style={styles.supportHeader}>
                    <View style={styles.supportIconContainer}>
                      <IconButton icon="headphones" size={24} iconColor="#FF7D00" style={styles.supportIcon} />
                    </View>
                    <View style={styles.supportTextContainer}>
                      <Text style={styles.supportTitle}>
                        {t('needAssistance')}
                      </Text>
                      <Text style={styles.supportDescription}>
                        {t('customerSupportReady')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.supportButton}
                    onPress={() => handleCall(SUPPORT_PHONE)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#FF7D00', '#FFAB58']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.supportButtonGradient}
                    >
                      <IconButton icon="phone" size={18} iconColor="#FFFFFF" style={styles.supportButtonIcon} />
                      <Text style={styles.supportButtonText}>{t('callCustomerSupport')}</Text>
                      <IconButton icon="arrow-right" size={18} iconColor="#FFFFFF" style={styles.supportButtonArrow} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Extra padding view to ensure content is scrollable past the bottom nav */}
              <View style={styles.bottomSpacer} />
            </View>
          </ScrollView>
        )}
      </View>

      {/* AI Transition Video Overlay */}
      <Modal
        visible={showAITransition}
        transparent={true}
        animationType="none"
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.videoOverlay,
            {
              opacity: fadeAnim,
              // Transparent during intro, dark background when video is playing
              backgroundColor: (videoPhase === 'playing' && isVideoReady) ? '#000000' : 'rgba(0,0,0,0.85)',
            }
          ]}
        >
          {/* Robot and particles - fade out smoothly when video starts playing */}
          <Animated.View
            style={{
              opacity: introFadeAnim,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            pointerEvents={videoPhase === 'playing' ? 'none' : 'auto'}
          >
            {/* Particle trails */}
            {particleAnims.map((particle, index) => (
              <Animated.View
                key={`particle-${index}`}
                style={[
                  styles.particle,
                  {
                    opacity: Animated.multiply(particle.opacity, introFadeAnim),
                    transform: [
                      // Follow robot position
                      {
                        translateX: Animated.add(
                          robotPathAnim.interpolate({
                            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                            outputRange: [0, screenWidth * 0.35, screenWidth * 0.35, -screenWidth * 0.35, -screenWidth * 0.35, 0],
                          }),
                          particle.offsetX
                        ),
                      },
                      {
                        translateY: Animated.add(
                          robotPathAnim.interpolate({
                            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                            outputRange: [screenHeight * 0.35, screenHeight * 0.1, -screenHeight * 0.3, -screenHeight * 0.3, screenHeight * 0.1, 0],
                          }),
                          particle.offsetY
                        ),
                      },
                      { scale: particle.scale },
                    ],
                    backgroundColor: index % 3 === 0 ? '#4CAF50' : index % 3 === 1 ? '#00BCD4' : '#FF9800',
                    // Glow effect for particles
                    shadowColor: index % 3 === 0 ? '#4CAF50' : index % 3 === 1 ? '#00BCD4' : '#FF9800',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 6,
                  }
                ]}
              />
            ))}

            {/* Robot that travels around screen edges */}
            <Animated.View
              style={[
                styles.movingRobot,
                {
                  transform: [
                    // Path around screen edges: bottom -> right -> top -> left -> center
                    {
                      translateX: robotPathAnim.interpolate({
                        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                        outputRange: [0, screenWidth * 0.35, screenWidth * 0.35, -screenWidth * 0.35, -screenWidth * 0.35, 0],
                      }),
                    },
                    {
                      translateY: robotPathAnim.interpolate({
                        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                        outputRange: [screenHeight * 0.35, screenHeight * 0.1, -screenHeight * 0.3, -screenHeight * 0.3, screenHeight * 0.1, 0],
                      }),
                    },
                    // Rotate while moving
                    {
                      rotate: robotRotateAnim.interpolate({
                        inputRange: [0, 2],
                        outputRange: ['0deg', '720deg'],
                      }),
                    },
                    { scale: robotScaleAnim },
                  ],
                }
              ]}
            >
              <LinearGradient
                colors={['#FF9800', '#F57C00']}
                style={styles.robotGlowContainer}
              >
                {/* Glowing ring */}
                <View style={styles.robotInnerGlow} />
                <IconButton icon="robot" iconColor="#FFF" size={28} style={{ margin: 0 }} />
              </LinearGradient>
            </Animated.View>

            {/* "Dai is waking up" Text - appears when robot reaches center */}
            <Animated.View
              style={[
                styles.introTextContainer,
                {
                  opacity: robotPathAnim.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0, 0, 1],
                  }),
                  transform: [{
                    translateY: robotPathAnim.interpolate({
                      inputRange: [0.8, 1],
                      outputRange: [20, 0],
                      extrapolate: 'clamp',
                    }),
                  }],
                }
              ]}
            >
              <Text style={styles.introSubtitle}>{t('daiIsWakingUp')}</Text>
              {isVideoReady && (
                <Text style={styles.introReady}>{t('ready')}</Text>
              )}
            </Animated.View>
          </Animated.View>

          {/* Video component - ALWAYS render when modal is open and URL exists, even if hidden */}
          {/* This ensures video starts loading immediately when transition begins */}
          {showAITransition && videoUrl && (
            <Animated.View
              style={[
                styles.transitionVideoContainer,
                {
                  transform: [{ scale: burstScaleAnim }],
                  opacity: videoFadeAnim,
                }
              ]}
            >
              <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={styles.transitionVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay={videoPhase === 'playing' && isVideoReady}
                isLooping={false}
                isMuted={false}
                useNativeControls={false}
                onPlaybackStatusUpdate={handleVideoPlaybackStatus}
                onReadyForDisplay={handleVideoReadyForDisplay}
                onLoadStart={() => {
                  console.log('[PhoneOrder] Video started loading - this happens during intro animation');
                }}
                onLoad={(status) => {
                  console.log('[PhoneOrder] Video loaded event fired:', {
                    isLoaded: status.isLoaded,
                    duration: status.isLoaded ? status.durationMillis : null
                  });
                  // Video is loaded, mark as ready and transition to playing if in intro
                  if (status.isLoaded) {
                    console.log('[PhoneOrder] Video loaded - marking as ready');
                    setIsVideoReady(true);

                    // If we're in intro phase, transition to playing immediately
                    if (videoPhase === 'intro') {
                      console.log('[PhoneOrder] Video loaded during intro - transitioning to playing');
                      setTimeout(() => {
                        // Fade out intro and fade in video
                        Animated.parallel([
                          Animated.timing(introFadeAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                          }),
                          Animated.timing(videoFadeAnim, {
                            toValue: 1,
                            duration: 300,
                            useNativeDriver: true,
                          }),
                        ]).start();
                        setVideoPhase('playing');
                      }, 100);
                    }
                  }
                }}
                onError={(error) => {
                  console.log('[PhoneOrder] Video error:', error);
                  startOutroAnimation();
                }}
              />
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainSafeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeAreaContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#37474F',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  // Top Section - Order by Call & Meet Dai Together
  topSection: {
    marginBottom: 24,
    gap: 16,
  },
  // Order by Call Card
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  orderCardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  orderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderIcon: {
    margin: 0,
  },
  orderCardContent: {
    flex: 1,
  },
  orderCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#37474F',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  orderCardSubtitle: {
    fontSize: 14,
    color: '#808080',
    lineHeight: 20,
  },
  orderActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  callButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  callButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  callButtonIcon: {
    margin: 0,
    marginRight: 8,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  whatsappButtonIcon: {
    margin: 0,
    marginRight: 8,
  },
  whatsappButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#25D366',
    letterSpacing: 0.3,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  hoursIconSmall: {
    margin: 0,
    marginRight: 6,
  },
  hoursTextSmall: {
    fontSize: 13,
    color: '#808080',
    fontWeight: '400',
  },
  // Meet Dai Card - Premium AI Feature Highlight
  daiCardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  daiCardGradient: {
    borderRadius: 20,
  },
  daiCard: {
    padding: 24,
    borderRadius: 18,
  },
  daiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  daiBadgeIcon: {
    margin: 0,
    marginRight: 4,
  },
  daiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF7D00',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  daiCardHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  daiIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  daiIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  daiIcon: {
    margin: 0,
  },
  daiCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  daiCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#37474F',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  daiCardSubtitle: {
    fontSize: 11,
    color: '#808080',
    lineHeight: 15,
  },
  daiButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  daiButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  daiButtonIcon: {
    margin: 0,
    marginRight: 10,
  },
  daiButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  daiButtonArrow: {
    margin: 0,
    marginLeft: 10,
  },
  // Comet Animation Styles
  comet: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 10,
  },
  cometGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    opacity: 0.9,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  // Section Container
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#37474F',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  // Steps Container
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#FF7D00',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF7D00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
    marginRight: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#37474F',
    marginBottom: 3,
  },
  stepDescription: {
    fontSize: 13,
    color: '#808080',
    lineHeight: 18,
  },
  stepIcon: {
    margin: 0,
  },
  // Support Card - Premium Design
  supportCardContainer: {
    marginBottom: 24,
  },
  supportCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  supportHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportIcon: {
    margin: 0,
  },
  supportTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#37474F',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  supportDescription: {
    fontSize: 14,
    color: '#808080',
    lineHeight: 20,
  },
  supportButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  supportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  supportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  supportButtonIcon: {
    margin: 0,
    marginRight: 8,
  },
  supportButtonArrow: {
    margin: 0,
    marginLeft: 8,
  },
  // Legacy styles (kept for compatibility)
  headerBanner: {
    height: 0,
  },
  bannerImage: {
    display: 'none',
  },
  bannerOverlay: {
    display: 'none',
  },
  bannerTitle: {
    display: 'none',
  },
  bannerSubtitle: {
    display: 'none',
  },
  callNowCard: {
    display: 'none',
  },
  callNowTitle: {
    display: 'none',
  },
  callNowDescription: {
    display: 'none',
  },
  callButtonsRow: {
    display: 'none',
  },
  callNowButton: {
    display: 'none',
  },
  whatsappButton: {
    display: 'none',
  },
  callNowButtonContent: {
    display: 'none',
  },
  callNowButtonLabel: {
    display: 'none',
  },
  callHours: {
    display: 'none',
  },
  instructionCard: {
    display: 'none',
  },
  instructionTitle: {
    display: 'none',
  },
  listItem: {
    display: 'none',
  },
  divider: {
    display: 'none',
  },
  aiAgentCard: {
    display: 'none',
  },
  aiAgentTitle: {
    display: 'none',
  },
  aiAgentText: {
    display: 'none',
  },
  aiAgentButton: {
    display: 'none',
  },
  aiAgentButtonContent: {
    paddingVertical: 4,
  },
  aiAgentButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#EBF5FB',
  },
  supportTitle: {
    marginBottom: 8,
    fontWeight: '600',
  },
  supportText: {
    marginBottom: 12,
    color: '#555',
  },
  supportButton: {
    marginTop: 8,
    backgroundColor: '#2196F3',
  },
  bottomSpacer: {
    height: 120, // Increased height to ensure content is fully visible
  },
  // AI Interface Styles
  aiContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  aiKeyboardContainer: {
    flex: 1,
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conversationContent: {
    paddingTop: 8,
    paddingBottom: 140, // Adequate padding for input area
    flexGrow: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 50,
  },
  welcomeText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    lineHeight: 24,
  },
  initializingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  initializingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  conversationItem: {
    marginBottom: 12,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  agentMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  transcriptBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: 'white',
  },
  agentText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  transcriptLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
    fontStyle: 'italic',
    marginTop: 4,
  },
  processingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  cartCard: {
    margin: 16,
    elevation: 2,
    marginBottom: 16,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cartItemDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  cartDivider: {
    marginVertical: 8,
  },
  cartTotal: {
    alignItems: 'flex-end',
  },
  cartTotalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  voiceInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  micButton: {
    marginBottom: 8,
  },
  micButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  micButtonActive: {
    backgroundColor: '#FF5722',
  },
  micLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleButton: {
    marginLeft: 12,
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 4,
  },
  aiToggle: {
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  aiToggleActive: {
    backgroundColor: '#667eea',
  },
  // AI Transition Video Styles
  videoOverlay: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent during intro to show home screen
    justifyContent: 'center',
    alignItems: 'center',
  },
  transitionVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  transitionVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  // Magical Animation Styles
  circuitContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  circuitLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#00BCD4',
    opacity: 0.3,
  },
  circuitLineVertical: {
    position: 'absolute',
    width: 1,
    backgroundColor: '#00BCD4',
    opacity: 0.3,
  },
  circuitNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  centerGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    marginTop: -100,
    marginLeft: -100,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 10,
  },
  movingRobot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  robotContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  robotEmoji: {
    fontSize: 50,
  },
  robotGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  introTextContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(76, 175, 80, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
    marginBottom: 8,
  },
  introSubtitle: {
    color: '#00BCD4',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 188, 212, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  introReady: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textShadowColor: 'rgba(76, 175, 80, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  // Legacy intro styles (kept for backwards compatibility)
  introContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  introEmoji: {
    fontSize: 100,
    marginBottom: 20,
  },
  introText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(76, 175, 80, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  robotGlowContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  robotInnerGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 0,
  },
});