// Custom plugin to add Node.js polyfills and Android queries for UPI apps

const { withDangerousMod, withAndroidManifest } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNodeModulesPolyfill = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // Create patched modules directory if it doesn't exist
      const patchedDir = path.join(config.modRequest.projectRoot, 'patched-modules');
      if (!fs.existsSync(patchedDir)) {
        fs.mkdirSync(patchedDir, { recursive: true });
      }

      // Create a patched version of the ws module
      const wsStreamPatch = `
'use strict';

// This is a patched version that uses stream-browserify instead of Node.js stream
const Stream = require('stream-browserify');

/**
 * Emits the \`'close'\` event on a stream.
 *
 * @param {Stream.Duplex} stream The stream.
 * @private
 */
function emitClose(stream) {
  stream.emit('close');
}

/**
 * Creates a duplex stream.
 *
 * @param {WebSocket} ws The WebSocket instance
 * @param {Object} options The options for the duplex stream
 * @returns {Stream.Duplex} The duplex stream
 * @public
 */
function createWebSocketStream(ws, options) {
  let resumeOnReceiverDrain = true;
  let terminateOnDestroy = true;

  function receiverOnDrain() {
    if (resumeOnReceiverDrain) ws._socket.resume();
  }

  if (ws.readyState === ws.CONNECTING) {
    resumeOnReceiverDrain = false;
    ws.once('open', function open() {
      resumeOnReceiverDrain = true;
      if (stream.readable) ws.receiver.on('drain', receiverOnDrain);
    });
  } else {
    if (ws.receiver) ws.receiver.on('drain', receiverOnDrain);
  }

  const stream = new Stream.Duplex({
    ...options,
    autoDestroy: false,
    emitClose: false,
    objectMode: false,
    writableObjectMode: false
  });

  ws.on('message', function message(msg, isBinary) {
    const data = !isBinary && stream._readableState.objectMode ? msg : msg;

    if (!stream.push(data)) ws._socket.pause();
  });

  ws.once('error', function error(err) {
    if (stream.destroyed) return;

    stream.destroy(err);
  });

  ws.once('close', function close() {
    if (stream.destroyed) return;

    stream.push(null);
  });

  stream._read = function read() {
    if (ws.receiver) ws._socket.resume();
  };

  stream._write = function write(chunk, encoding, callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._write(chunk, encoding, callback);
      });
      return;
    }

    try {
      const binary = !(chunk instanceof Buffer);
      const result = ws.send(chunk, { binary });
      
      if (typeof result !== 'undefined' && !result) {
        ws._sender.once('drain', callback);
        return;
      }
    } catch (error) {
      callback(error);
      return;
    }

    callback();
  };

  stream._final = function final(callback) {
    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._final(callback);
      });
      return;
    }

    if (ws._socket === null) return callback();

    try {
      ws.close();
    } catch (error) {
      callback(error);
      return;
    }

    if (terminateOnDestroy) {
      const timeout = setTimeout(function() {
        callback(new Error('WebSocket was not closed within timeout'));
      }, 30 * 1000);

      ws.once('close', function close() {
        clearTimeout(timeout);
        callback();
      });
      return;
    }

    callback();
  };

  stream._destroy = function destroy(err, callback) {
    if (ws._socket === null) {
      callback(err);
      process.nextTick(emitClose, stream);
      return;
    }

    if (ws.readyState === ws.CONNECTING) {
      ws.once('open', function open() {
        stream._destroy(err, callback);
      });
      return;
    }

    if (terminateOnDestroy && ws.readyState !== ws.CLOSED) {
      const timeout = setTimeout(function() {
        callback(new Error('WebSocket was not closed within timeout'));
      }, 30 * 1000);

      ws.once('close', function close() {
        clearTimeout(timeout);
        callback(err);
        process.nextTick(emitClose, stream);
      });

      try {
        ws.terminate();
      } catch (e) {
        clearTimeout(timeout);
        callback(e);
        process.nextTick(emitClose, stream);
      }
      return;
    }

    callback(err);
    process.nextTick(emitClose, stream);
  };

  return stream;
}

module.exports = createWebSocketStream;
      `;

      // Write the patched file
      const patchedWsStreamPath = path.join(patchedDir, 'patched-ws-stream.js');
      fs.writeFileSync(patchedWsStreamPath, wsStreamPatch);

      return config;
    },
  ]);
};



