const { getDefaultConfig } = require('@expo/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Add blockList to exclude API routes
config.resolver.blockList = [
  /app\/api\/.*/,
  /.*\/app\/api\/.*/,
];

// Configure resolution of Node.js modules
config.resolver.extraNodeModules = {
  // Core Node.js modules
  'stream': require.resolve('stream-browserify'),
  'events': require.resolve('events'),
  'crypto': require.resolve('expo-crypto'),
  'node:crypto': require.resolve('expo-crypto'),
  'node:buffer': path.join(__dirname, 'patches/buffer-polyfill.js'),
  'buffer': path.join(__dirname, 'patches/buffer-polyfill.js'),
  'node:stream': require.resolve('stream-browserify'),
  'process': path.join(__dirname, 'patches/process-browser.js'),
  'process/browser': path.join(__dirname, 'patches/process-browser.js'),
  'zlib': require.resolve('browserify-zlib'),
  
  // Web streams polyfill - use our custom implementations
  'web-streams-polyfill': path.join(__dirname, 'node_modules/web-streams-polyfill'),
  'web-streams-polyfill/ponyfill/es6': path.join(__dirname, 'patches/es6-ponyfill.js'),
  'web-streams-polyfill/ponyfill': path.join(__dirname, 'patches/ponyfill.js'),
  
  // TypeSpec runtime modules
  '@typespec/ts-http-runtime': path.join(__dirname, 'node_modules/@typespec/ts-http-runtime'),
  '@typespec/ts-http-runtime/internal/util': path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/util'),
  '@typespec/ts-http-runtime/internal/logger': path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/logger'),
  '@typespec/ts-http-runtime/internal/policies': path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/policies'),
  
  // Empty modules for modules we don't need
  'net': path.join(__dirname, 'services/empty.js'),
  'tls': path.join(__dirname, 'services/empty.js'),
  'node:fs': require.resolve('expo-file-system'),
    'node:util': require.resolve('util'),
    'fs': require.resolve('expo-file-system'),
    'fs/promises': require.resolve('expo-file-system'),
  'http': path.join(__dirname, 'services/empty.js'),
  'https': path.join(__dirname, 'services/empty.js'),
  'path': require.resolve('path-browserify'),
  'os': require.resolve('os-browserify/browser'),
  'util': require.resolve('util/'),
  'assert': require.resolve('assert/'),
  'url': require.resolve('url/'),
  
  // Fix for ExceptionsManager and PlatformConstants
  'react-native': path.join(__dirname, 'node_modules/react-native'),
  'url': require.resolve('react-native-url-polyfill'), // Added for consistency with babel config, using react-native-url-polyfill
  'react-native-paper': path.join(__dirname, 'node_modules/react-native-paper/lib/module'), // Added from babel config
};

// Make sure new files are included in the bundle
config.watchFolders = [path.resolve(__dirname)];

// Add additional source extensions to Expo's defaults
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'mjs',
  'cjs'
];

