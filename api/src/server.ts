import { createClient } from '@libsql/client';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createFirebaseImageUploader } from './firebaseImages';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

const app = createApp({
  db: createClient({
    url: required('TURSO_DATABASE_URL'),
    authToken: required('TURSO_AUTH_TOKEN'),
  }),
  jwtSecret,
  ...(process.env.FIREBASE_STORAGE_BUCKET && {
    uploadImage: createFirebaseImageUploader(
      process.env.FIREBASE_STORAGE_BUCKET,
    ),
  }),
  logger: (line) => console.log(line),
  trustProxy: process.env.TRUST_PROXY === 'true',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}`);
});
