// Custom plugin to add Node.js polyfills

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
      
      // Add theme for edge-to-edge support
      if (!mainActivity.$['android:theme']) {
        mainActivity.$['android:theme'] = '@style/Theme.App.SplashScreen';
      }
      
      // Android 15 edge-to-edge by default
      mainActivity.$['android:enableOnBackInvokedCallback'] = 'true';
    }
    
    // Add application-level configurations
    const application = androidManifest.manifest.application[0];
    
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

// Android namespace conflict resolution plugin
const withAndroidNamespaceResolution = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(config.modRequest.platformProjectRoot, 'app/src/main/AndroidManifest.xml');
      
      if (fs.existsSync(manifestPath)) {
        let manifestContent = fs.readFileSync(manifestPath, 'utf8');
        
        // Add tools namespace if not present
        if (!manifestContent.includes('xmlns:tools')) {
          manifestContent = manifestContent.replace(
            '<manifest',
            '<manifest xmlns:tools="http://schemas.android.com/tools"'
          );
        }
        
        // Add comprehensive tools:replace attributes
        if (!manifestContent.includes('tools:replace')) {
          manifestContent = manifestContent.replace(
            '<application',
            '<application tools:replace="android:appComponentFactory,android:theme,android:name" android:appComponentFactory="androidx.core.app.CoreComponentFactory" tools:node="replace"'
          );
        }
        
        // Add manifest merger directives
        if (!manifestContent.includes('tools:overrideLibrary')) {
          manifestContent = manifestContent.replace(
            '<manifest xmlns:tools="http://schemas.android.com/tools"',
            '<manifest xmlns:tools="http://schemas.android.com/tools" tools:overrideLibrary="com.android.support,androidx.core,androidx.versionedparcelable"'
          );
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
        <item name="android:statusBarColor">#023020</item>
        <!-- Override Material3 button gravity to prevent center_vertical string issues -->
        <item name="materialButtonStyle">@style/CustomMaterialButton</item>
        <item name="materialButtonOutlinedStyle">@style/CustomMaterialButton</item>
        <!-- Force proper gravity values for all components -->
        <item name="toolbarStyle">@style/Widget.Material3.Toolbar</item>
        <item name="android:gravity">@integer/gravity_center_combined</item>
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

const withCustomPlugins = (config) => {
  config = withNodeModulesPolyfill(config);
  config = withAndroid15Compatibility(config);
  config = withAndroidNamespaceResolution(config);
  config = withAndroidResourceOverrides(config);
  // withImagePickerProvider removed - using expo-image-picker now
  return config;
};

module.exports = withCustomPlugins;