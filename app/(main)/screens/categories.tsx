import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { IconButton, Card, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../../../hooks/useTranslation';
import { COLORS } from '../../../constants/theme';
import { CategoryGrid, CategoryGridHandle } from '../../../components/home/CategoryGrid';
import { useBottomNav } from '../../../contexts/BottomNavContext';

// Safe router hook with validation
const useSafeRouter = () => {
  let router;

  try {
    router = useRouter();
  } catch (error) {
    console.error('[Categories] Error initializing router:', error);
    router = null;
  }

  // Create safe router wrapper
  const safeRouter = {
    push: (path: string) => {
      if (router && typeof router.push === 'function') {
        router.push(path);
      } else {
        console.warn('[Categories] router.push not available for path:', path);
      }
    },
    replace: (path: string) => {
      if (router && typeof router.replace === 'function') {
        router.replace(path);
      } else {
        console.warn('[Categories] router.replace not available for path:', path);
      }
    },
    back: () => {
      if (router && typeof router.back === 'function') {
        router.back();
      } else {
        console.warn('[Categories] router.back not available');
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

export default function Categories() {
  const router = useSafeRouter();
  const categoryGridRef = useRef<CategoryGridHandle>(null);
  const navigation = useNavigation();
  const { hide: hideBottomNav, show: showBottomNav } = useBottomNav();

  // Scroll-based auto-hide/show
  const scrollY = useRef(0);
  const previousScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const isHeaderHidden = useRef(false);
  const lastAnimationTime = useRef(0);

  // Animated padding for grid container
  const headerHeight = useRef(new Animated.Value(56)).current;

  const hideHeader = useCallback(() => {
    if (isHeaderHidden.current) return;
    isHeaderHidden.current = true;

    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: -70,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 80,
        useNativeDriver: false, // paddingTop can't use native driver
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [headerTranslateY, headerOpacity, headerHeight]);

  const showHeader = useCallback(() => {
    if (!isHeaderHidden.current) return;
    isHeaderHidden.current = false;

    Animated.parallel([
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(headerHeight, {
        toValue: 56,
        duration: 120,
        useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [headerTranslateY, headerOpacity, headerHeight]);

  const handleScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - previousScrollY.current;
    const now = Date.now();

    // Throttle animation triggers to max once per 100ms
    if (now - lastAnimationTime.current < 100) {
      scrollY.current = currentScrollY;
      return;
    }

    // Only trigger if scrolled more than 10px to avoid jitter
    if (Math.abs(scrollDifference) > 10) {
      if (scrollDifference > 0 && currentScrollY > 50) {
        // Scrolling DOWN - Hide header and bottom navigation
        if (!isHeaderHidden.current) {
          hideHeader();
          hideBottomNav();
          lastAnimationTime.current = now;
        }
      } else if (scrollDifference < 0) {
        // Scrolling UP - Show header and bottom navigation
        if (isHeaderHidden.current) {
          showHeader();
          showBottomNav();
          lastAnimationTime.current = now;
        }
      }
      previousScrollY.current = currentScrollY;
    }

    scrollY.current = currentScrollY;
  }, [hideHeader, showHeader, hideBottomNav, showBottomNav]);

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }]
          }}
        >
          <LinearGradient
            colors={['#FFF8E1', 'rgba(255,255,255,0.95)']}
            locations={[0, 1]}
            style={styles.header}
          >
            <IconButton
              icon="arrow-left"
              onPress={() => router.back()}
              containerColor="rgba(255,255,255,0.8)"
              iconColor="#333"
              size={24}
              style={{ marginLeft: 0 }}
            />
            <Text style={styles.headerTitle}>Categories</Text>
            <IconButton
              icon="magnify"
              onPress={() => categoryGridRef.current?.toggleSearch()}
              containerColor="rgba(255,255,255,0.8)"
              iconColor="#333"
              size={24}
            />
          </LinearGradient>
        </Animated.View>
        <Animated.View style={[styles.gridContainer, { paddingTop: headerHeight }]}>
          <CategoryGrid
            ref={categoryGridRef}
            hideHeader={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 24, // Minimal status bar padding instead of full SafeAreaView
  },
  container: {
    flex: 1,
  },
  gridContainer: {
    flex: 1,
    // paddingTop is now animated via headerHeight
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    // Background is now from LinearGradient wrapper
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
});