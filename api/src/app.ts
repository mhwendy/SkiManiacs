import type { Client, Row } from '@libsql/client';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { getConnInfo } from '@hono/node-server/conninfo';
import { CSV_COLUMNS, parseCsv } from './csv';
import { ValidationError, parseOfferInput } from './offerInput';
import { createRateLimiter } from './rateLimit';
import {
  hashPassword,
  validateEmail,
  validatePassword,
  verifyPassword,
} from './passwords';
import { signToken, verifyToken } from './tokens';

export type AppConfig = {
  db: Client;
  jwtSecret: string;
  allowedOrigins?: string[];
  // Receives one JSON line per request (no bodies, query strings or tokens).
  logger?: (line: string) => void;
  // Behind a trusted proxy (Cloud Run / Firebase) the client IP is the last X-Forwarded-For entry.
  trustProxy?: boolean;
  loginMaxFailures?: number;
  requestsPerMinute?: number;
};

const OFFER_COLUMNS =
  'title_sr, title_en, description_sr, description_en, category_sr, category_en, location_sr, location_en, priceAmount, currency, isPriceComingSoon, startDate, endDate, imageUrl, imageUrl2, imageUrl3, imageUrl4, imageUrl5, availablePlaces, applicationDeadline, updatedAt, updatedBy';

function offerArgs(
  input: ReturnType<typeof parseOfferInput>,
  updatedBy: string,
) {
  const [i1, i2, i3, i4, i5] = [0, 1, 2, 3, 4].map(
    (n) => input.images[n] ?? null,
  );
  return [
    input.title_sr,
    input.title_en,
    input.description_sr,
    input.description_en,
    input.category_sr,
    input.category_en,
    input.location_sr,
    input.location_en,
    input.priceAmount,
    input.currency,
    input.isPriceComingSoon ? 1 : 0,
    input.startDate,
    input.endDate,
    i1,
    i2,
    i3,
    i4,
    i5,
    input.availablePlaces,
    input.applicationDeadline,
    new Date().toISOString().slice(0, 10),
    updatedBy,
  ];
}

type UserRecord = {
  username: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  password: string;
  isAdmin: boolean;
  isActive: boolean;
};

type Variables = { user: UserRecord };

const MEMBER_ONLY_FIELDS = [
  'price',
  'priceAmount',
  'currency',
  'isPriceComingSoon',
  'availablePlaces',
  'applicationDeadline',
] as const;

// Verified when the user is unknown so response timing does not reveal who exists.
const DUMMY_HASH = `${Buffer.alloc(16).toString('base64')}:${Buffer.alloc(32).toString('base64')}`;

function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function toUserRecord(row: Row): UserRecord {
  return {
    username: String(row.username),
    name: text(row.name),
    surname: text(row.surname),
    email: text(row.email),
    password: String(row.password),
    isAdmin: Number(row.isAdmin) === 1,
    isActive: Number(row.isActive) === 1,
  };
}

function publicUser(user: UserRecord) {
  return {
    username: user.username,
    name: user.name ?? undefined,
    surname: user.surname ?? undefined,
    email: user.email ?? '',
    isAdmin: user.isAdmin,
    isActive: user.isActive,
  };
}

function toOffer(row: Row, member: boolean) {
  const date = (value: unknown) => {
    const v = text(value);
    return v ? v.slice(0, 10) : null;
  };
  const updated = Date.parse(text(row.updatedAt) ?? '');
  const currency = text(row.currency);
  const offer: Record<string, unknown> = {
    id: String(row.id),
    title_sr: String(row.title_sr),
    title_en: text(row.title_en),
    description_sr: text(row.description_sr),
    description_en: text(row.description_en),
    category_sr: text(row.category_sr),
    category_en: text(row.category_en),
    location_sr: text(row.location_sr),
    location_en: text(row.location_en),
    price: null,
    priceAmount: row.priceAmount === null ? null : Number(row.priceAmount),
    currency: currency === 'EUR' || currency === 'RSD' ? currency : null,
    isPriceComingSoon: Number(row.isPriceComingSoon) === 1,
    startDate: date(row.startDate),
    endDate: date(row.endDate),
    imageUrl: text(row.imageUrl),
    imageUrl2: text(row.imageUrl2),
    imageUrl3: text(row.imageUrl3),
    imageUrl4: text(row.imageUrl4),
    imageUrl5: text(row.imageUrl5),
    availablePlaces: text(row.availablePlaces),
    applicationDeadline: date(row.applicationDeadline),
    updatedAt: Number.isNaN(updated) ? null : updated,
    updatedBy: text(row.updatedBy),
  };
  if (!member) {
    for (const field of MEMBER_ONLY_FIELDS) delete offer[field];
  }
  return offer;
}

