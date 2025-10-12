/**
 * This file fixes the AppRegistryBinding::startSurface failed. Global was not installed error
 * 
 * We need to ensure the AppRegistry is registered in the global object
 * as early as possible in the app initialization.
 */

// Using IIFE to ensure code runs in the right context
(function() {
  // Define global in various ways to ensure it exists
  if (typeof global === 'undefined') {
    var g = this || self;
    g.global = g;
  }
})();

// Ensure 'global' exists and self-references
global.global = global;

// Define important globals that might be missing
if (!global.__DEV__) global.__DEV__ = false;
if (!global.performance) global.performance = { now: () => Date.now() };

// Define the initializeGlobal method for native code to call
global.initializeGlobal = function() {
  console.log('[GlobalBindingFix] initializeGlobal called from native side');
  
  // Make sure AppRegistry exists on global
  if (!global.AppRegistry) {
    global.AppRegistry = createAppRegistryPolyfill();
    console.log('[GlobalBindingFix] Added AppRegistry to global from native call');
  }
};

// Create a minimal AppRegistry if it doesn't exist
if (!global.AppRegistry) {
  global.AppRegistry = createAppRegistryPolyfill();
  console.log('[GlobalBindingFix] Preemptively created AppRegistry on global');
}

// Helper function to create AppRegistry polyfill
function createAppRegistryPolyfill() {
  return {
    registerComponent(appKey, componentProvider) {
      console.log(`[GlobalBindingFix] AppRegistry.registerComponent: ${appKey}`);
      // Store the component for potential future use
      if (!this._components) this._components = {};
      this._components[appKey] = componentProvider;
      return appKey;
    },
    
    registerConfig(config) {
      console.log('[GlobalBindingFix] AppRegistry.registerConfig');
      if (!this._configs) this._configs = [];
      this._configs.push(config);
      return config;
    },
    
    registerRunnable(appKey, run) {
      console.log(`[GlobalBindingFix] AppRegistry.registerRunnable: ${appKey}`);
      if (!this._runnables) this._runnables = {};
      this._runnables[appKey] = run;
      return appKey;
    },
    
    getAppKeys() {
      return this._components ? Object.keys(this._components) : [];
    },
    
    runApplication(appKey, appParameters) {
      console.log(`[GlobalBindingFix] AppRegistry.runApplication: ${appKey}`);
      // Try to run the app if we have a runnable
      if (this._runnables && this._runnables[appKey]) {
        try {
          this._runnables[appKey](appParameters);
        } catch (e) {
          console.error(`[GlobalBindingFix] Error running app ${appKey}:`, e);
        }
      }
    },
    
    unmountApplicationComponentAtRootTag(rootTag) {
      console.log(`[GlobalBindingFix] unmountApplicationComponentAtRootTag: ${rootTag}`);
    }
  };
}

// Try to execute code directly on the global object to ensure it's properly initialized
try {
  global.globalFixTestValue = "GlobalBindingFixTestValue";
  console.log(`[GlobalBindingFix] Set test value: ${global.globalFixTestValue}`);
} catch (e) {
  console.error('[GlobalBindingFix] Failed to set global test value:', e);
}

// Export empty object for ES modules compatibility
export default {}; 