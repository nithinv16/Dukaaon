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
  assetBundlePatterns: [
    "**/*"
  ],
  owner: "nithinv16",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.dukaaon.app",
    infoPlist: {
      NSMicrophoneUsageDescription: "This app needs access to microphone for voice search and AI ordering functionality",
      NSSpeechRecognitionUsageDescription: "This app needs speech recognition for AI voice ordering"
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.sixn8.dukaaon",
    versionCode: 40,
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
        "microphonePermission": false
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
          "enableProguardInReleaseBuilds": true,
          "enableSeparateBuildPerCPUArchitecture": true,
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
          "applyScript": [
            "eas-nuclear-exclusions.gradle"
          ],
          "gradleScriptPaths": [
            "./android/eas-ultimate-fix.gradle"
          ],
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
              "android.suppressUnsupportedOptionWarnings": "true"
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
    // Firebase config moved to extra
    firebaseApiKey: process.env.FIREBASE_API_KEY || "AIzaSyANRnyoh-2f7i-vojt0Adm2w1rlPHyoZQQ",
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || "dukaaon.firebaseapp.com",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "dukaaon",
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || "dukaaon.firebasestorage.app",
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "65500862893",
    firebaseAppId: process.env.FIREBASE_APP_ID || "1:65500862893:android:6a09ec9c33c6d770032924",
    firebaseSHA1: "7F:F7:22:7E:85:44:45:6B:5A:53:63:18:AF:D1:DD:5D:EC:9F:B0:2B",
    firebaseSHA256: "99:21:9E:F9:6E:B3:A7:12:CB:49:42:C0:55:77:FE:D8:C3:1E:A0:0B:DE:8D:AA:C2:D4:1A:BC:6C:9B:CE:86:2A",
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
    }
  }
};

// Export the Expo configuration
module.exports = expoConfig;

// Add hooks outside of the Expo config object
module.exports.hooks = {
  postInstall: './prepare-for-eas.js',
};