/**
 * Exception Handler
 * 
 * This file provides runtime exception handling to prevent C++ exceptions
 * from crashing the application.
 */

// Register a global uncaught exception handler
if (typeof process !== 'undefined' && process.on) {
  // For Node.js environments
  process.on('uncaughtException', (error) => {
    console.error('[ExceptionHandler] Uncaught exception:', error);
    // Allow the process to continue running
    return true;
  });
  
  console.log('[ExceptionHandler] Registered Node.js uncaught exception handler');
}

// Create a special error class for C++ exceptions
class CppException extends Error {
  constructor(message) {
    super(message || 'Non-standard C++ exception');
    this.name = 'CppException';
    this.isCppException = true;
  }
}

// Patch the global error handler if ErrorUtils is available
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Check if this might be a C++ exception
    if (error && (
      error.message === 'non-std C++ exception' ||
      (typeof error.message === 'string' && error.message.includes('C++ exception')) ||
      error.toString().includes('C++ exception')
    )) {
      console.error('[ExceptionHandler] Caught C++ exception:', error);
      
      // Create a new error with more information
      const wrappedError = new CppException();
      wrappedError.originalError = error;
      
      // For non-fatal C++ exceptions, don't crash the app
      if (!isFatal) {
        console.error('[ExceptionHandler] Suppressing non-fatal C++ exception');
        return true;
      }
      
      // For fatal exceptions, try to provide more context
      console.error('[ExceptionHandler] Fatal C++ exception - attempting to recover');
      
      // Call the original handler with our wrapped error
      return originalHandler(wrappedError, false);
    }
    
    // For other errors, use the original handler
    return originalHandler(error, isFatal);
  });
  
  console.log('[ExceptionHandler] Installed C++ exception handler');
}

// Add a special handler for AppRegistryBinding
if (global.AppRegistryBinding) {
  // Wrap the startSurface method to catch C++ exceptions
  const originalStartSurface = global.AppRegistryBinding.startSurface;
  if (typeof originalStartSurface === 'function') {
    global.AppRegistryBinding.startSurface = function(...args) {
      try {
        return originalStartSurface.apply(this, args);
      } catch (error) {
        console.error('[ExceptionHandler] Error in AppRegistryBinding.startSurface:', error);
        
        // Try to handle the error gracefully
        if (global.AppRegistry && global.AppRegistry.runApplication) {
          try {
            // Try to run the application through the JS AppRegistry
            console.log('[ExceptionHandler] Attempting to recover with JS AppRegistry');
            const [surfaceId, moduleName, initialProps] = args;
            global.AppRegistry.runApplication(moduleName, {
              rootTag: surfaceId,
              initialProps: initialProps || {}
            });
          } catch (fallbackError) {
            console.error('[ExceptionHandler] Recovery attempt failed:', fallbackError);
          }
        }
      }
    };
    
    console.log('[ExceptionHandler] Wrapped AppRegistryBinding.startSurface for exception handling');
  }
}

// Export the custom error class for potential use elsewhere
export { CppException };

// Export empty default for ES modules
export default {}; 