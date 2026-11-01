import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { applyFilters, sortByDate, sortByPrice } from '@/domain/offers';
import type { OfferFilter } from '@/domain/types';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { FilterSheet, type SortMode } from '@/features/offers/FilterSheet';
import { OfferCard } from '@/features/offers/OfferCard';
import {
  filterOptions,
  hasActiveFilter,
  todayIso,
} from '@/features/offers/helpers';
import { useOffers } from '@/features/offers/useOffers';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';

export default function OffersScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const member = user !== null && user.isActive;
  const favoriteIds = useFavoritesStore((state) => state.ids);
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const { data, isLoading, isError, refetch, isRefetching } = useOffers();
  const [filter, setFilter] = useState<OfferFilter>({});
  const [sort, setSort] = useState<SortMode>('date');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayIso();

  const offers = data?.offers;
  const options = useMemo(
    () => filterOptions(offers ?? [], language),
    [offers, language],
  );
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const visible = useMemo(() => {
    const filtered = applyFilters(
      offers ?? [],
      filter,
      language,
      user,
      favoriteSet,
    );
    return member && sort !== 'date'
      ? sortByPrice(filtered, sort)
      : sortByDate(filtered, today);
  }, [offers, filter, language, user, favoriteSet, member, sort, today]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel={t('offers.loading')} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.textPrimary }}>
          {t('offers.loadError')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refetch()}
          style={styles.retry}
        >
          <Text style={{ color: colors.white }}>{t('offers.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filter.fromDate) {
    chips.push({
      key: 'from',
      label: t('filters.from', { date: filter.fromDate }),
      clear: () => setFilter({ ...filter, fromDate: null }),
    });
  }
  if (filter.toDate) {
    chips.push({
      key: 'to',
      label: t('filters.to', { date: filter.toDate }),
      clear: () => setFilter({ ...filter, toDate: null }),
    });
  }
  for (const category of filter.categories ?? []) {
    chips.push({
      key: `c:${category}`,
      label: category,
      clear: () =>
        setFilter({
          ...filter,
          categories: filter.categories?.filter((c) => c !== category),
        }),
    });
  }
  for (const location of filter.locations ?? []) {
    chips.push({
      key: `l:${location}`,
      label: location,
      clear: () =>
        setFilter({
          ...filter,
          locations: filter.locations?.filter((l) => l !== location),
        }),
    });
  }
  if (member) {
    const hasMin = filter.minPrice !== null && filter.minPrice !== undefined;
    const hasMax = filter.maxPrice !== null && filter.maxPrice !== undefined;
    if (hasMin || hasMax) {
      chips.push({
        key: 'price',
        label: t('filters.price', {
          price: `${filter.minPrice ?? ''} - ${filter.maxPrice ?? ''}`,
        }),
        clear: () => setFilter({ ...filter, minPrice: null, maxPrice: null }),
      });
    }
    if (filter.availableOnly) {
      chips.push({
        key: 'available',
        label: t('filters.availableOnly'),
        clear: () => setFilter({ ...filter, availableOnly: false }),
      });
    }
    if (filter.favoritesOnly) {
      chips.push({
        key: 'favorites',
        label: t('filters.favoritesOnly'),
        clear: () => setFilter({ ...filter, favoritesOnly: false }),
      });
    }
  }
  const anyActive =
    chips.length > 0 || (member && hasActiveFilter(filter)) || sort !== 'date';

  const onToggleFavorite = (offerId: string) => {
    if (!member) {
      setNotice(t('favorites.loginRequired'));
      return;
    }
    setNotice(null);
    void toggleFavorite(offerId);
  };

  return (
    <View style={styles.container}>
      {data?.stale && (
        <Text style={styles.banner}>
          {t('offers.syncFailed', { reason: data.reason })}
        </Text>
      )}
      {notice && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/login')}
        >
          <Text style={[styles.banner, styles.notice]}>
            {notice} {t('navigation.login')}
          </Text>
        </Pressable>
      )}
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          style={styles.toolbarButton}
          onPress={() => setSheetVisible(true)}
        >
          <Text style={{ color: theme.accentBlue }}>{t('filters.title')}</Text>
        </Pressable>
        {anyActive && (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            style={styles.toolbarButton}
            onPress={() => {
              setFilter({});
              setSort('date');
            }}
          >
            <Text style={{ color: theme.accentBlue }}>
              {t('filters.clearAll')}
            </Text>
          </Pressable>
        )}
      </View>
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}, ${t('filters.clear')}`}
              onPress={chip.clear}
              style={[styles.chip, { borderColor: theme.accentBlue }]}
            >
              <Text style={{ color: theme.textPrimary }}>{chip.label} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        data={visible}
        keyExtractor={(offer) => offer.id}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              {t('offers.empty')}
            </Text>
            <Text style={{ color: theme.textSecondary }}>
              {t('offers.emptyMessage')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OfferCard
            offer={item}
            language={language}
            today={today}
            member={member}
            favorite={favoriteSet.has(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      />
      {sheetVisible && (
        <FilterSheet
          member={member}
          filter={filter}
          sort={sort}
          categories={options.categories}
          locations={options.locations}
          onApply={(nextFilter, nextSort) => {
            setFilter(nextFilter);
            setSort(nextSort);
          }}
          onClose={() => setSheetVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: { padding: 16 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbarButton: { minHeight: 44, justifyContent: 'center' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: colors.accentRed,
    color: colors.white,
    padding: 8,
    textAlign: 'center',
  },
  notice: { backgroundColor: colors.navy },
  retry: {
    marginTop: 12,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
});
