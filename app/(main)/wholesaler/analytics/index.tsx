import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, IconButton, SegmentedButtons, Banner, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { SystemStatusBar } from '../../../../components/SystemStatusBar';
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
    averageOrderValue: number; // NEW: AOV
  };
  orders: {
    total: number;
    growth: number;
    data: number[];
    pending: number;
    // NEW: Order Status Breakdown
    statusBreakdown: {
      pending: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
    };
  };
  products: {
    total: number;
    lowStock: number;
    topSelling: Array<{
      id: string;
      name: string;
      quantity: number;
    }>;
    stockTurnover: number; // NEW: Stock turnover rate
  };
  customers: {
    total: number;
    new: number;
    repeat: number;
    // NEW: Top Customers
    topCustomers: Array<{
      id: string;
      name: string;
      totalOrders: number;
      totalSpent: number;
    }>;
  };
}


// Wholesaler Premium Theme Palette (Navy/Teal)
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
  chartGradientFrom: '#001F3F',
  chartGradientTo: '#003366',
};

export default function AnalyticsDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { currentLanguage } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(false); // Start false - will be true only when actually fetching
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
      averageOrderValue: 0,
    },
    orders: {
      total: 0,
      growth: 0,
      data: [],
      pending: 0,
      statusBreakdown: {
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      },
    },
    products: {
      total: 0,
      lowStock: 0,
      topSelling: [],
      stockTurnover: 0,
    },
    customers: {
      total: 0,
      new: 0,
      repeat: 0,
      topCustomers: [],
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
          translationService.translateText('Repeat Customers', currentLanguage),
          translationService.translateText('Products', currentLanguage),
          translationService.translateText('Top Selling Products', currentLanguage),
          translationService.translateText('Low Stock', currentLanguage),
          translationService.translateText('Total Products', currentLanguage),
          translationService.translateText('Error loading analytics data', currentLanguage),
          translationService.translateText('Retry', currentLanguage),
          translationService.translateText('No data available', currentLanguage)
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
          repeatCustomers: results[11].translatedText,
          products: results[12].translatedText,
          topSelling: results[13].translatedText,
          lowStock: results[14].translatedText,
          totalProducts: results[15].translatedText,
          errorLoading: results[16].translatedText,
          retry: results[17].translatedText,
          noData: results[18].translatedText
        });
      } catch (error) {
        console.error('Error loading translations:', error);
      }
    };

    loadTranslations();
  }, [currentLanguage]);

  useEffect(() => {
    // CRITICAL: Don't fetch until we have a valid user ID
    if (!user?.id) {
      console.log('AnalyticsDashboard: Waiting for user ID...');
      return;
    }
    console.log('AnalyticsDashboard: Fetching analytics for user:', user.id);
    fetchAnalytics();
  }, [timeRange, user?.id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch revenue data - only count delivered orders
      const { data: revenueData, error: revenueError } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('seller_id', user?.id)
        .eq('status', 'delivered')
        .gte('created_at', getStartDate())
        .order('created_at');

      if (revenueError) throw revenueError;

      // Fetch orders data with status for breakdown
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('status, created_at, total_amount, retailer_id')
        .eq('seller_id', user?.id)
        .gte('created_at', getStartDate());

      if (ordersError) throw ordersError;

      // Fetch product data with sales info
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock_available, min_quantity')
        .eq('seller_id', user?.id);

      if (productsError) throw productsError;

      // Fetch all orders for customer analysis (not time-limited for accurate top customers)
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from('orders')
        .select('retailer_id, created_at, total_amount, status')
        .eq('seller_id', user?.id);

      if (allOrdersError) throw allOrdersError;

      // Fetch retailer profiles for top customers names
      const retailerIds = [...new Set((allOrdersData || []).map(o => o.retailer_id).filter(Boolean))];
      let retailerProfiles: any[] = [];
      if (retailerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, business_name, full_name')
          .in('id', retailerIds.slice(0, 50)); // Limit to 50 for performance
        retailerProfiles = profiles || [];
      }

      // Process and set analytics data
      setAnalytics({
        revenue: processRevenueData(revenueData || []),
        orders: processOrdersData(ordersData || []),
        products: processProductsData(productsData || [], ordersData || []),
        customers: processCustomersData(allOrdersData || [], retailerProfiles),
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
          averageOrderValue: 0,
        };
      }

      const total = data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = data.length > 0 ? Math.round(total / data.length) : 0;

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
        averageOrderValue,
      };
    } catch (error) {
      console.error('Error processing revenue data:', error);
      return {
        total: 0,
        growth: 0,
        data: [0],
        labels: ['Error'],
        averageOrderValue: 0,
      };
    }
  };

  const processOrdersData = (data: any[]) => {
    try {
      const total = data.length;
      const pending = data.filter(order => order.status === 'pending').length;

      // Order Status Breakdown
      const statusBreakdown = {
        pending: data.filter(o => o.status === 'pending').length,
        processing: data.filter(o => o.status === 'processing').length,
        shipped: data.filter(o => o.status === 'shipped').length,
        delivered: data.filter(o => o.status === 'delivered').length,
        cancelled: data.filter(o => o.status === 'cancelled').length,
      };

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
        statusBreakdown,
      };
    } catch (error) {
      console.error('Error processing orders data:', error);
      return {
        total: 0,
        growth: 0,
        data: [0],
        pending: 0,
        statusBreakdown: {
          pending: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
        },
      };
    }
  };

  const processProductsData = (data: any[], ordersData: any[]) => {
    try {
      const total = data.length;
      const lowStock = data.filter(product =>
        (product.stock_available || 0) <= (product.min_quantity || 0)
      ).length;

      // Calculate sold quantities from order data
      const productSales: { [key: string]: { name: string; quantity: number } } = {};
      let totalSoldQuantity = 0;

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
                totalSoldQuantity += item.quantity || 0;
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

      // Calculate Stock Turnover Rate: sold units / total available stock
      const totalAvailableStock = data.reduce((sum, p) => sum + (p.stock_available || 0), 0);
      const stockTurnover = totalAvailableStock > 0
        ? Math.round((totalSoldQuantity / totalAvailableStock) * 100) / 100
        : 0;

      return {
        total,
        lowStock,
        topSelling,
        stockTurnover,
      };
    } catch (error) {
      console.error('Error processing products data:', error);
      return {
        total: 0,
        lowStock: 0,
        topSelling: [],
        stockTurnover: 0,
      };
    }
  };

  const processCustomersData = (data: any[], retailerProfiles: any[] = []) => {
    try {
      if (!data || data.length === 0) {
        return {
          total: 0,
          new: 0,
          repeat: 0,
          topCustomers: [],
        };
      }

      // Get unique customers with order stats
      const customerMap = new Map<string, {
        firstOrder: Date;
        orderCount: number;
        totalSpent: number;
      }>();

      data.forEach(order => {
        const customerId = order.retailer_id;
        if (!customerId) return;

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            firstOrder: new Date(order.created_at),
            orderCount: 0,
            totalSpent: 0,
          });
        }
        const customer = customerMap.get(customerId)!;
        customer.orderCount++;
        customer.totalSpent += order.total_amount || 0;

        // Update first order date if this order is earlier
        const orderDate = new Date(order.created_at);
        if (orderDate < customer.firstOrder) {
          customer.firstOrder = orderDate;
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

      // Build Top Customers list (sorted by total spent)
      const topCustomers = Array.from(customerMap.entries())
        .map(([id, stats]) => {
          const profile = retailerProfiles.find(p => p.id === id);
          return {
            id,
            name: profile?.business_name || profile?.full_name || 'Unknown Customer',
            totalOrders: stats.orderCount,
            totalSpent: Math.round(stats.totalSpent),
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      return {
        total,
        new: newCustomers,
        repeat: repeatCustomers,
        topCustomers,
      };
    } catch (error) {
      console.error('Error processing customers data:', error);
      return {
        total: 0,
        new: 0,
        repeat: 0,
        topCustomers: [],
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

  // Wholesaler Premium Theme Palette
  // Wholesaler Premium Theme Palette (Navy/Teal)
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
    chartGradientFrom: '#001F3F',
    chartGradientTo: '#003366',
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: '#ffffff',
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(57, 204, 204, ${opacity})`, // Teal
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`, // Grey
    strokeWidth: 3,
    barPercentage: 0.65,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: '#39CCCC',
      fill: '#FFFFFF'
    },
    propsForBackgroundLines: {
      strokeDasharray: '4', // Dashed lines
      stroke: '#E0E0E0',    // Light grey
      strokeWidth: 1
    },
    propsForLabels: {
      fontSize: 11,
      fontWeight: '500',
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
      <View style={[styles.container, { backgroundColor: THEME.background }]}>
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <IconButton
            icon="arrow-left"
            iconColor={THEME.primary}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: THEME.textPrimary }]}>{translations.analytics}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.accent} />
          <Text style={[styles.loadingText, { color: THEME.textSecondary }]}>Loading insights...</Text>
        </View>
      </View>
    );
  }

  const StatCard = ({ title, value, subtext, icon, color }: any) => (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
          <IconButton icon={icon} iconColor={color} size={24} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statLabel}>{title}</Text>
          <Text style={styles.statValue}>{value}</Text>
          {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
        </View>
      </View>
    </View>
  );

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

      {/* Header */}
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
        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>{translations.analytics}</Text>
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
          onPress={fetchAnalytics}
        >
          <IconButton
            icon="refresh"
            iconColor="#FFFFFF"
            size={24}
            onPress={fetchAnalytics}
            style={{ margin: 0 }}
          />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={{ color: THEME.warning }}>{error}</Text>
          <Button mode="text" textColor={THEME.accent} onPress={fetchAnalytics}>
            {translations.retry}
          </Button>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Time Filter - Custom Pill Design */}
        <View style={styles.filterContainer}>
          {['week', 'month', 'year'].map((t) => (
            <Button
              key={t}
              mode={timeRange === t ? 'contained' : 'text'}
              onPress={() => setTimeRange(t as TimeRange)}
              contentStyle={{ height: 36 }}
              labelStyle={{
                fontSize: 13,
                fontWeight: timeRange === t ? '700' : '500',
                color: timeRange === t ? '#FFF' : THEME.textSecondary
              }}
              style={[
                styles.filterButton,
                timeRange === t ? { backgroundColor: THEME.accent } : { backgroundColor: 'transparent' }
              ]}
            >
              {translations[t as keyof typeof translations]}
            </Button>
          ))}
        </View>

        {/* Total Revenue - Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <View>
              <Text style={styles.heroLabel}>{translations.revenue}</Text>
              <Text style={styles.heroAmount}>₹{analytics.revenue.total.toLocaleString()}</Text>
            </View>
            <View style={[styles.growthTag, { backgroundColor: analytics.revenue.growth >= 0 ? THEME.success + '20' : THEME.warning + '20' }]}>
              <Text style={[styles.growthText, { color: analytics.revenue.growth >= 0 ? THEME.success : THEME.warning }]}>
                {analytics.revenue.growth > 0 ? '+' : ''}{analytics.revenue.growth}%
              </Text>
            </View>
          </View>

          {analytics.revenue.data.length > 0 && analytics.revenue.data[0] !== 0 ? (
            <View style={styles.heroChartContainer}>
              <LineChart
                data={{
                  labels: validateChartData(analytics.revenue.data, analytics.revenue.labels).labels,
                  datasets: [{
                    data: validateChartData(analytics.revenue.data, analytics.revenue.labels).data,
                    color: (opacity = 1) => THEME.accent,
                    strokeWidth: 3
                  }],
                }}
                width={Dimensions.get('window').width - 48} // Adjusted for padding
                height={180}
                chartConfig={chartConfig}
                bezier
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={false} // Cleaner look
                style={{ paddingRight: 0 }}
              />
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>{translations.noData}</Text>
            </View>
          )}
        </View>

        {/* Stats Grid - Orders */}
        <View style={styles.gridContainer}>
          <View style={[styles.gridCard, { marginRight: 8 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#F4F7FE' }]}>
              <IconButton icon="cart" iconColor={THEME.accent} size={20} style={{ margin: 0 }} />
            </View>
            <Text style={styles.gridValue}>{analytics?.orders?.total || 0}</Text>
            <Text style={styles.gridLabel}>{translations.orders}</Text>
            <Text style={[styles.gridSubtext, { color: THEME.success }]}>
              {analytics?.orders?.growth > 0 ? '+' : ''}{analytics?.orders?.growth}%
            </Text>
          </View>

          <View style={[styles.gridCard, { marginLeft: 8 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7E6' }]}>
              <IconButton icon="clock-outline" iconColor={THEME.warning} size={20} style={{ margin: 0 }} />
            </View>
            <Text style={styles.gridValue}>{analytics?.orders?.pending || 0}</Text>
            <Text style={styles.gridLabel}>{translations.pending}</Text>
            <Text style={styles.gridSubtext}>{translations.orders}</Text>
          </View>
        </View>

        {/* Customer Insights */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>{translations.customers}</Text>
          <View style={styles.rowCard}>
            <View style={styles.rowItem}>
              <Text style={styles.rowValue}>{analytics?.customers?.total || 0}</Text>
              <Text style={styles.rowLabel}>{translations.totalCustomers}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowItem}>
              <Text style={styles.rowValue}>{analytics?.customers?.new || 0}</Text>
              <Text style={styles.rowLabel}>{translations.newCustomers}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowItem}>
              <Text style={styles.rowValue}>{analytics?.customers?.repeat || 0}</Text>
              <Text style={styles.rowLabel}>{translations.repeatCustomers}</Text>
            </View>
          </View>
        </View>

        {/* Top Products */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeader}>{translations.topSelling}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{analytics?.products?.total || 0} Products</Text>
            </View>
          </View>

          <View style={styles.productsCard}>
            {analytics.products.topSelling.length > 0 ? (
              <View>
                <BarChart
                  data={{
                    labels: analytics.products.topSelling.map(p => p.name.length > 6 ? p.name.substring(0, 6) + '..' : p.name),
                    datasets: [{
                      data: analytics.products.topSelling.map(p => p.quantity || 0),
                    }],
                  }}
                  width={Dimensions.get('window').width - 64}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    ...chartConfig,
                    barPercentage: 0.5,
                    color: (opacity = 1) => THEME.primary, // Navy bars
                  }}
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  flatColor={true}
                  style={{ borderRadius: 12 }}
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={[styles.noDataText, { color: THEME.textSecondary }]}>{translations.noData}</Text>
              </View>
            )}

            {/* Low Stock Alert */}
            {analytics?.products?.lowStock > 0 && (
              <View style={[styles.alertBox, { backgroundColor: THEME.warning + '15' }]}>
                <IconButton icon="alert-circle-outline" iconColor={THEME.warning} size={20} />
                <Text style={[styles.alertText, { color: THEME.warning }]}>
                  {analytics.products.lowStock} {translations.lowStock}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== QUICK WINS SECTION ===== */}

        {/* Average Order Value & Stock Turnover */}
        <View style={styles.gridContainer}>
          <View style={[styles.gridCard, { marginRight: 8 }]}>
            <View style={[styles.iconBox, { backgroundColor: THEME.success + '20' }]}>
              <IconButton icon="cash-multiple" iconColor={THEME.success} size={20} style={{ margin: 0 }} />
            </View>
            <Text style={styles.gridValue}>₹{analytics?.revenue?.averageOrderValue?.toLocaleString() || 0}</Text>
            <Text style={styles.gridLabel}>Avg Order Value</Text>
            <Text style={[styles.gridSubtext, { color: THEME.textSecondary }]}>Per order</Text>
          </View>

          <View style={[styles.gridCard, { marginLeft: 8 }]}>
            <View style={[styles.iconBox, { backgroundColor: THEME.primary + '20' }]}>
              <IconButton icon="swap-horizontal" iconColor={THEME.primary} size={20} style={{ margin: 0 }} />
            </View>
            <Text style={styles.gridValue}>{analytics?.products?.stockTurnover || 0}x</Text>
            <Text style={styles.gridLabel}>Stock Turnover</Text>
            <Text style={[styles.gridSubtext, { color: THEME.textSecondary }]}>Sold vs Stock</Text>
          </View>
        </View>

        {/* Order Status Breakdown */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Order Status Breakdown</Text>
          <View style={styles.productsCard}>
            {(() => {
              const breakdown = analytics?.orders?.statusBreakdown;
              const total = (breakdown?.pending || 0) + (breakdown?.processing || 0) +
                (breakdown?.shipped || 0) + (breakdown?.delivered || 0) +
                (breakdown?.cancelled || 0);

              if (total === 0) {
                return (
                  <View style={styles.noDataContainer}>
                    <Text style={styles.noDataText}>No orders in this period</Text>
                  </View>
                );
              }

              const statusItems = [
                { label: 'Pending', count: breakdown?.pending || 0, color: THEME.warning },
                { label: 'Processing', count: breakdown?.processing || 0, color: THEME.accent },
                { label: 'Shipped', count: breakdown?.shipped || 0, color: THEME.primary },
                { label: 'Delivered', count: breakdown?.delivered || 0, color: THEME.success },
                { label: 'Cancelled', count: breakdown?.cancelled || 0, color: THEME.error },
              ];

              return statusItems.map((item, index) => (
                <View key={index} style={styles.statusRow}>
                  <View style={styles.statusLabelContainer}>
                    <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                    <Text style={styles.statusLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.statusBarContainer}>
                    <View
                      style={[
                        styles.statusBar,
                        {
                          width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                          backgroundColor: item.color
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.statusCount}>{item.count}</Text>
                </View>
              ));
            })()}
          </View>
        </View>

        {/* Top Customers */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Top Customers</Text>
          <View style={styles.productsCard}>
            {analytics?.customers?.topCustomers && analytics.customers.topCustomers.length > 0 ? (
              analytics.customers.topCustomers.map((customer, index) => (
                <View key={customer.id} style={[styles.customerRow, index < analytics.customers.topCustomers.length - 1 && styles.customerRowBorder]}>
                  <View style={styles.customerRank}>
                    <Text style={[styles.rankText, { color: index < 3 ? THEME.accent : THEME.textSecondary }]}>
                      #{index + 1}
                    </Text>
                  </View>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName} numberOfLines={1}>{customer.name}</Text>
                    <Text style={styles.customerOrders}>{customer.totalOrders} orders</Text>
                  </View>
                  <Text style={styles.customerSpent}>₹{customer.totalSpent.toLocaleString()}</Text>
                </View>
              ))
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No customer data available</Text>
              </View>
            )}
          </View>
        </View>

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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backButton: {
    marginLeft: -10,
  },
  refreshButton: {
    marginRight: -10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9EDF7', // Light cool grey for pill container
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  filterButton: {
    borderRadius: 8,
    minWidth: 70,
  },
  heroCard: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    // Soft Premium Shadow
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  growthTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  growthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroChartContainer: {
    marginLeft: -20, // To bleed chart slightly to left
  },
  gridContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  gridCard: {
    flex: 1,
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 16,
    // Soft Shadow
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridValue: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  gridLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  gridSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 16,
    marginLeft: 4,
  },
  rowCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Soft Shadow
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  rowItem: {
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  rowLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.divider,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: THEME.inputBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: THEME.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  productsCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  noDataContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: THEME.textSecondary,
    fontSize: 14,
  },
  // Stat Card Styles
  statCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  statIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  // Order Status Breakdown Styles
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  statusBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: THEME.inputBackground,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  statusBar: {
    height: '100%',
    borderRadius: 4,
  },
  statusCount: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textPrimary,
    minWidth: 30,
    textAlign: 'right',
  },
  // Top Customers Styles
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  customerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: THEME.inputBackground,
  },
  customerRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  customerOrders: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  customerSpent: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.success,
  },
});