// Plugin to add EdgeToEdge.enable() to MainActivity and patch deprecated APIs
const withEdgeToEdgeEnable = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const mainActivityPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'sixn8',
        'dukaaon',
        'MainActivity.kt'
      );

      // Also check alternative path
      const altMainActivityPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'kotlin',
        'com',
        'sixn8',
        'dukaaon',
        'MainActivity.kt'
      );

      let mainActivityFile = null;
      if (fs.existsSync(mainActivityPath)) {
        mainActivityFile = mainActivityPath;
      } else if (fs.existsSync(altMainActivityPath)) {
        mainActivityFile = altMainActivityPath;
      }

      if (mainActivityFile) {
        let content = fs.readFileSync(mainActivityFile, 'utf8');

        // Check if EdgeToEdge.enable() is already added
        if (!content.includes('enableEdgeToEdge()') && !content.includes('EdgeToEdge.enable')) {
          // Add import for EdgeToEdge
          if (!content.includes('import androidx.activity.enableEdgeToEdge')) {
            // Find the package declaration and add import after it
            const packageMatch = content.match(/package\s+[\w.]+/);
            if (packageMatch) {
              const importStatement = `
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
`;
              content = content.replace(
                packageMatch[0],
                packageMatch[0] + importStatement
              );
            }
          }

          // Add EdgeToEdge.enable() call in onCreate, before super.onCreate()
          if (content.includes('override fun onCreate')) {
            // Find onCreate method and add EdgeToEdge.enable() at the start
            content = content.replace(
              /override\s+fun\s+onCreate\([^)]*\)\s*\{/,
              (match) => {
                return match + '\n    // Enable edge-to-edge for Android 15 compatibility\n    enableEdgeToEdge()\n    WindowCompat.setDecorFitsSystemWindows(window, false)';
              }
            );
          } else if (content.includes('fun onCreate')) {
            // Fallback if override keyword is missing
            content = content.replace(
              /fun\s+onCreate\([^)]*\)\s*\{/,
              (match) => {
                return match + '\n    // Enable edge-to-edge for Android 15 compatibility\n    enableEdgeToEdge()\n    WindowCompat.setDecorFitsSystemWindows(window, false)';
              }
            );
          }

          fs.writeFileSync(mainActivityFile, content, 'utf8');
          console.log('✅ Added EdgeToEdge.enable() to MainActivity.kt');
        } else {
          console.log('✅ EdgeToEdge.enable() already present in MainActivity.kt');
        }
      } else {
        // MainActivity doesn't exist yet - create it with edge-to-edge enabled
        // This ensures it's created correctly even if Expo hasn't generated it yet
        const kotlinDir = path.join(
          projectRoot,
          'android',
          'app',
          'src',
          'main',
          'kotlin',
          'com',
          'sixn8',
          'dukaaon'
        );

        // Ensure directory exists
        if (!fs.existsSync(kotlinDir)) {
          fs.mkdirSync(kotlinDir, { recursive: true });
        }

        const newMainActivityPath = path.join(kotlinDir, 'MainActivity.kt');
        const mainActivityContent = `package com.sixn8.dukaaon

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import expo.modules.splashscreen.SplashScreenManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})

  override fun onCreate(savedInstanceState: Bundle?) {
    // CRITICAL: Enable edge-to-edge BEFORE super.onCreate() for Android 15 compatibility
    // This addresses Google Play Console warnings about deprecated edge-to-edge APIs
    enableEdgeToEdge()
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    // Required for expo-splash-screen
    SplashScreenManager.registerOnActivity(this)
    
    super.onCreate(null)
  }
}
`;

        fs.writeFileSync(newMainActivityPath, mainActivityContent, 'utf8');
        console.log('✅ Created MainActivity.kt with EdgeToEdge.enable()');
      }

      return config;
    },
  ]);
};

