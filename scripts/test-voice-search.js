/**
 * Voice Search Diagnostic Script
 * Run this to test Azure Speech Service configuration
 */

const readline = require('readline');

console.log('\n=== Azure Speech Service Diagnostic Tool ===\n');

// Test 1: Check environment variables
console.log('1. Checking environment variables...');
const speechKey = process.env.EXPO_PUBLIC_AZURE_SPEECH_KEY;
const speechRegion = process.env.EXPO_PUBLIC_AZURE_SPEECH_REGION;

if (!speechKey || speechKey.includes('your_') || speechKey === '') {
  console.error('❌ EXPO_PUBLIC_AZURE_SPEECH_KEY is not set or invalid');
  console.log('   Please add it to your .env file');
} else {
  console.log('✅ EXPO_PUBLIC_AZURE_SPEECH_KEY is configured');
  console.log('   Key starts with:', speechKey.substring(0, 10) + '...');
}

if (!speechRegion || speechRegion.includes('your_') || speechRegion === '') {
  console.error('❌ EXPO_PUBLIC_AZURE_SPEECH_REGION is not set or invalid');
  console.log('   Please add it to your .env file');
} else {
  console.log('✅ EXPO_PUBLIC_AZURE_SPEECH_REGION is configured:', speechRegion);
}

// Test 2: Check crypto availability
console.log('\n2. Checking crypto.getRandomValues availability...');
if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
  console.log('✅ crypto.getRandomValues is available');
} else {
  console.error('❌ crypto.getRandomValues is NOT available');
  console.log('   Make sure react-native-get-random-values is imported in your app entry point');
}

// Test 3: Instructions for microphone permissions
console.log('\n3. Microphone Permissions Check:');
console.log('   For Android:');
console.log('   - Add to android/app/src/main/AndroidManifest.xml:');
console.log('     <uses-permission android:name="android.permission.RECORD_AUDIO" />');
console.log('     <uses-permission android:name="android.permission.INTERNET" />');
console.log('\n   For iOS:');
console.log('   - Add to ios/YourApp/Info.plist:');
console.log('     <key>NSMicrophoneUsageDescription</key>');
console.log('     <string>We need access to your microphone for voice search</string>');

// Test 4: Check if running in supported environment
console.log('\n4. Environment Check:');
console.log('   Platform: React Native');
console.log('   Note: Azure Speech SDK has limited support in React Native');
console.log('   You may need to run on a physical device for best results');

console.log('\n=== Diagnostic Complete ===\n');
console.log('Common Issues and Solutions:');
console.log('1. If speech recognition doesn\'t start:');
console.log('   - Check microphone permissions in device settings');
console.log('   - Ensure app has been granted audio recording permissions');
console.log('   - Try running on a physical device instead of emulator');
console.log('\n2. If you see "Cannot set property speechRecognitionLanguage of null":');
console.log('   - This has been fixed in the latest code');
console.log('   - Restart your app to load the new code');
console.log('\n3. If microphone doesn\'t activate:');
console.log('   - The Azure Speech SDK may not fully support React Native');
console.log('   - Consider using Expo\'s Audio API as a fallback');
console.log('   - Or use the web version for full speech recognition support');

console.log('\n');
