import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDbPool,
  closeDbPool,
  isConnectionOrAuthError,
  activateMemoryFallback,
  isMemoryFallbackActive,
  resetMemoryFallback,
} from '@/lib/db/pool';
import { initDb } from '@/lib/db/schema';
import * as poolModule from '@/lib/db/pool';
import * as passwordModule from '@/lib/auth/password';

describe('Database Pool and Schema Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryFallback();
  });

  afterEach(async () => {
    await closeDbPool();
  });

  describe('Pool Management & Error Handling', () => {
    it('initializes and returns a singleton connection pool', async () => {
      const pool1 = getDbPool();
      const pool2 = getDbPool();
      expect(pool1).toBe(pool2);
      expect(pool1).toBeDefined();

      await closeDbPool();
      const pool3 = getDbPool();
      expect(pool3).toBeDefined();
      await closeDbPool();
    });

    it('identifies connection and auth errors accurately', () => {
      expect(isConnectionOrAuthError(null)).toBe(false);
      expect(isConnectionOrAuthError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isConnectionOrAuthError({ code: '28P01' })).toBe(true);
      expect(isConnectionOrAuthError({ code: '3D000' })).toBe(true);
      expect(isConnectionOrAuthError(new Error('password authentication failed for user postgres'))).toBe(true);
      expect(isConnectionOrAuthError(new Error('connection terminated unexpectedly'))).toBe(true);
      expect(isConnectionOrAuthError(new Error('syntax error at or near WHERE'))).toBe(false);
    });

    it('activates and resets memory fallback state', () => {
      expect(isMemoryFallbackActive()).toBe(false);
      activateMemoryFallback('Testing fallback');
      expect(isMemoryFallbackActive()).toBe(true);
      resetMemoryFallback();
      expect(isMemoryFallbackActive()).toBe(false);
    });

    it('handles pool error events correctly', () => {
      const pool = getDbPool();
      const errorListeners = pool.listeners('error');
      expect(errorListeners.length).toBeGreaterThan(0);

      // Trigger connection error listener
      const connErr = new Error('Connection terminated');
      (connErr as any).code = 'ECONNREFUSED';
      errorListeners[0](connErr);
      expect(isMemoryFallbackActive()).toBe(true);

      // Trigger unexpected non-connection error listener
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const unexpectedErr = new Error('Unexpected pool corruption');
      errorListeners[0](unexpectedErr);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Schema Initialization & Auto-Seeding', () => {
    it('executes create table queries and seeds admin if user count is 0', async () => {
      const mockQuery = vi
        .fn()
        // 1. CREATE TABLE query
        .mockResolvedValueOnce({})
        // 2. SELECT COUNT(*) query (0 users)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        // 3. INSERT user query
        .mockResolvedValueOnce({ rows: [{ id: 'seeded-admin-id' }] })
        // 4. INSERT profile query
        .mockResolvedValueOnce({});

      vi.spyOn(poolModule, 'getDbPool').mockReturnValue({ query: mockQuery } as any);
      vi.spyOn(passwordModule, 'hashPassword').mockResolvedValue('$2a$10$seededAdminHash');

      await initDb();

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(mockQuery.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO users');
      expect(mockQuery.mock.calls[3][0]).toContain('INSERT INTO user_profiles');
    });

    it('skips seeding when users already exist in the database', async () => {
      const mockQuery = vi
        .fn()
        // 1. CREATE TABLE query
        .mockResolvedValueOnce({})
        // 2. SELECT COUNT(*) query (1 user exists)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      vi.spyOn(poolModule, 'getDbPool').mockReturnValue({ query: mockQuery } as any);

      await initDb();

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
