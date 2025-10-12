import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Divider, Chip, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useCartStore } from '../../../store/cart';
import { supabase } from '../../../services/supabase/supabase';
import ProductImage from '../../../components/common/ProductImage';
import { useLanguage } from '../../../contexts/LanguageContext';
import { translationService } from '../../../services/translationService';

interface SellerWithDistance {
  user_id: string;
  business_name: string;
  latitude: number;
  longitude: number;
  items: any[];
  totalValue: number;
  distances: { [sellerId: string]: number };
}

export default function ManageCartDistance() {
  const { items, removeItem, splitCartBySeller } = useCartStore();
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string[]>([]);
  const { currentLanguage } = useLanguage();
  
  // Define original texts for translation
  const originalTexts = {
    error: 'Error',
    failedToLoadSellerInfo: 'Failed to load seller information',
    failedToRemoveItem: 'Failed to remove item',
    removeAllItems: 'Remove All Items',
    removeAllItemsFromSeller: 'Remove all items from seller?',
    cancel: 'Cancel',
    remove: 'Remove',
    failedToRemoveSomeItems: 'Failed to remove some items',
  };

  // State for translations
  const [translations, setTranslations] = useState<{ [key: string]: string }>({});
  const [fallbackTranslations, setFallbackTranslations] = useState<{ [key: string]: string }>({});

  // Translation function
  const getTranslatedText = (key: string): string => {
    return translations[key] || fallbackTranslations[key] || originalTexts[key as keyof typeof originalTexts] || key;
  };

  // Load translations
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translatedTexts = await translationService.translateText(
          Object.values(originalTexts),
          currentLanguage
        );
        
        const translationMap: { [key: string]: string } = {};
        Object.keys(originalTexts).forEach((key, index) => {
          translationMap[key] = translatedTexts[index];
        });
        
        setTranslations(translationMap);
      } catch (error) {
        console.error('Error loading translations:', error);
        setFallbackTranslations(originalTexts);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI/180);
    const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  useEffect(() => {
    loadSellerData();
  }, [items]);

  const loadSellerData = async () => {
    try {
      setLoading(true);
      const sellerGroups = splitCartBySeller();
      const sellerIds = Object.keys(sellerGroups);

      if (sellerIds.length === 0) {
        setSellers([]);
        setLoading(false);
        return;
      }

      // Fetch seller details
      const { data: sellerDetails, error } = await supabase
        .from('seller_details')
        .select('user_id, business_name, latitude, longitude')
        .in('user_id', sellerIds);

      if (error) throw error;

      // Calculate distances between all sellers
      const sellersWithDistances: SellerWithDistance[] = sellerDetails.map(seller => {
        const sellerItems = sellerGroups[seller.user_id] || [];
        const totalValue = sellerItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        const distances: { [sellerId: string]: number } = {};
        sellerDetails.forEach(otherSeller => {
          if (otherSeller.user_id !== seller.user_id) {
            distances[otherSeller.user_id] = calculateDistance(
              seller.latitude, seller.longitude,
              otherSeller.latitude, otherSeller.longitude
            );
          }
        });

        return {
          ...seller,
          items: sellerItems,
          totalValue,
          distances
        };
      });

      setSellers(sellersWithDistances);
    } catch (error) {
      console.error('Error loading seller data:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('failedToLoadSellerInfo'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      setRemoving(prev => [...prev, itemId]);
      await removeItem(itemId);
    } catch (error) {
      console.error('Error removing item:', error);
      Alert.alert(getTranslatedText('error'), getTranslatedText('failedToRemoveItem'));
    } finally {
      setRemoving(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleRemoveAllFromSeller = (sellerId: string) => {
    const seller = sellers.find(s => s.user_id === sellerId);
    if (!seller) return;

    Alert.alert(
      getTranslatedText('removeAllItems'),
      `${getTranslatedText('remove')} ${seller.items.length} ${getTranslatedText('removeAllItemsFromSeller')} ${seller.business_name}?`,
      [
        { text: getTranslatedText('cancel'), style: 'cancel' },
        {
          text: getTranslatedText('remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(
                seller.items.map(item => removeItem(item.uniqueId))
              );
            } catch (error) {
              console.error('Error removing seller items:', error);
              Alert.alert(getTranslatedText('error'), getTranslatedText('failedToRemoveSomeItems'));
            }
          }
        }
      ]
    );
  };

  const getDistanceStatus = (distances: { [sellerId: string]: number }) => {
    const maxDistance = Math.max(...Object.values(distances));
    if (maxDistance > 3) {
      return { status: 'violation', color: '#d32f2f', text: `Max: ${maxDistance.toFixed(1)}km (Exceeds 3km limit)` };
    }
    return { status: 'ok', color: '#2e7d32', text: `Max: ${maxDistance.toFixed(1)}km (Within limit)` };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading cart analysis...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Manage Cart Distance',
          headerBackTitle: 'Back'
        }} 
      />
      
      <ScrollView style={styles.container}>
        <Card style={styles.summaryCard}>
          <Card.Title 
            title="Distance Analysis" 
            subtitle={`${sellers.length} seller${sellers.length !== 1 ? 's' : ''} in your cart`}
            left={(props) => <IconButton {...props} icon="map-marker-distance" />}
          />
          
          <Card.Content>
            <Text style={styles.infoText}>
              Delivery partners can only pickup from sellers within 3km of each other.
            </Text>
          </Card.Content>
        </Card>

        {sellers.map((seller, index) => {
          const distanceStatus = getDistanceStatus(seller.distances);
          
          return (
            <Card key={seller.user_id} style={styles.sellerCard}>
              <Card.Title 
                title={seller.business_name}
                subtitle={`${seller.items.length} items • ₹${seller.totalValue.toFixed(2)}`}
                right={(props) => (
                  <View style={styles.cardActions}>
                    <Chip 
                      mode="outlined" 
                      textStyle={{ color: distanceStatus.color, fontSize: 12 }}
                      style={{ borderColor: distanceStatus.color }}
                    >
                      {distanceStatus.text}
                    </Chip>
                    <IconButton 
                      {...props} 
                      icon="delete" 
                      iconColor="#d32f2f"
                      onPress={() => handleRemoveAllFromSeller(seller.user_id)}
                    />
                  </View>
                )}
              />
              
              <Card.Content>
                {Object.entries(seller.distances).length > 0 && (
                  <View style={styles.distanceInfo}>
                    <Text style={styles.distanceTitle}>Distances to other sellers:</Text>
                    {Object.entries(seller.distances).map(([otherId, distance]) => {
                      const otherSeller = sellers.find(s => s.user_id === otherId);
                      return (
                        <Text 
                          key={otherId} 
                          style={[
                            styles.distanceText,
                            { color: distance > 3 ? '#d32f2f' : '#666' }
                          ]}
                        >
                          • {otherSeller?.business_name}: {distance.toFixed(1)}km
                        </Text>
                      );
                    })}
                  </View>
                )}
                
                <Divider style={styles.divider} />
                
                {seller.items.map((item) => (
                  <View key={item.uniqueId} style={styles.itemRow}>
                    <ProductImage 
                      imageUrl={item.image_url} 
                      style={styles.itemImage} 
                    />
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>
                        ₹{item.price} × {item.quantity} {item.unit}
                      </Text>
                    </View>
                    <IconButton 
                      icon="close" 
                      size={20}
                      iconColor="#d32f2f"
                      onPress={() => handleRemoveItem(item.uniqueId)}
                      disabled={removing.includes(item.uniqueId)}
                    />
                  </View>
                ))}
              </Card.Content>
            </Card>
          );
        })}
        
        <View style={styles.actionButtons}>
          <Button 
            mode="contained" 
            onPress={() => router.back()}
            style={styles.button}
            icon="arrow-left"
          >
            Back to Shopping
          </Button>
          
          <Button 
            mode="outlined" 
            onPress={() => router.push('/(main)/cart')}
            style={styles.button}
            icon="cart"
          >
            View Cart
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  summaryCard: {
    margin: 16,
    marginBottom: 8,
  },
  sellerCard: {
    margin: 16,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    color: '#666',
    lineHeight: 20,
  },
  distanceInfo: {
    marginBottom: 12,
  },
  distanceTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    marginLeft: 8,
  },
  divider: {
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  button: {
    marginBottom: 8,
  },
});