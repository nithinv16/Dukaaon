/**
 * CRITICAL: GLOBAL INITIALIZER
 * This file must be imported first in your app's entry point
 * It initializes global objects before React Native accesses them
 */

// Immediately-invoked function expression to avoid polluting global scope
(function() {
  // STEP 1: Ensure 'global' exists and self-references
  if (typeof global === 'undefined') {
    global = this;
  }
  global.global = global;
  
  // STEP 2: Initialize AppRegistry early - MOST CRITICAL
  if (!global.AppRegistry) {
    global.AppRegistry = {
      registerComponent: function(appKey, componentProvider) {
        console.log(`[GlobalInit] AppRegistry.registerComponent(${appKey})`);
        // Store the component in our own registry
        if (!global.__registeredComponents) {
          global.__registeredComponents = {};
        }
        global.__registeredComponents[appKey] = componentProvider;
        return appKey;
      },
      runApplication: function() {
        console.log('[GlobalInit] AppRegistry.runApplication()');
      },
      unmountApplicationComponentAtRootTag: function() {},
      registerConfig: function(config) { return config; },
      registerRunnable: function(appKey, run) { return appKey; },
      registerSection: function() {},
      getAppKeys: function() { return Object.keys(global.__registeredComponents || {}); },
      getSectionKeys: function() { return []; },
      startHeadlessTask: function() {}
    };
    console.log('[GlobalInit] Created AppRegistry');
  }
  
  // STEP 3: Create AppRegistryBinding which is accessed by native code
  if (!global.AppRegistryBinding) {
    global.AppRegistryBinding = {
      startSurface: function(surfaceId, moduleName, initialProps) {
        console.log(`[GlobalInit] AppRegistryBinding.startSurface(${surfaceId}, ${moduleName})`);
        try {
          if (global.AppRegistry && global.AppRegistry.runApplication) {
            global.AppRegistry.runApplication(moduleName, {
              rootTag: surfaceId,
              initialProps: initialProps || {}
            });
          }
        } catch (e) {
          console.error('[GlobalInit] Error in startSurface:', e);
        }
      },
      stopSurface: function() {},
      registerComponent: function(appKey, callback) {
        console.log(`[GlobalInit] AppRegistryBinding.registerComponent(${appKey})`);
        if (global.AppRegistry && global.AppRegistry.registerComponent) {
          return global.AppRegistry.registerComponent(appKey, callback);
        }
        return appKey;
      }
    };
    console.log('[GlobalInit] Created AppRegistryBinding');
  }
  
  // STEP 4: Create __nativeModuleProxy and other required globals
  if (!global.__turboModuleProxy) {
    global.__turboModuleProxy = function() { return {}; };
  }
  
  if (!global._nativeModuleProxy) {
    global._nativeModuleProxy = {};
  }
  
  // STEP 5: Initialize important flags and timing functions - FORCE PRODUCTION MODE
  global.__DEV__ = false; // Force production mode
  process.env.NODE_ENV = 'production';
  process.env.APP_ENV = 'production';
  global.performance = global.performance || { now: () => Date.now() };
  global.requestAnimationFrame = global.requestAnimationFrame || (cb => setTimeout(cb, 0));
  global.cancelAnimationFrame = global.cancelAnimationFrame || (id => clearTimeout(id));
  
  // STEP 6: Try to create the ReadableStream implementation
  try {
    if (typeof ReadableStream === 'undefined') {
      const streams = require('web-streams-polyfill');
      global.ReadableStream = streams.ReadableStream;
      global.WritableStream = streams.WritableStream;
      global.TransformStream = streams.TransformStream;
    }
  } catch (e) {
    console.error('[GlobalInit] Failed to initialize ReadableStream:', e);
  }
  
  // STEP 7: Add a safety net for C++ exceptions
  if (typeof ErrorUtils !== 'undefined') {
    try {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler(function(error, isFatal) {
        if (error && (error.message === 'non-std C++ exception' || 
            (typeof error.message === 'string' && error.message.includes('C++ exception')))) {
          console.error('[GlobalInit] Caught C++ exception:', error);
          // Try to prevent fatal crashes for C++ exceptions
          return originalHandler(error, false);
        }
        return originalHandler(error, isFatal);
      });
    } catch (e) {
      console.error('[GlobalInit] Failed to set error handler:', e);
    }
  }
  
  console.log('[GlobalInit] Global initialization completed successfully');
})();