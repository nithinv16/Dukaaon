// Load environment variables
require('dotenv').config();

// Set environment based on build type
// Allow development mode for debug builds
if (!process.env.APP_ENV) {
  process.env.APP_ENV = process.env.NODE_ENV || 'development';
}
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Guard: fail the build loudly when required client config is absent.
//
// Build time is the right place for this. These values are read at runtime by
// config/secrets.ts, which deliberately does NOT throw — a module-scope throw
// there would blank the screen before React mounts, with no ErrorBoundary and
// no Sentry event. Catching it here means a misconfigured build cannot be
// produced in the first place.
//
// Note EXPO_PUBLIC_ prefixes: only prefixed variables are inlined into the JS
// bundle. A non-prefixed variable is visible to this file but invisible to the
// app, which is exactly the trap that shipped an unusable Supabase config.
const REQUIRED_CLIENT_ENV = [
  ['EXPO_PUBLIC_SUPABASE_URL', 'Supabase project URL, e.g. https://<ref>.supabase.co'],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'Supabase anon (publishable) key'],
  ['EXPO_PUBLIC_RAZORPAY_KEY_ID', 'Razorpay key id (rzp_live_… / rzp_test_…)'],
];

const missingClientEnv = REQUIRED_CLIENT_ENV.filter(([name]) => !process.env[name]);
if (missingClientEnv.length > 0) {
  throw new Error(
    'Missing required client configuration:\n' +
      missingClientEnv.map(([name, desc]) => `  - ${name}  (${desc})`).join('\n') +
      '\n\nAdd these to your .env file or EAS secrets before building.'
  );
}

// Guard: a secret must never be published to the client bundle. Anything with an
// EXPO_PUBLIC_ prefix is inlined by Metro as a string literal and is trivially
// recoverable from a shipped APK, so holding a provider credential this way is
// equivalent to publishing it.
//
// These are always secrets and are never acceptable in a client build.
const FORBIDDEN_CLIENT_ENV = [
  'EXPO_PUBLIC_RAZORPAY_KEY_SECRET',
  'EXPO_PUBLIC_AZURE_CLIENT_SECRET',
];

// These are being migrated behind server-side proxy edge functions. Until that
// migration completes they are still read by client code, so absence would break
// features rather than protect anything — they are reported loudly instead.
//
// FLIP THIS to true once every service below reaches AWS through an edge
// function and the variables have been deleted from .env / EAS secrets. At that
// point the entries move into FORBIDDEN_CLIENT_ENV above and this list is
// removed. Tracked as the "no provider credential in the client" work.
const ENFORCE_MIGRATING_SECRETS = false;
const MIGRATING_CLIENT_ENV = [
  'EXPO_PUBLIC_AWS_ACCESS_KEY_ID',
  'EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY',
  'EXPO_PUBLIC_AWS_BEDROCK_API_KEY',
  'EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN',
  'EXPO_PUBLIC_AUTHKEY_API_KEY',
];

const describeLeak = (names) =>
  names.map((name) => `  - ${name}`).join('\n') +
  '\n\nRemove these from .env / EAS secrets. Server-side credentials belong in ' +
  'Supabase Edge Function secrets and must be reached through a proxy function.';

const publishedSecrets = FORBIDDEN_CLIENT_ENV.filter((name) => !!process.env[name]);
if (publishedSecrets.length > 0) {
  throw new Error(
    'Refusing to build: these secrets would be inlined into the JS bundle and ' +
      'are recoverable from the shipped app:\n' +
      describeLeak(publishedSecrets)
  );
}

const migratingSecrets = MIGRATING_CLIENT_ENV.filter((name) => !!process.env[name]);
if (migratingSecrets.length > 0) {
  const message =
    'These credentials will be inlined into the JS bundle and are recoverable ' +
    'from the shipped app:\n' +
    describeLeak(migratingSecrets);
  if (ENFORCE_MIGRATING_SECRETS) {
    throw new Error('Refusing to build: ' + message);
  }
  console.warn('\n[app.config] SECURITY WARNING: ' + message + '\n');
}

