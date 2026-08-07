import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase/supabase';
import { DynamicBanners } from '../dynamic/DynamicBanners';
import { ProductCarousel } from './ProductCarousel';
import { CategoryCarousel } from './CategoryCarousel';
import { NearbyWholesalers } from './NearbyWholesalers';
import { NearbyManufacturers } from './NearbyManufacturers';
import { useAuthStore } from '../../store/auth';
import { useInstantTranslation } from '../../hooks/useInstantTranslation';

// Simple in-memory cache for home sections
let sectionsCache: { data: HomeSection[] | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const STORAGE_KEY = '@home_sections_cache';

// Original texts for translation - defined outside component for stability
const ORIGINAL_TEXTS = {
  nearbyWholesalers: "Nearby Wholesalers",
  nearbyManufacturers: "Nearby Manufacturers",
  shopByCategory: "Shop by Category",
  featuredProducts: "Featured Products",
  trendingProducts: "Trending Products",
  recommendedForYou: "Recommended for You",
  newArrivals: "New Arrivals",
  loadingContent: "Loading content...",
};

interface HomeSection {
  id: string;
  section_type: 'banner' | 'categories' | 'products' | 'sellers' | 'manufacturers' | 'personalized';
  title: string;
  display_order: number;
  is_active: boolean;
  config: {
    filter?: string;
    limit?: number;
    show_title?: boolean;
    seller_type?: string;
    auto_scroll?: boolean;
    interval?: number;
    show_product_count?: boolean;
  };
}

interface DynamicHomeSectionsProps {
  userId?: string;
}

export function DynamicHomeSections({ userId: propUserId }: DynamicHomeSectionsProps) {
  // Use specific selectors to prevent re-renders when user object reference changes
  // but the actual values we care about haven't changed
  const storeUserId = useAuthStore((state) => state.user?.id);
  const userRole = useAuthStore((state) => state.user?.role);

  // Defensive data check: Use prop userId or fall back to store user id
  const userId = propUserId || storeUserId;

  // Use instant translation hook for section titles - provides cached translations immediately
  // This ensures consistent translation behavior with other components
  const { t } = useInstantTranslation(ORIGINAL_TEXTS);

  // Debug: Log translations whenever they change
  console.log(`[DynamicHomeSections] Current translations: nearbyWholesalers="${t.nearbyWholesalers}", nearbyManufacturers="${t.nearbyManufacturers}"`);

  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [useDynamicSections, setUseDynamicSections] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Track if initial load has completed to prevent re-showing loading state
  const hasInitiallyLoaded = useRef(false);
  const appState = useRef(AppState.currentState);
  const fetchAbortController = useRef<AbortController | null>(null);

  // Load from cache first, then fetch fresh data
  useEffect(() => {
    let isMounted = true;

    const initializeSections = async () => {
      const hasExistingData = sections.length > 0;

      // Step 1: Check memory cache first (fastest)
      const isMemoryCacheValid = sectionsCache.data && (Date.now() - sectionsCache.timestamp < CACHE_TTL);

      if (isMemoryCacheValid && sectionsCache.data && sectionsCache.data.length > 0 && isMounted) {
        console.log('[DynamicHomeSections] Using memory cached sections');
        setSections(sectionsCache.data);
        setUseDynamicSections(true);
        setLoading(false);
        hasInitiallyLoaded.current = true;
        // Background refresh
        fetchHomeSections(true);
        return;
      }

      // Step 2: Check AsyncStorage cache (persisted across app restarts)
      try {
        const storedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedData && isMounted) {
          const parsed = JSON.parse(storedData);
          if (parsed.sections && parsed.sections.length > 0) {
            console.log('[DynamicHomeSections] Using AsyncStorage cached sections');
            setSections(parsed.sections);
            setUseDynamicSections(true);
            setLoading(false);
            hasInitiallyLoaded.current = true;
            // Populate memory cache
            sectionsCache = { data: parsed.sections, timestamp: Date.now() };
            // Background refresh
            fetchHomeSections(true);
            return;
          }
        }
      } catch (error) {
        console.warn('[DynamicHomeSections] Error loading from AsyncStorage:', error);
      }

      // Step 3: No cache available - show default layout immediately
      if (!hasExistingData && isMounted) {
        console.log('[DynamicHomeSections] No cache, showing default layout');
        setUseDynamicSections(false);
        setLoading(false);
        hasInitiallyLoaded.current = true;
        // Fetch in background and cache for next time
        fetchHomeSections(true);
      } else if (hasExistingData) {
        // Have existing data, refresh in background
        setLoading(false);
        fetchHomeSections(true);
      }
    };

    if (userId || !hasInitiallyLoaded.current) {
      initializeSections();
    }

    return () => {
      isMounted = false;
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
    };
  }, [userId]);

  // Handle app state changes - refresh data when app comes to foreground
  // OPTIMIZED: Add debouncing to prevent rapid refreshes
  const lastRefreshTimeRef = useRef<number>(0);
  const REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refreshes

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        hasInitiallyLoaded.current
      ) {
        const now = Date.now();
        // Only refresh if enough time has passed since last refresh
        if (now - lastRefreshTimeRef.current > REFRESH_COOLDOWN) {
          lastRefreshTimeRef.current = now;
          // Don't show loading state, just refresh in background
          fetchHomeSections(true);
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);



  const fetchHomeSections = async (isBackgroundRefresh: boolean = false) => {
    // Abort any previous fetch
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    fetchAbortController.current = new AbortController();

    // Only show loading state if not a background refresh and not already loaded
    if (!isBackgroundRefresh && !hasInitiallyLoaded.current) {
      setLoading(true);
    }

    // Set up timeout for the fetch operation - reduced for faster fallback
    // For initial load, show default layout immediately if fetch takes too long
    const FETCH_TIMEOUT = isBackgroundRefresh ? 3000 : 2000; // 2s for initial (faster fallback), 3s for background
    const timeoutId = setTimeout(() => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
      if (!isBackgroundRefresh && !hasInitiallyLoaded.current) {
        console.warn('[DynamicHomeSections] Fetch timed out, using default layout');
        setHasTimedOut(true);
        setUseDynamicSections(false);
        setLoading(false);
        // CRITICAL: Mark as loaded so default layout shows immediately
        hasInitiallyLoaded.current = true;
      }
    }, FETCH_TIMEOUT);

    try {
      // Try to fetch dynamic home sections from database
      const { data, error } = await supabase
        .from('home_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      clearTimeout(timeoutId);

      if (error) {
        console.log('[DynamicHomeSections] No dynamic home sections configured, using default layout:', error.message);
        if (!isBackgroundRefresh) {
          setUseDynamicSections(false);
          setLoading(false);
          // CRITICAL: Mark as loaded so default layout shows
          hasInitiallyLoaded.current = true;
        }
        return;
      }

      if (data && data.length > 0) {
        // Deduplicate sections by section_type + display_order combination
        // This allows multiple sections of same type (e.g., multiple 'products' sections)
        // but prevents true duplicates (same type at same order)
        // OPTIMIZED: Only log if there are actual duplicates to reduce log noise
        const seen = new Set<string>();
        let duplicateCount = 0;
        const uniqueSections = data.filter((section) => {
          const key = `${section.section_type}-${section.display_order}`;
          if (seen.has(key)) {
            duplicateCount++;
            return false;
          }
          seen.add(key);
          return true;
        });

        // Only log if duplicates were found or if this is not a background refresh
        if (duplicateCount > 0 || !isBackgroundRefresh) {
          console.log(`[DynamicHomeSections] Filtered ${data.length} sections to ${uniqueSections.length} unique sections${duplicateCount > 0 ? ` (removed ${duplicateCount} duplicates)` : ''}`);
        }

        // CRITICAL FIX: Don't switch layout after initial render to prevent jarring layout shift
        // If we're already showing the default layout, keep using it this session
        // Dynamic layout will be used on next app launch when cache is available
        if (hasInitiallyLoaded.current && !useDynamicSections) {
          console.log('[DynamicHomeSections] Default layout already shown, caching for next session');
          // Cache the sections for next app launch (both memory and AsyncStorage)
          sectionsCache = { data: uniqueSections, timestamp: Date.now() };
          // Persist to AsyncStorage for next app launch
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ sections: uniqueSections, timestamp: Date.now() }));
          } catch (e) {
            console.warn('[DynamicHomeSections] Failed to persist sections:', e);
          }
          return;
        }

        // Only update state if sections actually changed to prevent unnecessary re-renders
        const currentSectionsKey = sections.map(s => `${s.section_type}-${s.display_order}`).join(',');
        const newSectionsKey = uniqueSections.map(s => `${s.section_type}-${s.display_order}`).join(',');

        if (currentSectionsKey !== newSectionsKey) {
          setSections(uniqueSections);
          setUseDynamicSections(true);
          setHasTimedOut(false);

          // Cache the sections in memory and AsyncStorage
          sectionsCache = { data: uniqueSections, timestamp: Date.now() };
          // Persist to AsyncStorage for next app launch
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ sections: uniqueSections, timestamp: Date.now() }));
          } catch (e) {
            console.warn('[DynamicHomeSections] Failed to persist sections:', e);
          }
        }

        // If this was a background refresh and we now have dynamic sections, ensure loaded state
        if (isBackgroundRefresh && !hasInitiallyLoaded.current) {
          hasInitiallyLoaded.current = true;
        }
      } else {
        console.log('[DynamicHomeSections] No home sections found, using default layout');
        if (!isBackgroundRefresh) {
          setUseDynamicSections(false);
          // CRITICAL: Mark as loaded so default layout shows
          hasInitiallyLoaded.current = true;
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Ignore abort errors
      if (error?.name === 'AbortError') {
        console.log('[DynamicHomeSections] Fetch aborted');
        return;
      }

      console.error('[DynamicHomeSections] Error fetching home sections:', error);
      if (!isBackgroundRefresh) {
        setUseDynamicSections(false);
        // CRITICAL: Mark as loaded so default layout shows even on error
        hasInitiallyLoaded.current = true;
      }
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
        // Ensure hasInitiallyLoaded is set if not already set
        if (!hasInitiallyLoaded.current) {
          hasInitiallyLoaded.current = true;
        }
      }
    }
  };

  const renderSection = (section: HomeSection) => {
    const config = section.config || {};

    switch (section.section_type) {
      case 'banner':
        return (
          <View key={section.id} style={styles.section}>
            <DynamicBanners
              config={{
                auto_scroll: config.auto_scroll !== false,
                interval: config.interval || 3000,
              }}
            />
          </View>
        );

      case 'categories':
        return (
          <View key={section.id} style={styles.section}>
            <CategoryCarousel
              title={section.title || t.shopByCategory}
              limit={config.limit || 20}
              showProductCount={config.show_product_count !== false}
            />
          </View>
        );

      case 'products':
        return (
          <View key={section.id} style={styles.section}>
            <ProductCarousel
              title={section.title || t.featuredProducts}
              filter={config.filter as any || 'all'}
              limit={config.limit || 10}
            />
          </View>
        );

      case 'personalized':
        // Defensive data check: Only show for logged-in users with valid userId
        if (!userId) {
          console.log('[DynamicHomeSections] Skipping personalized section - no userId available');
          return null;
        }
        return (
          <View key={section.id} style={styles.section}>
            <ProductCarousel
              title={section.title || t.recommendedForYou}
              filter="personalized"
              limit={config.limit || 10}
              userId={userId}
            />
          </View>
        );

      case 'sellers':
        // Always use translated title for sellers section
        // section.title from database is typically in English, so we ignore it for translation
        console.log(`[DynamicHomeSections] Rendering 'sellers' section: using translated t.nearbyWholesalers="${t.nearbyWholesalers}"`);
        return (
          <View key={section.id} style={styles.section}>
            {config.show_title !== false && (
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {t.nearbyWholesalers}
              </Text>
            )}
            <NearbyWholesalers showTitle={false} userId={userId} />
          </View>
        );

      case 'manufacturers':
        // Always use translated title for manufacturers section
        // section.title from database is typically in English, so we ignore it for translation
        console.log(`[DynamicHomeSections] Rendering 'manufacturers' section: using translated t.nearbyManufacturers="${t.nearbyManufacturers}"`);
        return (
          <View key={section.id} style={styles.section}>
            {config.show_title !== false && (
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {t.nearbyManufacturers}
              </Text>
            )}
            <NearbyManufacturers showTitle={false} userId={userId} />
          </View>
        );

      default:
        return null;
    }
  };

  const renderDefaultLayout = () => {
    return (
      <>
        {/* Default Layout: Static sections */}
        {/* Order matches database: Banners → Nearby Wholesalers → Nearby Manufacturers → Recommended → Trending → New Arrivals → Categories */}
        <View style={styles.section}>
          <DynamicBanners />
        </View>

        {/* Nearby wholesalers/manufacturers for retailers - PRIORITY after banner */}
        {userRole === 'retailer' && userId && (
          <>
            <View style={styles.section}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {t.nearbyWholesalers}
              </Text>
              <NearbyWholesalers showTitle={false} userId={userId} />
            </View>

            <View style={styles.section}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                {t.nearbyManufacturers}
              </Text>
              <NearbyManufacturers showTitle={false} userId={userId} />
            </View>
          </>
        )}

        {/* Personalized Recommendations - Order 4 in DB */}
        {userId && (
          <View style={styles.section}>
            <ProductCarousel
              title={t.recommendedForYou}
              filter="personalized"
              limit={10}
              userId={userId}
            />
          </View>
        )}

        {/* Trending Products - Order 5 in DB */}
        <View style={styles.section}>
          <ProductCarousel title={t.trendingProducts} filter="trending" limit={10} />
        </View>

        {/* New Arrivals - Order 6 in DB */}
        <View style={styles.section}>
          <ProductCarousel title={t.newArrivals} filter="new" limit={10} />
        </View>

        {/* Categories - Order 7 in DB (last) */}
        <View style={styles.section}>
          <CategoryCarousel title={t.shopByCategory} limit={20} />
        </View>
      </>
    );
  };


  // OPTIMIZATION: Never show a blocking loading indicator
  // Child components will appear as they become ready
  // This provides a faster perceived load time

  return (
    <View style={styles.container}>
      {useDynamicSections && sections.length > 0 ? (
        <>
          {console.log(`[DynamicHomeSections] RENDERING: Dynamic sections (${sections.length} sections)`)}
          {sections.map((section) => renderSection(section))}
        </>
      ) : (
        <>
          {console.log(`[DynamicHomeSections] RENDERING: Default layout, userRole=${userRole}, userId=${userId}`)}
          {renderDefaultLayout()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
});

