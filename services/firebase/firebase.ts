// Using React Native Firebase
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import firebase from '@react-native-firebase/app';
import { Platform } from 'react-native';

// React Native Firebase initialization
// Firebase is automatically initialized from google-services.json

let isFirebaseInitialized = false;
let firebaseInitializationPromise: Promise<void> | null = null;

// Debug Firebase state
const debugFirebaseState = () => {
  console.log('🔍 Firebase Debug Info:');
  console.log(`  - Apps count: ${firebase.apps.length}`);
  console.log(`  - Platform: ${Platform.OS}`);
  console.log(`  - isFirebaseInitialized: ${isFirebaseInitialized}`);
  
  if (firebase.apps.length > 0) {
    firebase.apps.forEach((app, index) => {
      console.log(`  - App ${index}: ${app?.name || 'unnamed'}`);
      console.log(`    - Project ID: ${app?.options?.projectId || 'unknown'}`);
      console.log(`    - App ID: ${app?.options?.appId || 'unknown'}`);
    });
  } else {
    console.log('  - No Firebase apps found');
  }
};

// Function to check if Firebase is ready
export const checkFirebaseInitialization = () => {
  return firebase.apps.length > 0 && isFirebaseInitialized;
};

// Function to wait for Firebase initialization
export const waitForFirebaseInitialization = async (): Promise<void> => {
  if (firebaseInitializationPromise) {
    return firebaseInitializationPromise;
  }
  
  if (isFirebaseInitialized) {
    return Promise.resolve();
  }
  
  // Create initialization promise
  firebaseInitializationPromise = new Promise<void>((resolve, reject) => {
    try {
      console.log('🚀 Firebase: Starting initialization process...');
      debugFirebaseState();
      
      // React Native Firebase automatically initializes from google-services.json
      // We just need to check if it's available
      if (firebase.apps.length > 0) {
        const app = firebase.apps[0];
        isFirebaseInitialized = true;
        console.log('✅ Firebase: App already initialized from google-services.json');
        console.log(`✅ Firebase: App name: ${app?.name || '[DEFAULT]'}`);
        console.log(`✅ Firebase: Project ID: ${app?.options?.projectId}`);
        resolve();
      } else {
        // Wait a moment for auto-initialization with multiple attempts
        let attempts = 0;
        const maxAttempts = 10; // Increased attempts
        const checkInterval = 300; // Reduced interval for faster checking
        
        const checkFirebaseReady = () => {
          attempts++;
          console.log(`🔄 Firebase: Initialization attempt ${attempts}/${maxAttempts}`);
          debugFirebaseState();
          
          if (firebase.apps.length > 0) {
            const app = firebase.apps[0];
            isFirebaseInitialized = true;
            console.log('✅ Firebase: App initialized from google-services.json');
            console.log(`✅ Firebase: App name: ${app?.name || '[DEFAULT]'}`);
            console.log(`✅ Firebase: Project ID: ${app?.options?.projectId}`);
            resolve();
          } else if (attempts >= maxAttempts) {
            console.warn('⚠️ Firebase: Auto-initialization failed, attempting explicit initialization...');
            
            // Try multiple explicit initialization approaches
            try {
              // Method 1: Try to access the default app
              let defaultApp = null;
              try {
                defaultApp = firebase.app();
                console.log('🔍 Firebase: Default app found via firebase.app()');
              } catch (appError) {
                console.log('🔍 Firebase: No default app found via firebase.app()');
              }
              
              // Method 2: Check Firebase apps array directly
              if (!defaultApp) {
                try {
                  console.log('🔍 Firebase: Checking firebase.apps array directly');
                  console.log(`🔍 Firebase: firebase.apps.length = ${firebase.apps.length}`);
                  
                  if (firebase.apps.length > 0) {
                    defaultApp = firebase.apps[0];
                    console.log('🔍 Firebase: Found app in firebase.apps array');
                  } else {
                    console.log('🔍 Firebase: No apps found in firebase.apps array');
                  }
                } catch (appsError) {
                  console.warn('🔍 Firebase: Error accessing firebase.apps:', appsError instanceof Error ? appsError.message : 'Unknown error');
                }
              }
              
              // Method 3: Check if Firebase is available but not initialized
              if (!defaultApp) {
                try {
                  // Try to access Firebase services directly to trigger initialization
                  const authService = auth();
                  const messagingService = messaging();
                  console.log('🔍 Firebase: Services accessible, checking apps again...');
                  
                  // Check again after accessing services
                  if (firebase.apps.length > 0) {
                    defaultApp = firebase.apps[0];
                    console.log('🔍 Firebase: App found after accessing services');
                  }
                } catch (serviceError) {
                  console.warn('🔍 Firebase: Service access failed:', serviceError instanceof Error ? serviceError.message : 'Unknown error');
                }
              }
              
              if (defaultApp) {
                isFirebaseInitialized = true;
                console.log('✅ Firebase: Explicit initialization successful');
                console.log(`✅ Firebase: App name: ${defaultApp?.name || '[DEFAULT]'}`);
                console.log(`✅ Firebase: Project ID: ${defaultApp?.options?.projectId}`);
                resolve();
                return;
              }
            } catch (explicitError) {
              console.warn('⚠️ Firebase: Explicit initialization also failed:', explicitError instanceof Error ? explicitError.message : 'Unknown error');
            }
            
            console.warn('⚠️ Firebase: No apps found after waiting, but continuing without Firebase');
            console.warn('⚠️ Firebase: This may affect notification functionality');
            console.warn('⚠️ Firebase: Please ensure google-services.json is properly configured');
            debugFirebaseState();
            // Don't reject, just resolve with warning to allow app to continue
            isFirebaseInitialized = false;
            resolve();
          } else {
            setTimeout(checkFirebaseReady, checkInterval);
          }
        };
        
        setTimeout(checkFirebaseReady, checkInterval);
      }
    } catch (error) {
      console.warn('⚠️ Firebase: Initialization check failed, continuing without Firebase:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('⚠️ Firebase: This may affect notification functionality');
      debugFirebaseState();
      isFirebaseInitialized = false;
      // Don't reject, just resolve with warning to allow app to continue
      resolve();
    }
  });
  
  return firebaseInitializationPromise;
};

// Debug initial Firebase state when module loads
console.log('📦 Firebase module loaded');
debugFirebaseState();

// Initialize Firebase immediately with error handling
waitForFirebaseInitialization().catch(error => {
  console.warn('⚠️ Firebase: Failed to initialize during import, app will continue without Firebase:', error instanceof Error ? error.message : 'Unknown error');
});

// Export initialization status
export { isFirebaseInitialized };

// Firebase Auth is disabled - using Supabase authentication only
// Keeping Firebase modules for messaging/notifications only
console.log('Firebase: Auth disabled - Using Supabase authentication only');
console.log('Firebase: Only messaging services are active');

// Note: Firebase Auth configuration removed as per requirements
// The app now uses Supabase Auth exclusively for authentication

// Export the modules
export { auth, messaging, firebase };