import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const jwtSecret = process.env.JWT_SECRET;
const isDev = process.env.NODE_ENV === 'development';
if (!jwtSecret && !isDev) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set! Required in all non-development environments.');
}
if (jwtSecret && jwtSecret.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long.');
}
const SECRET = new TextEncoder().encode(jwtSecret || 'dev-only-secret-do-not-use-in-production');

export interface TokenPayload {
  userId: string;
  orgId: string;
  orgCode: string;
  name: string;
  role: 'admin' | 'employee';
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}