// Android 15 compatibility plugin
const withAndroid15Compatibility = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Find the main activity
    const mainActivity = androidManifest.manifest.application[0].activity?.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (mainActivity) {
      // Remove orientation restrictions for large screen support
      delete mainActivity.$['android:screenOrientation'];

      // Add resizeableActivity for large screens
      mainActivity.$['android:resizeableActivity'] = 'true';

      // Enable edge-to-edge display
      mainActivity.$['android:windowSoftInputMode'] = 'adjustResize';

      // FORCE theme to use NoActionBar - always override to hide action bar
      mainActivity.$['android:theme'] = '@style/AppTheme';

      // Android 15 edge-to-edge by default
      mainActivity.$['android:enableOnBackInvokedCallback'] = 'true';

      console.log('✅ Set MainActivity theme to @style/AppTheme (NoActionBar)');
    }

    // Add application-level configurations
    const application = androidManifest.manifest.application[0];

    // FORCE application-level theme to use NoActionBar
    application.$['android:theme'] = '@style/AppTheme';
    console.log('✅ Set Application theme to @style/AppTheme (NoActionBar)');

    // Initialize activity array if it doesn't exist
    if (!application.activity) {
      application.activity = [];
    }

    // Note: ImagePickerActivity is not needed with react-native-image-picker
    // react-native-image-picker handles permissions internally

    // Enable 16KB page size support - critical for Android 15
    // Note: extractNativeLibs removed to avoid manifest merger conflicts

    // Add meta-data for Android 15 compatibility
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Add edge-to-edge meta-data
    application['meta-data'].push({
      $: {
        'android:name': 'android.window.PROPERTY_ACTIVITY_EMBEDDING_SPLITS_ENABLED',
        'android:value': 'true'
      }
    });

    // Add 16KB page size support meta-data
    application['meta-data'].push({
      $: {
        'android:name': 'android.app.lib_name',
        'android:value': 'dukaaon'
      }
    });

    // Add Android 15 compatibility meta-data
    application['meta-data'].push({
      $: {
        'android:name': 'android.window.PROPERTY_COMPAT_ALLOW_USER_ASPECT_RATIO_OVERRIDE',
        'android:value': 'true'
      }
    });

    // Add meta-data to address deprecated edge-to-edge APIs
    application['meta-data'].push({
      $: {
        'android:name': 'android.window.PROPERTY_COMPAT_ALLOW_EDGE_TO_EDGE_ENFORCEMENT',
        'android:value': 'true'
      }
    });

    // Add meta-data for system bar compatibility
    application['meta-data'].push({
      $: {
        'android:name': 'android.window.PROPERTY_COMPAT_ALLOW_SYSTEM_BAR_APPEARANCE_CONTROL',
        'android:value': 'true'
      }
    });

    console.log('Android 15 compatibility configurations applied with edge-to-edge API fixes');
    return config;
  });
};

// Plugin to explicitly add RECORD_AUDIO permission for microphone access
const withMicrophonePermission = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Ensure uses-permission array exists
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    const permissions = androidManifest.manifest['uses-permission'];

    // Check if RECORD_AUDIO permission already exists
    const hasRecordAudio = permissions.some(
      (perm) => perm.$['android:name'] === 'android.permission.RECORD_AUDIO'
    );

    if (!hasRecordAudio) {
      permissions.push({
        $: {
          'android:name': 'android.permission.RECORD_AUDIO',
        },
      });
      console.log('✅ Added RECORD_AUDIO permission to AndroidManifest');
    } else {
      console.log('✅ RECORD_AUDIO permission already present in AndroidManifest');
    }

    // Also add MODIFY_AUDIO_SETTINGS for better audio handling
    const hasModifyAudio = permissions.some(
      (perm) => perm.$['android:name'] === 'android.permission.MODIFY_AUDIO_SETTINGS'
    );

    if (!hasModifyAudio) {
      permissions.push({
        $: {
          'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS',
        },
      });
      console.log('✅ Added MODIFY_AUDIO_SETTINGS permission to AndroidManifest');
    }

    return config;
  });
};

