import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, IconButton } from 'react-native-paper';
import { useAuthStore } from '../../../../store/auth';
import { supabase } from '../../../../services/supabase/supabase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  data?: any;
}

export default function WholesalerNotifications() {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return 'shopping';
      case 'payment':
        return 'credit-card';
      case 'delivery':
        return 'truck';
      case 'system':
        return 'bell';
      default:
        return 'information';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text variant="headlineMedium">Notifications</Text>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium">No notifications yet</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            You'll receive notifications about orders, payments, and other important updates here.
          </Text>
        </View>
      ) : (
        <View style={styles.notificationsList}>
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard
              ]}
              onPress={() => markAsRead(notification.id)}
            >
              <Card.Content>
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationInfo}>
                    <IconButton
                      icon={getNotificationIcon(notification.type)}
                      size={20}
                      style={styles.notificationIcon}
                    />
                    <View style={styles.notificationContent}>
                      <Text variant="titleSmall" style={styles.notificationTitle}>
                        {notification.title}
                      </Text>
                      <Text variant="bodyMedium" style={styles.notificationMessage}>
                        {notification.message}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.notificationMeta}>
                    <Text variant="bodySmall" style={styles.notificationTime}>
                      {formatDate(notification.created_at)}
                    </Text>
                    {!notification.read && (
                      <Chip size="small" style={styles.unreadChip}>
                        New
                      </Chip>
                    )}
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  notificationIcon: {
    margin: 0,
    marginRight: 8,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationMessage: {
    color: '#666',
  },
  notificationMeta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  notificationTime: {
    color: '#999',
    marginBottom: 4,
  },
  unreadChip: {
    backgroundColor: '#2196F3',
  },
});