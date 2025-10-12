import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Linking } from 'react-native';
import { Text, Card, IconButton, Button, List, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useEdgeToEdge, getSafeAreaStyles } from '../../../utils/android15EdgeToEdge';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

export default function About() {
  const router = useRouter();
  const { currentLanguage } = useLanguage();
  const [translations, setTranslations] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const appVersion = '1.0.0';
  const { insets } = useEdgeToEdge({ statusBarStyle: 'dark' });
  
  // Calculate dynamic bottom navigation height
  const bottomNavHeight = 60 + insets.bottom;

  // Original texts for translation
  const originalTexts = {
    'About Us': 'About Us',
    'Our Mission': 'Our Mission',
    'Empowering retailers and wholesalers through technology, making business operations seamless and efficient.': 'Empowering retailers and wholesalers through technology, making business operations seamless and efficient.',
    'Visit Our Website': 'Visit Our Website',
    'Terms of Service': 'Terms of Service',
    'Privacy Policy': 'Privacy Policy',
    'Licenses': 'Licenses',
    'Support': 'Support',
    'Version': 'Version'
  };

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      setIsLoading(true);
      try {
        const translatedTexts: { [key: string]: string } = {};
        
        for (const [key, text] of Object.entries(originalTexts)) {
          const result = await translationService.translateText(text, currentLanguage);
          translatedTexts[key] = result.translatedText || text;
        }
        
        setTranslations(translatedTexts);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslations(originalTexts);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const handleVisitWebsite = () => {
    Linking.openURL('https://www.dukaaon.in');
  };

  return (
    <View style={[styles.safeArea, getSafeAreaStyles(insets)]}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>
          {translations['About Us'] || 'About Us'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: bottomNavHeight + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coverContainer}>
          <Image 
            source={require('../../../assets/images/logo.png')} 
            style={styles.coverLogo}
            resizeMode="stretch"
          />
        </View>
        
        <View style={styles.appInfoContainer}>
          <Text variant="headlineMedium" style={styles.appName}>dukaaOn</Text>
          <Text variant="bodyMedium" style={styles.version}>
            {translations['Version'] || 'Version'} {appVersion}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {translations['Our Mission'] || 'Our Mission'}
            </Text>
            <Text variant="bodyMedium" style={styles.description}>
              {translations['Empowering retailers and wholesalers through technology, making business operations seamless and efficient.'] || 'Empowering retailers and wholesalers through technology, making business operations seamless and efficient.'}
            </Text>
          </Card.Content>
        </Card>

        <Button 
          mode="contained"
          onPress={handleVisitWebsite}
          style={styles.websiteButton}
          disabled={isLoading}
        >
          {translations['Visit Our Website'] || 'Visit Our Website'}
        </Button>

        <List.Section>
          <List.Item
            title={translations['Terms of Service'] || 'Terms of Service'}
            left={props => <List.Icon {...props} icon="file-document" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/(main)/about/terms')}
          />
          <List.Item
            title={translations['Privacy Policy'] || 'Privacy Policy'}
            left={props => <List.Icon {...props} icon="shield-check" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/(main)/about/privacy')}
          />
          <List.Item
            title={translations['Licenses'] || 'Licenses'}
            left={props => <List.Icon {...props} icon="license" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/(main)/about/licenses')}
          />
          <List.Item
            title={translations['Support'] || 'Support'}
            description={`Email: support@dukaaon.in`}
            left={props => <List.Icon {...props} icon="help-circle" />}
            onPress={() => Linking.openURL('mailto:support@dukaaon.in')}
          />
        </List.Section>
      </ScrollView>
    </View>
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
  content: {
    flex: 1,
  },
  coverContainer: {
    width: '100%',
    height: 170,
    backgroundColor: 'white',
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  coverLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'stretch',
  },
  appInfoContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  appName: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 24,
  },
  version: {
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  description: {
    color: '#666',
    lineHeight: 22,
  },
  websiteButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
  },
});