import React, { createContext, useContext, useState, useCallback } from 'react';
import { NotificationBanner } from '../components/notifications/NotificationBanner';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onPress?: () => void;
}

interface NotificationContextType {
  showNotification: (notification: Omit<NotificationData, 'id'>) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationData | null>(null);

  const showNotification = useCallback((notificationData: Omit<NotificationData, 'id'>) => {
    const id = Date.now().toString();
    setNotification({
      ...notificationData,
      id,
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      {notification && (
        <NotificationBanner
          visible={!!notification}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onPress={notification.onPress}
          onDismiss={hideNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};