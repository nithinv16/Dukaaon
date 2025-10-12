/**
 * JSI Compatibility Layer
 * 
 * This file provides compatibility wrappers around JSI interfaces
 * to prevent non-std C++ exceptions from crashing the app.
 */

// Create fake TurboModule system if not available
if (!global.__turboModuleProxy) {
  global.__turboModuleProxy = function(moduleName) {
    console.log(`[JSI-Compat] Attempted to access TurboModule: ${moduleName}`);
    // Return empty object to prevent crashes
    return {};
  };
  
  console.log('[JSI-Compat] Added __turboModuleProxy shim');
}

// Create AppRegistry binding if not available
if (!global.nativeAppRegistryBridge) {
  global.nativeAppRegistryBridge = {
    startApp: function(appKey, appParameters) {
      console.log(`[JSI-Compat] nativeAppRegistryBridge.startApp called: ${appKey}`);
      // Try to call the JavaScript AppRegistry if available
      if (global.AppRegistry && global.AppRegistry.runApplication) {
        try {
          global.AppRegistry.runApplication(appKey, appParameters);
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.runApplication:', error);
        }
      }
    },
    unmountApplicationComponentAtRootTag: function(rootTag) {
      console.log(`[JSI-Compat] nativeAppRegistryBridge.unmountApplicationComponentAtRootTag called: ${rootTag}`);
      if (global.AppRegistry && global.AppRegistry.unmountApplicationComponentAtRootTag) {
        try {
          global.AppRegistry.unmountApplicationComponentAtRootTag(rootTag);
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.unmountApplicationComponentAtRootTag:', error);
        }
      }
    },
    registerComponent: function(appKey, componentProvider) {
      console.log(`[JSI-Compat] nativeAppRegistryBridge.registerComponent called: ${appKey}`);
      // Call the JavaScript AppRegistry if available
      if (global.AppRegistry && global.AppRegistry.registerComponent) {
        try {
          return global.AppRegistry.registerComponent(appKey, componentProvider);
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.registerComponent:', error);
        }
      }
      return appKey;
    }
  };
  
  console.log('[JSI-Compat] Added nativeAppRegistryBridge shim');
}

// Create AppRegistryBinding interface if not available
if (!global.AppRegistryBinding) {
  global.AppRegistryBinding = {
    startSurface: function(surfaceId, moduleName, initialProps) {
      console.log(`[JSI-Compat] AppRegistryBinding.startSurface called: ${moduleName}`);
      // Try to call the JavaScript AppRegistry if available
      if (global.AppRegistry && global.AppRegistry.runApplication) {
        try {
          global.AppRegistry.runApplication(moduleName, {
            rootTag: surfaceId,
            initialProps: initialProps || {}
          });
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.runApplication:', error);
        }
      }
    },
    stopSurface: function(surfaceId) {
      console.log(`[JSI-Compat] AppRegistryBinding.stopSurface called: ${surfaceId}`);
      if (global.AppRegistry && global.AppRegistry.unmountApplicationComponentAtRootTag) {
        try {
          global.AppRegistry.unmountApplicationComponentAtRootTag(surfaceId);
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.unmountApplicationComponentAtRootTag:', error);
        }
      }
    },
    registerComponent: function(appKey, componentProvider) {
      console.log(`[JSI-Compat] AppRegistryBinding.registerComponent called: ${appKey}`);
      // Call the JavaScript AppRegistry if available
      if (global.AppRegistry && global.AppRegistry.registerComponent) {
        try {
          return global.AppRegistry.registerComponent(appKey, componentProvider);
        } catch (error) {
          console.error('[JSI-Compat] Error calling AppRegistry.registerComponent:', error);
        }
      }
      return appKey;
    }
  };
  
  console.log('[JSI-Compat] Added AppRegistryBinding shim');
}

// Export empty object for ES modules
export default {}; 