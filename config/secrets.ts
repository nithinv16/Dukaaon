import Constants from 'expo-constants';
import envConfig from './environment';

// Helper to get values from various sources with fallbacks
const getConfigValue = (key: string, defaultValue: string = ''): string => {
  // Try to get from process.env first (for CI/CD environments)
  if (process.env[key]) {
    return process.env[key] as string;
  }
  
  // Then try Expo Constants (for Expo builds with app.config.js extra)
  if (Constants.expoConfig?.extra && Constants.expoConfig.extra[key]) {
    return Constants.expoConfig.extra[key] as string;
  }
  
  // Finally use .env file values (already loaded into process.env by Expo)
  if (process.env[key]) {
    return process.env[key] as string;
  }
  
  // Return default if nothing found
  return defaultValue;
};

// Supabase configuration
export const supabaseConfig = {
  url: getConfigValue('SUPABASE_URL'),
  anonKey: getConfigValue('SUPABASE_ANON_KEY')
};

// Firebase configuration
export const firebaseConfig = {
  apiKey: getConfigValue('FIREBASE_API_KEY'),
  authDomain: getConfigValue('FIREBASE_AUTH_DOMAIN'),
  projectId: getConfigValue('FIREBASE_PROJECT_ID'),
  storageBucket: getConfigValue('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getConfigValue('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getConfigValue('FIREBASE_APP_ID'),
  appVerificationDisabledForTesting: false // Always disabled for production
};

// Google Maps configuration
export const googleMapsConfig = {
  apiKey: getConfigValue('GOOGLE_MAPS_API_KEY')
};

// Razorpay configuration
export const razorpayConfig = {
  keyId: getConfigValue('EXPO_PUBLIC_RAZORPAY_KEY_ID'),
};

// Export all configurations
export default {
  supabase: supabaseConfig,
  firebase: firebaseConfig,
  googleMaps: googleMapsConfig,
  razorpay: razorpayConfig
};