import { createClient, type Client } from '@libsql/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { parseCsv } from '../src/csv';
import { hashPassword } from '../src/passwords';
import { createRateLimiter } from '../src/rateLimit';

const SECRET = 'test-secret-test-secret-test-secret-123';

const SCHEMA = [
  `CREATE TABLE favorites (userId TEXT NOT NULL, offerId TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY (userId, offerId))`,
  `CREATE TABLE offers (id INTEGER PRIMARY KEY NOT NULL, title_sr TEXT NOT NULL, title_en TEXT, priceAmount REAL, currency TEXT DEFAULT 'EUR', category_sr TEXT, category_en TEXT, location_sr TEXT, location_en TEXT, startDate DATE, endDate DATE, description_sr TEXT, description_en TEXT, imageUrl TEXT, imageUrl2 TEXT, imageUrl3 TEXT, imageUrl4 TEXT, imageUrl5 TEXT, availablePlaces INTEGER, applicationDeadline DATE, updatedAt DATE, updatedBy TEXT, isPriceComingSoon INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE users (username TEXT NOT NULL PRIMARY KEY, name TEXT, surname TEXT, email TEXT, password TEXT NOT NULL, isAdmin INTEGER NOT NULL DEFAULT 0 CHECK (isAdmin IN (0, 1)), isActive INTEGER NOT NULL DEFAULT 1)`,
  `CREATE UNIQUE INDEX index_users_email ON users(email)`,
];

let db: Client;
let app: ReturnType<typeof createApp>;
let logs: string[];

