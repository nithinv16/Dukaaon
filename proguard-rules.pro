# Proguard rules for dukaaon app

# Keep all classes in androidx namespace
-keep class androidx.** { *; }
-dontwarn androidx.**

# Exclude all com.android.support classes
-dontwarn com.android.support.**
-dontnote com.android.support.**

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep React hooks and functions - critical for production builds
-keep class com.facebook.react.bridge.** { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}

# Keep JavaScript/TypeScript React imports - prevent tree-shaking of hooks
-keep,allowobfuscation class * extends com.facebook.react.ReactContextBaseJavaModule
-keep,allowobfuscation class * extends com.facebook.react.bridge.BaseJavaModule

# Android 15 Edge-to-Edge API compatibility
# Keep new edge-to-edge APIs to replace deprecated ones
-keep class androidx.activity.EdgeToEdge { *; }
-keep class androidx.core.view.WindowCompat { *; }
-keep class androidx.core.view.WindowInsetsCompat { *; }
-keep class androidx.core.view.WindowInsetsControllerCompat { *; }

# Remove/obfuscate deprecated StatusBar APIs to prevent Play Console warnings
# These APIs are deprecated in Android 15, we use SystemBars from react-native-edge-to-edge instead
-assumenosideeffects class com.facebook.react.modules.statusbar.StatusBarModule {
    *** getStatusBarColor(...);
    *** setStatusBarColor(...);
    *** setNavigationBarColor(...);
}

# Suppress warnings for deprecated StatusBar APIs
-dontwarn com.facebook.react.modules.statusbar.StatusBarModule$*
-dontwarn android.view.Window$*getStatusBarColor
-dontwarn android.view.Window$*setStatusBarColor
-dontwarn android.view.Window$*setNavigationBarColor

# Remove deprecated Material Design internal APIs that use deprecated Window methods
-assumenosideeffects class com.google.android.material.internal.** {
    *** getStatusBarColor(...);
    *** setStatusBarColor(...);
    *** setNavigationBarColor(...);
}
-dontwarn com.google.android.material.internal.**

# Keep SystemBars from react-native-edge-to-edge
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.reactnativecommunity.edgetoedge.** { *; }

# Keep Expo classes
-keep class expo.** { *; }
-keep class versioned.** { *; }

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep vector drawable classes
-keep class androidx.vectordrawable.** { *; }
-keep class androidx.core.** { *; }

# Keep versionedparcelable classes
-keep class androidx.versionedparcelable.** { *; }

# General Android optimizations - Aggressive optimization for smaller app size
-optimizationpasses 7
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose
# Enable aggressive code shrinking
-allowaccessmodification
-repackageclasses ''
# Remove logging in release builds - More aggressive
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
}
# Remove console logging (React Native)
-assumenosideeffects class com.facebook.common.logging.FLog {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
# Optimize enum usage
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*

# Keep line numbers for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep annotations
-keepattributes *Annotation*

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enum classes
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable classes
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}