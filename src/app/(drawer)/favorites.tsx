import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { sortByDate } from '@/domain/offers';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { todayIso } from '@/features/offers/helpers';
import { OfferCard } from '@/features/offers/OfferCard';
import { useOffers } from '@/features/offers/useOffers';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { useAppTheme } from '@/theme/useAppTheme';

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useLanguageStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const ids = useFavoritesStore((state) => state.ids);
  const toggle = useFavoritesStore((state) => state.toggle);
  const { data, isLoading } = useOffers();
  const today = todayIso();

  const favorites = useMemo(() => {
    const set = new Set(ids);
    return sortByDate(
      (data?.offers ?? []).filter((offer) => set.has(offer.id)),
      today,
    );
  }, [data, ids, today]);

  if (user === null) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.textPrimary }}>{t('auth.required')}</Text>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel={t('offers.loading')} />
      </View>
    );
  }

  return (
    <FlatList
      data={favorites}
      keyExtractor={(offer) => offer.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('favorites.emptyTitle')}
          </Text>
          <Text style={{ color: theme.textSecondary }}>
            {t('favorites.emptyMessage')}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <OfferCard
          offer={item}
          language={language}
          today={today}
          member
          favorite
          onToggleFavorite={(offerId) => void toggle(offerId)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  list: { padding: 16, flexGrow: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
});
