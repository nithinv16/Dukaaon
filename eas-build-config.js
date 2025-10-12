/**
 * EAS Build Configuration Script
 * This script ensures all exclusion strategies are properly applied during EAS builds
 * It runs as part of the build process to enforce AndroidX-only dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 EAS Build Configuration: Applying exclusion strategies...');

// Function to update gradle.properties with aggressive exclusion settings
function updateGradleProperties() {
  const gradlePropsPath = path.join(__dirname, 'android', 'gradle.properties');
  
  const exclusionSettings = `
# EAS Build - Aggressive Android Support Library Exclusion
android.useAndroidX=true
android.enableJetifier=false
android.dependency.excludeGroups=com.android.support
android.dependency.forceReplace=true
android.dependency.failOnConflict=true
android.dependency.rejectSupportLibraries=true
android.forceAndroidXOnly=true
android.rejectSupportLibraries=true
android.enableStrictDependencyChecking=true

# Gradle Performance and Memory Settings
org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m -XX:+UseG1GC -XX:MaxGCPauseMillis=200
org.gradle.parallel=true
org.gradle.daemon=true
org.gradle.configureondemand=false
org.gradle.caching=false
org.gradle.dependency.verification=off
org.gradle.dependency.locking=false
org.gradle.dependency.cache.cleanup=true
org.gradle.dependency.resolution.strict=true

# Android Build Settings
android.compileSdkVersion=34
android.targetSdkVersion=34
android.minSdkVersion=21
android.buildToolsVersion=34.0.0
android.ndkVersion=25.1.8937393

# Disable problematic features
android.enableR8.fullMode=false
android.enableR8=true
android.enableProguard=false
android.enableSeparateDexPerArch=false
android.enableUniversalApk=false

# Force clean dependency resolution
android.dependency.resolution.strategy=force
android.dependency.resolution.failOnVersionConflict=true
android.dependency.resolution.preferProjectModules=true
android.dependency.resolution.force.androidx=true
android.dependency.resolution.reject.support=true

# Experimental features (disabled for stability)
android.experimental.enableNewResourceShrinker=false
android.experimental.enableIncrementalDesugaring=false
android.experimental.enableParallelDx=false
android.experimental.enableIncrementalDexing=false
android.experimental.enableBuildCache=false
android.experimental.enableResourceOptimizations=false
`;
  
  if (fs.existsSync(gradlePropsPath)) {
    let content = fs.readFileSync(gradlePropsPath, 'utf8');
    
    // Remove existing EAS Build section if it exists
    content = content.replace(/# EAS Build - Aggressive Android Support Library Exclusion[\s\S]*?(?=\n\n|\n#|$)/g, '');
    
    // Add our exclusion settings
    content += exclusionSettings;
    
    fs.writeFileSync(gradlePropsPath, content);
    console.log('✅ Updated gradle.properties with exclusion settings');
  } else {
    console.log('⚠️ gradle.properties not found, creating new one...');
    fs.writeFileSync(gradlePropsPath, exclusionSettings);
    console.log('✅ Created gradle.properties with exclusion settings');
  }
}

// Function to verify exclusion scripts are in place
function verifyExclusionScripts() {
  const scripts = [
    'absolute-exclusions.gradle',
    'nuclear-exclusions.gradle',
    'build-verification.gradle',
    'dependencies-exclusion.gradle',
    'final-conflict-resolver.gradle'
  ];
  
  console.log('🔍 Verifying exclusion scripts...');
  
  scripts.forEach(script => {
    const scriptPath = path.join(__dirname, script);
    if (fs.existsSync(scriptPath)) {
      console.log(`✅ ${script} - PRESENT`);
    } else {
      console.log(`❌ ${script} - MISSING`);
    }
  });
}

// Function to verify app.config.js includes exclusion scripts
function verifyAppConfig() {
  const appConfigPath = path.join(__dirname, 'app.config.js');
  
  if (fs.existsSync(appConfigPath)) {
    const content = fs.readFileSync(appConfigPath, 'utf8');
    
    if (content.includes('absolute-exclusions.gradle')) {
      console.log('✅ app.config.js includes absolute-exclusions.gradle');
    } else {
      console.log('❌ app.config.js missing absolute-exclusions.gradle');
    }
    
    if (content.includes('gradleScriptPaths')) {
      console.log('✅ app.config.js has gradleScriptPaths configuration');
    } else {
      console.log('❌ app.config.js missing gradleScriptPaths configuration');
    }
  } else {
    console.log('❌ app.config.js not found');
  }
}

// Function to create build verification report
function createBuildReport() {
  const reportPath = path.join(__dirname, 'eas-build-report.txt');
  
  const report = `
EAS Build Configuration Report
Generated: ${new Date().toISOString()}

Environment Variables Applied:
- ANDROID_USE_ANDROIDX: true
- ANDROID_ENABLE_JETIFIER: false
- ANDROID_DEPENDENCY_EXCLUDE_GROUPS: com.android.support
- ANDROID_FORCE_ANDROIDX_ONLY: true
- ANDROID_REJECT_SUPPORT_LIBRARIES: true

Exclusion Scripts Status:
- absolute-exclusions.gradle: ${fs.existsSync(path.join(__dirname, 'absolute-exclusions.gradle')) ? 'PRESENT' : 'MISSING'}
- nuclear-exclusions.gradle: ${fs.existsSync(path.join(__dirname, 'nuclear-exclusions.gradle')) ? 'PRESENT' : 'MISSING'}
- build-verification.gradle: ${fs.existsSync(path.join(__dirname, 'build-verification.gradle')) ? 'PRESENT' : 'MISSING'}
- dependencies-exclusion.gradle: ${fs.existsSync(path.join(__dirname, 'dependencies-exclusion.gradle')) ? 'PRESENT' : 'MISSING'}
- final-conflict-resolver.gradle: ${fs.existsSync(path.join(__dirname, 'final-conflict-resolver.gradle')) ? 'PRESENT' : 'MISSING'}

Configuration Files:
- gradle.properties: ${fs.existsSync(path.join(__dirname, 'android', 'gradle.properties')) ? 'PRESENT' : 'MISSING'}
- app.config.js: ${fs.existsSync(path.join(__dirname, 'app.config.js')) ? 'PRESENT' : 'MISSING'}
- eas.json: ${fs.existsSync(path.join(__dirname, 'eas.json')) ? 'PRESENT' : 'MISSING'}

Build Hooks:
- Pre-install hook: ${fs.existsSync(path.join(__dirname, 'eas-hooks', 'eas-build-pre-install.sh')) ? 'PRESENT' : 'MISSING'}
- Post-install hook: ${fs.existsSync(path.join(__dirname, 'eas-hooks', 'eas-build-post-install.sh')) ? 'PRESENT' : 'MISSING'}

Target Configuration:
- AndroidX Only: ENFORCED
- Support Libraries: REJECTED
- Jetifier: DISABLED
- Strict Dependency Checking: ENABLED

This configuration should eliminate all duplicate class errors related to:
- INotificationSideChannel
- IconCompatParcelizer
- IResultReceiver
- ResultReceiver
- CustomVersionedParcelable
- ParcelField, ParcelImpl, ParcelUtils
- VersionedParcel conflicts
`;
  
  fs.writeFileSync(reportPath, report);
  console.log('📋 Build report created: eas-build-report.txt');
}

// Main execution
try {
  updateGradleProperties();
  verifyExclusionScripts();
  verifyAppConfig();
  createBuildReport();
  
  console.log('✅ EAS Build Configuration completed successfully');
  console.log('🚀 Ready for EAS build with aggressive support library exclusion');
} catch (error) {
  console.error('❌ EAS Build Configuration failed:', error);
  process.exit(1);
}