import { Drawer } from 'expo-router/drawer';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Contact,
  FileText,
  House,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react-native';
import { DrawerContent } from '@/components/DrawerContent';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';
import { useAppColorScheme } from '@/theme/useAppTheme';

export default function DrawerLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const colorScheme = useAppColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.textPrimary,
        headerLeft: ({ tintColor }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('navigation.openMenu')}
            onPress={() => navigation.toggleDrawer()}
            style={{
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu
              color={tintColor ?? theme.textPrimary}
              size={24}
            />
          </Pressable>
        ),
        drawerActiveTintColor: theme.textPrimary,
        drawerInactiveTintColor: theme.textSecondary,
        drawerStyle: { backgroundColor: theme.surface },
        sceneStyle: { backgroundColor: theme.background },
      })}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t('navigation.home'),
          title: t('offers.title'),
          drawerIcon: ({ color, size }) => (
            <House color={color} size={size} />
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
            <Star color={color} size={size} />
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
            <LogIn color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="contacts"
        options={{
          drawerLabel: t('navigation.contacts'),
          title: t('navigation.contacts'),
          drawerIcon: ({ color, size }) => (
            <Contact color={color} size={size} />
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
            <UserRound color={color} size={size} />
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
            <LogOut color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="terms"
        options={{
          drawerLabel: t('navigation.terms'),
          title: t('navigation.terms'),
          drawerIcon: ({ color, size }) => (
            <FileText color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          drawerLabel: t('navigation.privacy'),
          title: t('navigation.privacy'),
          drawerIcon: ({ color, size }) => (
            <ShieldCheck color={color} size={size} />
          ),
        }}
      />
    </Drawer>
  );
}
