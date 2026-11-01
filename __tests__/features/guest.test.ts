import { describe, expect, it } from '@jest/globals';
import { MockApiClient } from '@/api/mockClient';
import { ApiError, type ApiClient } from '@/api/client';
import { mockOffers } from '@/api/mockOffers';
import { loadGuestOffers } from '@/features/offers/useOffers';
import { useLanguageStore } from '@/state/languageStore';
import { readJson } from '@/storage/kv';
import legal from '@/content/legal.json';

describe('guest offer loading', () => {
  it('never exposes price or availability data, even from a leaky API', async () => {
    const leaky = {
      getOffers: async () => mockOffers,
    } as unknown as ApiClient;
    const { offers, stale } = await loadGuestOffers(leaky);
    expect(stale).toBe(false);
    expect(offers).toHaveLength(mockOffers.length);
    for (const offer of offers) {
      expect(offer.price).toBeNull();
      expect(offer.priceAmount).toBeNull();
      expect(offer.availablePlaces).toBeNull();
      expect(offer.applicationDeadline).toBeNull();
    }
    const cached = JSON.stringify(await readJson('offers-cache:guest'));
    expect(cached).not.toContain('899');
    expect(cached).not.toContain('availablePlaces":"12');
  });

  it('serves the cache with a reason when the network fails', async () => {
    await loadGuestOffers(new MockApiClient());
    const failing = {
      getOffers: async () => {
        throw new ApiError('offline', 503);
      },
    } as unknown as ApiClient;
    const result = await loadGuestOffers(failing);
    expect(result.stale).toBe(true);
    expect(result.reason).toBe('offline');
    expect(result.offers.length).toBeGreaterThan(0);
  });
});

describe('language persistence', () => {
  it('stores the chosen language and restores it', async () => {
    useLanguageStore.getState().setLanguage('en');
    await Promise.resolve();
    useLanguageStore.setState({ language: 'sr' });
    await useLanguageStore.getState().hydrate();
    expect(useLanguageStore.getState().language).toBe('en');
    useLanguageStore.getState().setLanguage('sr');
  });
});

describe('legal content', () => {
  it('has both languages for terms and privacy', () => {
    for (const kind of ['terms', 'privacy'] as const) {
      for (const language of ['sr', 'en'] as const) {
        expect(legal[kind][language].sections.length).toBeGreaterThan(5);
      }
    }
  });
});
