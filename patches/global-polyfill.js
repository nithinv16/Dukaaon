/**
 * Global Polyfill for AppRegistryBinding issue
 * This should be imported as early as possible in the app
 */

// Create global in multiple ways to ensure it exists
if (typeof global === 'undefined') {
  (function() {
    var g = this || self;
    g.global = g;
  })();
}

// Make sure global self-references
global.global = global;

// Add AppRegistry polyfill to global if it doesn't exist
if (!global.AppRegistry) {
  console.log('Creating AppRegistry polyfill on global object');
  global.AppRegistry = {
    // Essential methods
    registerComponent(appKey, componentProvider) {
      console.log(`[GlobalPolyfill] AppRegistry.registerComponent: ${appKey}`);
      return appKey;
    },
    runApplication(appKey, appParameters) {
      console.log(`[GlobalPolyfill] AppRegistry.runApplication: ${appKey}`);
    },
    // Other AppRegistry methods
    registerConfig(config) { return config; },
    registerRunnable(appKey, run) { return appKey; },
    registerSection(sectionKey, componentProvider) { return sectionKey; },
    getAppKeys() { return []; },
    getSectionKeys() { return []; },
    unmountApplicationComponentAtRootTag() {},
    startHeadlessTask() {}
  };
}

// Define additional objects that might be missing and cause errors
if (!global.performance) global.performance = { now: () => Date.now() };
if (typeof global.__DEV__ === 'undefined') global.__DEV__ = false;

// Add a module resolver hook for problematic modules
try {
  // Try to initialize the module mapper
  const moduleMapper = require('./module-map').default;
  
  // Add to global for potential use in other parts of the app
  global._moduleMapper = moduleMapper;
  
  console.log('[GlobalPolyfill] Module mapper initialized');
} catch (e) {
  console.error('[GlobalPolyfill] Failed to initialize module mapper:', e);
}

// Add other essential globals that may be missing
if (!global.setTimeout) global.setTimeout = function() {};
if (!global.clearTimeout) global.clearTimeout = function() {};
if (!global.setInterval) global.setInterval = function() {};
if (!global.clearInterval) global.clearInterval = function() {};

// Test global access
try {
  global._globalPolyfillTest = "GlobalPolyfillTest-" + Date.now();
  console.log(`[GlobalPolyfill] Successfully set test value: ${global._globalPolyfillTest}`);
} catch (e) {
  console.error('[GlobalPolyfill] Failed to set test value:', e);
}

export default {}; 