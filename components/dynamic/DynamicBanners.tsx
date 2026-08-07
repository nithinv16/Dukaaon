/**
 * Dynamic Banners Component
 * 
 * Displays banners fetched from database in a carousel
 * Can be updated without app updates!
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  Dimensions,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';
import { translationService } from '../../services/translationService';
import { useLanguage } from '../../contexts/LanguageContext';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  action_type?: string;
  action_value?: string;
  display_order: number;
}

interface TranslatedBanner extends Banner {
  translatedTitle?: string;
  translatedSubtitle?: string;
}

interface DynamicBannersProps {
  config?: {
    auto_scroll?: boolean;
    interval?: number;
    height?: number;
    show_indicators?: boolean;
  };
  userType?: string; // 'retailer', 'wholesaler', 'manufacturer'
}

export function DynamicBanners({ config, userType }: DynamicBannersProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [translatedBanners, setTranslatedBanners] = useState<TranslatedBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const width = Dimensions.get('window').width;
  const { currentLanguage } = useLanguage();

  const defaultConfig = {
    auto_scroll: true,
    interval: 3000,
    height: 200,
    show_indicators: true,
    ...config,
  };

  useEffect(() => {
    fetchBanners();
  }, [userType]);

  useEffect(() => {
    if (defaultConfig.auto_scroll && banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, defaultConfig.interval);

      return () => clearInterval(interval);
    }
  }, [banners.length, defaultConfig.auto_scroll, defaultConfig.interval]);

  // Translate banners when language changes
  useEffect(() => {
    if (banners.length === 0) {
      setTranslatedBanners([]);
      return;
    }

    // Immediately set banners with original texts (fallback) for instant display
    const initialTranslated = banners.map(b => ({
      ...b,
      translatedTitle: b.title,
      translatedSubtitle: b.subtitle,
    }));
    setTranslatedBanners(initialTranslated);

    // Translate in background
    const translateBanners = async () => {
      try {
        // Get current language - try multiple sources for reliability
        const { useLanguageStore } = await import('../../store/language');
        const storeLanguage = useLanguageStore.getState().language;
        const effectiveLanguage = currentLanguage || storeLanguage || 'en';

        console.log('[DynamicBanners] Translating - context lang:', currentLanguage, 'store lang:', storeLanguage, 'effective:', effectiveLanguage);

        // Skip translation for English
        if (effectiveLanguage === 'en') {
          console.log('[DynamicBanners] Using English - no translation needed');
          return;
        }

        // Collect texts to translate
        const textsToTranslate: string[] = [];
        banners.forEach(banner => {
          if (banner.title) textsToTranslate.push(banner.title);
          if (banner.subtitle) textsToTranslate.push(banner.subtitle);
        });

        if (textsToTranslate.length === 0) {
          console.log('[DynamicBanners] No texts to translate');
          return;
        }

        console.log('[DynamicBanners] Texts to translate:', textsToTranslate);

        // Batch translate all texts
        const results = await translationService.translateBatch(textsToTranslate, effectiveLanguage as any);

        console.log('[DynamicBanners] Translation results:', results);

        // Map translations back to banners
        let resultIndex = 0;
        const translated = banners.map(banner => {
          const translatedBanner: TranslatedBanner = { ...banner };

          if (banner.title) {
            translatedBanner.translatedTitle = results[resultIndex]?.translatedText || banner.title;
            resultIndex++;
          }
          if (banner.subtitle) {
            translatedBanner.translatedSubtitle = results[resultIndex]?.translatedText || banner.subtitle;
            resultIndex++;
          }

          return translatedBanner;
        });

        console.log('[DynamicBanners] Translated banners:', translated.map(b => ({ title: b.translatedTitle, subtitle: b.translatedSubtitle })));
        setTranslatedBanners(translated);
      } catch (error) {
        console.error('[DynamicBanners] Error translating banners:', error);
        // Keep original texts on error (already set above)
      }
    };

    translateBanners();
  }, [banners, currentLanguage]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();

      // First, try to get all active banners without date filtering
      let query = supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching banners:', error);
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} active banners`);

      // Filter by date range - show banners that are currently active
      let filteredBanners = (data || []).filter(banner => {
        const startDate = banner.start_date ? new Date(banner.start_date) : null;
        const endDate = banner.end_date ? new Date(banner.end_date) : null;
        const nowDate = new Date(now);

        // If no dates are set, show the banner
        if (!startDate && !endDate) {
          return true;
        }

        // If only start date is set, check if it has started
        if (startDate && !endDate) {
          return nowDate >= startDate;
        }

        // If only end date is set, check if it hasn't expired
        if (!startDate && endDate) {
          return nowDate <= endDate;
        }

        // If both dates are set, check if we're within the range
        return nowDate >= startDate! && nowDate <= endDate!;
      });

      console.log(`${filteredBanners.length} banners within date range`);

      // Filter by user type if provided
      if (userType) {
        filteredBanners = filteredBanners.filter(
          (banner) =>
            !banner.target_user_types ||
            banner.target_user_types.length === 0 ||
            banner.target_user_types.includes(userType) ||
            banner.target_user_types.includes('all')
        );
        console.log(`${filteredBanners.length} banners after user type filter`);
      }

      setBanners(filteredBanners);
    } catch (error) {
      console.error('Error fetching banners:', error);
      // Set an empty array to trigger the "no banners" view
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerPress = (banner: Banner) => {
    if (!banner.action_type || banner.action_type === 'none') {
      return;
    }

    switch (banner.action_type) {
      case 'category':
        router.push(`/(main)/screens/category/${banner.action_value}`);
        break;
      case 'product':
        router.push(`/(main)/products/${banner.action_value}`);
        break;
      case 'screen':
        router.push(banner.action_value as any);
        break;
      case 'url':
        // Open external URL
        // You can implement WebView or browser opening here
        break;
    }
  };

  // Get banners for display - use translated if available, otherwise use original
  const displayBanners: TranslatedBanner[] = translatedBanners.length > 0
    ? translatedBanners
    : banners.map(b => ({ ...b, translatedTitle: b.title, translatedSubtitle: b.subtitle }));

  // Show minimal placeholder while loading
  if (displayBanners.length === 0) {
    if (loading) {
      return (
        <View style={[styles.loadingContainer, { height: defaultConfig.height }]}>
          <ActivityIndicator size="small" color="#FF7D00" />
        </View>
      );
    }
    return null; // No banners and not loading - hide completely
  }

  return (
    <View style={styles.container}>
      <View style={[styles.carouselContainer, { height: defaultConfig.height }]}>
        {displayBanners.map((banner, index) => (
          <Pressable
            key={banner.id}
            onPress={() => handleBannerPress(banner)}
            style={[
              styles.bannerWrapper,
              {
                opacity: index === currentIndex ? 1 : 0,
                zIndex: index === currentIndex ? 1 : 0,
              },
            ]}
          >
            <Image
              source={{ uri: banner.image_url }}
              style={[styles.bannerImage, { height: defaultConfig.height }]}
              resizeMode="cover"
            />
            {(banner.translatedTitle || banner.translatedSubtitle) && (
              <View style={styles.textOverlay}>
                {banner.translatedTitle && (
                  <Text style={styles.bannerTitle}>{banner.translatedTitle}</Text>
                )}
                {banner.translatedSubtitle && (
                  <Text style={styles.bannerSubtitle}>{banner.translatedSubtitle}</Text>
                )}
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Indicators */}
      {defaultConfig.show_indicators && displayBanners.length > 1 && (
        <View style={styles.indicatorContainer}>
          {displayBanners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor:
                    index === currentIndex ? '#FF7D00' : '#E0E0E0',
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  carouselContainer: {
    position: 'relative',
    marginHorizontal: 20, // Align with header padding
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    backgroundColor: '#fff', // Needed for shadow
  },
  bannerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bannerImage: {
    width: '100%',
    borderRadius: 16,
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly more transparent
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
});