// Android namespace conflict resolution plugin - also adds RECORD_AUDIO permission directly
const withAndroidNamespaceResolution = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(config.modRequest.platformProjectRoot, 'app/src/main/AndroidManifest.xml');

      if (fs.existsSync(manifestPath)) {
        let manifestContent = fs.readFileSync(manifestPath, 'utf8');

        // Only add tools namespace if not present - simple and safe modification
        if (!manifestContent.includes('xmlns:tools=')) {
          manifestContent = manifestContent.replace(
            '<manifest ',
            '<manifest xmlns:tools="http://schemas.android.com/tools" '
          );
          console.log('✅ Added tools namespace to AndroidManifest.xml');
        }

        // CRITICAL: Add RECORD_AUDIO permission directly to manifest if not present
        if (!manifestContent.includes('android.permission.RECORD_AUDIO')) {
          // Find the closing </manifest> tag or the first <application tag
          // and insert the permission before it
          const permissionLine = '    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n';

          if (manifestContent.includes('<application')) {
            manifestContent = manifestContent.replace(
              '<application',
              permissionLine + '    <application'
            );
          } else {
            manifestContent = manifestContent.replace(
              '</manifest>',
              permissionLine + '</manifest>'
            );
          }
          console.log('✅ Added RECORD_AUDIO permission directly to AndroidManifest.xml');
        } else {
          console.log('✅ RECORD_AUDIO permission already in AndroidManifest.xml');
        }

        // Also add MODIFY_AUDIO_SETTINGS if not present
        if (!manifestContent.includes('android.permission.MODIFY_AUDIO_SETTINGS')) {
          const permissionLine = '    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n';

          if (manifestContent.includes('<application')) {
            manifestContent = manifestContent.replace(
              '<application',
              permissionLine + '    <application'
            );
          }
          console.log('✅ Added MODIFY_AUDIO_SETTINGS permission directly to AndroidManifest.xml');
        }

        fs.writeFileSync(manifestPath, manifestContent);
      }

      return config;
    },
  ]);
};

// Note: react-native-image-picker provider configuration removed
// Now using expo-image-picker which handles providers automatically

const withAndroidResourceOverrides = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidResPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values');

      // Ensure the values directory exists
      if (!fs.existsSync(androidResPath)) {
        fs.mkdirSync(androidResPath, { recursive: true });
      }

      // Create attrs.xml to define gravity flags properly
      const attrsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Define gravity flags to prevent center_vertical string issues -->
    <integer name="gravity_center_vertical">16</integer> <!-- 0x10 -->
    <integer name="gravity_center">17</integer> <!-- 0x11 -->
    <integer name="gravity_center_horizontal">1</integer> <!-- 0x01 -->
    <integer name="gravity_center_combined">17</integer> <!-- 0x11 = center -->
