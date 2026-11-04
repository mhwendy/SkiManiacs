import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from './colors';

export type AppColorScheme = 'light' | 'dark';

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function subscribeToWebColorScheme(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }

  mediaQuery.addListener(onChange);
  return () => mediaQuery.removeListener(onChange);
}

function getWebColorScheme(): AppColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
}

function getServerColorScheme(): AppColorScheme {
  return 'light';
}

export function useAppColorScheme(): AppColorScheme {
  const nativeColorScheme = useColorScheme();
  const webColorScheme = useSyncExternalStore(
    subscribeToWebColorScheme,
    getWebColorScheme,
    getServerColorScheme,
  );

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return webColorScheme;
  }

  return nativeColorScheme ?? 'light';
}

export function useAppTheme() {
  const colorScheme = useAppColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
}
