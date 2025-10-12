import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Delivery {
  id: string;
  retailer_id: string | null;
  manual_retailer: {
    business_name: string;
    address: string;
    phone: string;
  } | null;
  estimated_delivery_time: string;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  amount_to_collect: number | null;
  created_at: string;
  retailer?: {
    business_details: {
      shopName: string;
    };
  };
}

export default function DeliveriesList() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Translation state
  const [translations, setTranslations] = useState({
    error: 'Error',
    failedToFetchDeliveries: 'Failed to fetch deliveries',
    failedToCancelDelivery: 'Failed to cancel delivery',
    cancelDelivery: 'Cancel Delivery',
    cancelDeliveryConfirm: 'Are you sure you want to cancel this delivery?',
    no: 'No',
    yes: 'Yes'
  });

  useEffect(() => {
    fetchDeliveries();
  }, [statusFilter]);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('delivery_orders')
        .select(`
          *,
          retailer:retailer_id (
            business_details
          )
        `)
        .order('estimated_delivery_time', { ascending: statusFilter !== 'completed' });

      if (statusFilter === 'active') {
        query = query.in('delivery_status', ['pending', 'in_transit']);
      } else if (statusFilter === 'completed') {
        query = query.in('delivery_status', ['delivered', 'cancelled']);
      } else if (statusFilter !== 'all') {
        query = query.eq('delivery_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      Alert.alert(translations.error, translations.failedToFetchDeliveries);
    } finally {
      setLoading(false);
    }
  };

  const getRetailerName = (delivery: Delivery) => {
    if (delivery.retailer_id && delivery.retailer) {
      return delivery.retailer.business_details.shopName;
    } else if (delivery.manual_retailer) {
      return delivery.manual_retailer.business_name;
    }
    return 'Unknown Retailer';
  };

  const formatDateTime = (datetime: string) => {
    try {
      const dateObj = new Date(datetime);
      return format(dateObj, 'MMM d, h:mm a');
    } catch (e) {
      return datetime;
    }
  };

  const getStatusColor = (delivery_status: string) => {
    switch (delivery_status) {
      case 'pending':
        return WHOLESALER_COLORS.secondary;
      case 'in_transit':
        return WHOLESALER_COLORS.primary;
      case 'delivered':
        return WHOLESALER_COLORS.success;
      case 'cancelled':
        return WHOLESALER_COLORS.error;
      default:
        return WHOLESALER_COLORS.mediumGrey;
    }
  };

  const getStatusIcon = (delivery_status: string) => {
    switch (delivery_status) {
      case 'pending':
        return <MaterialCommunityIcons name="clock-outline" size={18} color={getStatusColor(delivery_status)} />;
      case 'in_transit':
        return <MaterialCommunityIcons name="truck-delivery-outline" size={18} color={getStatusColor(delivery_status)} />;
      case 'delivered':
        return <MaterialCommunityIcons name="check-circle-outline" size={18} color={getStatusColor(delivery_status)} />;
      case 'cancelled':
        return <MaterialCommunityIcons name="close-circle-outline" size={18} color={getStatusColor(delivery_status)} />;
      default:
        return null;
    }
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const retailerName = getRetailerName(delivery).toLowerCase();
    return retailerName.includes(searchQuery.toLowerCase());
  });

  const handleCancelDelivery = async (deliveryId: string) => {
    try {
      const { error } = await supabase
        .from('delivery_orders')
        .update({ delivery_status: 'cancelled' })
        .eq('id', deliveryId);

      if (error) throw error;
      
      // Update the local state to reflect the change
      setDeliveries(deliveries.map(delivery => 
        delivery.id === deliveryId 
          ? { ...delivery, delivery_status: 'cancelled' } 
          : delivery
      ));
      
    } catch (error) {
      console.error('Error cancelling delivery:', error);
      Alert.alert(translations.error, translations.failedToCancelDelivery);
    }
  };

  const confirmCancelDelivery = (deliveryId: string) => {
    Alert.alert(
      translations.cancelDelivery,
      translations.cancelDeliveryConfirm,
      [
        { text: translations.no, style: 'cancel' },
        { 
          text: translations.yes, 
          style: 'destructive',
          onPress: () => handleCancelDelivery(deliveryId)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          iconColor={WHOLESALER_COLORS.background}
          size={24}
          onPress={() => router.back()} 
        />
        <Text variant="titleLarge" style={[styles.headerTitle, { color: WHOLESALER_COLORS.background }]}>
          Deliveries
        </Text>
        <IconButton 
          icon="plus"
          iconColor={WHOLESALER_COLORS.background}
          size={24}
          onPress={() => router.push('/(main)/wholesaler/delivery/book')}
        />
      </View>

      <Searchbar
        placeholder="Search deliveries"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <SegmentedButtons
        value={statusFilter}
        onValueChange={setStatusFilter}
        buttons={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' }
        ]}
        style={styles.filterButtons}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : filteredDeliveries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No deliveries found</Text>
          <Button 
            mode="contained" 
            onPress={() => router.push('/(main)/wholesaler/delivery/book')}
            style={styles.bookButton}
          >
            Book a Delivery
          </Button>
        </View>
      ) : (
        <FlatList
          data={filteredDeliveries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View key={item.id} style={styles.deliveryCard}>
              <View style={styles.deliveryHeader}>
                <View>
                  <Text style={styles.businessName}>
                    {item.retailer?.business_details?.shopName || item.manual_retailer?.business_name}
                  </Text>
                  <Text style={styles.address}>
                    {item.manual_retailer?.address || 'Address not available'}
                  </Text>
                </View>
                <View style={[
                  styles.statusChip,
                  { backgroundColor: `${getStatusColor(item.delivery_status)}20` }
                ]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.delivery_status) }]}>
                    {item.delivery_status}
                  </Text>
                </View>
              </View>
              <View style={styles.deliveryFooter}>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => router.push(`/(main)/wholesaler/delivery/${item.id}`)}
                    style={styles.viewButton}
                  >
                    <Text style={styles.viewButtonText}>View Details</Text>
                  </TouchableOpacity>
                  {item.delivery_status === 'pending' && (
                    <TouchableOpacity
                      onPress={() => confirmCancelDelivery(item.id)}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.dateText}>
                  {formatDateTime(item.estimated_delivery_time)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHOLESALER_COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: WHOLESALER_COLORS.headerBg,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: WHOLESALER_COLORS.background,
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  filterButtons: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    padding: 16,
  },
  deliveryCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  businessName: {
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  address: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 4,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  deliveryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButton: {
    padding: 12,
    borderColor: WHOLESALER_COLORS.primary,
  },
  viewButtonText: {
    color: WHOLESALER_COLORS.primary,
  },
  cancelButton: {
    padding: 12,
    borderColor: WHOLESALER_COLORS.error,
  },
  cancelButtonText: {
    color: WHOLESALER_COLORS.error,
  },
  dateText: {
    color: WHOLESALER_COLORS.mediumGrey,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginBottom: 16,
  },
  bookButton: {
    borderRadius: 20,
    backgroundColor: WHOLESALER_COLORS.primary,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});