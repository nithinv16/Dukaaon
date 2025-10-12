#!/usr/bin/env node

/**
 * EAS Pre-Build Hook
 * This script runs before EAS builds to ensure clean AndroidX-only dependency resolution
 * It aggressively excludes all legacy support libraries and forces AndroidX versions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 EAS Pre-Build Hook: Starting comprehensive dependency cleanup...');

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

// Create comprehensive Gradle exclusion script for EAS
function createEASGradleScript() {
  console.log('📝 Creating comprehensive EAS Gradle exclusion script...');
  
  const gradleScript = `
// EAS Build - Comprehensive AndroidX Migration Script
// This script ensures ZERO support library dependencies in EAS cloud builds

println "🔧 EAS Build: Applying comprehensive AndroidX exclusions..."

// Apply to all projects and subprojects
allprojects {
    // Set consistent SDK versions
    ext {
        compileSdkVersion = 35
        buildToolsVersion = "35.0.0"
        minSdkVersion = 21
        targetSdkVersion = 35
    }
    
    // Global configuration exclusions
    configurations.configureEach { config ->
        // Exclude ALL support library groups
        exclude group: 'com.android.support'
        exclude group: 'android.arch.lifecycle'
        exclude group: 'android.arch.core'
        exclude group: 'android.arch.persistence'
        exclude group: 'android.arch.persistence.room'
        
        // Specific module exclusions that cause conflicts
        exclude module: 'support-compat'
        exclude module: 'support-core-utils'
        exclude module: 'support-core-ui'
        exclude module: 'support-fragment'
        exclude module: 'support-media-compat'
        exclude module: 'support-v4'
        exclude module: 'appcompat-v7'
        exclude module: 'recyclerview-v7'
        exclude module: 'cardview-v7'
        exclude module: 'design'
        exclude module: 'versionedparcelable'
        exclude module: 'localbroadcastmanager'
        
        // Resolution strategy for EAS builds
        resolutionStrategy {
            // Force specific AndroidX versions
            force 'androidx.core:core:1.16.0'
            force 'androidx.versionedparcelable:versionedparcelable:1.1.1'
            force 'androidx.localbroadcastmanager:localbroadcastmanager:1.0.0'
            force 'androidx.appcompat:appcompat:1.7.0'
            force 'androidx.legacy:legacy-support-v4:1.0.0'
            force 'androidx.fragment:fragment:1.8.5'
            force 'androidx.recyclerview:recyclerview:1.3.2'
            force 'androidx.cardview:cardview:1.0.0'
            
            // Dependency substitution - replace ALL support libraries
            dependencySubstitution {
                substitute module('com.android.support:support-compat') using module('androidx.core:core:1.16.0')
                substitute module('com.android.support:versionedparcelable') using module('androidx.versionedparcelable:versionedparcelable:1.1.1')
                substitute module('com.android.support:localbroadcastmanager') using module('androidx.localbroadcastmanager:localbroadcastmanager:1.0.0')
                substitute module('com.android.support:support-v4') using module('androidx.legacy:legacy-support-v4:1.0.0')
                substitute module('com.android.support:appcompat-v7') using module('androidx.appcompat:appcompat:1.7.0')
                substitute module('com.android.support:recyclerview-v7') using module('androidx.recyclerview:recyclerview:1.3.2')
                substitute module('com.android.support:cardview-v7') using module('androidx.cardview:cardview:1.0.0')
                substitute module('com.android.support:support-fragment') using module('androidx.fragment:fragment:1.8.5')
                substitute module('com.android.support:support-core-utils') using module('androidx.legacy:legacy-support-core-utils:1.0.0')
                substitute module('com.android.support:support-core-ui') using module('androidx.legacy:legacy-support-core-ui:1.0.0')
            }
            
            // Fail on version conflict to catch issues early
            failOnVersionConflict()
            
            // Force refresh of all dependencies
            cacheDynamicVersionsFor 0, 'seconds'
            cacheChangingModulesFor 0, 'seconds'
        }
    }
    
    // Apply to Android projects
    afterEvaluate { project ->
        if (project.hasProperty('android')) {
            project.android {
                compileSdkVersion rootProject.ext.compileSdkVersion
                buildToolsVersion rootProject.ext.buildToolsVersion
                
                defaultConfig {
                    minSdkVersion rootProject.ext.minSdkVersion
                    targetSdkVersion rootProject.ext.targetSdkVersion
                }
                
                // Comprehensive packaging options
                packagingOptions {
                    // Exclude ALL META-INF version files that cause conflicts
                    exclude 'META-INF/androidx.localbroadcastmanager_localbroadcastmanager.version'
                    exclude 'META-INF/androidx.core_core.version'
                    exclude 'META-INF/androidx.versionedparcelable_versionedparcelable.version'
                    exclude 'META-INF/androidx.legacy_legacy-support-core-utils.version'
                    exclude 'META-INF/androidx.legacy_legacy-support-core-ui.version'
                    exclude 'META-INF/androidx.fragment_fragment.version'
                    exclude 'META-INF/androidx.media_media.version'
                    exclude 'META-INF/androidx.vectordrawable_vectordrawable-animated.version'
                    exclude 'META-INF/androidx.vectordrawable_vectordrawable.version'
                    exclude 'META-INF/androidx.appcompat_appcompat.version'
                    exclude 'META-INF/androidx.recyclerview_recyclerview.version'
                    exclude 'META-INF/androidx.cardview_cardview.version'
                    exclude 'META-INF/com.google.android.material_material.version'
                    exclude 'META-INF/androidx.lifecycle_lifecycle-runtime.version'
                    exclude 'META-INF/androidx.lifecycle_lifecycle-viewmodel.version'
                    exclude 'META-INF/androidx.lifecycle_lifecycle-livedata.version'
                    exclude 'META-INF/androidx.arch.core_core-runtime.version'
                    
                    // Exclude support library META-INF files
                    exclude 'META-INF/com.android.support_support-compat.version'
                    exclude 'META-INF/com.android.support_versionedparcelable.version'
                    exclude 'META-INF/com.android.support_localbroadcastmanager.version'
                    exclude 'META-INF/com.android.support_support-v4.version'
                    exclude 'META-INF/com.android.support_appcompat-v7.version'
                    exclude 'META-INF/com.android.support_recyclerview-v7.version'
                    exclude 'META-INF/com.android.support_cardview-v7.version'
                    
                    // Exclude other problematic META-INF files
                    exclude 'META-INF/DEPENDENCIES'
                    exclude 'META-INF/LICENSE'
                    exclude 'META-INF/LICENSE.txt'
                    exclude 'META-INF/license.txt'
                    exclude 'META-INF/NOTICE'
                    exclude 'META-INF/NOTICE.txt'
                    exclude 'META-INF/notice.txt'
                    exclude 'META-INF/ASL2.0'
                    exclude 'META-INF/INDEX.LIST'
                    exclude 'META-INF/MANIFEST.MF'
                    exclude 'META-INF/*.version'
                    
                    // Pick first for native libraries
                    pickFirst '**/libc++_shared.so'
                    pickFirst '**/libjsc.so'
                    pickFirst '**/libreactnativejni.so'
                    pickFirst '**/libfbjni.so'
                    pickFirst '**/libglog.so'
                    pickFirst '**/libhermes.so'
                    pickFirst '**/libyoga.so'
                    
                    // Pick first for ALL duplicate classes
                    pickFirst 'android/support/v4/**'
                    pickFirst 'androidx/core/**'
                    pickFirst 'androidx/versionedparcelable/**'
                    pickFirst 'androidx/localbroadcastmanager/**'
                    pickFirst 'androidx/legacy/**'
                    pickFirst 'androidx/appcompat/**'
                    pickFirst 'androidx/fragment/**'
                    pickFirst 'androidx/recyclerview/**'
                    pickFirst 'androidx/cardview/**'
                }
            }
            
            // Force AndroidX dependencies
            project.dependencies {
                implementation 'androidx.core:core:1.16.0'
                implementation 'androidx.versionedparcelable:versionedparcelable:1.1.1'
                implementation 'androidx.localbroadcastmanager:localbroadcastmanager:1.0.0'
                implementation 'androidx.appcompat:appcompat:1.7.0'
                implementation 'androidx.legacy:legacy-support-v4:1.0.0'
                implementation 'androidx.fragment:fragment:1.8.5'
                implementation 'androidx.recyclerview:recyclerview:1.3.2'
                implementation 'androidx.cardview:cardview:1.0.0'
                
                // Global exclusions for all configurations
                configurations.all {
                    exclude group: 'com.android.support'
                    exclude group: 'android.arch.lifecycle'
                    exclude group: 'android.arch.core'
                }
            }
        }
    }
}