async function addUser(username: string, isAdmin = 0) {
  await db.execute({
    sql: 'INSERT INTO users (username, name, surname, email, password, isAdmin, isActive) VALUES (?, ?, ?, ?, ?, ?, 1)',
    args: [
      username,
      'N',
      'S',
      `${username}@example.com`,
      await hashPassword('Secret!1'),
      isAdmin,
    ],
  });
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; raw?: string } = {},
) {
  const response = await app.request(path, {
    method,
    headers: {
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(options.raw !== undefined && { 'Content-Type': 'text/csv' }),
    },
    body:
      options.raw ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function login(username: string) {
  const { json } = await call('POST', '/auth/login', {
    body: { username, password: 'Secret!1' },
  });
  return json.accessToken as string;
}

const OFFER = {
  title_sr: 'Zima',
  title_en: 'Winter',
  priceAmount: 300,
  currency: 'EUR',
  startDate: '2027-01-10',
  endDate: '2027-01-15',
  availablePlaces: 10,
  applicationDeadline: '2027-01-01',
  imageUrl: 'https://example.com/a.jpg',
  imageUrl3: 'https://example.com/c.jpg',
};

beforeEach(async () => {
  db = createClient({ url: ':memory:' });
  for (const sql of SCHEMA) await db.execute(sql);
  await addUser('root', 1);
  await addUser('ana');
  logs = [];
  app = createApp({ db, jwtSecret: SECRET, logger: (line) => logs.push(line) });
});

describe('admin authorization', () => {
  it('rejects guests and non-admin users on every admin endpoint', async () => {
    const member = await login('ana');
    const endpoints: [string, string, unknown?][] = [
      ['POST', '/offers', OFFER],
      ['PUT', '/offers/1', OFFER],
      ['DELETE', '/offers/1'],
      ['POST', '/offers/import'],
      ['GET', '/users'],
      ['POST', '/users', { username: 'x' }],
      ['PATCH', '/users/ana', { name: 'x' }],
      ['DELETE', '/users/ana'],
    ];
    for (const [method, path, body] of endpoints) {
      const guest = await call(method, path, { body });
      expect(guest.status, `guest ${method} ${path}`).toBe(401);
      const asMember = await call(method, path, { token: member, body });
      expect(asMember.status, `member ${method} ${path}`).toBe(403);
    }
  });
});

describe('admin offers', () => {
  it('creates, updates and deletes an offer; images are packed and favorites cleaned', async () => {
    const token = await login('root');
    const created = await call('POST', '/offers', { token, body: OFFER });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      title_sr: 'Zima',
      imageUrl: 'https://example.com/a.jpg',
      imageUrl2: 'https://example.com/c.jpg',
      imageUrl3: null,
      updatedBy: 'root',
    });
    const id = created.json.id as string;

    const updated = await call('PUT', `/offers/${id}`, {
      token,
      body: {
        ...OFFER,
        title_sr: 'Zima 2',
        isPriceComingSoon: true,
        priceAmount: null,
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.json).toMatchObject({
      title_sr: 'Zima 2',
      isPriceComingSoon: true,
    });

    await db.execute({
      sql: 'INSERT INTO favorites VALUES (?, ?, ?)',
      args: ['ana', id, 1],
    });
    expect((await call('DELETE', `/offers/${id}`, { token })).status).toBe(204);
    expect((await call('GET', `/offers/${id}`, { token })).status).toBe(404);
    const left = await db.execute('SELECT * FROM favorites');
    expect(left.rows).toHaveLength(0);
    expect((await call('DELETE', `/offers/${id}`, { token })).status).toBe(404);
    expect(
      (await call('PUT', '/offers/999', { token, body: OFFER })).status,
    ).toBe(404);
  });

  it.each([
    [{ ...OFFER, title_sr: '' }, 'Title'],
    [{ ...OFFER, priceAmount: 'abc' }, 'priceAmount'],
    [{ ...OFFER, currency: 'USD' }, 'currency'],
    [{ ...OFFER, startDate: '2027-02-30' }, 'Invalid date'],
    [{ ...OFFER, endDate: '2026-01-01' }, 'endDate'],
    [{ ...OFFER, availablePlaces: -1 }, 'availablePlaces'],
    [{ ...OFFER, imageUrl: 'javascript:alert(1)' }, 'imageUrl'],
  ])('rejects invalid offer %#', async (body, fragment) => {
    const token = await login('root');
    const result = await call('POST', '/offers', { token, body });
    expect(result.status).toBe(400);
    expect(result.json.error).toContain(fragment);
  });
});

describe('CSV import', () => {
  const HEADER =
    'title_sr,title_en,priceAmount,currency,category_sr,category_en,location_sr,location_en,startDate,endDate,description_sr,description_en,imageUrl,imageUrl2,imageUrl3,imageUrl4,imageUrl5,availablePlaces,applicationDeadline,isPriceComingSoon';

  it('parses quoted commas, newlines and escaped quotes', () => {
    expect(parseCsv('a,"b,c","d\ne","f ""g"""\r\n1,2,3,4\n')).toEqual([
      ['a', 'b,c', 'd\ne', 'f "g"'],
      ['1', '2', '3', '4'],
    ]);
  });

  it('inserts, updates in place on re-import, reports failures and never deletes', async () => {
    const token = await login('root');
    await db.execute(
      `INSERT INTO offers (id, title_sr, startDate, priceAmount) VALUES (50, 'Keep me', '2030-01-01', 1)`,
    );
    const csv = [
      HEADER,
      'Ski,Ski EN,"1,5",EUR,,,"Kopaonik, SRB",,10.01.2027,15.01.2027,"Opis ""x""",,,,,,,20,01.01.2027,ne',
      'Leto,,,EUR,,,,,2027-07-01,,,,,,,,,,,da',
      ',,10,EUR,,,,,,,,,,,,,,,,',
      'Bad,,abc,EUR,,,,,,,,,,,,,,,,',
      'Short,row',
    ].join('\n');
    const first = await call('POST', '/offers/import', { token, raw: csv });
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ inserted: 2, updated: 0, failed: 3 });
    expect(first.json.errors[0]).toContain('Row 4');

    const second = await call('POST', '/offers/import', {
      token,
      raw: csv.replace('"1,5"', '99'),
    });
    expect(second.json).toMatchObject({ inserted: 0, updated: 2, failed: 3 });

    const rows = await db.execute(
      'SELECT title_sr, priceAmount, startDate FROM offers ORDER BY id',
    );
    expect(rows.rows.map((r) => r.title_sr)).toEqual([
      'Keep me',
      'Ski',
      'Leto',
    ]);
    expect(rows.rows[1]).toMatchObject({
      priceAmount: 99,
      startDate: '2027-01-10',
    });
  });

  it('rejects an empty file', async () => {
    const token = await login('root');
    expect(
      (await call('POST', '/offers/import', { token, raw: '' })).status,
    ).toBe(400);
  });
});

describe('admin users', () => {
  it('lists users without password hashes', async () => {
    const token = await login('root');
    const list = await call('GET', '/users', { token });
    expect(list.status).toBe(200);
    expect(list.json).toHaveLength(2);
    expect(JSON.stringify(list.json)).not.toContain('password');
  });

  it('creates a user who can log in, and rejects duplicates and weak passwords', async () => {
    const token = await login('root');
    const body = {
      username: 'new',
      email: 'new@example.com',
      password: 'Strong!1',
      name: 'N',
    };
    const created = await call('POST', '/users', { token, body });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      username: 'new',
      isAdmin: false,
      isActive: true,
    });
    expect((await login('ana')).length).toBeGreaterThan(0);
    const login2 = await call('POST', '/auth/login', {
      body: { username: 'new', password: 'Strong!1' },
    });
    expect(login2.status).toBe(200);

    expect((await call('POST', '/users', { token, body })).status).toBe(409);
    const dupEmail = await call('POST', '/users', {
      token,
      body: { ...body, username: 'other' },
    });
    expect(dupEmail.status).toBe(409);
    const weak = await call('POST', '/users', {
      token,
      body: { ...body, username: 'w', email: 'w@example.com', password: 'a' },
    });
    expect(weak.status).toBe(400);
  });

  it('updates, resets password, renames (moving favorites) and deactivates a user', async () => {
    const token = await login('root');
    await db.execute({
      sql: 'INSERT INTO favorites VALUES (?, ?, ?)',
      args: ['ana', '1', 1],
    });
    const patched = await call('PATCH', '/users/ana', {
      token,
      body: { username: 'ana2', newPassword: 'Another!2', isActive: false },
    });
    expect(patched.status).toBe(200);
    expect(patched.json).toMatchObject({ username: 'ana2', isActive: false });
    const fav = await db.execute('SELECT userId FROM favorites');
    expect(fav.rows[0].userId).toBe('ana2');
    const blocked = await call('POST', '/auth/login', {
      body: { username: 'ana2', password: 'Another!2' },
    });
    expect(blocked.status).toBe(401);
    expect(
      (await call('PATCH', '/users/ghost', { token, body: {} })).status,
    ).toBe(404);
  });

  it('prevents admins from demoting, deactivating, renaming or deleting themselves', async () => {
    const token = await login('root');
    for (const body of [
      { isAdmin: false },
      { isActive: false },
      { username: 'r2' },
    ]) {
      const result = await call('PATCH', '/users/root', { token, body });
      expect(result.status).toBe(400);
      expect(result.json.error).toBe('cannot_modify_self');
    }
    expect((await call('DELETE', '/users/root', { token })).status).toBe(400);
  });

  it('deletes another user and their favorites', async () => {
    const token = await login('root');
    await db.execute({
      sql: 'INSERT INTO favorites VALUES (?, ?, ?)',
      args: ['ana', '1', 1],
    });
    expect((await call('DELETE', '/users/ana', { token })).status).toBe(204);
    expect((await db.execute('SELECT * FROM favorites')).rows).toHaveLength(0);
    expect((await call('DELETE', '/users/ana', { token })).status).toBe(404);
  });
});

