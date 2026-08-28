import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbQueries from '@/lib/db/queries';
import * as schemaModule from '@/lib/db/schema';
import * as passwordModule from '@/lib/auth/password';
import * as sessionModule from '@/lib/auth/session';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { PUT as profileHandler } from '@/app/api/auth/profile/route';

// Mock next/headers
const mockSetCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: mockSetCookie,
    get: (name: string) => (name === 'noc_session' ? { value: 'mock.jwt.token' } : undefined),
  }),
}));

describe('Auth API Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(schemaModule, 'initDb').mockResolvedValue();
  });

  describe('POST /api/auth/login', () => {
    it('successfully logs in with valid credentials and sets cookie', async () => {
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue({
        id: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        passwordHash: '$2a$10$mockHash',
        role: 'ADMIN',
        createdAt: '2026-08-28T00:00:00Z',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(passwordModule, 'verifyPassword').mockResolvedValue(true);
      vi.spyOn(dbQueries, 'getUserProfile').mockResolvedValue({
        id: 'p-1',
        userId: 'u-123',
        fullName: 'Admin User',
        jobTitle: 'Lead',
        department: 'NOC',
        avatarUrl: '',
        theme: 'dark',
        updatedAt: '2026-08-28T00:00:00Z',
      });
      vi.spyOn(dbQueries, 'recordLoginAttempt').mockResolvedValue();

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'admin@omadanoc.com', password: 'AdminPass123!' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.email).toBe('admin@omadanoc.com');
      expect(mockSetCookie).toHaveBeenCalled();
    });

    it('rejects missing credentials with 400', async () => {
      vi.spyOn(dbQueries, 'recordLoginAttempt').mockResolvedValue();
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: '', password: '' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(400);
    });

    it('rejects non-existent user with 401', async () => {
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue(null);
      vi.spyOn(dbQueries, 'recordLoginAttempt').mockResolvedValue();

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'unknown@user.com', password: 'password' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects invalid password with 401', async () => {
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue({
        id: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        passwordHash: '$2a$10$mockHash',
        role: 'ADMIN',
        createdAt: '2026-08-28T00:00:00Z',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(passwordModule, 'verifyPassword').mockResolvedValue(false);
      vi.spyOn(dbQueries, 'recordLoginAttempt').mockResolvedValue();

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'admin@omadanoc.com', password: 'WrongPassword' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });

    it('handles unexpected exceptions and returns 500', async () => {
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockRejectedValue(new Error('Fatal DB crash'));
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'test@user.com', password: 'password' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockSetCookie).toHaveBeenCalled();
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile and tagged devices when authenticated', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'findUserById').mockResolvedValue({
        id: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        createdAt: '2026-08-28T00:00:00Z',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(dbQueries, 'getUserProfile').mockResolvedValue({
        id: 'p-1',
        userId: 'u-123',
        fullName: 'Admin User',
        jobTitle: 'Lead',
        department: 'NOC',
        avatarUrl: '',
        theme: 'dark',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(dbQueries, 'getUserDeviceTags').mockResolvedValue([]);

      const res = await meHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.user.username).toBe('admin');
    });

    it('returns 401 when unauthenticated or user deleted', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);
      expect((await meHandler()).status).toBe(401);

      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({ userId: 'u-deleted' } as any);
      vi.spyOn(dbQueries, 'findUserById').mockResolvedValue(null);
      expect((await meHandler()).status).toBe(401);
    });

    it('handles unexpected exceptions and returns 500', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockRejectedValue(new Error('JWT failure'));
      const res = await meHandler();
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('updates profile info and changes password when valid', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'upsertUserProfile').mockResolvedValue({
        id: 'p-1',
        userId: 'u-123',
        fullName: 'Updated Name',
        jobTitle: 'Senior NOC',
        department: 'Ops',
        avatarUrl: '',
        theme: 'dark',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue({
        id: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        passwordHash: '$2a$10$oldHash',
        role: 'ADMIN',
        createdAt: '2026-08-28T00:00:00Z',
        updatedAt: '2026-08-28T00:00:00Z',
      });

      vi.spyOn(passwordModule, 'verifyPassword').mockResolvedValue(true);
      vi.spyOn(passwordModule, 'hashPassword').mockResolvedValue('$2a$10$newHash');
      vi.spyOn(dbQueries, 'updateUserPassword').mockResolvedValue(true);

      const req = new Request('http://localhost/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Updated Name',
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        }),
      });

      const res = await profileHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.profile.fullName).toBe('Updated Name');
    });

    it('validates authentication, missing current password, and short new password', async () => {
      // 1. Unauthenticated
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);
      expect((await profileHandler(new Request('http://localhost', { method: 'PUT', body: '{}' }))).status).toBe(401);

      // 2. Missing current password
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({ userId: 'u1', email: 'u@test.com' } as any);
      vi.spyOn(dbQueries, 'upsertUserProfile').mockResolvedValue({} as any);

      const req1 = new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ newPassword: 'NewPassword123!' }) });
      expect((await profileHandler(req1)).status).toBe(400);

      // 3. Short new password
      const req2 = new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ currentPassword: 'cur', newPassword: 'short' }) });
      expect((await profileHandler(req2)).status).toBe(400);

      // 4. User not found during password change
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue(null);
      const req3 = new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ currentPassword: 'curPass123!', newPassword: 'newPass123!' }) });
      expect((await profileHandler(req3)).status).toBe(404);
    });

    it('rejects password change if current password is wrong', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'upsertUserProfile').mockResolvedValue({} as any);
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue({
        id: 'u-123',
        username: 'admin',
        email: 'admin@omadanoc.com',
        passwordHash: '$2a$10$oldHash',
        role: 'ADMIN',
        createdAt: '',
        updatedAt: '',
      });

      vi.spyOn(passwordModule, 'verifyPassword').mockResolvedValue(false);

      const req = new Request('http://localhost/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: 'WrongOldPassword',
          newPassword: 'NewPassword123!',
        }),
      });

      const res = await profileHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Current password provided is incorrect');
    });

    it('handles unexpected exceptions and returns 500', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockRejectedValue(new Error('Profile failure'));
      const res = await profileHandler(new Request('http://localhost', { method: 'PUT', body: '{}' }));
      expect(res.status).toBe(500);
    });
  });
});
