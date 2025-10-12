import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { NotificationPermissionService } from '../services/permissions/NotificationPermissionService';
import { FCMService } from '../services/firebase/messaging';
import { checkFirebaseInitialization } from '../services/firebase/firebase';

export interface FirebaseTestResult {
  success: boolean;
  results: {
    firebaseInitialized: boolean;
    notificationPermissions: {
      android: boolean;
      firebase: boolean;
      overall: boolean;
    };
    fcmToken: string | null;
    fcmServiceInitialized: boolean;
    messagingAvailable: boolean;
  };
  errors: string[];
}

export class FirebaseTestUtils {
  /**
   * Comprehensive test of Firebase integration and notification setup
   */
  static async runFirebaseIntegrationTest(): Promise<FirebaseTestResult> {
    const errors: string[] = [];
    const results: FirebaseTestResult['results'] = {
      firebaseInitialized: false,
      notificationPermissions: {
        android: false,
        firebase: false,
        overall: false,
      },
      fcmToken: null,
      fcmServiceInitialized: false,
      messagingAvailable: false,
    };

    console.log('🧪 Starting Firebase Integration Test...');

    try {
      // Test 1: Firebase App Initialization
      console.log('📱 Testing Firebase app initialization...');
      results.firebaseInitialized = checkFirebaseInitialization();
      if (!results.firebaseInitialized) {
        errors.push('Firebase app is not initialized');
      } else {
        console.log('✅ Firebase app initialized successfully');
      }

      // Test 2: Firebase Messaging Availability
      console.log('💬 Testing Firebase Messaging availability...');
      try {
        const messagingInstance = messaging();
        results.messagingAvailable = !!messagingInstance;
        console.log('✅ Firebase Messaging is available');
      } catch (error) {
        results.messagingAvailable = false;
        errors.push(`Firebase Messaging not available: ${error}`);
      }

      // Test 3: Notification Permissions
      console.log('🔔 Testing notification permissions...');
      try {
        const permissionResult = await NotificationPermissionService.checkNotificationPermissions();
        results.notificationPermissions = {
          android: permissionResult.androidPermission,
          firebase: permissionResult.fcmPermission,
          overall: permissionResult.granted,
        };
        
        if (permissionResult.granted) {
          console.log('✅ All notification permissions granted');
        } else {
          console.log('⚠️ Some notification permissions missing:');
          if (!permissionResult.androidPermission) {
            console.log('  - Android POST_NOTIFICATIONS permission missing');
          }
          if (!permissionResult.fcmPermission) {
            console.log('  - Firebase messaging permission missing');
          }
        }
      } catch (error) {
        errors.push(`Permission check failed: ${error}`);
      }

      // Test 4: FCM Token Generation
      console.log('🎫 Testing FCM token generation...');
      if (results.messagingAvailable && results.notificationPermissions.overall) {
        try {
          const token = await messaging().getToken();
          results.fcmToken = token;
          if (token) {
            console.log(`✅ FCM token generated: ${token.substring(0, 20)}...`);
          } else {
            errors.push('FCM token generation failed - no token returned');
          }
        } catch (error) {
          errors.push(`FCM token generation failed: ${error}`);
        }
      } else {
        console.log('⏭️ Skipping FCM token test (prerequisites not met)');
      }

      // Test 5: FCM Service Initialization
      console.log('🚀 Testing FCM service initialization...');
      try {
        const fcmService = FCMService.getInstance();
        if (fcmService.isAvailable()) {
          const initResult = await fcmService.initialize();
          results.fcmServiceInitialized = initResult;
          if (initResult) {
            console.log('✅ FCM service initialized successfully');
          } else {
            errors.push('FCM service initialization returned false');
          }
        } else {
          errors.push('FCM service is not available');
        }
      } catch (error) {
        errors.push(`FCM service initialization failed: ${error}`);
      }

      // Test 6: Platform-specific checks
      console.log('📋 Running platform-specific checks...');
      if (Platform.OS === 'android') {
        console.log('🤖 Android-specific checks:');
        console.log(`  - API Level: ${Platform.Version}`);
        console.log(`  - POST_NOTIFICATIONS required: ${Platform.Version >= 33 ? 'Yes' : 'No'}`);
      } else {
        console.log('🍎 iOS-specific checks:');
        console.log(`  - iOS Version: ${Platform.Version}`);
      }

    } catch (error) {
      errors.push(`Test execution failed: ${error}`);
    }

    const success = errors.length === 0 && 
                   results.firebaseInitialized && 
                   results.messagingAvailable && 
                   results.notificationPermissions.overall && 
                   results.fcmToken !== null && 
                   results.fcmServiceInitialized;

    console.log('\n📊 Test Results Summary:');
    console.log(`Overall Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Firebase Initialized: ${results.firebaseInitialized ? '✅' : '❌'}`);
    console.log(`Messaging Available: ${results.messagingAvailable ? '✅' : '❌'}`);
    console.log(`Permissions Granted: ${results.notificationPermissions.overall ? '✅' : '❌'}`);
    console.log(`FCM Token Generated: ${results.fcmToken ? '✅' : '❌'}`);
    console.log(`FCM Service Ready: ${results.fcmServiceInitialized ? '✅' : '❌'}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    return {
      success,
      results,
      errors,
    };
  }

  /**
   * Quick health check for Firebase services
   */
  static async quickHealthCheck(): Promise<boolean> {
    try {
      const firebaseReady = checkFirebaseInitialization();
      const messagingReady = !!messaging();
      const permissionsReady = (await NotificationPermissionService.checkNotificationPermissions()).granted;
      
      return firebaseReady && messagingReady && permissionsReady;
    } catch (error) {
      console.error('Firebase health check failed:', error);
      return false;
    }
  }

  /**
   * Test notification sending (for development/testing)
   */
  static async testNotificationSending(): Promise<boolean> {
    try {
      console.log('🧪 Testing notification sending...');
      
      const fcmService = FCMService.getInstance();
      if (!fcmService.isAvailable()) {
        console.error('FCM service not available for testing');
        return false;
      }

      // This would typically send a test notification
      // In a real implementation, you'd call your backend API
      console.log('📤 Test notification would be sent here');
      console.log('💡 Use Firebase Console to send test notifications');
      
      return true;
    } catch (error) {
      console.error('Notification sending test failed:', error);
      return false;
    }
  }

  /**
   * Generate diagnostic report
   */
  static async generateDiagnosticReport(): Promise<string> {
    const testResult = await this.runFirebaseIntegrationTest();
    
    let report = '🔍 Firebase Integration Diagnostic Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    report += `📱 Platform: ${Platform.OS} ${Platform.Version}\n`;
    report += `🕐 Timestamp: ${new Date().toISOString()}\n\n`;
    
    report += '📊 Test Results:\n';
    report += `  Firebase App: ${testResult.results.firebaseInitialized ? '✅ Ready' : '❌ Not Ready'}\n`;
    report += `  Messaging Service: ${testResult.results.messagingAvailable ? '✅ Available' : '❌ Unavailable'}\n`;
    report += `  Android Permissions: ${testResult.results.notificationPermissions.android ? '✅ Granted' : '❌ Denied'}\n`;
    report += `  Firebase Permissions: ${testResult.results.notificationPermissions.firebase ? '✅ Granted' : '❌ Denied'}\n`;
    report += `  FCM Token: ${testResult.results.fcmToken ? '✅ Generated' : '❌ Missing'}\n`;
    report += `  FCM Service: ${testResult.results.fcmServiceInitialized ? '✅ Initialized' : '❌ Failed'}\n\n`;
    
    if (testResult.errors.length > 0) {
      report += '❌ Issues Found:\n';
      testResult.errors.forEach((error, index) => {
        report += `  ${index + 1}. ${error}\n`;
      });
      report += '\n';
    }
    
    report += '💡 Recommendations:\n';
    if (!testResult.results.firebaseInitialized) {
      report += '  - Check google-services.json configuration\n';
      report += '  - Verify Firebase project setup\n';
    }
    if (!testResult.results.notificationPermissions.overall) {
      report += '  - Request notification permissions\n';
      report += '  - Check device notification settings\n';
    }
    if (!testResult.results.fcmToken) {
      report += '  - Ensure network connectivity\n';
      report += '  - Check Firebase project configuration\n';
    }
    
    return report;
  }
}