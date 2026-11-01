import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lucide } from '@react-native-vector-icons/lucide';
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
        drawerInactiveTintColor: theme.textSecondary,
        drawerStyle: { backgroundColor: theme.surface },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t('navigation.home'),
          title: t('offers.title'),
          drawerIcon: ({ color, size }) => (
            <Lucide name="house" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="favorites"
        options={{
          drawerLabel: t('navigation.favorites'),
          title: t('navigation.favorites'),
          drawerItemStyle: user ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => (
            <Lucide name="star" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="login"
        options={{
          drawerLabel: t('navigation.login'),
          title: t('navigation.login'),
          drawerItemStyle: user ? { display: 'none' } : undefined,
          drawerIcon: ({ color, size }) => (
            <Lucide name="log-in" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="contacts"
        options={{
          drawerLabel: t('navigation.contacts'),
          title: t('navigation.contacts'),
          drawerIcon: ({ color, size }) => (
            <Lucide name="contact" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="account"
        options={{
          drawerLabel: t('navigation.account'),
          title: t('navigation.account'),
          drawerItemStyle:
            user && !user.isAdmin ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => (
            <Lucide name="user-round" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="logout"
        options={{
          drawerLabel: t('navigation.logout'),
          title: t('navigation.logout'),
          drawerItemStyle: user ? undefined : { display: 'none' },
          drawerIcon: ({ color, size }) => (
            <Lucide name="log-out" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="terms"
        options={{
          drawerLabel: t('navigation.terms'),
          title: t('navigation.terms'),
          drawerIcon: ({ color, size }) => (
            <Lucide name="file-text" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          drawerLabel: t('navigation.privacy'),
          title: t('navigation.privacy'),
          drawerIcon: ({ color, size }) => (
            <Lucide name="shield-check" color={color} size={size} />
          ),
        }}
      />
    </Drawer>
  );
}
