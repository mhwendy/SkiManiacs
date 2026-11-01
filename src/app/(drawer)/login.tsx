import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { authErrorKey } from '@/features/auth/errors';
import { login } from '@/features/auth/session';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const missing = username.trim() === '' || password === '';

  const submit = async () => {
    setTouched(true);
    if (missing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      router.replace('/');
    } catch (e) {
      setError(t(authErrorKey(e, 'auth.invalidCredentials')));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: theme.textPrimary, backgroundColor: theme.surface },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <TextInput
        accessibilityLabel={t('auth.username')}
        placeholder={t('auth.username')}
        placeholderTextColor={theme.textHint}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        style={inputStyle}
      />
      <TextInput
        accessibilityLabel={t('auth.password')}
        placeholder={t('auth.password')}
        placeholderTextColor={theme.textHint}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        style={inputStyle}
      />
      {touched && missing && (
        <Text style={styles.error}>{t('auth.requiredField')}</Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void submit()}
        style={[styles.button, busy && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.neutralGray,
    borderRadius: 8,
    padding: 12,
  },
  error: { color: colors.accentRed },
  button: {
    backgroundColor: colors.accentBlue,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700' },
});
