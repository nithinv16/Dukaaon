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
    // Normalize pathname - remove trailing slash
    const normalizedPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    // Debug logging (remove in production)
    // console.log('SellerBottomNav pathname:', normalizedPathname, 'checking path:', path);

    // Special handling for Profile - includes profile and settings
    if (path === '/(main)/wholesaler/profile') {
      return normalizedPathname.includes('/wholesaler/profile') ||
        normalizedPathname.includes('/wholesaler/settings');
    }

    // Special handling for Loans
    if (path === '/(main)/wholesaler/loan') {
      return normalizedPathname.includes('/wholesaler/loan');
    }

    // Special handling for Help
    if (path === '/(main)/wholesaler/help') {
      return normalizedPathname.includes('/wholesaler/help');
    }

    // Special handling for Home
    if (path === '/(main)/wholesaler') {
      // Check various home path patterns
      const isHomePath =
        normalizedPathname === '/(main)/wholesaler' ||
        normalizedPathname === '/wholesaler' ||
        normalizedPathname === '/(main)/wholesaler/index' ||
        normalizedPathname === '/wholesaler/index' ||
        normalizedPathname.endsWith('/wholesaler') ||
        normalizedPathname.endsWith('/wholesaler/index');

      if (isHomePath) {
        return true;
      }

      // Check if it's a home-related sub-route (products, orders, customers, etc.)
      // But NOT profile, loan, or help
      const isProfileRoute = normalizedPathname.includes('/wholesaler/profile') ||
        normalizedPathname.includes('/wholesaler/settings');
      const isLoanRoute = normalizedPathname.includes('/wholesaler/loan');
      const isHelpRoute = normalizedPathname.includes('/wholesaler/help');

      if (isProfileRoute || isLoanRoute || isHelpRoute) {
        return false;
      }

      // Any other wholesaler route is considered "home" related
      if (normalizedPathname.includes('/wholesaler/')) {
        return true;
      }
    }

    // Default: exact match
    return normalizedPathname === path;
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
            size={26}
            onPress={() => handleNavigation(item.path)}
            iconColor={isActive(item.path) ? '#FF7D00' : '#9E9E9E'}
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
    paddingTop: 8,
    paddingBottom: 8,
    height: 85, // Increased height for better touch targets
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  label: {
    color: '#9E9E9E',
    marginTop: -2, // Pull label closer to icon
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  activeLabel: {
    color: '#FF7D00', // Orange theme
    fontWeight: '700',
  },
});