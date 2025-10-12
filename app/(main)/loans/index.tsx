import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { Text, Banner, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function Loans() {
  const [visible, setVisible] = React.useState(true);
  const insets = useEdgeToEdge({ statusBarStyle: 'dark' });
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState({});
  
  const originalTexts = {
    quickLoans: 'Quick Loans',
    getInstantApproval: 'Get instant approval for your financial needs',
    loanPlatformDescription: "We're building a comprehensive loan platform to help your business grow. Get access to quick financing solutions tailored for your needs.",
    quickBusinessLoans: 'Quick business loans with fast approval',
    flexibleRepayment: 'Flexible repayment options that suit your cash flow',
    competitiveRates: 'Competitive interest rates starting from 12% per annum',
    minimalDocumentation: 'Minimal documentation - just Aadhaar and PAN required',
    notifyMeWhenAvailable: 'Notify Me When Available',
    comingSoon: 'Coming Soon',
    featureUnderDevelopment: 'This feature is under development and will be available soon.',
    gotIt: 'Got it'
  };

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        if (!currentLanguage || currentLanguage === 'en') {
          setTranslations(originalTexts);
          return;
        }

        // Translate each text individually using translateText method (like stock screen)
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const translated = await translationService.translateText(value, currentLanguage);
          return [key, translated.translatedText];
        });
        
        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts); // Fallback to original texts
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Handle back button navigation for loans screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Navigate back to the previous screen instead of exiting the app
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we can't go back, navigate to home screen
        router.replace('/(main)/home');
        return true; // Prevent default behavior
      }
    });

    return () => backHandler.remove();
  }, [router]);

  const router = useRouter();

  return (
    <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.container}>
        <Banner
          visible={visible}
          actions={[
            {
              label: translations.gotIt,
              onPress: () => setVisible(false),
            }
          ]}
          icon="information"
        >
          {translations.featureUnderDevelopment}
        </Banner>

        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            {translations.quickLoans}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {translations.getInstantApproval}
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            {translations.loanPlatformDescription}
          </Text>
          
          <View style={styles.features}>
            <Text variant="bodyMedium" style={styles.feature}>• {translations.quickBusinessLoans}</Text>
            <Text variant="bodyMedium" style={styles.feature}>• {translations.flexibleRepayment}</Text>
            <Text variant="bodyMedium" style={styles.feature}>• {translations.competitiveRates}</Text>
            <Text variant="bodyMedium" style={styles.feature}>• {translations.minimalDocumentation}</Text>
          </View>
          
          <Button 
            mode="contained"
            onPress={() => {}}
            style={styles.notifyButton}
          >
            {translations.notifyMeWhenAvailable}
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 60,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    color: '#2196F3',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  features: {
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  feature: {
    marginBottom: 12,
    opacity: 0.7,
  },
  notifyButton: {
    paddingHorizontal: 24,
  },
});