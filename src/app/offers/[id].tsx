import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImageCarousel } from '@/components/ImageCarousel';
import { formatPrice, isAvailable, localize } from '@/domain/offers';
import type { Offer } from '@/domain/types';
import { formatDates } from '@/features/offers/OfferCard';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { offerImages } from '@/features/offers/helpers';
import { useOffer } from '@/features/offers/useOffers';
import { useAuthStore } from '@/state/authStore';
import { useLanguageStore } from '@/state/languageStore';
import { colors } from '@/theme/colors';
import { useAppTheme } from '@/theme/useAppTheme';

export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const language = useLanguageStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const member = user !== null && user.isActive;
  const favorite = useFavoritesStore((state) => state.ids.includes(id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const [joinDialogVisible, setJoinDialogVisible] = useState(false);
  const [favoritePromptVisible, setFavoritePromptVisible] = useState(false);
  const { data, isLoading, isError, refetch } = useOffer(id);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel={t('offers.loading')} />
      </View>
    );
  }
  if (isError || !data) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.textPrimary }}>
          {t('offers.loadError')}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: 'center' }}
          onPress={() => void refetch()}
        >
          <Text style={{ color: theme.accentBlue }}>{t('offers.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const offer = data as Offer;
  const category = localize(offer.category_sr, offer.category_en, language);
  const location = localize(offer.location_sr, offer.location_en, language);
  const description = localize(
    offer.description_sr,
    offer.description_en,
    language,
  );
  const dates = formatDates(offer);

  const row = (label: string, value: string) => (
    <View style={styles.row} key={label}>
      <Text style={{ color: theme.textSecondary }}>{label}</Text>
      <Text style={[styles.value, { color: theme.textPrimary }]}>{value}</Text>
    </View>
  );

  const onFavoritePress = () => {
    if (!member) {
      setFavoritePromptVisible(true);
      return;
    }
    void toggleFavorite(offer.id);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          <ImageCarousel images={offerImages(offer)} height={240} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('offers.favoriteAlt')}
            accessibilityState={{ selected: favorite }}
            onPress={onFavoritePress}
            style={[
              styles.detailFavorite,
              {
                backgroundColor: theme.surface,
                borderColor: colors.accentGold,
              },
            ]}
          >
            <Text
              style={[styles.detailFavoriteIcon, { color: colors.accentGold }]}
              importantForAccessibility="no"
            >
              {favorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {localize(offer.title_sr, offer.title_en, language)}
          </Text>
          {category !== '' && row(t('detail.category'), category)}
          {location !== '' && row(t('detail.location'), location)}
          {dates !== '' && row(t('detail.dates'), dates)}

          {member ? (
            <>
              <View
                style={[
                  styles.priceCard,
                  {
                    backgroundColor: offer.isPriceComingSoon
                      ? colors.accentBlue
                      : colors.accentRed,
                  },
                ]}
              >
                <Text style={styles.priceText}>
                  {offer.isPriceComingSoon
                    ? t('price.comingSoon')
                    : formatPrice(offer, language)}
                </Text>
              </View>
              {row(
                t('availability.label'),
                isAvailable(offer.availablePlaces)
                  ? t('availability.available')
                  : t('availability.soldOut'),
              )}
              {offer.availablePlaces?.trim()
                ? row(t('availability.places'), offer.availablePlaces)
                : null}
              {offer.applicationDeadline?.trim()
                ? row(t('availability.deadline'), offer.applicationDeadline)
                : null}
            </>
          ) : (
            <View style={[styles.membership, { backgroundColor: theme.surface }]}>
              <Text
                style={[styles.membershipTitle, { color: theme.textPrimary }]}
              >
                {t('detail.membershipTitle')}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                {t('detail.membershipMessage')}
              </Text>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.joinButton,
                  {
                    borderColor: colors.accentRed,
                    backgroundColor: 'rgba(193, 39, 45, 0.08)',
                  },
                ]}
                onPress={() => setJoinDialogVisible(true)}
              >
                <Text
                  style={{ color: theme.accentBlue, fontWeight: '600' }}
                >
                  {t('detail.callToJoin')}
                </Text>
              </Pressable>
            </View>
          )}

          {description !== '' && (
            <>
              <Text style={[styles.section, { color: theme.textPrimary }]}>
                {t('detail.description')}
              </Text>
              <Text style={{ color: theme.textPrimary }}>{description}</Text>
            </>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={joinDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinDialogVisible(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View
            style={[styles.dialog, { backgroundColor: theme.surface }]}
            accessibilityViewIsModal
          >
            <View style={styles.dialogHeader}>
              <Text
                style={[styles.dialogTitle, { color: theme.textPrimary }]}
                accessibilityRole="header"
              >
                {t('detail.callToJoin')}
              </Text>
            </View>
            <View style={styles.dialogContent}>
              <Text style={{ color: theme.textSecondary }}>
                {t('detail.membershipContact')}
              </Text>
              <View style={styles.phoneHighlight}>
                <Text style={[styles.phoneNumber, { color: theme.textPrimary }]}>
                  {t('contact.callNumber')}
                </Text>
              </View>
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setJoinDialogVisible(false)}
                  style={[styles.dialogButton, styles.closeButton]}
                >
                  <Text style={{ color: theme.textSecondary }}>
                    {t('detail.close')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setJoinDialogVisible(false);
                    void Linking.openURL(
                      `tel:${t('contact.callNumber').replace(/\s+/g, '')}`,
                    );
                  }}
                  style={[
                    styles.dialogButton,
                    styles.callButton,
                    { borderColor: theme.accentBlue },
                  ]}
                >
                  <Text style={{ color: theme.accentBlue, fontWeight: '700' }}>
                    {t('detail.callNow')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={favoritePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFavoritePromptVisible(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View
            style={[
              styles.dialog,
              {
                backgroundColor: theme.surface,
                borderTopColor: colors.accentGold,
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.dialogHeader}>
              <Text
                style={[styles.dialogTitle, { color: theme.textPrimary }]}
                accessibilityRole="header"
              >
                {t('navigation.favorites')}
              </Text>
            </View>
            <View style={styles.dialogContent}>
              <Text style={{ color: theme.textSecondary }}>
                {t('favorites.loginOrJoinRequired')}
              </Text>
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFavoritePromptVisible(false)}
                  style={[styles.dialogButton, styles.closeButton]}
                >
                  <Text style={{ color: theme.textSecondary }}>
                    {t('detail.close')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hero: { position: 'relative', height: 240 },
  body: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', paddingRight: 56 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { flexShrink: 1, textAlign: 'right', fontWeight: '600' },
  priceCard: { padding: 12, borderRadius: 12, alignItems: 'center' },
  priceText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  membership: { padding: 16, borderRadius: 12, gap: 8 },
  membershipTitle: { fontSize: 16, fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  joinButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 4,
  },
  detailFavorite: {
    position: 'absolute',
    right: 16,
    bottom: -28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 28,
    elevation: 4,
    zIndex: 2,
  },
  detailFavoriteIcon: {
    width: 40,
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    borderTopWidth: 3,
    borderTopColor: colors.accentRed,
    overflow: 'hidden',
  },
  dialogHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(138, 143, 152, 0.25)',
  },
  dialogTitle: { fontSize: 18, fontWeight: '700' },
  dialogContent: { padding: 20, gap: 12 },
  phoneHighlight: {
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.accentRed,
    backgroundColor: 'rgba(193, 39, 45, 0.04)',
  },
  phoneNumber: { fontSize: 18, fontWeight: '700' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  dialogButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  closeButton: { borderWidth: 1, borderColor: colors.neutralGray },
  callButton: { borderWidth: 1 },
});
