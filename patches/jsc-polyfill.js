/**
 * JSC Polyfill for Exception Handling
 * This file helps prevent non-std C++ exceptions in React Native
 */

// Make sure global exists and self-references
if (typeof global === 'undefined') {
  global = this;
}
global.global = global;

// Create AppRegistry early if missing
if (!global.AppRegistry) {
  global.AppRegistry = {
    registerComponent: function(appKey, componentProvider) {
      console.log(`[JSCPolyfill] AppRegistry.registerComponent called for ${appKey}`);
      return appKey;
    },
    runApplication: function(appKey, initialProps) {
      console.log(`[JSCPolyfill] AppRegistry.runApplication called for ${appKey}`);
    },
    registerRunnable: function() {},
    registerConfig: function() {},
    registerSection: function() {},
    getAppKeys: function() { return []; },
    unmountApplicationComponentAtRootTag: function() {},
    startHeadlessTask: function() {}
  };

  console.log('[JSCPolyfill] Created AppRegistry on global');
}

// Define _nativeModuleProxy to avoid access issues
if (!global._nativeModuleProxy) {
  global._nativeModuleProxy = {};
  console.log('[JSCPolyfill] Created _nativeModuleProxy on global');
}

// Define important React Native internals if they don't exist
// These properties are often accessed during initialization
if (!global.__DEV__) global.__DEV__ = false;
if (!global.performance) global.performance = { now: () => Date.now() };
if (!global.requestAnimationFrame) global.requestAnimationFrame = callback => setTimeout(callback, 0);
if (!global.cancelAnimationFrame) global.cancelAnimationFrame = id => clearTimeout(id);

// Wrap core functions in try-catch to prevent C++ exceptions from crashing the app
const wrapWithTryCatch = (obj, methodName) => {
  if (obj && obj[methodName] && typeof obj[methodName] === 'function') {
    const original = obj[methodName];
    obj[methodName] = function(...args) {
      try {
        return original.apply(this, args);
      } catch (error) {
        console.error(`[JSCPolyfill] Error in ${methodName}:`, error);
        return undefined;
      }
    };
  }
};

// Wrap critical AppRegistry methods
if (global.AppRegistry) {
  wrapWithTryCatch(global.AppRegistry, 'registerComponent');
  wrapWithTryCatch(global.AppRegistry, 'runApplication');
}

console.log('[JSCPolyfill] Initialized JSC exception handling');

// Make sure all the web-streams-polyfill objects are available
try {
  const WebStreamsPolyfill = require('web-streams-polyfill');
  global.ReadableStream = WebStreamsPolyfill.ReadableStream;
  global.WritableStream = WebStreamsPolyfill.WritableStream;
  global.TransformStream = WebStreamsPolyfill.TransformStream;
  console.log('[JSCPolyfill] Registered web-streams-polyfill objects globally');
} catch (e) {
  console.error('[JSCPolyfill] Failed to register web-streams-polyfill:', e);
}

// Export empty for module system
export default {}; 