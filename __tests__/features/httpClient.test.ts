import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '@/api/client';
import { HttpApiClient } from '@/api/httpClient';

const originalFetch = globalThis.fetch;

function mockFetch(response: Partial<Response> & { json?: () => unknown }) {
  const fn = jest.fn(async () => response as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('HttpApiClient', () => {
  const client = new HttpApiClient('https://api.example.com/');

  it('sends JSON and the bearer token to the right URL', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ username: 'ana' }),
    });
    await client.getMe('tok');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://api.example.com/me');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok',
    );

    await client.login({ username: 'ana', password: 'x' });
    const [, loginInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(loginInit.method).toBe('POST');
    expect(loginInit.body).toBe(
      JSON.stringify({ username: 'ana', password: 'x' }),
    );
  });

  it('does not send an Authorization header for guests', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => [],
    });
    await client.getOffers();
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it('turns error bodies into ApiError with the status', async () => {
    mockFetch({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({ error: 'Email already exists' }),
    });
    await expect(client.updateMe('t', { email: 'a@b.co' })).rejects.toEqual(
      expect.objectContaining({ message: 'Email already exists', status: 409 }),
    );
  });

  it('maps network failures to status 0', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const error = await client.getOffers().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it('handles 204 responses and encodes ids', async () => {
    const fetchMock = mockFetch({ ok: true, status: 204 });
    await expect(client.addFavorite('t', 'a/b')).resolves.toBeUndefined();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://api.example.com/me/favorites/a%2Fb');
  });
});
