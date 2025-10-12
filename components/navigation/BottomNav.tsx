import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { IconButton, Surface } from 'react-native-paper';
import { useLanguage } from '../../contexts/LanguageContext';
import { COLORS } from '../../constants/theme';
import * as Haptics from 'expo-haptics';

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

// Import usePathname properly or use alternative for getting current path
const usePathname = () => {
  // If expo-router doesn't export usePathname, we can use a fallback approach
  try {
    // Add proper null checking to avoid "Cannot convert null value to object" error
    const internal = (global as any).__INTERNAL__;
    if (internal && 
        internal.router && 
        internal.router.state && 
        internal.router.state.location && 
        internal.router.state.location.pathname) {
      return internal.router.state.location.pathname;
    }
    return '(main)/home'; // Fallback to home
  } catch (e) {
    console.warn('Error accessing path:', e);
    return '(main)/home';
  }
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

export function BottomNav() {
  const currentPath = usePathname();
  const [activeTab, setActiveTab] = useState(currentPath || '(main)/home');
  const { translateText } = useLanguage();
  const router = useSafeRouter(); // Use safe router instead of useRouter directly
  const [translations, setTranslations] = useState({
    home: 'Home',
    stockSharing: 'Stock Sharing',
    loans: 'Loans',
    profile: 'Profile',
    callToOrder: 'Call To Order'
  });

  // Load translations when component mounts or language changes
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const [home, stockSharing, loans, profile, callToOrder] = await Promise.all([
          translateText('Home'),
          translateText('Stock Sharing'),
          translateText('Loans'),
          translateText('Profile'),
          translateText('Call To Order')
        ]);
        
        setTranslations({
          home,
          stockSharing,
          loans,
          profile,
          callToOrder
        });
      } catch (error) {
        console.error('Translation loading error:', error);
        // Keep default English values on error
      }
    };

    loadTranslations();
  }, [translateText]);

  // Update active tab when pathname changes
  useEffect(() => {
    if (currentPath) {
      setActiveTab(currentPath);
    }
  }, [currentPath]);

  const isActive = (path: string) => {
    return activeTab === path;
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
          <View>
            <IconButton 
              icon={icon} 
              size={24}
              iconColor={active ? COLORS.orange : COLORS.grey}
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

  // Create NavButtonItem for the central phone button
  const PhoneOrderButton = () => {
    const [isAIMode, setIsAIMode] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    
    const handlePhonePress = () => {
      // Navigate to phone order screen with AI mode state
      const phoneOrderParams = new URLSearchParams({ aiMode: isAIMode ? 'true' : 'false' });
      router.push(`/(main)/phone-order?${phoneOrderParams.toString()}`);
      setActiveTab('/(main)/phone-order');
    };
    
    const handleLongPressStart = () => {
      const timer = setTimeout(() => {
        setIsAIMode(true);
        // Add haptic feedback if available
        if (Platform.OS === 'ios') {
          const { HapticFeedback } = require('expo-haptics');
          HapticFeedback?.impactAsync(HapticFeedback.ImpactFeedbackStyle.Medium);
        }
      }, 800); // 800ms long press
      setLongPressTimer(timer);
    };
    
    const handleLongPressEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
    };
    
    const handlePressOut = () => {
      handleLongPressEnd();
      // Reset to phone mode after 3 seconds if in AI mode
      if (isAIMode) {
        setTimeout(() => {
          setIsAIMode(false);
        }, 3000);
      }
    };
    
    const isActive = isPhoneOrderActive;
    
    return (
      <View style={styles.callButtonContainer}>
        <Pressable 
          onPress={handlePhonePress}
          onPressIn={handleLongPressStart}
          onPressOut={handlePressOut}
          onLongPress={() => {}}
        >
          <Surface style={[
            styles.callButtonSurface,
            isActive && styles.callButtonSurfaceActive,
            isAIMode && styles.aiModeButton
          ]}>
            <View>
              <IconButton 
                icon={isAIMode ? "chat" : "phone"}
                size={30}
                mode="contained" 
                iconColor="#FFFFFF"
                containerColor={isActive ? (isAIMode ? '#4CAF50' : '#FF5722') : COLORS.orange}
                style={[
                  styles.callButton,
                  isActive && styles.callButtonActive
                ]}
              />
            </View>
          </Surface>
        </Pressable>
        {isActive && (
          <Text style={styles.callButtonLabel}>
            {isAIMode ? 'Dai AI' : translations.callToOrder}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.outerContainer}>
      {/* Semi-circular notch for the call button */}
      <View style={styles.notchContainer}>
        <View style={styles.notch} />
      </View>

      {/* Call to Order floating button - using Link with a wrapped View */}
      <PhoneOrderButton />

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
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.grey,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    position: 'relative',
    zIndex: 1,
  },
  notchContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: -10,
    width: 70,
    height: 20,
    overflow: 'hidden',
    zIndex: 2,
  },
  notch: {
    width: 70,
    height: 40,
    borderRadius: 35,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.grey,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  middleSpace: {
    width: 60,
    height: 8,
  },
  label: {
    fontSize: 12,
    color: COLORS.grey,
    marginTop: -4,
    textAlign: 'center',
    fontWeight: '500',
  },
  activeNavText: {
    color: COLORS.orange,
    fontWeight: 'bold',
  },
  callButtonContainer: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    zIndex: 10,
  },
  callButtonSurface: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  callButton: {
    margin: 0,
  },
  callButtonSurfaceActive: {
    backgroundColor: '#FF5722',
    transform: [{ scale: 1.08 }],
  },
  callButtonActive: {
    borderColor: '#FF5722',
  },
  aiModeButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  callButtonLabel: {
    position: 'absolute',
    bottom: -18,
    left: -20,
    right: -20,
    textAlign: 'center',
    color: COLORS.orange,
    backgroundColor: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    elevation: 2,
  },
});