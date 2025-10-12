/**
 * Android 15 Edge-to-Edge Compatibility Utilities
 * 
 * This module provides utilities to handle Android 15's edge-to-edge display
 * and replaces deprecated APIs for status bar and navigation bar styling.
 * 
 * Addresses Google Play Console warnings:
 * - android.view.Window.getStatusBarColor (deprecated)
 * - android.view.Window.setStatusBarColor (deprecated) 
 * - android.view.Window.setNavigationBarColor (deprecated)
 */

import React, { useEffect, useState } from 'react';
import { Platform, Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemBars } from 'react-native-edge-to-edge';

// Types for edge-to-edge configuration
export interface EdgeToEdgeConfig {
  statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
  statusBarBackgroundColor?: string;
  navigationBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
  navigationBarBackgroundColor?: string;
  enableEdgeToEdge?: boolean;
  hidden?: boolean;
}

// Hook to handle edge-to-edge display
export const useEdgeToEdge = (config: EdgeToEdgeConfig = {}) => {
  const insets = useSafeAreaInsets();
  const [screenData, setScreenData] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

  // Create SystemBars component with proper configuration
  const SystemBarsComponent = () => {
    if (Platform.OS !== 'android') return null;
    
    const style = config.statusBarStyle || 'auto';
    const hidden = config.hidden || false;
    
    return (
      <SystemBars
        style={style}
        hidden={hidden ? { statusBar: hidden, navigationBar: false } : false}
      />
    );
  };

  return {
    insets,
    screenData,
    // Safe area padding values
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
    // Screen dimensions
    screenWidth: screenData.width,
    screenHeight: screenData.height,
    // SystemBars component to render
    SystemBarsComponent,
  };
};

// Utility function to get safe area styles
export const getSafeAreaStyles = (insets: any) => ({
  paddingTop: insets.top,
  paddingBottom: insets.bottom,
  paddingLeft: insets.left,
  paddingRight: insets.right,
});

// Utility function to configure edge-to-edge for the entire app
// Note: This function now returns a component that should be rendered in your app
export const configureEdgeToEdge = (config: EdgeToEdgeConfig = {}) => {
  if (Platform.OS !== 'android') {
    return () => null;
  }
  
  const style = config.statusBarStyle || 'auto';
  const hidden = config.hidden || false;
  
  return () => (
    <SystemBars
      style={style}
      hidden={hidden ? { statusBar: hidden, navigationBar: false } : false}
    />
  );
};

// Check if device supports Android 15 features
export const isAndroid15Compatible = () => {
  if (Platform.OS !== 'android') return false;
  
  try {
    const apiLevel = Platform.Version;
    return apiLevel >= 35; // Android 15 is API level 35
  } catch {
    return false;
  }
};

// Enhanced edge-to-edge configuration for Android 15
// Returns a component that should be rendered in your app
export const configureAndroid15EdgeToEdge = () => {
  if (!isAndroid15Compatible()) {
    console.log('Device does not support Android 15 features, using standard configuration');
    return configureEdgeToEdge();
  }
  
  // Android 15 specific configuration using SystemBars component
  return () => (
    <SystemBars
      style="auto"
      hidden={false}
    />
  );
};

// Component wrapper for edge-to-edge content
export const EdgeToEdgeWrapper: React.FC<{
  children: React.ReactNode;
  config?: EdgeToEdgeConfig;
  style?: any;
}> = ({ children, config = {}, style }) => {
  const { insets, SystemBarsComponent } = useEdgeToEdge(config);
  
  return (
    <>
      <SystemBarsComponent />
      <View style={{
        flex: 1,
        ...getSafeAreaStyles(insets),
        ...style,
      }}>
        {children}
      </View>
    </>
  );
};

// Constants for Android 15 compatibility
export const ANDROID_15_CONSTANTS = {
  // Minimum SDK version that supports edge-to-edge by default
  EDGE_TO_EDGE_MIN_SDK: 35,
  
  // Android 15 API level
  ANDROID_15_API_LEVEL: 35,
  
  // 16KB page size support
  SUPPORTS_16KB_PAGE_SIZE: true,
  
  // Deprecated API replacements - Now using SystemBars component from react-native-edge-to-edge
  DEPRECATED_APIS: {
    setStatusBarColor: 'Replaced with <SystemBars /> component from react-native-edge-to-edge',
    setNavigationBarColor: 'Replaced with <SystemBars /> component from react-native-edge-to-edge',
    getStatusBarColor: 'Replaced with <SystemBars /> component from react-native-edge-to-edge',
    getNavigationBarColor: 'Replaced with <SystemBars /> component from react-native-edge-to-edge',
    LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES: 'Use LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS',
    LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT: 'Use LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS',
  },
  
  // Migration warnings addressed
  ADDRESSED_WARNINGS: [
    'android.view.Window.getStatusBarColor',
    'android.view.Window.setStatusBarColor',
    'android.view.Window.setNavigationBarColor',
    'com.facebook.react.modules.statusbar.StatusBarModule',
    'com.google.android.material.internal.d.a'
  ],
};

export default {
  useEdgeToEdge,
  getSafeAreaStyles,
  configureEdgeToEdge,
  configureAndroid15EdgeToEdge,
  isAndroid15Compatible,
  EdgeToEdgeWrapper,
  ANDROID_15_CONSTANTS,
};