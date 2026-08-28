import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  getCurrentSession,
  INACTIVITY_TIMEOUT_SECONDS,
} from '@/lib/auth/session';

const mockGetCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mockGetCookie,
  }),
}));

describe('JWT Session & Inactivity Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and verifies a valid signed JWT session token', async () => {
    const payload = {
      userId: 'user-uuid-123',
      username: 'jdoe',
      email: 'jdoe@example.com',
      role: 'ADMIN' as const,
      fullName: 'John Doe',
    };

    const token = await createSessionToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('user-uuid-123');
    expect(decoded?.username).toBe('jdoe');
    expect(decoded?.role).toBe('ADMIN');
  });

  it('rejects a session token that has exceeded the 15-minute inactivity window', async () => {
    const payload = {
      userId: 'user-uuid-456',
      username: 'stale_user',
      email: 'stale@example.com',
      role: 'USER' as const,
    };

    const pastTimestamp = Date.now() - (INACTIVITY_TIMEOUT_SECONDS + 60) * 1000;
    const token = await createSessionToken(payload, pastTimestamp);

    const decoded = await verifySessionToken(token, Date.now());
    expect(decoded).toBeNull();
  });

  it('returns null for an invalid, malformed, or empty token', async () => {
    expect(await verifySessionToken('')).toBeNull();
    expect(await verifySessionToken('invalid.jwt.token')).toBeNull();
  });

  it('retrieves active session from cookies using getCurrentSession', async () => {
    const token = await createSessionToken({
      userId: 'u-cookie-test',
      username: 'cookieuser',
      email: 'cookie@test.com',
      role: 'ADMIN',
    });

    mockGetCookie.mockReturnValueOnce({ value: token });

    const session = await getCurrentSession();
    expect(session?.userId).toBe('u-cookie-test');

    // Test missing cookie
    mockGetCookie.mockReturnValueOnce(undefined);
    expect(await getCurrentSession()).toBeNull();

    // Test cookies() throwing error
    mockGetCookie.mockImplementationOnce(() => {
      throw new Error('Cookie store failure');
    });
    expect(await getCurrentSession()).toBeNull();
  });
});
