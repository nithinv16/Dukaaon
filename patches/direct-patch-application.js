/**
 * Direct Main Application Patch
 * 
 * This script directly modifies MainApplication.kt to initialize
 * our custom binding classes and disable Hermes.
 */

const fs = require('fs');
const path = require('path');

// Path to the MainApplication.kt file
const mainAppPath = path.join(
  __dirname, 
  '../android/app/src/main/java/com/sixn8/dukaaon/MainApplication.kt'
);

console.log(`Checking if MainApplication.kt exists at ${mainAppPath}...`);

if (fs.existsSync(mainAppPath)) {
  console.log('Found MainApplication.kt, reading file...');
  
  // Read the current content
  let content = fs.readFileSync(mainAppPath, 'utf8');
  
  // Check if our patch was already applied
  if (content.includes('// DIRECT APP REGISTRY BINDING FIX')) {
    console.log('MainApplication.kt is already patched. Skipping...');
  } else {
    console.log('Patching MainApplication.kt...');
    
    // Find where to insert our code - after "override fun onCreate()"
    const onCreatePattern = /override\s+fun\s+onCreate\(\)\s*{/;
    const match = content.match(onCreatePattern);
    
    if (match) {
      // Insert our code after the match
      const insertPosition = match.index + match[0].length;
      
      const patchCode = `
    // DIRECT APP REGISTRY BINDING FIX
    // Initialize our custom bindings
    try {
      super.onCreate()
      
      // Initialize as early as possible
      AppRegistryBindingApplication.initialize(this)
      
      // Force JSC instead of Hermes
      val buildConfigClass = Class.forName("com.sixn8.dukaaon.BuildConfig")
      val hermesField = buildConfigClass.getDeclaredField("IS_HERMES_ENABLED")
      hermesField.isAccessible = true
      hermesField.set(null, false)
      Log.d("AppRegistryFix", "Forced JSC at runtime in MainApplication")
    } catch (e: Exception) {
      Log.e("AppRegistryFix", "Error initializing AppRegistryBinding: \${e.message}")
    }
      `;
      
      // Modify the content with our patch
      content = content.substring(0, insertPosition) + patchCode + content.substring(insertPosition);
      
      // Add import for Log and our custom classes
      content = content.replace(
        /package com\.sixn8\.dukaaon/,
        'package com.sixn8.dukaaon\n\nimport android.util.Log'
      );
      
      // Write the patched file
      fs.writeFileSync(mainAppPath, content, 'utf8');
      console.log('Successfully patched MainApplication.kt');
    } else {
      console.error('Could not find onCreate method in MainApplication.kt');
    }
  }
  
  // Now let's fix the reactNativeHost block to ensure Hermes is disabled
  if (content.includes('override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED')) {
    console.log('Fixing Hermes configuration in MainApplication.kt...');
    
    // Replace the Hermes enabled configuration
    content = content.replace(
      'override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED',
      'override val isHermesEnabled: Boolean = false // Disabled to fix AppRegistryBinding issue'
    );
    
    // Add the JSCExecutorFactory override if it doesn't exist
    if (!content.includes('override fun createJSExecutorFactory')) {
      const reactHostBlock = content.match(/object\s*:\s*DefaultReactNativeHost\(\s*this\s*\)\s*{([\s\S]*?)}/m);
      if (reactHostBlock) {
        const closingBracePos = reactHostBlock.index + reactHostBlock[0].length - 1;
        
        const jsExecutorFactoryCode = `
          
          // Force JSC executor factory to fix AppRegistryBinding issue
          override fun createJSExecutorFactory() = com.facebook.react.jscexecutor.JSCExecutorFactory(packageName, false)
        `;
        
        content = content.substring(0, closingBracePos) + jsExecutorFactoryCode + content.substring(closingBracePos);
        
        // Add the import for JSCExecutorFactory
        if (!content.includes('import com.facebook.react.jscexecutor.JSCExecutorFactory')) {
          content = content.replace(
            /import com\.facebook\.react\.soloader\.SoLoader/,
            'import com.facebook.react.soloader.SoLoader\nimport com.facebook.react.jscexecutor.JSCExecutorFactory'
          );
        }
      }
    }
    
    // Write the updated file
    fs.writeFileSync(mainAppPath, content, 'utf8');
    console.log('Successfully updated Hermes configuration in MainApplication.kt');
  }
} else {
  console.error(`MainApplication.kt not found at ${mainAppPath}`);
}

console.log('Direct application patch completed'); 