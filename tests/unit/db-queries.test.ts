import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as poolModule from '@/lib/db/pool';
import {
  findUserByEmailOrUsername,
  findUserById,
  createUser,
  updateUserRole,
  updateUserPassword,
  deleteUser,
  listAllUsersWithDetails,
  getUserProfile,
  upsertUserProfile,
  getUserDeviceTags,
  tagDeviceToUser,
  removeDeviceTagFromUser,
  recordLoginAttempt,
  getPaginatedLogins,
  saveAiInsight,
  getRecentAiInsights,
  getLatestAiInsight,
  resetDbFallbackForTests,
} from '@/lib/db/queries';

describe('PostgreSQL Database Queries Repository', () => {
  const mockQuery = vi.fn();
  const mockClientQuery = vi.fn();
  const mockRelease = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbFallbackForTests();
    vi.spyOn(poolModule, 'getDbPool').mockReturnValue({
      query: mockQuery,
      connect: async () => ({
        query: mockClientQuery,
        release: mockRelease,
      }),
    } as any);
  });

  describe('Error Handling', () => {
    it('rethrows non-connection errors across query functions', async () => {
      const syntaxError = new Error('syntax error at or near WHERE');
      mockQuery.mockRejectedValue(syntaxError);

      await expect(findUserByEmailOrUsername('admin')).rejects.toThrow('syntax error');
      await expect(findUserById('u1')).rejects.toThrow('syntax error');
      await expect(updateUserRole('u1', 'ADMIN')).rejects.toThrow('syntax error');
      await expect(updateUserPassword('u1', 'pw')).rejects.toThrow('syntax error');
      await expect(deleteUser('u1')).rejects.toThrow('syntax error');
      await expect(listAllUsersWithDetails()).rejects.toThrow('syntax error');
      await expect(getUserProfile('u1')).rejects.toThrow('syntax error');
      await expect(upsertUserProfile('u1', { fullName: 'name' })).rejects.toThrow('syntax error');
      await expect(getUserDeviceTags('u1')).rejects.toThrow('syntax error');
      await expect(tagDeviceToUser('u1', 'AA:BB:CC:DD:EE:FF', 'label')).rejects.toThrow('syntax error');
      await expect(removeDeviceTagFromUser('u1', 'AA:BB:CC:DD:EE:FF')).rejects.toThrow('syntax error');
      await expect(getPaginatedLogins(1, 10)).rejects.toThrow('syntax error');
      await expect(
        saveAiInsight({
          triggeredByUserId: 'u1',
          healthScore: 90,
          previousScore: null,
          scoreDelta: 0,
          trendDirection: 'INITIAL',
          executiveSummary: '',
          resolvedIssues: [],
          persistingIssues: [],
          newIssues: [],
          actionableSuggestions: [],
          metricsSnapshot: {},
        })
      ).rejects.toThrow('syntax error');
      await expect(getRecentAiInsights(5)).rejects.toThrow('syntax error');
      await expect(getLatestAiInsight()).rejects.toThrow('syntax error');
    });
  });

  describe('User Queries', () => {
    it('findUserByEmailOrUsername returns user when found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'uuid-1',
            username: 'admin',
            email: 'admin@omadanoc.com',
            passwordHash: 'hashed123',
            role: 'ADMIN',
          },
        ],
      });

      const user = await findUserByEmailOrUsername('admin@omadanoc.com');
      expect(user).toBeDefined();
      expect(user?.username).toBe('admin');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('findUserByEmailOrUsername returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const user = await findUserByEmailOrUsername('nonexistent');
      expect(user).toBeNull();
    });

    it('findUserById returns user or null', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', username: 'admin', email: 'admin@omada.com', role: 'ADMIN' }],
      });

      const user = await findUserById('uuid-1');
      expect(user?.id).toBe('uuid-1');
    });

    it('createUser creates user and default profile inside transaction', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'new-uuid', username: 'jdoe', email: 'jdoe@test.com', role: 'USER' }],
        }) // INSERT user
        .mockResolvedValueOnce({}) // INSERT profile
        .mockResolvedValueOnce({}); // COMMIT

      const user = await createUser('jdoe', 'jdoe@test.com', 'hashedpass', 'USER', 'John Doe');
      expect(user.id).toBe('new-uuid');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('createUser rolls back on error', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Duplicate key violation')); // INSERT fails

      await expect(
        createUser('duplicate', 'dup@test.com', 'hash', 'USER')
      ).rejects.toThrow('Duplicate key violation');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('updateUserRole updates role', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'uuid-1', role: 'ADMIN' }],
      });

      const res = await updateUserRole('uuid-1', 'ADMIN');
      expect(res?.role).toBe('ADMIN');
    });

    it('updateUserPassword updates password hash', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const success = await updateUserPassword('uuid-1', 'newhash');
      expect(success).toBe(true);
    });

    it('deleteUser deletes user', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const success = await deleteUser('uuid-1');
      expect(success).toBe(true);
    });

    it('listAllUsersWithDetails aggregates users and tagged devices', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'u1',
              username: 'user1',
              email: 'u1@test.com',
              role: 'USER',
              fullName: 'User One',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'tag1',
              userId: 'u1',
              macAddress: 'AA:BB:CC:DD:EE:01',
              deviceName: 'Work Laptop',
            },
          ],
        });

      const users = await listAllUsersWithDetails();
      expect(users).toHaveLength(1);
      expect(users[0].taggedDevices).toHaveLength(1);
      expect(users[0].taggedDevices[0].macAddress).toBe('AA:BB:CC:DD:EE:01');
    });
  });

  describe('Profile Queries', () => {
    it('getUserProfile returns profile or null', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', userId: 'u1', fullName: 'Jane Doe', theme: 'dark' }],
      });

      const profile = await getUserProfile('u1');
      expect(profile?.fullName).toBe('Jane Doe');
    });

    it('upsertUserProfile inserts or updates profile', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'p1', userId: 'u1', fullName: 'Updated Name', theme: 'dark' }],
      });

      const profile = await upsertUserProfile('u1', { fullName: 'Updated Name' });
      expect(profile.fullName).toBe('Updated Name');
    });
  });

  describe('Device Tagging Queries', () => {
    it('getUserDeviceTags returns tags list', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 't1', userId: 'u1', macAddress: 'AA:BB:CC:DD:EE:FF' }],
      });

      const tags = await getUserDeviceTags('u1');
      expect(tags).toHaveLength(1);
    });

    it('tagDeviceToUser normalizes MAC and inserts tag', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 't1', userId: 'u1', macAddress: 'AA:BB:CC:DD:EE:FF', deviceName: 'My iPad' }],
      });

      const tag = await tagDeviceToUser('u1', 'aa:bb:cc:dd:ee:ff', 'My iPad');
      expect(tag.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('removeDeviceTagFromUser deletes tag by user and MAC', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      const success = await removeDeviceTagFromUser('u1', 'aa:bb:cc:dd:ee:ff');
      expect(success).toBe(true);
    });
  });

  describe('Login Audit Queries', () => {
    it('recordLoginAttempt inserts login record', async () => {
      mockQuery.mockResolvedValueOnce({});
      await recordLoginAttempt('u1', 'user@test.com', '127.0.0.1', 'Mozilla', 'SUCCESS', null);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('recordLoginAttempt catches non-connection errors gracefully without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockQuery.mockRejectedValueOnce(new Error('Audit table disk full'));
      await recordLoginAttempt('u1', 'user@test.com', '127.0.0.1', 'Mozilla', 'FAILED', 'Disk issue');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('getPaginatedLogins returns 10 items per page with totals', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'l1',
              email: 'admin@test.com',
              ipAddress: '127.0.0.1',
              loginStatus: 'SUCCESS',
            },
          ],
        });

      const res = await getPaginatedLogins(1, 10);
      expect(res.total).toBe(25);
      expect(res.totalPages).toBe(3);
      expect(res.items).toHaveLength(1);
    });
  });

  describe('AI Insights History Queries', () => {
    it('saveAiInsight executes insert query with parameterized values', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ins-1',
            createdAt: '2026-08-28T12:00:00Z',
            triggeredByUserId: 'u1',
            healthScore: 90,
            previousScore: 85,
            scoreDelta: 5,
            trendDirection: 'IMPROVED',
            executiveSummary: 'Telemetry improved.',
            resolvedIssues: [],
            persistingIssues: [],
            newIssues: [],
            actionableSuggestions: [],
            metricsSnapshot: {},
          },
        ],
      });

      const res = await saveAiInsight({
        triggeredByUserId: 'u1',
        healthScore: 90,
        previousScore: 85,
        scoreDelta: 5,
        trendDirection: 'IMPROVED',
        executiveSummary: 'Telemetry improved.',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: {},
      });

      expect(res.id).toBe('ins-1');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('getRecentAiInsights and getLatestAiInsight fetch history records', async () => {
      const mockRows = [
        {
          id: 'ins-1',
          createdAt: '2026-08-28T12:00:00Z',
          healthScore: 90,
          scoreDelta: 5,
          trendDirection: 'IMPROVED',
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRows });
      const recent = await getRecentAiInsights(5);
      expect(recent).toHaveLength(1);

      mockQuery.mockResolvedValueOnce({ rows: mockRows });
      const latest = await getLatestAiInsight();
      expect(latest?.id).toBe('ins-1');

      // Test empty latest
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const emptyLatest = await getLatestAiInsight();
      expect(emptyLatest).toBeNull();
    });

    it('falls back to memory store on connection errors in saveAiInsight, getRecentAiInsights, and getLatestAiInsight', async () => {
      resetDbFallbackForTests();
      const connErr = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
        code: 'ECONNREFUSED',
      });
      mockQuery.mockRejectedValue(connErr);

      const saved = await saveAiInsight({
        triggeredByUserId: 'u-mem-1',
        healthScore: 88,
        previousScore: 80,
        scoreDelta: 8,
        trendDirection: 'IMPROVED',
        executiveSummary: 'Saved to memory fallback',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: { engineType: 'DEEPSEEK_AGENT', llmModel: 'deepseek-r1:7b' },
      });

      expect(saved.healthScore).toBe(88);
      expect(saved.engineType).toBe('DEEPSEEK_AGENT');

      const recent = await getRecentAiInsights(5);
      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent[0].healthScore).toBe(88);

      const latest = await getLatestAiInsight();
      expect(latest).toBeDefined();
      expect(latest?.healthScore).toBe(88);
    });
  });
});
