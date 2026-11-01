import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api';
import type { ApiClient } from '@/api/client';
import type { Offer } from '@/domain/types';
import { withAuth } from '@/features/auth/session';
import { useAuthStore } from '@/state/authStore';
import { readJson, writeJson } from '@/storage/kv';
import { toGuestView } from './helpers';

export const GUEST_CACHE_KEY = 'offers-cache:guest';
export const MEMBER_CACHE_KEY = 'offers-cache:member';

export type OffersResult = {
  offers: Offer[];
  stale: boolean;
  reason: string | null;
};

async function loadWithCache(
  fetchOffers: () => Promise<Offer[]>,
  cacheKey: string,
  prepare: (offers: Offer[]) => Offer[],
  canUseCache: () => boolean = () => true,
): Promise<OffersResult> {
  try {
    const offers = prepare(await fetchOffers());
    await writeJson(cacheKey, offers);
    return { offers, stale: false, reason: null };
  } catch (error) {
    const cached = canUseCache() ? await readJson<Offer[]>(cacheKey) : null;
    if (cached && cached.length > 0) {
      return {
        offers: prepare(cached),
        stale: true,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    throw error;
  }
}

export function loadGuestOffers(
  client: ApiClient = apiClient,
): Promise<OffersResult> {
  return loadWithCache(
    async () => (await client.getOffers()) as Offer[],
    GUEST_CACHE_KEY,
    (offers) => offers.map(toGuestView),
  );
}

export function loadMemberOffers(
  client: ApiClient = apiClient,
): Promise<OffersResult> {
  return loadWithCache(
    async () =>
      (await withAuth((token) => client.getOffers(token), client)) as Offer[],
    MEMBER_CACHE_KEY,
    (offers) => offers,
    // A session that just expired must not fall back to member-only data.
    () => useAuthStore.getState().user !== null,
  );
}

export function useOffers() {
  const username = useAuthStore((state) => state.user?.username ?? null);
  return useQuery({
    queryKey: ['offers', username ?? 'guest'],
    queryFn: () => (username ? loadMemberOffers() : loadGuestOffers()),
  });
}

export function useOffer(id: string) {
  const username = useAuthStore((state) => state.user?.username ?? null);
  return useQuery({
    queryKey: ['offer', username ?? 'guest', id],
    queryFn: async () =>
      username
        ? ((await withAuth((token) => apiClient.getOffer(id, token))) as Offer)
        : toGuestView((await apiClient.getOffer(id)) as Offer),
  });
}