async function readJson(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await c.req.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value.trim() : null;
}

export function createApp({
  db,
  jwtSecret,
  allowedOrigins = [],
  logger,
  trustProxy = false,
  loginMaxFailures = 10,
  requestsPerMinute = 300,
}: AppConfig) {
  const app = new Hono<{ Variables: Variables }>();
  const loginFailures = createRateLimiter(loginMaxFailures, 15 * 60_000);
  const requestLimiter = createRateLimiter(requestsPerMinute, 60_000);

  const clientIp = (c: Context): string => {
    if (trustProxy) {
      const forwarded = c.req.header('X-Forwarded-For');
      const last = forwarded?.split(',').at(-1)?.trim();
      if (last) return last;
    }
    try {
      return getConnInfo(c).remote.address ?? 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const findUser = async (username: string) => {
    const result = await db.execute({
      sql: 'SELECT username, name, surname, email, password, isAdmin, isActive FROM users WHERE username = ?',
      args: [username],
    });
    return result.rows[0] ? toUserRecord(result.rows[0]) : null;
  };

  const issueTokens = async (username: string) => ({
    accessToken: await signToken(jwtSecret, 'access', username),
    refreshToken: await signToken(jwtSecret, 'refresh', username),
  });

  // Resolves the bearer token to an active user. Returns null for no header, 'invalid' otherwise.
  const authenticate = async (c: Context) => {
    const header = c.req.header('Authorization');
    if (!header) return null;
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return 'invalid' as const;
    const username = await verifyToken(jwtSecret, 'access', match[1]);
    if (!username) return 'invalid' as const;
    const user = await findUser(username);
    return user?.isActive ? user : ('invalid' as const);
  };

  const requireUser: MiddlewareHandler<{ Variables: Variables }> = async (
    c,
    next,
  ) => {
    const user = await authenticate(c);
    if (!user || user === 'invalid') {
      return c.json({ error: 'Authentication required' }, 401);
    }
    c.set('user', user);
    await next();
  };

  app.use(
    '*',
    cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    const started = Date.now();
    await next();
    logger?.(
      JSON.stringify({
        time: new Date().toISOString(),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Date.now() - started,
        ip: clientIp(c),
      }),
    );
  });
  app.use('*', async (c, next) => {
    const ip = clientIp(c);
    if (!requestLimiter.allow(ip)) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Too many requests' }, 429);
    }
    requestLimiter.hit(ip);
    await next();
  });
  const defaultLimit = bodyLimit({
    maxSize: 100 * 1024,
    onError: (c) => c.json({ error: 'Request too large' }, 413),
  });
  const importLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'Request too large' }, 413),
  });
  app.use('*', (c, next) =>
    c.req.path === '/offers/import'
      ? importLimit(c, next)
      : defaultLimit(c, next),
  );

  const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (
    c,
    next,
  ) => {
    if (!c.get('user').isAdmin) return c.json({ error: 'Forbidden' }, 403);
    await next();
  };

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/auth/login', async (c) => {
    const body = await readJson(c);
    const username =
      typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    const ip = clientIp(c);
    if (!loginFailures.allow(ip)) {
      c.header('Retry-After', '900');
      return c.json({ error: 'Too many attempts. Try again later.' }, 429);
    }
    const user = await findUser(username);
    const valid = await verifyPassword(password, user?.password ?? DUMMY_HASH);
    if (!user || !valid || !user.isActive) {
      loginFailures.hit(ip);
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    loginFailures.reset(ip);
    return c.json({
      ...(await issueTokens(user.username)),
      user: publicUser(user),
    });
  });

  app.post('/auth/refresh', async (c) => {
    const body = await readJson(c);
    const token =
      typeof body?.refreshToken === 'string' ? body.refreshToken : '';
    const username = await verifyToken(jwtSecret, 'refresh', token);
    const user = username ? await findUser(username) : null;
    if (!user?.isActive) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }
    return c.json(await issueTokens(user.username));
  });

  app.get('/offers', async (c) => {
    const user = await authenticate(c);
    if (user === 'invalid') {
      return c.json({ error: 'Authentication required' }, 401);
    }
    const result = await db.execute('SELECT * FROM offers ORDER BY id');
    return c.json(result.rows.map((row) => toOffer(row, user !== null)));
  });

  app.get('/offers/:id', async (c) => {
    const user = await authenticate(c);
    if (user === 'invalid') {
      return c.json({ error: 'Authentication required' }, 401);
    }
    const id = c.req.param('id');
    if (!/^\d+$/.test(id)) return c.json({ error: 'Offer not found' }, 404);
    const result = await db.execute({
      sql: 'SELECT * FROM offers WHERE id = ?',
      args: [Number(id)],
    });
    if (!result.rows[0]) return c.json({ error: 'Offer not found' }, 404);
    return c.json(toOffer(result.rows[0], user !== null));
  });

  app.get('/me', requireUser, (c) => c.json(publicUser(c.get('user'))));

  app.patch('/me', requireUser, async (c) => {
    const current = c.get('user');
    const body = await readJson(c);
    if (!body) return c.json({ error: 'Invalid request body' }, 400);

    const username = optionalString(body.username);
    const name = optionalString(body.name);
    const surname = optionalString(body.surname);
    const email = optionalString(body.email);
    if (
      username === null ||
      name === null ||
      surname === null ||
      email === null ||
      username === ''
    ) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    if (email !== undefined && !validateEmail(email)) {
      return c.json({ error: 'Invalid email' }, 400);
    }

    let passwordHash: string | undefined;
    if (body.newPassword !== undefined) {
      const currentPassword =
        typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const pwKey = `pw:${current.username}`;
      if (!loginFailures.allow(pwKey)) {
        return c.json({ error: 'Too many attempts. Try again later.' }, 429);
      }
      if (!(await verifyPassword(currentPassword, current.password))) {
        loginFailures.hit(pwKey);
        return c.json({ error: 'current_password_incorrect' }, 400);
      }
      if (
        typeof body.newPassword !== 'string' ||
        !validatePassword(body.newPassword)
      ) {
        return c.json({ error: 'invalid_password' }, 400);
      }
      passwordHash = await hashPassword(body.newPassword);
    }

    const nextUsername = username ?? current.username;
    if (nextUsername !== current.username) {
      if (await findUser(nextUsername)) {
        return c.json({ error: 'Username already exists' }, 409);
      }
    }
    if (email !== undefined && email !== current.email) {
      const clash = await db.execute({
        sql: 'SELECT 1 FROM users WHERE lower(email) = lower(?) AND username <> ?',
        args: [email, current.username],
      });
      if (clash.rows.length > 0) {
        return c.json({ error: 'Email already exists' }, 409);
      }
    }

    const next: UserRecord = {
      ...current,
      username: nextUsername,
      name: name ?? current.name,
      surname: surname ?? current.surname,
      email: email ?? current.email,
      password: passwordHash ?? current.password,
    };
    try {
      await db.batch(
        [
          {
            sql: 'UPDATE users SET username = ?, name = ?, surname = ?, email = ?, password = ? WHERE username = ?',
            args: [
              next.username,
              next.name,
              next.surname,
              next.email,
              next.password,
              current.username,
            ],
          },
          {
            sql: 'UPDATE favorites SET userId = ? WHERE userId = ?',
            args: [next.username, current.username],
          },
        ],
        'write',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/UNIQUE/i.test(message)) {
        return c.json(
          {
            error: /email/i.test(message)
              ? 'Email already exists'
              : 'Username already exists',
          },
          409,
        );
      }
      throw error;
    }
    // Tokens carry the username, so a rename needs fresh ones to keep the session.
    return c.json({
      user: publicUser(next),
      ...(await issueTokens(next.username)),
    });
  });

  app.delete('/me', requireUser, async (c) => {
    const { username } = c.get('user');
    await db.batch(
      [
        { sql: 'DELETE FROM favorites WHERE userId = ?', args: [username] },
        { sql: 'DELETE FROM users WHERE username = ?', args: [username] },
      ],
      'write',
    );
    return c.body(null, 204);
  });

  app.get('/me/favorites', requireUser, async (c) => {
    const result = await db.execute({
      sql: 'SELECT offerId FROM favorites WHERE userId = ? ORDER BY createdAt DESC',
      args: [c.get('user').username],
    });
    return c.json(result.rows.map((row) => String(row.offerId)));
  });

  app.put('/me/favorites/:offerId', requireUser, async (c) => {
    const offerId = c.req.param('offerId');
    if (!/^\d+$/.test(offerId))
      return c.json({ error: 'Offer not found' }, 404);
    const offer = await db.execute({
      sql: 'SELECT 1 FROM offers WHERE id = ?',
      args: [Number(offerId)],
    });
    if (offer.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }
    await db.execute({
      sql: 'INSERT OR IGNORE INTO favorites (userId, offerId, createdAt) VALUES (?, ?, ?)',
      args: [c.get('user').username, offerId, Date.now()],
    });
    return c.body(null, 204);
  });

  app.delete('/me/favorites/:offerId', requireUser, async (c) => {
    await db.execute({
      sql: 'DELETE FROM favorites WHERE userId = ? AND offerId = ?',
      args: [c.get('user').username, c.req.param('offerId')],
    });
    return c.body(null, 204);
  });

  // ---- Admin: offers ----

  const validationMessage = (error: unknown) =>
    error instanceof ValidationError ? error.message : null;

  app.post('/offers', requireUser, requireAdmin, async (c) => {
    const body = await readJson(c);
    if (!body) return c.json({ error: 'Invalid request body' }, 400);
    try {
      const input = parseOfferInput(body);
      const result = await db.execute({
        sql: `INSERT INTO offers (${OFFER_COLUMNS}) VALUES (${Array(22).fill('?').join(', ')})`,
        args: offerArgs(input, c.get('user').username) as never,
      });
      const row = await db.execute({
        sql: 'SELECT * FROM offers WHERE id = ?',
        args: [Number(result.lastInsertRowid)],
      });
      return c.json(toOffer(row.rows[0], true), 201);
    } catch (error) {
      const message = validationMessage(error);
      if (message) return c.json({ error: message }, 400);
      throw error;
    }
  });

  app.put('/offers/:id', requireUser, requireAdmin, async (c) => {
    const id = c.req.param('id');
    if (!/^\d+$/.test(id)) return c.json({ error: 'Offer not found' }, 404);
    const body = await readJson(c);
    if (!body) return c.json({ error: 'Invalid request body' }, 400);
    try {
      const input = parseOfferInput(body);
      const assignments = OFFER_COLUMNS.split(', ')
        .map((column) => `${column} = ?`)
        .join(', ');
      const result = await db.execute({
        sql: `UPDATE offers SET ${assignments} WHERE id = ?`,
        args: [
          ...offerArgs(input, c.get('user').username),
          Number(id),
        ] as never,
      });
      if (result.rowsAffected === 0) {
        return c.json({ error: 'Offer not found' }, 404);
      }
      const row = await db.execute({
        sql: 'SELECT * FROM offers WHERE id = ?',
        args: [Number(id)],
      });
      return c.json(toOffer(row.rows[0], true));
    } catch (error) {
      const message = validationMessage(error);
      if (message) return c.json({ error: message }, 400);
      throw error;
    }
  });

  app.delete('/offers/:id', requireUser, requireAdmin, async (c) => {
    const id = c.req.param('id');
    if (!/^\d+$/.test(id)) return c.json({ error: 'Offer not found' }, 404);
    const results = await db.batch(
      [
        { sql: 'DELETE FROM favorites WHERE offerId = ?', args: [id] },
        { sql: 'DELETE FROM offers WHERE id = ?', args: [Number(id)] },
      ],
      'write',
    );
    if (results[1].rowsAffected === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }
    return c.body(null, 204);
  });

  // CSV import: upserts on (title_sr, startDate); never deletes offers missing from the file.
  app.post('/offers/import', requireUser, requireAdmin, async (c) => {
    const rows = parseCsv(await c.req.text());
    if (rows.length === 0) {
      return c.json({ error: 'CSV file is empty' }, 400);
    }
    const dataRows = rows.slice(1);
    if (dataRows.length > 1000) {
      return c.json({ error: 'CSV has more than 1000 rows' }, 400);
    }
    const updatedBy = c.get('user').username;
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const [index, fields] of dataRows.entries()) {
      const line = index + 2;
      try {
        if (fields.length < 10) {
          throw new ValidationError(
            `Expected at least 10 fields, got ${fields.length}`,
          );
        }
        const raw: Record<string, unknown> = {};
        CSV_COLUMNS.forEach((column, n) => {
          raw[column] = fields[n]?.trim() ?? '';
        });
        const input = parseOfferInput(raw);
        const existing = await db.execute({
          sql: 'SELECT id FROM offers WHERE title_sr = ? AND startDate IS ? LIMIT 1',
          args: [input.title_sr, input.startDate],
        });
        if (existing.rows[0]) {
          const assignments = OFFER_COLUMNS.split(', ')
            .map((column) => `${column} = ?`)
            .join(', ');
          await db.execute({
            sql: `UPDATE offers SET ${assignments} WHERE id = ?`,
            args: [
              ...offerArgs(input, updatedBy),
              Number(existing.rows[0].id),
            ] as never,
          });
          updated += 1;
        } else {
          await db.execute({
            sql: `INSERT INTO offers (${OFFER_COLUMNS}) VALUES (${Array(22).fill('?').join(', ')})`,
            args: offerArgs(input, updatedBy) as never,
          });
          inserted += 1;
        }
      } catch (error) {
        const message = validationMessage(error);
        if (!message) console.error(error);
        errors.push(`Row ${line}: ${message ?? 'Could not save row'}`);
      }
    }
    return c.json({ inserted, updated, failed: errors.length, errors });
  });

  // ---- Admin: users ----

  app.get('/users', requireUser, requireAdmin, async (c) => {
    const result = await db.execute(
      'SELECT username, name, surname, email, password, isAdmin, isActive FROM users ORDER BY lower(COALESCE(name, username)), lower(username)',
    );
    return c.json(result.rows.map((row) => publicUser(toUserRecord(row))));
  });

  const conflictMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (!/UNIQUE/i.test(message)) return null;
    return /email/i.test(message)
      ? 'Email already exists'
      : 'Username already exists';
  };

  app.post('/users', requireUser, requireAdmin, async (c) => {
    const body = await readJson(c);
    if (!body) return c.json({ error: 'Invalid request body' }, 400);
    const username = optionalString(body.username);
    const name = optionalString(body.name);
    const surname = optionalString(body.surname);
    const email = optionalString(body.email);
    if (
      !username ||
      username.length > 64 ||
      name === null ||
      surname === null
    ) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    if (!email || !validateEmail(email)) {
      return c.json({ error: 'Invalid email' }, 400);
    }
    if (typeof body.password !== 'string' || !validatePassword(body.password)) {
      return c.json({ error: 'invalid_password' }, 400);
    }
    if (await findUser(username)) {
      return c.json({ error: 'Username already exists' }, 409);
    }
    const user: UserRecord = {
      username,
      name: name ?? null,
      surname: surname ?? null,
      email,
      password: await hashPassword(body.password),
      isAdmin: body.isAdmin === true,
      isActive: body.isActive !== false,
    };
    try {
      await db.execute({
        sql: 'INSERT INTO users (username, name, surname, email, password, isAdmin, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [
          user.username,
          user.name,
          user.surname,
          user.email,
          user.password,
          user.isAdmin ? 1 : 0,
          user.isActive ? 1 : 0,
        ],
      });
    } catch (error) {
      const conflict = conflictMessage(error);
      if (conflict) return c.json({ error: conflict }, 409);
      throw error;
    }
    return c.json(publicUser(user), 201);
  });

  app.patch('/users/:username', requireUser, requireAdmin, async (c) => {
    const actor = c.get('user');
    const target = await findUser(c.req.param('username'));
    if (!target) return c.json({ error: 'User not found' }, 404);
    const body = await readJson(c);
    if (!body) return c.json({ error: 'Invalid request body' }, 400);

    const username = optionalString(body.username);
    const name = optionalString(body.name);
    const surname = optionalString(body.surname);
    const email = optionalString(body.email);
    if (
      username === null ||
      username === '' ||
      (username !== undefined && username.length > 64) ||
      name === null ||
      surname === null ||
      email === null ||
      (body.isAdmin !== undefined && typeof body.isAdmin !== 'boolean') ||
      (body.isActive !== undefined && typeof body.isActive !== 'boolean')
    ) {
      return c.json({ error: 'Invalid request body' }, 400);
    }
    if (email !== undefined && !validateEmail(email)) {
      return c.json({ error: 'Invalid email' }, 400);
    }
    const isSelf = target.username === actor.username;
    if (
      isSelf &&
      ((username !== undefined && username !== target.username) ||
        body.isAdmin === false ||
        body.isActive === false)
    ) {
      return c.json({ error: 'cannot_modify_self' }, 400);
    }
    let password = target.password;
    if (body.newPassword !== undefined) {
      if (
        typeof body.newPassword !== 'string' ||
        !validatePassword(body.newPassword)
      ) {
        return c.json({ error: 'invalid_password' }, 400);
      }
      password = await hashPassword(body.newPassword);
    }
    const next: UserRecord = {
      username: username ?? target.username,
      name: name ?? target.name,
      surname: surname ?? target.surname,
      email: email ?? target.email,
      password,
      isAdmin: (body.isAdmin as boolean | undefined) ?? target.isAdmin,
      isActive: (body.isActive as boolean | undefined) ?? target.isActive,
    };
    if (next.username !== target.username && (await findUser(next.username))) {
      return c.json({ error: 'Username already exists' }, 409);
    }
    try {
      await db.batch(
        [
          {
            sql: 'UPDATE users SET username = ?, name = ?, surname = ?, email = ?, password = ?, isAdmin = ?, isActive = ? WHERE username = ?',
            args: [
              next.username,
              next.name,
              next.surname,
              next.email,
              next.password,
              next.isAdmin ? 1 : 0,
              next.isActive ? 1 : 0,
              target.username,
            ],
          },
          {
            sql: 'UPDATE favorites SET userId = ? WHERE userId = ?',
            args: [next.username, target.username],
          },
        ],
        'write',
      );
    } catch (error) {
      const conflict = conflictMessage(error);
      if (conflict) return c.json({ error: conflict }, 409);
      throw error;
    }
    return c.json(publicUser(next));
  });

  app.delete('/users/:username', requireUser, requireAdmin, async (c) => {
    const username = c.req.param('username');
    if (username === c.get('user').username) {
      return c.json({ error: 'cannot_modify_self' }, 400);
    }
    const results = await db.batch(
      [
        { sql: 'DELETE FROM favorites WHERE userId = ?', args: [username] },
        { sql: 'DELETE FROM users WHERE username = ?', args: [username] },
      ],
      'write',
    );
    if (results[1].rowsAffected === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.body(null, 204);
  });

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message || 'Request failed' }, error.status);
    }
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
