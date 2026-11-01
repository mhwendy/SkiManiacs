import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError, type ApiClient } from '@/api/client';
import { authErrorKey } from '@/features/auth/errors';
import {
  clearSession,
  login,
  restoreSession,
  withAuth,
} from '@/features/auth/session';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { deleteAccount } from '@/app/(drawer)/account';
import { MockApiClient } from '@/api/mockClient';
import { useAuthStore } from '@/state/authStore';
import { secureStorage } from '@/storage/secure';
import type { User } from '@/domain/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('expo-image', () => ({ Image: 'View' }));

const member: User = {
  username: 'ana',
  name: 'Ana',
  surname: 'K',
  email: 'ana@example.com',
  isAdmin: false,
  isActive: true,
};

function stub(overrides: Partial<ApiClient>): ApiClient {
  return overrides as ApiClient;
}

beforeEach(async () => {
  await clearSession();
  await useFavoritesStore.getState().reset(true);
});

describe('session', () => {
  it('logs in, stores tokens and clears them on logout', async () => {
    const client = new MockApiClient();
    const user = await login('ana', 'Secret!1', client);
    expect(user.username).toBe('ana');
    expect(useAuthStore.getState().user?.username).toBe('ana');
    expect(await secureStorage.get('auth.accessToken')).toBeTruthy();
    await clearSession();
    expect(useAuthStore.getState().user).toBeNull();
    expect(await secureStorage.get('auth.accessToken')).toBeNull();
  });

  it('rejects wrong passwords and inactive users', async () => {
    const client = new MockApiClient();
    await login('ana', 'Secret!1', client);
    await expect(login('ana', 'wrong', client)).rejects.toMatchObject({
      status: 401,
    });
    await clearSession();
    const inactive = stub({
      login: async () => ({
        accessToken: 'a',
        refreshToken: 'r',
        user: { ...member, isActive: false },
      }),
    });
    await expect(login('ana', 'x', inactive)).rejects.toMatchObject({
      status: 401,
    });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('refreshes the token once after a 401 and retries', async () => {
    useAuthStore.getState().setSession({
      user: member,
      accessToken: 'old',
      refreshToken: 'refresh',
    });
    const refresh = jest.fn(async () => ({
      accessToken: 'new',
      refreshToken: 'refresh2',
    }));
    const client = stub({ refresh });
    const call = jest.fn(async (token: string) => {
      if (token === 'old') throw new ApiError('expired', 401);
      return token;
    });
    await expect(withAuth(call, client)).resolves.toBe('new');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().refreshToken).toBe('refresh2');
  });

  it('clears the session when the refresh token is rejected', async () => {
    useAuthStore.getState().setSession({
      user: member,
      accessToken: 'old',
      refreshToken: 'refresh',
    });
    const client = stub({
      refresh: async () => {
        throw new ApiError('bad', 401);
      },
    });
    await expect(
      withAuth(async () => {
        throw new ApiError('expired', 401);
      }, client),
    ).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('restores a stored session, and stays a guest offline', async () => {
    await secureStorage.set('auth.accessToken', 'a');
    await secureStorage.set('auth.refreshToken', 'r');
    const online = stub({ getMe: async () => member });
    expect((await restoreSession(online))?.username).toBe('ana');

    useAuthStore.getState().clearUser();
    const offline = stub({
      getMe: async () => {
        throw new ApiError('network', 0);
      },
    });
    expect(await restoreSession(offline)).toBeNull();
    expect(await secureStorage.get('auth.refreshToken')).toBe('r');
  });

  it('maps errors to localized keys', () => {
    expect(authErrorKey(new ApiError('x', 401), 'f')).toBe(
      'auth.invalidCredentials',
    );
    expect(authErrorKey(new TypeError('net'), 'f')).toBe(
      'auth.serverUnreachable',
    );
    expect(authErrorKey(new ApiError('Email already exists', 409), 'f')).toBe(
      'auth.emailExists',
    );
    expect(
      authErrorKey(new ApiError('current_password_incorrect', 400), 'f'),
    ).toBe('auth.currentPasswordIncorrect');
    expect(authErrorKey(new ApiError('nope', 400), 'fallback')).toBe(
      'fallback',
    );
  });
});

describe('favorites', () => {
  it('toggles optimistically and syncs with the server', async () => {
    const server = new Set<string>();
    const client = stub({
      getFavorites: async () => [...server],
      addFavorite: async (_t, id) => void server.add(id),
      removeFavorite: async (_t, id) => void server.delete(id),
    });
    useAuthStore
      .getState()
      .setSession({ user: member, accessToken: 't', refreshToken: 'r' });
    await useFavoritesStore.getState().load('ana');
    await useFavoritesStore.getState().toggle('offer001', client);
    expect(useFavoritesStore.getState().ids).toContain('offer001');
    expect(server.has('offer001')).toBe(true);
    await useFavoritesStore.getState().toggle('offer001', client);
    expect(useFavoritesStore.getState().ids).not.toContain('offer001');
    expect(server.size).toBe(0);
  });

  it('keeps changes made offline and pushes them later', async () => {
    useAuthStore
      .getState()
      .setSession({ user: member, accessToken: 't', refreshToken: 'r' });
    await useFavoritesStore.getState().load('ana');
    const offline = stub({
      getFavorites: async () => {
        throw new ApiError('network', 0);
      },
      addFavorite: async () => {
        throw new ApiError('network', 0);
      },
    });
    await useFavoritesStore.getState().toggle('offer002', offline);
    expect(useFavoritesStore.getState().ids).toContain('offer002');
    expect(useFavoritesStore.getState().pending).toEqual({
      offer002: 'add',
    });

    const server = new Set<string>();
    const online = stub({
      getFavorites: async () => [...server],
      addFavorite: async (_t, id) => void server.add(id),
    });
    await useFavoritesStore.getState().sync(online);
    expect(server.has('offer002')).toBe(true);
    expect(useFavoritesStore.getState().pending).toEqual({});
  });
});

describe('account deletion', () => {
  it('deletes the account, purges favorites and ends the session', async () => {
    const client = new MockApiClient();
    await login('ana', 'Secret!1', client);
    await useFavoritesStore.getState().load('ana');
    await deleteAccount(client);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useFavoritesStore.getState().ids).toEqual([]);
  });

  it('requires the current password to change the password', async () => {
    const client = new MockApiClient();
    await login('ana', 'Secret!1', client);
    await expect(
      client.updateMe('local-mock-access-token', {
        newPassword: 'Newpass!1',
        currentPassword: 'x',
      }),
    ).rejects.toMatchObject({ message: 'current_password_incorrect' });
    await client.updateMe('local-mock-access-token', {
      newPassword: 'Newpass!1',
      currentPassword: 'Secret!1',
    });
    await expect(login('ana', 'Secret!1', client)).rejects.toMatchObject({
      status: 401,
    });
    await expect(login('ana', 'Newpass!1', client)).resolves.toBeTruthy();
  });
});