</resources>`;

      fs.writeFileSync(path.join(androidResPath, 'attrs.xml'), attrsXml);

      // Create styles override to fix Material3 center_vertical issues
      const stylesOverrideXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Override Material3 styles that use raw center_vertical strings -->
    <style name="Widget.Material3Expressive.Toolbar.AppBarWithSearch" parent="Widget.Material3.Toolbar">
        <item name="buttonGravity">@integer/gravity_center_combined</item>
        <item name="android:layout_marginEnd">0dp</item>
        <item name="layout_scrollFlags">scroll|snap|enterAlways</item>
    </style>
    
    <!-- Override all Material3 toolbar styles -->
    <style name="Widget.Material3.Toolbar" parent="Widget.MaterialComponents.Toolbar">
        <item name="buttonGravity">@integer/gravity_center_combined</item>
    </style>
    
    <!-- Override Material3 AppBar styles -->
    <style name="Widget.Material3.AppBarLayout" parent="Widget.Design.AppBarLayout">
        <item name="android:gravity">@integer/gravity_center_combined</item>
    </style>
    
    <!-- Override any Material3 component that might use center_vertical -->
    <style name="Widget.Material3.Button" parent="Widget.MaterialComponents.Button">
        <item name="android:gravity">@integer/gravity_center_combined</item>
    </style>
    
    <style name="Widget.Material3.Button.TextButton" parent="Widget.MaterialComponents.Button.TextButton">
        <item name="android:gravity">@integer/gravity_center_combined</item>
    </style>
</resources>`;

      fs.writeFileSync(path.join(androidResPath, 'styles_override.xml'), stylesOverrideXml);

      // Update main styles.xml to use proper gravity values
      const stylesXmlPath = path.join(androidResPath, 'styles.xml');
      const stylesXml = `<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:textColor">#000000</item>
        <item name="android:editTextStyle">@style/ResetEditText</item>
        <item name="android:editTextBackground">@null</item>
        <item name="colorPrimary">#023020</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="windowActionBar">false</item>
        <!-- Override Material3 button gravity to prevent center_vertical string issues -->
        <item name="materialButtonStyle">@style/CustomMaterialButton</item>
        <item name="materialButtonOutlinedStyle">@style/CustomMaterialButton</item>
        <!-- Force proper gravity values for all components -->
        <item name="toolbarStyle">@style/Widget.Material3.Toolbar</item>
        <item name="android:gravity">@integer/gravity_center_combined</item>
    </style>
    
    <!-- Splash Screen Theme - MUST hide action bar -->
    <style name="Theme.App.SplashScreen" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="windowActionBar">false</item>
        <item name="android:windowBackground">@android:color/white</item>
    </style>
    
    <!-- Custom Material Button style to fix gravity issues -->
    <style name="CustomMaterialButton" parent="Widget.MaterialComponents.Button">
        <item name="android:gravity">@integer/gravity_center_combined</item>
    </style>
    
    <style name="ResetEditText" parent="@android:style/Widget.EditText">
        <item name="android:padding">0dp</item>
        <item name="android:background">@null</item>
        <item name="android:textCursorDrawable">@null</item>
    </style>
</resources>`;

      fs.writeFileSync(stylesXmlPath, stylesXml);

      console.log('✅ Android resource overrides applied to fix center_vertical issues');

      return config;
    },
  ]);
};

// Plugin to fix the splash screen theme to hide the action bar
// This runs AFTER expo-splash-screen generates its theme
const withFixSplashScreenTheme = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const stylesPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');

      if (fs.existsSync(stylesPath)) {
        let stylesContent = fs.readFileSync(stylesPath, 'utf8');

        // Check if Theme.App.SplashScreen exists but doesn't have windowNoTitle
        if (stylesContent.includes('Theme.App.SplashScreen') && !stylesContent.includes('windowNoTitle')) {
          // Add windowNoTitle and windowActionBar to the splash screen theme
          stylesContent = stylesContent.replace(
            /<style name="Theme\.App\.SplashScreen"([^>]*)>/,
            `<style name="Theme.App.SplashScreen"$1>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="windowActionBar">false</item>`
          );

          fs.writeFileSync(stylesPath, stylesContent);
          console.log('✅ Fixed Theme.App.SplashScreen to hide action bar');
        }
      }

      return config;
    },
  ]);
};

