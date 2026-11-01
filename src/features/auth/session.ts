import { apiClient } from '@/api';
import { ApiError, type ApiClient, type AuthResponse } from '@/api/client';
import type { User } from '@/domain/types';
import { useAuthStore } from '@/state/authStore';
import { secureStorage } from '@/storage/secure';

const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';

async function persistTokens(accessToken: string, refreshToken: string) {
  await secureStorage.set(ACCESS_KEY, accessToken);
  await secureStorage.set(REFRESH_KEY, refreshToken);
}

export async function clearSession(): Promise<void> {
  useAuthStore.getState().clearUser();
  await secureStorage.remove(ACCESS_KEY);
  await secureStorage.remove(REFRESH_KEY);
}

export async function login(
  username: string,
  password: string,
  client: ApiClient = apiClient,
): Promise<User> {
  const response = await client.login({ username: username.trim(), password });
  if (!response.user.isActive) {
    throw new ApiError('Account is inactive', 401);
  }
  await persistTokens(response.accessToken, response.refreshToken);
  useAuthStore.getState().setSession(response);
  return response.user;
}

export async function applyProfileResult(result: AuthResponse): Promise<void> {
  await persistTokens(result.accessToken, result.refreshToken);
  useAuthStore.getState().setSession(result);
}

let pendingRefresh: Promise<string> | null = null;

export function refreshAccessToken(
  client: ApiClient = apiClient,
): Promise<string> {
  pendingRefresh ??= (async () => {
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      await clearSession();
      throw new ApiError('Authentication required', 401);
    }
    try {
      const tokens = await client.refresh(refreshToken);
      useAuthStore.getState().setTokens(tokens);
      await persistTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearSession();
      }
      throw error;
    }
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

// Runs an authenticated call, refreshing the access token once on a 401.
export async function withAuth<T>(
  call: (accessToken: string) => Promise<T>,
  client: ApiClient = apiClient,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) {
    throw new ApiError('Authentication required', 401);
  }
  try {
    return await call(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return call(await refreshAccessToken(client));
    }
    throw error;
  }
}

export async function restoreSession(
  client: ApiClient = apiClient,
): Promise<User | null> {
  const accessToken = await secureStorage.get(ACCESS_KEY);
  const refreshToken = await secureStorage.get(REFRESH_KEY);
  if (!accessToken || !refreshToken) {
    return null;
  }
  useAuthStore.getState().setTokens({ accessToken, refreshToken });
  try {
    const user = await withAuth((token) => client.getMe(token), client);
    if (!user.isActive) {
      await clearSession();
      return null;
    }
    useAuthStore.getState().setUser(user);
    return user;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      // Server unreachable: stay a guest for now but keep the stored tokens.
      useAuthStore.getState().clearUser();
    }
    return null;
  }
}
