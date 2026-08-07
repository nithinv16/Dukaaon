/**
 * Global Setup - Polyfills and Environment Configuration
 * 
 * This file initializes polyfills and global objects required for React Native.
 * 
 * Polyfill Loading Order:
 * 1. react-native-get-random-values (crypto.getRandomValues)
 * 2. Firebase app initialization
 * 3. Node.js module polyfills (process, Buffer, EventEmitter)
 * 
 * Additional polyfills are available in the polyfills/ directory:
 * - polyfills/crypto-polyfill.js
 * - polyfills/events-polyfill.js
 * - polyfills/stream-polyfill.js
 * 
 * Metro bundler configuration in metro.config.js handles module resolution
 * for Node.js core modules using npm packages (crypto-browserify, events,
 * stream-browserify) for full compatibility.
 */

// Import polyfills - MUST be first to fix crypto.getRandomValues() error
import 'react-native-get-random-values';

// Import React Native Firebase app - MUST be early to ensure proper initialization
import '@react-native-firebase/app';

// Suppress known third-party warnings that are not actionable
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  // NativeEventEmitter warning from third-party native modules (Firebase, etc.)
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method',
  // Suppress context warning during initial render race conditions
  'useLanguage',
]);

import process from './patches/process-browser';
import { Buffer } from 'buffer';
import EventEmitter from 'events';

// Ensure Buffer.MAX_LENGTH is properly defined to fix Hermes MAX_LENGTH error
if (!Buffer.MAX_LENGTH) {
  Buffer.MAX_LENGTH = 0x3fffffff; // 1GB - 1 byte (Node.js default)
}

// Also ensure Buffer.constants exists
if (!Buffer.constants) {
  Buffer.constants = {
    MAX_LENGTH: Buffer.MAX_LENGTH,
    MAX_STRING_LENGTH: 0x3fffffff
  };
}

// Test crypto polyfill
try {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const testArray = new Uint8Array(1);
    crypto.getRandomValues(testArray);
    console.log('✅ Crypto polyfill working correctly');
  } else {
    console.warn('⚠️ Crypto polyfill not available');
  }
} catch (error) {
  console.error('❌ Crypto polyfill test failed:', error);
}

// Firebase initialization is handled in services/firebase/firebase.ts
// No need for global initialization here

// Global error handlers to prevent unhandled promise rejections
if (typeof global !== 'undefined') {
  // Handle unhandled promise rejections
  const originalHandler = global.ErrorUtils?.getGlobalHandler?.();

  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    console.error('Global error caught:', error);

    // Check if it's an AsyncStorage or auth-related error
    if (error?.message?.includes?.('AsyncStorage') ||
      error?.message?.includes?.('auth') ||
      error?.message?.includes?.('Session timeout') ||
      error?.message?.includes?.('Profile fetch timeout')) {
      console.log('Suppressing AsyncStorage/auth error to prevent crash');
      return; // Don't crash the app for these errors
    }

    // Call original handler for other errors
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // Handle unhandled promise rejections
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Prevent default behavior for AsyncStorage/auth errors
      if (event.reason?.message?.includes?.('AsyncStorage') ||
        event.reason?.message?.includes?.('auth') ||
        event.reason?.message?.includes?.('Session timeout') ||
        event.reason?.message?.includes?.('Profile fetch timeout')) {
        console.log('Preventing unhandled rejection for AsyncStorage/auth error');
        event.preventDefault();
      }
    });
  }
}

// Set up global objects
if (typeof global.process === 'undefined') {
  global.process = process;
}

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
  // Ensure MAX_LENGTH is available on global.Buffer
  if (!global.Buffer.MAX_LENGTH) {
    global.Buffer.MAX_LENGTH = 0x3fffffff;
  }
}

if (typeof global.EventEmitter === 'undefined') {
  global.EventEmitter = EventEmitter;
}

// Add any other required globals
// Note: location is read-only in Hermes, so we need to check if it exists and only set if writable
try {
  if (typeof global.location === 'undefined') {
    Object.defineProperty(global, 'location', {
      value: { protocol: 'https:', href: '', hostname: '', pathname: '', search: '', hash: '' },
      writable: true,
      configurable: true
    });
  }
} catch (e) {
  // location property exists and is read-only, skip assignment
  console.log('[GlobalSetup] location property is read-only, skipping polyfill');
}

try {
  if (typeof global.navigator === 'undefined') {
    global.navigator = { product: 'ReactNative' };
  }
} catch (e) {
  console.log('[GlobalSetup] navigator property is read-only, skipping polyfill');
}

// Export to ensure this file is included in the bundle
export default {
  process,
  Buffer,
  EventEmitter,
};