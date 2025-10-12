/**
 * JSC AppRegistryBinding Fix
 * 
 * This file specifically targets the "AppRegistryBinding::startSurface failed. Global was not installed" error
 * that occurs in JSC (not Hermes) when using Expo Go.
 */

// IIFE to avoid polluting global scope
(function() {
  // Check if we're in JSC (not Hermes)
  const isJSC = typeof global.HermesInternal === 'undefined';
  
  if (isJSC) {
    console.log('[JSC-Fix] Running AppRegistryBinding fix for JSC');
    
    // Early patch global.AppRegistryBinding
    if (!global.AppRegistryBinding) {
      global.AppRegistryBinding = {
        // The main function that causes the error
        startSurface: function(surfaceId, moduleName, initialProps) {
          console.log(`[JSC-Fix] AppRegistryBinding.startSurface(${surfaceId}, ${moduleName})`);
          
          // Ensure global.AppRegistry exists
          if (!global.AppRegistry) {
            console.log('[JSC-Fix] Creating AppRegistry because it was missing');
            global.AppRegistry = {
              registerComponent: (appKey, componentProvider) => {
                console.log(`[JSC-Fix] AppRegistry.registerComponent(${appKey})`);
                if (!global.__registeredComponents) {
                  global.__registeredComponents = {};
                }
                global.__registeredComponents[appKey] = componentProvider;
                return appKey;
              },
              runApplication: (appKey, appParameters) => {
                console.log(`[JSC-Fix] AppRegistry.runApplication(${appKey})`);
                try {
                  // Try to access React Native's real AppRegistry
                  const ReactNative = require('react-native');
                  if (ReactNative && ReactNative.AppRegistry && ReactNative.AppRegistry.runApplication) {
                    return ReactNative.AppRegistry.runApplication(appKey, appParameters);
                  }
                } catch (e) {
                  console.error('[JSC-Fix] Error accessing React Native AppRegistry:', e);
                }
              }
            };
          }
          
          // Forward to real AppRegistry if possible
          try {
            if (global.AppRegistry && global.AppRegistry.runApplication) {
              global.AppRegistry.runApplication(moduleName, {
                rootTag: surfaceId,
                initialProps: initialProps || {}
              });
            }
          } catch (e) {
            console.warn('[JSC-Fix] Error in startSurface:', e);
          }
        }
      };
      console.log('[JSC-Fix] Created AppRegistryBinding on global');
    }
    
    // CRITICAL: Create an internal registry for modules
    if (!global.__fbBatchedBridgeConfig) {
      global.__fbBatchedBridgeConfig = {
        remoteModuleConfig: {},
        moduleConfig: {}
      };
      console.log('[JSC-Fix] Created __fbBatchedBridgeConfig');
    }
    
    // Set up error handling for C++ exceptions
    const originalHandler = typeof ErrorUtils !== 'undefined' ? 
      ErrorUtils.getGlobalHandler() : null;
      
    if (originalHandler && typeof ErrorUtils !== 'undefined') {
      ErrorUtils.setGlobalHandler(function(error, isFatal) {
        if (error && (
            error.message === 'non-std C++ exception' || 
            (typeof error.message === 'string' && error.message.includes('C++ exception')) ||
            (typeof error.message === 'string' && error.message.includes('AppRegistryBinding'))
        )) {
          console.warn('[JSC-Fix] Caught C++ exception:', error.message);
          
          // Try to recover by re-initializing AppRegistryBinding
          if (!global.AppRegistryBinding) {
            console.log('[JSC-Fix] Re-initializing AppRegistryBinding');
            require('./jsc-appregistry-binding-fix');
          }
          
          // Convert fatal error to non-fatal
          return originalHandler(error, false);
        }
        return originalHandler(error, isFatal);
      });
      console.log('[JSC-Fix] Installed C++ exception handler');
    }
  } else {
    console.log('[JSC-Fix] Not running in JSC, skipping fix');
  }
})();

// Export empty object for ES modules
export default {}; 