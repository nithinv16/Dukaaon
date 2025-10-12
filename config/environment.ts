type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  enableTestMode: boolean;
  enableDebugScreens: boolean;
  enableTestOTP: boolean;
  defaultTestOTP: string;
}

// Determine environment from Expo constants or environment variables
const determineEnvironment = (): Environment => {
  // Force production mode - always return 'production'
  return 'production';
};

const environment = determineEnvironment();

const config: EnvironmentConfig = {
  environment,
  isProduction: environment === 'production',
  isDevelopment: environment === 'development',
  isStaging: environment === 'staging',
  enableTestMode: false, // Disabled as requested
  enableDebugScreens: false, // Disabled as requested
  enableTestOTP: false, // Disabled as requested - using Supabase auth only
  defaultTestOTP: '123456',
};

console.log('Environment Configuration:', {
  environment: config.environment,
  isProduction: config.isProduction,
  isDevelopment: config.isDevelopment,
  enableTestOTP: config.enableTestOTP,
  __DEV__: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined'
});

export default config;