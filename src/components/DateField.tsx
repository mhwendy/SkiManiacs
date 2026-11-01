import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';
import { fromIsoDate, toIsoDate } from './dates';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function DateField({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android closes its dialog itself; iOS keeps the inline picker open.
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toIsoDate(date));
  };

  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((current) => !current)}
        style={styles.input}
      >
        <Text style={{ color: value ? theme.textPrimary : theme.textHint }}>
          {value || label}
        </Text>
      </Pressable>
      {value !== '' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} ${t('filters.clear')}`}
          onPress={() => onChange('')}
        >
          <Text style={{ color: theme.accentBlue }}>{t('filters.clear')}</Text>
        </Pressable>
      )}
      {open && (
        <DateTimePicker
          value={fromIsoDate(value) ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutralGray,
    borderRadius: 8,
    padding: 10,
  },
});
