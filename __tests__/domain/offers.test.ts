import { describe, expect, it } from '@jest/globals';
import {
  applyFilters,
  formatPrice,
  isAvailable,
  isPastOffer,
  localize,
  sanitizeFilter,
  sortByDate,
  sortByPrice,
} from '@/domain/offers';
import type { Offer, User } from '@/domain/types';

const user: User = {
  username: 'test-user',
  email: 'test@example.invalid',
  isAdmin: false,
  isActive: true,
};

const offers: Offer[] = [
  {
    id: 'past',
    title_sr: 'Prošla ponuda',
    title_en: 'Past offer',
    description_sr: null,
    description_en: null,
    category_sr: 'Skijanje',
    category_en: 'Skiing',
    location_sr: 'Alpi',
    location_en: 'Alps',
    price: null,
    priceAmount: 300,
    currency: 'EUR',
    isPriceComingSoon: false,
    startDate: '2026-01-01',
    endDate: null,
    imageUrl: null,
    imageUrl2: null,
    imageUrl3: null,
    imageUrl4: null,
    imageUrl5: null,
    availablePlaces: '2',
    applicationDeadline: null,
    updatedAt: null,
    updatedBy: null,
  },
  {
    id: 'future',
    title_sr: 'Buduća ponuda',
    title_en: 'Future offer',
    description_sr: null,
    description_en: null,
    category_sr: 'Skijanje',
    category_en: 'Skiing',
    location_sr: 'Alpi',
    location_en: 'Alps',
    price: null,
    priceAmount: 800,
    currency: 'EUR',
    isPriceComingSoon: false,
    startDate: '2026-12-01',
    endDate: null,
    imageUrl: null,
    imageUrl2: null,
    imageUrl3: null,
    imageUrl4: null,
    imageUrl5: null,
    availablePlaces: '0',
    applicationDeadline: null,
    updatedAt: null,
    updatedBy: null,
  },
  {
    id: 'undated',
    title_sr: 'Bez datuma',
    title_en: null,
    description_sr: null,
    description_en: null,
    category_sr: null,
    category_en: null,
    location_sr: null,
    location_en: null,
    price: 'Price on request',
    priceAmount: null,
    currency: null,
    isPriceComingSoon: false,
    startDate: null,
    endDate: null,
    imageUrl: null,
    imageUrl2: null,
    imageUrl3: null,
    imageUrl4: null,
    imageUrl5: null,
    availablePlaces: 'invalid',
    applicationDeadline: null,
    updatedAt: null,
    updatedBy: null,
  },
];

describe('offer domain rules', () => {
  it('derives availability from a valid positive integer place count', () => {
    expect(isAvailable('1')).toBe(true);
    expect(isAvailable('0')).toBe(false);
    expect(isAvailable('-1')).toBe(false);
    expect(isAvailable('')).toBe(false);
    expect(isAvailable('2 places')).toBe(false);
    expect(isAvailable('2147483648')).toBe(false);
  });

  it('marks only offers before today as past', () => {
    expect(isPastOffer('2026-10-29', '2026-10-30')).toBe(true);
    expect(isPastOffer('2026-10-30', '2026-10-30')).toBe(false);
    expect(isPastOffer(null, '2026-10-30')).toBe(false);
    expect(isPastOffer('2026-02-30', '2026-10-30')).toBe(false);
  });

  it('sorts upcoming offers, then past offers, then undated offers', () => {
    expect(sortByDate(offers, '2026-10-30').map((offer) => offer.id)).toEqual([
      'future',
      'past',
      'undated',
    ]);
  });

  it('uses the Android low-to-high and high-to-low missing-price defaults', () => {
    const lowHigh = sortByPrice(offers, 'low-to-high');
    const highLow = sortByPrice(offers, 'high-to-low');
    expect(lowHigh.map((offer) => offer.id)).toEqual([
      'past',
      'future',
      'undated',
    ]);
    expect(highLow.map((offer) => offer.id)).toEqual([
      'future',
      'past',
      'undated',
    ]);
  });

  it('formats Coming Soon and EUR/RSD prices', () => {
    const offer = offers[0];
    expect(formatPrice({ ...offer, isPriceComingSoon: true }, 'en')).toBe(
      'Coming Soon',
    );
    expect(formatPrice({ ...offer, isPriceComingSoon: true }, 'sr')).toBe(
      'Uskoro',
    );
    expect(
      formatPrice({ ...offer, priceAmount: 499, currency: 'EUR' }, 'en'),
    ).toBe('€499');
    expect(
      formatPrice({ ...offer, priceAmount: 499.5, currency: 'RSD' }, 'en'),
    ).toBe('499.50 RSD');
    expect(formatPrice(offers[2], 'en')).toBe('Price on request');
  });

  it('falls back to the other language when a translation is empty', () => {
    expect(localize('Skijanje', 'Skiing', 'en')).toBe('Skiing');
    expect(localize('Skijanje', '', 'en')).toBe('Skijanje');
    expect(localize('', 'Skiing', 'sr')).toBe('Skiing');
  });

  it('filters by date and language-specific localized categories and locations', () => {
    const result = applyFilters(
      offers,
      {
        fromDate: '2026-11-01',
        categories: ['Skiing'],
        locations: ['Alps'],
      },
      'en',
      null,
    );
    expect(result.map((offer) => offer.id)).toEqual(['future']);
  });

  it('applies protected filters for members but sanitizes them for guests', () => {
    const filter = { minPrice: 250, availableOnly: true, favoritesOnly: true };
    expect(
      applyFilters(offers, filter, 'en', user, new Set(['past'])),
    ).toHaveLength(1);
    expect(
      applyFilters(offers, filter, 'en', null, new Set(['past'])),
    ).toHaveLength(3);
    expect(sanitizeFilter(filter, null)).toMatchObject({
      minPrice: null,
      availableOnly: false,
      favoritesOnly: false,
    });
  });
});
