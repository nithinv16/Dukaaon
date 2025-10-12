import React, { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Provider as PaperProvider, DefaultTheme, DarkTheme } from 'react-native-paper';
import { useSettingsStore } from '../store/settings';
import { COLORS } from '../constants/theme';

// Create a basic theme that doesn't rely on problematic components
const createTheme = (darkMode: boolean) => {
  const baseTheme = darkMode ? DarkTheme : DefaultTheme;
  
  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: COLORS.orange,
      accent: COLORS.darkOrange,
      background: darkMode ? '#121212' : COLORS.white,
      surface: darkMode ? '#1e1e1e' : COLORS.white,
      text: darkMode ? COLORS.white : COLORS.black,
    },
    roundness: 4,
  };
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const { darkMode } = useSettingsStore();
  
  const theme = createTheme(darkMode ?? colorScheme === 'dark');

  return (
    <PaperProvider theme={theme}>
      {children}
    </PaperProvider>
  );
} 