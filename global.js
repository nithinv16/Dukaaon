/**
 * Global initializations for the application
 * 
 * This file contains critical fixes for the "AppRegistryBinding::startSurface failed. Global was not installed" error
 */

// Make sure global exists and self-references
if (typeof global === 'undefined') {
  global = (function() { return this; })();
}

// Ensure global is defined
global.global = global;

// Critical: AppRegistryBinding must exist at startup
if (!global.AppRegistryBinding) {
  global.AppRegistryBinding = {
    startSurface: function(surfaceId, moduleName, initialProps) {
      console.log(`[Global] AppRegistryBinding.startSurface(${surfaceId}, ${moduleName})`);
      
      try {
        // Forward to AppRegistry if possible
        if (global.AppRegistry?.runApplication) {
          global.AppRegistry.runApplication(moduleName, {
            rootTag: surfaceId,
            initialProps: initialProps || {}
          });
        }
      } catch (e) {
        console.error('[Global] Error in AppRegistryBinding.startSurface:', e);
      }
    }
  };
  
  console.log('[Global] Created AppRegistryBinding');
}

// AppRegistry is also required
if (!global.AppRegistry) {
  global.AppRegistry = {
    registerComponent: function(appKey, componentProvider) {
      console.log(`[Global] AppRegistry.registerComponent(${appKey})`);
      // Store components for future use
      if (!global.__appRegistryComponents) {
        global.__appRegistryComponents = {};
      }
      global.__appRegistryComponents[appKey] = componentProvider;
      return appKey;
    },
    runApplication: function(appKey, appParams) {
      console.log(`[Global] AppRegistry.runApplication(${appKey})`);
      
      try {
        // Try to access React Native's real AppRegistry
        const ReactNative = require('react-native');
        if (ReactNative?.AppRegistry?.runApplication) {
          return ReactNative.AppRegistry.runApplication(appKey, appParams);
        }
      } catch (e) {
        console.error('[Global] Error delegating to React Native AppRegistry:', e);
      }
    }
  };
  
  console.log('[Global] Created AppRegistry');
}

// Export as ES module
export default {};

// Import basic polyfills
import { Buffer } from 'buffer';
import process from 'process';

// Basic polyfill setup
global.Buffer = Buffer;
// Ensure MAX_LENGTH is available on Buffer
if (!global.Buffer.MAX_LENGTH) {
  global.Buffer.MAX_LENGTH = 0x3fffffff; // 1GB - 1 byte (Node.js default)
}
global.process = process;

// Promise.allSettled polyfill for older environments
if (!Promise.allSettled) {
  Promise.allSettled = function(promises) {
    return Promise.all(
      promises.map(promise =>
        Promise.resolve(promise)
          .then(value => ({ status: 'fulfilled', value }))
          .catch(reason => ({ status: 'rejected', reason }))
      )
    );
  };
}

// Simplified error handler for development
global.ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('=== App Error ===');
  console.error(error.message);
  console.error(error.stack);
  console.error('=================');
  
  // Don't throw errors during development to prevent crash loops
  if (isFatal) {
    console.error('FATAL ERROR - App may need to restart');
  }
});