// Expo configuration
const expoConfig = {
  name: "dukaaon",
  slug: "dukaaon",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "dukaaon",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  // Only bundle essential assets, exclude large files that can be loaded from CDN
  // Excluded: products/*.jpg (use CDN), wholesalers/*.jpg (use CDN), large logos
  assetBundlePatterns: [
    "assets/icon.png",
    "assets/adaptive-icon.png",
    "assets/splash.png",
    "assets/images/logo.png",
    "assets/images/categories/*.png",
    "assets/images/placeholder.png"
    // Note: product images and wholesaler images should be loaded from CDN, not bundled
  ],
  owner: "nithinv16",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.dukaaon.app",
    infoPlist: {
      NSMicrophoneUsageDescription: "This app needs access to microphone for voice search and AI ordering functionality",
      NSSpeechRecognitionUsageDescription: "This app needs speech recognition for AI voice ordering",
      // Enable UPI app queries for iOS to allow direct app redirection
      LSApplicationQueriesSchemes: [
        "tez",        // Google Pay
        "phonepe",    // PhonePe
        "paytmmp",    // Paytm
        "bhim",       // BHIM
        "credpay",    // CRED UPI
      ]
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.sixn8.dukaaon",
    versionCode: 52,
    permissions: [
      "CAMERA",
      "WRITE_EXTERNAL_STORAGE",
      "READ_EXTERNAL_STORAGE",
      "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO",
      "INTERNET",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECORD_AUDIO",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_DATA_SYNC",
      "FOREGROUND_SERVICE_LOCATION",
      "FOREGROUND_SERVICE_MICROPHONE"
    ],
    googleServicesFile: "./google-services.json",
    config: {
      googleMobileAdsAppId: process.env.GOOGLE_MOBILE_ADS_APP_ID,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    },
    // Add queries for UPI apps to enable direct app redirection
    queries: [
      {
        package: ["com.google.android.apps.nbu.paisa.user"], // Google Pay
      },
      {
        package: ["com.phonepe.app"], // PhonePe
      },
      {
        package: ["net.one97.paytm"], // Paytm
      },
      {
        package: ["in.org.npci.upiapp"], // BHIM
      },
      {
        intent: [
          {
            action: "android.intent.action.SEND",
          },
        ],
      },
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "dukaaon"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      },
      {
        action: "android.intent.action.GET_CONTENT",
        category: ["DEFAULT", "OPENABLE"],
        data: [
          {
            mimeType: "image/*"
          }
        ]
      },
      {
        action: "android.intent.action.PICK",
        category: ["DEFAULT"],
        data: [
          {
            mimeType: "image/*"
          }
        ]
      }
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "./app.plugin.js",
    [
      "expo-image-picker",
      {
        "photosPermission": "The app accesses your photos to let you share them.",
        "cameraPermission": "The app accesses your camera to let you take photos.",
        "microphonePermission": "This app needs access to your microphone for video recording."
      }
    ],
    [
      "expo-av",
      {
        "microphonePermission": "This app needs access to your microphone for voice search and AI ordering."
      }
    ],
    [
      "expo-build-properties",
      {
        "android": {
          "compileSdkVersion": 35,
          "targetSdkVersion": 35,
          "buildToolsVersion": "35.0.0",
          "kotlinVersion": "1.9.25",
          // NDK version 26.1+ required for 16 KB page size support (Android 15+)
          // This is critical for Google Play compatibility starting November 1, 2025
          "ndkVersion": "26.1.10909125",
          "enableProguardInReleaseBuilds": true,
          "enableSeparateBuildPerCPUArchitecture": true,
          "enableShrinkResourcesInReleaseBuilds": true,
          "packagingOptions": {
            "pickFirst": [
              "**/libc++_shared.so",
              "**/libjsc.so"
            ],
            "exclude": [
              "**/com/android/support/**"
            ]
          },
          "manifestPlaceholders": {
            "enableEdgeToEdge": "true"
          },
          "proguardFiles": [
            "proguard-android-optimize.txt",
            "proguard-rules.pro"
          ],
          // Note: applyScript and gradleScriptPaths can cause plugin conflicts
          // Only use if absolutely necessary and ensure scripts don't apply plugins
          // "applyScript": [
          //   "eas-nuclear-exclusions.gradle"
          // ],
          // "gradleScriptPaths": [
          //   "./android/eas-ultimate-fix.gradle"
          // ],
          gradleProperties: {
            "android.useAndroidX": "true",
            "android.enableJetifier": "false",
            "android.suppressUnsupportedCompileSdk": "35",
            "android.forceResolveConflicts": "true",
            "android.excludeGroups": "com.android.support",
            "android.dependency.excludeGroups": "com.android.support",
            "android.dependency.forceReplace": "true",
            "android.dependency.failOnConflict": "true",
            "android.dependency.rejectSupportLibraries": "true",
            "android.forceAndroidXOnly": "true",
            "android.rejectSupportLibraries": "true",
            "android.enableStrictDependencyChecking": "true",
            "android.enableResourceNamespacing": "true",
            "android.nonTransitiveRClass": "true",
            "android.overridePathCheck": "true",
            "android.suppressUnsupportedOptionWarnings": "true",
            // 16 KB page size support - Required for Google Play compatibility starting November 1, 2025
            "android.enableNativeLibraryAlignment": "true",
            "android.bundle.nativeLibsAlignment": "16384",
            "android.bundle.zipalign.enabled": "true",
            "android.bundle.zipalign.alignment": "16384"
          },
          "buildTypes": {
            "release": {
              "minifyEnabled": true,
              "shrinkResources": true
            }
          }
        }
      }
    ],

    "expo-router",
    "expo-splash-screen",
    [
      "@react-native-firebase/app",
      {
        "android_package_name": "com.sixn8.dukaaon"
      }
    ],
    [
      "@react-native-firebase/messaging",
      {
        "android_package_name": "com.sixn8.dukaaon",
        "notification": {
          "icon": "./assets/icon.png",
          "color": "#FF7D00"
        }
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "901fe813-2538-4174-82e8-0dec810541a4"
    },
    // AWS Bedrock Configuration
    awsBedrockApiKey: process.env.EXPO_PUBLIC_AWS_BEDROCK_API_KEY,
    awsBedrockApiKeyName: process.env.EXPO_PUBLIC_AWS_BEDROCK_API_KEY_NAME,
    // AWS IAM Credentials for Bedrock
    awsAccessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: process.env.EXPO_PUBLIC_AWS_REGION || process.env.AWS_REGION || 'us-east-1',
    // Supabase Configuration
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // Google Maps Configuration
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    // Firebase config moved to extra
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || "dukaaon.firebaseapp.com",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "dukaaon",
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dukaaon.firebasestorage.app",
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "65500862893",
    firebaseAppId: process.env.FIREBASE_APP_ID || "1:65500862893:android:6a09ec9c33c6d77924",
    firebaseSHA1: "7F:F7:22:7E:85:44:45:6B:5A:53:63:18:AF:D1:DD:5D",
    firebaseSHA256: "99:21:9E:F9:6E:B3:A7:12:CB:49:42:C0:55:77:FE:D8:C3:1E:A0:0",
    // Add phone auth settings
    firebasePhoneAuthSettings: {
      defaultCountry: "IN",
      defaultNationalNumber: "",
      loginHint: ""
    },
    // AI Ordering Configuration
    aiOrdering: {
      enabled: true,
      speechRecognition: {
        provider: 'native',
        language: 'en-IN'
      }
    },
    // Razorpay Configuration
    EXPO_PUBLIC_RAZORPAY_KEY_ID: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
    // Authkey.io WhatsApp API Configuration
    authkeyApiKey: process.env.EXPO_PUBLIC_AUTHKEY_API_KEY || "904251f34754cedc",
    authkeyTemplateOrderReceived: "24468"
  }
};

// Export the Expo configuration
module.exports = expoConfig;

// Add hooks outside of the Expo config object
module.exports.hooks = {
  postInstall: './prepare-for-eas.js',
};
