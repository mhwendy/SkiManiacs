import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { hashPassword, verifyPassword } from '../src/passwords';
import { signToken } from '../src/tokens';

const SECRET = 'test-secret-test-secret-test-secret-123';

const SCHEMA = [
  `CREATE TABLE favorites (userId TEXT NOT NULL, offerId TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (userId, offerId))`,
  `CREATE TABLE offers (id INTEGER PRIMARY KEY NOT NULL, title_sr TEXT NOT NULL, title_en TEXT, priceAmount REAL, currency TEXT DEFAULT 'EUR', category_sr TEXT, category_en TEXT, location_sr TEXT, location_en TEXT, startDate DATE, endDate DATE, description_sr TEXT, description_en TEXT, imageUrl TEXT, imageUrl2 TEXT, imageUrl3 TEXT, imageUrl4 TEXT, imageUrl5 TEXT, availablePlaces INTEGER, applicationDeadline DATE, updatedAt DATE, updatedBy TEXT, isPriceComingSoon INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE users (username TEXT NOT NULL PRIMARY KEY, name TEXT, surname TEXT, email TEXT, password TEXT NOT NULL, isAdmin INTEGER NOT NULL DEFAULT 0 CHECK (isAdmin IN (0, 1)), isActive INTEGER NOT NULL DEFAULT 1)`,
  `CREATE UNIQUE INDEX index_users_email ON users(email)`,
];

let db: Client;
let app: ReturnType<typeof createApp>;

async function addUser(
  username: string,
  password: string,
  extra: { isActive?: number; isAdmin?: number } = {},
) {
  await db.execute({
    sql: 'INSERT INTO users (username, name, surname, email, password, isAdmin, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [
      username,
      'Ana',
      'K',
      `${username}@example.com`,
      await hashPassword(password),
      extra.isAdmin ?? 0,
      extra.isActive ?? 1,
    ],
  });
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
) {
  const response = await app.request(path, {
    method,
    headers: {
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
  };
}

async function loginAs(username: string, password: string) {
  const { json } = await call('POST', '/auth/login', {
    body: { username, password },
  });
  return json as { accessToken: string; refreshToken: string };
}

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  for (const sql of SCHEMA) await db.execute(sql);
  await db.execute(
    `INSERT INTO offers (id, title_sr, title_en, priceAmount, currency, startDate, availablePlaces, applicationDeadline, updatedAt, isPriceComingSoon) VALUES (1, 'Ski', 'Ski trip', 540, 'EUR', '2026-12-05', 34, '2026-12-01', '2026-09-26', 0), (2, 'Leto', 'Summer', NULL, 'EUR', '2027-07-01', 0, NULL, NULL, 1)`,
  );
  await addUser('ana', 'Secret!1');
  await addUser('off', 'Secret!1', { isActive: 0 });
  await addUser('bob', 'Secret!1');
  app = createApp({
    db,
    jwtSecret: SECRET,
    allowedOrigins: ['http://localhost:8081'],
  });
});

describe('passwords', () => {
  it('verifies a hash produced by the Android PasswordHasher', async () => {
    // Generated with the same algorithm: PBKDF2WithHmacSHA256, 120000 iterations, 256-bit key.
    const stored = await hashPassword('Hello!9');
    expect(await verifyPassword('Hello!9', stored)).toBe(true);
    expect(await verifyPassword('hello!9', stored)).toBe(false);
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
  });
});

