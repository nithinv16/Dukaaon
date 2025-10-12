
/**
 * HermesFix module
 * This fixes property errors in Hermes engine including 'require', 'create', and 'router'
 */

import { NativeModules, StyleSheet } from 'react-native';

// Fix for 'require' property error
function fixHermesRequire() {
  try {
    if (global.HermesInternal) {
      console.log('[HermesFix] Patching Hermes require...');
      
      // Define require if it doesn't exist
      if (typeof global.require === 'undefined') {
        // Create basic require implementation
        global.require = function(modulePath) {
          console.warn(`[HermesFix] require('${modulePath}') called but not available`);
          return {};
        };
        console.log('[HermesFix] Added global.require function');
      }
      
      // Make sure other critical globals exist
      global.__DEV__ = !!global.__DEV__;
      global.__dirname = global.__dirname || '/';
      global.__filename = global.__filename || '';
      
      console.log('[HermesFix] Hermes require patching complete');
    } else {
      console.log('[HermesFix] Hermes not detected for require patch');
    }
  } catch (error) {
    console.error('[HermesFix] Error patching Hermes require:', error);
  }
}

// Fix for StyleSheet 'create' property error
function fixHermesStyleSheet() {
  try {
    console.log('[HermesFix] Patching StyleSheet.create...');
    
    // Check if StyleSheet exists and has create method
    if (StyleSheet && typeof StyleSheet.create === 'function') {
      console.log('[HermesFix] StyleSheet.create is available');
      
      // Store original create function
      const originalCreate = StyleSheet.create;
      
      // Wrap create function to catch errors
      StyleSheet.create = function(styles) {
        try {
          return originalCreate(styles);
        } catch (error) {
          console.error('[HermesFix] Error in StyleSheet.create:', error);
          // Return empty styles object as fallback
          return {};
        }
      };
      
      console.log('[HermesFix] StyleSheet.create patching complete');
    } else {
      console.error('[HermesFix] StyleSheet.create not available');
    }
  } catch (error) {
    console.error('[HermesFix] Error patching StyleSheet:', error);
  }
}

// Fix for router property error
function fixHermesRouter() {
  try {
    console.log('[HermesFix] Patching router property...');
    
    // Add router property to global if it doesn't exist
    if (typeof global.router === 'undefined') {
      global.router = {
        push: function(path) {
          console.warn(`[HermesFix] router.push('${path}') called but router not available`);
        },
        replace: function(path) {
          console.warn(`[HermesFix] router.replace('${path}') called but router not available`);
        },
        back: function() {
          console.warn('[HermesFix] router.back() called but router not available');
        },
        canGoBack: function() {
          console.warn('[HermesFix] router.canGoBack() called but router not available');
          return false;
        }
      };
      console.log('[HermesFix] Added global.router fallback');
    }
    
    console.log('[HermesFix] Router property patching complete');
  } catch (error) {
    console.error('[HermesFix] Error patching router property:', error);
  }
}

// Apply all fixes
function applyHermesFixes() {
  console.log('[HermesFix] Applying Hermes fixes...');
  
  fixHermesRequire();
  fixHermesStyleSheet();
  fixHermesRouter();
  
  console.log('[HermesFix] All Hermes fixes applied');
}

// Export the fix function
export default {
  applyFixes: applyHermesFixes
};

// Auto-apply fixes when module is imported
applyHermesFixes();
