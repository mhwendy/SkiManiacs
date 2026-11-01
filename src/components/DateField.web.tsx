import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

// Web uses the browser's native date input.
export function DateField({ label, value, onChange }: Props) {
  return (
    <View style={styles.field}>
      {createElement('input', {
        type: 'date',
        'aria-label': label,
        value,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
        style: {
          border: `1px solid ${colors.neutralGray}`,
          borderRadius: 8,
          padding: 10,
          width: '100%',
          boxSizing: 'border-box',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ field: { flex: 1 } });
