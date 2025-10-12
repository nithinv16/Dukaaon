
/**
 * Helper function to enable direct navigation in case of routing problems
 * To use, import this function and call it where the app is stuck:
 * 
 * import showDirectNavigation from '../utils/direct-navigation';
 * showDirectNavigation();
 */
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const showDirectNavigation = async () => {
  try {
    // Path to the direct navigation HTML
    const htmlPath = FileSystem.documentDirectory + 'direct-navigation.html';
    
    // Check if the file exists, if not copy it from assets
    const fileInfo = await FileSystem.getInfoAsync(htmlPath);
    if (!fileInfo.exists) {
      // Copy from assets
      await FileSystem.copyAsync({
        from: require('../assets/html/direct-navigation.html'),
        to: htmlPath
      });
    }
    
    // Open the direct navigation UI in the browser
    WebBrowser.openBrowserAsync(htmlPath);
  } catch (error) {
    console.error('Failed to show direct navigation:', error);
    
    // Fallback: Reset app data
    try {
      await AsyncStorage.clear();
      alert('App data has been reset. Please restart the app.');
    } catch (clearError) {
      console.error('Failed to clear storage:', clearError);
    }
  }
};

export default showDirectNavigation;
