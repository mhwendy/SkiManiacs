import { StyleSheet, View } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@/state/languageStore';
import { useAppTheme } from '@/theme/useAppTheme';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={styles.language}>
        <DrawerItem
          accessibilityLabel={`${t('navigation.language')}: ${language === 'sr' ? 'English' : 'Srpski'}`}
          label={`${t('navigation.language')}: ${language === 'sr' ? 'English' : 'Srpski'}`}
          labelStyle={{ color: theme.textPrimary }}
          onPress={() => setLanguage(language === 'sr' ? 'en' : 'sr')}
        />
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  language: { marginTop: 8 },
});
