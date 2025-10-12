import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Avatar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'promotion' | 'system';
  read: boolean;
  created_at: string;
  data?: {
    orderId?: string;
    paymentId?: string;
    promotionId?: string;
  };
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

const getTimeAgo = (date: string) => {
  const now = new Date().getTime();
  const past = new Date(date).getTime();
  const diff = now - past;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

export function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const router = useRouter();

  const handlePress = () => {
    onMarkAsRead(notification.id);
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'order':
        if (notification.data?.orderId) {
          router.push(`/(main)/orders/${notification.data.orderId}`);
        }
        break;
      case 'payment':
        if (notification.data?.paymentId) {
          router.push('/(main)/payment/methods');
        }
        break;
      case 'promotion':
        if (notification.data?.promotionId) {
          router.push(`/(main)/promotions/${notification.data.promotionId}`);
        }
        break;
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'order': return 'package-variant';
      case 'payment': return 'cash';
      case 'promotion': return 'tag';
      default: return 'bell';
    }
  };

  return (
    <Pressable 
      style={[styles.container, !notification.read && styles.unread]} 
      onPress={handlePress}
    >
      <Avatar.Icon 
        size={40} 
        icon={getIcon()} 
        style={styles.icon} 
      />
      <View style={styles.content}>
        <Text variant="bodyMedium" style={styles.title}>{notification?.title || 'Notification'}</Text>
        <Text variant="bodySmall" style={styles.message}>{notification?.message || ''}</Text>
        <Text variant="labelSmall" style={styles.time}>
          {getTimeAgo(notification.created_at)}
        </Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  unread: {
    backgroundColor: '#f0f9ff',
  },
  icon: {
    backgroundColor: '#2196F3',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: '#666',
    marginBottom: 4,
  },
  time: {
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    marginLeft: 8,
    alignSelf: 'center',
  },
});