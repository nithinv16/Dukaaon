import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Linking, BackHandler } from 'react-native';
import { Text, Card, IconButton, List, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';
import { useEdgeToEdge } from '../../../utils/android15EdgeToEdge';

interface FAQItem {
  question: string;
  answer: string;
}

export default function Help() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const supportEmail = 'support@dukaaon.in';
  const supportPhone = '+918089668552';
  
  // Add edge-to-edge support for proper bottom navigation spacing
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  
  // Calculate bottom navigation height including safe area
  const bottomNavHeight = 60 + insets.bottom;

  // Original texts for translation
  const originalTexts = {
    helpSupport: 'Help & Support',
    contactUs: 'Contact Us',
    call: 'Call',
    email: 'Email',
    frequentlyAskedQuestions: 'Frequently Asked Questions',
    faq1Question: 'How do I get started with Dukaan?',
    faq1Answer: 'Complete your KYC verification and start exploring products from various wholesalers.',
    faq2Question: 'What is Scredit Score?',
    faq2Answer: 'Scredit Score is our proprietary credit rating system that helps determine your creditworthiness.',
    faq3Question: 'How can I improve my Scredit Score?',
    faq3Answer: 'Maintain timely payments, keep a good credit utilization ratio, and maintain regular business activity.',
    faq4Question: 'How long does KYC verification take?',
    faq4Answer: 'KYC verification typically takes 24-48 hours after submission of all required documents.'
  };

  // State for translations
  const [translations, setTranslations] = useState(originalTexts);
  const [isLoading, setIsLoading] = useState(false);

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      setIsLoading(true);
      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, value]) => {
          const result = await translationService.translateText(value, currentLanguage);
          return [key, result.translatedText || value];
        });

        const translatedEntries = await Promise.all(translationPromises);
        const newTranslations = Object.fromEntries(translatedEntries);
        setTranslations(newTranslations);
      } catch (error) {
        console.error('Error loading translations:', error);
        setTranslations(originalTexts);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  // Handle back button navigation for help screen
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

  const faqs: FAQItem[] = [
    {
      question: translations.faq1Question,
      answer: translations.faq1Answer,
    },
    {
      question: translations.faq2Question,
      answer: translations.faq2Answer,
    },
    {
      question: translations.faq3Question,
      answer: translations.faq3Answer,
    },
    {
      question: translations.faq4Question,
      answer: translations.faq4Answer,
    },
  ];

  const handleCall = () => {
    Linking.openURL(`tel:${supportPhone}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${supportEmail}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>{translations.helpSupport}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavHeight + 20 }]}
        showsVerticalScrollIndicator={true}
      >
        <Card style={styles.contactCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.contactUs}</Text>
            <View style={styles.contactButtons}>
              <Button 
                mode="contained" 
                icon="phone" 
                onPress={handleCall}
                style={[styles.contactButton, { marginRight: 8 }]}
                disabled={isLoading}
              >
                {translations.call}
              </Button>
              <Button 
                mode="contained" 
                icon="email" 
                onPress={handleEmail}
                style={styles.contactButton}
                disabled={isLoading}
              >
                {translations.email}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.faqTitle}>{translations.frequentlyAskedQuestions}</Text>
        {faqs.map((faq, index) => (
          <Card key={index} style={styles.faqCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.question}>
                {faq.question}
              </Text>
              <Text variant="bodyMedium" style={styles.answer}>
                {faq.answer}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerRight: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  contactCard: {
    marginBottom: 24,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  contactButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flex: 1,
    borderRadius: 20,
  },
  faqTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  faqCard: {
    marginBottom: 12,
    elevation: 2,
  },
  question: {
    marginBottom: 8,
    fontWeight: '600',
  },
  answer: {
    color: '#666',
  },
});