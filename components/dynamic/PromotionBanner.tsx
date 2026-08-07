/**
 * Promotion Banner Component
 * 
 * Displays active promotions and offers
 * Fetched dynamically from database
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase/supabase';

interface Promotion {
  id: string;
  name: string;
  description?: string;
  code?: string;
  discount_type: string;
  discount_value: number;
  image_url?: string;
  min_order_amount?: number;
  end_date: string;
}

interface PromotionBannerProps {
  title?: string;
  config?: {
    layout?: 'horizontal' | 'vertical';
    max_promotions?: number;
  };
}

export function PromotionBanner({ title, config }: PromotionBannerProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const defaultConfig = {
    layout: 'horizontal',
    max_promotions: 3,
    ...config,
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .limit(defaultConfig.max_promotions);

      if (error) throw error;

      setPromotions(data || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiscountText = (promotion: Promotion): string => {
    switch (promotion.discount_type) {
      case 'percentage':
        return `${promotion.discount_value}% OFF`;
      case 'fixed':
        return `₹${promotion.discount_value} OFF`;
      case 'bogo':
        return 'Buy 1 Get 1';
      case 'free_shipping':
        return 'Free Shipping';
      default:
        return 'Special Offer';
    }
  };

  const getDaysRemaining = (endDate: string): number => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handlePromotionPress = (promotion: Promotion) => {
    // Navigate to promotions detail or apply code
    // You can implement this based on your needs
    console.log('Promotion pressed:', promotion);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF7D00" />
      </View>
    );
  }

  if (promotions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      {defaultConfig.layout === 'horizontal' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {promotions.map((promotion) => (
            <Pressable
              key={promotion.id}
              onPress={() => handlePromotionPress(promotion)}
              style={styles.promotionCardHorizontal}
            >
              <Card style={styles.card}>
                {promotion.image_url && (
                  <Image
                    source={{ uri: promotion.image_url }}
                    style={styles.promotionImage}
                    resizeMode="cover"
                  />
                )}
                <Card.Content>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>
                      {getDiscountText(promotion)}
                    </Text>
                  </View>
                  
                  <Text style={styles.promotionName} numberOfLines={2}>
                    {promotion.name}
                  </Text>
                  
                  {promotion.description && (
                    <Text style={styles.promotionDescription} numberOfLines={2}>
                      {promotion.description}
                    </Text>
                  )}

                  {promotion.code && (
                    <Chip
                      mode="flat"
                      style={styles.codeChip}
                      textStyle={styles.codeText}
                    >
                      {promotion.code}
                    </Chip>
                  )}

                  {promotion.min_order_amount && (
                    <Text style={styles.minOrder}>
                      Min. order: ₹{promotion.min_order_amount}
                    </Text>
                  )}

                  <Text style={styles.expiryText}>
                    Expires in {getDaysRemaining(promotion.end_date)} days
                  </Text>
                </Card.Content>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.verticalContainer}>
          {promotions.map((promotion) => (
            <Pressable
              key={promotion.id}
              onPress={() => handlePromotionPress(promotion)}
              style={styles.promotionCardVertical}
            >
              <Card style={styles.card}>
                <View style={styles.verticalContent}>
                  {promotion.image_url && (
                    <Image
                      source={{ uri: promotion.image_url }}
                      style={styles.promotionImageVertical}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.verticalTextContent}>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>
                        {getDiscountText(promotion)}
                      </Text>
                    </View>
                    
                    <Text style={styles.promotionName} numberOfLines={1}>
                      {promotion.name}
                    </Text>
                    
                    {promotion.code && (
                      <Chip
                        mode="flat"
                        style={styles.codeChip}
                        textStyle={styles.codeText}
                      >
                        {promotion.code}
                      </Chip>
                    )}

                    <Text style={styles.expiryText}>
                      Expires in {getDaysRemaining(promotion.end_date)} days
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
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
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 12,
    color: '#333',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  verticalContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  promotionCardHorizontal: {
    width: 280,
  },
  promotionCardVertical: {
    width: '100%',
  },
  card: {
    elevation: 2,
    borderRadius: 12,
  },
  promotionImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  promotionImageVertical: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  verticalContent: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  verticalTextContent: {
    flex: 1,
  },
  discountBadge: {
    backgroundColor: '#FF7D00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  promotionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  promotionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  codeChip: {
    backgroundColor: '#F5F5F5',
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  codeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF7D00',
  },
  minOrder: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  expiryText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
});