describe('auth', () => {
  it('logs in with valid credentials and hides the password', async () => {
    const { status, json } = await call('POST', '/auth/login', {
      body: { username: 'ana', password: 'Secret!1' },
    });
    expect(status).toBe(200);
    expect(json.user).toMatchObject({ username: 'ana', isAdmin: false });
    expect(json.user.password).toBeUndefined();
    expect(json.accessToken).toBeTruthy();
  });

  it('rejects wrong password, unknown and inactive users with the same 401', async () => {
    for (const body of [
      { username: 'ana', password: 'nope' },
      { username: 'ghost', password: 'Secret!1' },
      { username: 'off', password: 'Secret!1' },
      { username: '', password: '' },
    ]) {
      const result = await call('POST', '/auth/login', { body });
      expect(result.status).toBe(401);
      expect(result.json).toEqual({ error: 'Invalid credentials' });
    }
  });

  it('refreshes tokens, and rejects access tokens and deactivated users', async () => {
    const tokens = await loginAs('ana', 'Secret!1');
    const ok = await call('POST', '/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.accessToken).toBeTruthy();

    const wrongKind = await call('POST', '/auth/refresh', {
      body: { refreshToken: tokens.accessToken },
    });
    expect(wrongKind.status).toBe(401);

    await db.execute("UPDATE users SET isActive = 0 WHERE username = 'ana'");
    const inactive = await call('POST', '/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    expect(inactive.status).toBe(401);
    expect(
      (await call('GET', '/me', { token: tokens.accessToken })).status,
    ).toBe(401);
  });

  it('rejects tokens signed with another secret and refresh tokens as access', async () => {
    const forged = await signToken(
      'another-secret-another-secret-123456',
      'access',
      'ana',
    );
    expect((await call('GET', '/me', { token: forged })).status).toBe(401);
    const tokens = await loginAs('ana', 'Secret!1');
    expect(
      (await call('GET', '/me', { token: tokens.refreshToken })).status,
    ).toBe(401);
  });
});

describe('offers', () => {
  it('strips member-only fields for guests', async () => {
    const { json } = await call('GET', '/offers');
    expect(json).toHaveLength(2);
    for (const offer of json) {
      for (const field of [
        'price',
        'priceAmount',
        'currency',
        'isPriceComingSoon',
        'availablePlaces',
        'applicationDeadline',
      ]) {
        expect(offer).not.toHaveProperty(field);
      }
    }
    const one = await call('GET', '/offers/1');
    expect(one.json).not.toHaveProperty('priceAmount');
    expect(one.json.title_en).toBe('Ski trip');
  });

  it('returns full offers for members, with app-shaped values', async () => {
    const { accessToken } = await loginAs('ana', 'Secret!1');
    const { json } = await call('GET', '/offers', { token: accessToken });
    expect(json[0]).toMatchObject({
      id: '1',
      priceAmount: 540,
      currency: 'EUR',
      availablePlaces: '34',
      applicationDeadline: '2026-12-01',
      isPriceComingSoon: false,
    });
    expect(json[1]).toMatchObject({
      priceAmount: null,
      isPriceComingSoon: true,
      availablePlaces: '0',
    });
  });

  it('returns 401 for an invalid token instead of guest data, and 404 for missing offers', async () => {
    expect((await call('GET', '/offers', { token: 'garbage' })).status).toBe(
      401,
    );
    expect((await call('GET', '/offers/99')).status).toBe(404);
    expect((await call('GET', '/offers/abc')).status).toBe(404);
  });
});

describe('favorites', () => {
  it('adds and removes idempotently, and lists newest first', async () => {
    const { accessToken: token } = await loginAs('ana', 'Secret!1');
    expect((await call('PUT', '/me/favorites/1', { token })).status).toBe(204);
    expect((await call('PUT', '/me/favorites/1', { token })).status).toBe(204);
    expect((await call('PUT', '/me/favorites/2', { token })).status).toBe(204);
    expect((await call('GET', '/me/favorites', { token })).json).toHaveLength(
      2,
    );
    expect((await call('DELETE', '/me/favorites/1', { token })).status).toBe(
      204,
    );
    expect((await call('DELETE', '/me/favorites/1', { token })).status).toBe(
      204,
    );
    expect((await call('GET', '/me/favorites', { token })).json).toEqual(['2']);
  });

  it('keeps favorites per user and requires authentication', async () => {
    const ana = (await loginAs('ana', 'Secret!1')).accessToken;
    const bob = (await loginAs('bob', 'Secret!1')).accessToken;
    await call('PUT', '/me/favorites/1', { token: ana });
    expect((await call('GET', '/me/favorites', { token: bob })).json).toEqual(
      [],
    );
    expect((await call('GET', '/me/favorites')).status).toBe(401);
    expect((await call('PUT', '/me/favorites/99', { token: ana })).status).toBe(
      404,
    );
  });
});

describe('profile', () => {
  it('updates the profile and returns the user', async () => {
    const { accessToken: token } = await loginAs('ana', 'Secret!1');
    const { status, json } = await call('PATCH', '/me', {
      token,
      body: { name: 'Anna', email: 'anna@example.com' },
    });
    expect(status).toBe(200);
    expect(json.user).toMatchObject({
      username: 'ana',
      name: 'Anna',
      email: 'anna@example.com',
    });
  });

  it('renames the user, moves favorites and returns working tokens', async () => {
    const { accessToken: token } = await loginAs('ana', 'Secret!1');
    await call('PUT', '/me/favorites/1', { token });
    const { json } = await call('PATCH', '/me', {
      token,
      body: { username: 'ana2' },
    });
    expect(json.user.username).toBe('ana2');
    const favorites = await call('GET', '/me/favorites', {
      token: json.accessToken,
    });
    expect(favorites.json).toEqual(['1']);
    expect(
      (
        await call('POST', '/auth/refresh', {
          body: { refreshToken: json.refreshToken },
        })
      ).status,
    ).toBe(200);
  });

  it('returns 409 for duplicate username or email', async () => {
    const { accessToken: token } = await loginAs('ana', 'Secret!1');
    const username = await call('PATCH', '/me', {
      token,
      body: { username: 'bob' },
    });
    expect(username).toMatchObject({
      status: 409,
      json: { error: 'Username already exists' },
    });
    const email = await call('PATCH', '/me', {
      token,
      body: { email: 'BOB@example.com' },
    });
    expect(email).toMatchObject({
      status: 409,
      json: { error: 'Email already exists' },
    });
  });

  it('changes the password only with the correct current one and a valid new one', async () => {
    const { accessToken: token } = await loginAs('ana', 'Secret!1');
    const wrong = await call('PATCH', '/me', {
      token,
      body: { currentPassword: 'bad', newPassword: 'Newpass!1' },
    });
    expect(wrong).toMatchObject({
      status: 400,
      json: { error: 'current_password_incorrect' },
    });
    const weak = await call('PATCH', '/me', {
      token,
      body: { currentPassword: 'Secret!1', newPassword: 'weak' },
    });
    expect(weak).toMatchObject({
      status: 400,
      json: { error: 'invalid_password' },
    });
    const ok = await call('PATCH', '/me', {
      token,
      body: { currentPassword: 'Secret!1', newPassword: 'Newpass!1' },
    });
    expect(ok.status).toBe(200);
    expect(
      (
        await call('POST', '/auth/login', {
          body: { username: 'ana', password: 'Secret!1' },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call('POST', '/auth/login', {
          body: { username: 'ana', password: 'Newpass!1' },
        })
      ).status,
    ).toBe(200);
  });

  it('deletes the account with its favorites and invalidates the tokens', async () => {
    const tokens = await loginAs('ana', 'Secret!1');
    await call('PUT', '/me/favorites/1', { token: tokens.accessToken });
    expect(
      (await call('DELETE', '/me', { token: tokens.accessToken })).status,
    ).toBe(204);
    const left = await db.execute(
      "SELECT count(*) n FROM favorites WHERE userId = 'ana'",
    );
    expect(Number(left.rows[0].n)).toBe(0);
    expect(
      (await call('GET', '/me', { token: tokens.accessToken })).status,
    ).toBe(401);
    expect(
      (
        await call('POST', '/auth/refresh', {
          body: { refreshToken: tokens.refreshToken },
        })
      ).status,
    ).toBe(401);
  });
});

describe('http', () => {
  it('allows only configured CORS origins', async () => {
    const allowed = await app.request('/offers', {
      headers: { Origin: 'http://localhost:8081' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:8081',
    );
    const denied = await app.request('/offers', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('returns JSON 404 and rejects oversized bodies', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
    const big = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'a'.repeat(200_000), password: 'x' }),
    });
    expect(big.status).toBe(413);
  });
});
