import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ScrollView, Animated, Dimensions, BackHandler } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SystemStatusBar } from '../../components/SystemStatusBar';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useLanguage as useLanguageContext } from '../../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase/supabase';
import { translationService } from '../../services/translationService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Get screen dimensions for animations
const { width, height } = Dimensions.get('window');

// Premium Color Palette - aligned with app theme
const COLORS = {
  primary: '#FF7D00',
  primaryLight: '#FFF3E0',
  primarySoft: '#FFAB58',
  secondary: '#1A1A1A',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  background: '#FAFBFC',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  success: '#10B981',
};

// Language options with their native names and English subtitles
const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🌴' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🙏' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🛕' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🌶️' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🐘' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🏯' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🐅' },
];

// Original English text (never changes) - defined outside component
const ORIGINAL_TEXTS = {
  title: 'Choose Your Language',
  subtitle: 'Select your preferred language to continue',
  continue: 'Continue',
  loading: 'Setting up your experience...'
};

// Rotating texts for the header animation
const ROTATING_TEXTS = [
  { brand: 'dukaaOn', title: 'Choose Your Language', subtitle: 'Select your preferred language to continue' },
  { brand: 'दुकाऑन', title: 'अपनी भाषा चुनें', subtitle: 'जारी रखने के लिए अपनी पसंदीदा भाषा चुनें' }, // Hindi (dental द)
  { brand: 'ദുക്കാഓൺ', title: 'ഭാഷ തിരഞ്ഞെടുക്കുക', subtitle: 'തുടരാൻ നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക' }, // Malayalam
  { brand: 'துகாஆன்', title: 'மொழியைத் தேர்ந்தெடுக்கவும்', subtitle: 'தொடர மொழியைத் தேர்ந்தெடுக்கவும்' }, // Tamil (த = soft d)
  { brand: 'దుకాఆన్', title: 'భాషను ఎంచుకోండి', subtitle: 'కొనసాగడానికి భాషను ఎంచుకోండి' }, // Telugu (ద = dental d)
  { brand: 'ದುಕಾಆನ್', title: 'ಭಾಷೆಯನ್ನು ಆರಿಸಿ', subtitle: 'ಮುಂದುವರಿಯಲು ಭಾಷೆಯನ್ನು ಆರಿಸಿ' }, // Kannada (ದ = dental d)
  { brand: 'दुकाऑन', title: 'भाषा निवडा', subtitle: 'पुढे जाण्यासाठी भाषा निवडा' }, // Marathi (dental द)
  { brand: 'দুকাঅন', title: 'ভাষা নির্বাচন করুন', subtitle: 'চালিয়ে যেতে ভাষা নির্বাচন করুন' }, // Bengali (দ = dental d)
];

