import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Modal, ScrollView } from 'react-native';
import { Text, Card, Searchbar, IconButton, Menu, Chip, Button, FAB, Portal, Dialog, TextInput, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface Customer {
  id: string;
  business_name: string;
  owner_name: string;
  phone_number: string;
  email?: string;
  address: string;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  customer_type: 'manual' | 'retailer';
  retailer_profile_id?: string;
  credit_limit: number;
  payment_terms: string;
  discount_percentage: number;
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  tags?: string[];
}

interface NearbyRetailer {
  id: string;
  business_name: string;
  owner_name: string;
  phone_number: string;
  address: any;
  location_address: string;
  latitude: number;
  longitude: number;
  distance_km: number;
}

export default function CustomerManagement() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [translations, setTranslations] = useState({
    customers: 'Customers',
    addCustomer: 'Add Customer',
    findNearbyRetailers: 'Find Nearby Retailers',
    searchCustomers: 'Search customers...',
    loadingCustomers: 'Loading customers...',
    noCustomersFound: 'No Customers Found',
    noCustomersText: 'Start by adding customers or finding nearby retailers to grow your business.',
    businessName: 'Business Name',
    ownerName: 'Owner Name',
    phoneNumber: 'Phone Number',
    email: 'Email',
    address: 'Address',
    creditLimit: 'Credit Limit (₹)',
    discountPercentage: 'Discount Percentage (%)',
    notes: 'Notes',
    cancel: 'Cancel',
    save: 'Save',
    retailer: 'Retailer',
    manual: 'Manual',
    totalOrders: 'Total Orders',
    totalSpent: 'Total Spent',
    lastOrder: 'Last Order',
    viewDetails: 'View Details',
    orderHistory: 'Order History',
    viewFeedback: 'View Feedback',
    addToCustomers: 'Add to Customers',
    distance: 'Distance'
  });
  const [menuVisible, setMenuVisible] = useState(false);
  const [addCustomerModalVisible, setAddCustomerModalVisible] = useState(false);
  const [selectRetailerModalVisible, setSelectRetailerModalVisible] = useState(false);
  const [nearbyRetailers, setNearbyRetailers] = useState<NearbyRetailer[]>([]);
  const [loadingRetailers, setLoadingRetailers] = useState(false);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Customers', currentLanguage),
          translationService.translateText('Add Customer', currentLanguage),
          translationService.translateText('Find Nearby Retailers', currentLanguage),
          translationService.translateText('Search customers...', currentLanguage),
          translationService.translateText('Loading customers...', currentLanguage),
          translationService.translateText('No Customers Found', currentLanguage),
          translationService.translateText('Start by adding customers or finding nearby retailers to grow your business.', currentLanguage),
          translationService.translateText('Business Name', currentLanguage),
          translationService.translateText('Owner Name', currentLanguage),
          translationService.translateText('Phone Number', currentLanguage),
          translationService.translateText('Email', currentLanguage),
          translationService.translateText('Address', currentLanguage),
          translationService.translateText('Credit Limit (₹)', currentLanguage),
          translationService.translateText('Discount Percentage (%)', currentLanguage),
          translationService.translateText('Notes', currentLanguage),
          translationService.translateText('Cancel', currentLanguage),
          translationService.translateText('Save', currentLanguage),
          translationService.translateText('Retailer', currentLanguage),
          translationService.translateText('Manual', currentLanguage),
          translationService.translateText('Total Orders', currentLanguage),
          translationService.translateText('Total Spent', currentLanguage),
          translationService.translateText('Last Order', currentLanguage),
          translationService.translateText('View Details', currentLanguage),
          translationService.translateText('Order History', currentLanguage),
          translationService.translateText('View Feedback', currentLanguage),
          translationService.translateText('Add to Customers', currentLanguage),
          translationService.translateText('Distance', currentLanguage)
        ]);

        setTranslations({
          customers: results[0].translatedText,
          addCustomer: results[1].translatedText,
          findNearbyRetailers: results[2].translatedText,
          searchCustomers: results[3].translatedText,
          loadingCustomers: results[4].translatedText,
          noCustomersFound: results[5].translatedText,
          noCustomersText: results[6].translatedText,
          businessName: results[7].translatedText,
          ownerName: results[8].translatedText,
          phoneNumber: results[9].translatedText,
          email: results[10].translatedText,
          address: results[11].translatedText,
          creditLimit: results[12].translatedText,
          discountPercentage: results[13].translatedText,
          notes: results[14].translatedText,
          cancel: results[15].translatedText,
          save: results[16].translatedText,
          retailer: results[17].translatedText,
          manual: results[18].translatedText,
          totalOrders: results[19].translatedText,
          totalSpent: results[20].translatedText,
          lastOrder: results[21].translatedText,
          viewDetails: results[22].translatedText,
          orderHistory: results[23].translatedText,
          viewFeedback: results[24].translatedText,
          addToCustomers: results[25].translatedText,
          distance: results[26].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      console.log('Fetching customers for seller:', user?.id);
      
      // Fetch customers from the customers table
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('seller_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Customers fetched:', customersData?.length || 0);
      if (customersData && customersData.length > 0) {
        console.log('Sample customer:', customersData[0]);
      }

      // Format customers data
      const formattedCustomers: Customer[] = customersData?.map(customer => ({
        id: customer.id,
        business_name: customer.business_name,
        owner_name: customer.owner_name || '',
        phone_number: customer.phone_number,
        email: customer.email || '',
        address: typeof customer.address === 'object' ? 
          Object.values(customer.address).filter(Boolean).join(', ') : 
          customer.address || '',
        location_address: customer.location_address,
        latitude: customer.latitude,
        longitude: customer.longitude,
        customer_type: customer.customer_type,
        retailer_profile_id: customer.retailer_profile_id,
        credit_limit: customer.credit_limit || 0,
        payment_terms: customer.payment_terms || 'cash',
        discount_percentage: customer.discount_percentage || 0,
        total_orders: customer.total_orders || 0,
        total_spent: customer.total_spent || 0,
        last_order_date: customer.last_order_date || customer.created_at,
        status: customer.status,
        notes: customer.notes,
        tags: customer.tags || []
      })) || [];

      console.log('Formatted customers:', formattedCustomers.length);
      setCustomers(formattedCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

// Add Customer Form Component
const AddCustomerForm = ({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    phone_number: '',
    email: '',
    address: '',
    location_address: '',
    credit_limit: '',
    payment_terms: 'cash',
    discount_percentage: '',
    notes: ''
  });

  const handleSubmit = () => {
    if (!formData.business_name || !formData.owner_name || !formData.phone_number) {
      alert('Please fill in all required fields (Business Name, Owner Name, Phone Number)');
      return;
    }

    onSubmit({
      ...formData,
      credit_limit: parseFloat(formData.credit_limit) || 0,
      discount_percentage: parseFloat(formData.discount_percentage) || 0
    });
  };

  return (
    <View style={styles.formContainer}>
      <TextInput
        label={translations.businessName}
        value={formData.business_name}
        onChangeText={(text) => setFormData({ ...formData, business_name: text })}
        style={styles.formInput}
        mode="outlined"
      />
      <TextInput
        label={translations.ownerName}
        value={formData.owner_name}
        onChangeText={(text) => setFormData({ ...formData, owner_name: text })}
        style={styles.formInput}
        mode="outlined"
      />
      <TextInput
        label={translations.phoneNumber}
        value={formData.phone_number}
        onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
        style={styles.formInput}
        mode="outlined"
        keyboardType="phone-pad"
      />
      <TextInput
        label={translations.email}
        value={formData.email}
        onChangeText={(text) => setFormData({ ...formData, email: text })}
        style={styles.formInput}
        mode="outlined"
        keyboardType="email-address"
      />
      <TextInput
        label={translations.address}
        value={formData.address}
        onChangeText={(text) => setFormData({ ...formData, address: text })}
        style={styles.formInput}
        mode="outlined"
        multiline
      />
      <TextInput
        label={translations.creditLimit}
        value={formData.credit_limit}
        onChangeText={(text) => setFormData({ ...formData, credit_limit: text })}
        style={styles.formInput}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label={translations.discountPercentage}
        value={formData.discount_percentage}
        onChangeText={(text) => setFormData({ ...formData, discount_percentage: text })}
        style={styles.formInput}
        mode="outlined"
        keyboardType="numeric"
      />
      <TextInput
        label={translations.notes}
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        style={styles.formInput}
        mode="outlined"
        multiline
      />
      
      <View style={styles.formActions}>
        <Button mode="outlined" onPress={onCancel} style={styles.formButton}>
          {translations.cancel}
        </Button>
        <Button mode="contained" onPress={handleSubmit} style={styles.formButton}>
          {translations.addCustomer}
        </Button>
      </View>
    </View>
  );
};

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const fetchNearbyRetailers = async () => {
    try {
      setLoadingRetailers(true);
      
      // Get seller's location from seller_details
      const { data: sellerData, error: sellerError } = await supabase
        .from('seller_details')
        .select('latitude, longitude')
        .eq('user_id', user?.id)
        .single();

      if (sellerError || !sellerData?.latitude || !sellerData?.longitude) {
        console.error('Seller location not found:', sellerError);
        alert('Please update your business location in settings to find nearby retailers.');
        return;
      }

      // Call the nearby retailers function
      const { data: retailers, error } = await supabase
        .rpc('get_nearby_retailers', {
          seller_lat: sellerData.latitude,
          seller_lng: sellerData.longitude,
          radius_km: 50
        });

      if (error) {
        console.error('Error fetching nearby retailers:', error);
        throw error;
      }

      console.log('Nearby retailers found:', retailers?.length || 0);
      setNearbyRetailers(retailers || []);
      setSelectRetailerModalVisible(true);
    } catch (error) {
      console.error('Error fetching nearby retailers:', error);
      alert('Failed to fetch nearby retailers. Please try again.');
    } finally {
      setLoadingRetailers(false);
    }
  };

  const addRetailerAsCustomer = async (retailer: NearbyRetailer) => {
    try {
      const { data, error } = await supabase
        .rpc('add_retailer_as_customer', {
          p_seller_id: user?.id,
          p_retailer_id: retailer.id
        });

      if (error) {
        if (error.message.includes('duplicate')) {
          alert('This retailer is already in your customer list.');
        } else {
          throw error;
        }
        return;
      }

      console.log('Retailer added as customer:', data);
      alert(`${retailer.business_name} has been added to your customers.`);
      setSelectRetailerModalVisible(false);
      fetchCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error adding retailer as customer:', error);
      alert('Failed to add retailer as customer. Please try again.');
    }
  };

  const addManualCustomer = async (customerData: any) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          seller_id: user?.id,
          business_name: customerData.business_name,
          owner_name: customerData.owner_name,
          phone_number: customerData.phone_number,
          email: customerData.email,
          address: customerData.address,
          location_address: customerData.location_address,
          customer_type: 'manual',
          credit_limit: customerData.credit_limit || 0,
          payment_terms: customerData.payment_terms || 'cash',
          discount_percentage: customerData.discount_percentage || 0,
          notes: customerData.notes
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes('duplicate')) {
          alert('A customer with this phone number already exists.');
        } else {
          throw error;
        }
        return;
      }

      console.log('Manual customer added:', data);
      alert(`${customerData.business_name} has been added to your customers.`);
      setAddCustomerModalVisible(false);
      fetchCustomers(); // Refresh the list
    } catch (error) {
      console.error('Error adding manual customer:', error);
      alert('Failed to add customer. Please try again.');
    }
  };

  const renderCustomer = ({ item: customer }: { item: Customer }) => (
    <Card style={styles.customerCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.customerInfo}>
            <View style={styles.nameContainer}>
              <Text variant="titleMedium">{customer?.business_name || 'Business Name'}</Text>
              <Chip 
                mode="outlined" 
                style={[styles.typeChip, customer.customer_type === 'retailer' ? styles.retailerChip : styles.manualChip]}
                textStyle={styles.chipText}
              >
                {customer.customer_type === 'retailer' ? translations.retailer : translations.manual}
              </Chip>
            </View>
            <Text variant="bodySmall" style={styles.ownerName}>
              {customer.owner_name}
            </Text>
            {customer.payment_terms !== 'cash' && (
              <Text variant="bodySmall" style={styles.paymentTerms}>
                Payment: {customer.payment_terms.replace('_', ' ')}
              </Text>
            )}
            {customer.credit_limit > 0 && (
              <Text variant="bodySmall" style={styles.creditLimit}>
                Credit Limit: ₹{customer.credit_limit.toLocaleString()}
              </Text>
            )}
          </View>
          <IconButton
            icon="dots-vertical"
            onPress={() => {
              setSelectedCustomer(customer);
              setMenuVisible(true);
            }}
          />
        </View>

        <View style={styles.contactInfo}>
          <Text variant="bodyMedium">{customer.phone_number}</Text>
          {customer.email && (
            <Text variant="bodyMedium">{customer.email}</Text>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text variant="labelSmall">{translations.totalOrders}</Text>
            <Text variant="titleMedium">{customer.total_orders}</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="labelSmall">{translations.totalSpent}</Text>
            <Text variant="titleMedium" style={styles.amount}>
              ₹{customer.total_spent.toLocaleString()}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="labelSmall">{translations.lastOrder}</Text>
            <Text variant="bodySmall">
              {new Date(customer.last_order_date).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            icon="message"
            onPress={() => router.push({
              pathname: '/(main)/wholesaler/chat',
              params: { customerId: customer.id }
            })}
            style={styles.actionButton}
          >
            Message
          </Button>
          <Button
            mode="outlined"
            icon="history"
            onPress={() => router.push({
              pathname: '/(main)/wholesaler/customers/orders',
              params: { customerId: customer.id }
            })}
            style={styles.actionButton}
          >
            Orders
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Header with Add Customer Options */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>{translations.customers}</Text>
        <View style={styles.headerButtons}>
          <Button
            mode="outlined"
            icon="account-plus"
            onPress={() => setAddCustomerModalVisible(true)}
            style={styles.addButton}
            compact
          >
            Add Manual
          </Button>
          <Button
            mode="contained"
            icon="map-marker-radius"
            onPress={fetchNearbyRetailers}
            loading={loadingRetailers}
            disabled={loadingRetailers}
            style={styles.addButton}
            compact
          >
            Find Nearby
          </Button>
        </View>
      </View>

      <Searchbar
        placeholder={translations.searchCustomers}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge">{translations.loadingCustomers}</Text>
        </View>
      ) : customers.length === 0 ? (
        <View style={styles.centerContainer}>
            <Text variant="headlineSmall" style={styles.emptyTitle}>{translations.noCustomersFound}</Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              {translations.noCustomersText}
            </Text>
          <Text variant="bodySmall" style={styles.debugText}>
            Debug: Check console logs for more details
          </Text>
        </View>
      ) : (
        <FlatList
          data={customers.filter(customer => 
            customer.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.phone_number.includes(searchQuery)
          )}
          renderItem={renderCustomer}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        />
      )}

      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={{ x: 0, y: 0 }}
      >
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/(main)/wholesaler/customers/details',
              params: { id: selectedCustomer?.id }
            });
          }}
          title={translations.viewDetails}
          leadingIcon="account-details"
        />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/(main)/wholesaler/customers/orders',
              params: { id: selectedCustomer?.id }
            });
          }}
          title={translations.orderHistory}
          leadingIcon="history"
        />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/(main)/wholesaler/customers/feedback',
              params: { id: selectedCustomer?.id }
            });
          }}
          title={translations.viewFeedback}
          leadingIcon="star"
        />
      </Menu>

      {/* Add Manual Customer Modal */}
      <Portal>
        <Dialog visible={addCustomerModalVisible} onDismiss={() => setAddCustomerModalVisible(false)}>
          <Dialog.Title>Add New Customer</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              <AddCustomerForm onSubmit={addManualCustomer} onCancel={() => setAddCustomerModalVisible(false)} />
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      {/* Select Nearby Retailer Modal */}
      <Portal>
        <Dialog visible={selectRetailerModalVisible} onDismiss={() => setSelectRetailerModalVisible(false)}>
          <Dialog.Title>Select Nearby Retailers</Dialog.Title>
          <Dialog.Content>
            {nearbyRetailers.length === 0 ? (
              <Text>No retailers found within 50km radius.</Text>
            ) : (
              <FlatList
                data={nearbyRetailers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Card style={styles.retailerCard}>
                    <Card.Content>
                      <View style={styles.retailerInfo}>
                        <View style={styles.retailerDetails}>
                          <Text variant="titleMedium">{item.business_name}</Text>
                          <Text variant="bodySmall">{item.owner_name}</Text>
                          <Text variant="bodySmall">{item.phone_number}</Text>
                          <Text variant="bodySmall" style={styles.distance}>
                            📍 {(() => {
                              const distance = item.distance_km;
                              if (typeof distance === 'number') {
                                return distance.toFixed(1);
                              }
                              return (parseFloat(String(distance)) || 0).toFixed(1);
                            })()} km away
                          </Text>
                        </View>
                        <Button
                          mode="contained"
                          onPress={() => addRetailerAsCustomer(item)}
                          compact
                        >
                          Add
                        </Button>
                      </View>
                    </Card.Content>
                  </Card>
                )}
                style={styles.retailerList}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectRetailerModalVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    minWidth: 100,
  },
  searchbar: {
    margin: 16,
    elevation: 0,
    backgroundColor: 'white',
  },
  list: {
    padding: 16,
  },
  customerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  typeChip: {
    height: 24,
  },
  chipText: {
    fontSize: 10,
  },
  retailerChip: {
    backgroundColor: '#e3f2fd',
  },
  manualChip: {
    backgroundColor: '#f3e5f5',
  },
  ownerName: {
    color: '#666',
    marginTop: 4,
  },
  paymentTerms: {
    color: '#2196f3',
    fontSize: 12,
    marginBottom: 2,
  },
  creditLimit: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '500',
  },
  contactInfo: {
    marginTop: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stat: {
    alignItems: 'center',
  },
  amount: {
    color: '#2196F3',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  debugText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  // Form styles
  formContainer: {
    padding: 16,
  },
  formInput: {
    marginBottom: 12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  formButton: {
    flex: 1,
  },
  // Retailer modal styles
  retailerCard: {
    marginBottom: 8,
  },
  retailerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retailerDetails: {
    flex: 1,
  },
  distance: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  retailerList: {
    maxHeight: 400,
  },
});
