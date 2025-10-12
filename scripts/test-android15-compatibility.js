#!/usr/bin/env node

/**
 * Android 15 Compatibility Testing Script
 * 
 * This script helps verify that the app is properly configured for Android 15
 * and addresses the Google Play Console recommendations.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      log(`✅ ${description}`, 'green');
      return true;
    } else {
      log(`❌ ${description}`, 'red');
      return false;
    }
  } else {
    log(`❌ File not found: ${filePath}`, 'red');
    return false;
  }
}

function runCompatibilityChecks() {
  log('\n🔍 Android 15 Compatibility Check', 'bold');
  log('=====================================\n', 'blue');

  let passedChecks = 0;
  let totalChecks = 0;

  // Check 1: Target SDK Version
  totalChecks++;
  if (checkFileContent('app.config.js', '"targetSdkVersion": 35', 'Target SDK 35 configured')) {
    passedChecks++;
  }

  // Check 2: Compile SDK Version
  totalChecks++;
  if (checkFileContent('app.config.js', '"compileSdkVersion": 35', 'Compile SDK 35 configured')) {
    passedChecks++;
  }

  // Check 3: Edge-to-edge utilities
  totalChecks++;
  if (checkFile('utils/android15EdgeToEdge.tsx', 'Edge-to-edge utilities exist')) {
    passedChecks++;
  }

  // Check 4: Gradle properties for 16KB support
  totalChecks++;
  if (checkFileContent('gradle.properties', 'android.bundle.enableUncompressedNativeLibs=false', '16KB page size support in gradle.properties')) {
    passedChecks++;
  }

  // Check 5: Edge-to-edge enabled in gradle
  totalChecks++;
  if (checkFileContent('gradle.properties', 'android.enableEdgeToEdge=true', 'Edge-to-edge enabled in gradle.properties')) {
    passedChecks++;
  }

  // Check 6: Android 15 plugin
  totalChecks++;
  if (checkFileContent('app.plugin.js', 'withAndroid15Compatibility', 'Android 15 compatibility plugin exists')) {
    passedChecks++;
  }

  // Check 7: Manifest placeholder for edge-to-edge
  totalChecks++;
  if (checkFileContent('app.config.js', '"enableEdgeToEdge": "true"', 'Edge-to-edge manifest placeholder configured')) {
    passedChecks++;
  }

  // Check 8: Safe area context dependency
  totalChecks++;
  if (checkFileContent('package.json', 'react-native-safe-area-context', 'Safe area context dependency exists')) {
    passedChecks++;
  }

  // Check 9: Migration guide exists
  totalChecks++;
  if (checkFile('ANDROID_15_MIGRATION_GUIDE.md', 'Android 15 migration guide exists')) {
    passedChecks++;
  }

  // Check 10: Build tools version
  totalChecks++;
  if (checkFileContent('app.config.js', '"buildToolsVersion": "35.0.0"', 'Build tools version 35.0.0 configured')) {
    passedChecks++;
  }

  // Summary
  log('\n📊 Compatibility Check Summary', 'bold');
  log('===============================\n', 'blue');
  
  const percentage = Math.round((passedChecks / totalChecks) * 100);
  const color = percentage >= 90 ? 'green' : percentage >= 70 ? 'yellow' : 'red';
  
  log(`Passed: ${passedChecks}/${totalChecks} (${percentage}%)`, color);
  
  if (percentage >= 90) {
    log('\n🎉 Excellent! Your app is well-configured for Android 15.', 'green');
  } else if (percentage >= 70) {
    log('\n⚠️  Good progress, but some improvements needed.', 'yellow');
  } else {
    log('\n🚨 Significant work needed for Android 15 compatibility.', 'red');
  }

  // Recommendations
  log('\n💡 Next Steps:', 'bold');
  log('==============\n', 'blue');
  
  if (passedChecks < totalChecks) {
    log('1. Address the failed checks above', 'yellow');
    log('2. Test edge-to-edge on various screen sizes', 'yellow');
    log('3. Test on Android 15 devices if available', 'yellow');
    log('4. Monitor for deprecated API warnings', 'yellow');
  } else {
    log('1. Test edge-to-edge on various screen sizes', 'green');
    log('2. Test on Android 15 devices if available', 'green');
    log('3. Monitor app performance with 16KB page sizes', 'green');
    log('4. Submit to Google Play Console for validation', 'green');
  }

  log('\n📚 Resources:', 'bold');
  log('=============\n', 'blue');
  log('• Android 15 Migration Guide: ./ANDROID_15_MIGRATION_GUIDE.md');
  log('• Edge-to-edge Utilities: ./utils/android15EdgeToEdge.tsx');
  log('• Google Play Console: https://play.google.com/console');
  log('• Android 15 Documentation: https://developer.android.com/about/versions/15\n');
}

// Run the checks
runCompatibilityChecks();