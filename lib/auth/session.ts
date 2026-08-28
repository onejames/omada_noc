import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { SessionPayload } from '@/types/auth';

export const SESSION_COOKIE_NAME = 'noc_session';
export const INACTIVITY_TIMEOUT_SECONDS = 15 * 60; // 15 minutes (900 seconds)

const SECRET_STRING =
  process.env.JWT_SECRET || 'omada-noc-dashboard-super-secure-jwt-secret-key-32-chars';

function getSecretKey(): Uint8Array {
  return Uint8Array.from(Buffer.from(SECRET_STRING, 'utf-8'));
}

/**
 * Creates a signed JWT session token with an inactivity expiration window.
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, 'lastActive' | 'exp'>,
  nowMs: number = Date.now()
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    lastActive: nowMs,
  };

  return new SignJWT({ ...fullPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${INACTIVITY_TIMEOUT_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verifies and decodes a signed JWT session token, enforcing the 15-minute sliding inactivity window.
 */
export async function verifySessionToken(
  token: string,
  nowMs: number = Date.now()
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const session = payload as unknown as SessionPayload;

    // Check 15-minute inactivity sliding window
    const elapsedSeconds = (nowMs - (session.lastActive || 0)) / 1000;
    if (elapsedSeconds > INACTIVITY_TIMEOUT_SECONDS) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Retrieves and validates the current active session from incoming Next.js request cookies.
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return null;

    return await verifySessionToken(sessionCookie.value);
  } catch {
    return null;
  }
}
