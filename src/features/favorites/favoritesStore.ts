import { create } from 'zustand';
import { apiClient } from '@/api';
import type { ApiClient } from '@/api/client';
import { withAuth } from '@/features/auth/session';
import { readJson, removeKey, writeJson } from '@/storage/kv';

type PendingOps = Record<string, 'add' | 'remove'>;

type FavoritesState = {
  username: string | null;
  ids: string[];
  pending: PendingOps;
  load: (username: string) => Promise<void>;
  sync: (client?: ApiClient) => Promise<void>;
  toggle: (offerId: string, client?: ApiClient) => Promise<void>;
  reset: (purge?: boolean) => Promise<void>;
};

const idsKey = (username: string) => `favorites:${username}`;
const pendingKey = (username: string) => `favorites-pending:${username}`;

function applyPending(ids: readonly string[], pending: PendingOps): string[] {
  const set = new Set(ids);
  for (const [offerId, op] of Object.entries(pending)) {
    if (op === 'add') set.add(offerId);
    else set.delete(offerId);
  }
  return [...set];
}

export const useFavoritesStore = create<FavoritesState>((set, get) => {
  const persist = async () => {
    const { username, ids, pending } = get();
    if (username) {
      await writeJson(idsKey(username), ids);
      await writeJson(pendingKey(username), pending);
    }
  };

  return {
    username: null,
    ids: [],
    pending: {},

    load: async (username) => {
      const ids = (await readJson<string[]>(idsKey(username))) ?? [];
      const pending = (await readJson<PendingOps>(pendingKey(username))) ?? {};
      set({ username, ids, pending });
    },

    // Pushes queued local changes, then adopts the server list plus whatever is still queued.
    sync: async (client = apiClient) => {
      const { username } = get();
      if (!username) return;
      const sent = { ...get().pending };
      const done: string[] = [];
      try {
        for (const [offerId, op] of Object.entries(sent)) {
          await withAuth(
            (token) =>
              op === 'add'
                ? client.addFavorite(token, offerId)
                : client.removeFavorite(token, offerId),
            client,
          );
          done.push(offerId);
        }
        const serverIds = await withAuth(
          (token) => client.getFavorites(token),
          client,
        );
        if (get().username === username) {
          const pending = dropSent(get().pending, sent, done);
          set({ pending, ids: applyPending(serverIds, pending) });
        }
      } catch {
        if (get().username === username) {
          set({ pending: dropSent(get().pending, sent, done) });
        }
      }
      if (get().username === username) await persist();
    },

    toggle: async (offerId, client = apiClient) => {
      const { username, ids } = get();
      if (!username) return;
      const adding = !ids.includes(offerId);
      set({
        ids: adding ? [...ids, offerId] : ids.filter((id) => id !== offerId),
        pending: { ...get().pending, [offerId]: adding ? 'add' : 'remove' },
      });
      await persist();
      await get().sync(client);
    },

    reset: async (purge = false) => {
      const previous = get().username;
      set({ username: null, ids: [], pending: {} });
      if (purge && previous) {
        await removeKey(idsKey(previous));
        await removeKey(pendingKey(previous));
      }
    },
  };
});

// Keeps operations the user changed while a sync was in flight.
function dropSent(
  current: PendingOps,
  sent: PendingOps,
  done: readonly string[],
): PendingOps {
  const next = { ...current };
  for (const offerId of done) {
    if (next[offerId] === sent[offerId]) delete next[offerId];
  }
  return next;
}
