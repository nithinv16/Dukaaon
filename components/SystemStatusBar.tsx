/**
 * SystemStatusBar Component
 * 
 * A replacement for expo-status-bar that uses react-native-edge-to-edge's SystemBars
 * to avoid deprecated Android 15 APIs.
 * 
 * This component addresses Google Play Console warnings:
 * - android.view.Window.getStatusBarColor (deprecated)
 * - android.view.Window.setStatusBarColor (deprecated) 
 * - android.view.Window.setNavigationBarColor (deprecated)
 */

import React from 'react';
import { SystemBars } from 'react-native-edge-to-edge';

export interface SystemStatusBarProps {
  style?: 'auto' | 'inverted' | 'light' | 'dark';
  backgroundColor?: string;
  translucent?: boolean;
  hidden?: boolean;
  networkActivityIndicatorVisible?: boolean;
  animated?: boolean;
}

/**
 * SystemStatusBar component that replaces expo-status-bar
 * Uses SystemBars from react-native-edge-to-edge for Android 15 compatibility
 */
export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({
  style = 'auto',
  backgroundColor = 'transparent',
  translucent = true,
  hidden = false,
  networkActivityIndicatorVisible,
  animated = true,
}) => {
  // Map expo-status-bar style to SystemBars style
  let systemBarStyle: 'auto' | 'inverted' | 'light' | 'dark' = 'auto';
  
  switch (style) {
    case 'light':
      systemBarStyle = 'light';
      break;
    case 'dark':
      systemBarStyle = 'dark';
      break;
    case 'inverted':
      systemBarStyle = 'inverted';
      break;
    case 'auto':
    default:
      systemBarStyle = 'auto';
      break;
  }

  // Return the SystemBars component with proper props
  return (
    <SystemBars
      style={systemBarStyle}
      hidden={hidden ? { statusBar: hidden, navigationBar: false } : false}
    />
  );
};

// Export as default for easier migration from expo-status-bar
export default SystemStatusBar;

// Export StatusBar as an alias for backward compatibility
export { SystemStatusBar as StatusBar };