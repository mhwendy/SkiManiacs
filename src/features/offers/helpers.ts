import { localize, toGuestOffer } from '@/domain/offers';
import type { Offer, OfferFilter, Language } from '@/domain/types';

// Guests only ever hold offers with every member-only field cleared.
export function toGuestView(offer: Offer): Offer {
  return {
    ...toGuestOffer(offer),
    price: null,
    priceAmount: null,
    currency: null,
    isPriceComingSoon: false,
    availablePlaces: null,
    applicationDeadline: null,
  };
}

export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function offerImages(offer: Offer): string[] {
  return [
    offer.imageUrl,
    offer.imageUrl2,
    offer.imageUrl3,
    offer.imageUrl4,
    offer.imageUrl5,
  ].filter((url): url is string => Boolean(url));
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function filterOptions(offers: readonly Offer[], language: Language) {
  return {
    categories: uniqueSorted(
      offers.map((o) => localize(o.category_sr, o.category_en, language)),
    ),
    locations: uniqueSorted(
      offers.map((o) => localize(o.location_sr, o.location_en, language)),
    ),
  };
}

export function hasActiveFilter(filter: OfferFilter): boolean {
  return Boolean(
    filter.fromDate ||
    filter.toDate ||
    filter.categories?.length ||
    filter.locations?.length,
  );
}

export function isValidFilterDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
