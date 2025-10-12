/**
 * Bootstrap file for the app
 * This file loads all necessary polyfills and patches
 * It should be imported first in index.js
 */

// Load the specialized AppRegistryBinding fix first
require('./patches/jsc-appregistry-binding-fix');

// JSC Polyfill must be next - helps prevent non-std C++ exceptions
require('./patches/jsc-polyfill');

// JSI Compatibility Layer - provides shims for native binding interfaces
require('./patches/jsi-compatibility');

// Exception handler - helps recover from C++ exceptions
require('./patches/exception-handler');

// Ensure the global object is properly set up
global.global = global;

// Add a special method to handle AppRegistryBinding directly from native code
// This bypasses the problematic C++ layer
global.__registerAppRegistry = function(appKey, callback) {
  console.log(`[Bootstrap] __registerAppRegistry called for ${appKey}`);
  
  // Add the app to our registry
  if (!global.__registeredApps) {
    global.__registeredApps = {};
  }
  
  global.__registeredApps[appKey] = callback;
  
  // Also register with the normal AppRegistry if available
  if (global.AppRegistry && global.AppRegistry.registerComponent) {
    return global.AppRegistry.registerComponent(appKey, callback);
  }
  
  return appKey;
};

// Make AppRegistryBinding available
if (!global.AppRegistryBinding) {
  global.AppRegistryBinding = {
    startSurface: function(surfaceId, moduleName, initialProps) {
      console.log(`[Bootstrap] AppRegistryBinding.startSurface: ${moduleName}`);
      
      // Try to get the registered app
      if (global.__registeredApps && global.__registeredApps[moduleName]) {
        try {
          // Call the registered callback
          const AppComponent = global.__registeredApps[moduleName]();
          
          // Try to run the app using the AppRegistry
          if (global.AppRegistry && global.AppRegistry.runApplication) {
            global.AppRegistry.runApplication(moduleName, {
              rootTag: surfaceId,
              initialProps: initialProps || {}
            });
          }
        } catch (error) {
          console.error('[Bootstrap] Error starting surface:', error);
        }
      } else {
        console.error(`[Bootstrap] No app registered for ${moduleName}`);
      }
    }
  };
  
  console.log('[Bootstrap] Created AppRegistryBinding');
}

// Preload the web-streams-polyfill/ponyfill/es6 to prevent resolution errors
try {
  // Try to preload the module from our patches
  const es6Polyfill = require('./patches/es6-ponyfill');
  
  // Make it globally available
  global.WebStreamsPolyfill = es6Polyfill;
  
  console.log('[Bootstrap] Successfully preloaded web-streams-polyfill');
} catch (error) {
  console.error('[Bootstrap] Failed to preload web-streams-polyfill:', error);
}

// Load our other polyfills
try {
  // Apply AppRegistry fix
  require('./patches/fix-global-binding');
  require('./app-registry-fix');
  
  console.log('[Bootstrap] Successfully loaded core polyfills');
} catch (error) {
  console.error('[Bootstrap] Error loading core polyfills:', error);
}

// Load module mapper
try {
  const moduleMapper = require('./patches/module-map');
  global._moduleMapper = moduleMapper.default || moduleMapper;
  
  console.log('[Bootstrap] Module mapper initialized');
} catch (error) {
  console.error('[Bootstrap] Failed to initialize module mapper:', error);
}

// Set up error handling for uncaught exceptions
// This prevents C++ exceptions from crashing the app
if (typeof ErrorUtils !== 'undefined') {
  const originalErrorHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[Bootstrap] Global error caught:', error);
    
    if (isFatal) {
      console.error('[Bootstrap] FATAL ERROR detected');
    }
    
    // Still call the original handler
    return originalErrorHandler(error, isFatal);
  });
  
  console.log('[Bootstrap] Enhanced error handling set up');
}

// Check if important global objects are properly set up
console.log('[Bootstrap] AppRegistry available:', !!global.AppRegistry);
console.log('[Bootstrap] AppRegistryBinding available:', !!global.AppRegistryBinding);

// Export empty object for ES modules
export default {}; 