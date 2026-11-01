import {
  ApiError,
  type ApiClient,
  type AuthResponse,
  type ProfileResult,
  type ProfileUpdate,
} from './client';
import type { GuestOffer } from '@/domain/offers';
import type { Offer, User } from '@/domain/types';

const REQUEST_TIMEOUT_MS = 15_000;

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

function notAvailable(): never {
  throw new ApiError('Admin API is not available in this build', 501);
}

export class HttpApiClient implements ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // Network failures and timeouts become status 0 so the UI can show "server unreachable".
  private async request<T>(
    path: string,
    { method = 'GET', token, body }: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Network request failed', 0);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let message = response.statusText || 'Request failed';
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // Keep the status text when the body is not JSON.
      }
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError('Invalid server response', 0);
    }
  }

  login(input: { username: string; password: string }) {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
    });
  }

  refresh(refreshToken: string) {
    return this.request<Pick<AuthResponse, 'accessToken' | 'refreshToken'>>(
      '/auth/refresh',
      { method: 'POST', body: { refreshToken } },
    );
  }

  getOffers(accessToken?: string) {
    return this.request<(GuestOffer | Offer)[]>('/offers', {
      token: accessToken,
    });
  }

  getOffer(id: string, accessToken?: string) {
    return this.request<GuestOffer | Offer>(
      `/offers/${encodeURIComponent(id)}`,
      { token: accessToken },
    );
  }

  getMe(accessToken: string) {
    return this.request<User>('/me', { token: accessToken });
  }

  updateMe(accessToken: string, update: ProfileUpdate) {
    return this.request<ProfileResult>('/me', {
      method: 'PATCH',
      token: accessToken,
      body: update,
    });
  }

  deleteMe(accessToken: string) {
    return this.request<void>('/me', { method: 'DELETE', token: accessToken });
  }

  getFavorites(accessToken: string) {
    return this.request<string[]>('/me/favorites', { token: accessToken });
  }

  addFavorite(accessToken: string, offerId: string) {
    return this.request<void>(`/me/favorites/${encodeURIComponent(offerId)}`, {
      method: 'PUT',
      token: accessToken,
    });
  }

  removeFavorite(accessToken: string, offerId: string) {
    return this.request<void>(`/me/favorites/${encodeURIComponent(offerId)}`, {
      method: 'DELETE',
      token: accessToken,
    });
  }

  // Admin endpoints arrive in Phase 4.
  createOffer = notAvailable;
  updateOffer = notAvailable;
  deleteOffer = notAvailable;
  signUpload = notAvailable;
  importOffers = notAvailable;
  getUsers = notAvailable;
  createUser = notAvailable;
  updateUser = notAvailable;
  deleteUser = notAvailable;
}
