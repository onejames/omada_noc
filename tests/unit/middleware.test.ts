import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import * as sessionModule from '@/lib/auth/session';

describe('Next.js Edge Middleware Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (path: string, cookieValue?: string) => {
    const url = new URL(`http://localhost:3000${path}`);
    const req = new NextRequest(url);
    if (cookieValue) {
      req.cookies.set('noc_session', cookieValue);
    }
    return req;
  };

  it('allows static assets and Next.js internals to pass through', async () => {
    const req1 = createRequest('/_next/static/chunks/main.js');
    const res1 = await proxy(req1);
    expect(res1.status).toBe(200);

    const req2 = createRequest('/favicon.ico');
    const res2 = await proxy(req2);
    expect(res2.status).toBe(200);
  });

  it('handles /login route: allows unauthenticated, redirects authenticated to /', async () => {
    // Unauthenticated on /login
    const req1 = createRequest('/login');
    const res1 = await proxy(req1);
    expect(res1.status).toBe(200);

    // Authenticated on /login
    vi.spyOn(sessionModule, 'verifySessionToken').mockResolvedValue({
      userId: 'u1',
      username: 'admin',
      email: 'a@b.com',
      role: 'ADMIN',
      lastActive: Date.now(),
    });

    const req2 = createRequest('/login', 'valid-token');
    const res2 = await proxy(req2);
    expect(res2.status).toBe(307);
    expect(res2.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('allows public auth routes /api/auth/login and /api/auth/logout', async () => {
    const req1 = createRequest('/api/auth/login');
    const res1 = await proxy(req1);
    expect(res1.status).toBe(200);

    const req2 = createRequest('/api/auth/logout');
    const res2 = await proxy(req2);
    expect(res2.status).toBe(200);
  });

  it('redirects unauthenticated UI requests to /login', async () => {
    // Main dashboard without cookie
    const req1 = createRequest('/');
    const res1 = await proxy(req1);
    expect(res1.status).toBe(307);
    expect(res1.headers.get('location')).toBe('http://localhost:3000/login');

    // Profile page with invalid/expired token
    vi.spyOn(sessionModule, 'verifySessionToken').mockResolvedValue(null);
    const req2 = createRequest('/profile', 'expired-token');
    const res2 = await proxy(req2);
    expect(res2.status).toBe(307);
    expect(res2.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('returns 401 Unauthorized for unauthenticated API requests', async () => {
    const req = createRequest('/api/telemetry');
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Authentication required');
  });

  it('enforces RBAC for Admin routes (/admin/* and /api/admin/*)', async () => {
    // Non-admin user
    vi.spyOn(sessionModule, 'verifySessionToken').mockResolvedValue({
      userId: 'u-user',
      username: 'user',
      email: 'user@test.com',
      role: 'USER',
      lastActive: Date.now(),
    });

    // Accessing /admin/users UI -> Redirects to /
    const req1 = createRequest('/admin/users', 'user-token');
    const res1 = await proxy(req1);
    expect(res1.status).toBe(307);
    expect(res1.headers.get('location')).toBe('http://localhost:3000/');

    // Accessing /api/admin/users -> 403 Forbidden
    const req2 = createRequest('/api/admin/users', 'user-token');
    const res2 = await proxy(req2);
    expect(res2.status).toBe(403);
    const json = await res2.json();
    expect(json.error).toContain('Forbidden');
  });

  it('allows authenticated admin to access all protected routes', async () => {
    vi.spyOn(sessionModule, 'verifySessionToken').mockResolvedValue({
      userId: 'u-admin',
      username: 'admin',
      email: 'admin@omadanoc.com',
      role: 'ADMIN',
      lastActive: Date.now(),
    });

    const req1 = createRequest('/', 'admin-token');
    expect((await proxy(req1)).status).toBe(200);

    const req2 = createRequest('/admin/users', 'admin-token');
    expect((await proxy(req2)).status).toBe(200);

    const req3 = createRequest('/api/admin/users', 'admin-token');
    expect((await proxy(req3)).status).toBe(200);
  });
});
