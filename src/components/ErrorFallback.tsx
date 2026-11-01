import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/useAppTheme';
import { colors } from '@/theme/colors';

export function reportError(error: unknown) {
  // Logging only; no crash-reporting service is configured.
  console.error('[app-error]', error);
}

type Props = { error: Error; retry: () => void };

export function ErrorFallback({ error, retry }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  reportError(error);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      accessibilityRole="alert"
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.textPrimary }]}
      >
        {t('app.errorTitle')}
      </Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        {t('app.errorBody')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('app.retry')}
        onPress={retry}
        style={[styles.button, { backgroundColor: colors.navy }]}
      >
        <Text style={styles.buttonText}>{t('app.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center' },
  button: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
