import { MD3LightTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
    brandRegular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 24,
    },
    brandMedium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 24,
    },
    brandBold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 24,
    },
  };

export const COLORS = {
  white: '#FFFFFF',
  offWhite: '#F5F5F5',
  orange: '#FF7D00',
  lightOrange: '#FFAB58',
  grey: '#808080',
  lightGrey: '#E0E0E0',
  darkBlueGrey: '#37474F',
  error: '#FF3B30',
  success: '#4CAF50',
  info: '#2196F3',
  black: '#000000',
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.orange,
    primaryContainer: COLORS.lightOrange,
    secondary: COLORS.darkBlueGrey,
    secondaryContainer: COLORS.grey,
    background: COLORS.white,
    surface: COLORS.white,
    surfaceVariant: COLORS.offWhite,
    error: COLORS.error,
    onPrimary: COLORS.white,
    onSecondary: COLORS.white,
    onBackground: COLORS.black,
    onSurface: COLORS.black,
    elevation: {
      level0: 'transparent',
      level1: COLORS.offWhite,
      level2: COLORS.lightGrey,
      level3: COLORS.grey,
      level4: COLORS.darkBlueGrey,
      level5: COLORS.black,
    },
    text: COLORS.black,
    disabled: COLORS.grey,
    placeholder: COLORS.grey,
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  fonts: configureFonts({ config: fontConfig }),
};