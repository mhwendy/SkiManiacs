import '@/i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ErrorFallback } from '@/components/ErrorFallback';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, Pressable } from 'react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { queryClient } from '@/api/queryClient';
import { useSessionBootstrap } from '@/features/auth/useSessionBootstrap';
import { useLanguageStore } from '@/state/languageStore';
import { useAppColorScheme } from '@/theme/useAppTheme';
import { colors } from '@/theme/colors';

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorFallback error={props.error} retry={props.retry} />;
}

export default function RootLayout() {
  const { t } = useTranslation();
  const colorScheme = useAppColorScheme();
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  useSessionBootstrap();
  useEffect(() => {
    void hydrateLanguage();
  }, [hydrateLanguage]);
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const backgroundColor = theme.background;
    document.documentElement.style.backgroundColor = backgroundColor;
    document.documentElement.style.colorScheme = colorScheme;
    document.body.style.backgroundColor = backgroundColor;

    const appRoot = document.getElementById('root');
    if (appRoot) appRoot.style.backgroundColor = backgroundColor;
  }, [colorScheme, theme.background]);

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.background }}
    >
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
              options={{
                title: t('offers.detailTitle'),
                headerLeft:
                  Platform.OS === 'web'
                    ? ({ tintColor, canGoBack }) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('navigation.back')}
                          hitSlop={8}
                          onPress={() =>
                            canGoBack ? router.back() : router.replace('/')
                          }
                          style={{
                            width: 44,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ArrowLeft
                            size={24}
                            color={tintColor ?? theme.textPrimary}
                          />
                        </Pressable>
                      )
                    : undefined,
              }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
