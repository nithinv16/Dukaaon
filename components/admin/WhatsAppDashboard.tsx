import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { NotificationService } from '../../services/notifications/NotificationService';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_NATIVE_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_NATIVE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

interface MessageStats {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  delivery_rate: number;
  read_rate: number;
}

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

interface ServiceHealth {
  fcm_status: 'healthy' | 'degraded' | 'down';
  whatsapp_status: 'healthy' | 'degraded' | 'down';
  last_checked: string;
}

interface MessageTypeStats {
  order_notifications: number;
  delivery_updates: number;
  stock_alerts: number;
  payment_reminders: number;
  welcome_messages: number;
}

const { width: screenWidth } = Dimensions.get('window');

export const WhatsAppDashboard: React.FC = () => {
  const [messageStats, setMessageStats] = useState<MessageStats>({
    total_sent: 0,
    total_delivered: 0,
    total_read: 0,
    total_failed: 0,
    delivery_rate: 0,
    read_rate: 0,
  });
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth>({
    fcm_status: 'healthy',
    whatsapp_status: 'healthy',
    last_checked: new Date().toISOString(),
  });
  const [messageTypeStats, setMessageTypeStats] = useState<MessageTypeStats>({
    order_notifications: 0,
    delivery_updates: 0,
    stock_alerts: 0,
    payment_reminders: 0,
    welcome_messages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMessageStats(),
        loadDailyStats(),
        loadServiceHealth(),
        loadMessageTypeStats(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadMessageStats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('status')
        .gte('created_at', getDateRange());

      if (error) throw error;

      const stats = data.reduce(
        (acc, message) => {
          acc.total_sent++;
          if (message.status === 'delivered') acc.total_delivered++;
          if (message.status === 'read') acc.total_read++;
          if (message.status === 'failed') acc.total_failed++;
          return acc;
        },
        { total_sent: 0, total_delivered: 0, total_read: 0, total_failed: 0 }
      );

      const delivery_rate = stats.total_sent > 0 ? (stats.total_delivered / stats.total_sent) * 100 : 0;
      const read_rate = stats.total_delivered > 0 ? (stats.total_read / stats.total_delivered) * 100 : 0;

      setMessageStats({
        ...stats,
        delivery_rate: Math.round(delivery_rate * 100) / 100,
        read_rate: Math.round(read_rate * 100) / 100,
      });
    } catch (error) {
      console.error('Error loading message stats:', error);
    }
  };

  const loadDailyStats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('created_at, status')
        .gte('created_at', getDateRange())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dailyData: { [key: string]: { sent: number; delivered: number; failed: number } } = {};

      data.forEach((message) => {
        const date = new Date(message.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { sent: 0, delivered: 0, failed: 0 };
        }
        dailyData[date].sent++;
        if (message.status === 'delivered') dailyData[date].delivered++;
        if (message.status === 'failed') dailyData[date].failed++;
      });

      const statsArray = Object.entries(dailyData).map(([date, stats]) => ({
        date,
        ...stats,
      }));

      setDailyStats(statsArray);
    } catch (error) {
      console.error('Error loading daily stats:', error);
    }
  };

  const loadServiceHealth = async () => {
    try {
      const health = await NotificationService.getServiceHealthStatus();
      setServiceHealth({
        fcm_status: health.fcm_healthy ? 'healthy' : 'down',
        whatsapp_status: health.whatsapp_healthy ? 'healthy' : 'down',
        last_checked: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error loading service health:', error);
      setServiceHealth({
        fcm_status: 'down',
        whatsapp_status: 'down',
        last_checked: new Date().toISOString(),
      });
    }
  };

  const loadMessageTypeStats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('message_type')
        .gte('created_at', getDateRange());

      if (error) throw error;

      const typeStats = data.reduce(
        (acc, message) => {
          const type = message.message_type || 'other';
          if (type in acc) {
            acc[type as keyof MessageTypeStats]++;
          }
          return acc;
        },
        {
          order_notifications: 0,
          delivery_updates: 0,
          stock_alerts: 0,
          payment_reminders: 0,
          welcome_messages: 0,
        }
      );

      setMessageTypeStats(typeStats);
    } catch (error) {
      console.error('Error loading message type stats:', error);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return startDate.toISOString();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#25D366';
      case 'degraded':
        return '#FF9500';
      case 'down':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'checkmark-circle';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#007AFF',
    },
  };

  const pieData = [
    {
      name: 'Order Notifications',
      population: messageTypeStats.order_notifications,
      color: '#007AFF',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Delivery Updates',
      population: messageTypeStats.delivery_updates,
      color: '#25D366',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Stock Alerts',
      population: messageTypeStats.stock_alerts,
      color: '#FF9500',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Payment Reminders',
      population: messageTypeStats.payment_reminders,
      color: '#FF3B30',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
    {
      name: 'Welcome Messages',
      population: messageTypeStats.welcome_messages,
      color: '#5856D6',
      legendFontColor: '#333',
      legendFontSize: 12,
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>WhatsApp Dashboard</Text>
        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Service Health */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Health</Text>
        <View style={styles.healthContainer}>
          <View style={styles.healthItem}>
            <View style={styles.healthHeader}>
              <Ionicons name="notifications" size={20} color="#007AFF" />
              <Text style={styles.healthLabel}>FCM Service</Text>
            </View>
            <View style={styles.healthStatus}>
              <Ionicons
                name={getStatusIcon(serviceHealth.fcm_status)}
                size={16}
                color={getStatusColor(serviceHealth.fcm_status)}
              />
              <Text style={[styles.healthStatusText, { color: getStatusColor(serviceHealth.fcm_status) }]}>
                {serviceHealth.fcm_status.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.healthItem}>
            <View style={styles.healthHeader}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              <Text style={styles.healthLabel}>WhatsApp Service</Text>
            </View>
            <View style={styles.healthStatus}>
              <Ionicons
                name={getStatusIcon(serviceHealth.whatsapp_status)}
                size={16}
                color={getStatusColor(serviceHealth.whatsapp_status)}
              />
              <Text style={[styles.healthStatusText, { color: getStatusColor(serviceHealth.whatsapp_status) }]}>
                {serviceHealth.whatsapp_status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.lastChecked}>
          Last checked: {new Date(serviceHealth.last_checked).toLocaleString()}
        </Text>
      </View>

      {/* Message Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{messageStats.total_sent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Sent</Text>
            <Ionicons name="send" size={24} color="#007AFF" />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{messageStats.total_delivered.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
            <Ionicons name="checkmark-done" size={24} color="#25D366" />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{messageStats.total_read.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Read</Text>
            <Ionicons name="eye" size={24} color="#5856D6" />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{messageStats.total_failed.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Failed</Text>
            <Ionicons name="close-circle" size={24} color="#FF3B30" />
          </View>
        </View>
        <View style={styles.ratesContainer}>
          <View style={styles.rateItem}>
            <Text style={styles.rateValue}>{messageStats.delivery_rate}%</Text>
            <Text style={styles.rateLabel}>Delivery Rate</Text>
          </View>
          <View style={styles.rateItem}>
            <Text style={styles.rateValue}>{messageStats.read_rate}%</Text>
            <Text style={styles.rateLabel}>Read Rate</Text>
          </View>
        </View>
      </View>

      {/* Daily Trends */}
      {dailyStats.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Message Trends</Text>
          <LineChart
            data={{
              labels: dailyStats.slice(-7).map((stat) => {
                const date = new Date(stat.date);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }),
              datasets: [
                {
                  data: dailyStats.slice(-7).map((stat) => stat.sent),
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Message Types Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Message Types Distribution</Text>
        <PieChart
          data={pieData}
          width={screenWidth - 48}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          center={[10, 10]}
          absolute
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={loadServiceHealth}>
            <Ionicons name="refresh" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Refresh Health</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Export', 'Export functionality would be implemented here')}
          >
            <Ionicons name="download" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Export Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  healthContainer: {
    gap: 12,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lastChecked: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  ratesContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  rateItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  rateValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  rateLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
});

export default WhatsAppDashboard;