// Modify the resolve function to handle dependency resolution
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle node:util specifically for Azure packages
  if (moduleName === 'node:util') {
    return {
      filePath: require.resolve('util/util.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle process/browser specifically
  if (moduleName === 'process/browser') {
    return {
      filePath: path.join(__dirname, 'patches/process-browser.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle TypeSpec runtime internal utilities
  if (moduleName === '@typespec/ts-http-runtime/internal/util') {
    const utilPath = path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/util/index.js');
    if (fs.existsSync(utilPath)) {
      return {
        filePath: utilPath,
        type: 'sourceFile',
      };
    }
    // Fallback to react-native index if util doesn't exist
    return {
      filePath: path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/index.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle TypeSpec runtime internal logger
  if (moduleName === '@typespec/ts-http-runtime/internal/logger') {
    const loggerPath = path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/logger/internal.js');
    if (fs.existsSync(loggerPath)) {
      return {
        filePath: loggerPath,
        type: 'sourceFile',
      };
    }
    // Fallback to react-native index if logger doesn't exist
    return {
      filePath: path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/index.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle TypeSpec runtime internal policies
  if (moduleName === '@typespec/ts-http-runtime/internal/policies') {
    const policiesPath = path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/policies/index.js');
    if (fs.existsSync(policiesPath)) {
      return {
        filePath: policiesPath,
        type: 'sourceFile',
      };
    }
    // Fallback to react-native index if policies doesn't exist
    return {
      filePath: path.join(__dirname, 'node_modules/@typespec/ts-http-runtime/dist/react-native/index.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle web-streams-polyfill paths
  if (moduleName === 'web-streams-polyfill/ponyfill/es6') {
    return {
      filePath: path.join(__dirname, 'patches/es6-ponyfill.js'),
      type: 'sourceFile',
    };
  }
  
  if (moduleName === 'web-streams-polyfill/ponyfill') {
    return {
      filePath: path.join(__dirname, 'patches/ponyfill.js'),
      type: 'sourceFile',
    };
  }
  
  // Special handling for idb module
  if (moduleName === 'idb') {
    return {
      filePath: require.resolve('idb/build/index.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle postinstall.mjs specifically
  if (moduleName.endsWith('/postinstall.mjs')) {
    return {
      filePath: require.resolve('react-native/Libraries/Core/InitializeCore.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle ExceptionsManager path resolution
  if (moduleName.includes('ExceptionsManager') || 
      moduleName.includes('../../../../../react-native/Libraries/Core/ExceptionsManager')) {
    return {
      filePath: require.resolve('react-native/Libraries/Core/ExceptionsManager'),
      type: 'sourceFile',
    };
  }
  
  // Handle Platform utility resolution
  if (moduleName === '../Utilities/Platform' || moduleName.includes('Utilities/Platform')) {
    // Use platform-specific Platform file or fallback to default resolver
    const platformFile = platform === 'android' 
      ? path.join(__dirname, 'node_modules/react-native/Libraries/Utilities/Platform.android.js')
      : path.join(__dirname, 'node_modules/react-native/Libraries/Utilities/Platform.ios.js');
    
    if (fs.existsSync(platformFile)) {
      return {
        filePath: platformFile,
        type: 'sourceFile',
      };
    }
    
    // Fallback to default resolver if platform-specific file doesn't exist
    return context.resolveRequest(context, 'react-native/Libraries/Utilities/Platform', platform);
  }
  
  // Handle react-native-maps native modules on web
  if (platform === 'web' && (moduleName.includes('react-native-maps') || moduleName.includes('codegenNativeCommands'))) {
    // Return empty module for web platform
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle @react-native-voice/voice native modules on web
  if (platform === 'web' && moduleName.includes('@react-native-voice/voice')) {
    // Return empty module for web platform
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle expo-location native modules on web
  if (platform === 'web' && moduleName.includes('expo-location')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // react-native-image-picker doesn't need web polyfill handling
  
  // Handle expo-image-manipulator native modules on web
  if (platform === 'web' && moduleName.includes('expo-image-manipulator')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle expo-speech native modules on web
  if (platform === 'web' && moduleName.includes('expo-speech')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle react-native-chart-kit native modules on web
  if (platform === 'web' && moduleName.includes('react-native-chart-kit')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Handle @react-native-async-storage/async-storage native modules on web
  if (platform === 'web' && moduleName.includes('@react-native-async-storage/async-storage')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Exclude Next.js API routes from Metro bundling
  if (moduleName.includes('app/api/') || moduleName.includes('next/server')) {
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  // Exclude com.android.support modules to prevent namespace conflicts
  if (moduleName.includes('com.android.support') || 
      moduleName.includes('android.support.graphics.drawable') ||
      moduleName.includes('support-vector-drawable') ||
      moduleName.includes('animated-vector-drawable') ||
      moduleName.includes('support-compat') ||
      moduleName.includes('versionedparcelable') && moduleName.includes('com.android.support')) {
    // Return empty module to exclude problematic support library modules
    return {
      filePath: path.join(__dirname, 'services/empty.js'),
      type: 'sourceFile',
    };
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;