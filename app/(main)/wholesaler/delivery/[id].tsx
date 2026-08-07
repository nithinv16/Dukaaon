import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Button, IconButton, Chip, Divider, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Linking } from 'react-native';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

// --- Wholesaler Premium Theme (Navy/Teal) ---
const THEME = {
  primary: '#001F3F',    // Navy Blue
  secondary: '#39CCCC',  // Teal
  accent: '#7FDBFF',     // Sky Blue
  success: '#39CCCC',    // Teal used for positive/success
  warning: '#FF851B',    // Orange
  error: '#FF4136',      // Red
  background: 'transparent',
  card: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  divider: '#E0E0E0',
  inputBackground: '#F8F9FA',
};

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
  const [loading, setLoading] = useState(false);
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
    // CRITICAL: Don't fetch until we have a valid user ID and delivery ID
    if (!user?.id || !id) {
      console.log('DeliveryDetails: Waiting for user ID or delivery ID...');
      return;
    }
    console.log('DeliveryDetails: Fetching details for delivery:', id);
    fetchDeliveryDetails();
  }, [id, user?.id]);

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

        setTranslations(prev => ({
          ...prev,
          deliveryDetails: results[0].translatedText,
          status: results[4].translatedText,
          updateStatus: results[9].translatedText,
          cancel: results[11].translatedText,
          pending: results[13].translatedText,
          inTransit: results[14].translatedText,
          delivered: results[15].translatedText,
          cancelled: results[16].translatedText,
          loading: results[17].translatedText,
          success: results[20].translatedText,
          error: results[22].translatedText,
          confirmCancel: results[27].translatedText,
        }));
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
      case 'pending': return THEME.warning;
      case 'in_transit': return THEME.primary;
      case 'delivered': return THEME.success;
      case 'cancelled': return THEME.error;
      default: return THEME.textSecondary;
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
      <SystemStatusBar style="light" backgroundColor="transparent" translucent />

      {/* Light Orange Gradient Background */}
      <LinearGradient
        colors={['#FFF3E0', '#FFFFFF', '#FFF8E1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Gradient Background for Header */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, backgroundColor: THEME.primary, overflow: 'hidden' }}>
        <LinearGradient
          colors={[THEME.primary, '#003366']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle decorative circles */}
        <View style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => router.back()}
        >
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#FFFFFF"
            onPress={() => router.back()}
            style={{ margin: 0 }}
          />
        </TouchableOpacity>
        <Text variant="titleLarge" style={{ color: '#FFFFFF', fontWeight: '700' }}>{translations.deliveryDetails}</Text>
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
                          (delivery.delivery_status as string).replace('_', ' ')}
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
                onPress={() => {/* Call retailer */ }}
                style={styles.actionButton}
              >
                {translations.callRetailer}
              </Button>
              <Button
                mode="contained-tonal"
                icon="message-text"
                onPress={() => {/* Message retailer */ }}
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
                translations.confirmCancel,
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.card,
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
    backgroundColor: THEME.card,
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
    color: THEME.textPrimary,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  detailText: {
    marginTop: 4,
    color: THEME.textSecondary,
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
    color: THEME.textSecondary,
    flex: 1,
  },
  detailValue: {
    flex: 2,
    fontWeight: '500',
    color: THEME.textPrimary,
  },
  notesLabel: {
    marginBottom: 4,
  },
  notes: {
    backgroundColor: THEME.inputBackground,
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
    backgroundColor: THEME.primary,
  },
  cancelButton: {
    marginVertical: 16,
    borderColor: THEME.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    color: THEME.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginVertical: 16,
    color: THEME.textSecondary,
    fontSize: 16,
  },
});