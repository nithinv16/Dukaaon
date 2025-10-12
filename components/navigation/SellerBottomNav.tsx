import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconButton, Text } from 'react-native-paper';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';

export function SellerBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentLanguage } = useLanguage();
  
  // Translation state
  const [translations, setTranslations] = useState({
    home: 'Home',
    loans: 'Loans',
    help: 'Help',
    profile: 'Profile'
  });

  // Load translations when language changes
  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        // Keep English as default
        return;
      }

      try {
        const [home, loans, help, profile] = await Promise.all([
          translationService.translateText('Home', currentLanguage),
          translationService.translateText('Loans', currentLanguage),
          translationService.translateText('Help', currentLanguage),
          translationService.translateText('Profile', currentLanguage)
        ]);

        setTranslations({
          home: home.translatedText || 'Home',
          loans: loans.translatedText || 'Loans',
          help: help.translatedText || 'Help',
          profile: profile.translatedText || 'Profile'
        });
      } catch (error) {
        console.error('Translation loading error:', error);
        // Keep default English values on error
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const isActive = (path: string) => {
    // Special case for home path
    if (path === '/(main)/wholesaler' && (pathname === '/(main)/wholesaler' || pathname === '/(main)/wholesaler/')) {
      return true;
    }
    // For other paths, check if pathname includes the path
    return pathname.includes(path);
  };

  const navItems = [
    {
      icon: 'home',
      label: translations.home,
      path: '/(main)/wholesaler',
    },
    {
      icon: 'cash',
      label: translations.loans,
      path: '/(main)/wholesaler/loan',
    },
    {
      icon: 'help-circle',
      label: translations.help,
      path: '/(main)/wholesaler/help',
    },
    {
      icon: 'account',
      label: translations.profile,
      path: '/(main)/wholesaler/profile',
    },
  ];

  const handleNavigation = (path: string) => {
    // If we're already on the target path, don't navigate
    if (isActive(path)) {
      return;
    }
    
    // Use replace for navigation to avoid stacking screens
    router.replace(path);
  };

  return (
    <View style={styles.container}>
      {navItems.map((item) => (
        <View key={item.path} style={styles.navItem}>
          <IconButton 
            icon={item.icon}
            size={22}
            onPress={() => handleNavigation(item.path)}
            iconColor={isActive(item.path) ? '#2196F3' : '#666'}
          />
          <Text 
            variant="labelSmall" 
            style={[
              styles.label,
              isActive(item.path) && styles.activeLabel
            ]}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 42,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 2,
    flex: 1,
  },
  label: {
    color: '#666',
    marginTop: -3,
    fontSize: 10,
    textAlign: 'center',
  },
  activeLabel: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
});