describe('hardening', () => {
  it('locks out login after repeated failures from one client', async () => {
    const strict = createApp({ db, jwtSecret: SECRET, loginMaxFailures: 3 });
    const attempt = (password: string) =>
      strict.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ana', password }),
      });
    for (let i = 0; i < 3; i++) expect((await attempt('bad')).status).toBe(401);
    const locked = await attempt('Secret!1');
    expect(locked.status).toBe(429);
    expect(locked.headers.get('Retry-After')).toBe('900');
  });

  it('rate limits overall requests and honors the proxy IP only when trusted', async () => {
    const limited = createApp({
      db,
      jwtSecret: SECRET,
      requestsPerMinute: 2,
      trustProxy: true,
    });
    const hit = (ip: string) =>
      limited.request('/health', {
        headers: { 'X-Forwarded-For': `spoof, ${ip}` },
      });
    expect((await hit('1.1.1.1')).status).toBe(200);
    expect((await hit('1.1.1.1')).status).toBe(200);
    expect((await hit('1.1.1.1')).status).toBe(429);
    expect((await hit('2.2.2.2')).status).toBe(200);
  });

  it('logs requests without query strings, bodies or tokens and sets security headers', async () => {
    const response = await app.request('/health?secret=abc', {
      headers: { Authorization: 'Bearer topsecret' },
    });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const line = logs.join('\n');
    expect(line).toContain('"path":"/health"');
    expect(line).not.toContain('secret');
    expect(line).not.toContain('topsecret');
  });

  it('rejects oversized JSON bodies with 413', async () => {
    const token = await login('root');
    const big = await call('POST', '/offers', {
      token,
      body: { ...OFFER, description_sr: 'x'.repeat(200 * 1024) },
    });
    expect(big.status).toBe(413);
  });

  it('expires rate-limit windows', () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1000, () => now);
    limiter.hit('k');
    expect(limiter.allow('k')).toBe(false);
    now = 1001;
    expect(limiter.allow('k')).toBe(true);
  });
});
