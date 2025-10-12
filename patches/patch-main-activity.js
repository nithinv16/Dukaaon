/**
 * Main Activity Patch Script
 * 
 * This script patches the MainActivity.kt file to add
 * early initialization of JavaScript globals.
 */

const fs = require('fs');
const path = require('path');

// Path to the MainActivity.kt file
const mainActivityPath = path.join(
  __dirname, 
  '../android/app/src/main/java/com/sixn8/dukaaon/MainActivity.kt'
);

console.log(`Checking if MainActivity.kt exists at ${mainActivityPath}...`);

if (fs.existsSync(mainActivityPath)) {
  console.log('Found MainActivity.kt, reading file...');
  
  // Read the current content
  let content = fs.readFileSync(mainActivityPath, 'utf8');
  
  // Check if our patch was already applied
  if (content.includes('// PATCHED FOR APP REGISTRY BINDING FIX')) {
    console.log('MainActivity.kt is already patched. Skipping...');
    process.exit(0);
  }
  
  console.log('Patching MainActivity.kt...');
  
  // Find where to insert our code - after "override fun onCreate()"
  const onCreatePattern = /override\s+fun\s+onCreate\(.*?\)\s*{/;
  const match = content.match(onCreatePattern);
  
  if (match) {
    // Insert our code after the match
    const insertPosition = match.index + match[0].length;
    
    const patchCode = `
    // PATCHED FOR APP REGISTRY BINDING FIX
    try {
      // Initialize JavaScript state before any React Native code executes
      val reactInstanceManager = reactNativeHost.reactInstanceManager
      if (reactInstanceManager != null) {
        val field = reactInstanceManager.javaClass.getDeclaredField("mJSIModulePackage")
        field.isAccessible = true
        Log.d("AppRegistryFix", "Found ReactInstanceManager, preparing early initialization")
        
        // Force JSI modules to load early
        try {
          val initCode = "global.global=global; if(!global.AppRegistry) global.AppRegistry={registerComponent:function(a,b){return a;},runApplication:function(){}};"
          val catalystInstance = reactInstanceManager.currentReactContext?.catalystInstance
          if (catalystInstance != null) {
            catalystInstance.javaClass.getDeclaredMethod("evaluateJavaScript", String::class.java).apply {
              isAccessible = true
              invoke(catalystInstance, initCode)
            }
            Log.d("AppRegistryFix", "Successfully initialized JavaScript globals")
          }
        } catch (e: Exception) {
          Log.e("AppRegistryFix", "Error initializing JavaScript globals: \${e.message}")
        }
      }
    } catch (e: Exception) {
      Log.e("AppRegistryFix", "Error applying early initialization: \${e.message}")
    }
    `;
    
    // Insert the patch
    content = content.substring(0, insertPosition) + patchCode + content.substring(insertPosition);
    
    // Add import for Log and ReactInstanceManager
    if (!content.includes('import android.util.Log')) {
      content = content.replace(
        /package com\.sixn8\.dukaaon/,
        'package com.sixn8.dukaaon\n\nimport android.util.Log\nimport com.facebook.react.ReactInstanceManager'
      );
    }
    
    // Write the patched file
    fs.writeFileSync(mainActivityPath, content, 'utf8');
    console.log('Successfully patched MainActivity.kt');
  } else {
    console.error('Could not find onCreate method in MainActivity.kt');
  }
} else {
  console.error(`MainActivity.kt not found at ${mainActivityPath}`);
}

console.log('MainActivity patch script completed'); 