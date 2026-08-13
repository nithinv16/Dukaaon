// Application configuration
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

// Supabase Config
export const SUPABASE_CONFIG = {
  url: (extra.supabaseUrl as string) || '',
  anonKey: (extra.supabaseAnonKey as string) || ''
};

// Firebase Config
export const FIREBASE_CONFIG = {
  apiKey: (extra.firebaseApiKey as string) || '',
  authDomain: (extra.firebaseAuthDomain as string) || '',
  projectId: (extra.firebaseProjectId as string) || '',
  storageBucket: (extra.firebaseStorageBucket as string) || '',
  messagingSenderId: (extra.firebaseMessagingSenderId as string) || '',
  appId: (extra.firebaseAppId as string) || ''
};

// Google Maps
export const GOOGLE_MAPS_API_KEY = (extra.googleMapsApiKey as string) || '';

// App Version
export const APP_VERSION = '1.0.0';
