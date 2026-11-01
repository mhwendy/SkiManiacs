import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/skimanijaci-logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel={t('drawer.logoAlt')}
          />
          <View style={styles.brandCopy}>
            <Text style={styles.appName}>{t('app.title')}</Text>
            <Text style={styles.username}>
              {user
                ? t('drawer.loggedInAs', { username: user.username })
                : t('drawer.guestUser')}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(t('contact.websiteUrl'))}
        >
          <Text style={styles.website}>{t('contact.websiteUrl')}</Text>
        </Pressable>
        <Text style={styles.version}>{t('drawer.version', { version })}</Text>
      </View>
      <DrawerItemList {...props} />
      <View style={styles.language}>
        <Text style={[styles.languageTitle, { color: theme.textSecondary }]}>
          {t('navigation.language')}
        </Text>
        <DrawerItem
          focused={language === 'sr'}
          label={t('drawer.languageSerbian')}
          labelStyle={{ color: theme.textPrimary }}
          onPress={() => setLanguage('sr')}
        />
        <DrawerItem
          focused={language === 'en'}
          label={t('drawer.languageEnglish')}
          labelStyle={{ color: theme.textPrimary }}
          onPress={() => setLanguage('en')}
        />
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 88, height: 88 },
  brandCopy: { flex: 1, gap: 4 },
  appName: { color: colors.white, fontSize: 16, fontWeight: '700' },
  username: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 13 },
  website: { color: colors.dark.accentBlue, fontSize: 11, fontWeight: '700' },
  version: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 10 },
  language: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(138, 143, 152, 0.3)',
  },
  languageTitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
  },
});
