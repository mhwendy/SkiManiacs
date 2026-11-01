import { describe, expect, it } from '@jest/globals';
import { mockOffers } from '@/api/mockOffers';
import {
  filterOptions,
  hasActiveFilter,
  isValidFilterDate,
  offerImages,
  toGuestView,
  todayIso,
} from '@/features/offers/helpers';

describe('offer helpers', () => {
  it('clears every member-only field for guests', () => {
    const guest = toGuestView(mockOffers[0]);
    expect(guest.price).toBeNull();
    expect(guest.priceAmount).toBeNull();
    expect(guest.currency).toBeNull();
    expect(guest.isPriceComingSoon).toBe(false);
    expect(guest.availablePlaces).toBeNull();
    expect(guest.applicationDeadline).toBeNull();
    expect(guest.title_sr).toBe(mockOffers[0].title_sr);
  });

  it('formats today as a local ISO date', () => {
    expect(todayIso(new Date(2027, 0, 5))).toBe('2027-01-05');
  });

  it('lists only the present images in order', () => {
    expect(offerImages(mockOffers[0])).toHaveLength(2);
    expect(offerImages(mockOffers[2])).toEqual([]);
  });

  it('derives sorted unique category and location chips per language', () => {
    const en = filterOptions(mockOffers, 'en');
    expect(en.categories).toEqual(['Camp', 'Skiing', 'Weekend']);
    const sr = filterOptions(mockOffers, 'sr');
    expect(sr.categories).toContain('Skijanje');
    expect(sr.locations).toContain('Kopaonik - Srbija');
  });

  it('detects active filters and validates dates', () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ categories: [] })).toBe(false);
    expect(hasActiveFilter({ fromDate: '2027-01-01' })).toBe(true);
    expect(isValidFilterDate('2027-02-29')).toBe(false);
    expect(isValidFilterDate('2028-02-29')).toBe(true);
    expect(isValidFilterDate('1.1.2027')).toBe(false);
  });
});
