import { Platform, PermissionsAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { checkFirebaseInitialization } from '../firebase/firebase';

export interface NotificationPermissionResult {
  granted: boolean;
  fcmPermission: boolean;
  androidPermission: boolean;
  error?: string;
}

export class NotificationPermissionService {
  /**
   * Request all necessary notification permissions for Android 13+ and Firebase
   */
  static async requestNotificationPermissions(): Promise<NotificationPermissionResult> {
    try {
      let androidPermission = true;
      let fcmPermission = false;

      // For Android 13+ (API level 33+), request POST_NOTIFICATIONS permission
      if (Platform.OS === 'android') {
        androidPermission = await this.requestAndroidNotificationPermission();
        
        if (!androidPermission) {
          return {
            granted: false,
            fcmPermission: false,
            androidPermission: false,
            error: 'Android notification permission denied'
          };
        }
      }

      // Request Firebase messaging permission
      fcmPermission = await this.requestFirebaseMessagingPermission();

      const granted = androidPermission && fcmPermission;

      return {
        granted,
        fcmPermission,
        androidPermission,
      };
    } catch (error) {
      console.error('NotificationPermissionService: Error requesting permissions:', error);
      return {
        granted: false,
        fcmPermission: false,
        androidPermission: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Request Android POST_NOTIFICATIONS permission for Android 13+
   */
  private static async requestAndroidNotificationPermission(): Promise<boolean> {
    try {
      // Check if we're on Android 13+ (API level 33+)
      if (Platform.OS !== 'android') {
        return true; // iOS doesn't need this permission
      }

      // Check if permission is already granted
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (hasPermission) {
        console.log('NotificationPermissionService: POST_NOTIFICATIONS already granted');
        return true;
      }

      // Request the permission
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'This app needs notification permission to send you order updates and important alerts.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      
      if (isGranted) {
        console.log('NotificationPermissionService: POST_NOTIFICATIONS granted');
      } else {
        console.log('NotificationPermissionService: POST_NOTIFICATIONS denied');
      }

      return isGranted;
    } catch (error) {
      console.error('NotificationPermissionService: Error requesting Android notification permission:', error);
      return false;
    }
  }

  /**
   * Request Firebase messaging permission
   */
  private static async requestFirebaseMessagingPermission(): Promise<boolean> {
    try {
      // Check if Firebase is initialized before requesting permissions
      if (!checkFirebaseInitialization()) {
        console.error('NotificationPermissionService: Cannot request Firebase permission - Firebase not initialized');
        return false;
      }

      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('NotificationPermissionService: Firebase messaging permission granted');
      } else {
        console.log('NotificationPermissionService: Firebase messaging permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('NotificationPermissionService: Error requesting Firebase permission:', error);
      return false;
    }
  }

  /**
   * Check Firebase messaging permissions
   */
  static async checkFirebaseMessagingPermissions(): Promise<boolean> {
    try {
      if (!checkFirebaseInitialization()) {
        console.warn('NotificationPermissionService: Cannot check Firebase permission - Firebase not initialized');
        return false;
      }
      const authStatus = await messaging().hasPermission();
      return authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
             authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    } catch (error) {
      console.warn('NotificationPermissionService: Cannot check Firebase permission - Firebase not initialized');
      return false;
    }
  }

  /**
   * Check current notification permission status
   */
  static async checkNotificationPermissions(): Promise<NotificationPermissionResult> {
    try {
      let androidPermission = true;
      let fcmPermission = false;

      // Check Android permission
      if (Platform.OS === 'android') {
        androidPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      // Check Firebase permission only if Firebase is initialized
      if (checkFirebaseInitialization()) {
        const authStatus = await messaging().hasPermission();
        fcmPermission =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      } else {
        console.warn('NotificationPermissionService: Cannot check Firebase permission - Firebase not initialized');
        fcmPermission = false;
      }

      const granted = androidPermission && fcmPermission;

      return {
        granted,
        fcmPermission,
        androidPermission,
      };
    } catch (error) {
      console.error('NotificationPermissionService: Error checking permissions:', error);
      return {
        granted: false,
        fcmPermission: false,
        androidPermission: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Show permission rationale dialog
   */
  static showPermissionRationale(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Notification Permission Required',
        'To receive important order updates, delivery notifications, and alerts, please enable notifications for this app.\n\nYou can also enable them later in your device settings.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable Notifications',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show settings dialog when permissions are permanently denied
   */
  static showSettingsDialog(): void {
    Alert.alert(
      'Notifications Disabled',
      'Notifications are currently disabled. To receive order updates and important alerts, please enable notifications in your device settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            // You can use a library like react-native-settings to open settings
            console.log('NotificationPermissionService: User should open settings manually');
          },
        },
      ]
    );
  }

  /**
   * Request permissions with user-friendly flow
   */
  static async requestPermissionsWithRationale(): Promise<NotificationPermissionResult> {
    // First check if permissions are already granted
    const currentStatus = await this.checkNotificationPermissions();
    if (currentStatus.granted) {
      return currentStatus;
    }

    // Show rationale if needed
    const shouldRequest = await this.showPermissionRationale();
    if (!shouldRequest) {
      return {
        granted: false,
        fcmPermission: false,
        androidPermission: false,
        error: 'User declined permission request'
      };
    }

    // Request permissions
    const result = await this.requestNotificationPermissions();
    
    // If still not granted, show settings dialog
    if (!result.granted) {
      this.showSettingsDialog();
    }

    return result;
  }
}