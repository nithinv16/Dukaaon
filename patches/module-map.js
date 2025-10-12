/**
 * Module Mapper for Problematic Modules
 * 
 * This module helps patch resolution issues by remapping problematic module imports
 * to our custom implementations or shims
 */

// Get our polyfills
const webStreamsPolyfill = require('../patches/es6-ponyfill');
const ponyfill = require('./ponyfill');
const expoMetroRuntimeFix = require('../patches/expo-metro-runtime-fix');

// Map problematic modules to their replacements
const moduleMap = {
  'web-streams-polyfill/ponyfill/es6': webStreamsPolyfill,
  'web-streams-polyfill': require('web-streams-polyfill'),
  'web-streams-polyfill/ponyfill': ponyfill
};

// Helper function to resolve a module
export function resolveModule(moduleName) {
  if (moduleMap[moduleName]) {
    console.log(`[ModuleMapper] Redirecting ${moduleName} to custom implementation`);
    return moduleMap[moduleName];
  }
  
  // Return null if we don't have a mapping
  return null;
}

// Monkey-patch require system if possible
try {
  const originalRequire = module.constructor.prototype.require;
  module.constructor.prototype.require = function(modulePath) {
    // Check if we have a mapping for this module
    const mappedModule = resolveModule(modulePath);
    if (mappedModule) {
      return mappedModule;
    }
    
    // Special case for directly including ponyfill path
    if (modulePath === 'web-streams-polyfill/ponyfill') {
      return ponyfill;
    }
    
    if (modulePath === 'web-streams-polyfill/ponyfill/es6') {
      return webStreamsPolyfill;
    }
    
    // Fall back to the original require
    return originalRequire.apply(this, arguments);
  };
  
  console.log('[ModuleMapper] Successfully monkey-patched require system');
} catch (e) {
  console.error('[ModuleMapper] Failed to monkey-patch require system:', e);
}

// Export the module map
export default moduleMap; 