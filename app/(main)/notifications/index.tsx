import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, IconButton, ActivityIndicator } from 'react-native-paper';
import { Stack } from 'expo-router';
import { NotificationItem } from '../../../components/notifications/NotificationItem';
import { useNotificationsStore } from '../../../store/notifications';
import { useTranslation } from '../../../contexts/LanguageContext';

export default function Notifications() {
  const { notifications, loading, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const { t } = useTranslation();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const renderHeader = () => {
    if (unreadCount === 0) return null;

    return (
      <View style={styles.header}>
        <Text variant="bodyMedium">{unreadCount} {t('notifications.unread_notifications')}</Text>
        <IconButton 
          icon="check-all" 
          onPress={markAllAsRead}
          size={20}
        />
      </View>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="titleMedium">{t('notifications.no_notifications')}</Text>
        <Text variant="bodySmall" style={styles.emptyText}>
          {t('notifications.empty_message')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: t('notifications.title'),
          headerRight: () => unreadCount > 0 ? (
            <IconButton 
              icon="check-all" 
              onPress={markAllAsRead}
              size={24}
            />
          ) : null
        }}
      />
      <FlatList
        data={notifications}
        renderItem={({ item }) => (
          <NotificationItem 
            notification={item}
            onMarkAsRead={markAsRead}
          />
        )}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchNotifications}
          />
        }
        ListHeaderComponent={renderHeader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
  },
});