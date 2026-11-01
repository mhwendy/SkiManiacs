import type { Language, Offer, OfferFilter, User } from './types';

export type PriceSortOrder = 'low-to-high' | 'high-to-low';

export type GuestOffer = Omit<
  Offer,
  | 'price'
  | 'priceAmount'
  | 'currency'
  | 'isPriceComingSoon'
  | 'availablePlaces'
  | 'applicationDeadline'
>;

export function isAvailable(availablePlaces: string | null): boolean {
  if (availablePlaces === null || !/^[+-]?\d+$/.test(availablePlaces)) {
    return false;
  }

  const places = Number(availablePlaces);
  return (
    Number.isInteger(places) &&
    places >= -2_147_483_648 &&
    places <= 2_147_483_647 &&
    places > 0
  );
}

function isIsoDate(value: string | null): value is string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isPastOffer(startDate: string | null, today: string): boolean {
  return isIsoDate(startDate) && isIsoDate(today) && startDate < today;
}

function dateBucket(startDate: string | null, today: string): number {
  if (!isIsoDate(startDate)) {
    return 2;
  }
  return isPastOffer(startDate, today) ? 1 : 0;
}

export function sortByDate(offers: readonly Offer[], today: string): Offer[] {
  return [...offers].sort((a, b) => {
    const bucketDifference =
      dateBucket(a.startDate, today) - dateBucket(b.startDate, today);
    if (bucketDifference !== 0) {
      return bucketDifference;
    }
    return (a.startDate ?? '').localeCompare(b.startDate ?? '');
  });
}

export function sortByPrice(
  offers: readonly Offer[],
  order: PriceSortOrder,
): Offer[] {
  return [...offers].sort((a, b) => {
    const aPrice =
      a.priceAmount ?? (order === 'low-to-high' ? Number.POSITIVE_INFINITY : 0);
    const bPrice =
      b.priceAmount ?? (order === 'low-to-high' ? Number.POSITIVE_INFINITY : 0);
    return order === 'low-to-high' ? aPrice - bPrice : bPrice - aPrice;
  });
}

export function localize(
  valueSr: string | null | undefined,
  valueEn: string | null | undefined,
  language: Language,
): string {
  if (language === 'en') {
    return valueEn || valueSr || '';
  }
  return valueSr || valueEn || '';
}

export function formatPrice(offer: Offer, language: Language): string {
  if (offer.isPriceComingSoon) {
    return language === 'sr' ? 'Uskoro' : 'Coming Soon';
  }

  if (offer.priceAmount !== null && offer.currency !== null) {
    const amount =
      offer.priceAmount % 1 === 0
        ? String(offer.priceAmount)
        : offer.priceAmount.toFixed(2);
    return offer.currency === 'EUR' ? `€${amount}` : `${amount} RSD`;
  }

  return offer.price ?? '';
}

export function sanitizeFilter(
  filter: OfferFilter,
  user: User | null,
): OfferFilter {
  if (user !== null && user.isActive) {
    return filter;
  }

  return {
    ...filter,
    minPrice: null,
    maxPrice: null,
    availableOnly: false,
    favoritesOnly: false,
  };
}

export function applyFilters(
  offers: readonly Offer[],
  filter: OfferFilter,
  language: Language,
  user: User | null,
  favoriteOfferIds: ReadonlySet<string> = new Set(),
): Offer[] {
  const effectiveFilter = sanitizeFilter(filter, user);

  return offers.filter((offer) => {
    if (
      effectiveFilter.fromDate &&
      (!offer.startDate || offer.startDate < effectiveFilter.fromDate)
    ) {
      return false;
    }
    if (
      effectiveFilter.toDate &&
      (!offer.startDate || offer.startDate > effectiveFilter.toDate)
    ) {
      return false;
    }
    if (
      effectiveFilter.categories?.length &&
      !effectiveFilter.categories.includes(
        localize(offer.category_sr, offer.category_en, language),
      )
    ) {
      return false;
    }
    if (
      effectiveFilter.locations?.length &&
      !effectiveFilter.locations.includes(
        localize(offer.location_sr, offer.location_en, language),
      )
    ) {
      return false;
    }
    if (
      effectiveFilter.minPrice !== null &&
      effectiveFilter.minPrice !== undefined
    ) {
      if (
        offer.priceAmount === null ||
        offer.priceAmount < effectiveFilter.minPrice
      ) {
        return false;
      }
    }
    if (
      effectiveFilter.maxPrice !== null &&
      effectiveFilter.maxPrice !== undefined
    ) {
      if (
        offer.priceAmount === null ||
        offer.priceAmount > effectiveFilter.maxPrice
      ) {
        return false;
      }
    }
    if (effectiveFilter.availableOnly && !isAvailable(offer.availablePlaces)) {
      return false;
    }
    if (effectiveFilter.favoritesOnly && !favoriteOfferIds.has(offer.id)) {
      return false;
    }
    return true;
  });
}

export function toGuestOffer(offer: Offer): GuestOffer {
  const {
    price: _price,
    priceAmount: _priceAmount,
    currency: _currency,
    isPriceComingSoon: _isPriceComingSoon,
    availablePlaces: _availablePlaces,
    applicationDeadline: _applicationDeadline,
    ...guestOffer
  } = offer;
  return guestOffer;
}