export default function LanguageSelection() {
  const router = useRouter();
  const { currentLanguage, changeLanguage } = useLanguageContext();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>('en');
  const [isLoading, setIsLoading] = useState(false);

  // Rotating text state
  const [textIndex, setTextIndex] = useState(0);
  const fadeAnimText = useRef(new Animated.Value(1)).current;

  // Track mounted state and request cancellation
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  // Dynamic translations state
  const [translations, setTranslations] = useState(ORIGINAL_TEXTS);

  // Animation values for screen transition
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const screenScaleAnim = useRef(new Animated.Value(1)).current;

  // Language card animations - start fully visible (no entrance animation)
  const cardAnimations = useRef(
    LANGUAGES.map(() => ({
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(1),
    }))
  ).current;

  // Header values - start fully visible
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset animations when screen comes into focus (e.g., navigating back)
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset screen opacity when returning to this screen
      screenFadeAnim.setValue(1);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Handle hardware back button - exit app instead of navigating
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Exit the app when back is pressed on language screen
      BackHandler.exitApp();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Note: Entrance animations removed - content displays immediately for cleaner UX

  // Text Rotation Effect
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnimText, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimText, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Change text halfway through the fade
      setTimeout(() => {
        if (isMountedRef.current) {
          setTextIndex((prev) => (prev + 1) % ROTATING_TEXTS.length);
        }
      }, 400);

    }, 3500); // Rotate every 3.5 seconds

    return () => clearInterval(interval);
  }, []);

  // Helper function to load translations for a given language code
  const loadTranslationsForLanguage = async (langCode: string | null, requestId: number) => {
    if (!langCode) {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setTranslations(ORIGINAL_TEXTS);
      }
      return;
    }

    console.log('Loading translations for language:', langCode);

    if (langCode === 'en') {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setTranslations(ORIGINAL_TEXTS);
      }
      return;
    }

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Translation timeout')), 10000)
      );

      const translationPromise = (async () => {
        const translationPromises = Object.entries(ORIGINAL_TEXTS).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, langCode as any);
          return [key, translated.translatedText];
        });
        return Promise.all(translationPromises);
      })();

      const translatedEntries = await Promise.race([translationPromise, timeoutPromise]) as [string, string][];

      if (isMountedRef.current && requestId === requestIdRef.current) {
        const newTranslations = Object.fromEntries(translatedEntries) as typeof ORIGINAL_TEXTS;
        console.log('All translations loaded:', newTranslations);
        setTranslations(newTranslations);
      }
    } catch (error) {
      console.error('Language screen translation error:', error);
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setTranslations(ORIGINAL_TEXTS);
      }
    }
  };

  // Load translations when selectedLanguage changes (for immediate preview when user clicks a language)
  useEffect(() => {
    if (isLoading) return;

    const currentRequestId = ++requestIdRef.current;
    loadTranslationsForLanguage(selectedLanguage, currentRequestId);
  }, [selectedLanguage, isLoading]);

  // Clear ALL data when this screen loads to ensure a fresh start
  useEffect(() => {
    const clearAllData = async () => {
      try {
        console.log('Completely resetting app data');
        await supabase.auth.signOut();
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys);
        console.log('All app data cleared successfully');
      } catch (error) {
        console.error('Error clearing app data:', error);
      }
    };

    clearAllData();
  }, []);

  // Screen transition animation
  const animateTransition = () => {
    Animated.timing(screenFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleLanguageSelect = (langCode: string) => {
    console.log(`Language selected: ${langCode}`);
    setSelectedLanguage(langCode);
  };

  const handleContinue = async () => {
    if (!selectedLanguage) return;

    const langCode = selectedLanguage;

    try {
      await changeLanguage(langCode as any);
      await AsyncStorage.setItem('hasCompletedLanguageSelection', 'true');

      console.log('Language saved via LanguageContext, navigating to login screen');

      // Navigate immediately - let Stack navigator handle the transition
      router.push('/(auth)/login');
    } catch (error) {
      console.error('Error during language selection:', error);
    }
  };

  // Render language card
  const renderLanguageCard = (lang: typeof LANGUAGES[0], index: number) => {
    const isSelected = selectedLanguage === lang.code || (!selectedLanguage && currentLanguage === lang.code);
    const anim = cardAnimations[index];

    return (
      <Animated.View
        key={lang.code}
        style={[
          {
            opacity: anim.opacity,
            transform: [
              { translateY: anim.translateY },
              { scale: anim.scale },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.languageCard,
            isSelected && styles.languageCardSelected,
          ]}
          onPress={() => handleLanguageSelect(lang.code)}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {/* Selection indicator glow */}
          {isSelected && (
            <View style={styles.selectionGlow} />
          )}

          <View style={styles.languageCardContent}>
            {/* Flag emoji */}
            <View style={[styles.flagContainer, isSelected && styles.flagContainerSelected]}>
              <Text style={styles.flagEmoji}>{lang.flag}</Text>
            </View>

            {/* Language info */}
            <View style={styles.languageInfo}>
              <Text style={[styles.nativeLanguageName, isSelected && styles.nativeLanguageNameSelected]}>
                {lang.nativeName}
              </Text>
              <Text style={[styles.englishLanguageName, isSelected && styles.englishLanguageNameSelected]}>
                {lang.name}
              </Text>
            </View>

            {/* Checkmark for selected */}
            <View style={[styles.checkContainer, isSelected && styles.checkContainerSelected]}>
              {isSelected && (
                <Ionicons name="checkmark" size={18} color={COLORS.white} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: screenFadeAnim,
          transform: [{ scale: screenScaleAnim }],
        },
      ]}
    >

      <SystemStatusBar style="dark" />

      {/* Gradient Background */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primarySoft, COLORS.background, COLORS.white]}
        locations={[0, 0.25, 0.45, 1]}
        style={styles.gradientBackground}
      />

      {/* Decorative circles */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />

      {/* Header Section */}
      <Animated.View
        style={[
          styles.headerSection,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />
        </View>

        {/* Animated Brand Text */}
        <Animated.Text style={[styles.brandText, { opacity: fadeAnimText }]}>
          {ROTATING_TEXTS[textIndex].brand}
        </Animated.Text>

        <Animated.Text style={[styles.title, { opacity: fadeAnimText }]}>
          {ROTATING_TEXTS[textIndex].title}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: fadeAnimText }]}>
          {ROTATING_TEXTS[textIndex].subtitle}
        </Animated.Text>
      </Animated.View>

      {/* Languages Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.languagesGrid}>
          {LANGUAGES.map((lang, index) => renderLanguageCard(lang, index))}
        </View>
      </ScrollView>

      {/* Floating Continue Button */}
      <TouchableOpacity
        style={[styles.floatingButton, (!selectedLanguage && !currentLanguage) && styles.disabledButton]}
        onPress={handleContinue}
        disabled={isLoading || (!selectedLanguage && !currentLanguage)}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>{translations.continue}</Text>
        <Ionicons name="arrow-forward" size={22} color={COLORS.white} />
      </TouchableOpacity>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingSpinnerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
            <Text style={styles.loadingText}>{translations.loading}</Text>
            {selectedLanguage && (
              <Text style={styles.loadingLanguage}>
                {LANGUAGES.find(l => l.code === selectedLanguage)?.nativeName}
              </Text>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.6,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -120,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.4,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 80, // Increased to account for action bar
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 160,
    height: 70,
    resizeMode: 'cover',
    borderRadius: 24,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  title: {
    fontSize: 24, // Slightly smaller to balance with brand text
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // Extra padding for floating button
  },
  languagesGrid: {
    gap: 12,
  },
  languageCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  languageCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  selectionGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.primary,
  },
  languageCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  flagContainerSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  flagEmoji: {
    fontSize: 24,
  },
  languageInfo: {
    flex: 1,
  },
  nativeLanguageName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  nativeLanguageNameSelected: {
    color: COLORS.text,
  },
  englishLanguageName: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  englishLanguageNameSelected: {
    color: COLORS.primary,
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkContainerSelected: {
    backgroundColor: COLORS.primary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    minWidth: 240,
  },
  loadingSpinnerContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loadingLanguage: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 8,
  },
  bottomSection: {
    padding: 24,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    left: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.primarySoft,
    opacity: 0.7,
    shadowOpacity: 0.1,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

