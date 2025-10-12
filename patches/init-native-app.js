/**
 * Native Initialization Script
 * 
 * This script patches the Android MainApplication.kt file to add
 * direct initialization of the AppRegistry and global object.
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
  if (content.includes('// PATCHED FOR APP REGISTRY BINDING FIX')) {
    console.log('MainApplication.kt is already patched. Skipping...');
    process.exit(0);
  }
  
  console.log('Patching MainApplication.kt...');
  
  // Find where to insert our code - after "override fun onCreate()"
  const onCreatePattern = /override\s+fun\s+onCreate\(\)\s*{/;
  const match = content.match(onCreatePattern);
  
  if (match) {
    // Insert our code after the match
    const insertPosition = match.index + match[0].length;
    
    const patchCode = `
    // PATCHED FOR APP REGISTRY BINDING FIX
    try {
      val appRegistryClass = Class.forName("com.facebook.react.modules.appregistry.AppRegistry")
      val instanceField = appRegistryClass.getDeclaredField("sAppRegistryModuleInstance")
      instanceField.isAccessible = true
      val appRegistryInstance = instanceField.get(null)
      
      if (appRegistryInstance == null) {
        Log.d("AppRegistryFix", "Creating AppRegistry instance early")
        // Force instance creation
        try {
          val constructor = appRegistryClass.getDeclaredConstructor()
          constructor.isAccessible = true
          val instance = constructor.newInstance()
          instanceField.set(null, instance)
          Log.d("AppRegistryFix", "Successfully created AppRegistry instance")
        } catch (e: Exception) {
          Log.e("AppRegistryFix", "Failed to create AppRegistry instance: \${e.message}")
        }
      }
    } catch (e: Exception) {
      Log.e("AppRegistryFix", "Error applying AppRegistry fix: \${e.message}")
    }
    
    // Initialize JavaScript environment early
    try {
      // Force JSC instead of Hermes
      BuildConfig.IS_HERMES_ENABLED = false
      Log.d("AppRegistryFix", "Disabled Hermes at runtime")
    } catch (e: Exception) {
      Log.e("AppRegistryFix", "Error disabling Hermes: \${e.message}")
    }
    `;
    
    // Insert the patch
    content = content.substring(0, insertPosition) + patchCode + content.substring(insertPosition);
    
    // Add import for Log
    if (!content.includes('import android.util.Log')) {
      content = content.replace(
        /package com\.sixn8\.dukaaon/,
        'package com.sixn8.dukaaon\n\nimport android.util.Log'
      );
    }
    
    // Write the patched file
    fs.writeFileSync(mainAppPath, content, 'utf8');
    console.log('Successfully patched MainApplication.kt');
  } else {
    console.error('Could not find onCreate method in MainApplication.kt');
  }
} else {
  console.error(`MainApplication.kt not found at ${mainAppPath}`);
}

// Ensure that gradle.properties has the right settings
const gradlePropsPath = path.join(__dirname, '../android/gradle.properties');

if (fs.existsSync(gradlePropsPath)) {
  console.log('Found gradle.properties, ensuring Hermes is disabled...');
  
  let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
  
  // Ensure Hermes is disabled
  gradleProps = gradleProps.replace(/hermesEnabled=true/g, 'hermesEnabled=false');
  
  // Ensure New Architecture is disabled
  gradleProps = gradleProps.replace(/newArchEnabled=true/g, 'newArchEnabled=false');
  
  // Write the modified file
  fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
  console.log('Successfully updated gradle.properties');
}

console.log('Native patch script completed'); 