// Verification task
task verifyEASBuildDependencies {
    doLast {
        println "🔍 EAS Build: Verifying dependency resolution..."
        def supportLibraryFound = false
        
        configurations.all { config ->
            try {
                config.resolvedConfiguration.resolvedArtifacts.each { artifact ->
                    def groupId = artifact.moduleVersion.id.group
                    if (groupId.startsWith('com.android.support') || 
                        groupId.startsWith('android.arch.')) {
                        println "❌ ERROR: Found support library: \${artifact.moduleVersion.id}"
                        supportLibraryFound = true
                    }
                }
            } catch (Exception e) {
                println "⚠️ Warning: Could not verify configuration \${config.name}: \${e.message}"
            }
        }
        
        if (supportLibraryFound) {
            throw new GradleException("❌ EAS Build FAILED: Support libraries detected!")
        } else {
            println "✅ EAS Build: SUCCESS - AndroidX-only dependencies confirmed"
        }
    }
}

// Make verification run before build tasks
tasks.whenTaskAdded { task ->
    if (task.name.contains('assemble') || task.name.contains('bundle')) {
        task.dependsOn verifyEASBuildDependencies
    }
}

println "✅ EAS Build: Comprehensive AndroidX exclusions applied"
`;

  try {
    // Ensure eas-hooks directory exists
    const easHooksDir = path.join(process.cwd(), 'eas-hooks');
    if (!fs.existsSync(easHooksDir)) {
      fs.mkdirSync(easHooksDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(process.cwd(), 'eas-comprehensive-exclusions.gradle'), gradleScript.trim());
    console.log('✅ Created comprehensive EAS Gradle exclusion script');
  } catch (error) {
    console.error('❌ Failed to create Gradle script:', error.message);
  }
}

// Clean all caches and force fresh dependency resolution
function cleanAllCaches() {
  console.log('🧹 Cleaning all caches for fresh dependency resolution...');
  
  // Clean npm cache
  safeExec('npm cache clean --force');
  
  // Remove package-lock.json
  const packageLockPath = path.join(process.cwd(), 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    try {
      fs.unlinkSync(packageLockPath);
      console.log('✅ Removed package-lock.json');
    } catch (error) {
      console.warn('Could not remove package-lock.json:', error.message);
    }
  }
  
  // Remove yarn.lock if it exists
  const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
  if (fs.existsSync(yarnLockPath)) {
    try {
      fs.unlinkSync(yarnLockPath);
      console.log('✅ Removed yarn.lock');
    } catch (error) {
      console.warn('Could not remove yarn.lock:', error.message);
    }
  }
}

// Set EAS environment variables
function setEASEnvironmentVariables() {
  console.log('🌍 Setting EAS environment variables...');
  
  const easEnvVars = {
    'ANDROID_USE_ANDROIDX': 'true',
    'ANDROID_ENABLE_JETIFIER': 'false',
    'GRADLE_OPTS': '-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs="-Xmx6g -XX:MaxMetaspaceSize=1g" -Dorg.gradle.parallel=false',
    'EAS_BUILD_ANDROID_EXCLUDE_SUPPORT': 'true',
    'EAS_BUILD_FORCE_ANDROIDX': 'true',
    'ANDROID_FORCE_ANDROIDX_ONLY': 'true',
    'ANDROID_REJECT_SUPPORT_LIBRARIES': 'true',
    'ANDROID_DEPENDENCY_FORCE_REPLACE': 'true',
    'ANDROID_DEPENDENCY_FAIL_ON_CONFLICT': 'true'
  };
  
  Object.entries(easEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
    console.log(`Set ${key}=${value}`);
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 EAS Pre-Build Hook: Starting...');
    
    // Set environment variables first
    setEASEnvironmentVariables();
    
    // Clean all caches
    cleanAllCaches();
    
    // Create comprehensive Gradle script
    createEASGradleScript();
    
    console.log('✅ EAS Pre-Build Hook completed successfully!');
    console.log('🎯 Ready for AndroidX-only EAS build');
    
  } catch (error) {
    console.error('❌ EAS Pre-Build Hook failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();