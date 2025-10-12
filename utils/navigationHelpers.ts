/**
 * Navigation helpers for managing gestures and back behavior
 */

// Main tab paths that shouldn't have gesture navigation
export const mainTabPaths = [
  '/(main)/home',
  '/(main)/stock',
  '/(main)/phone-order',
  '/(main)/loans',
  '/(main)/profile'
];

/**
 * Determines if a path is a main tab screen
 * @param path Current path
 * @returns boolean indicating if the path is a main tab screen
 */
export const isMainTabScreen = (path: string): boolean => {
  return mainTabPaths.includes(path);
};

/**
 * Determines if gesture navigation should be enabled for a screen
 * @param path Current path
 * @returns boolean indicating if gesture navigation should be enabled
 */
export const shouldEnableGesture = (path: string): boolean => {
  return !isMainTabScreen(path);
}; 