import { useColorScheme } from 'react-native';
import { colors } from './colors';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
}
