import { MD3LightTheme } from 'react-native-paper';
import { COLORS } from '../constants/theme';

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
  },
}; 