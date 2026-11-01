import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PriceSortOrder } from '@/domain/offers';
import type { OfferFilter } from '@/domain/types';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';
import { DateField } from '@/components/DateField';

export type SortMode = 'date' | PriceSortOrder;

type Props = {
  member: boolean;
  filter: OfferFilter;
  sort: SortMode;
  categories: readonly string[];
  locations: readonly string[];
  onApply: (filter: OfferFilter, sort: SortMode) => void;
  onClose: () => void;
};

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function parsePrice(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function FilterSheet({
  member,
  filter,
  sort,
  categories,
  locations,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [from, setFrom] = useState(filter.fromDate ?? '');
  const [to, setTo] = useState(filter.toDate ?? '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    ...(filter.categories ?? []),
  ]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([
    ...(filter.locations ?? []),
  ]);
  const [minPrice, setMinPrice] = useState(String(filter.minPrice ?? ''));
  const [maxPrice, setMaxPrice] = useState(String(filter.maxPrice ?? ''));
  const [availableOnly, setAvailableOnly] = useState(!!filter.availableOnly);
  const [favoritesOnly, setFavoritesOnly] = useState(!!filter.favoritesOnly);
  const [sortMode, setSortMode] = useState<SortMode>(sort);

  const minInvalid = member && parsePrice(minPrice) === undefined;
  const maxInvalid = member && parsePrice(maxPrice) === undefined;
  const invalid = minInvalid || maxInvalid;

  const renderChips = (
    values: readonly string[],
    selected: string[],
    setSelected: (next: string[]) => void,
  ) => (
    <View style={styles.chips}>
      {values.map((value) => {
        const active = selected.includes(value);
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setSelected(toggle(selected, value))}
            style={[
              styles.chip,
              { borderColor: theme.accentBlue },
              active && { backgroundColor: colors.accentBlue },
            ]}
          >
            <Text style={{ color: active ? colors.white : theme.textPrimary }}>
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const sortOptions: { mode: SortMode; label: string }[] = [
    { mode: 'date', label: t('filters.sortDate') },
    { mode: 'low-to-high', label: t('filters.sortPriceLowHigh') },
    { mode: 'high-to-low', label: t('filters.sortPriceHighLow') },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <ScrollView>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>
              {t('filters.title')}
            </Text>

            {member && (
              <>
                <Text style={[styles.section, { color: theme.textPrimary }]}>
                  {t('filters.sortBy')}
                </Text>
                {sortOptions.map((option) => (
                  <Pressable
                    key={option.mode}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sortMode === option.mode }}
                    onPress={() => setSortMode(option.mode)}
                    style={styles.radio}
                  >
                    <Text style={{ color: theme.textPrimary }}>
                      {sortMode === option.mode ? '◉' : '○'} {option.label}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            <Text style={[styles.section, { color: theme.textPrimary }]}>
              {t('filters.dateRange')}
            </Text>
            <View style={styles.row}>
              <DateField
                label={t('filters.fromDate')}
                value={from}
                onChange={setFrom}
              />
              <DateField
                label={t('filters.toDate')}
                value={to}
                onChange={setTo}
              />
            </View>

            {categories.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.textPrimary }]}>
                  {t('detail.category')}
                </Text>
                {renderChips(
                  categories,
                  selectedCategories,
                  setSelectedCategories,
                )}
              </>
            )}

            {locations.length > 0 && (
              <>
                <Text style={[styles.section, { color: theme.textPrimary }]}>
                  {t('detail.location')}
                </Text>
                {renderChips(
                  locations,
                  selectedLocations,
                  setSelectedLocations,
                )}
              </>
            )}

            {member && (
              <>
                <Text style={[styles.section, { color: theme.textPrimary }]}>
                  {t('filters.priceRange')}
                </Text>
                <View style={styles.row}>
                  <TextInput
                    accessibilityLabel={t('filters.minPrice')}
                    placeholder={t('filters.minPrice')}
                    placeholderTextColor={theme.textHint}
                    keyboardType="decimal-pad"
                    value={minPrice}
                    onChangeText={setMinPrice}
                    style={[
                      styles.input,
                      { color: theme.textPrimary },
                      minInvalid && styles.invalid,
                    ]}
                  />
                  <TextInput
                    accessibilityLabel={t('filters.maxPrice')}
                    placeholder={t('filters.maxPrice')}
                    placeholderTextColor={theme.textHint}
                    keyboardType="decimal-pad"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                    style={[
                      styles.input,
                      { color: theme.textPrimary },
                      maxInvalid && styles.invalid,
                    ]}
                  />
                </View>

                <Text style={[styles.section, { color: theme.textPrimary }]}>
                  {t('filters.options')}
                </Text>
                <View style={styles.switchRow}>
                  <Text style={{ color: theme.textPrimary }}>
                    {t('filters.favoritesOnly')}
                  </Text>
                  <Switch
                    accessibilityLabel={t('filters.favoritesOnly')}
                    value={favoritesOnly}
                    onValueChange={setFavoritesOnly}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={{ color: theme.textPrimary }}>
                    {t('filters.availableOnly')}
                  </Text>
                  <Switch
                    accessibilityLabel={t('filters.availableOnly')}
                    value={availableOnly}
                    onValueChange={setAvailableOnly}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onApply({}, 'date');
                onClose();
              }}
              style={styles.button}
            >
              <Text style={{ color: theme.accentBlue }}>
                {t('filters.clear')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={invalid}
              onPress={() => {
                onApply(
                  {
                    fromDate: from || null,
                    toDate: to || null,
                    categories: selectedCategories,
                    locations: selectedLocations,
                    ...(member && {
                      minPrice: parsePrice(minPrice) ?? null,
                      maxPrice: parsePrice(maxPrice) ?? null,
                      availableOnly,
                      favoritesOnly,
                    }),
                  },
                  member ? sortMode : 'date',
                );
                onClose();
              }}
              style={[styles.button, styles.apply, invalid && styles.disabled]}
            >
              <Text style={{ color: colors.white }}>{t('filters.apply')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: {
    maxHeight: '85%',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  radio: { minHeight: 44, justifyContent: 'center' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutralGray,
    borderRadius: 8,
    padding: 8,
  },
  invalid: { borderColor: colors.accentRed },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  apply: { backgroundColor: colors.accentBlue },
  disabled: { opacity: 0.5 },
});
