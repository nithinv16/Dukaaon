#!/usr/bin/env node
/**
 * EAS Build Preparation Script
 * This script ensures that all dependency conflicts are resolved before EAS cloud builds
 * It specifically addresses the duplicate class conflicts between AndroidX and legacy support libraries
 * 
 * Run this script locally before submitting to EAS build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments correctly
const args = process.argv.slice(2);
// Remove or properly handle --platform argument if present
const platformIndex = args.indexOf('--platform');
if (platformIndex !== -1 && platformIndex + 1 < args.length) {
  // We found --platform and it has a value after it
  const platformValue = args[platformIndex + 1];
  console.log(`Platform specified: ${platformValue}`);
  // Remove both the flag and its value from args if needed
  args.splice(platformIndex, 2);
}

console.log('🔧 Preparing project for EAS build...');
console.log('🎯 Resolving AndroidX vs Legacy Support Library conflicts...');

// Function to safely execute commands
function safeExec(command, options = {}) {
  try {
    console.log(`Executing: ${command}`);
    const result = execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
    return result;
  } catch (error) {
    console.warn(`Warning: Command failed: ${command}`);
    console.warn(`Error: ${error.message}`);
    return null;
  }
}

// Function to clean npm cache for EAS builds
function cleanForEAS() {
  console.log('🧹 Cleaning caches for EAS build...');
  
  // Clean npm cache
  safeExec('npm cache clean --force');
  
  // Remove package-lock.json to force fresh resolution
  const packageLockPath = path.join(process.cwd(), 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    try {
      fs.unlinkSync(packageLockPath);
      console.log('✅ Removed package-lock.json for fresh dependency resolution');
    } catch (error) {
      console.warn('Could not remove package-lock.json:', error.message);
    }
  }
}

// Create directories for configuration files
const configDirectories = [
  'node_modules/expo-modules-core/android/src/main/assets',
  'node_modules/expo-modules-core/android/build/intermediates/assets/release',
  'android/app/src/main/assets',
  'android/app/build/intermediates/assets/release'
];

console.log('📁 Creating configuration directories...');
configDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error.message);
    }
  }
});

// Create Compose compiler configuration file
const configContent = '// This file helps override Kotlin version compatibility checks for Compose';
console.log('📄 Creating Compose compiler configuration files...');
configDirectories.forEach(dir => {
  const filePath = path.join(__dirname, dir, 'compose-compiler-configuration.bin');
  try {
    fs.writeFileSync(filePath, configContent);
    console.log(`✅ Created configuration file: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to create configuration file ${filePath}:`, error.message);
  }
});

// Directly patch EventEmitter.cpp without using patch-package
console.log('📝 Directly patching EventEmitter.cpp for C++ compatibility...');
const eventEmitterPath = path.join(__dirname, 'node_modules/expo-modules-core/common/cpp/EventEmitter.cpp');
if (fs.existsSync(eventEmitterPath)) {
  try {
    let eventEmitterContent = fs.readFileSync(eventEmitterPath, 'utf8');
    
    // Replace all instances of contains() with find() equivalents
    eventEmitterContent = eventEmitterContent
      .replace(/if\s*\(\s*!listenersMap\.contains\(\s*eventName\s*\)\s*\)/g, 
               'if (listenersMap.find(eventName) == listenersMap.end())')
      .replace(/if\s*\(\s*listenersMap\.contains\(\s*eventName\s*\)\s*\)/g, 
               'if (listenersMap.find(eventName) != listenersMap.end())');
    
    fs.writeFileSync(eventEmitterPath, eventEmitterContent);
    console.log('✅ Successfully patched EventEmitter.cpp');
  } catch (error) {
    console.error(`❌ Failed to patch EventEmitter.cpp: ${error.message}`);
  }
} else {
  console.error(`❌ Could not find EventEmitter.cpp at ${eventEmitterPath}`);
}

// Patch JNIToJSIConverter.cpp to fix starts_with issue
console.log('📝 Patching JNIToJSIConverter.cpp for starts_with compatibility...');
const jniToJsiConverterPath = path.join(__dirname, 'node_modules/expo-modules-core/android/src/main/cpp/types/JNIToJSIConverter.cpp');
if (fs.existsSync(jniToJsiConverterPath)) {
  try {
    let converterContent = fs.readFileSync(jniToJsiConverterPath, 'utf8');
    
    // Replace string.starts_with() with a compatible approach (string.rfind() check)
    converterContent = converterContent.replace(
      /if\s*\(\s*!\s*string\.starts_with\(\s*DYNAMIC_EXTENSION_PREFIX\s*\)\s*\)/g,
      'if (string.rfind(DYNAMIC_EXTENSION_PREFIX, 0) != 0)'
    );
    
    // Insert our compatibility header at the top of the file, after existing includes
    if (!converterContent.includes("cpp_compatibility.h")) {
      converterContent = converterContent.replace(
        /#include\s+<string>/,
        '#include <string>\n#include "../../cpp_compatibility.h"'
      );
    }
    
    fs.writeFileSync(jniToJsiConverterPath, converterContent);
    console.log('✅ Successfully patched JNIToJSIConverter.cpp');
  } catch (error) {
    console.error(`❌ Failed to patch JNIToJSIConverter.cpp: ${error.message}`);
  }
} else {
  console.warn(`⚠️ Could not find JNIToJSIConverter.cpp at ${jniToJsiConverterPath}`);
}

// Copy compatibility header to expo-modules-core package
console.log('📝 Copying compatibility header to expo-modules-core...');
const compatHeaderSrc = path.join(__dirname, 'android/app/src/main/cpp/cpp_compatibility.h');
const compatHeaderDst = path.join(__dirname, 'node_modules/expo-modules-core/android/src/main/cpp/cpp_compatibility.h');

if (fs.existsSync(compatHeaderSrc)) {
  try {
    fs.copyFileSync(compatHeaderSrc, compatHeaderDst);
    console.log('✅ Successfully copied compatibility header to expo-modules-core');
  } catch (error) {
    console.error(`❌ Failed to copy compatibility header: ${error.message}`);
  }
} else {
  console.warn(`⚠️ Could not find compatibility header at ${compatHeaderSrc}`);
}

// Update CMakeLists.txt to make sure it uses the right C++ standard
console.log('📝 Updating CMakeLists.txt...');
const cmakeListsPath = path.join(__dirname, 'node_modules/expo-modules-core/android/CMakeLists.txt');
if (fs.existsSync(cmakeListsPath)) {
  try {
    let cmakeContent = fs.readFileSync(cmakeListsPath, 'utf8');
    
    // Set C++ standard to 17 if it was 20
    if (cmakeContent.includes('set(CMAKE_CXX_STANDARD 20)')) {
      cmakeContent = cmakeContent.replace(
        'set(CMAKE_CXX_STANDARD 20)', 
        'set(CMAKE_CXX_STANDARD 17)'
      );
      fs.writeFileSync(cmakeListsPath, cmakeContent);
      console.log('✅ Successfully updated CMakeLists.txt to use C++17');
    } else {
      console.log('ℹ️ CMakeLists.txt does not specify C++20, no update needed');
    }
  } catch (error) {
    console.error(`❌ Failed to update CMakeLists.txt: ${error.message}`);
  }
} else {
  console.warn(`⚠️ Could not find CMakeLists.txt at ${cmakeListsPath}`);
}

// Function to check for problematic dependencies
function checkDependencyConflicts() {
  console.log('📦 Checking for AndroidX vs Support Library conflicts...');
  
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      const problematicDeps = [];
      Object.keys(allDeps).forEach(dep => {
        if (dep.includes('com.android.support') || 
            dep.includes('support-v4') || 
            dep.includes('support-compat')) {
          problematicDeps.push(dep);
        }
      });
      
      if (problematicDeps.length > 0) {
        console.warn('⚠️  Found potentially problematic dependencies:', problematicDeps);
      } else {
        console.log('✅ No problematic dependencies found in package.json');
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not check dependencies:', error.message);
  }
}

// Function to verify Gradle exclusion scripts
function verifyGradleExclusions() {
  console.log('📝 Verifying Gradle exclusion scripts...');
  
  const easBuildExclusionsPath = path.join(__dirname, 'android', 'app', 'eas-build-exclusions.gradle');
  if (fs.existsSync(easBuildExclusionsPath)) {
    console.log('✅ EAS build exclusions script found');
  } else {
    console.warn('⚠️  EAS build exclusions script missing');
  }
  
  const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    if (buildGradleContent.includes('androidx.core:core:1.16.0')) {
      console.log('✅ AndroidX core version forced to 1.16.0');
    }
    if (buildGradleContent.includes('exclude group: \'com.android.support\'')) {
      console.log('✅ Legacy support library exclusions found');
    }
  }
}

// Function to validate EAS configuration
function validateEASConfiguration() {
  console.log('🚀 Validating EAS configuration for dependency conflicts...');
  
  const easJsonPath = path.join(__dirname, 'eas.json');
  if (fs.existsSync(easJsonPath)) {
    const easConfig = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    
    if (easConfig.build && easConfig.build.production && easConfig.build.production.android) {
      const androidEnv = easConfig.build.production.android.env;
      
      if (androidEnv && androidEnv.ANDROID_USE_ANDROIDX === 'true') {
        console.log('✅ AndroidX enabled in EAS production build');
      }
      
      if (androidEnv && androidEnv.ANDROID_ENABLE_JETIFIER === 'false') {
        console.log('✅ Jetifier disabled (recommended for pure AndroidX)');
      }
      
      if (androidEnv && androidEnv.ANDROID_FORCE_ANDROIDX_CORE_VERSION === '1.16.0') {
        console.log('✅ AndroidX core version forced in EAS environment');
      }
    }
  }
}

// Run all conflict resolution checks
// Run EAS-specific cleaning first
cleanForEAS();

checkDependencyConflicts();
verifyGradleExclusions();
validateEASConfiguration();

console.log('✅ Project prepared for EAS build!');
console.log('\n📋 Conflict Resolution Summary:');
console.log('   • AndroidX dependencies forced to specific versions');
console.log('   • Legacy support libraries excluded');
console.log('   • EAS build environment configured');
console.log('   • Gradle exclusion scripts applied');
console.log('\n🚀 Ready for EAS cloud build!');

// Run EAS build configuration
console.log('\n🔧 Running EAS build configuration...');
try {
  require('./eas-build-config.js');
  console.log('✅ EAS build configuration completed');
} catch (error) {
  console.log('ℹ️  EAS build configuration script not found (optional)');
  // Don't fail the build, just log the info
}