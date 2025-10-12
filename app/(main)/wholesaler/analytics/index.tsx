import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Text, Card, IconButton, SegmentedButtons, Banner, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { supabase } from '../../../../services/supabase/supabase';
import { useAuthStore } from '../../../../store/auth';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { translationService } from '../../../../services/translationService';

type TimeRange = 'week' | 'month' | 'year';

interface Analytics {
  revenue: {
    total: number;
    growth: number;
    data: number[];
    labels: string[];
  };
  orders: {
    total: number;
    growth: number;
    data: number[];
    pending: number;
  };
  products: {
    total: number;
    lowStock: number;
    topSelling: Array<{
      id: string;
      name: string;
      quantity: number;
    }>;
  };
  customers: {
    total: number;
    new: number;
    repeat: number;
  };
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState({
    analytics: 'Analytics',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    revenue: 'Revenue',
    orders: 'Orders',
    pending: 'Pending',
    orderTrends: 'Order Trends',
    customers: 'Customers',
    totalCustomers: 'Total Customers',
    newCustomers: 'New Customers',
    repeatCustomers: 'Repeat Customers',
    products: 'Products',
    topSelling: 'Top Selling Products',
    lowStock: 'Low Stock',
    totalProducts: 'Total Products',
    errorLoading: 'Error loading analytics data',
    retry: 'Retry',
    noData: 'No data available'
  });
  const [analytics, setAnalytics] = useState<Analytics>({
    revenue: {
      total: 0,
      growth: 0,
      data: [],
      labels: [],
    },
    orders: {
      total: 0,
      growth: 0,
      data: [],
      pending: 0,
    },
    products: {
      total: 0,
      lowStock: 0,
      topSelling: [],
    },
    customers: {
      total: 0,
      new: 0,
      repeat: 0,
    },
  });

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const results = await Promise.all([
          translationService.translateText('Analytics', currentLanguage),
          translationService.translateText('Week', currentLanguage),
          translationService.translateText('Month', currentLanguage),
          translationService.translateText('Year', currentLanguage),
          translationService.translateText('Revenue', currentLanguage),
          translationService.translateText('Orders', currentLanguage),
          translationService.translateText('Pending', currentLanguage),
          translationService.translateText('Order Trends', currentLanguage),
          translationService.translateText('Customers', currentLanguage),
          translationService.translateText('Total Customers', currentLanguage),
          translationService.translateText('New Customers', currentLanguage),
          translationService.translateText('Repeat Customers', currentLanguage)
        ]);

