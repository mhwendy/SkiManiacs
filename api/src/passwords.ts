import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

// Same format as the Android app: Base64(salt):Base64(PBKDF2-HMAC-SHA256, 120000 iterations, 32 bytes).
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await pbkdf2Async(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256',
  );
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

// Unhashed (legacy plaintext) values never match.
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'base64');
  const expected = Buffer.from(parts[1], 'base64');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await pbkdf2Async(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256',
  );
  return timingSafeEqual(actual, expected);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return emailPattern.test(email);
}

export function validatePassword(password: string): boolean {
  const chars = [...password];
  return (
    chars.length >= 5 &&
    chars.some((c) => c.toUpperCase() === c && c.toLowerCase() !== c) &&
    chars.some((c) => !/[\p{L}\p{N}]/u.test(c))
  );
}
