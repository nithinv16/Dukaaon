import Constants from 'expo-constants';

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

// Razorpay configuration
const keyId = getConfigValue('EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_live_RxirgNtNjhxqSg');
const keySecret = getConfigValue('EXPO_PUBLIC_RAZORPAY_KEY_SECRET', 'XNC1LWew0Fd4Ly9LoWb4Egrp');

// Debug: Log what value was loaded (for troubleshooting)
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  console.log('[RazorpayConfig] Loaded Key ID:', 
    keyId ? `${keyId.substring(0, 15)}... (length: ${keyId.length})` : 'NOT SET',
    '| Source:', process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ? 'process.env' : 'fallback'
  );
}

export const razorpayConfig = {
  keyId,
  keySecret,
  // For server-side operations, you'll need to use the key secret
  // This should be kept secure and only used on the backend
  merchantName: 'DukaaOn',
  merchantDescription: 'B2B Marketplace for Retailers',
  // App package name for deep linking
  appPackageName: 'com.sixn8.dukaaon',
};

// Validate Razorpay configuration
export const validateRazorpayConfig = (): { isValid: boolean; missingKeys: string[] } => {
  const missingKeys: string[] = [];
  
  if (!razorpayConfig.keyId) {
    missingKeys.push('EXPO_PUBLIC_RAZORPAY_KEY_ID');
  }
  
  // Note: Key secret is not required on client side for React Native SDK
  // It's only needed for server-side verification
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  };
};

// Environment variables template for .env file
export const ENV_TEMPLATE = `
# Razorpay Configuration
# Add these to your .env file
# Note: EXPO_PUBLIC_ prefix is required for client-side access in React Native/Expo

# Razorpay Live Keys (from your Razorpay dashboard)
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_RxirgNtNjhxqSg
EXPO_PUBLIC_RAZORPAY_KEY_SECRET=XNC1LWew0Fd4Ly9LoWb4Egrp


# Note: Key secret is typically only used on the backend for payment verification
# The React Native SDK only requires the key ID for payment initialization
`;

// Export default configuration
export default razorpayConfig;