        setTranslations({
          analytics: results[0].translatedText,
          week: results[1].translatedText,
          month: results[2].translatedText,
          year: results[3].translatedText,
          revenue: results[4].translatedText,
          orders: results[5].translatedText,
          pending: results[6].translatedText,
          orderTrends: results[7].translatedText,
          customers: results[8].translatedText,
          totalCustomers: results[9].translatedText,
          newCustomers: results[10].translatedText,
          repeatCustomers: results[11].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch revenue data
      const { data: revenueData, error: revenueError } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('seller_id', user?.id)
        .gte('created_at', getStartDate())
        .order('created_at');

      if (revenueError) throw revenueError;

      // Fetch orders data
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('status, created_at')
        .eq('seller_id', user?.id)
        .gte('created_at', getStartDate());

      if (ordersError) throw ordersError;

      // Fetch product data
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, quantity, min_quantity')
        .eq('seller_id', user?.id);

      if (productsError) throw productsError;

      // Fetch customer data
      const { data: customersData, error: customersError } = await supabase
        .from('orders')
        .select('retailer_id, created_at')
        .eq('seller_id', user?.id);

      if (customersError) throw customersError;

      // Process and set analytics data
      setAnalytics({
        revenue: processRevenueData(revenueData || []),
        orders: processOrdersData(ordersData || []),
        products: processProductsData(productsData || [], ordersData || []),
        customers: processCustomersData(customersData || []),
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
    }
  };

  const processRevenueData = (data: any[]) => {
    try {
      if (!data || data.length === 0) {
        return {
          total: 0,
          growth: 0,
          data: [0],
          labels: [translations.noData],
        };
      }

      const total = data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      
      // Group data by time period
      const groupedData = new Map();
      data.forEach(order => {
        const date = new Date(order.created_at);
        let key;
        
        switch (timeRange) {
          case 'week':
            key = date.toLocaleDateString('en-US', { weekday: 'short' });
            break;
          case 'month':
            key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            break;
          case 'year':
            key = date.toLocaleDateString('en-US', { month: 'short' });
            break;
          default:
            key = date.toLocaleDateString();
        }
        
        if (!groupedData.has(key)) {
          groupedData.set(key, 0);
        }
        groupedData.set(key, groupedData.get(key) + order.total_amount);
      });

      const labels = Array.from(groupedData.keys());
      const values = Array.from(groupedData.values());

      return {
        total,
        growth: calculateGrowth(data),
        data: values.length > 0 ? values : [0],
        labels: labels.length > 0 ? labels : [translations.noData],
      };
    } catch (error) {
      console.error('Error processing revenue data:', error);
      return {
        total: 0,
        growth: 0,
        data: [0],
        labels: ['Error'],
      };
    }
  };

  const processOrdersData = (data: any[]) => {
    try {
      const total = data.length;
      const pending = data.filter(order => order.status === 'pending').length;
      
      // Group orders by time period for trend data
      const groupedData = new Map();
      data.forEach(order => {
        const date = new Date(order.created_at);
        let key;
        
        switch (timeRange) {
          case 'week':
            key = date.getDay();
            break;
          case 'month':
            key = Math.floor(date.getDate() / 7);
            break;
          case 'year':
            key = date.getMonth();
            break;
          default:
            key = date.getDate();
        }
        
        if (!groupedData.has(key)) {
          groupedData.set(key, 0);
        }
        groupedData.set(key, groupedData.get(key) + 1);
      });

      const values = Array.from(groupedData.values());

      return {
        total,
        growth: calculateGrowth(data),
        data: values.length > 0 ? values : [0],
        pending,
      };
    } catch (error) {
      console.error('Error processing orders data:', error);
      return {
        total: 0,
        growth: 0,
        data: [0],
        pending: 0,
      };
    }
  };

  const processProductsData = (data: any[], ordersData: any[]) => {
    try {
      const total = data.length;
      const lowStock = data.filter(product => 
        (product.quantity || 0) <= (product.min_quantity || 0)
      ).length;
      
      // Calculate sold quantities from order data
      const productSales: { [key: string]: { name: string; quantity: number } } = {};
      
      ordersData.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (item.product_id) {
              const product = data.find(p => p.id === item.product_id);
              if (product) {
                if (!productSales[item.product_id]) {
                  productSales[item.product_id] = {
                    name: product.name || 'Unknown Product',
                    quantity: 0
                  };
                }
                productSales[item.product_id].quantity += item.quantity || 0;
              }
            }
          });
        }
      });
      
      const topSelling = Object.entries(productSales)
        .map(([id, data]) => ({
          id,
          name: data.name,
          quantity: data.quantity,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      return {
        total,
        lowStock,
        topSelling,
      };
    } catch (error) {
      console.error('Error processing products data:', error);
      return {
        total: 0,
        lowStock: 0,
        topSelling: [],
      };
    }
  };

  const processCustomersData = (data: any[]) => {
    try {
      if (!data || data.length === 0) {
        return {
          total: 0,
          new: 0,
          repeat: 0,
        };
      }

      // Get unique customers
      const customerMap = new Map();
      data.forEach(order => {
        const customerId = order.retailer_id;
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            firstOrder: new Date(order.created_at),
            orderCount: 0,
          });
        }
        customerMap.get(customerId).orderCount++;
        
        // Update first order date if this order is earlier
        const orderDate = new Date(order.created_at);
        if (orderDate < customerMap.get(customerId).firstOrder) {
          customerMap.get(customerId).firstOrder = orderDate;
        }
      });

      const total = customerMap.size;
      const startDate = new Date(getStartDate());
      
      let newCustomers = 0;
      let repeatCustomers = 0;
      
      customerMap.forEach(customer => {
        if (customer.firstOrder >= startDate) {
          newCustomers++;
        }
        if (customer.orderCount > 1) {
          repeatCustomers++;
        }
      });

      return {
        total,
        new: newCustomers,
        repeat: repeatCustomers,
      };
    } catch (error) {
      console.error('Error processing customers data:', error);
      return {
        total: 0,
        new: 0,
        repeat: 0,
      };
    }
  };

  const calculateGrowth = (data: any[]) => {
    try {
      if (!data || data.length < 2) return 0;
      
      const now = new Date();
      const periodStart = new Date(getStartDate());
      const periodLength = now.getTime() - periodStart.getTime();
      const previousPeriodStart = new Date(periodStart.getTime() - periodLength);
      
      const currentPeriodData = data.filter(item => 
        new Date(item.created_at) >= periodStart
      );
      const previousPeriodData = data.filter(item => {
        const date = new Date(item.created_at);
        return date >= previousPeriodStart && date < periodStart;
      });
      
      if (previousPeriodData.length === 0) return 0;
      
      const currentValue = currentPeriodData.length;
      const previousValue = previousPeriodData.length;
      
      return Math.round(((currentValue - previousValue) / previousValue) * 100);
    } catch (error) {
      console.error('Error calculating growth:', error);
      return 0;
    }
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: '#ffffff',
    backgroundGradientToOpacity: 0.5,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#2196F3'
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#e3e3e3',
      strokeWidth: 1
    },
    propsForLabels: {
      fontSize: 12,
      fontFamily: 'System'
    }
  };

  // Helper function to validate chart data
  const validateChartData = (data: number[], labels: string[]) => {
    if (!data || !labels || data.length === 0 || labels.length === 0) {
      return { data: [0], labels: ['No Data'] };
    }
    
    // Ensure data and labels have same length
    const minLength = Math.min(data.length, labels.length);
    return {
      data: data.slice(0, minLength).map(val => val || 0),
      labels: labels.slice(0, minLength)
    };
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton 
            icon="arrow-left"
            onPress={() => router.back()}
          />
          <Text variant="titleLarge">{translations.analytics}</Text>
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
        <Text variant="titleLarge">{translations.analytics}</Text>
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

      <View style={styles.timeRangeSelector}>
        <SegmentedButtons
          value={timeRange}
          onValueChange={value => setTimeRange(value as TimeRange)}
          buttons={[
            { value: 'week', label: translations.week },
            { value: 'month', label: translations.month },
            { value: 'year', label: translations.year },
          ]}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Revenue Overview */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>{translations.revenue}</Text>
            <Text variant="headlineMedium" style={styles.amount}>
              ₹{analytics.revenue.total.toLocaleString()}
            </Text>
            <Text variant="bodySmall" style={styles.growth}>
              {analytics.revenue.growth}% from last {timeRange}
             </Text>
             {analytics.revenue.data.length > 0 && analytics.revenue.data[0] !== 0 ? (
               <View style={styles.chart}>
                 <LineChart
                   data={{
                     labels: validateChartData(analytics.revenue.data, analytics.revenue.labels).labels,
                     datasets: [{ 
                       data: validateChartData(analytics.revenue.data, analytics.revenue.labels).data,
                       color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                       strokeWidth: 2
                     }],
                   }}
                   width={Dimensions.get('window').width - 64}
                   height={220}
                   chartConfig={chartConfig}
                   bezier
                   style={styles.chartStyle}
                   withDots={true}
                   withShadow={false}
                   withVerticalLabels={true}
                   withHorizontalLabels={true}
                 />
               </View>
             ) : (
               <View style={styles.noDataContainer}>
                 <Text style={styles.noDataText}>{translations.noData}</Text>
               </View>
             )}
          </Card.Content>
        </Card>

        {/* Orders Overview */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statRow}>
              <View>
                <Text variant="titleMedium">{translations.orders}</Text>
                <Text variant="headlineMedium">{analytics?.orders?.total || 0}</Text>
                <Text variant="bodySmall" style={styles.growth}>
                  {analytics?.orders?.growth || 0}% from last {timeRange}
                </Text>
              </View>
              <View>
                <Text variant="titleMedium">{translations.pending}</Text>
                <Text variant="headlineMedium">{analytics?.orders?.pending || 0}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Products Overview */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {translations.products}
            </Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text variant="titleLarge">{analytics?.products?.total || 0}</Text>
                <Text variant="bodySmall">{translations.totalProducts}</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="titleLarge" style={styles.warningText}>{analytics?.products?.lowStock || 0}</Text>
                <Text variant="bodySmall">{translations.lowStock}</Text>
              </View>
            </View>
            
            {analytics.products.topSelling.length > 0 ? (
              <View>
                <Text variant="titleSmall" style={styles.sectionTitle}>{translations.topSelling}</Text>
                <View style={styles.chart}>
                  <BarChart
                    data={{
                      labels: analytics.products.topSelling.map(p => p.name.substring(0, 8)),
                      datasets: [{
                        data: analytics.products.topSelling.map(p => p.quantity || 0),
                        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`
                      }],
                    }}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chartStyle}
                    showValuesOnTopOfBars
                    withCustomBarColorFromData={false}
                    flatColor={true}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>{translations.noData}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Customer Overview */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              {translations.customers}
            </Text>
            <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text variant="titleLarge">{analytics?.customers?.total || 0}</Text>
                  <Text variant="bodySmall">{translations.totalCustomers}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="titleLarge">{analytics?.customers?.new || 0}</Text>
                  <Text variant="bodySmall">{translations.newCustomers}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="titleLarge">{analytics?.customers?.repeat || 0}</Text>
                  <Text variant="bodySmall">{translations.repeatCustomers}</Text>
                </View>
              </View>
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
  timeRangeSelector: {
    padding: 16,
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  amount: {
    color: '#2196F3',
    fontWeight: '600',
  },
  growth: {
    color: '#4CAF50',
    marginTop: 4,
  },
  chart: {
    marginTop: 16,
    alignItems: 'center',
  },
  chartStyle: {
    borderRadius: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stat: {
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  noDataContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 16,
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
  },
  warningText: {
    color: '#FF9800',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
});
