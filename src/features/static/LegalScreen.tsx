import { ScrollView, StyleSheet, Text, View } from 'react-native';
import legal from '@/content/legal.json';
import type { Language } from '@/domain/types';
import { useLanguageStore } from '@/state/languageStore';
import { useAppTheme } from '@/theme/useAppTheme';

type LegalDocument = (typeof legal)['terms'][Language];

export function LegalScreen({ kind }: { kind: 'terms' | 'privacy' }) {
  const language = useLanguageStore((state) => state.language);
  const theme = useAppTheme();
  const doc: LegalDocument = legal[kind][language];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.textPrimary }]}
      >
        {doc.title}
      </Text>
      {doc.updated !== '' && (
        <Text style={{ color: theme.textSecondary }}>{doc.updated}</Text>
      )}
      {doc.sections.map((section) => (
        <View
          key={section.heading}
          style={[styles.section, { backgroundColor: theme.surface }]}
        >
          <Text style={[styles.heading, { color: theme.textPrimary }]}>
            {section.heading}
          </Text>
          {section.blocks.map((block, index) => (
            <Text key={index} style={{ color: theme.textPrimary }}>
              {block.type === 'li' ? `• ${block.text}` : block.text}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  section: { padding: 12, borderRadius: 8, gap: 8 },
  heading: { fontSize: 16, fontWeight: '700' },
});
