import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { useLanguage } from '../../contexts/LanguageContext';
import { translationService } from '../../services/translationService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface RoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  const { currentLanguage } = useLanguage();

  // Animation for selection change
  const scaleRetailer = useRef(new Animated.Value(value === 'retailer' ? 1.05 : 1)).current;
  const scaleSeller = useRef(new Animated.Value(value === 'seller' ? 1.05 : 1)).current;

  // Animate when selection changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleRetailer, {
        toValue: value === 'retailer' ? 1.02 : 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(scaleSeller, {
        toValue: value === 'seller' ? 1.02 : 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  }, [value]);

  // Original English text
  const originalTexts = {
    retailer: 'Retailer',
    seller: 'Seller',
    retailerDesc: 'I want to buy stocks',
    sellerDesc: 'I want to sell products'
  };

  const [translations, setTranslations] = useState(originalTexts);

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') {
        setTranslations(originalTexts);
        return;
      }

      try {
        const translationPromises = Object.entries(originalTexts).map(async ([key, val]) => {
          const translated = await translationService.translateText(val, currentLanguage);
          return [key, translated.translatedText];
        });

        const translatedEntries = await Promise.all(translationPromises);
        setTranslations(Object.fromEntries(translatedEntries));
      } catch (error) {
        console.error('RoleSelector translation error:', error);
        setTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const renderOption = (role: string, icon: string, label: string, desc: string, animScale: any) => {
    const isSelected = value === role;

    return (
      <TouchableOpacity
        style={styles.cardWrapper}
        onPress={() => onChange(role)}
        activeOpacity={0.9}
      >
        <Animated.View
          style={[
            styles.optionCard,
            isSelected ? styles.selectedCard : styles.unselectedCard,
            { transform: [{ scale: animScale }] }
          ]}
        >
          {isSelected && (
            <LinearGradient
              colors={['rgba(255, 125, 0, 0.12)', 'rgba(255, 125, 0, 0.02)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          <View style={[
            styles.iconContainer,
            isSelected ? styles.selectedIconContainer : styles.unselectedIconContainer
          ]}>
            <MaterialCommunityIcons
              name={icon as any}
              size={32}
              color={isSelected ? '#FFFFFF' : '#9E9E9E'}
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.optionLabel, isSelected && styles.selectedOptionLabel]}>
              {label}
            </Text>
            <Text style={[styles.optionDesc, isSelected && styles.selectedOptionDesc]} numberOfLines={2}>
              {desc}
            </Text>
          </View>

          {isSelected && (
            <View style={styles.checkmarkBadge}>
              <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {renderOption(
          'retailer',
          'storefront-outline',
          translations.retailer,
          translations.retailerDesc,
          scaleRetailer
        )}
        <View style={{ width: 16 }} />
        {renderOption(
          'seller',
          'domain',
          translations.seller,
          translations.sellerDesc,
          scaleSeller
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4, // Space for shadows
  },
  cardWrapper: {
    flex: 1,
    height: 160,
  },
  optionCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden', // For LinearGradient
  },
  unselectedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF7D00',
    elevation: 8,
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  unselectedIconContainer: {
    backgroundColor: '#F5F5F5',
  },
  selectedIconContainer: {
    backgroundColor: '#FF7D00',
    shadowColor: '#FF7D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  textContainer: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'flex-start',
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#616161',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  selectedOptionLabel: {
    color: '#FF7D00',
  },
  optionDesc: {
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'center',
    lineHeight: 16,
  },
  selectedOptionDesc: {
    color: '#FF9E80', // Soft Orange
    fontWeight: '500',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF7D00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});