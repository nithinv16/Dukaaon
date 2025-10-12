import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPermissionService } from '../services/permissions/NotificationPermissionService';

export interface SettingsState {
  // Notifications
  notificationsEnabled: boolean;
  orderUpdatesEnabled: boolean;
  promotionsEnabled: boolean;
  
  // Appearance
  darkMode: boolean;
  fontFamily: 'default' | 'roboto' | 'open-sans' | 'lato';
  fontSize: 'small' | 'medium' | 'large';
  
  // App settings
  language: 'en' | 'hi' | 'ml' | 'ta' | 'te' | 'kn' | 'mr' | 'bn';
  
  // Actions
  setNotifications: (enabled: boolean) => Promise<void>;
  setOrderUpdates: (enabled: boolean) => void;
  setPromotions: (enabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setFontFamily: (font: 'default' | 'roboto' | 'open-sans' | 'lato') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setLanguage: (lang: 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'mr' | 'bn') => void;
  checkNotificationPermissions: () => Promise<void>;
  clearCache: () => Promise<void>;
  backupData: () => Promise<boolean>;
  restoreDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default values
      notificationsEnabled: true,
      orderUpdatesEnabled: true,
      promotionsEnabled: true,
      darkMode: false,
      fontFamily: 'default',
      fontSize: 'medium',
      language: 'en',
      
      // Actions
      setNotifications: async (enabled) => {
        if (enabled) {
          // If user wants to enable notifications, request permissions
          try {
            const result = await NotificationPermissionService.requestPermissionsWithRationale();
            const actuallyEnabled = result.granted;
            
            set({ 
              notificationsEnabled: actuallyEnabled,
              // Disable dependent settings if permissions not granted
              orderUpdatesEnabled: actuallyEnabled ? get().orderUpdatesEnabled : false,
              promotionsEnabled: actuallyEnabled ? get().promotionsEnabled : false,
            });
          } catch (error) {
            console.error('Error requesting notification permissions:', error);
            set({ notificationsEnabled: false });
          }
        } else {
          // User wants to disable notifications
          set({ 
            notificationsEnabled: false,
            orderUpdatesEnabled: false,
            promotionsEnabled: false,
          });
        }
      },
      
      setOrderUpdates: (enabled) => set({ orderUpdatesEnabled: enabled }),
      setPromotions: (enabled) => set({ promotionsEnabled: enabled }),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      setFontFamily: (font) => set({ fontFamily: font }),
      setFontSize: (size) => set({ fontSize: size }),
      setLanguage: (lang) => set({ language: lang }),
      
      clearCache: async () => {
        // In a real app, you would clear cached images, data, etc.
        // For this demo, we'll just return a successful result
        return Promise.resolve();
      },
      
      backupData: async () => {
        // In a real app, this would backup user data to the cloud
        // For this demo, we'll just return a successful result
        return Promise.resolve(true);
      },
      
      checkNotificationPermissions: async () => {
        try {
          const result = await NotificationPermissionService.checkNotificationPermissions();
          const currentState = get();
          
          // Update the state to reflect actual permission status
          if (currentState.notificationsEnabled !== result.granted) {
            set({ 
              notificationsEnabled: result.granted,
              // Disable dependent settings if permissions not granted
              orderUpdatesEnabled: result.granted ? currentState.orderUpdatesEnabled : false,
              promotionsEnabled: result.granted ? currentState.promotionsEnabled : false,
            });
          }
        } catch (error) {
          console.error('Error checking notification permissions:', error);
        }
      },
      
      restoreDefaults: () => set({
        notificationsEnabled: true,
        orderUpdatesEnabled: true,
        promotionsEnabled: true,
        darkMode: false,
        fontFamily: 'default',
        fontSize: 'medium',
        language: 'en'
      })
    }),
    {
      name: 'dukaaon-settings',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);