import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DrawerContent } from '@/components/DrawerContent';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';

export default function DrawerLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.textPrimary,
        drawerActiveTintColor: theme.textPrimary,
        drawerStyle: { backgroundColor: theme.surface },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t('navigation.offers'),
          title: t('offers.title'),
        }}
      />
      <Drawer.Screen
        name="contacts"
        options={{
          drawerLabel: t('navigation.contacts'),
          title: t('navigation.contacts'),
        }}
      />
      <Drawer.Screen
        name="terms"
        options={{
          drawerLabel: t('navigation.terms'),
          title: t('navigation.terms'),
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          drawerLabel: t('navigation.privacy'),
          title: t('navigation.privacy'),
        }}
      />
      <Drawer.Screen
        name="login"
        options={{
          drawerLabel: t('navigation.login'),
          title: t('navigation.login'),
          drawerItemStyle: user ? { display: 'none' } : undefined,
        }}
      />
      <Drawer.Screen
        name="favorites"
        options={{
          drawerLabel: t('navigation.favorites'),
          title: t('navigation.favorites'),
          drawerItemStyle: user ? undefined : { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="account"
        options={{
          drawerLabel: t('navigation.account'),
          title: t('navigation.account'),
          drawerItemStyle:
            user && !user.isAdmin ? undefined : { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="logout"
        options={{
          drawerLabel: t('navigation.logout'),
          title: t('navigation.logout'),
          drawerItemStyle: user ? undefined : { display: 'none' },
        }}
      />
    </Drawer>
  );
}