// Plugin to enable ABI splits for smaller APK sizes
// This configures Gradle to build separate APKs per CPU architecture
const withAbiSplits = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');

      if (fs.existsSync(buildGradlePath)) {
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

        // Check if splits is already configured
        if (!buildGradle.includes('splits {')) {
          // Find the android { block and add splits configuration after defaultConfig
          const splitsConfig = `
    // ABI Splits - Generate separate APKs per architecture for smaller download size
    splits {
        abi {
            reset()
            enable true
            universalApk false // Don't generate universal APK
            include "armeabi-v7a", "arm64-v8a" // Only ARM architectures for production
        }
    }
    
    // Assign version codes per ABI for proper Google Play publishing
    project.ext.versionCodes = ['armeabi-v7a': 1, 'arm64-v8a': 2, 'x86': 3, 'x86_64': 4]
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abi = output.getFilter(com.android.build.OutputFile.ABI)
            if (abi != null) {
                output.versionCodeOverride = variant.versionCode * 10 + project.ext.versionCodes.get(abi, 0)
            }
        }
    }
`;

          // Insert after defaultConfig { ... } block
          // Find the end of defaultConfig block
          const defaultConfigMatch = buildGradle.match(/defaultConfig\s*\{[\s\S]*?\n    \}/);
          if (defaultConfigMatch) {
            const insertIndex = defaultConfigMatch.index + defaultConfigMatch[0].length;
            buildGradle = buildGradle.slice(0, insertIndex) + '\n' + splitsConfig + buildGradle.slice(insertIndex);
            fs.writeFileSync(buildGradlePath, buildGradle);
            console.log('✅ Added ABI splits configuration to build.gradle');
          }
        }
      }

      return config;
    },
  ]);
};

// Plugin to add Android queries for UPI apps (required for UPI Intent flow)
const withUpiAppQueries = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    // Find or create queries element (it's an array)
    let queriesArray = manifest.queries;
    if (!queriesArray || !Array.isArray(queriesArray)) {
      queriesArray = [];
      manifest.queries = queriesArray;
    }

    // UPI app packages to query
    const upiPackages = [
      'com.google.android.apps.nbu.paisa.user', // Google Pay
      'com.phonepe.app', // PhonePe
      'net.one97.paytm', // Paytm
      'in.org.npci.upiapp', // BHIM
    ];

    // Add package queries if not already present
    upiPackages.forEach((packageName) => {
      const existingPackage = queriesArray.find(
        (q) => q.package && q.package[0]?.$?.['android:name'] === packageName
      );
      if (!existingPackage) {
        queriesArray.push({
          package: [
            {
              $: { 'android:name': packageName },
            },
          ],
        });
      }
    });

    // Add intent query for SEND action (required for UPI intent flow)
    const hasSendIntent = queriesArray.some(
      (q) => q.intent?.[0]?.action?.[0]?.['$']?.['android:name'] === 'android.intent.action.SEND'
    );
    if (!hasSendIntent) {
      queriesArray.push({
        intent: [
          {
            action: [
              {
                $: { 'android:name': 'android.intent.action.SEND' },
              },
            ],
          },
        ],
      });
    }

    console.log('✅ Added UPI app queries to AndroidManifest.xml');
    return config;
  });
};

const withCustomPlugins = (config) => {
  config = withNodeModulesPolyfill(config);
  config = withEdgeToEdgeEnable(config); // Add EdgeToEdge.enable() to MainActivity
  config = withAndroid15Compatibility(config);
  config = withMicrophonePermission(config); // Add RECORD_AUDIO permission
  config = withAndroidNamespaceResolution(config);
  config = withAndroidResourceOverrides(config);
  config = withFixSplashScreenTheme(config); // Fix the splash screen theme to hide action bar
  config = withAbiSplits(config); // Enable ABI splits for smaller APK sizes
  config = withUpiAppQueries(config); // Add Android queries for UPI apps
  // withImagePickerProvider removed - using expo-image-picker now
  return config;
};

module.exports = withCustomPlugins;