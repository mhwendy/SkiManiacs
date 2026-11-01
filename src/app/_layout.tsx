import '@/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { ErrorFallback } from '@/components/ErrorFallback';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { queryClient } from '@/api/queryClient';
import { useSessionBootstrap } from '@/features/auth/useSessionBootstrap';
import { useLanguageStore } from '@/state/languageStore';
import { colors } from '@/theme/colors';

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorFallback error={props.error} retry={props.retry} />;
}

export default function RootLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  useSessionBootstrap();
  useEffect(() => {
    void hydrateLanguage();
  }, [hydrateLanguage]);
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.surface },
              headerTintColor: theme.textPrimary,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            <Stack.Screen
              name="offers/[id]"
              options={{ title: t('offers.detailTitle') }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
