import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export type TokenKind = 'access' | 'refresh';

const encode = (secret: string) => new TextEncoder().encode(secret);

export async function signToken(
  secret: string,
  kind: TokenKind,
  username: string,
): Promise<string> {
  return new SignJWT({ typ: kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(
      `${kind === 'access' ? ACCESS_TTL_SECONDS : REFRESH_TTL_SECONDS}s`,
    )
    .sign(encode(secret));
}

// Returns the username, or null when the token is invalid, expired or of the wrong kind.
export async function verifyToken(
  secret: string,
  kind: TokenKind,
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encode(secret), {
      algorithms: ['HS256'],
    });
    return payload.typ === kind && typeof payload.sub === 'string'
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}
