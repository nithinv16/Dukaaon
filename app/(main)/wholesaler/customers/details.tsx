import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, IconButton, Button, Divider, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface CustomerDetails {
  id: string;
  business_name: string;
  owner_name: string;
  phone_number: string;
  email?: string;
  address: string;
  gst_number?: string;
  registration_date: string;
  stats: {
    total_orders: number;
    total_spent: number;
    average_order_value: number;
    last_order_date: string;
  };
}

export default function CustomerDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [translations, setTranslations] = useState({
    customerDetails: 'Customer Details',
    businessInformation: 'Business Information',
    businessName: 'Business Name',
    ownerName: 'Owner Name',
    gstNumber: 'GST Number',
    registrationDate: 'Registration Date',
    contactInformation: 'Contact Information',
    phoneNumber: 'Phone Number',
    email: 'Email',
    address: 'Address',
    customerStatistics: 'Customer Statistics',
    totalOrders: 'Total Orders',
    totalSpent: 'Total Spent',
    avgOrderValue: 'Avg. Order Value',
    sendMessage: 'Send Message',
    orderHistory: 'Order History',
    viewFeedback: 'View Feedback'
  });

  useEffect(() => {
    fetchCustomerDetails();
  }, [id]);

  useEffect(() => {
    const loadTranslations = async () => {
      const results = await Promise.all([
        translationService.translateText('Customer Details', currentLanguage),
        translationService.translateText('Business Information', currentLanguage),
        translationService.translateText('Business Name', currentLanguage),
        translationService.translateText('Owner Name', currentLanguage),
        translationService.translateText('GST Number', currentLanguage),
        translationService.translateText('Registration Date', currentLanguage),
        translationService.translateText('Contact Information', currentLanguage),
        translationService.translateText('Phone Number', currentLanguage),
        translationService.translateText('Email', currentLanguage),
        translationService.translateText('Address', currentLanguage),
        translationService.translateText('Customer Statistics', currentLanguage),
        translationService.translateText('Total Orders', currentLanguage),
        translationService.translateText('Total Spent', currentLanguage),
        translationService.translateText('Avg. Order Value', currentLanguage),
        translationService.translateText('Send Message', currentLanguage),
        translationService.translateText('Order History', currentLanguage),
        translationService.translateText('View Feedback', currentLanguage)
      ]);

      setTranslations({
        customerDetails: results[0].translatedText,
        businessInformation: results[1].translatedText,
        businessName: results[2].translatedText,
        ownerName: results[3].translatedText,
        gstNumber: results[4].translatedText,
        registrationDate: results[5].translatedText,
        contactInformation: results[6].translatedText,
        phoneNumber: results[7].translatedText,
        email: results[8].translatedText,
        address: results[9].translatedText,
        customerStatistics: results[10].translatedText,
        totalOrders: results[11].translatedText,
        totalSpent: results[12].translatedText,
        avgOrderValue: results[13].translatedText,
        sendMessage: results[14].translatedText,
        orderHistory: results[15].translatedText,
        viewFeedback: results[16].translatedText
      });
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchCustomerDetails = async () => {
    try {
      // Fetch customer profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      // Fetch customer stats
      const { data: stats, error: statsError } = await supabase
        .from('orders')
        .select(`
          count(*),
          sum(total_amount),
          avg(total_amount),
          max(created_at)
        `)
        .eq('seller_id', user?.id)
        .eq('retailer_id', id)
        .single();

      if (statsError) throw statsError;

      setCustomer({
        id: profile.id,
        business_name: profile.business_details.business_name,
        owner_name: profile.business_details.owner_name,
        phone_number: profile.phone_number,
        email: profile.email,
        address: profile.business_details.address,
        gst_number: profile.business_details.gst_number,
        registration_date: profile.created_at,
        stats: {
          total_orders: parseInt(stats.count),
          total_spent: parseFloat(stats.sum),
          average_order_value: parseFloat(stats.avg),
          last_order_date: stats.max,
        },
      });
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.customerDetails}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Business Information */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {translations.businessInformation}
            </Text>
            <List.Item
              title={translations.businessName}
              description={customer.business_name}
              left={props => <List.Icon {...props} icon="store" />}
            />
            <Divider />
            <List.Item
              title={translations.ownerName}
              description={customer.owner_name}
              left={props => <List.Icon {...props} icon="account" />}
            />
            <Divider />
            {customer.gst_number && (
              <>
                <List.Item
                  title={translations.gstNumber}
                  description={customer.gst_number}
                  left={props => <List.Icon {...props} icon="file-document" />}
                />
                <Divider />
              </>
            )}
            <List.Item
              title={translations.registrationDate}
              description={new Date(customer.registration_date).toLocaleDateString()}
              left={props => <List.Icon {...props} icon="calendar" />}
            />
          </Card.Content>
        </Card>

        {/* Contact Information */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {translations.contactInformation}
            </Text>
            <List.Item
              title={translations.phoneNumber}
              description={customer.phone_number}
              left={props => <List.Icon {...props} icon="phone" />}
              right={props => (
                <IconButton 
                  {...props} 
                  icon="phone" 
                  onPress={() => {/* Handle call */}}
                />
              )}
            />
            <Divider />
            {customer.email && (
              <>
                <List.Item
                  title={translations.email}
                  description={customer.email}
                  left={props => <List.Icon {...props} icon="email" />}
                  right={props => (
                    <IconButton 
                      {...props} 
                      icon="email" 
                      onPress={() => {/* Handle email */}}
                    />
                  )}
                />
                <Divider />
              </>
            )}
            <List.Item
              title={translations.address}
              description={customer.address}
              left={props => <List.Icon {...props} icon="map-marker" />}
            />
          </Card.Content>
        </Card>

        {/* Business Stats */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {translations.customerStatistics}
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="titleLarge">{customer.stats.total_orders}</Text>
                <Text variant="bodySmall">{translations.totalOrders}</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="titleLarge" style={styles.amount}>
                  ₹{customer.stats.total_spent.toLocaleString()}
                </Text>
                <Text variant="bodySmall">{translations.totalSpent}</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="titleLarge" style={styles.amount}>
                  ₹{customer.stats.average_order_value.toLocaleString()}
                </Text>
                <Text variant="bodySmall">{translations.avgOrderValue}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="history"
            onPress={() => {
              const orderHistoryParams = new URLSearchParams({ id: customer.id });
              router.push(`/(main)/wholesaler/customers/orders?${orderHistoryParams.toString()}`);
            }}
            style={styles.actionButton}
          >
            {translations.orderHistory}
          </Button>
          <Button
            mode="contained"
            icon="message"
            onPress={() => {
              const chatParams = new URLSearchParams({ customerId: customer.id });
              router.push(`/(main)/wholesaler/chat?${chatParams.toString()}`);
            }}
            style={styles.actionButton}
          >
            {translations.sendMessage}
          </Button>
          <Button
            mode="contained"
            icon="star"
            onPress={() => {
              const feedbackParams = new URLSearchParams({ id: customer.id });
              router.push(`/(main)/wholesaler/customers/feedback?${feedbackParams.toString()}`);
            }}
            style={styles.actionButton}
          >
            {translations.viewFeedback}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  amount: {
    color: '#2196F3',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    gap: 16,
  },
  actionButton: {
    flex: 1,
  },
});
