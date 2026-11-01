import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/theme/useAppTheme';

export const CONTACTS = [
  {
    label: 'Email',
    value: 'info@skimanijaci.com',
    url: 'mailto:info@skimanijaci.com',
  },
  {
    label: 'Website',
    value: 'skimanijaci.com',
    url: 'https://skimanijaci.com/',
  },
  { label: 'Pop', value: '+381 600 218 657', url: 'tel:+381600218657' },
  { label: 'Bata', value: '+381 600 218 654', url: 'tel:+381600218654' },
  { label: 'Djidja', value: '+381 600 218 658', url: 'tel:+381600218658' },
  {
    label: 'Facebook',
    value: 'SkiManijaci',
    url: 'https://www.facebook.com/skimanijaci',
  },
  {
    label: 'Instagram',
    value: '@skimanijaci',
    url: 'https://www.instagram.com/skimanijaci/',
  },
  {
    label: 'Twitter',
    value: '@skimanijaci',
    url: 'https://www.twitter.com/skimanijaci',
  },
  {
    label: 'YouTube',
    value: 'SkiManijaci Channel',
    url: 'https://www.youtube.com/channel/UC-o7h3jbdLpe-UDPbU4v9pA',
  },
] as const;

export default function ContactsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        {t('contact.title')}
      </Text>
      {CONTACTS.map((contact) => (
        <Pressable
          key={contact.label}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(contact.url)}
          style={[styles.item, { backgroundColor: theme.surface }]}
        >
          <Text style={{ color: theme.textSecondary }}>{contact.label}</Text>
          <Text style={[styles.value, { color: theme.accentBlue }]}>
            {contact.value}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  item: { padding: 14, borderRadius: 12, gap: 2 },
  value: { fontSize: 16, fontWeight: '600' },
});
