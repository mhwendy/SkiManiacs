import { useEffect } from 'react';
import { queryClient } from '@/api/queryClient';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { MEMBER_CACHE_KEY } from '@/features/offers/useOffers';
import { useAuthStore } from '@/state/authStore';
import { removeKey } from '@/storage/kv';
import { restoreSession } from './session';

// Restores the stored session on startup and keeps favorites in step with who is signed in.
export function useSessionBootstrap() {
  const username = useAuthStore((state) => state.user?.username ?? null);

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (username) {
      void useFavoritesStore
        .getState()
        .load(username)
        .then(() => useFavoritesStore.getState().sync());
    } else {
      void useFavoritesStore.getState().reset();
      void removeKey(MEMBER_CACHE_KEY);
    }
    void queryClient.invalidateQueries();
  }, [username]);
}
