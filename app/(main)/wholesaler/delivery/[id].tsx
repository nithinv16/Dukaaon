import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Divider, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Linking } from 'react-native';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface DeliveryDetails {
  id: string;
  wholesaler_id: string;
  retailer_id: string | null;
  manual_retailer: {
    business_name: string;
    address: string;
    phone: string;
  } | null;
  delivery_date: string;
  delivery_time: string;
  notes: string;
  amount_to_collect: number | null;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  created_at: string;
  retailer?: {
    business_details: {
      shopName: string;
      address: string;
    };
    phone_number: string;
    latitude: number;
    longitude: number;
  };
}

export default function DeliveryDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [translations, setTranslations] = useState({
    deliveryDetails: 'Delivery Details',
    retailerInfo: 'Retailer Information',
    deliveryInfo: 'Delivery Information',
    businessName: 'Business Name',
    address: 'Address',
    phoneNumber: 'Phone Number',
    deliveryDate: 'Delivery Date',
    deliveryTime: 'Delivery Time',
    notes: 'Notes',
    amountToCollect: 'Amount to Collect',
    status: 'Status',
    pending: 'Pending',
    inTransit: 'In Transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    updateStatus: 'Update Status',
    callRetailer: 'Call Retailer',
    viewOnMap: 'View on Map',
    cancel: 'Cancel',
    loading: 'Loading...',
    updating: 'Updating...',
    errorOccurred: 'An error occurred',
    retry: 'Retry',
    noNotes: 'No notes provided',
    noAmount: 'No amount to collect',
    confirmCancel: 'Are you sure you want to cancel this delivery?',
    deliveryUpdated: 'Delivery status updated successfully',
    deliveryCancelled: 'Delivery cancelled successfully',
    error: 'Error',
    success: 'Success',
    failedToLoadDeliveryDetails: 'Failed to load delivery details',
    failedToUpdateDeliveryStatus: 'Failed to update delivery status'
  });

  useEffect(() => {
    fetchDeliveryDetails();
  }, [id]);

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;
      
      try {
        const results = await Promise.all([
          translationService.translateText('Delivery Details', currentLanguage),
        translationService.translateText('Order ID:', currentLanguage),
        translationService.translateText('Customer:', currentLanguage),
        translationService.translateText('Delivery Date:', currentLanguage),
        translationService.translateText('Status:', currentLanguage),
        translationService.translateText('Items:', currentLanguage),
        translationService.translateText('Total Amount:', currentLanguage),
        translationService.translateText('Delivery Address:', currentLanguage),
        translationService.translateText('Special Instructions:', currentLanguage),
        translationService.translateText('Update Status', currentLanguage),
        translationService.translateText('Mark as Delivered', currentLanguage),
        translationService.translateText('Cancel Delivery', currentLanguage),
        translationService.translateText('Back to Deliveries', currentLanguage),
        translationService.translateText('Pending', currentLanguage),
        translationService.translateText('In Transit', currentLanguage),
        translationService.translateText('Delivered', currentLanguage),
        translationService.translateText('Cancelled', currentLanguage),
        translationService.translateText('Loading delivery details...', currentLanguage),
        translationService.translateText('Delivery not found', currentLanguage),
        translationService.translateText('Failed to load delivery details', currentLanguage),
        translationService.translateText('Success', currentLanguage),
        translationService.translateText('Delivery status updated successfully', currentLanguage),
        translationService.translateText('Error', currentLanguage),
        translationService.translateText('Failed to update delivery status', currentLanguage),
        translationService.translateText('OK', currentLanguage),
        translationService.translateText('Confirm', currentLanguage),
        translationService.translateText('Are you sure you want to mark this delivery as delivered?', currentLanguage),
        translationService.translateText('Are you sure you want to cancel this delivery?', currentLanguage),
        translationService.translateText('Yes', currentLanguage),
        translationService.translateText('No', currentLanguage)
        ]);
        
        setTranslations({
          deliveryDetails: results[0].translatedText,
          orderId: results[1].translatedText,
          customer: results[2].translatedText,
          deliveryDate: results[3].translatedText,
          status: results[4].translatedText,
          items: results[5].translatedText,
          totalAmount: results[6].translatedText,
          deliveryAddress: results[7].translatedText,
          specialInstructions: results[8].translatedText,
          updateStatus: results[9].translatedText,
          markAsDelivered: results[10].translatedText,
          cancelDelivery: results[11].translatedText,
          backToDeliveries: results[12].translatedText,
          pending: results[13].translatedText,
          inTransit: results[14].translatedText,
          delivered: results[15].translatedText,
          cancelled: results[16].translatedText,
          loadingDeliveryDetails: results[17].translatedText,
          deliveryNotFound: results[18].translatedText,
          failedToLoadDeliveryDetails: results[19].translatedText,
          success: results[20].translatedText,
          deliveryStatusUpdated: results[21].translatedText,
          error: results[22].translatedText,
          failedToUpdateDeliveryStatus: results[23].translatedText,
          ok: results[24].translatedText,
          confirm: results[25].translatedText,
          confirmMarkAsDelivered: results[26].translatedText,
          confirmCancelDelivery: results[27].translatedText,
          yes: results[28].translatedText,
          no: results[29].translatedText
        });
      } catch (error) {
        console.error('Translation loading failed:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchDeliveryDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_orders')
        .select('*, retailer:retailer_id(business_details, phone_number, latitude, longitude)')
        .eq('id', id)
        .eq('seller_id', user?.id)
        .single();

      if (error) throw error;
      setDelivery(data);
    } catch (error) {
      console.error('Error fetching delivery details:', error);
      Alert.alert(translations.error, translations.failedToLoadDeliveryDetails);
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (newStatus: string) => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('delivery_orders')
        .update({ delivery_status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setDelivery(prev => prev ? { ...prev, delivery_status: newStatus as any } : null);
      
      Alert.alert(translations.success, `Delivery status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating delivery status:', error);
      Alert.alert(translations.error, translations.failedToUpdateDeliveryStatus);
    } finally {
      setUpdating(false);
    }
  };

  const getRetailerName = () => {
    if (!delivery) return '';
    
    if (delivery.retailer_id && delivery.retailer) {
      return delivery.retailer.business_details.shopName;
    } else if (delivery.manual_retailer) {
      return delivery.manual_retailer.business_name;
    }
    return 'Unknown Retailer';
  };

  const getRetailerAddress = () => {
    if (!delivery) return '';
    
    if (delivery.retailer_id && delivery.retailer) {
      return delivery.retailer.business_details.address;
    } else if (delivery.manual_retailer) {
      return delivery.manual_retailer.address;
    }
    return '';
  };

  const getRetailerPhone = () => {
    if (!delivery) return '';
    
    if (delivery.retailer_id && delivery.retailer) {
      return delivery.retailer.phone_number;
    } else if (delivery.manual_retailer) {
      return delivery.manual_retailer.phone;
    }
    return '';
  };

  const formatDateTime = (date: string, time: string) => {
    try {
      const dateObj = new Date(`${date}T${time}`);
      return format(dateObj, 'MMMM d, yyyy h:mm a');
    } catch (e) {
      return `${date} ${time}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return WHOLESALER_COLORS.secondary;
      case 'in_transit': return WHOLESALER_COLORS.primary;
      case 'delivered': return WHOLESALER_COLORS.success;
      case 'cancelled': return WHOLESALER_COLORS.error;
      default: return WHOLESALER_COLORS.mediumGrey;
    }
  };

  const getStatusIcon = (delivery_status: string) => {
    switch (delivery_status) {
      case 'pending': return 'clock-outline';
      case 'in_transit': return 'truck-delivery';
      case 'delivered': return 'check-circle';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{translations.loading}</Text>
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#F44336" />
        <Text style={styles.errorText}>Delivery not found</Text>
        <Button mode="contained" onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => router.back()} 
          color={WHOLESALER_COLORS.background}
        />
        <Text variant="titleLarge">{translations.deliveryDetails}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusContainer}>
              <MaterialCommunityIcons 
                name={getStatusIcon(delivery.delivery_status)} 
                size={32} 
                color={getStatusColor(delivery.delivery_status)} 
              />
              <View style={styles.statusTextContainer}>
                <Text variant="titleMedium">{translations.status}</Text>
                <Chip 
                  style={[
                    styles.statusChip, 
                    { backgroundColor: `${getStatusColor(delivery.delivery_status)}20` }
                  ]}
                  textStyle={{ color: getStatusColor(delivery.delivery_status) }}
                >
                  {delivery.delivery_status === 'pending' ? translations.pending :
                   delivery.delivery_status === 'in_transit' ? translations.inTransit :
                   delivery.delivery_status === 'delivered' ? translations.delivered :
                   delivery.delivery_status === 'cancelled' ? translations.cancelled :
                   delivery.delivery_status.replace('_', ' ')}
                </Chip>
              </View>
            </View>

            {delivery.delivery_status !== 'delivered' && delivery.delivery_status !== 'cancelled' && (
              <View style={styles.statusActions}>
                <Text variant="titleSmall" style={styles.updateText}>{translations.updateStatus}:</Text>
                <SegmentedButtons
                  value={delivery.delivery_status}
                  onValueChange={(value) => {
                    if (value !== delivery.delivery_status) {
                      updateDeliveryStatus(value);
                    }
                  }}
                  buttons={[
                    { 
                      value: 'pending', 
                      label: translations.pending,
                      disabled: delivery.delivery_status === 'in_transit' || updating
                    },
                    { 
                      value: 'in_transit', 
                      label: translations.inTransit,
                      disabled: updating
                    },
                    { 
                      value: 'delivered', 
                      label: translations.delivered,
                      disabled: updating
                    }
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Retailer Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.retailerInfo}</Text>
            <Text variant="titleLarge">{getRetailerName()}</Text>
            <Text variant="bodyMedium" style={styles.detailText}>{getRetailerAddress()}</Text>
            <Text variant="bodyMedium" style={styles.detailText}>{getRetailerPhone()}</Text>
            
            <View style={styles.actionButtons}>
              <Button 
                mode="contained-tonal" 
                icon="phone" 
                onPress={() => {/* Call retailer */}}
                style={styles.actionButton}
              >
                {translations.callRetailer}
              </Button>
              <Button 
                mode="contained-tonal" 
                icon="message-text" 
                onPress={() => {/* Message retailer */}}
                style={styles.actionButton}
              >
                Message
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Delivery Details */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.deliveryInfo}</Text>
            
            <View style={styles.detailRow}>
              <Text variant="bodyMedium" style={styles.detailLabel}>Scheduled for:</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {formatDateTime(delivery.delivery_date, delivery.delivery_time)}
              </Text>
            </View>
            
            {delivery.amount_to_collect && (
              <View style={styles.detailRow}>
                <Text variant="bodyMedium" style={styles.detailLabel}>{translations.amountToCollect}:</Text>
                <Text variant="bodyMedium" style={styles.detailValue}>₹{delivery.amount_to_collect}</Text>
              </View>
            )}
            
            {delivery.notes && (
              <>
                <Text variant="bodyMedium" style={[styles.detailLabel, styles.notesLabel]}>{translations.notes}:</Text>
                <Text variant="bodyMedium" style={styles.notes}>{delivery?.notes || translations.noNotes}</Text>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Map */}
        {delivery.retailer && delivery.retailer.latitude && delivery.retailer.longitude && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Location</Text>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: delivery.retailer.latitude,
                  longitude: delivery.retailer.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: delivery.retailer.latitude,
                    longitude: delivery.retailer.longitude,
                  }}
                  title={getRetailerName()}
                  description={getRetailerAddress()}
                />
              </MapView>
              <Button 
                mode="contained" 
                icon="directions" 
                onPress={() => {
                  /* Open in maps app */
                  const lat = delivery.retailer?.latitude;
                  const lng = delivery.retailer?.longitude;
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                  Linking.openURL(url);
                }}
                style={styles.directionsButton}
              >
                {translations.viewOnMap}
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Cancel Button */}
        {delivery.delivery_status !== 'delivered' && delivery.delivery_status !== 'cancelled' && (
          <Button 
            mode="outlined" 
            icon="close-circle" 
            onPress={() => {
              Alert.alert(
                translations.cancel,
                translations.cancelConfirmation,
                [
                  { text: 'No', style: 'cancel' },
                  { 
                    text: 'Yes', 
                    style: 'destructive',
                    onPress: () => updateDeliveryStatus('cancelled')
                  }
                ]
              );
            }}
            style={styles.cancelButton}
            textColor="#F44336"
          >
            {translations.cancel}
          </Button>
        )}
      </ScrollView>
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
    padding: 16,
    paddingTop: 0,
    backgroundColor: WHOLESALER_COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: WHOLESALER_COLORS.lightGrey,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: WHOLESALER_COLORS.background,
  },
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTextContainer: {
    marginLeft: 16,
  },
  statusChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusActions: {
    marginTop: 8,
  },
  updateText: {
    marginBottom: 8,
    color: WHOLESALER_COLORS.darkGrey,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
    color: WHOLESALER_COLORS.darkGrey,
  },
  detailText: {
    marginTop: 4,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: WHOLESALER_COLORS.mediumGrey,
    flex: 1,
  },
  detailValue: {
    flex: 2,
    fontWeight: '500',
    color: WHOLESALER_COLORS.darkGrey,
  },
  notesLabel: {
    marginBottom: 4,
  },
  notes: {
    backgroundColor: WHOLESALER_COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  map: {
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  directionsButton: {
    marginTop: 8,
    backgroundColor: WHOLESALER_COLORS.primary,
  },
  cancelButton: {
    marginVertical: 16,
    borderColor: WHOLESALER_COLORS.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginVertical: 16,
    color: WHOLESALER_COLORS.mediumGrey,
    fontSize: 16,
  },
});