import { createClient } from '@libsql/client';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createFirebaseImageUploader } from './firebaseImages.js';

function required(name: string): string {
  // Secret Manager values are often saved with a trailing newline.
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
if (process.env.NODE_ENV === 'production' && !bucketName) {
  throw new Error('Missing environment variable FIREBASE_STORAGE_BUCKET');
}

const db = createClient({
  url: required('TURSO_DATABASE_URL'),
  authToken: required('TURSO_AUTH_TOKEN'),
});

const app = createApp({
  db,
  jwtSecret,
  ...(bucketName && { uploadImage: createFirebaseImageUploader(bucketName) }),
  logger: (line) => console.log(line),
  trustProxy: process.env.TRUST_PROXY === 'true',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});

const port = Number(process.env.PORT ?? 8787);
const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`API listening on port ${port}`);
});

let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close((error) => {
      if (error) {
        console.error('HTTP server shutdown failed', error);
        process.exitCode = 1;
      }
      try {
        db.close();
      } catch (closeError) {
        console.error('Database shutdown failed', closeError);
        process.exitCode = 1;
      }
    });
  });
}
