import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, IconButton, Chip, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../services/supabase/supabase';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'completed' | 'failed';
  created_at: string;
  items: OrderItem[];
}

export default function CustomerOrders() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentLanguage } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [translations, setTranslations] = useState({
    orderHistory: 'Order History',
    orderNumber: 'Order #',
    totalAmount: 'Total Amount',
    status: 'Status',
    paymentStatus: 'Payment Status',
    orderDate: 'Order Date',
    items: 'Items',
    viewDetails: 'View Details',
    pending: 'Pending',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    completed: 'Completed',
    failed: 'Failed',
    noOrders: 'No orders found',
    noOrdersMessage: 'This customer has not placed any orders yet.'
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      if (currentLanguage === 'en') return;
      
      try {
        const results = await Promise.all([
        translationService.translateText('Order History', currentLanguage),
        translationService.translateText('Order #', currentLanguage),
        translationService.translateText('Total Amount', currentLanguage),
        translationService.translateText('Status', currentLanguage),
        translationService.translateText('Payment Status', currentLanguage),
        translationService.translateText('Order Date', currentLanguage),
        translationService.translateText('Items', currentLanguage),
        translationService.translateText('View Details', currentLanguage),
        translationService.translateText('Pending', currentLanguage),
        translationService.translateText('Confirmed', currentLanguage),
        translationService.translateText('Shipped', currentLanguage),
        translationService.translateText('Delivered', currentLanguage),
        translationService.translateText('Cancelled', currentLanguage),
        translationService.translateText('Completed', currentLanguage),
        translationService.translateText('Failed', currentLanguage),
        translationService.translateText('No orders found', currentLanguage),
        translationService.translateText('This customer has not placed any orders yet.', currentLanguage)
      ]);

        setTranslations({
          orderHistory: results[0].translatedText,
          orderNumber: results[1].translatedText,
          totalAmount: results[2].translatedText,
          status: results[3].translatedText,
          paymentStatus: results[4].translatedText,
          orderDate: results[5].translatedText,
          items: results[6].translatedText,
          viewDetails: results[7].translatedText,
          pending: results[8].translatedText,
          confirmed: results[9].translatedText,
          shipped: results[10].translatedText,
          delivered: results[11].translatedText,
          cancelled: results[12].translatedText,
          completed: results[13].translatedText,
          failed: results[14].translatedText,
          noOrders: results[15].translatedText,
          noOrdersMessage: results[16].translatedText
        });
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('retailer_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed': return '#4CAF50';
      case 'shipped': return '#2196F3';
      case 'delivered': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#FFC107';
    }
  };

  const getStatusTranslation = (status: Order['status']) => {
    switch (status) {
      case 'pending': return translations.pending;
      case 'confirmed': return translations.confirmed;
      case 'shipped': return translations.shipped;
      case 'delivered': return translations.delivered;
      case 'cancelled': return translations.cancelled;
      default: return translations.pending;
    }
  };

  const getPaymentStatusTranslation = (status: Order['payment_status']) => {
    switch (status) {
      case 'pending': return translations.pending;
      case 'completed': return translations.completed;
      case 'failed': return translations.failed;
      default: return translations.pending;
    }
  };

  const renderOrder = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Card.Content>
        <View style={styles.orderHeader}>
          <View>
            <Text variant="titleMedium">{translations.orderNumber}{order.order_number}</Text>
            <Text variant="bodySmall" style={styles.date}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Chip 
            mode="flat"
            style={{ backgroundColor: getStatusColor(order.status) + '20' }}
            textStyle={{ color: getStatusColor(order.status) }}
          >
            {getStatusTranslation(order.status)}
          </Chip>
        </View>

        <View style={styles.orderItems}>
          {order.items.map((item, index) => (
            <Text key={index} variant="bodyMedium" numberOfLines={1}>
              {item.quantity}x {item.name}
            </Text>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <Text variant="titleMedium" style={styles.amount}>
              ₹{order.total_amount.toLocaleString()}
            </Text>
            <Chip mode="flat" style={styles.paymentStatus}>
              {getPaymentStatusTranslation(order.payment_status)}
            </Chip>
          </View>
          <Button
            mode="contained"
            onPress={() => router.push({
              pathname: '/(main)/wholesaler/orders/details',
              params: { id: order.id }
            })}
          >
            {translations.viewDetails}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.orderHistory}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {translations.noOrders}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyMessage}>
              {translations.noOrdersMessage}
            </Text>
          </View>
        )}
      />
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
  list: {
    padding: 16,
  },
  orderCard: {
    marginBottom: 16,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  date: {
    color: '#666',
    marginTop: 4,
  },
  orderItems: {
    marginBottom: 16,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  amount: {
    color: '#2196F3',
  },
  paymentStatus: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginBottom: 8,
    color: '#666',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#999',
  },
});
