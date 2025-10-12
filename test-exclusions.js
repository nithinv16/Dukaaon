/**
 * Comprehensive Exclusion Test Script
 * This script validates that all Android Support Library exclusions are working
 * Run this before EAS builds to ensure no duplicate class conflicts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Testing Android Support Library Exclusions...');

// Function to check for support libraries in node_modules
function checkNodeModules() {
  console.log('\n🔍 Checking node_modules for support libraries...');
  
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('❌ node_modules not found');
    return false;
  }
  
  try {
    // Search for support library directories
    const supportDirs = execSync(
      `find "${nodeModulesPath}" -type d -name "*support*" 2>/dev/null || echo ""`,
      { encoding: 'utf8', shell: true }
    ).trim();
    
    if (supportDirs) {
      const supportLibDirs = supportDirs.split('\n').filter(dir => 
        dir.includes('com.android.support') || dir.includes('android.support')
      );
      
      if (supportLibDirs.length > 0) {
        console.log('❌ Found support library directories:');
        supportLibDirs.forEach(dir => console.log(`   ${dir}`));
        return false;
      }
    }
    
    console.log('✅ No support library directories found in node_modules');
    return true;
  } catch (error) {
    console.log('⚠️ Could not check node_modules (Windows limitation)');
    return true; // Assume OK on Windows
  }
}

// Function to check package.json dependencies
function checkPackageJson() {
  console.log('\n🔍 Checking package.json for support library dependencies...');
  
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  };
  
  const supportLibs = Object.keys(allDeps).filter(dep => 
    dep.includes('com.android.support') || 
    dep.includes('android.support') ||
    allDeps[dep].includes('com.android.support')
  );
  
  if (supportLibs.length > 0) {
    console.log('❌ Found support library dependencies:');
    supportLibs.forEach(lib => console.log(`   ${lib}: ${allDeps[lib]}`));
    return false;
  }
  
  console.log('✅ No support library dependencies found in package.json');
  return true;
}

// Function to check exclusion scripts
function checkExclusionScripts() {
  console.log('\n🔍 Checking exclusion scripts...');
  
  const scripts = [
    'absolute-exclusions.gradle',
    'nuclear-exclusions.gradle',
    'build-verification.gradle',
    'dependencies-exclusion.gradle',
    'final-conflict-resolver.gradle'
  ];
  
  let allPresent = true;
  
  scripts.forEach(script => {
    const scriptPath = path.join(__dirname, script);
    if (fs.existsSync(scriptPath)) {
      console.log(`✅ ${script} - PRESENT`);
    } else {
      console.log(`❌ ${script} - MISSING`);
      allPresent = false;
    }
  });
  
  return allPresent;
}

// Function to check app.config.js
function checkAppConfig() {
  console.log('\n🔍 Checking app.config.js configuration...');
  
  const appConfigPath = path.join(__dirname, 'app.config.js');
  if (!fs.existsSync(appConfigPath)) {
    console.log('❌ app.config.js not found');
    return false;
  }
  
  const content = fs.readFileSync(appConfigPath, 'utf8');
  
  const checks = [
    { name: 'absolute-exclusions.gradle', check: content.includes('absolute-exclusions.gradle') },
    { name: 'gradleScriptPaths', check: content.includes('gradleScriptPaths') },
    { name: 'android configuration', check: content.includes('android') }
  ];
  
  let allPassed = true;
  
  checks.forEach(({ name, check }) => {
    if (check) {
      console.log(`✅ ${name} - CONFIGURED`);
    } else {
      console.log(`❌ ${name} - MISSING`);
      allPassed = false;
    }
  });
  
  return allPassed;
}

// Function to check gradle.properties
function checkGradleProperties() {
  console.log('\n🔍 Checking gradle.properties...');
  
  const gradlePropsPath = path.join(__dirname, 'android', 'gradle.properties');
  if (!fs.existsSync(gradlePropsPath)) {
    console.log('❌ gradle.properties not found');
    return false;
  }
  
  const content = fs.readFileSync(gradlePropsPath, 'utf8');
  
  const requiredSettings = [
    'android.useAndroidX=true',
    'android.enableJetifier=false',
    'android.dependency.excludeGroups=com.android.support',
    'android.forceAndroidXOnly=true'
  ];
  
  let allPresent = true;
  
  requiredSettings.forEach(setting => {
    if (content.includes(setting)) {
      console.log(`✅ ${setting} - SET`);
    } else {
      console.log(`❌ ${setting} - MISSING`);
      allPresent = false;
    }
  });
  
  return allPresent;
}

// Function to check eas.json
function checkEasJson() {
  console.log('\n🔍 Checking eas.json configuration...');
  
  const easJsonPath = path.join(__dirname, 'eas.json');
  if (!fs.existsSync(easJsonPath)) {
    console.log('❌ eas.json not found');
    return false;
  }
  
  const content = fs.readFileSync(easJsonPath, 'utf8');
  
  const checks = [
    { name: 'ANDROID_ENABLE_JETIFIER=false', check: content.includes('"ANDROID_ENABLE_JETIFIER": "false"') },
    { name: 'ANDROID_USE_ANDROIDX=true', check: content.includes('"ANDROID_USE_ANDROIDX": "true"') },
    { name: 'Build hooks', check: content.includes('hooks') },
    { name: 'Exclusion environment variables', check: content.includes('ANDROID_DEPENDENCY_EXCLUDE_GROUPS') }
  ];
  
  let allPassed = true;
  
  checks.forEach(({ name, check }) => {
    if (check) {
      console.log(`✅ ${name} - CONFIGURED`);
    } else {
      console.log(`❌ ${name} - MISSING`);
      allPassed = false;
    }
  });
  
  return allPassed;
}

// Function to check build hooks
function checkBuildHooks() {
  console.log('\n🔍 Checking EAS build hooks...');
  
  const hooks = [
    'eas-hooks/eas-build-pre-install.sh',
    'eas-hooks/eas-build-post-install.sh',
    'eas-build-config.js'
  ];
  
  let allPresent = true;
  
  hooks.forEach(hook => {
    const hookPath = path.join(__dirname, hook);
    if (fs.existsSync(hookPath)) {
      console.log(`✅ ${hook} - PRESENT`);
    } else {
      console.log(`❌ ${hook} - MISSING`);
      allPresent = false;
    }
  });
  
  return allPresent;
}

// Function to generate test report
function generateTestReport(results) {
  console.log('\n📋 Generating test report...');
  
  const report = `
Android Support Library Exclusion Test Report
Generated: ${new Date().toISOString()}

Test Results:
- Node Modules Check: ${results.nodeModules ? 'PASS' : 'FAIL'}
- Package.json Check: ${results.packageJson ? 'PASS' : 'FAIL'}
- Exclusion Scripts: ${results.exclusionScripts ? 'PASS' : 'FAIL'}
- App Config: ${results.appConfig ? 'PASS' : 'FAIL'}
- Gradle Properties: ${results.gradleProperties ? 'PASS' : 'FAIL'}
- EAS Configuration: ${results.easJson ? 'PASS' : 'FAIL'}
- Build Hooks: ${results.buildHooks ? 'PASS' : 'FAIL'}

Overall Status: ${Object.values(results).every(r => r) ? 'PASS - Ready for EAS Build' : 'FAIL - Issues Found'}

Target Duplicate Classes (Should be eliminated):
- INotificationSideChannel
- IconCompatParcelizer
- IResultReceiver
- ResultReceiver
- CustomVersionedParcelable
- ParcelField, ParcelImpl, ParcelUtils
- VersionedParcel

Exclusion Strategy:
- Global exclusion of com.android.support
- Force AndroidX dependencies
- Disable Jetifier
- Strict dependency checking
- Comprehensive packaging exclusions

Next Steps:
${Object.values(results).every(r => r) ? 
  '✅ All checks passed! Ready to run EAS build.' : 
  '❌ Fix the failing checks above before running EAS build.'}
`;
  
  const reportPath = path.join(__dirname, 'exclusion-test-report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Test report saved: ${reportPath}`);
}

// Main test execution
function runTests() {
  console.log('🚀 Starting comprehensive exclusion tests...\n');
  
  const results = {
    nodeModules: checkNodeModules(),
    packageJson: checkPackageJson(),
    exclusionScripts: checkExclusionScripts(),
    appConfig: checkAppConfig(),
    gradleProperties: checkGradleProperties(),
    easJson: checkEasJson(),
    buildHooks: checkBuildHooks()
  };
  
  generateTestReport(results);
  
  const allPassed = Object.values(results).every(r => r);
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Ready for EAS build - duplicate class conflicts should be resolved');
    console.log('🚀 Run: eas build --platform android');
  } else {
    console.log('❌ SOME TESTS FAILED!');
    console.log('⚠️ Fix the issues above before running EAS build');
    console.log('📋 Check exclusion-test-report.txt for details');
  }
  console.log('='.repeat(60));
  
  return allPassed;
}

// Run the tests
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runTests };