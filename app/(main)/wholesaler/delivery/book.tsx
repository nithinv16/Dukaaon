import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, TextInput, IconButton, Searchbar, ActivityIndicator, Chip, Switch, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import * as Location from 'expo-location';
import { WHOLESALER_COLORS } from '../../../../constants/colors';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Retailer {
  id: string;
  business_name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
}

interface DeliveryForm {
  retailerId: string;
  date: string;
  time: string;
  isNow: boolean;
  notes: string;
  amountToCollect: string;
  // New fields for manual retailer entry
  manualRetailer: {
    businessName: string;
    address: string;
    phone: string;
  };
}

interface DeliveryData {
  seller_id: string | undefined;
  retailer_id: string | null;
  phone_number: string;
  delivery_partner_location?: string | null;
  estimated_delivery_time: string;
  actual_delivery_time?: string | null;
  created_at: string;
  updated_at: string;
  amount_to_collect: number | null;
  delivery_notes: string;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
}

export default function BookDelivery() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { currentLanguage } = useLanguage();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryMode, setEntryMode] = useState<'select' | 'manual'>('select');
  
  const [translations, setTranslations] = useState({
    bookDelivery: 'Book Delivery',
    selectRetailer: 'Select Retailer',
    manualEntry: 'Manual Entry',
    searchRetailers: 'Search retailers...',
    noRetailersFound: 'No retailers found',
    businessName: 'Business Name',
    address: 'Address',
    phoneNumber: 'Phone Number',
    deliveryDate: 'Delivery Date',
    deliveryTime: 'Delivery Time',
    deliverNow: 'Deliver Now',
    notes: 'Notes',
    amountToCollect: 'Amount to Collect',
    bookDeliveryButton: 'Book Delivery',
    cancel: 'Cancel',
    loading: 'Loading...',
    submitting: 'Submitting...',
    errorOccurred: 'An error occurred',
    retry: 'Retry',
    selectRetailerFirst: 'Please select a retailer first',
    fillRequiredFields: 'Please fill in all required fields',
    invalidAmount: 'Please enter a valid amount',
    deliveryBooked: 'Delivery booked successfully!',
    distance: 'Distance'
  });
  
  const [form, setForm] = useState<DeliveryForm>({
    retailerId: '',
    date: '',
    time: '',
    isNow: false,
    notes: '',
    amountToCollect: '',
    manualRetailer: {
      businessName: '',
      address: '',
      phone: '',
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRetailers();
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;
      
      try {
        const translatedTexts = await Promise.all([
        translationService.translateText('Book Delivery', currentLanguage),
        translationService.translateText('Select Retailer', currentLanguage),
        translationService.translateText('Manual Entry', currentLanguage),
        translationService.translateText('Search retailers...', currentLanguage),
        translationService.translateText('No retailers found', currentLanguage),
        translationService.translateText('Business Name', currentLanguage),
        translationService.translateText('Address', currentLanguage),
        translationService.translateText('Phone Number', currentLanguage),
        translationService.translateText('Delivery Date', currentLanguage),
        translationService.translateText('Delivery Time', currentLanguage),
        translationService.translateText('Deliver Now', currentLanguage),
        translationService.translateText('Notes', currentLanguage),
        translationService.translateText('Amount to Collect', currentLanguage),
        translationService.translateText('Book Delivery', currentLanguage),
        translationService.translateText('Cancel', currentLanguage),
        translationService.translateText('Loading...', currentLanguage),
        translationService.translateText('Submitting...', currentLanguage),
        translationService.translateText('An error occurred', currentLanguage),
        translationService.translateText('Retry', currentLanguage),
        translationService.translateText('Please select a retailer first', currentLanguage),
        translationService.translateText('Please fill in all required fields', currentLanguage),
        translationService.translateText('Please enter a valid amount', currentLanguage),
        translationService.translateText('Delivery booked successfully!', currentLanguage),
        translationService.translateText('Distance', currentLanguage)
      ]);

        setTranslations({
          bookDelivery: translatedTexts[0].translatedText,
          selectRetailer: translatedTexts[1].translatedText,
          manualEntry: translatedTexts[2].translatedText,
          searchRetailers: translatedTexts[3].translatedText,
          noRetailersFound: translatedTexts[4].translatedText,
          businessName: translatedTexts[5].translatedText,
          address: translatedTexts[6].translatedText,
          phoneNumber: translatedTexts[7].translatedText,
          deliveryDate: translatedTexts[8].translatedText,
          deliveryTime: translatedTexts[9].translatedText,
          deliverNow: translatedTexts[10].translatedText,
          notes: translatedTexts[11].translatedText,
          amountToCollect: translatedTexts[12].translatedText,
          bookDeliveryButton: translatedTexts[13].translatedText,
          cancel: translatedTexts[14].translatedText,
          loading: translatedTexts[15].translatedText,
          submitting: translatedTexts[16].translatedText,
          errorOccurred: translatedTexts[17].translatedText,
          retry: translatedTexts[18].translatedText,
          selectRetailerFirst: translatedTexts[19].translatedText,
          fillRequiredFields: translatedTexts[20].translatedText,
          invalidAmount: translatedTexts[21].translatedText,
          deliveryBooked: translatedTexts[22].translatedText,
          distance: translatedTexts[23].translatedText
        });
      } catch (error) {
        console.error('Translation loading failed:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchRetailers = async () => {
    try {
      setLoading(true);
      
      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let currentLocation = null;
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        currentLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      }
      
      // Fetch retailers from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, business_details, phone_number, latitude, longitude')
        .eq('role', 'retailer');

      if (error) throw error;
      
      if (data) {
        const formattedRetailers = data.map(profile => {
          const businessDetails = profile.business_details || {};
          
          // Calculate distance if we have location data and retailer coordinates
          let distance = null;
          if (currentLocation && 
              profile.latitude !== null && 
              profile.longitude !== null) {
            distance = calculateDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              profile.latitude,
              profile.longitude
            );
          }
          
          return {
            id: profile.id,
            business_name: businessDetails.shopName || 'Unnamed Shop',
            address: businessDetails.address || 'No address provided',
            phone: profile.phone_number || '',
            latitude: profile.latitude || null,
            longitude: profile.longitude || null,
            distance
          };
        });
        
        // Filter retailers to only include those within 50km
        const nearbyRetailers = formattedRetailers.filter(retailer => {
          // Include retailers without distance data or those within 50km
          return !retailer.distance || retailer.distance <= 50;
        });
        
        // Sort by distance if available, putting null distances at the end
        const sortedRetailers = nearbyRetailers.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
        
        setRetailers(sortedRetailers);
      }
    } catch (error) {
      console.error('Error fetching retailers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const toggleNow = () => {
    setForm(f => {
      if (!f.isNow) {
        return { ...f, isNow: true, date: '', time: '' };
      }
      return { ...f, isNow: false };
    });
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      
      const now = new Date();
      // Add 2 hours to current time for estimated delivery
      const estimatedDeliveryTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
      
      // Format the dates
      const estimatedTimeStr = estimatedDeliveryTime.toTimeString().split(' ')[0].substring(0, 5);
      const estimatedDateStr = estimatedDeliveryTime.toISOString().split('T')[0];
      
      // Base delivery data
      const deliveryData: DeliveryData = {
        seller_id: user?.id,
        retailer_id: null,
        phone_number: '',
        estimated_delivery_time: `${estimatedDateStr} ${estimatedTimeStr}`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        delivery_notes: form.notes || '',
        delivery_status: 'pending',
        amount_to_collect: form.amountToCollect ? parseFloat(form.amountToCollect) : null
      };
      
      // Add retailer info based on entry mode
      if (entryMode === 'select' && selectedRetailer) {
        deliveryData.retailer_id = selectedRetailer.id;
        deliveryData.phone_number = selectedRetailer.phone;
      } else if (entryMode === 'manual') {
        deliveryData.retailer_id = null;
        deliveryData.phone_number = form.manualRetailer.phone;
        deliveryData.delivery_notes = JSON.stringify({
          business_name: form.manualRetailer.businessName,
          address: form.manualRetailer.address,
          phone: form.manualRetailer.phone,
          notes: form.notes || ''
        });
      }

      console.log('Submitting delivery data:', deliveryData);

      const { data, error: insertError } = await supabase
        .from('delivery_orders')
        .insert([deliveryData])
        .select();

      if (insertError) {
        console.error('Insert error details:', {
          code: insertError.code,
          msg: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        throw insertError;
      }

      console.log('Delivery created successfully:', data);
      router.back();
    } catch (error: any) {
      console.error('Full error object:', error);
      const errorMsg = error.message || 'Failed to book delivery. Please try again.';
      setErrorMessage(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return 'Unknown distance';
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)} m`;
    }
    return `${distance.toFixed(1)} km`;
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
          {translations.bookDelivery}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        <SegmentedButtons
          value={entryMode}
          onValueChange={(value) => {
            setEntryMode(value as 'select' | 'manual');
            // Clear selected retailer when switching to manual mode
            if (value === 'manual') {
              setSelectedRetailer(null);
              setForm(f => ({ ...f, retailerId: '' }));
            }
          }}
          buttons={[
            { value: 'select', label: translations.selectRetailer },
            { value: 'manual', label: translations.manualEntry }
          ]}
          style={styles.segmentedButtons}
        />

        {entryMode === 'select' ? (
          // Existing retailer selection UI
          <>
            <Searchbar
              placeholder={translations.searchRetailers}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
            />

            <Text variant="bodySmall" style={styles.infoText}>
              Only retailers within 50km are shown
            </Text>

            <Text variant="titleMedium" style={styles.sectionTitle}>{translations.selectRetailer}</Text>
            
            {loading ? (
              <ActivityIndicator style={styles.loader} />
            ) : retailers.length === 0 ? (
              <Text style={styles.emptyText}>{translations.noRetailersFound}</Text>
            ) : (
              retailers
                .filter(r => r.business_name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(retailer => (
                  <Card
                    key={retailer.id}
                    style={[
                      styles.retailerCard,
                      selectedRetailer?.id === retailer.id ? styles.selectedRetailerCard : null
                    ]}
                    onPress={() => {
                      setSelectedRetailer(retailer);
                      setForm(f => ({ ...f, retailerId: retailer.id }));
                    }}
                  >
                    <Card.Content>
                      <View style={styles.retailerHeader}>
                        <View>
                          <Text variant="titleMedium">{retailer.business_name}</Text>
                          <Text variant="bodyMedium" style={styles.address}>{retailer?.address || 'No address available'}</Text>
                          <Text variant="bodyMedium" style={styles.phone}>{retailer?.phone || 'No phone available'}</Text>
                        </View>
                        {retailer.distance != null && (
                          <Chip style={styles.distanceChip}>
                            {formatDistance(retailer.distance)}
                          </Chip>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                ))
            )}
          </>
        ) : (
          // Manual retailer entry UI
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>Enter Retailer Details</Text>
            
            <TextInput
              mode="outlined"
              label={translations.businessName}
              value={form.manualRetailer.businessName}
              onChangeText={(text) => setForm(f => ({
                ...f,
                manualRetailer: { ...f.manualRetailer, businessName: text }
              }))}
              style={styles.input}
              placeholder="Enter business name"
            />
            
            <TextInput
              mode="outlined"
              label={translations.address}
              value={form.manualRetailer.address}
              onChangeText={(text) => setForm(f => ({
                ...f,
                manualRetailer: { ...f.manualRetailer, address: text }
              }))}
              style={styles.input}
              placeholder="Enter address"
              multiline
            />
            
            <TextInput
              mode="outlined"
              label={translations.phoneNumber}
              value={form.manualRetailer.phone}
              onChangeText={(text) => setForm(f => ({
                ...f,
                manualRetailer: { ...f.manualRetailer, phone: text }
              }))}
              style={styles.input}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </>
        )}

        {/* Delivery details section - show for both modes */}
        {(selectedRetailer || entryMode === 'manual') && (
          <>
            <Text variant="titleMedium" style={styles.sectionTitle}>Delivery Details</Text>
            
            <View style={styles.nowContainer}>
              <Text>{translations.deliverNow}</Text>
              <Switch value={form.isNow} onValueChange={toggleNow} />
            </View>
            
            {!form.isNow && (
              <>
                <TextInput
                  mode="outlined"
                  label={translations.deliveryDate}
                  value={form.date}
                  onChangeText={date => setForm(f => ({ ...f, date }))}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  disabled={form.isNow}
                />
                <TextInput
                  mode="outlined"
                  label={translations.deliveryTime}
                  value={form.time}
                  onChangeText={time => setForm(f => ({ ...f, time }))}
                  style={styles.input}
                  placeholder="HH:MM"
                  disabled={form.isNow}
                />
              </>
            )}
            
            <TextInput
              mode="outlined"
              label={translations.amountToCollect + " (Optional)"}
              value={form.amountToCollect}
              onChangeText={amount => setForm(f => ({ ...f, amountToCollect: amount }))}
              style={styles.input}
              keyboardType="numeric"
              placeholder="₹0.00"
              left={<TextInput.Affix text="₹" />}
            />
            
            <TextInput
              mode="outlined"
              label={translations.notes}
              value={form.notes}
              onChangeText={notes => setForm(f => ({ ...f, notes }))}
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {errorMessage && (
          <Text style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>
            {errorMessage}
          </Text>
        )}
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={
            submitting ||
            (entryMode === 'select' && !selectedRetailer) || 
            (entryMode === 'manual' && !form.manualRetailer.businessName) ||
            (!form.isNow && (!form.date || !form.time))
          }
          loading={submitting}
          style={styles.submitButton}
          labelStyle={styles.buttonLabel}
        >
          {submitting ? translations.submitting : translations.bookDeliveryButton}
        </Button>
      </View>
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
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  retailerCard: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  selectedRetailerCard: {
    borderColor: WHOLESALER_COLORS.primary,
    borderWidth: 2,
  },
  retailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  address: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 4,
  },
  phone: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginTop: 2,
  },
  distanceChip: {
    backgroundColor: WHOLESALER_COLORS.primaryLight,
    color: WHOLESALER_COLORS.primaryDark,
  },
  input: {
    marginBottom: 16,
    backgroundColor: WHOLESALER_COLORS.background,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: WHOLESALER_COLORS.lightGrey,
  },
  submitButton: {
    borderRadius: 20,
    backgroundColor: WHOLESALER_COLORS.secondary,
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: WHOLESALER_COLORS.mediumGrey,
  },
  nowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  infoText: {
    color: WHOLESALER_COLORS.mediumGrey,
    marginBottom: 12,
  },
  buttonLabel: {
    color: WHOLESALER_COLORS.background,
  },
});
