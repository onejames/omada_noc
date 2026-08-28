import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbQueries from '@/lib/db/queries';
import * as sessionModule from '@/lib/auth/session';
import { GET as getUsersHandler, POST as createUserHandler } from '@/app/api/admin/users/route';
import { PUT as updateUserHandler, DELETE as deleteUserHandler } from '@/app/api/admin/users/[id]/route';
import {
  GET as getDevicesHandler,
  POST as addDeviceHandler,
  DELETE as removeDeviceHandler,
} from '@/app/api/admin/users/[id]/devices/route';
import { GET as getLoginsHandler } from '@/app/api/admin/logins/route';

describe('Admin API Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RBAC Guards', () => {
    it('returns 403 Forbidden for non-admin users across all routes', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-user',
        username: 'regular_user',
        email: 'user@test.com',
        role: 'USER',
        lastActive: Date.now(),
      });

      expect((await getUsersHandler()).status).toBe(403);
      expect((await createUserHandler(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(403);
      expect((await updateUserHandler(new Request('http://localhost', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(403);
      expect((await deleteUserHandler(new Request('http://localhost', { method: 'DELETE' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(403);
      expect((await getDevicesHandler(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })).status).toBe(403);
      expect((await addDeviceHandler(new Request('http://localhost', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(403);
      expect((await removeDeviceHandler(new Request('http://localhost', { method: 'DELETE' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(403);
      expect((await getLoginsHandler(new Request('http://localhost/api/admin/logins'))).status).toBe(403);
    });
  });

  describe('User Management Routes (/api/admin/users)', () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });
    });

    it('lists all users for admin', async () => {
      vi.spyOn(dbQueries, 'listAllUsersWithDetails').mockResolvedValue([
        {
          id: 'u-1',
          username: 'user1',
          email: 'u1@test.com',
          role: 'USER',
          createdAt: '',
          updatedAt: '',
          taggedDevices: [],
        },
      ]);

      const res = await getUsersHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.users).toHaveLength(1);
    });

    it('handles unexpected exceptions and returns 500 on user list and create', async () => {
      vi.spyOn(dbQueries, 'listAllUsersWithDetails').mockRejectedValue(new Error('DB read failure'));
      expect((await getUsersHandler()).status).toBe(500);

      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockRejectedValue(new Error('DB write failure'));
      const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ username: 'a', email: 'a@b.com', password: 'password123' }) });
      expect((await createUserHandler(req)).status).toBe(500);
    });

    it('creates a new user for admin', async () => {
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue(null);
      vi.spyOn(dbQueries, 'createUser').mockResolvedValue({
        id: 'new-u',
        username: 'newuser',
        email: 'new@test.com',
        role: 'USER',
        createdAt: '',
        updatedAt: '',
      });

      const req = new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          email: 'new@test.com',
          password: 'Password123!',
          role: 'USER',
          fullName: 'New User',
        }),
      });

      const res = await createUserHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('validates required fields, password length, and duplicate users on create', async () => {
      // 1. Missing fields
      const req1 = new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: '', email: '', password: '' }),
      });
      expect((await createUserHandler(req1)).status).toBe(400);

      // 2. Short password
      const req2 = new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'u', email: 'u@test.com', password: 'short' }),
      });
      expect((await createUserHandler(req2)).status).toBe(400);

      // 3. Duplicate user
      vi.spyOn(dbQueries, 'findUserByEmailOrUsername').mockResolvedValue({} as any);
      const req3 = new Request('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'dup', email: 'dup@test.com', password: 'Password123!' }),
      });
      expect((await createUserHandler(req3)).status).toBe(409);
    });
  });

  describe('User Update & Delete (/api/admin/users/[id])', () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });
    });

    it('updates user role and password', async () => {
      vi.spyOn(dbQueries, 'findUserById').mockResolvedValue({
        id: 'u-target',
        username: 'target',
        email: 't@test.com',
        role: 'USER',
        createdAt: '',
        updatedAt: '',
      });
      vi.spyOn(dbQueries, 'updateUserRole').mockResolvedValue({} as any);
      vi.spyOn(dbQueries, 'updateUserPassword').mockResolvedValue(true);

      const req = new Request('http://localhost/api/admin/users/u-target', {
        method: 'PUT',
        body: JSON.stringify({ role: 'ADMIN', newPassword: 'NewPassword123!' }),
      });

      const res = await updateUserHandler(req, { params: Promise.resolve({ id: 'u-target' }) });
      expect(res.status).toBe(200);
    });

    it('handles not found and short password validation on update', async () => {
      vi.spyOn(dbQueries, 'findUserById').mockResolvedValue(null);
      const req1 = new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }) });
      expect((await updateUserHandler(req1, { params: Promise.resolve({ id: 'none' }) })).status).toBe(404);

      vi.spyOn(dbQueries, 'findUserById').mockResolvedValue({ id: '1' } as any);
      const req2 = new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ newPassword: 'short' }) });
      expect((await updateUserHandler(req2, { params: Promise.resolve({ id: '1' }) })).status).toBe(400);
    });

    it('handles unexpected exceptions and returns 500 on update and delete', async () => {
      vi.spyOn(dbQueries, 'findUserById').mockRejectedValue(new Error('Crash'));
      expect((await updateUserHandler(new Request('http://localhost', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(500);

      vi.spyOn(dbQueries, 'deleteUser').mockRejectedValue(new Error('Crash'));
      expect((await deleteUserHandler(new Request('http://localhost', { method: 'DELETE' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(500);
    });

    it('prevents administrator self-deletion and handles delete 404', async () => {
      const req = new Request('http://localhost/api/admin/users/u-admin', { method: 'DELETE' });
      const res = await deleteUserHandler(req, { params: Promise.resolve({ id: 'u-admin' }) });
      expect(res.status).toBe(400);

      vi.spyOn(dbQueries, 'deleteUser').mockResolvedValue(false);
      const req2 = new Request('http://localhost', { method: 'DELETE' });
      expect((await deleteUserHandler(req2, { params: Promise.resolve({ id: 'nonexistent' }) })).status).toBe(404);
    });

    it('deletes target user', async () => {
      vi.spyOn(dbQueries, 'deleteUser').mockResolvedValue(true);
      const req = new Request('http://localhost/api/admin/users/u-target', { method: 'DELETE' });
      const res = await deleteUserHandler(req, { params: Promise.resolve({ id: 'u-target' }) });
      expect(res.status).toBe(200);
    });
  });

  describe('Device Tagging Routes (/api/admin/users/[id]/devices)', () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });
    });

    it('gets, adds, and removes device tags with validation', async () => {
      vi.spyOn(dbQueries, 'getUserDeviceTags').mockResolvedValue([
        {
          id: 'tag-1',
          userId: 'u-target',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceName: 'iPad',
          createdAt: '',
        },
      ]);
      vi.spyOn(dbQueries, 'tagDeviceToUser').mockResolvedValue({
        id: 'tag-1',
        userId: 'u-target',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        createdAt: '',
      });
      vi.spyOn(dbQueries, 'removeDeviceTagFromUser').mockResolvedValue(true);

      const getRes = await getDevicesHandler(new Request('http://localhost'), {
        params: Promise.resolve({ id: 'u-target' }),
      });
      expect(getRes.status).toBe(200);

      // Missing MAC on add
      const badAddReq = new Request('http://localhost', { method: 'POST', body: JSON.stringify({}) });
      expect((await addDeviceHandler(badAddReq, { params: Promise.resolve({ id: '1' }) })).status).toBe(400);

      // Valid add
      const postReq = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ macAddress: 'AA:BB:CC:DD:EE:FF', deviceName: 'iPad' }),
      });
      const postRes = await addDeviceHandler(postReq, { params: Promise.resolve({ id: 'u-target' }) });
      expect(postRes.status).toBe(200);

      // Missing MAC on remove
      const badDelReq = new Request('http://localhost', { method: 'DELETE' });
      expect((await removeDeviceHandler(badDelReq, { params: Promise.resolve({ id: '1' }) })).status).toBe(400);

      // Valid remove
      const delReq = new Request('http://localhost?mac=AA:BB:CC:DD:EE:FF', { method: 'DELETE' });
      const delRes = await removeDeviceHandler(delReq, { params: Promise.resolve({ id: 'u-target' }) });
      expect(delRes.status).toBe(200);
    });

    it('handles unexpected exceptions and returns 500 on device tagging routes', async () => {
      vi.spyOn(dbQueries, 'getUserDeviceTags').mockRejectedValue(new Error('Fail'));
      expect((await getDevicesHandler(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })).status).toBe(500);

      vi.spyOn(dbQueries, 'tagDeviceToUser').mockRejectedValue(new Error('Fail'));
      expect((await addDeviceHandler(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ macAddress: 'AA' }) }), { params: Promise.resolve({ id: '1' }) })).status).toBe(500);

      vi.spyOn(dbQueries, 'removeDeviceTagFromUser').mockRejectedValue(new Error('Fail'));
      expect((await removeDeviceHandler(new Request('http://localhost?mac=AA', { method: 'DELETE' }), { params: Promise.resolve({ id: '1' }) })).status).toBe(500);
    });
  });

  describe('Login Audit Route (/api/admin/logins)', () => {
    it('returns paginated login audits (10 per page)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'getPaginatedLogins').mockResolvedValue({
        items: [
          {
            id: 'l-1',
            userId: 'u-1',
            email: 'user@test.com',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla',
            loginStatus: 'SUCCESS',
            failureReason: null,
            createdAt: '',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      const req = new Request('http://localhost/api/admin/logins?page=1&pageSize=10');
      const res = await getLoginsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toHaveLength(1);
    });

    it('handles unexpected exceptions and returns 500 on login audits', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });
      vi.spyOn(dbQueries, 'getPaginatedLogins').mockRejectedValue(new Error('Audit fail'));

      const res = await getLoginsHandler(new Request('http://localhost/api/admin/logins'));
      expect(res.status).toBe(500);
    });
  });
});
