import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MapPin } from 'lucide-react-native';
import { ImageCarousel } from '@/components/ImageCarousel';
import {
  formatPrice,
  isAvailable,
  isPastOffer,
  localize,
} from '@/domain/offers';
import type { Language, Offer } from '@/domain/types';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';
import { offerImages } from './helpers';

type Props = {
  offer: Offer;
  language: Language;
  today: string;
  member: boolean;
  favorite: boolean;
  onToggleFavorite: (offerId: string) => void;
};

export function formatDates(offer: Offer): string {
  if (offer.startDate && offer.endDate) {
    return `${offer.startDate} - ${offer.endDate}`;
  }
  return offer.startDate ?? '';
}

export function OfferCard({
  offer,
  language,
  today,
  member,
  favorite,
  onToggleFavorite,
}: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const category = localize(offer.category_sr, offer.category_en, language);
  const location = localize(offer.location_sr, offer.location_en, language);
  const metadataRow = (icon: 'map-pin' | 'calendar-days', value: string) => (
    <View style={styles.metadataRow}>
      <View style={styles.metadataIcon} accessible={false}>
        {icon === 'map-pin' ? (
          <MapPin size={16} color={theme.accentBlue} />
        ) : (
          <CalendarDays size={16} color={theme.accentBlue} />
        )}
      </View>
      <Text style={{ color: theme.textSecondary }}>{value}</Text>
    </View>
  );

  let status: { label: string; color: string } | null = null;
  if (member) {
    if (isPastOffer(offer.startDate, today)) {
      status = { label: t('price.past'), color: colors.neutralGray };
    } else if (isAvailable(offer.availablePlaces)) {
      status = {
        label: t('availability.available'),
        color: colors.accentGreen,
      };
    } else {
      status = { label: t('availability.soldOut'), color: colors.accentRed };
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          localize(offer.title_sr, offer.title_en, language),
          location,
          formatDates(offer),
          member && !offer.isPriceComingSoon
            ? formatPrice(offer, language)
            : '',
          member && offer.isPriceComingSoon ? t('price.comingSoon') : '',
          status?.label ?? '',
        ]
          .filter((part) => part !== '')
          .join(', ')}
        onPress={() =>
          router.push({ pathname: '/offers/[id]', params: { id: offer.id } })
        }
      >
        <View style={styles.hero}>
          <ImageCarousel images={offerImages(offer)} />
          {category !== '' && (
            <Text style={styles.category}>{category.toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.body}>
          {status && (
            <View style={styles.row}>
              <Text style={[styles.badge, { backgroundColor: status.color }]}>
                {status.label}
              </Text>
            </View>
          )}
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {localize(offer.title_sr, offer.title_en, language)}
          </Text>
          {location !== '' && metadataRow('map-pin', location)}
          {formatDates(offer) !== '' &&
            metadataRow('calendar-days', formatDates(offer))}
          {member && (
            <Text
              style={[
                styles.price,
                {
                  backgroundColor: offer.isPriceComingSoon
                    ? colors.accentBlue
                    : colors.accentRed,
                },
              ]}
            >
              {offer.isPriceComingSoon
                ? t('price.comingSoon')
                : formatPrice(offer, language)}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('offers.favoriteAlt')}
        accessibilityState={{ selected: favorite }}
        onPress={() => onToggleFavorite(offer.id)}
        style={styles.star}
      >
        <Text style={styles.starText} importantForAccessibility="no">
          {favorite ? '★' : '☆'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  hero: { position: 'relative' },
  body: { padding: 12, gap: 4 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metadataRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metadataIcon: { width: 20, alignItems: 'center' },
  star: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: { fontSize: 28, color: colors.accentGold },
  category: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '75%',
    color: colors.white,
    backgroundColor: colors.navy,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 12,
  },
  badge: {
    color: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 12,
  },
  price: {
    alignSelf: 'flex-start',
    color: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '700',
  },
  title: { fontSize: 18, fontWeight: '700' },
});
