import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { validateEmail, validatePassword } from '@/domain/users';
import { ApiError, type ApiClient } from '@/api/client';
import { apiClient } from '@/api';
import { authErrorKey } from '@/features/auth/errors';
import {
  applyProfileResult,
  clearSession,
  withAuth,
} from '@/features/auth/session';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';

export async function deleteAccount(
  client: ApiClient = apiClient,
): Promise<void> {
  await withAuth((token) => client.deleteMe(token), client);
  await useFavoritesStore.getState().reset(true);
  await clearSession();
}

export default function AccountScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [username, setUsername] = useState(user?.username ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user === null) {
    return (
      <Text style={[styles.pad, { color: theme.textPrimary }]}>
        {t('auth.required')}
      </Text>
    );
  }

  const save = async () => {
    const next: Record<string, string> = {};
    if (username.trim() === '') next.username = t('auth.requiredField');
    if (name.trim() === '') next.name = t('auth.requiredField');
    if (surname.trim() === '') next.surname = t('auth.requiredField');
    if (!validateEmail(email.trim())) next.email = t('auth.invalidEmail');
    if (newPassword !== '') {
      if (!validatePassword(newPassword)) {
        next.newPassword = t('auth.passwordPolicy');
      }
      if (currentPassword === '') {
        next.currentPassword = t('auth.currentPasswordRequired');
      }
    }
    setErrors(next);
    setMessage(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const updated = await withAuth((token) =>
        apiClient.updateMe(token, {
          username: username.trim(),
          name: name.trim(),
          surname: surname.trim(),
          email: email.trim(),
          ...(newPassword !== '' && { currentPassword, newPassword }),
        }),
      );
      await applyProfileResult(updated);
      setCurrentPassword('');
      setNewPassword('');
      setMessage(t('account.saved'));
    } catch (e) {
      const key = authErrorKey(e, 'account.saveFailed');
      const field =
        key === 'auth.usernameExists'
          ? 'username'
          : key === 'auth.emailExists'
            ? 'email'
            : key === 'auth.currentPasswordIncorrect'
              ? 'currentPassword'
              : key === 'auth.passwordPolicy'
                ? 'newPassword'
                : 'form';
      setErrors({ [field]: t(key) });
    } finally {
      setBusy(false);
    }
  };

  const performDelete = async () => {
    try {
      await deleteAccount();
      router.replace('/');
    } catch (e) {
      const reason = e instanceof ApiError ? e.message : String(e);
      setErrors({ form: t('account.deleteFailed', { reason }) });
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('account.confirmMessage'))) {
        void performDelete();
      }
      return;
    }
    Alert.alert(t('account.confirmTitle'), t('account.confirmMessage'), [
      { text: t('account.cancel'), style: 'cancel' },
      {
        text: t('account.deleteButton'),
        style: 'destructive',
        onPress: () => void performDelete(),
      },
    ]);
  };

  const field = (
    key: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    extra: Record<string, unknown> = {},
  ) => (
    <>
      <TextInput
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={theme.textHint}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        style={[
          styles.input,
          { color: theme.textPrimary, backgroundColor: theme.surface },
          errors[key] ? styles.invalid : null,
        ]}
        {...extra}
      />
      {errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={[styles.heading, { color: theme.textPrimary }]}>
        {t('account.details')}
      </Text>
      {field('username', t('account.username'), username, setUsername)}
      {field('name', t('account.name'), name, setName)}
      {field('surname', t('account.surname'), surname, setSurname)}
      {field('email', t('account.email'), email, setEmail, {
        keyboardType: 'email-address',
      })}
      {field(
        'currentPassword',
        t('auth.currentPassword'),
        currentPassword,
        setCurrentPassword,
        { secureTextEntry: true },
      )}
      {field(
        'newPassword',
        t('auth.newPassword'),
        newPassword,
        setNewPassword,
        {
          secureTextEntry: true,
        },
      )}
      {errors.form && <Text style={styles.error}>{errors.form}</Text>}
      {message && <Text style={styles.success}>{message}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void save()}
        style={[styles.button, busy && styles.disabled]}
      >
        <Text style={styles.buttonText}>{t('account.save')}</Text>
      </Pressable>

      <Text style={[styles.heading, { color: theme.textPrimary }]}>
        {t('account.deleteTitle')}
      </Text>
      <Text style={{ color: theme.textSecondary }}>
        {t('account.deleteDescription')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={confirmDelete}
        style={[styles.button, { backgroundColor: colors.accentRed }]}
      >
        <Text style={styles.buttonText}>{t('account.deleteButton')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, gap: 10 },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutralGray,
    borderRadius: 8,
    padding: 12,
  },
  invalid: { borderColor: colors.accentRed },
  error: { color: colors.accentRed },
  success: { color: colors.accentGreen },
  button: {
    backgroundColor: colors.accentBlue,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontWeight: '700' },
});
