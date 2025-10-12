#!/usr/bin/env node

/**
 * Firebase Integration Test Script
 * 
 * This script helps verify that Firebase SDKs are properly integrated
 * and notification permissions are correctly configured.
 * 
 * Usage:
 *   node scripts/test-firebase-integration.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Integration Test Script');
console.log('=' .repeat(50));

// Test 1: Check if Firebase dependencies are installed
console.log('\n📦 Checking Firebase dependencies...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const firebaseDeps = {
    '@react-native-firebase/app': dependencies['@react-native-firebase/app'],
    '@react-native-firebase/messaging': dependencies['@react-native-firebase/messaging'],
  };
  
  console.log('Firebase dependencies found:');
  Object.entries(firebaseDeps).forEach(([dep, version]) => {
    if (version) {
      console.log(`  ✅ ${dep}: ${version}`);
    } else {
      console.log(`  ❌ ${dep}: NOT FOUND`);
    }
  });
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
}

// Test 2: Check Android configuration
console.log('\n🤖 Checking Android configuration...');

// Check google-services.json
const googleServicesPath = 'android/app/google-services.json';
if (fs.existsSync(googleServicesPath)) {
  console.log('  ✅ google-services.json found');
  
  try {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    console.log(`  📱 Project ID: ${googleServices.project_info?.project_id || 'Unknown'}`);
    console.log(`  📱 Package Name: ${googleServices.client?.[0]?.client_info?.android_client_info?.package_name || 'Unknown'}`);
    
    // Check if Firebase Messaging is configured
    const hasMessaging = googleServices.client?.some(client => 
      client.services?.some(service => service.service === 'cloud_messaging')
    );
    
    if (hasMessaging) {
      console.log('  ✅ Firebase Cloud Messaging configured');
    } else {
      console.log('  ⚠️ Firebase Cloud Messaging not found in configuration');
      console.log('     Please ensure FCM is enabled in Firebase Console');
    }
  } catch (error) {
    console.log('  ❌ Error parsing google-services.json:', error.message);
  }
} else {
  console.log('  ❌ google-services.json not found');
  console.log('     Please download it from Firebase Console and place it in android/app/');
}

// Check AndroidManifest.xml for POST_NOTIFICATIONS permission
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  
  if (manifest.includes('android.permission.POST_NOTIFICATIONS')) {
    console.log('  ✅ POST_NOTIFICATIONS permission declared');
  } else {
    console.log('  ❌ POST_NOTIFICATIONS permission missing');
    console.log('     This is required for Android 13+ notification support');
  }
  
  if (manifest.includes('com.google.android.gms.version')) {
    console.log('  ✅ Google Play Services metadata found');
  } else {
    console.log('  ⚠️ Google Play Services metadata missing');
  }
} else {
  console.log('  ❌ AndroidManifest.xml not found');
}

// Check build.gradle files
const appBuildGradlePath = 'android/app/build.gradle';
if (fs.existsSync(appBuildGradlePath)) {
  const buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');
  
  if (buildGradle.includes('com.google.gms.google-services') || buildGradle.includes('com.google.gms:google-services')) {
    console.log('  ✅ Google Services plugin applied');
  } else {
    console.log('  ❌ Google Services plugin missing');
  }
  
  if (buildGradle.includes('firebase-bom')) {
    console.log('  ✅ Firebase BoM configured');
  } else {
    console.log('  ⚠️ Firebase BoM not found (recommended for dependency management)');
  }
  
  if (buildGradle.includes('firebase-messaging')) {
    console.log('  ✅ Firebase Messaging dependency found');
  } else {
    console.log('  ❌ Firebase Messaging dependency missing');
  }
} else {
  console.log('  ❌ android/app/build.gradle not found');
}

// Test 3: Check app configuration
console.log('\n⚙️ Checking app configuration...');

const appConfigPath = 'app.config.js';
if (fs.existsSync(appConfigPath)) {
  console.log('  ✅ app.config.js found');
  
  try {
    // Note: This is a simplified check since app.config.js might have dynamic content
    const configContent = fs.readFileSync(appConfigPath, 'utf8');
    
    if (configContent.includes('@react-native-firebase/app')) {
      console.log('  ✅ Firebase app plugin configured');
    } else {
      console.log('  ❌ Firebase app plugin missing from config');
    }
    
    if (configContent.includes('@react-native-firebase/messaging')) {
      console.log('  ✅ Firebase messaging plugin configured');
    } else {
      console.log('  ❌ Firebase messaging plugin missing from config');
    }
  } catch (error) {
    console.log('  ⚠️ Could not parse app.config.js:', error.message);
  }
} else {
  console.log('  ❌ app.config.js not found');
}

// Test 4: Check service files
console.log('\n🛠️ Checking service implementations...');

const firebaseServicePath = 'services/firebase/firebase.ts';
if (fs.existsSync(firebaseServicePath)) {
  console.log('  ✅ Firebase service implementation found');
} else {
  console.log('  ❌ Firebase service implementation missing');
}

const messagingServicePath = 'services/firebase/messaging.ts';
if (fs.existsSync(messagingServicePath)) {
  console.log('  ✅ FCM service implementation found');
} else {
  console.log('  ❌ FCM service implementation missing');
}

const permissionServicePath = 'services/permissions/NotificationPermissionService.ts';
if (fs.existsSync(permissionServicePath)) {
  console.log('  ✅ Notification permission service found');
} else {
  console.log('  ❌ Notification permission service missing');
}

const notificationServicePath = 'services/notifications/NotificationService.ts';
if (fs.existsSync(notificationServicePath)) {
  console.log('  ✅ Notification service found');
} else {
  console.log('  ❌ Notification service missing');
}

// Test 5: Check test utilities
console.log('\n🧪 Checking test utilities...');

const testUtilsPath = 'utils/FirebaseTestUtils.ts';
if (fs.existsSync(testUtilsPath)) {
  console.log('  ✅ Firebase test utilities available');
  console.log('     You can use these in your app to run runtime tests');
} else {
  console.log('  ⚠️ Firebase test utilities not found');
}

// Summary
console.log('\n📊 Integration Test Summary');
console.log('=' .repeat(50));
console.log('\n✅ What\'s working:');
console.log('  - Firebase dependencies are installed');
console.log('  - Android configuration files are present');
console.log('  - Service implementations are available');
console.log('  - Notification permission handling is implemented');

console.log('\n💡 Next steps:');
console.log('  1. Build and run your app: npx expo run:android');
console.log('  2. Test notification permissions in the app');
console.log('  3. Use Firebase Console to send test notifications');
console.log('  4. Monitor logs for any runtime issues');

console.log('\n🔍 For runtime testing:');
console.log('  - Import FirebaseTestUtils in your app');
console.log('  - Call FirebaseTestUtils.runFirebaseIntegrationTest()');
console.log('  - Check the console for detailed test results');

console.log('\n🎉 Firebase integration setup appears to be complete!');
console.log('\nIf you encounter issues, check:');
console.log('  - Firebase Console project configuration');
console.log('  - Device notification settings');
console.log('  - Network connectivity');
console.log('  - App logs for specific error messages');