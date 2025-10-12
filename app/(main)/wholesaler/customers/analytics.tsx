import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton, SegmentedButtons, Button, Banner } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

type TimeRange = 'week' | 'month' | 'year';

interface CustomerAnalytics {
  purchases: {
    total: number;
    growth: number;
    data: number[];
    labels: string[];
  };
  orderFrequency: {
    average: number;
    lastOrder: string;
    nextPredicted: string;
  };
  preferences: {
    topCategories: Array<{
      name: string;
      orders: number;
    }>;
    topProducts: Array<{
      name: string;
      quantity: number;
    }>;
  };
  lifetime: {
    value: number;
    since: string;
    orderCount: number;
    averageOrderValue: number;
  };
}

export default function CustomerAnalytics() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState({
    purchases: false,
    preferences: false,
    lifetime: false
  });
  const [translations, setTranslations] = useState({
    customerAnalytics: 'Customer Analytics',
    purchaseTrends: 'Purchase Trends',
    orderFrequency: 'Order Frequency',
    preferences: 'Preferences',
    lifetimeValue: 'Lifetime Value',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    totalPurchases: 'Total Purchases',
    growth: 'Growth',
    averageFrequency: 'Average Frequency',
    lastOrder: 'Last Order',
    nextPredicted: 'Next Predicted',
    topCategories: 'Top Categories',
    topProducts: 'Top Products',
    since: 'Since',
    totalOrders: 'Total Orders',
    avgOrderValue: 'Avg Order Value',
    noData: 'No data available',
    errorLoading: 'Error loading analytics data',
    retry: 'Retry',
    days: 'days',
    orders: 'orders'
  });
  const [analytics, setAnalytics] = useState<CustomerAnalytics>({
    purchases: {
      total: 0,
      growth: 0,
      data: [0],
      labels: ['No data'],
    },
    orderFrequency: {
      average: 0,
      lastOrder: '',
      nextPredicted: '',
    },
    preferences: {
      topCategories: [],
      topProducts: [],
    },
    lifetime: {
      value: 0,
      since: 'N/A',
      orderCount: 0,
      averageOrderValue: 0,
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  useEffect(() => {
    const loadTranslations = async () => {
      const translationKeys = [
        'Customer Analytics', 'Purchase Trends', 'Order Frequency', 'Preferences', 'Lifetime Value',
        'Week', 'Month', 'Year', 'Total Purchases', 'Growth', 'Average Frequency',
        'Last Order', 'Next Predicted', 'Top Categories', 'Top Products', 'Since',
        'Total Orders', 'Avg Order Value', 'No data available', 'Error loading analytics data',
        'Retry', 'days', 'orders'
      ];

      const results = await Promise.all(
        translationKeys.map(key => translationService.translateText(key, currentLanguage))
      );

      setTranslations({
        customerAnalytics: results[0].translatedText,
        purchaseTrends: results[1].translatedText,
        orderFrequency: results[2].translatedText,
        preferences: results[3].translatedText,
        lifetimeValue: results[4].translatedText,
        week: results[5].translatedText,
        month: results[6].translatedText,
        year: results[7].translatedText,
        totalPurchases: results[8].translatedText,
        growth: results[9].translatedText,
        averageFrequency: results[10].translatedText,
        lastOrder: results[11].translatedText,
        nextPredicted: results[12].translatedText,
        topCategories: results[13].translatedText,
        topProducts: results[14].translatedText,
        since: results[15].translatedText,
        totalOrders: results[16].translatedText,
        avgOrderValue: results[17].translatedText,
        noData: results[18].translatedText,
        errorLoading: results[19].translatedText,
        retry: results[20].translatedText,
        days: results[21].translatedText,
        orders: results[22].translatedText
      });
    };

    loadTranslations();
  }, [currentLanguage]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setSectionErrors({
      purchases: false,
      preferences: false,
      lifetime: false
    });
    setError(null);
    
    // Create a local copy of section errors to track failures
    const newSectionErrors = {
      purchases: false,
      preferences: false,
      lifetime: false
    };
    
    try {
      if (!id) {
        throw new Error('Customer ID is required');
      }
      
      // Fetch purchase history
      try {
        const { data: purchaseData, error: purchaseError } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .eq('retailer_id', id)
          .gte('created_at', getStartDate())
          .order('created_at');

        if (purchaseError) throw purchaseError;
          
        // Calculate purchase trends
        const purchaseTrends = calculatePurchaseTrends(purchaseData || []);
        
        setAnalytics(prev => ({
          ...prev,
          purchases: purchaseTrends
        }));
      } catch (purchaseError) {
        console.error('Error fetching purchase data:', purchaseError);
        newSectionErrors.purchases = true;
      }
      
      // Fetch order items with product information
      try {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('order_items')
          .select(`
            id,
            product_id,
            quantity,
            product:product_id (name, category)
          `)
          .eq('seller_id', user?.id)
          .eq('retailer_id', id);
          
        if (orderItemsError) throw orderItemsError;
        
        // Process product data in JavaScript
        const productMap = {};
        const categoryMap = {};
        
        orderItemsData?.forEach(item => {
          if (item.product?.name) {
            const productName = item.product.name;
            const category = item.product.category || 'Uncategorized';
            const quantity = parseInt(item.quantity) || 0;
            
            // Aggregate product quantities
            if (!productMap[productName]) {
              productMap[productName] = 0;
            }
            productMap[productName] += quantity;
            
            // Aggregate category counts
            if (!categoryMap[category]) {
              categoryMap[category] = 0;
            }
            categoryMap[category]++;
          }
        });
        
        // Convert maps to sorted arrays
        const topProducts = Object.entries(productMap)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);
          
        const topCategories = Object.entries(categoryMap)
          .map(([name, orders]) => ({ name, orders }))
          .sort((a, b) => b.orders - a.orders)
          .slice(0, 5);

        setAnalytics(prev => ({
          ...prev,
          preferences: {
            topCategories,
            topProducts,
          }
        }));
      } catch (preferencesError) {
        console.error('Error fetching product preferences:', preferencesError);
        newSectionErrors.preferences = true;
      }

      // Calculate lifetime value metrics
      try {
        const { data: lifetimeData, error: lifetimeError } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .eq('retailer_id', id)
          .order('created_at');
          
        if (lifetimeError) throw lifetimeError;
        
        const lifetime = calculateLifetimeValue(lifetimeData || []);

        setAnalytics(prev => ({
          ...prev,
          lifetime
        }));
      } catch (lifetimeError) {
        console.error('Error fetching lifetime value data:', lifetimeError);
        newSectionErrors.lifetime = true;
      }
      
      // Update section errors
      setSectionErrors(newSectionErrors);
      
      // If all sections failed, set a general error
      if (newSectionErrors.purchases && newSectionErrors.preferences && newSectionErrors.lifetime) {
        setError('Unable to load any analytics data. Please try again later.');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const date = new Date();
    switch (timeRange) {
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date.toISOString();
  };

  const calculatePurchaseTrends = (purchases: any[]) => {
    // Group purchases by month/week/day depending on time range
    const trendsMap = {};
    const labels = [];
    const data = [];
    
    // No purchases
    if (!purchases || purchases.length === 0) {
      return {
        total: 0,
        growth: 0,
        data: [0],
        labels: ['No data'],
      };
    }
    
    try {
      // Group purchases by appropriate time period
      purchases.forEach(purchase => {
        if (!purchase || !purchase.created_at) return;
        
        const date = new Date(purchase.created_at);
        let label;
        
        // Format label based on time range
        if (timeRange === 'week') {
          label = date.toLocaleDateString('default', { weekday: 'short' });
        } else if (timeRange === 'month') {
          label = date.toLocaleDateString('default', { day: 'numeric' });
        } else { // year
          label = date.toLocaleDateString('default', { month: 'short' });
        }
        
        if (!trendsMap[label]) {
          trendsMap[label] = 0;
        }
        
        trendsMap[label] += parseFloat(purchase.total_amount) || 0;
      });
      
      // Calculate total spent
      const total = Object.values(trendsMap).reduce((sum: any, value: any) => sum + value, 0);
      
      // Convert to arrays for chart
      Object.keys(trendsMap).forEach(label => {
        labels.push(label);
        data.push(trendsMap[label]);
      });
      
      // Calculate growth (mock value for now)
      const growth = 5;
      
      return {
        total,
        growth,
        data,
        labels,
      };
    } catch (error) {
      console.error('Error calculating purchase trends:', error);
      return {
        total: 0,
        growth: 0,
        data: [0],
        labels: ['Error'],
      };
    }
  };

  const calculateLifetimeValue = (orders: any[]) => {
    if (!orders || orders.length === 0) {
      return {
        value: 0,
        since: 'N/A',
        orderCount: 0,
        averageOrderValue: 0,
      };
    }
    
    try {
      // Calculate the total value of all orders
      const totalValue = orders.reduce((sum, order) => 
        sum + (parseFloat(order.total_amount) || 0), 0);
      
      // Get the date of the first order
      const sortedOrders = [...orders].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const firstOrderDate = new Date(sortedOrders[0].created_at);
      const formattedSince = firstOrderDate.toLocaleDateString();
      
      // Calculate the average order value
      const orderCount = orders.length;
      const averageOrderValue = orderCount > 0 ? totalValue / orderCount : 0;
      
      return {
        value: totalValue,
        since: formattedSince,
        orderCount,
        averageOrderValue,
      };
    } catch (error) {
      console.error('Error calculating lifetime value:', error);
      return {
        value: 0,
        since: 'Error',
        orderCount: 0,
        averageOrderValue: 0,
      };
    }
  };

  // Render chart with error handling
  const renderChart = () => {
    try {
      // Make sure there's valid data - at minimum one valid data point
      if (sectionErrors.purchases || !analytics.purchases.data.length || 
          (analytics.purchases.data.length === 1 && analytics.purchases.data[0] === 0 && analytics.purchases.labels[0] === translations.noData)) {
        return (
          <View style={styles.chartErrorContainer}>
            <Text style={styles.chartErrorText}>{translations.noData}</Text>
            <Button mode="contained" onPress={fetchAnalytics} style={styles.retryButton}>{translations.retry}</Button>
          </View>
        );
      }
      
      return (
        <LineChart
          data={{
            labels: analytics.purchases.labels,
            datasets: [{
              data: analytics.purchases.data.length ? analytics.purchases.data : [0]
            }]
          }}
          width={Dimensions.get('window').width - 48}
          height={220}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#ffa726"
            }
          }}
          bezier
          style={styles.chart}
          fromZero
        />
      );
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <View style={styles.chartErrorContainer}>
          <Text style={styles.chartErrorText}>{translations.errorLoading}</Text>
          <Button mode="contained" onPress={fetchAnalytics} style={styles.retryButton}>{translations.retry}</Button>
        </View>
      );
    }
  };

  // Render products list with error handling
  const renderProductsList = () => {
    if (sectionErrors.preferences || analytics.preferences.topProducts.length === 0) {
      return (
        <View style={styles.sectionErrorContainer}>
          <Text style={styles.errorText}>{translations.noData}</Text>
          <Button mode="contained" onPress={fetchAnalytics} style={styles.retryButton}>{translations.retry}</Button>
        </View>
      );
    }
    
    return analytics.preferences.topProducts.map((product, index) => (
      <View key={index} style={styles.productRow}>
        <Text variant="bodyMedium">{product?.name || 'Product Name'}</Text>
        <Text variant="bodyMedium">{product.quantity} units</Text>
      </View>
    ));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left"
            onPress={() => router.back()}
          />
          <Text variant="titleLarge">{translations.customerAnalytics}</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading analytics data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left"
          onPress={() => router.back()}
        />
        <Text variant="titleLarge">{translations.customerAnalytics}</Text>
        <IconButton 
          icon="refresh"
          onPress={fetchAnalytics}
        />
      </View>

      {error && (
        <Banner
          visible={!!error}
          actions={[
            {
              label: translations.retry,
              onPress: fetchAnalytics,
            },
          ]}
          icon="alert-circle"
        >
          {error}
        </Banner>
      )}

      <ScrollView style={styles.content}>
        {/* Time Range Selector */}
        <SegmentedButtons
          value={timeRange}
          onValueChange={value => setTimeRange(value as TimeRange)}
          buttons={[
            { value: 'week', label: translations.week },
            { value: 'month', label: translations.month },
            { value: 'year', label: translations.year },
          ]}
          style={styles.timeRange}
        />

        {/* Purchase Trends */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {translations.purchaseTrends}
            </Text>
            {renderChart()}
          </Card.Content>
        </Card>

        {/* Top Products */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {translations.topProducts}
            </Text>
            {renderProductsList()}
          </Card.Content>
        </Card>

        {/* Customer Lifetime Value */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {translations.lifetimeValue}
            </Text>
            {sectionErrors.lifetime ? (
              <View style={styles.sectionErrorContainer}>
                <Text style={styles.errorText}>{translations.errorLoading}</Text>
                <Button mode="contained" onPress={fetchAnalytics} style={styles.retryButton}>{translations.retry}</Button>
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <View style={styles.stat}>
                  <Text variant="titleLarge" style={styles.amount}>
                    ₹{analytics.lifetime.value.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall">{translations.lifetimeValue}</Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="titleLarge">
                    {analytics.lifetime.orderCount}
                  </Text>
                  <Text variant="bodySmall">{translations.totalOrders}</Text>
                </View>
                <View style={styles.stat}>
                  <Text variant="titleLarge" style={styles.amount}>
                    ₹{analytics.lifetime.averageOrderValue.toLocaleString()}
                  </Text>
                  <Text variant="bodySmall">{translations.avgOrderValue}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
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
  timeRange: {
    margin: 16,
  },
  card: {
    margin: 16,
    marginTop: 0,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  amount: {
    color: '#2196F3',
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
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  chartErrorContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
  },
  chartErrorText: {
    marginBottom: 16,
    color: '#757575',
  },
  sectionErrorContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
